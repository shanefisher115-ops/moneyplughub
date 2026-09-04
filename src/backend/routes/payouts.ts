import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config';

const router = Router();

const stripeSecretKey = config.stripe.secretKey || process.env.STRIPE_SECRET_KEY || 'sk_test_stripe_moneyplughub_2026';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as any,
});

export interface CreatorCommissionAggregation {
  user_id: string;
  display_name: string;
  email: string;
  stripe_connect_account_id: string | null;
  total_unpaid_cents: number;
  total_unpaid_usd: number;
  commission_count: number;
  commission_ids: string[];
  meets_threshold: boolean;
  has_connect_account: boolean;
}

export interface PayoutAggregationResult {
  min_threshold_cents: number;
  min_threshold_usd: number;
  status_filter: string;
  eligible_creators: CreatorCommissionAggregation[];
  creators_missing_connect: CreatorCommissionAggregation[];
  below_threshold_creators: CreatorCommissionAggregation[];
  summary: {
    total_unpaid_cents: number;
    total_unpaid_usd: number;
    eligible_cents: number;
    eligible_usd: number;
    eligible_creator_count: number;
    missing_connect_creator_count: number;
    below_threshold_creator_count: number;
    total_creators_count: number;
    total_commissions_count: number;
  };
}

export interface StripeTransferPayload {
  amount: number;
  currency: string;
  destination: string;
  description: string;
  transfer_group: string;
  metadata: {
    user_id: string;
    user_email: string;
    batch_id: string;
    commission_count: number;
    commission_ids: string;
  };
}

export interface BatchPayloadResult {
  batch_id: string;
  created_at: string;
  min_threshold_cents: number;
  total_amount_cents: number;
  total_amount_usd: number;
  creator_count: number;
  payloads: StripeTransferPayload[];
  missing_connect_creators: CreatorCommissionAggregation[];
  below_threshold_creators: CreatorCommissionAggregation[];
}

/**
 * Aggregates unpaid commission_ledger balances per creator,
 * validates against minimum payout threshold, and separates
 * creators by eligibility and Stripe Connect setup.
 */
export function aggregateCommissionBalances(options?: {
  minThresholdCents?: number;
  statusFilter?: string;
}): PayoutAggregationResult {
  const minThresholdCents = options?.minThresholdCents ?? 5000; // Default $50.00
  const statusFilter = options?.statusFilter ?? 'approved';

  // Query commission_ledger grouped by referrer_user_id
  const rows = db.prepare(`
    SELECT
      cl.referrer_user_id as user_id,
      u.display_name,
      u.email,
      u.stripe_connect_account_id,
      COALESCE(SUM(cl.amount_cents), 0) as total_unpaid_cents,
      COUNT(cl.id) as commission_count,
      GROUP_CONCAT(cl.id) as commission_ids_str
    FROM commission_ledger cl
    JOIN users u ON u.id = cl.referrer_user_id
    WHERE cl.status = ?
    GROUP BY cl.referrer_user_id
    ORDER BY total_unpaid_cents DESC
  `).all(statusFilter) as any[];

  const eligible_creators: CreatorCommissionAggregation[] = [];
  const creators_missing_connect: CreatorCommissionAggregation[] = [];
  const below_threshold_creators: CreatorCommissionAggregation[] = [];

  let total_unpaid_cents = 0;
  let eligible_cents = 0;
  let total_commissions_count = 0;

  for (const row of rows) {
    const unpaidCents = Number(row.total_unpaid_cents || 0);
    const commCount = Number(row.commission_count || 0);
    const commIds = row.commission_ids_str ? row.commission_ids_str.split(',') : [];
    const connectAccountId = row.stripe_connect_account_id ? String(row.stripe_connect_account_id).trim() : null;

    total_unpaid_cents += unpaidCents;
    total_commissions_count += commCount;

    const aggregation: CreatorCommissionAggregation = {
      user_id: row.user_id,
      display_name: row.display_name || 'Creator',
      email: row.email || '',
      stripe_connect_account_id: connectAccountId,
      total_unpaid_cents: unpaidCents,
      total_unpaid_usd: Number((unpaidCents / 100).toFixed(2)),
      commission_count: commCount,
      commission_ids: commIds,
      meets_threshold: unpaidCents >= minThresholdCents,
      has_connect_account: Boolean(connectAccountId),
    };

    if (unpaidCents >= minThresholdCents) {
      if (connectAccountId) {
        eligible_creators.push(aggregation);
        eligible_cents += unpaidCents;
      } else {
        creators_missing_connect.push(aggregation);
      }
    } else {
      below_threshold_creators.push(aggregation);
    }
  }

  return {
    min_threshold_cents: minThresholdCents,
    min_threshold_usd: Number((minThresholdCents / 100).toFixed(2)),
    status_filter: statusFilter,
    eligible_creators,
    creators_missing_connect,
    below_threshold_creators,
    summary: {
      total_unpaid_cents,
      total_unpaid_usd: Number((total_unpaid_cents / 100).toFixed(2)),
      eligible_cents,
      eligible_usd: Number((eligible_cents / 100).toFixed(2)),
      eligible_creator_count: eligible_creators.length,
      missing_connect_creator_count: creators_missing_connect.length,
      below_threshold_creator_count: below_threshold_creators.length,
      total_creators_count: rows.length,
      total_commissions_count,
    },
  };
}

/**
 * Generates batch Stripe Connect transfer payloads for creators
 * meeting minimum payout threshold.
 */
export function generateStripeConnectBatchPayloads(options?: {
  minThresholdCents?: number;
  batchId?: string;
  notes?: string;
}): BatchPayloadResult {
  const minThresholdCents = options?.minThresholdCents ?? 5000;
  const batchId = options?.batchId ?? `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  const aggregation = aggregateCommissionBalances({ minThresholdCents, statusFilter: 'approved' });

  const payloads: StripeTransferPayload[] = [];
  let totalBatchCents = 0;

  for (const creator of aggregation.eligible_creators) {
    if (!creator.stripe_connect_account_id) continue;

    const payload: StripeTransferPayload = {
      amount: creator.total_unpaid_cents,
      currency: 'usd',
      destination: creator.stripe_connect_account_id,
      description: `MoneyPlugHub Creator Commission Payout (Batch: ${batchId})`,
      transfer_group: batchId,
      metadata: {
        user_id: creator.user_id,
        user_email: creator.email,
        batch_id: batchId,
        commission_count: creator.commission_count,
        commission_ids: JSON.stringify(creator.commission_ids),
      },
    };

    payloads.push(payload);
    totalBatchCents += creator.total_unpaid_cents;
  }

  // Save batch record and payout items in DB
  runInTransaction(() => {
    db.prepare(`
      INSERT INTO payout_batches (
        id, batch_id, total_amount_cents, creator_count, min_threshold_cents, status, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
    `).run(
      `pbatch_${Date.now()}`,
      batchId,
      totalBatchCents,
      payloads.length,
      minThresholdCents,
      JSON.stringify(payloads),
      now
    );

    const insertItem = db.prepare(`
      INSERT INTO payout_items (
        id, batch_id, user_id, stripe_connect_account_id, amount_cents, currency, commission_ids, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'USD', ?, 'pending', ?)
    `);

    for (const p of payloads) {
      const itemId = `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      insertItem.run(
        itemId,
        batchId,
        p.metadata.user_id,
        p.destination,
        p.amount,
        p.metadata.commission_ids,
        now
      );
    }
  });

  return {
    batch_id: batchId,
    created_at: now,
    min_threshold_cents: minThresholdCents,
    total_amount_cents: totalBatchCents,
    total_amount_usd: Number((totalBatchCents / 100).toFixed(2)),
    creator_count: payloads.length,
    payloads,
    missing_connect_creators: aggregation.creators_missing_connect,
    below_threshold_creators: aggregation.below_threshold_creators,
  };
}

/**
 * Executes batch Stripe Connect transfers for a generated batch.
 * Updates commission_ledger entries to 'paid' and logs accounting transactions.
 */
export async function executeBatchPayouts(
  batchId: string,
  options?: { mockStripe?: boolean }
): Promise<{
  success: boolean;
  batch_id: string;
  transferred_count: number;
  failed_count: number;
  total_transferred_cents: number;
  results: Array<{
    user_id: string;
    amount_cents: number;
    stripe_transfer_id: string | null;
    status: 'transferred' | 'failed';
    error?: string;
  }>;
}> {
  const batch = db.prepare('SELECT * FROM payout_batches WHERE batch_id = ?').get(batchId) as any;
  if (!batch) {
    throw new Error(`Payout batch ${batchId} not found.`);
  }

  const items = db.prepare('SELECT * FROM payout_items WHERE batch_id = ?').get ?
    db.prepare('SELECT * FROM payout_items WHERE batch_id = ?').all(batchId) as any[] : [];

  if (items.length === 0) {
    throw new Error(`No payout items found for batch ${batchId}.`);
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE payout_batches SET status = 'processing' WHERE batch_id = ?").run(batchId);

  const results: Array<{
    user_id: string;
    amount_cents: number;
    stripe_transfer_id: string | null;
    status: 'transferred' | 'failed';
    error?: string;
  }> = [];

  let transferredCount = 0;
  let failedCount = 0;
  let totalTransferredCents = 0;

  for (const item of items) {
    const commIds: string[] = JSON.parse(item.commission_ids || '[]');

    try {
      let transferId: string;

      if (options?.mockStripe || stripeSecretKey.startsWith('sk_test_mock')) {
        transferId = `tr_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      } else {
        const transfer = await stripe.transfers.create({
          amount: item.amount_cents,
          currency: (item.currency || 'usd').toLowerCase(),
          destination: item.stripe_connect_account_id,
          description: `Creator Payout Batch ${batchId}`,
          transfer_group: batchId,
          metadata: {
            user_id: item.user_id,
            batch_id: batchId,
          },
        });
        transferId = transfer.id;
      }

      runInTransaction(() => {
        // Update payout item status
        db.prepare(`
          UPDATE payout_items
          SET status = 'transferred', stripe_transfer_id = ?, executed_at = ?
          WHERE id = ?
        `).run(transferId, now, item.id);

        // Update commission_ledger entries to paid
        if (commIds.length > 0) {
          const placeholders = commIds.map(() => '?').join(',');
          db.prepare(`
            UPDATE commission_ledger
            SET status = 'paid', updated_at = ?
            WHERE id IN (${placeholders})
          `).run(now, ...commIds);
        }

        // Ensure creator has a primary bank account in accounts table
        let bankAccount = db.prepare(`
          SELECT id FROM accounts WHERE user_id = ? AND type = 'bank' LIMIT 1
        `).get(item.user_id) as any;

        if (!bankAccount) {
          const accId = `acc_${item.user_id}_bank`;
          db.prepare(`
            INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
            VALUES (?, ?, 'Stripe Connect Direct Deposit', 'bank', 0, 'USD', 'Stripe Connect', 0, ?, ?)
          `).run(accId, item.user_id, now, now);
          bankAccount = { id: accId };
        }

        // Credit creator's bank account in accounts table
        db.prepare(`
          UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ?
          WHERE id = ?
        `).run(item.amount_cents, now, bankAccount.id);

        // Log transaction entry
        const txId = `tx_payout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        db.prepare(`
          INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at)
          VALUES (?, ?, ?, 'Referral Commission', 'income', ?, ?, ?, 0, ?)
        `).run(txId, item.user_id, bankAccount.id, item.amount_cents, `Stripe Connect Payout (Transfer: ${transferId})`, now.substring(0, 10), now);
      });

      transferredCount++;
      totalTransferredCents += item.amount_cents;
      results.push({
        user_id: item.user_id,
        amount_cents: item.amount_cents,
        stripe_transfer_id: transferId,
        status: 'transferred',
      });
    } catch (err: any) {
      console.error(`Failed transfer for user ${item.user_id}:`, err);
      failedCount++;
      db.prepare(`
        UPDATE payout_items SET status = 'failed', error = ? WHERE id = ?
      `).run(err.message || 'Transfer failed', item.id);

      results.push({
        user_id: item.user_id,
        amount_cents: item.amount_cents,
        stripe_transfer_id: null,
        status: 'failed',
        error: err.message || 'Transfer failed',
      });
    }
  }

  const finalBatchStatus = failedCount === 0 ? 'completed' : transferredCount > 0 ? 'completed' : 'failed';
  db.prepare(`
    UPDATE payout_batches SET status = ?, executed_at = ? WHERE batch_id = ?
  `).run(finalBatchStatus, now, batchId);

  recordAuditLog(null, 'BATCH_PAYOUT_EXECUTED', 'payout_batches', batchId, {
    transferred_count: transferredCount,
    failed_count: failedCount,
    total_transferred_cents: totalTransferredCents,
  });

  return {
    success: finalBatchStatus === 'completed',
    batch_id: batchId,
    transferred_count: transferredCount,
    failed_count: failedCount,
    total_transferred_cents: totalTransferredCents,
    results,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  EXPRESS ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/payouts/aggregate
 * Admin endpoint: aggregates unpaid commission ledger balances and evaluates thresholds.
 */
router.get('/aggregate', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const minThresholdCents = req.query.min_threshold_cents ? Number(req.query.min_threshold_cents) : 5000;
    const statusFilter = (req.query.status as string) || 'approved';

    const result = aggregateCommissionBalances({ minThresholdCents, statusFilter });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payouts/batch/generate
 * Admin endpoint: generates Stripe Connect transfer payloads for all eligible creators.
 */
router.post('/batch/generate', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const minThresholdCents = req.body.min_threshold_cents ? Number(req.body.min_threshold_cents) : 5000;
    const notes = req.body.notes ? String(req.body.notes) : undefined;

    const batchResult = generateStripeConnectBatchPayloads({ minThresholdCents, notes });
    recordAuditLog(req.user!.id, 'PAYOUT_BATCH_GENERATED', 'payout_batches', batchResult.batch_id, {
      creator_count: batchResult.creator_count,
      total_amount_cents: batchResult.total_amount_cents,
    });

    res.json({ success: true, data: batchResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payouts/batch/:batchId/execute
 * Admin endpoint: dispatches batch Stripe Connect transfers.
 */
router.post('/batch/:batchId/execute', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const batchId = req.params.batchId;
    const mockMode = req.body.mock_mode === true;

    const executionResult = await executeBatchPayouts(batchId, { mockStripe: mockMode });
    res.json({ success: true, data: executionResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payouts/batches
 * Admin endpoint: lists historical payout batches.
 */
router.get('/batches', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const batches = db.prepare('SELECT * FROM payout_batches ORDER BY created_at DESC LIMIT 50').all();
    res.json({ success: true, data: batches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payouts/batches/:batchId
 * Admin endpoint: gets details and items for a specific batch.
 */
router.get('/batches/:batchId', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const batchId = req.params.batchId;
    const batch = db.prepare('SELECT * FROM payout_batches WHERE batch_id = ?').get(batchId);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Payout batch not found.' });
      return;
    }
    const items = db.prepare('SELECT * FROM payout_items WHERE batch_id = ?').all(batchId);
    res.json({ success: true, data: { batch, items } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payouts/connect-account
 * Authenticated Creator: registers or updates their Stripe Connect account ID.
 */
router.post('/connect-account', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const connectAccountId = (req.body.stripe_connect_account_id as string || '').trim();

    if (!connectAccountId) {
      res.status(400).json({ success: false, error: 'stripe_connect_account_id is required.' });
      return;
    }

    if (!connectAccountId.startsWith('acct_')) {
      res.status(400).json({ success: false, error: 'Invalid Stripe Connect account ID format (must start with acct_).' });
      return;
    }

    db.prepare('UPDATE users SET stripe_connect_account_id = ?, updated_at = ? WHERE id = ?').run(
      connectAccountId,
      new Date().toISOString(),
      userId
    );

    recordAuditLog(userId, 'CONNECT_ACCOUNT_UPDATED', 'users', userId, { stripe_connect_account_id: connectAccountId });

    res.json({
      success: true,
      message: 'Stripe Connect Account successfully registered for creator payouts.',
      data: { stripe_connect_account_id: connectAccountId },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payouts/creator/balance
 * Authenticated Creator: retrieves current unpaid commission balance and threshold status.
 */
router.get('/creator/balance', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const minThresholdCents = 5000; // $50.00 default

    const user = db.prepare('SELECT id, display_name, email, stripe_connect_account_id FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    const unpaidApproved = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total, COUNT(id) as count
      FROM commission_ledger
      WHERE referrer_user_id = ? AND status = 'approved'
    `).get(userId) as any;

    const unpaidPending = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total, COUNT(id) as count
      FROM commission_ledger
      WHERE referrer_user_id = ? AND status = 'pending'
    `).get(userId) as any;

    const totalPaid = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total, COUNT(id) as count
      FROM commission_ledger
      WHERE referrer_user_id = ? AND status = 'paid'
    `).get(userId) as any;

    const approvedCents = Number(unpaidApproved?.total || 0);
    const pendingCents = Number(unpaidPending?.total || 0);
    const paidCents = Number(totalPaid?.total || 0);

    res.json({
      success: true,
      data: {
        user_id: userId,
        stripe_connect_account_id: user.stripe_connect_account_id || null,
        has_connect_account: Boolean(user.stripe_connect_account_id),
        approved_unpaid_cents: approvedCents,
        approved_unpaid_usd: Number((approvedCents / 100).toFixed(2)),
        pending_unpaid_cents: pendingCents,
        pending_unpaid_usd: Number((pendingCents / 100).toFixed(2)),
        total_paid_cents: paidCents,
        total_paid_usd: Number((paidCents / 100).toFixed(2)),
        min_payout_threshold_cents: minThresholdCents,
        min_payout_threshold_usd: Number((minThresholdCents / 100).toFixed(2)),
        eligible_for_next_payout: approvedCents >= minThresholdCents && Boolean(user.stripe_connect_account_id),
        amount_needed_for_threshold_cents: Math.max(0, minThresholdCents - approvedCents),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
