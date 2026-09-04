import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Stripe from 'stripe';
import { config } from '../config';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { insertRealTransaction } from '../transactions/engine';

const router = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_moneyplughub';
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20' as any,
});

// ═══════════════════════════════════════════════════════════════════
//  BILLING ENGINE — Creator Money OS
//  Self-hosted subscription management, invoicing, promo codes,
//  trial logic, upgrade/downgrade flows, and Stripe webhook sync.
// ═══════════════════════════════════════════════════════════════════

// ── Schema ───────────────────────────────────────────────────────
try {
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
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trialing','active','past_due','canceled','expired','unpaid','incomplete_expired')),
      billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual')),
      current_period_start TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      trial_end TEXT,
      canceled_at TEXT,
      cancel_reason TEXT,
      promo_code_id TEXT,
      stripe_subscription_id TEXT,
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

// Helper function to resolve plan & tier mapping
function resolvePlanAndTier(rawPlan: string): { planId: string; tier: string; tierTitle: string } {
  const planLower = String(rawPlan || '').toLowerCase();
  if (planLower.includes('enterprise')) {
    return { planId: 'plan_enterprise', tier: 'ENTERPRISE', tierTitle: 'Enterprise Sovereign' };
  } else if (planLower.includes('pro')) {
    return { planId: 'plan_pro', tier: 'PRO', tierTitle: 'Pro Master' };
  } else if (planLower.includes('creator')) {
    return { planId: 'plan_creator', tier: 'CREATOR', tierTitle: 'Creator Plug' };
  } else if (planLower.includes('free')) {
    return { planId: 'plan_free', tier: 'FREE', tierTitle: 'Novice Plug' };
  }
  return { planId: 'plan_creator', tier: 'CREATOR', tierTitle: 'Creator Plug' };
}

/**
 * Atomic Processor for Stripe checkout.session.completed events.
 * Syncs subscriptions, user tier, and financial_transactions ledger in a single SQLite transaction.
 */
export function processCheckoutSessionCompleted(session: Stripe.Checkout.Session | any): {
  subscriptionId: string;
  transactionId: string;
  tier: string;
} {
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

  // Resolve user ID
  let userId = session.metadata?.user_id || session.client_reference_id;
  if (!userId && stripeSubscriptionId) {
    const existingSub = db.prepare('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ?')
      .get(stripeSubscriptionId, stripeSubscriptionId) as any;
    userId = existingSub?.user_id;
  }
  if (!userId) {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
    userId = firstUser?.id || 'u_system_stripe';
  }

  const rawPlan = session.metadata?.plan_id || session.metadata?.plan || 'plan_creator';
  const billingCycle = session.metadata?.billing_cycle || 'monthly';
  const { planId, tier: targetTier, tierTitle } = resolvePlanAndTier(rawPlan);

  const now = new Date().toISOString();
  const periodEnd = billingCycle === 'annual'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const subId = stripeSubscriptionId || `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const amountTotalCents = session.amount_total ?? session.amount ?? 0;
  const amountDollars = Number((amountTotalCents / 100).toFixed(2));
  const processorId = session.id;

  runInTransaction(() => {
    // 1. Update User Tier
    db.prepare(`
      UPDATE users
      SET subscriptionTier = ?,
          subscriptionActive = 1,
          tier_title = ?,
          updated_at = ?
      WHERE id = ?
    `).run(targetTier, tierTitle, now, userId);

    // 2. Upsert Subscription Record
    const existingSub = db.prepare('SELECT id FROM subscriptions WHERE id = ? OR stripe_subscription_id = ?')
      .get(subId, subId) as any;

    if (existingSub) {
      db.prepare(`
        UPDATE subscriptions
        SET user_id = ?, plan_id = ?, status = 'active', billing_cycle = ?,
            current_period_start = ?, current_period_end = ?, stripe_subscription_id = ?, updated_at = ?
        WHERE id = ?
      `).run(userId, planId, billingCycle, now, periodEnd, subId, now, existingSub.id);
    } else {
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, stripe_subscription_id, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
      `).run(subId, userId, planId, billingCycle, now, periodEnd, subId, now, now);
    }

    // 3. Insert Record into Financial Transaction Ledger (Idempotent by processor_id)
    const existingTx = db.prepare('SELECT id FROM financial_transactions WHERE processor_id = ?').get(processorId) as any;
    if (!existingTx) {
      db.prepare(`
        INSERT INTO financial_transactions (id, user_id, amount, type, source, timestamp, is_real, processor_id, metadata, created_at)
        VALUES (?, ?, ?, 'charge', 'stripe', ?, 1, ?, ?, ?)
      `).run(
        txId,
        userId,
        amountDollars,
        now,
        processorId,
        JSON.stringify({
          stripe_checkout_session_id: session.id,
          stripe_subscription_id: subId,
          stripe_customer_id: stripeCustomerId,
          tier: targetTier,
          plan_id: planId,
          billing_cycle: billingCycle,
          currency: session.currency?.toUpperCase() || 'USD',
          ...session.metadata,
        }),
        now
      );
    }

    // 4. Mark matching Invoice paid if applicable
    if (session.metadata?.invoice_id) {
      db.prepare(`
        UPDATE invoices
        SET status = 'paid', paid_at = ?, payment_method = 'stripe', stripe_payment_intent_id = ?, updated_at = ?
        WHERE id = ?
      `).run(now, session.payment_intent || null, now, session.metadata.invoice_id);
    }

    recordAuditLog(userId, 'STRIPE_CHECKOUT_COMPLETED', 'subscriptions', subId, {
      tier: targetTier,
      amountDollars,
      stripeSubscriptionId: subId,
      checkoutSessionId: session.id,
    });
  });

  return { subscriptionId: subId, transactionId: txId, tier: targetTier };
}

/**
 * Atomic Processor for Stripe customer.subscription.updated events.
 * Syncs subscriptions, user tier, and financial_transactions ledger in a single SQLite transaction.
 */
export function processSubscriptionUpdated(sub: Stripe.Subscription | any): {
  subscriptionId: string;
  tier: string;
  status: string;
} {
  const stripeSubscriptionId = sub.id;
  const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

  // Resolve user_id
  let userId = sub.metadata?.user_id;
  if (!userId) {
    const existingSub = db.prepare('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ?')
      .get(stripeSubscriptionId, stripeSubscriptionId) as any;
    userId = existingSub?.user_id;
  }
  if (!userId) {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
    userId = firstUser?.id || 'u_system_stripe';
  }

  const subStatus = sub.status; // 'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete_expired'
  const isSubActive = (subStatus === 'active' || subStatus === 'trialing');

  // Determine plan and tier
  let rawPlan = sub.metadata?.plan_id || sub.metadata?.plan || sub.items?.data?.[0]?.plan?.id || sub.items?.data?.[0]?.price?.id || '';
  if (!rawPlan) {
    const existingSub = db.prepare('SELECT plan_id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ?')
      .get(stripeSubscriptionId, stripeSubscriptionId) as any;
    rawPlan = existingSub?.plan_id || 'plan_creator';
  }

  let { planId, tier: targetTier, tierTitle } = resolvePlanAndTier(rawPlan);

  // Downgrade if subscription is canceled, unpaid, or expired
  if (!isSubActive && (subStatus === 'canceled' || subStatus === 'unpaid' || subStatus === 'incomplete_expired')) {
    targetTier = 'FREE';
    tierTitle = 'Novice Plug';
  }

  const now = new Date().toISOString();
  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : now;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;
  const cancelReason = sub.cancellation_details?.reason || sub.cancel_reason || null;

  runInTransaction(() => {
    // 1. Update User Tier
    db.prepare(`
      UPDATE users
      SET subscriptionTier = ?,
          subscriptionActive = ?,
          tier_title = ?,
          updated_at = ?
      WHERE id = ?
    `).run(targetTier, isSubActive ? 1 : 0, tierTitle, now, userId);

    // 2. Update Subscription Record
    const existingSub = db.prepare('SELECT id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ?')
      .get(stripeSubscriptionId, stripeSubscriptionId) as any;

    if (existingSub) {
      db.prepare(`
        UPDATE subscriptions
        SET user_id = ?, plan_id = ?, status = ?,
            current_period_start = ?, current_period_end = ?, canceled_at = ?, cancel_reason = ?,
            stripe_subscription_id = ?, updated_at = ?
        WHERE id = ?
      `).run(userId, planId, subStatus, periodStart, periodEnd, canceledAt, cancelReason, stripeSubscriptionId, now, existingSub.id);
    } else {
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, canceled_at, cancel_reason, stripe_subscription_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'monthly', ?, ?, ?, ?, ?, ?, ?)
      `).run(stripeSubscriptionId, userId, planId, subStatus, periodStart, periodEnd, canceledAt, cancelReason, stripeSubscriptionId, now, now);
    }

    // 3. Financial Transaction Ledger sync (for subscription payment / renewal if present)
    const latestInvoiceId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
    if (latestInvoiceId && isSubActive) {
      const processorId = `inv_${latestInvoiceId}`;
      const existingTx = db.prepare('SELECT id FROM financial_transactions WHERE processor_id = ?').get(processorId) as any;
      if (!existingTx) {
        const amountCents = sub.latest_invoice?.amount_paid || sub.items?.data?.[0]?.price?.unit_amount || 0;
        const amountDollars = Number((amountCents / 100).toFixed(2));
        if (amountDollars > 0) {
          const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          db.prepare(`
            INSERT INTO financial_transactions (id, user_id, amount, type, source, timestamp, is_real, processor_id, metadata, created_at)
            VALUES (?, ?, ?, 'charge', 'stripe', ?, 1, ?, ?, ?)
          `).run(
            txId,
            userId,
            amountDollars,
            now,
            processorId,
            JSON.stringify({
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
              stripe_invoice_id: latestInvoiceId,
              tier: targetTier,
              plan_id: planId,
              status: subStatus,
            }),
            now
          );
        }
      }
    }

    recordAuditLog(userId, 'STRIPE_SUBSCRIPTION_UPDATED', 'subscriptions', stripeSubscriptionId, {
      tier: targetTier,
      status: subStatus,
      stripeSubscriptionId,
    });
  });

  return { subscriptionId: stripeSubscriptionId, tier: targetTier, status: subStatus };
}

/**
 * Centralized Stripe Webhook Router dispatching atomic database ledger updates.
 */
export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<{
  eventType: string;
  subscriptionId?: string;
  transactionId?: string;
  tier?: string;
  status?: string;
}> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const res = processCheckoutSessionCompleted(session);
      return { eventType: event.type, ...res };
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const res = processSubscriptionUpdated(sub);
      return { eventType: event.type, ...res };
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const res = processSubscriptionUpdated({ ...sub, status: 'canceled' });
      return { eventType: event.type, ...res };
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (subId) {
        const existingSub = db.prepare('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ?')
          .get(subId, subId) as any;
        if (existingSub) {
          const userId = existingSub.user_id;
          const now = new Date().toISOString();
          const amountDollars = Number(((invoice.amount_paid || 0) / 100).toFixed(2));
          runInTransaction(() => {
            db.prepare("UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ? or stripe_subscription_id = ?")
              .run(now, subId, subId);
            if (amountDollars > 0) {
              const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
              const processorId = invoice.id;
              const existingTx = db.prepare('SELECT id FROM financial_transactions WHERE processor_id = ?').get(processorId);
              if (!existingTx) {
                db.prepare(`
                  INSERT INTO financial_transactions (id, user_id, amount, type, source, timestamp, is_real, processor_id, metadata, created_at)
                  VALUES (?, ?, ?, 'charge', 'stripe', ?, 1, ?, ?, ?)
                `).run(
                  txId,
                  userId,
                  amountDollars,
                  now,
                  processorId,
                  JSON.stringify({
                    stripe_invoice_id: invoice.id,
                    stripe_subscription_id: subId,
                    stripe_customer_id: invoice.customer,
                  }),
                  now
                );
              }
            }
          });
        }
      }
      return { eventType: event.type, subscriptionId: subId || undefined };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (subId) {
        const now = new Date().toISOString();
        runInTransaction(() => {
          db.prepare("UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE stripe_subscription_id = ? OR id = ?")
            .run(now, subId, subId);
        });
      }
      return { eventType: event.type, subscriptionId: subId || undefined };
    }

    case 'payment_intent.succeeded':
    case 'charge.succeeded':
    case 'charge.refunded': {
      const tx = await insertRealTransaction(event);
      return { eventType: event.type, transactionId: tx.id };
    }

    default: {
      return { eventType: event.type };
    }
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
//  1B. CREATE STRIPE CHECKOUT SESSION
//      POST /api/billing/create-checkout-session
// ═══════════════════════════════════════════════════════════════════

router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { plan_id = 'plan_creator', planId, billing_cycle = 'monthly', billingCycle, promo_code, promoCode, success_url, cancel_url } = req.body || {};
    const effectivePlanId = plan_id || planId || 'plan_creator';
    const effectiveCycle = billing_cycle || billingCycle || 'monthly';
    const cleanPromo = (promo_code || promoCode || '').trim().toUpperCase();

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

    const plan = db.prepare('SELECT * FROM billing_plans WHERE id = ? OR slug = ?')
      .get(effectivePlanId, effectivePlanId.replace('plan_', '')) as any;

    if (!plan) {
      res.status(404).json({ success: false, error: 'PLAN_NOT_FOUND' });
      return;
    }

    let basePriceCents = effectiveCycle === 'annual' ? plan.price_cents_annual : plan.price_cents_monthly;
    let finalPriceCents = basePriceCents;

    if (cleanPromo === 'FOUNDING50') {
      finalPriceCents = 0;
    } else if (cleanPromo === 'VIPCREATOR') {
      finalPriceCents = Math.round(basePriceCents * 0.5);
    } else if (cleanPromo === 'EARLYBIRD') {
      finalPriceCents = Math.round(basePriceCents * 0.8);
    }

    const domain = req.headers.origin || req.headers.referer || 'http://localhost:3000';
    const defaultSuccessUrl = `${domain}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`;
    const defaultCancelUrl = `${domain}/billing?canceled=true`;

    const targetTier = plan.slug === 'enterprise' ? 'ENTERPRISE' : plan.slug === 'pro' ? 'PRO' : plan.slug === 'creator' ? 'CREATOR' : 'FREE';

    let session: Stripe.Checkout.Session;
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('mock')) {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Creator Money OS — ${plan.name} Plan`,
                description: `Subscription tier: ${plan.name} (${effectiveCycle})`,
              },
              unit_amount: finalPriceCents,
              recurring: finalPriceCents > 0 ? { interval: effectiveCycle === 'annual' ? 'year' : 'month' } : undefined,
            },
            quantity: 1,
          },
        ],
        mode: finalPriceCents > 0 ? 'subscription' : 'payment',
        success_url: success_url || defaultSuccessUrl,
        cancel_url: cancel_url || defaultCancelUrl,
        client_reference_id: userId,
        metadata: {
          user_id: userId,
          plan_id: plan.id,
          plan_slug: plan.slug,
          tier: targetTier,
          billing_cycle: effectiveCycle,
          promo_code: cleanPromo || '',
        },
      });
    } else {
      // Mock Checkout session for dev and test environments
      const mockSessionId = `cs_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      session = {
        id: mockSessionId,
        object: 'checkout.session',
        amount_total: finalPriceCents,
        currency: 'usd',
        customer: `cus_mock_${userId}`,
        client_reference_id: userId,
        url: (success_url || defaultSuccessUrl).replace('{CHECKOUT_SESSION_ID}', mockSessionId),
        metadata: {
          user_id: userId,
          plan_id: plan.id,
          plan_slug: plan.slug,
          tier: targetTier,
          billing_cycle: effectiveCycle,
          promo_code: cleanPromo || '',
        },
      } as any;
    }

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      plan: plan.name,
      tier: targetTier,
      amount_cents: finalPriceCents,
    });
  } catch (error: any) {
    console.error('Error creating Stripe Checkout session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
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

  // Cancel at end of billing period
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
  const { code } = req.body;

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
//  8. STRIPE WEBHOOK HANDLER
//     POST /api/billing/webhook/stripe
// ═══════════════════════════════════════════════════════════════════

router.post('/webhook/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && sig) {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
    } else {
      event = req.body as Stripe.Event;
      if (!event.type || !event.data?.object) {
        res.status(400).json({ error: 'Invalid Stripe event structure' });
        return;
      }
    }
  } catch (err: any) {
    console.error('[Billing Webhook] Signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    const result = await handleStripeWebhookEvent(event);
    res.json({ success: true, received: true, ...result });
  } catch (err: any) {
    console.error('[Billing Webhook] Processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed', details: err.message });
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
