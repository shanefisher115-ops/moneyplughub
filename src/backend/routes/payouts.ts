import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config';

const router = Router();

// Initialize Stripe instance
const stripeSecretKey = config.stripe.secretKey || process.env.STRIPE_SECRET_KEY || 'sk_test_mock_moneyplughub';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-01-27.acacia' as any,
});

// ── Schema Migration for Creator Payout Processor ─────────────────
try {
  // Ensure users table has stripe_account_id
  try {
    db.exec(`ALTER TABLE users ADD COLUMN stripe_account_id TEXT;`);
  } catch (e) {
    // Column already exists
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      total_amount_cents INTEGER NOT NULL DEFAULT 0,
      transfer_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'partial_failure')),
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payout_transfers (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      stripe_account_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      stripe_transfer_id TEXT,
      status TEXT NOT NULL DEFAULT 'succeeded' CHECK(status IN ('pending', 'succeeded', 'failed')),
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES payout_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payout_transfers_batch ON payout_transfers(batch_id);
    CREATE INDEX IF NOT EXISTS idx_payout_transfers_user ON payout_transfers(user_id);
  `);
} catch (e) {
  console.error('[Payouts Schema Init Error]:', e);
}

export interface CreatorPayoutSummary {
  userId: string;
  displayName: string;
  email: string;
  stripeAccountId: string | null;
  approvedCents: number;
  commissionIds: string[];
  commissionCount: number;
  eligible: boolean;
  ineligibleReason: 'below_threshold' | 'missing_stripe_account' | null;
}

export interface StripeTransferPayload {
  amount: number;
  currency: string;
  destination: string;
  transfer_group: string;
  metadata: {
    user_id: string;
    commission_ids: string;
    batch_id: string;
  };
}

/**
 * Helper function to aggregate approved commissions and check eligibility.
 */
export function aggregateCreatorBalances(minThresholdCents: number = 5000): CreatorPayoutSummary[] {
  // Query all approved commission ledger entries
  const rows = db.prepare(`
    SELECT
      cl.id as commission_id,
      cl.referrer_user_id as user_id,
      cl.amount_cents,
      u.display_name,
      u.email,
      u.stripe_account_id
    FROM commission_ledger cl
    JOIN users u ON u.id = cl.referrer_user_id
    WHERE cl.status = 'approved'
  `).all() as any[];

  const userMap = new Map<string, {
    userId: string;
    displayName: string;
    email: string;
    stripeAccountId: string | null;
    approvedCents: number;
    commissionIds: string[];
  }>();

  for (const row of rows) {
    const existing = userMap.get(row.user_id) || {
      userId: row.user_id,
      displayName: row.display_name || 'Creator',
      email: row.email || '',
      stripeAccountId: row.stripe_account_id || null,
      approvedCents: 0,
      commissionIds: [],
    };

    existing.approvedCents += row.amount_cents;
    existing.commissionIds.push(row.commission_id);
    userMap.set(row.user_id, existing);
  }

  const summaries: CreatorPayoutSummary[] = [];

  for (const creator of userMap.values()) {
    let eligible = true;
    let ineligibleReason: 'below_threshold' | 'missing_stripe_account' | null = null;

    if (!creator.stripeAccountId) {
      eligible = false;
      ineligibleReason = 'missing_stripe_account';
    } else if (creator.approvedCents < minThresholdCents) {
      eligible = false;
      ineligibleReason = 'below_threshold';
    }

    summaries.push({
      ...creator,
      commissionCount: creator.commissionIds.length,
      eligible,
      ineligibleReason,
    });
  }

  return summaries;
}

// ═══════════════════════════════════════════════════════════════════
//  1. GET /api/payouts/summary
//     Aggregates commission_ledger balances, validates minimum payout thresholds,
//     and lists creator eligibility status.
// ═══════════════════════════════════════════════════════════════════
router.get('/summary', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const minThresholdCents = parseInt(req.query.min_threshold_cents as string, 10) || 5000; // Default $50.00
    const summaries = aggregateCreatorBalances(minThresholdCents);

    const totalApprovedCents = summaries.reduce((acc, curr) => acc + curr.approvedCents, 0);
    const eligibleCreators = summaries.filter(s => s.eligible);
    const eligiblePayoutCents = eligibleCreators.reduce((acc, curr) => acc + curr.approvedCents, 0);

    res.json({
      success: true,
      data: {
        min_threshold_cents: minThresholdCents,
        min_threshold_usd: (minThresholdCents / 100).toFixed(2),
        total_approved_cents: totalApprovedCents,
        total_approved_usd: (totalApprovedCents / 100).toFixed(2),
        eligible_creators_count: eligibleCreators.length,
        eligible_payout_cents: eligiblePayoutCents,
        eligible_payout_usd: (eligiblePayoutCents / 100).toFixed(2),
        ineligible_creators_count: summaries.length - eligibleCreators.length,
        creators: summaries,
      },
    });
  } catch (err: any) {
    console.error('[Payout Summary Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  2. POST /api/payouts/stripe-connect
//     Links or updates a creator's Stripe Connect Account ID.
// ═══════════════════════════════════════════════════════════════════
router.post('/stripe-connect', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { stripe_account_id, user_id } = req.body;
    const targetUserId = (req.user!.role === 'admin' && user_id) ? user_id : req.user!.id;

    if (!stripe_account_id || typeof stripe_account_id !== 'string' || !stripe_account_id.startsWith('acct_')) {
      res.status(400).json({
        success: false,
        error: 'Invalid Stripe Connect Account ID. Must start with "acct_".',
      });
      return;
    }

    db.prepare('UPDATE users SET stripe_account_id = ?, updated_at = ? WHERE id = ?')
      .run(stripe_account_id, new Date().toISOString(), targetUserId);

    recordAuditLog(req.user!.id, 'STRIPE_CONNECT_LINKED', 'users', targetUserId, {
      stripe_account_id,
    });

    res.json({
      success: true,
      message: 'Stripe Connect account linked successfully.',
      data: {
        user_id: targetUserId,
        stripe_account_id,
      },
    });
  } catch (err: any) {
    console.error('[Stripe Connect Link Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  3. POST /api/payouts/process
//     Aggregates eligible commission_ledger balances, validates threshold,
//     generates batch Stripe Connect transfer payloads, and executes transfers.
// ═══════════════════════════════════════════════════════════════════
router.post('/process', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const minThresholdCents = parseInt(req.body.min_threshold_cents, 10) || 5000;
    const targetUserIds: string[] | undefined = req.body.user_ids;
    const dryRun = Boolean(req.body.dry_run);

    let summaries = aggregateCreatorBalances(minThresholdCents);

    // Filter by targetUserIds if specified
    if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      summaries = summaries.filter(s => targetUserIds.includes(s.userId));
    }

    const eligibleSummaries = summaries.filter(s => s.eligible);

    if (eligibleSummaries.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No eligible creators found matching minimum threshold and Stripe Connect requirements.',
        data: {
          min_threshold_cents: minThresholdCents,
          total_evaluated: summaries.length,
          eligible_count: 0,
        },
      });
      return;
    }

    const batchId = `batch_payout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    // Generate batch Stripe Connect transfer payloads
    const transferPayloads: {
      summary: CreatorPayoutSummary;
      payload: StripeTransferPayload;
    }[] = eligibleSummaries.map(s => ({
      summary: s,
      payload: {
        amount: s.approvedCents,
        currency: 'usd',
        destination: s.stripeAccountId!,
        transfer_group: batchId,
        metadata: {
          user_id: s.userId,
          commission_ids: s.commissionIds.join(','),
          batch_id: batchId,
        },
      },
    }));

    if (dryRun) {
      res.json({
        success: true,
        dry_run: true,
        batch_id: batchId,
        min_threshold_cents: minThresholdCents,
        eligible_creators_count: eligibleSummaries.length,
        total_payout_cents: eligibleSummaries.reduce((acc, curr) => acc + curr.approvedCents, 0),
        transfer_payloads: transferPayloads.map(p => p.payload),
      });
      return;
    }

    // Record Batch
    const totalBatchCents = eligibleSummaries.reduce((acc, curr) => acc + curr.approvedCents, 0);

    db.prepare(`
      INSERT INTO payout_batches (id, total_amount_cents, transfer_count, status, created_at)
      VALUES (?, ?, ?, 'processing', ?)
    `).run(batchId, totalBatchCents, eligibleSummaries.length, now);

    const executedTransfers: any[] = [];
    let succeededCount = 0;
    let failedCount = 0;

    for (const item of transferPayloads) {
      const { summary, payload } = item;
      const transferId = `ptran_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      let stripeTransferId: string | null = null;
      let status: 'succeeded' | 'failed' = 'succeeded';
      let errorMessage: string | null = null;

      try {
        // Execute Stripe Transfer if live API key is present, or simulate if test/mock mode
        if (stripeSecretKey && !stripeSecretKey.includes('mock') && !stripeSecretKey.includes('test_stripe_moneyplughub')) {
          const transfer = await stripe.transfers.create({
            amount: payload.amount,
            currency: payload.currency,
            destination: payload.destination,
            transfer_group: payload.transfer_group,
            metadata: payload.metadata,
          });
          stripeTransferId = transfer.id;
        } else {
          // Simulated Stripe Transfer for sandbox testing
          stripeTransferId = `tr_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }

        // Apply ledger transitions in ACID transaction
        runInTransaction(() => {
          // 1. Update commission_ledger status to 'paid'
          const placeholders = summary.commissionIds.map(() => '?').join(',');
          db.prepare(`
            UPDATE commission_ledger
            SET status = 'paid', updated_at = ?
            WHERE id IN (${placeholders})
          `).run(now, ...summary.commissionIds);

          // 2. Ensure bank account exists or update balance
          let account = db.prepare(`SELECT id FROM accounts WHERE user_id = ? AND type = 'bank' LIMIT 1`).get(summary.userId) as any;
          if (!account) {
            const accId = `acc_${summary.userId}_bank`;
            db.prepare(`
              INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
              VALUES (?, ?, 'Stripe Connect Payout Account', 'bank', ?, 'USD', 'Stripe Connect', 0, ?, ?)
            `).run(accId, summary.userId, summary.approvedCents, now, now);
            account = { id: accId };
          } else {
            db.prepare(`
              UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ?
              WHERE id = ?
            `).run(summary.approvedCents, now, account.id);
          }

          // 3. Record financial transaction log
          const txId = `tx_payout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.prepare(`
            INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at)
            VALUES (?, ?, ?, 'Referral Payout', 'income', ?, ?, ?, 0, ?)
          `).run(
            txId,
            summary.userId,
            account.id,
            summary.approvedCents,
            `Automated Stripe Connect Payout Batch ${batchId}`,
            now.substring(0, 10),
            now
          );

          // 4. Record transfer log
          db.prepare(`
            INSERT INTO payout_transfers (id, batch_id, user_id, stripe_account_id, amount_cents, currency, stripe_transfer_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'USD', ?, 'succeeded', ?)
          `).run(transferId, batchId, summary.userId, summary.stripeAccountId!, summary.approvedCents, stripeTransferId, now);
        });

        succeededCount++;
        executedTransfers.push({
          transfer_id: transferId,
          user_id: summary.userId,
          display_name: summary.displayName,
          amount_cents: summary.approvedCents,
          amount_usd: (summary.approvedCents / 100).toFixed(2),
          stripe_account_id: summary.stripeAccountId,
          stripe_transfer_id: stripeTransferId,
          status: 'succeeded',
        });
      } catch (transferErr: any) {
        failedCount++;
        status = 'failed';
        errorMessage = transferErr.message || 'Stripe Connect Transfer failed';

        db.prepare(`
          INSERT INTO payout_transfers (id, batch_id, user_id, stripe_account_id, amount_cents, currency, stripe_transfer_id, status, error_message, created_at)
          VALUES (?, ?, ?, ?, ?, 'USD', NULL, 'failed', ?, ?)
        `).run(transferId, batchId, summary.userId, summary.stripeAccountId!, summary.approvedCents, errorMessage, now);

        executedTransfers.push({
          transfer_id: transferId,
          user_id: summary.userId,
          display_name: summary.displayName,
          amount_cents: summary.approvedCents,
          stripe_account_id: summary.stripeAccountId,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    const finalBatchStatus = failedCount === 0 ? 'completed' : succeededCount === 0 ? 'failed' : 'partial_failure';
    db.prepare(`
      UPDATE payout_batches
      SET status = ?, completed_at = ?
      WHERE id = ?
    `).run(finalBatchStatus, new Date().toISOString(), batchId);

    recordAuditLog(req.user!.id, 'PAYOUT_BATCH_PROCESSED', 'payout_batches', batchId, {
      total_amount_cents: totalBatchCents,
      succeeded_count: succeededCount,
      failed_count: failedCount,
      status: finalBatchStatus,
    });

    res.json({
      success: true,
      message: `Payout batch processed. ${succeededCount} succeeded, ${failedCount} failed.`,
      data: {
        batch_id: batchId,
        status: finalBatchStatus,
        total_amount_cents: totalBatchCents,
        total_amount_usd: (totalBatchCents / 100).toFixed(2),
        transfers_count: executedTransfers.length,
        succeeded_count: succeededCount,
        failed_count: failedCount,
        transfers: executedTransfers,
      },
    });
  } catch (err: any) {
    console.error('[Payout Process Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  4. GET /api/payouts/history
//     Returns historical payout batches and associated transfers.
// ═══════════════════════════════════════════════════════════════════
router.get('/history', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const isUserAdmin = req.user!.role === 'admin';
    const userId = req.user!.id;

    if (isUserAdmin) {
      const batches = db.prepare(`
        SELECT * FROM payout_batches ORDER BY created_at DESC LIMIT 50
      `).all() as any[];

      const transfers = db.prepare(`
        SELECT pt.*, u.display_name, u.email
        FROM payout_transfers pt
        JOIN users u ON u.id = pt.user_id
        ORDER BY pt.created_at DESC LIMIT 200
      `).all() as any[];

      res.json({
        success: true,
        data: {
          batches,
          transfers,
        },
      });
    } else {
      const transfers = db.prepare(`
        SELECT pt.*
        FROM payout_transfers pt
        WHERE pt.user_id = ?
        ORDER BY pt.created_at DESC LIMIT 100
      `).all(userId) as any[];

      res.json({
        success: true,
        data: {
          transfers,
        },
      });
    }
  } catch (err: any) {
    console.error('[Payout History Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
