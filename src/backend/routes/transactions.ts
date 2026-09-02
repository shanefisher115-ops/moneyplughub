import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  getUserTransactions,
  insertXPTransaction,
  insertCommission,
} from '../transactions/engine';

export const transactionsRouter = Router();

/**
 * GET /api/transactions
 * Fetches authenticated user's transactions sorted by timestamp desc.
 */
transactionsRouter.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let list = getUserTransactions(userId);

    // Auto-seed initial sample data if new user has 0 records
    if (list.length === 0) {
      insertXPTransaction(userId, 'Cosmic Pill Dashboard Theme', 15.00, 350, {
        tier: 'Alchemist Tier 2',
        bonus_multiplier: 1.25,
      });
      insertCommission(userId, 25.00, 'Direct Tier-1 Referral Cashback Split', 'u_ref_apex_42', {
        rate_applied: 0.20,
      });
      list = getUserTransactions(userId);
    }

    res.json({
      success: true,
      data: { transactions: list },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/transactions/xp-purchase
 * Records a synthetic XP purchase event with metadata.
 */
transactionsRouter.post('/xp-purchase', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { itemId, amount, xpAwarded, customMetadata } = req.body;

    if (!itemId || typeof amount !== 'number') {
      res.status(400).json({ success: false, error: 'itemId and numeric amount are required' });
      return;
    }

    const tx = await insertXPTransaction(userId, itemId, amount, xpAwarded || 100, customMetadata || {});
    res.json({ success: true, data: { transaction: tx } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/transactions/commission
 * Records a referral or affiliate commission event with metadata.
 */
transactionsRouter.post('/commission', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, reason, referralUserId, customMetadata } = req.body;

    if (typeof amount !== 'number' || !reason) {
      res.status(400).json({ success: false, error: 'numeric amount and reason are required' });
      return;
    }

    const tx = await insertCommission(userId, amount, reason, referralUserId, customMetadata || {});
    res.json({ success: true, data: { transaction: tx } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
