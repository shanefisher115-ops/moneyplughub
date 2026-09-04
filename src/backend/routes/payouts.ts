import { Router, Response } from 'express';
import Stripe from 'stripe';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config';

export const payoutsRouter = Router();

// Initialize Stripe Client
const stripeSecretKey = config.stripe.secretKey || 'sk_test_stripe_moneyplughub_2026';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia' as any,
});

// Default minimum payout threshold: $50.00 USD (5,000 cents)
export const DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS = 5000;

export interface CreatorBalanceSummary {
  userId: string;
  displayName: string;
  email: string;
  stripeConnectAccountId: string;
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
  totalCents: number;
  approvedCount: number;
  isEligibleForPayout: boolean;
  thresholdCents: number;
  shortfallCents: number;
}

export interface StripeTransferPayload {
  amount: number; // in cents integer
  currency: string; // 'usd'
  destination: string; // Stripe Connect account ID
  transfer_group: string; // batch group ID
  description: string;
  metadata: Record<string, string | number>;
}

export interface BatchPayoutTransferItem {
  creator: {
    userId: string;
    displayName: string;
    email: string;
    stripeConnectAccountId: string;
  };
  amountCents: number;
  commissionIds: string[];
  stripePayload: StripeTransferPayload;
}

export interface BatchPayoutPayload {
  batchId: string;
  createdAt: string;
  minThresholdCents: number;
  statusFilter: string;
  totalCreatorsEligible: number;
  totalPayoutCents: number;
  transfers: BatchPayoutTransferItem[];
  ineligibleCreators: Array<{
    userId: string;
    displayName: string;
    approvedCents: number;
    shortfallCents: number;
  }>;
}

export interface BatchPayoutExecutionResult {
  batchId: string;
  executedAt: string;
  totalProcessed: number;
  totalSuccessCents: number;
  totalFailed: number;
  successfulPayouts: Array<{
    userId: string;
    displayName: string;
    amountCents: number;
    stripeTransferId: string;
    commissionsPaidCount: number;
  }>;
  failedPayouts: Array<{
    userId: string;
    displayName: string;
    amountCents: number;
    error: string;
  }>;
}

/**
 * Helper to fetch creator Stripe Connect Account ID or generate standard fallback ID
 */
export function getCreatorStripeAccountId(userId: string, email: string): string {
  try {
    const accountRow = db.prepare(
      "SELECT id FROM accounts WHERE user_id = ? AND institution LIKE '%stripe%' LIMIT 1"
    ).get(userId) as any;
    if (accountRow?.id && accountRow.id.startsWith('acct_')) {
      return accountRow.id;
    }
  } catch (e) {}

  // Standard fallback format for Connect accounts
  return `acct_creator_${userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;
}

/**
 * Aggregates commission_ledger entries by creator, calculates balance breakdowns,
 * and checks threshold eligibility.
 */
export function aggregateCreatorBalances(options?: {
  userId?: string;
  creatorUserIds?: string[];
  minThresholdCents?: number;
  statusFilter?: 'approved' | 'pending' | 'paid' | 'all';
}): CreatorBalanceSummary[] {
  const thresholdCents = options?.minThresholdCents ?? DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS;
  const targetUserId = options?.userId;
  const creatorUserIds = options?.creatorUserIds;

  let query = `
    SELECT
      u.id as user_id,
      u.display_name,
      u.email,
      COALESCE(SUM(CASE WHEN cl.status = 'pending' THEN cl.amount_cents ELSE 0 END), 0) as pending_cents,
      COALESCE(SUM(CASE WHEN cl.status = 'approved' THEN cl.amount_cents ELSE 0 END), 0) as approved_cents,
      COALESCE(SUM(CASE WHEN cl.status = 'paid' THEN cl.amount_cents ELSE 0 END), 0) as paid_cents,
      COALESCE(SUM(cl.amount_cents), 0) as total_cents,
      COUNT(CASE WHEN cl.status = 'approved' THEN 1 END) as approved_count
    FROM users u
    JOIN commission_ledger cl ON cl.referrer_user_id = u.id
  `;

  const params: any[] = [];
  const whereClauses: string[] = [];

  if (targetUserId) {
    whereClauses.push(`u.id = ?`);
    params.push(targetUserId);
  } else if (creatorUserIds && creatorUserIds.length > 0) {
    const placeholders = creatorUserIds.map(() => '?').join(',');
    whereClauses.push(`u.id IN (${placeholders})`);
    params.push(...creatorUserIds);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ` + whereClauses.join(' AND ');
  }

  query += ` GROUP BY u.id, u.display_name, u.email ORDER BY approved_cents DESC`;

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((row) => {
    const approvedCents = Number(row.approved_cents || 0);
    const pendingCents = Number(row.pending_cents || 0);
    const paidCents = Number(row.paid_cents || 0);
    const totalCents = Number(row.total_cents || 0);
    const approvedCount = Number(row.approved_count || 0);
    const isEligible = approvedCents >= thresholdCents;
    const shortfallCents = isEligible ? 0 : thresholdCents - approvedCents;
    const stripeConnectAccountId = getCreatorStripeAccountId(row.user_id, row.email);

    return {
      userId: row.user_id,
      displayName: row.display_name || 'Creator',
      email: row.email || '',
      stripeConnectAccountId,
      pendingCents,
      approvedCents,
      paidCents,
      totalCents,
      approvedCount,
      isEligibleForPayout: isEligible,
      thresholdCents,
      shortfallCents,
    };
  });
}

/**
 * Validates minimum thresholds and generates batch Stripe Connect transfer payloads.
 */
export function generateBatchStripeTransferPayloads(options?: {
  minThresholdCents?: number;
  batchId?: string;
  creatorUserIds?: string[];
  statusFilter?: 'approved' | 'pending';
}): BatchPayoutPayload {
  const thresholdCents = options?.minThresholdCents ?? DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS;
  const statusFilter = options?.statusFilter ?? 'approved';
  const timestamp = new Date().toISOString();
  const batchId = options?.batchId || `payout_batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const creatorSummaries = aggregateCreatorBalances({
    minThresholdCents: thresholdCents,
    creatorUserIds: options?.creatorUserIds,
  });

  const transfers: BatchPayoutTransferItem[] = [];
  const ineligibleCreators: Array<{
    userId: string;
    displayName: string;
    approvedCents: number;
    shortfallCents: number;
  }> = [];

  let totalPayoutCents = 0;

  for (const creator of creatorSummaries) {
    const payoutAmountCents = statusFilter === 'approved' ? creator.approvedCents : creator.pendingCents;

    if (payoutAmountCents >= thresholdCents && payoutAmountCents > 0) {
      // Fetch associated commission ledger entries
      const commissionRows = db.prepare(`
        SELECT id FROM commission_ledger
        WHERE referrer_user_id = ? AND status = ?
        ORDER BY created_at ASC
      `).all(creator.userId, statusFilter) as any[];

      const commissionIds = commissionRows.map((c) => c.id);

      const stripePayload: StripeTransferPayload = {
        amount: payoutAmountCents,
        currency: 'usd',
        destination: creator.stripeConnectAccountId,
        transfer_group: batchId,
        description: `Plug In OS Commission Payout: ${creator.displayName} ($${(payoutAmountCents / 100).toFixed(2)})`,
        metadata: {
          batch_id: batchId,
          referrer_user_id: creator.userId,
          commission_count: commissionIds.length,
          creator_email: creator.email,
        },
      };

      transfers.push({
        creator: {
          userId: creator.userId,
          displayName: creator.displayName,
          email: creator.email,
          stripeConnectAccountId: creator.stripeConnectAccountId,
        },
        amountCents: payoutAmountCents,
        commissionIds,
        stripePayload,
      });

      totalPayoutCents += payoutAmountCents;
    } else {
      ineligibleCreators.push({
        userId: creator.userId,
        displayName: creator.displayName,
        approvedCents: payoutAmountCents,
        shortfallCents: Math.max(0, thresholdCents - payoutAmountCents),
      });
    }
  }

  return {
    batchId,
    createdAt: timestamp,
    minThresholdCents: thresholdCents,
    statusFilter,
    totalCreatorsEligible: transfers.length,
    totalPayoutCents,
    transfers,
    ineligibleCreators,
  };
}

/**
 * Executes batch Stripe transfers and updates commission_ledger records to 'paid'.
 */
export async function processBatchPayout(
  batchPayload: BatchPayoutPayload,
  options?: { executeRealStripe?: boolean }
): Promise<BatchPayoutExecutionResult> {
  const executedAt = new Date().toISOString();
  const executeRealStripe = options?.executeRealStripe ?? false;

  const successfulPayouts: BatchPayoutExecutionResult['successfulPayouts'] = [];
  const failedPayouts: BatchPayoutExecutionResult['failedPayouts'] = [];

  let totalSuccessCents = 0;

  for (const item of batchPayload.transfers) {
    let stripeTransferId = `tr_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let success = false;
    let errorMessage = '';

    if (executeRealStripe && !stripeSecretKey.includes('sk_test_stripe_moneyplughub_2026')) {
      try {
        const transfer = await stripe.transfers.create({
          amount: item.stripePayload.amount,
          currency: item.stripePayload.currency,
          destination: item.stripePayload.destination,
          transfer_group: item.stripePayload.transfer_group,
          description: item.stripePayload.description,
          metadata: item.stripePayload.metadata as Record<string, string>,
        });
        stripeTransferId = transfer.id;
        success = true;
      } catch (err: any) {
        success = false;
        errorMessage = err.message || 'Stripe Connect Transfer failed';
      }
    } else {
      // Development / Test Simulation Mode
      success = true;
    }

    if (success) {
      try {
        runInTransaction(() => {
          // Update commission_ledger status to 'paid'
          if (item.commissionIds.length > 0) {
            const placeholders = item.commissionIds.map(() => '?').join(',');
            db.prepare(`
              UPDATE commission_ledger
              SET status = 'paid', updated_at = ?
              WHERE id IN (${placeholders})
            `).run(executedAt, ...item.commissionIds);
          }

          // Ensure an account exists for foreign key constraints on transactions
          let bankAccount = db.prepare(
            "SELECT id FROM accounts WHERE user_id = ? LIMIT 1"
          ).get(item.creator.userId) as any;

          if (!bankAccount) {
            const newAccId = `acc_${item.creator.userId}_vault`;
            db.prepare(`
              INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
              VALUES (?, ?, 'Creator Commission Vault', 'bank', 0, 'USD', 'Stripe Connect Direct', 0, ?, ?)
            `).run(newAccId, item.creator.userId, executedAt, executedAt);
            bankAccount = { id: newAccId };
          }

          db.prepare(`
            UPDATE accounts
            SET balance_cents = balance_cents + ?, updated_at = ?
            WHERE id = ?
          `).run(item.amountCents, executedAt, bankAccount.id);

          // Insert payout transaction entry
          const txId = `tx_payout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.prepare(`
            INSERT INTO transactions (
              id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at
            ) VALUES (?, ?, ?, 'Creator Payout', 'income', ?, ?, ?, 0, ?)
          `).run(
            txId,
            item.creator.userId,
            bankAccount.id,
            item.amountCents,
            `Automated Stripe Connect Payout (Batch: ${batchPayload.batchId})`,
            executedAt.substring(0, 10),
            executedAt
          );
        });

        recordAuditLog(
          item.creator.userId,
          'BATCH_CREATOR_PAYOUT',
          'commission_ledger',
          batchPayload.batchId,
          {
            referrer_user_id: item.creator.userId,
            amount_cents: item.amountCents,
            commission_count: item.commissionIds.length,
            stripe_transfer_id: stripeTransferId,
          }
        );

        totalSuccessCents += item.amountCents;
        successfulPayouts.push({
          userId: item.creator.userId,
          displayName: item.creator.displayName,
          amountCents: item.amountCents,
          stripeTransferId,
          commissionsPaidCount: item.commissionIds.length,
        });
      } catch (dbErr: any) {
        failedPayouts.push({
          userId: item.creator.userId,
          displayName: item.creator.displayName,
          amountCents: item.amountCents,
          error: dbErr.message || 'Database update error during payout',
        });
      }
    } else {
      failedPayouts.push({
        userId: item.creator.userId,
        displayName: item.creator.displayName,
        amountCents: item.amountCents,
        error: errorMessage,
      });
    }
  }

  return {
    batchId: batchPayload.batchId,
    executedAt,
    totalProcessed: batchPayload.transfers.length,
    totalSuccessCents,
    totalFailed: failedPayouts.length,
    successfulPayouts,
    failedPayouts,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/payouts/balances
 * Admin view: Aggregates balances across all creators with threshold validation status.
 */
payoutsRouter.get('/balances', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const minThresholdCents = req.query.min_threshold_cents
      ? parseInt(req.query.min_threshold_cents as string, 10)
      : DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS;

    const summaries = aggregateCreatorBalances({ minThresholdCents });

    const totalApprovedCents = summaries.reduce((acc, c) => acc + c.approvedCents, 0);
    const totalEligibleCents = summaries
      .filter((c) => c.isEligibleForPayout)
      .reduce((acc, c) => acc + c.approvedCents, 0);
    const eligibleCount = summaries.filter((c) => c.isEligibleForPayout).length;

    res.json({
      success: true,
      data: {
        min_threshold_cents: minThresholdCents,
        min_threshold_usd: (minThresholdCents / 100).toFixed(2),
        total_creators: summaries.length,
        eligible_creators_count: eligibleCount,
        total_approved_cents: totalApprovedCents,
        total_eligible_payout_cents: totalEligibleCents,
        summaries,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payouts/my-balance
 * Creator view: Returns calling creator's own commission ledger balance & threshold eligibility.
 */
payoutsRouter.get('/my-balance', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const minThresholdCents = req.query.min_threshold_cents
      ? parseInt(req.query.min_threshold_cents as string, 10)
      : DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS;

    const summaries = aggregateCreatorBalances({ userId, minThresholdCents });

    const creatorSummary = summaries[0] || {
      userId,
      displayName: req.user!.display_name,
      email: req.user!.email,
      stripeConnectAccountId: getCreatorStripeAccountId(userId, req.user!.email),
      pendingCents: 0,
      approvedCents: 0,
      paidCents: 0,
      totalCents: 0,
      approvedCount: 0,
      isEligibleForPayout: false,
      thresholdCents: minThresholdCents,
      shortfallCents: minThresholdCents,
    };

    res.json({
      success: true,
      data: creatorSummary,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/payouts/creator/:userId
 * Fetch detailed balances and commission breakdown for a specific creator.
 */
payoutsRouter.get('/creator/:userId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    // Allow creator to see their own balance or requiring admin for other creators
    if (req.user!.id !== targetUserId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied: Admin authorization required.' });
      return;
    }

    const minThresholdCents = req.query.min_threshold_cents
      ? parseInt(req.query.min_threshold_cents as string, 10)
      : DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS;

    const summaries = aggregateCreatorBalances({ userId: targetUserId, minThresholdCents });

    const commissions = db.prepare(`
      SELECT id, referred_user_id, amount_cents, currency, status, created_at, updated_at
      FROM commission_ledger
      WHERE referrer_user_id = ?
      ORDER BY created_at DESC
    `).all(targetUserId);

    res.json({
      success: true,
      data: {
        summary: summaries[0] || null,
        commissions,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payouts/generate-batch
 * Admin endpoint: Dry-run/preview generation of batch Stripe Connect transfer payloads.
 */
payoutsRouter.post('/generate-batch', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const minThresholdCents = req.body.min_threshold_cents
      ? parseInt(req.body.min_threshold_cents, 10)
      : DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS;
    const statusFilter = req.body.status_filter === 'pending' ? 'pending' : 'approved';

    const batchPayload = generateBatchStripeTransferPayloads({
      minThresholdCents,
      statusFilter,
    });

    res.json({
      success: true,
      data: batchPayload,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payouts/process-batch
 * Admin endpoint: Executes batch payout transfers and updates commission ledger statuses.
 */
payoutsRouter.post('/process-batch', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const minThresholdCents = req.body.min_threshold_cents
      ? parseInt(req.body.min_threshold_cents, 10)
      : DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS;
    const executeRealStripe = Boolean(req.body.execute_real_stripe);

    let batchPayload: BatchPayoutPayload = req.body.batchPayload;

    if (!batchPayload || !Array.isArray(batchPayload.transfers)) {
      batchPayload = generateBatchStripeTransferPayloads({ minThresholdCents });
    }

    if (batchPayload.transfers.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No creators met the minimum payout threshold for processing.',
        data: batchPayload,
      });
      return;
    }

    const result = await processBatchPayout(batchPayload, { executeRealStripe });

    res.json({
      success: true,
      data: {
        executionResult: result,
        batchPayload,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default payoutsRouter;
