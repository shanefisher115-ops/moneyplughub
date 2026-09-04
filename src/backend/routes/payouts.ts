import { Router, Request, Response } from 'express';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { ApiResponse } from '../../types';

const router = Router();

// Ensure stripe_connect_id exists on users table if not already added
try {
  db.exec(`ALTER TABLE users ADD COLUMN stripe_connect_id TEXT;`);
} catch (e) {
  // Column already exists
}

// Table to track generated payout batches
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated' CHECK(status IN ('generated', 'processing', 'completed', 'failed')),
      total_creators INTEGER NOT NULL DEFAULT 0,
      total_amount_cents INTEGER NOT NULL DEFAULT 0,
      transfer_group TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_payout_batches_created ON payout_batches(created_at);
  `);
} catch (e) {
  // Table already exists
}

export interface CreatorPayoutSummary {
  referrer_user_id: string;
  display_name: string;
  email: string;
  stripe_connect_id: string | null;
  approved_cents: number;
  commission_ids: string[];
  is_eligible: boolean;
}

export interface StripeTransferPayload {
  amount: number; // in cents
  currency: string;
  destination: string; // Stripe Connect Account ID
  transfer_group: string;
  metadata: {
    referrer_user_id: string;
    commission_count: number;
    commission_ids: string;
    email: string;
  };
}

/**
 * Aggregates approved commission_ledger balances per referrer.
 */
export function aggregateCommissionBalances(minThresholdCents: number = 5000): CreatorPayoutSummary[] {
  const rows = db.prepare(`
    SELECT
      c.referrer_user_id,
      u.display_name,
      u.email,
      u.stripe_connect_id,
      c.id as commission_id,
      c.amount_cents
    FROM commission_ledger c
    JOIN users u ON c.referrer_user_id = u.id
    WHERE c.status = 'approved'
    ORDER BY c.created_at ASC
  `).all() as any[];

  const summaryMap: Map<string, CreatorPayoutSummary> = new Map();

  for (const row of rows) {
    const existing = summaryMap.get(row.referrer_user_id);
    if (existing) {
      existing.approved_cents += row.amount_cents;
      existing.commission_ids.push(row.commission_id);
    } else {
      summaryMap.set(row.referrer_user_id, {
        referrer_user_id: row.referrer_user_id,
        display_name: row.display_name,
        email: row.email,
        stripe_connect_id: row.stripe_connect_id || null,
        approved_cents: row.amount_cents,
        commission_ids: [row.commission_id],
        is_eligible: false, // Calculated after aggregation
      });
    }
  }

  const summaries = Array.from(summaryMap.values());
  for (const summary of summaries) {
    summary.is_eligible = summary.approved_cents >= minThresholdCents;
  }

  return summaries;
}

/**
 * Validates minimum payout threshold on a list of summaries.
 */
export function validateMinimumThreshold(
  summaries: CreatorPayoutSummary[],
  minThresholdCents: number = 5000
): { eligible: CreatorPayoutSummary[]; ineligible: CreatorPayoutSummary[] } {
  const eligible: CreatorPayoutSummary[] = [];
  const ineligible: CreatorPayoutSummary[] = [];

  for (const item of summaries) {
    if (item.approved_cents >= minThresholdCents) {
      eligible.push({ ...item, is_eligible: true });
    } else {
      ineligible.push({ ...item, is_eligible: false });
    }
  }

  return { eligible, ineligible };
}

/**
 * Generates Stripe Connect batch transfer payloads for eligible creators with a Stripe Connect ID.
 */
export function generateStripeConnectBatchPayload(
  eligibleSummaries: CreatorPayoutSummary[],
  transferGroup?: string
): {
  transfers: StripeTransferPayload[];
  skippedNoStripeAccount: CreatorPayoutSummary[];
  transfer_group: string;
  total_amount_cents: number;
} {
  const group = transferGroup || `payout_batch_${Date.now()}`;
  const transfers: StripeTransferPayload[] = [];
  const skippedNoStripeAccount: CreatorPayoutSummary[] = [];
  let totalAmountCents = 0;

  for (const summary of eligibleSummaries) {
    if (!summary.stripe_connect_id) {
      skippedNoStripeAccount.push(summary);
      continue;
    }

    transfers.push({
      amount: summary.approved_cents,
      currency: 'usd',
      destination: summary.stripe_connect_id,
      transfer_group: group,
      metadata: {
        referrer_user_id: summary.referrer_user_id,
        commission_count: summary.commission_ids.length,
        commission_ids: summary.commission_ids.join(','),
        email: summary.email,
      },
    });

    totalAmountCents += summary.approved_cents;
  }

  return {
    transfers,
    skippedNoStripeAccount,
    transfer_group: group,
    total_amount_cents: totalAmountCents,
  };
}

/**
 * Execute/Process a payout batch — marks commissions as paid and logs transactions.
 */
export function executePayoutBatch(
  batchId: string,
  adminUserId: string,
  summariesToProcess: CreatorPayoutSummary[],
  transferGroup: string,
  transfersPayload: StripeTransferPayload[]
): { processedCount: number; totalAmountCents: number } {
  const now = new Date().toISOString();
  let totalProcessedCents = 0;
  let totalCommissionsProcessed = 0;

  runInTransaction(() => {
    // 1. Record the payout batch in DB
    db.prepare(`
      INSERT INTO payout_batches (
        id, created_by, status, total_creators, total_amount_cents, transfer_group, payload_json, created_at, updated_at
      ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?)
    `).run(
      batchId,
      adminUserId,
      transfersPayload.length,
      transfersPayload.reduce((acc, t) => acc + t.amount, 0),
      transferGroup,
      JSON.stringify(transfersPayload),
      now,
      now
    );

    // 2. Mark commissions as 'paid' and credit account for processed creators
    const updateCommStmt = db.prepare(`
      UPDATE commission_ledger
      SET status = 'paid', updated_at = ?
      WHERE id = ? AND status = 'approved'
    `);

    for (const summary of summariesToProcess) {
      if (!summary.stripe_connect_id) continue; // Skip creators without stripe account

      for (const commId of summary.commission_ids) {
        updateCommStmt.run(now, commId);
        totalCommissionsProcessed++;
      }

      totalProcessedCents += summary.approved_cents;

      // Ensure referrer has a bank account to receive the payout credit
      let bankAcc = db.prepare(`SELECT id FROM accounts WHERE user_id = ? AND type = 'bank' LIMIT 1`).get(summary.referrer_user_id) as any;
      if (!bankAcc) {
        const accId = `acc_payout_${summary.referrer_user_id}_bank`;
        db.prepare(`
          INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
          VALUES (?, ?, 'Stripe Connect Payout Account', 'bank', 0, 'USD', 'Stripe Connect', 0, ?, ?)
        `).run(accId, summary.referrer_user_id, now, now);
        bankAcc = { id: accId };
      }

      db.prepare(`
        UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ?
        WHERE id = ?
      `).run(summary.approved_cents, now, bankAcc.id);

      // Log income transaction record
      const txId = `tx_stripe_payout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      db.prepare(`
        INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at)
        VALUES (?, ?, ?, 'Referral Commission', 'income', ?, ?, ?, 0, ?)
      `).run(
        txId,
        summary.referrer_user_id,
        bankAcc.id,
        summary.approved_cents,
        `Stripe Connect Batch Payout (${transferGroup})`,
        now.substring(0, 10),
        now
      );
    }

    recordAuditLog(adminUserId, 'PAYOUT_BATCH_EXECUTED', 'payout_batches', batchId, {
      total_creators: transfersPayload.length,
      total_amount_cents: totalProcessedCents,
      commissions_count: totalCommissionsProcessed,
      transfer_group: transferGroup,
    });
  });

  return {
    processedCount: transfersPayload.length,
    totalAmountCents: totalProcessedCents,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/payouts/eligible
 * Admin route to inspect current approved commission ledger balances and eligibility.
 * Query parameters: min_threshold (cents, default: 5000)
 */
router.get('/eligible', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const minThresholdCents = parseInt((req.query.min_threshold as string) || '5000', 10);
  const summaries = aggregateCommissionBalances(minThresholdCents);
  const { eligible, ineligible } = validateMinimumThreshold(summaries, minThresholdCents);

  res.json({
    success: true,
    data: {
      min_threshold_cents: minThresholdCents,
      total_creators_with_approved_commissions: summaries.length,
      eligible_creators_count: eligible.length,
      ineligible_creators_count: ineligible.length,
      eligible,
      ineligible,
    },
  });
});

/**
 * POST /api/payouts/generate-batch
 * Admin route to dry-run and generate Stripe Connect transfer payloads.
 * Body parameters: min_threshold (cents, default: 5000), transfer_group (optional)
 */
router.post('/generate-batch', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const minThresholdCents = parseInt(req.body.min_threshold || '5000', 10);
  const customTransferGroup = req.body.transfer_group as string | undefined;

  const summaries = aggregateCommissionBalances(minThresholdCents);
  const { eligible } = validateMinimumThreshold(summaries, minThresholdCents);
  const batchResult = generateStripeConnectBatchPayload(eligible, customTransferGroup);

  res.json({
    success: true,
    data: {
      min_threshold_cents: minThresholdCents,
      transfer_group: batchResult.transfer_group,
      total_amount_cents: batchResult.total_amount_cents,
      total_transfers: batchResult.transfers.length,
      skipped_creators_no_stripe_id: batchResult.skippedNoStripeAccount.length,
      transfers: batchResult.transfers,
      skipped: batchResult.skippedNoStripeAccount,
    },
  });
});

/**
 * POST /api/payouts/process-batch
 * Admin route to execute a batch payout, updating commission status to 'paid' and generating ledger transactions.
 */
router.post('/process-batch', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const minThresholdCents = parseInt(req.body.min_threshold || '5000', 10);
  const customTransferGroup = req.body.transfer_group;

  const summaries = aggregateCommissionBalances(minThresholdCents);
  const { eligible } = validateMinimumThreshold(summaries, minThresholdCents);
  const batchResult = generateStripeConnectBatchPayload(eligible, customTransferGroup);

  if (batchResult.transfers.length === 0) {
    res.status(400).json({
      success: false,
      error: 'No eligible creators with valid Stripe Connect IDs found for payout batch execution.',
    });
    return;
  }

  const batchId = `pbatch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  try {
    const execResult = executePayoutBatch(
      batchId,
      req.user!.id,
      eligible,
      batchResult.transfer_group,
      batchResult.transfers
    );

    res.json({
      success: true,
      message: `Successfully executed Stripe Connect payout batch (${batchResult.transfer_group}) for ${execResult.processedCount} creators ($${(execResult.totalAmountCents / 100).toFixed(2)}).`,
      data: {
        batch_id: batchId,
        transfer_group: batchResult.transfer_group,
        creators_paid: execResult.processedCount,
        total_amount_cents: execResult.totalAmountCents,
        transfers: batchResult.transfers,
      },
    });
  } catch (err: any) {
    console.error('Failed to process payout batch:', err);
    res.status(500).json({
      success: false,
      error: `Payout batch execution failed: ${err.message}`,
    });
  }
});

/**
 * GET /api/payouts/my-status
 * Authenticated creator route to view personal payout eligibility and approved ledger balance.
 */
router.get('/my-status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const user = db.prepare('SELECT id, display_name, email, stripe_connect_id FROM users WHERE id = ?').get(userId) as any;

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const approvedStats = db.prepare(`
    SELECT
      COALESCE(SUM(amount_cents), 0) as approved_cents,
      COUNT(*) as count
    FROM commission_ledger
    WHERE referrer_user_id = ? AND status = 'approved'
  `).get(userId) as any;

  const pendingStats = db.prepare(`
    SELECT
      COALESCE(SUM(amount_cents), 0) as pending_cents,
      COUNT(*) as count
    FROM commission_ledger
    WHERE referrer_user_id = ? AND status = 'pending'
  `).get(userId) as any;

  const paidStats = db.prepare(`
    SELECT
      COALESCE(SUM(amount_cents), 0) as paid_cents,
      COUNT(*) as count
    FROM commission_ledger
    WHERE referrer_user_id = ? AND status = 'paid'
  `).get(userId) as any;

  const minThresholdCents = 5000; // $50.00 USD default
  const approvedCents = Number(approvedStats?.approved_cents || 0);
  const isEligible = approvedCents >= minThresholdCents;

  res.json({
    success: true,
    data: {
      user_id: userId,
      stripe_connect_id: user.stripe_connect_id || null,
      has_stripe_connected: Boolean(user.stripe_connect_id),
      min_payout_threshold_cents: minThresholdCents,
      is_eligible_for_payout: isEligible && Boolean(user.stripe_connect_id),
      balances: {
        approved_cents: approvedCents,
        approved_count: Number(approvedStats?.count || 0),
        pending_cents: Number(pendingStats?.pending_cents || 0),
        pending_count: Number(pendingStats?.count || 0),
        paid_cents: Number(paidStats?.paid_cents || 0),
        paid_count: Number(paidStats?.count || 0),
      },
      next_steps: !user.stripe_connect_id
        ? 'Connect your Stripe account to receive automated payout transfers.'
        : !isEligible
        ? `Reach $${(minThresholdCents / 100).toFixed(2)} in approved commissions to trigger automated batch payout.`
        : 'Your account is ready and queued for the next automated Stripe Connect batch payout.',
    },
  });
});

/**
 * PATCH /api/payouts/update-stripe-account
 * Authenticated creator route to set or update their Stripe Connect ID.
 */
router.patch('/update-stripe-account', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { stripe_connect_id } = req.body;

  if (!stripe_connect_id || typeof stripe_connect_id !== 'string' || !stripe_connect_id.startsWith('acct_')) {
    res.status(400).json({
      success: false,
      error: 'Invalid Stripe Connect account ID. Must start with "acct_".',
    });
    return;
  }

  db.prepare('UPDATE users SET stripe_connect_id = ?, updated_at = ? WHERE id = ?').run(
    stripe_connect_id,
    new Date().toISOString(),
    req.user!.id
  );

  res.json({
    success: true,
    message: 'Stripe Connect Account ID updated successfully.',
    data: {
      stripe_connect_id,
    },
  });
});

/**
 * GET /api/payouts/history
 * Admin route to view historical payout batch executions.
 */
router.get('/history', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const batches = db.prepare(`
    SELECT
      b.*,
      u.display_name as creator_display_name,
      u.email as creator_email
    FROM payout_batches b
    JOIN users u ON b.created_by = u.id
    ORDER BY b.created_at DESC
  `).all();

  res.json({
    success: true,
    data: batches,
  });
});

export default router;
