import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  BILLING ENGINE — Creator Money OS
//  Self-hosted subscription management, invoicing, promo codes,
//  trial logic, and upgrade/downgrade flows.
//  Stripe is ONLY used as a dumb card charger via webhook.
// ═══════════════════════════════════════════════════════════════════

// ── Schema ───────────────────────────────────────────────────────
try {
  try {
    db.exec("ALTER TABLE subscriptions ADD COLUMN grace_period_ends_at TEXT");
  } catch (e) {
    // Column may already exist
  }

  db.exec(`
    -- Subscription plans (your 4 pricing tiers)
    CREATE TABLE IF NOT EXISTS billing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      price_cents_monthly INTEGER NOT NULL DEFAULT 0,
      price_cents_annual INTEGER NOT NULL DEFAULT 0,
      trial_days INTEGER NOT NULL DEFAULT 0,
      features_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- User subscriptions
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trialing','active','past_due','canceled','expired','unpaid')),
      billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual')),
      current_period_start TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      trial_end TEXT,
      canceled_at TEXT,
      cancel_reason TEXT,
      promo_code_id TEXT,
      stripe_subscription_id TEXT,
      grace_period_ends_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES billing_plans(id),
      FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);

    -- Invoices
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT,
      amount_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','paid','void','refunded')),
      description TEXT,
      billing_period_start TEXT,
      billing_period_end TEXT,
      paid_at TEXT,
      payment_method TEXT,
      stripe_payment_intent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(user_id);

    -- Promo / discount codes
    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL COLLATE NOCASE,
      discount_type TEXT NOT NULL DEFAULT 'percent' CHECK(discount_type IN ('percent','fixed')),
      discount_value REAL NOT NULL DEFAULT 0,
      max_uses INTEGER,
      current_uses INTEGER NOT NULL DEFAULT 0,
      valid_from TEXT,
      valid_until TEXT,
      applicable_plans TEXT DEFAULT 'all',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);

    -- Promo code redemptions
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id TEXT PRIMARY KEY,
      promo_code_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      subscription_id TEXT,
      discount_cents INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL,
      FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(promo_code_id, user_id)
    );

    -- Payment methods (for display, actual charging via Stripe)
    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'card' CHECK(type IN ('card','crypto','bank')),
      label TEXT NOT NULL,
      last_four TEXT,
      brand TEXT,
      exp_month INTEGER,
      exp_year INTEGER,
      is_default INTEGER NOT NULL DEFAULT 0,
      stripe_payment_method_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Dunning Records (failed payment recovery management)
    CREATE TABLE IF NOT EXISTS dunning_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','recovered','failed_exhausted','canceled')),
      grace_period_ends_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 4,
      next_retry_at TEXT,
      last_retry_at TEXT,
      last_failure_reason TEXT,
      retention_offer_code TEXT,
      retention_offer_applied INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dunning_sub ON dunning_records(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_dunning_status ON dunning_records(status);

    -- Dunning Retry History
    CREATE TABLE IF NOT EXISTS dunning_retries (
      id TEXT PRIMARY KEY,
      dunning_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL,
      executed_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed')),
      failure_code TEXT,
      failure_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (dunning_id) REFERENCES dunning_records(id) ON DELETE CASCADE
    );

    -- Dunning Notifications (Email & SMS logging)
    CREATE TABLE IF NOT EXISTS dunning_communications (
      id TEXT PRIMARY KEY,
      dunning_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('email','sms','in_app')),
      template_type TEXT NOT NULL CHECK(template_type IN ('payment_failed','retry_reminder','grace_warning','discount_offer','account_suspended')),
      recipient TEXT NOT NULL,
      subject TEXT,
      message_body TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','failed')),
      FOREIGN KEY (dunning_id) REFERENCES dunning_records(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Seed the 4 pricing tiers
    INSERT OR IGNORE INTO billing_plans (id, name, slug, price_cents_monthly, price_cents_annual, trial_days, features_json, sort_order, created_at)
    VALUES
      ('plan_free', 'Free Lite', 'free', 0, 0, 0,
       '["5 referral links","Basic earnings dashboard","MoneyOS AI chat (text only)","Commission tracking","Community access"]',
       1, datetime('now')),
      ('plan_creator', 'Creator', 'creator', 2900, 29000, 7,
       '["Unlimited referral links","MoneyOS AI Voice (ElevenLabs)","Voice navigation commands","Budget & debt tools","Synthetic yield simulator","Cashback pack access","Priority support"]',
       2, datetime('now')),
      ('plan_pro', 'Pro', 'pro', 14900, 149000, 14,
       '["Full AI Swarm Orchestrator (12 modules)","Advanced net worth analytics","Crypto portfolio tracking","Custom Living Vault themes","Multi-platform referral hub","API access","Dedicated account manager"]',
       3, datetime('now')),
      ('plan_enterprise', 'Enterprise', 'enterprise', 49900, 499000, 14,
       '["White-label deployment","Custom AI agent training","Dedicated infrastructure","SLA guarantees","Bulk referral management","Custom integrations","Priority engineering support"]',
       4, datetime('now'));
  `);
} catch (e) {
  // Tables may already exist
}


// ═══════════════════════════════════════════════════════════════════
//  DUNNING CORE LOGIC & RECOVERY ENGINE
// ═══════════════════════════════════════════════════════════════════

export interface DunningServiceConfig {
  gracePeriodDays: number; // default 14 days
  maxAttempts: number;    // default 4
  retryIntervalsDays: number[]; // e.g., [1, 3, 5, 7]
}

export const DUNNING_CONFIG: DunningServiceConfig = {
  gracePeriodDays: 14,
  maxAttempts: 4,
  retryIntervalsDays: [1, 3, 5, 7],
};

/**
 * Calculates the next retry timestamp based on attempt number.
 */
export function calculateNextRetryDate(attemptNumber: number, baseDate: Date = new Date()): string {
  const index = Math.min(attemptNumber - 1, DUNNING_CONFIG.retryIntervalsDays.length - 1);
  const addDays = DUNNING_CONFIG.retryIntervalsDays[Math.max(0, index)] || 3;
  const nextDate = new Date(baseDate.getTime() + addDays * 24 * 60 * 60 * 1000);
  return nextDate.toISOString();
}

/**
 * Generates or retrieves a targeted retention offer code for a subscriber facing churn.
 */
export function generateRetentionOffer(userId: string, subscriptionId: string): { code: string; discountPercent: number; description: string } {
  const code = `SAVE30-${subscriptionId.substring(0, 8).toUpperCase()}`;
  const existing = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(code) as any;
  if (!existing) {
    const id = `promo_ret_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    try {
      db.prepare(`
        INSERT INTO promo_codes (id, code, discount_type, discount_value, max_uses, is_active, valid_until, created_at)
        VALUES (?, ?, 'percent', 30, 1, 1, ?, datetime('now'))
      `).run(id, code, validUntil);
    } catch (e) {}
  }
  return {
    code,
    discountPercent: 30,
    description: 'Special 30% retention offer applied to keep your Creator Money OS features active.',
  };
}

/**
 * Initiates or retrieves an active dunning workflow when an invoice payment fails.
 */
export function initiateDunningForFailedInvoice(
  userId: string,
  subscriptionId: string,
  invoiceId: string,
  failureReason: string = 'card_declined'
) {
  const now = new Date();
  const nowIso = now.toISOString();

  // Check if active dunning already exists
  const existingDunning = db.prepare(`
    SELECT * FROM dunning_records
    WHERE subscription_id = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).get(subscriptionId) as any;

  if (existingDunning) {
    return existingDunning;
  }

  const dunningId = `dun_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const gracePeriodEnd = new Date(now.getTime() + DUNNING_CONFIG.gracePeriodDays * 24 * 60 * 60 * 1000).toISOString();
  const nextRetryAt = calculateNextRetryDate(1, now);
  const offer = generateRetentionOffer(userId, subscriptionId);

  runInTransaction(() => {
    // Update subscription status to past_due and set grace period end
    db.prepare(`
      UPDATE subscriptions
      SET status = 'past_due', grace_period_ends_at = ?, updated_at = ?
      WHERE id = ?
    `).run(gracePeriodEnd, nowIso, subscriptionId);

    // Update invoice status to open
    db.prepare(`
      UPDATE invoices
      SET status = 'open', updated_at = ?
      WHERE id = ?
    `).run(nowIso, invoiceId);

    // Create dunning record
    db.prepare(`
      INSERT INTO dunning_records (
        id, user_id, subscription_id, invoice_id, status, grace_period_ends_at,
        attempt_count, max_attempts, next_retry_at, last_failure_reason,
        retention_offer_code, retention_offer_applied, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, 0, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      dunningId,
      userId,
      subscriptionId,
      invoiceId,
      gracePeriodEnd,
      DUNNING_CONFIG.maxAttempts,
      nextRetryAt,
      failureReason,
      offer.code,
      nowIso,
      nowIso
    );

    // Schedule 1st retry entry in retries log
    const retryId = `retry_${Date.now()}_1`;
    db.prepare(`
      INSERT INTO dunning_retries (id, dunning_id, attempt_number, scheduled_at, status, created_at)
      VALUES (?, ?, 1, ?, 'pending', ?)
    `).run(retryId, dunningId, nextRetryAt, nowIso);

    // Send initial failed payment notification (email & SMS log)
    const user = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(userId) as any;
    const recipientEmail = user?.email || 'creator@moneyplughub.com';

    db.prepare(`
      INSERT INTO dunning_communications (id, dunning_id, user_id, channel, template_type, recipient, subject, message_body, sent_at, status)
      VALUES (?, ?, ?, 'email', 'payment_failed', ?, ?, ?, ?, 'sent')
    `).run(
      `comm_${Date.now()}_email`,
      dunningId,
      userId,
      recipientEmail,
      'Action Required: Your Payment for Creator Money OS Failed',
      `Hi ${user?.display_name || 'Creator'}, your recent invoice payment failed due to (${failureReason}). Your account is currently in a 14-day grace period. Use code ${offer.code} to save 30% and update your card.`,
      nowIso
    );

    db.prepare(`
      INSERT INTO dunning_communications (id, dunning_id, user_id, channel, template_type, recipient, subject, message_body, sent_at, status)
      VALUES (?, ?, ?, 'sms', 'payment_failed', ?, NULL, ?, ?, 'sent')
    `).run(
      `comm_${Date.now()}_sms`,
      dunningId,
      userId,
      recipientEmail,
      `MoneyOS Alert: Credit card payment failed. Grace period active. Update card or use ${offer.code} for 30% off: https://moneyplughub.com/billing`,
      nowIso
    );
  });

  return db.prepare('SELECT * FROM dunning_records WHERE id = ?').get(dunningId);
}

/**
 * Resolves an active dunning record when payment succeeds.
 */
export function resolveDunningOnPaymentSuccess(subscriptionId: string, invoiceId?: string) {
  const nowIso = new Date().toISOString();

  const dunning = db.prepare(`
    SELECT * FROM dunning_records
    WHERE subscription_id = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).get(subscriptionId) as any;

  if (!dunning) return false;

  runInTransaction(() => {
    // Mark dunning record recovered
    db.prepare(`
      UPDATE dunning_records
      SET status = 'recovered', updated_at = ?
      WHERE id = ?
    `).run(nowIso, dunning.id);

    // Restore subscription status to active and clear grace period
    db.prepare(`
      UPDATE subscriptions
      SET status = 'active', grace_period_ends_at = NULL, updated_at = ?
      WHERE id = ?
    `).run(nowIso, subscriptionId);

    // Mark invoice paid if provided
    if (invoiceId) {
      db.prepare(`
        UPDATE invoices
        SET status = 'paid', paid_at = ?, updated_at = ?
        WHERE id = ?
      `).run(nowIso, nowIso, invoiceId);
    }

    // Log recovery notification
    db.prepare(`
      INSERT INTO dunning_communications (id, dunning_id, user_id, channel, template_type, recipient, subject, message_body, sent_at, status)
      VALUES (?, ?, ?, 'in_app', 'retry_reminder', 'user', 'Payment Recovered Successfully', 'Your subscription payment was processed and your Creator Money OS services are active!', ?, 'sent')
    `).run(`comm_${Date.now()}_recovered`, dunning.id, dunning.user_id, nowIso);
  });

  return true;
}

/**
 * Executes a retry attempt for an active dunning workflow.
 */
export function executeDunningRetry(dunningId: string, forceOutcome?: 'success' | 'failed') {
  const nowIso = new Date().toISOString();
  const dunning = db.prepare('SELECT * FROM dunning_records WHERE id = ?').get(dunningId) as any;

  if (!dunning || dunning.status !== 'active') {
    return { success: false, reason: 'Dunning record not active' };
  }

  const nextAttemptNumber = dunning.attempt_count + 1;
  const isLastAttempt = nextAttemptNumber >= dunning.max_attempts;

  // Outcome simulation if forceOutcome is not specified (default to success on retry 2 or 3, or simulated)
  const isSuccessful = forceOutcome ? forceOutcome === 'success' : (nextAttemptNumber >= 2);

  if (isSuccessful) {
    resolveDunningOnPaymentSuccess(dunning.subscription_id, dunning.invoice_id);

    // Mark pending retry as success
    db.prepare(`
      UPDATE dunning_retries
      SET status = 'success', executed_at = ?
      WHERE dunning_id = ? AND status = 'pending'
    `).run(nowIso, dunningId);

    return {
      success: true,
      status: 'recovered',
      attempt: nextAttemptNumber,
      message: `Retry attempt #${nextAttemptNumber} succeeded! Payment recovered and subscription reactivated.`,
    };
  } else {
    runInTransaction(() => {
      // Mark pending retry as failed
      db.prepare(`
        UPDATE dunning_retries
        SET status = 'failed', executed_at = ?, failure_code = 'card_declined', failure_message = 'Insufficient funds / card declined'
        WHERE dunning_id = ? AND status = 'pending'
      `).run(nowIso, dunningId);

      if (isLastAttempt) {
        // Mark dunning record exhausted
        db.prepare(`
          UPDATE dunning_records
          SET attempt_count = ?, status = 'failed_exhausted', next_retry_at = NULL, last_retry_at = ?, updated_at = ?
          WHERE id = ?
        `).run(nextAttemptNumber, nowIso, nowIso, dunningId);

        // Mark subscription expired
        db.prepare(`
          UPDATE subscriptions
          SET status = 'expired', updated_at = ?
          WHERE id = ?
        `).run(nowIso, dunning.subscription_id);

        // Send suspension warning
        db.prepare(`
          INSERT INTO dunning_communications (id, dunning_id, user_id, channel, template_type, recipient, subject, message_body, sent_at, status)
          VALUES (?, ?, ?, 'email', 'account_suspended', 'user@moneyplughub.com', 'Account Suspended: Payment Retries Exhausted', 'All automatic retry attempts for your invoice failed. Your subscription has been set to unpaid.', ?, 'sent')
        `).run(`comm_${Date.now()}_suspended`, dunningId, dunning.user_id, nowIso);
      } else {
        const nextRetryDate = calculateNextRetryDate(nextAttemptNumber + 1);

        db.prepare(`
          UPDATE dunning_records
          SET attempt_count = ?, next_retry_at = ?, last_retry_at = ?, updated_at = ?
          WHERE id = ?
        `).run(nextAttemptNumber, nextRetryDate, nowIso, nowIso, dunningId);

        // Schedule next retry entry
        db.prepare(`
          INSERT INTO dunning_retries (id, dunning_id, attempt_number, scheduled_at, status, created_at)
          VALUES (?, ?, ?, ?, 'pending', ?)
        `).run(`retry_${Date.now()}_${nextAttemptNumber + 1}`, dunningId, nextAttemptNumber + 1, nextRetryDate, nowIso);

        // Send retry reminder email/SMS
        db.prepare(`
          INSERT INTO dunning_communications (id, dunning_id, user_id, channel, template_type, recipient, subject, message_body, sent_at, status)
          VALUES (?, ?, ?, 'email', 'retry_reminder', 'user@moneyplughub.com', 'Payment Retry Scheduled', ?, ?, 'sent')
        `).run(
          `comm_${Date.now()}_retry_${nextAttemptNumber}`,
          dunningId,
          dunning.user_id,
          `Payment retry #${nextAttemptNumber} failed. Next retry scheduled for ${nextRetryDate}. Use code ${dunning.retention_offer_code} for 30% off!`,
          nowIso
        );
      }
    });

    return {
      success: false,
      status: isLastAttempt ? 'failed_exhausted' : 'active',
      attempt: nextAttemptNumber,
      message: isLastAttempt
        ? `Retry attempt #${nextAttemptNumber} failed. Dunning attempts exhausted and subscription suspended.`
        : `Retry attempt #${nextAttemptNumber} failed. Next retry scheduled.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  1. PLANS — Public
//     GET /api/billing/plans
// ═══════════════════════════════════════════════════════════════════

router.get('/plans', (_req: Request, res: Response) => {
  const plans = db.prepare(
    'SELECT * FROM billing_plans WHERE is_active = 1 ORDER BY sort_order ASC'
  ).all() as any[];

  res.json({
    success: true,
    data: plans.map(p => ({
      ...p,
      features: JSON.parse(p.features_json || '[]'),
      price_monthly: `$${(p.price_cents_monthly / 100).toFixed(2)}`,
      price_annual: `$${(p.price_cents_annual / 100).toFixed(2)}`,
      price_annual_monthly: `$${(p.price_cents_annual / 1200).toFixed(2)}`,
      savings_annual: p.price_cents_monthly > 0
        ? `$${(((p.price_cents_monthly * 12) - p.price_cents_annual) / 100).toFixed(2)}`
        : '$0.00',
    })),
  });
});


// ═══════════════════════════════════════════════════════════════════
//  2. SUBSCRIBE — Create or change subscription
//     POST /api/billing/subscribe
//     Body: { plan_id, billing_cycle, promo_code? }
// ═══════════════════════════════════════════════════════════════════

router.post('/subscribe', (req: Request, res: Response) => {
  try {
    const { planId = 'creator-monthly', plan_id, promoCode = '', promo_code } = req.body || {};
    const effectivePlan = planId || plan_id || 'creator-monthly';
    const rawPromo = promoCode || promo_code || '';
    const cleanPromo = rawPromo.trim().toUpperCase();

    let userId = (req as any).user?.id;
    if (!userId) {
      const authHeader = req.headers['authorization'];
      const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies?.token;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, config.jwtSecret);
          userId = decoded?.userId || decoded?.id;
        } catch (e) {}
      }
    }

    if (!userId) {
      const firstUser: any = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
      userId = firstUser?.id;
    }

    if (!userId) {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }

    let basePrice = 29.00;
    let targetTier = 'CREATOR';
    let newTierTitle = 'Creator Plug';
    const planLower = effectivePlan.toLowerCase();

    if (planLower.includes('enterprise')) {
      basePrice = 499.00;
      targetTier = 'ENTERPRISE';
      newTierTitle = 'Enterprise Sovereign';
    } else if (planLower.includes('pro')) {
      basePrice = 149.00;
      targetTier = 'PRO';
      newTierTitle = 'Pro Master';
    } else if (planLower.includes('creator')) {
      basePrice = 29.00;
      targetTier = 'CREATOR';
      newTierTitle = 'Creator Plug';
    }

    let finalPrice = basePrice;
    if (cleanPromo === 'FOUNDING50') {
      finalPrice = 0.00;
    } else if (cleanPromo === 'VIPCREATOR') {
      finalPrice = basePrice * 0.5;
    } else if (cleanPromo === 'EARLYBIRD') {
      finalPrice = basePrice * 0.8;
    }

    const now = new Date().toISOString();
    const subscriptionId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const transactionId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    runInTransaction(() => {
      db.prepare(`
        UPDATE users 
        SET subscriptionTier = ?, 
            subscriptionActive = 1,
            tier_title = CASE 
              WHEN tier_title = 'Novice Plug' THEN ? 
              ELSE tier_title 
            END,
            updated_at = ?
        WHERE id = ?
      `).run(targetTier, newTierTitle, now, userId);

      try {
        db.prepare(`
          INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
          VALUES (?, ?, ?, 'active', 'monthly', ?, ?, ?, ?)
        `).run(subscriptionId, userId, effectivePlan, now, periodEnd, now, now);
      } catch (e1) {
        try {
          db.prepare(`
            INSERT INTO subscriptions (id, userId, planId, price, promoCode, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(subscriptionId, userId, effectivePlan, finalPrice, cleanPromo || null, now);
        } catch (e2) {}
      }

      try {
        db.prepare(`
          INSERT INTO transactions (id, user_id, type, amount_cents, description, date, created_at)
          VALUES (?, ?, 'income', ?, ?, ?, ?)
        `).run(
          transactionId,
          userId,
          Math.round(finalPrice * 100),
          `Creator Money OS Subscription (${effectivePlan}) — Promo: ${cleanPromo || 'NONE'}`,
          now.substring(0, 10),
          now
        );
      } catch (t1) {
        try {
          db.prepare(`
            INSERT INTO transactions (id, userId, type, amount, description, createdAt)
            VALUES (?, ?, 'subscription_activation', ?, ?, ?)
          `).run(
            transactionId,
            userId,
            finalPrice,
            `Creator Money OS Subscription (${effectivePlan}) — Promo: ${cleanPromo || 'NONE'}`,
            now
          );
        } catch (t2) {}
      }
    });

    res.status(200).json({
      status: 'SUCCESS',
      success: true,
      tier: targetTier,
      subscriptionActive: true,
      pricePaid: finalPrice,
      subscriptionId,
    });
  } catch (error: any) {
    console.error('Error in subscribe API:', error);
    res.status(500).json({ error: 'INTERNAL_BILLING_ERROR', message: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════
//  3. CURRENT SUBSCRIPTION
//     GET /api/billing/subscription
// ═══════════════════════════════════════════════════════════════════

router.get('/subscription', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const sub = db.prepare(`
    SELECT s.*, p.name as plan_name, p.slug as plan_slug, 
           p.price_cents_monthly, p.price_cents_annual, p.features_json
    FROM subscriptions s
    JOIN billing_plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status IN ('active','trialing','past_due')
    ORDER BY s.created_at DESC LIMIT 1
  `).get(userId) as any;

  if (!sub) {
    // Default to free plan
    const freePlan = db.prepare("SELECT * FROM billing_plans WHERE slug = 'free'").get() as any;
    res.json({
      success: true,
      data: {
        plan: 'Free Lite',
        plan_slug: 'free',
        status: 'active',
        billing_cycle: 'monthly',
        price_cents: 0,
        features: freePlan ? JSON.parse(freePlan.features_json || '[]') : [],
        is_free: true,
      }
    });
    return;
  }

  // Check if trial expired
  if (sub.status === 'trialing' && sub.trial_end && new Date(sub.trial_end) < new Date()) {
    db.prepare("UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), sub.id);
    sub.status = 'active';
  }

  // Check if period expired
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
    db.prepare("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), sub.id);
    sub.status = 'expired';
  }

  const daysLeft = sub.trial_end
    ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  res.json({
    success: true,
    data: {
      subscription_id: sub.id,
      plan: sub.plan_name,
      plan_slug: sub.plan_slug,
      plan_id: sub.plan_id,
      status: sub.status,
      billing_cycle: sub.billing_cycle,
      price_cents: sub.billing_cycle === 'annual' ? sub.price_cents_annual : sub.price_cents_monthly,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      trial_end: sub.trial_end,
      trial_days_remaining: daysLeft,
      features: JSON.parse(sub.features_json || '[]'),
      canceled_at: sub.canceled_at,
      is_free: sub.price_cents_monthly === 0,
    }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  4. CANCEL SUBSCRIPTION
//     POST /api/billing/cancel
//     Body: { reason? }
// ═══════════════════════════════════════════════════════════════════

router.post('/cancel', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { reason } = req.body || {};
  const now = new Date().toISOString();

  const sub = db.prepare(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active','trialing') ORDER BY created_at DESC LIMIT 1"
  ).get(userId) as any;

  if (!sub) {
    res.status(404).json({ success: false, error: 'No active subscription found' });
    return;
  }

  // Cancel at end of billing period (don't immediately revoke access)
  db.prepare(
    "UPDATE subscriptions SET status = 'canceled', canceled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?"
  ).run(now, reason || 'User requested cancellation', now, sub.id);

  recordAuditLog(userId, 'SUBSCRIPTION_CANCELED', 'subscriptions', sub.id, { reason });

  res.json({
    success: true,
    message: `Subscription canceled. You'll retain access until ${sub.current_period_end.substring(0, 10)}.`,
    data: { access_until: sub.current_period_end }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  5. INVOICES
//     GET /api/billing/invoices
// ═══════════════════════════════════════════════════════════════════

router.get('/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const invoices = db.prepare(`
    SELECT i.*, p.name as plan_name
    FROM invoices i
    LEFT JOIN subscriptions s ON s.id = i.subscription_id
    LEFT JOIN billing_plans p ON p.id = s.plan_id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
    LIMIT 50
  `).all(userId) as any[];

  res.json({
    success: true,
    data: invoices.map(inv => ({
      ...inv,
      amount: `$${(inv.amount_cents / 100).toFixed(2)}`,
      discount: `$${(inv.discount_cents / 100).toFixed(2)}`,
      total: `$${(inv.total_cents / 100).toFixed(2)}`,
    })),
  });
});


// ═══════════════════════════════════════════════════════════════════
//  6. PROMO CODE VALIDATION
//     POST /api/billing/validate-promo
//     Body: { code, plan_id? }
// ═══════════════════════════════════════════════════════════════════

router.post('/validate-promo', (req: Request, res: Response) => {
  const { code, plan_id } = req.body;

  if (!code) {
    res.status(400).json({ success: false, error: 'Code is required' });
    return;
  }

  const promo = db.prepare(
    "SELECT * FROM promo_codes WHERE code = ? COLLATE NOCASE AND is_active = 1"
  ).get(code.trim()) as any;

  if (!promo) {
    res.status(404).json({ success: false, error: 'Invalid promo code' });
    return;
  }

  if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
    res.status(400).json({ success: false, error: 'Promo code has expired' });
    return;
  }

  if (promo.max_uses && promo.current_uses >= promo.max_uses) {
    res.status(400).json({ success: false, error: 'Promo code usage limit reached' });
    return;
  }

  // Calculate discount preview
  let previewDiscount = '';
  if (promo.discount_type === 'percent') {
    previewDiscount = `${promo.discount_value}% off`;
  } else {
    previewDiscount = `$${promo.discount_value.toFixed(2)} off`;
  }

  res.json({
    success: true,
    data: {
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      description: previewDiscount,
      valid_until: promo.valid_until,
    }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  7. ADMIN: Promo Code Management
//     POST /api/billing/promos          (create)
//     GET  /api/billing/promos          (list all)
//     POST /api/billing/invoices/:id/mark-paid  (manual payment)
// ═══════════════════════════════════════════════════════════════════

router.post('/promos', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const { code, discount_type = 'percent', discount_value, max_uses, valid_until, applicable_plans } = req.body;

  if (!code || !discount_value) {
    res.status(400).json({ success: false, error: 'Code and discount_value are required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM promo_codes WHERE code = ? COLLATE NOCASE').get(code.trim());
  if (existing) {
    res.status(409).json({ success: false, error: 'Promo code already exists' });
    return;
  }

  const id = `promo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO promo_codes (id, code, discount_type, discount_value, max_uses, valid_until, applicable_plans, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, code.trim().toUpperCase(), discount_type, discount_value, max_uses || null, valid_until || null, applicable_plans || 'all', now);

  recordAuditLog(req.user!.id, 'PROMO_CREATED', 'promo_codes', id, { code, discount_type, discount_value });

  res.json({
    success: true,
    message: `Promo code ${code.toUpperCase()} created`,
    data: { id, code: code.toUpperCase() }
  });
});

router.get('/promos', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const promos = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
  res.json({ success: true, data: promos });
});

// Mark invoice as paid (manual/offline payment)
router.post('/invoices/:id/mark-paid', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const invId = req.params.id;
  const now = new Date().toISOString();
  const { payment_method = 'manual' } = req.body;

  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
  if (!inv) { res.status(404).json({ success: false, error: 'Invoice not found' }); return; }
  if (inv.status === 'paid') { res.status(400).json({ success: false, error: 'Already paid' }); return; }

  db.prepare(
    "UPDATE invoices SET status = 'paid', paid_at = ?, payment_method = ?, updated_at = ? WHERE id = ?"
  ).run(now, payment_method, now, invId);

  recordAuditLog(req.user!.id, 'INVOICE_PAID', 'invoices', invId, { amount_cents: inv.total_cents, payment_method });

  res.json({ success: true, message: `Invoice marked as paid ($${(inv.total_cents / 100).toFixed(2)})` });
});


// ═══════════════════════════════════════════════════════════════════
//  DUNNING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/billing/dunning/status
 * Returns active dunning state, grace period info, retention offer, and communication logs for authenticated user.
 */
router.get('/dunning/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const activeDunning = db.prepare(`
    SELECT d.*, i.amount_cents, i.description as invoice_desc, s.status as sub_status
    FROM dunning_records d
    JOIN invoices i ON i.id = d.invoice_id
    JOIN subscriptions s ON s.id = d.subscription_id
    WHERE d.user_id = ? AND d.status = 'active'
    ORDER BY d.created_at DESC LIMIT 1
  `).get(userId) as any;

  if (!activeDunning) {
    res.json({
      success: true,
      has_active_dunning: false,
      message: 'No payment recovery action pending',
    });
    return;
  }

  const retries = db.prepare(`
    SELECT * FROM dunning_retries
    WHERE dunning_id = ? ORDER BY attempt_number ASC
  `).all(activeDunning.id);

  const communications = db.prepare(`
    SELECT * FROM dunning_communications
    WHERE dunning_id = ? ORDER BY sent_at DESC
  `).all(activeDunning.id);

  const nowMs = Date.now();
  const graceEndMs = new Date(activeDunning.grace_period_ends_at).getTime();
  const hoursRemaining = Math.max(0, Math.round((graceEndMs - nowMs) / (1000 * 60 * 60)));

  res.json({
    success: true,
    has_active_dunning: true,
    data: {
      dunning_id: activeDunning.id,
      subscription_id: activeDunning.subscription_id,
      invoice_id: activeDunning.invoice_id,
      amount_cents: activeDunning.amount_cents,
      amount_formatted: `$${(activeDunning.amount_cents / 100).toFixed(2)}`,
      status: activeDunning.status,
      attempt_count: activeDunning.attempt_count,
      max_attempts: activeDunning.max_attempts,
      next_retry_at: activeDunning.next_retry_at,
      grace_period_ends_at: activeDunning.grace_period_ends_at,
      grace_hours_remaining: hoursRemaining,
      last_failure_reason: activeDunning.last_failure_reason,
      retention_offer_code: activeDunning.retention_offer_code,
      retention_offer_applied: Boolean(activeDunning.retention_offer_applied),
      retries,
      communications,
    }
  });
});

/**
 * POST /api/billing/dunning/simulate-failure
 * Simulates a payment failure for a subscription to initiate dunning.
 */
router.post('/dunning/simulate-failure', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { subscription_id, reason = 'card_declined' } = req.body || {};

  let sub = null;
  if (subscription_id) {
    sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(subscription_id, userId) as any;
  } else {
    sub = db.prepare(`
      SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(userId) as any;
  }

  if (!sub) {
    res.status(404).json({ success: false, error: 'Subscription not found' });
    return;
  }

  // Create an open invoice for testing failure
  const invoiceId = `inv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO invoices (id, user_id, subscription_id, amount_cents, discount_cents, tax_cents, total_cents, status, description, created_at, updated_at)
    VALUES (?, ?, ?, 2900, 0, 0, 2900, 'open', 'Monthly Subscription - Past Due Retry', ?, ?)
  `).run(invoiceId, userId, sub.id, nowIso, nowIso);

  const dunning = initiateDunningForFailedInvoice(userId, sub.id, invoiceId, reason);

  res.json({
    success: true,
    message: 'Simulated invoice payment failure and initiated dunning workflow',
    data: dunning,
  });
});

/**
 * POST /api/billing/dunning/process-retries
 * Admin/Trigger route to process next scheduled retry or force retry execution.
 */
router.post('/dunning/process-retries', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { dunning_id, force_outcome } = req.body || {};

  if (dunning_id) {
    const result = executeDunningRetry(dunning_id, force_outcome);
    res.json({ success: true, result });
    return;
  }

  // Batch process all active dunning records whose next_retry_at <= NOW
  const nowIso = new Date().toISOString();
  const pendingDunnings = db.prepare(`
    SELECT * FROM dunning_records
    WHERE status = 'active' AND (next_retry_at IS NULL OR next_retry_at <= ?)
  `).all(nowIso) as any[];

  const results = pendingDunnings.map(d => executeDunningRetry(d.id, force_outcome));

  res.json({
    success: true,
    processed_count: results.length,
    results,
  });
});

/**
 * POST /api/billing/dunning/apply-retention-offer
 * Allows a customer facing churn to redeem their targeted retention discount code.
 */
router.post('/dunning/apply-retention-offer', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { code } = req.body || {};

  if (!code) {
    res.status(400).json({ success: false, error: 'Retention discount code required' });
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  const activeDunning = db.prepare(`
    SELECT * FROM dunning_records
    WHERE user_id = ? AND status = 'active' AND retention_offer_code = ?
  `).get(userId, cleanCode) as any;

  if (!activeDunning) {
    res.status(404).json({ success: false, error: 'Invalid or non-applicable retention offer code' });
    return;
  }

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(activeDunning.invoice_id) as any;
  if (!invoice) {
    res.status(404).json({ success: false, error: 'Associated invoice not found' });
    return;
  }

  const discountCents = Math.round(invoice.amount_cents * 0.30);
  const newTotalCents = invoice.amount_cents - discountCents;
  const nowIso = new Date().toISOString();

  runInTransaction(() => {
    // Update invoice total with discount
    db.prepare(`
      UPDATE invoices
      SET discount_cents = ?, total_cents = ?, updated_at = ?
      WHERE id = ?
    `).run(discountCents, newTotalCents, nowIso, invoice.id);

    // Flag retention offer applied
    db.prepare(`
      UPDATE dunning_records
      SET retention_offer_applied = 1, updated_at = ?
      WHERE id = ?
    `).run(nowIso, activeDunning.id);

    // Record audit log
    recordAuditLog(userId, 'RETENTION_OFFER_APPLIED', 'dunning_records', activeDunning.id, {
      code: cleanCode,
      discount_cents: discountCents,
      new_total_cents: newTotalCents,
    });
  });

  res.json({
    success: true,
    message: '30% retention discount applied to pending payment!',
    data: {
      original_amount_formatted: `$${(invoice.amount_cents / 100).toFixed(2)}`,
      discount_formatted: `$${(discountCents / 100).toFixed(2)}`,
      new_total_formatted: `$${(newTotalCents / 100).toFixed(2)}`,
    }
  });
});

/**
 * GET /api/billing/dunning/admin/metrics
 * Admin dashboard overview for dunning recovery rate, active churn, and saved MRR.
 */
router.get('/dunning/admin/metrics', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_dunnings,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
      COUNT(CASE WHEN status = 'recovered' THEN 1 END) as recovered_count,
      COUNT(CASE WHEN status = 'failed_exhausted' THEN 1 END) as exhausted_count,
      COUNT(CASE WHEN retention_offer_applied = 1 THEN 1 END) as retention_offers_redeemed
    FROM dunning_records
  `).get() as any;

  const recoveredMrrCents = db.prepare(`
    SELECT COALESCE(SUM(i.total_cents), 0) as total
    FROM dunning_records d
    JOIN invoices i ON i.id = d.invoice_id
    WHERE d.status = 'recovered'
  `).get() as any;

  const recentDunnings = db.prepare(`
    SELECT d.*, u.email, u.display_name, i.total_cents
    FROM dunning_records d
    JOIN users u ON u.id = d.user_id
    JOIN invoices i ON i.id = d.invoice_id
    ORDER BY d.created_at DESC LIMIT 20
  `).all();

  const recoveryRate = totals.total_dunnings > 0
    ? ((totals.recovered_count / totals.total_dunnings) * 100).toFixed(1) + '%'
    : '0.0%';

  res.json({
    success: true,
    data: {
      total_dunnings: totals.total_dunnings,
      active_count: totals.active_count,
      recovered_count: totals.recovered_count,
      exhausted_count: totals.exhausted_count,
      retention_offers_redeemed: totals.retention_offers_redeemed,
      recovery_rate: recoveryRate,
      recovered_mrr_formatted: `$${(recoveredMrrCents.total / 100).toFixed(2)}`,
      recent_dunnings: recentDunnings.map((rd: any) => ({
        ...rd,
        amount_formatted: `$${(rd.total_cents / 100).toFixed(2)}`,
      })),
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
//  8. STRIPE WEBHOOK — Future integration point
//     POST /api/billing/webhook/stripe
//     This is where Stripe sends payment confirmations.
//     When connected, it auto-marks invoices paid and activates subs.
// ═══════════════════════════════════════════════════════════════════

router.post('/webhook/stripe', (req: Request, res: Response) => {
  const event = req.body;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'invoice.payment_succeeded': {
        const sessionOrInvoice = event.data?.object;
        const invoiceId = sessionOrInvoice?.metadata?.invoice_id || sessionOrInvoice?.id;
        const subscriptionId = sessionOrInvoice?.metadata?.subscription_id || sessionOrInvoice?.subscription;
        const now = new Date().toISOString();

        if (subscriptionId) {
          resolveDunningOnPaymentSuccess(subscriptionId, invoiceId);
        } else if (invoiceId) {
          db.prepare(
            "UPDATE invoices SET status = 'paid', paid_at = ?, payment_method = 'stripe', stripe_payment_intent_id = ?, updated_at = ? WHERE id = ?"
          ).run(now, sessionOrInvoice?.payment_intent || null, now, invoiceId);

          const inv = db.prepare('SELECT subscription_id FROM invoices WHERE id = ?').get(invoiceId) as any;
          if (inv?.subscription_id) {
            resolveDunningOnPaymentSuccess(inv.subscription_id, invoiceId);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data?.object;
        const subscriptionId = invoice?.subscription || invoice?.metadata?.subscription_id;
        const customerId = invoice?.customer;
        const failureReason = invoice?.last_payment_error?.message || invoice?.failure_message || 'card_declined';

        if (subscriptionId) {
          let sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? OR stripe_subscription_id = ?').get(subscriptionId, subscriptionId) as any;
          if (sub) {
            let invId = invoice?.id;
            const existingInv = db.prepare('SELECT id FROM invoices WHERE id = ? OR stripe_payment_intent_id = ?').get(invId, invoice?.payment_intent) as any;
            if (!existingInv) {
              invId = `inv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
              db.prepare(`
                INSERT INTO invoices (id, user_id, subscription_id, amount_cents, discount_cents, tax_cents, total_cents, status, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, 0, ?, 'open', 'Failed Invoice Automatic Dunning', datetime('now'), datetime('now'))
              `).run(invId, sub.user_id, sub.id, invoice?.amount_due || 2900, invoice?.amount_due || 2900);
            } else {
              invId = existingInv.id;
            }

            initiateDunningForFailedInvoice(sub.user_id, sub.id, invId, failureReason);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data?.object;
        const subId = sub?.metadata?.subscription_id || sub?.id;
        if (subId) {
          db.prepare(
            "UPDATE subscriptions SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ?"
          ).run(new Date().toISOString(), new Date().toISOString(), subId);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook error:', err);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});


// ═══════════════════════════════════════════════════════════════════
//  9. ADMIN: Revenue Dashboard
//     GET /api/billing/revenue
// ═══════════════════════════════════════════════════════════════════

router.get('/revenue', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const mrr = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN s.billing_cycle = 'annual' THEN p.price_cents_annual / 12 
           ELSE p.price_cents_monthly END
    ), 0) as mrr_cents
    FROM subscriptions s
    JOIN billing_plans p ON p.id = s.plan_id
    WHERE s.status IN ('active','trialing')
  `).get() as any;

  const totalRevenue = db.prepare(
    "SELECT COALESCE(SUM(total_cents), 0) as total FROM invoices WHERE status = 'paid'"
  ).get() as any;

  const subsByPlan = db.prepare(`
    SELECT p.name, p.slug, COUNT(s.id) as count
    FROM subscriptions s
    JOIN billing_plans p ON p.id = s.plan_id
    WHERE s.status IN ('active','trialing')
    GROUP BY p.id ORDER BY p.sort_order
  `).all() as any[];

  const subsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM subscriptions GROUP BY status
  `).all() as any[];

  const recentInvoices = db.prepare(`
    SELECT i.*, u.display_name, u.email
    FROM invoices i
    JOIN users u ON u.id = i.user_id
    ORDER BY i.created_at DESC LIMIT 20
  `).all() as any[];

  const churnRate = db.prepare(`
    SELECT 
      COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled,
      COUNT(*) as total
    FROM subscriptions
    WHERE created_at > datetime('now', '-30 days')
  `).get() as any;

  res.json({
    success: true,
    data: {
      mrr_cents: Number(mrr?.mrr_cents || 0),
      mrr: `$${(Number(mrr?.mrr_cents || 0) / 100).toFixed(2)}`,
      arr: `$${(Number(mrr?.mrr_cents || 0) * 12 / 100).toFixed(2)}`,
      total_revenue_cents: Number(totalRevenue?.total || 0),
      total_revenue: `$${(Number(totalRevenue?.total || 0) / 100).toFixed(2)}`,
      subscribers_by_plan: subsByPlan,
      subscriptions_by_status: subsByStatus,
      churn_rate_30d: churnRate?.total > 0
        ? `${((churnRate.canceled / churnRate.total) * 100).toFixed(1)}%`
        : '0.0%',
      recent_invoices: recentInvoices.map((inv: any) => ({
        ...inv,
        total: `$${(inv.total_cents / 100).toFixed(2)}`,
      })),
    }
  });
});

export default router;
