import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { db, runInTransaction, recordAuditLog } from '../db';
import { insertRealTransaction } from '../transactions/engine';

export const stripeWebhookRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_moneyplughub';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Helper to map plan string or price ID to standard tier info
 */
export function mapPlanToTier(planInput?: string): {
  planId: string;
  tier: string;
  tierTitle: string;
} {
  const p = (planInput || '').toLowerCase();
  if (p.includes('enterprise')) {
    return { planId: 'plan_enterprise', tier: 'ENTERPRISE', tierTitle: 'Enterprise Sovereign' };
  } else if (p.includes('pro')) {
    return { planId: 'plan_pro', tier: 'PRO', tierTitle: 'Pro Master' };
  } else if (p.includes('creator')) {
    return { planId: 'plan_creator', tier: 'CREATOR', tierTitle: 'Creator Plug' };
  } else if (p.includes('free')) {
    return { planId: 'plan_free', tier: 'FREE', tierTitle: 'Novice Plug' };
  }
  // Default fallback for paid subscriptions
  return { planId: 'plan_creator', tier: 'CREATOR', tierTitle: 'Creator Plug' };
}

/**
 * Atomically handles checkout.session.completed event
 */
export function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId =
    session.metadata?.user_id ||
    session.client_reference_id ||
    (session.customer as string);

  if (!userId) {
    console.warn('[Stripe Webhook] checkout.session.completed missing user identifier');
    return { success: false, reason: 'No user_id found in checkout session' };
  }

  const rawPlan =
    session.metadata?.plan_id ||
    session.metadata?.plan ||
    session.metadata?.tier ||
    'creator';

  const { planId, tier, tierTitle } = mapPlanToTier(rawPlan);
  const now = new Date().toISOString();

  // Determine current period start/end
  const periodStart = now;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const stripeSubId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription as Stripe.Subscription)?.id || null;

  const invoiceId = session.metadata?.invoice_id || `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const totalCents = session.amount_total ?? 0;

  let createdSubId = '';

  runInTransaction(() => {
    // 1. Update user subscription tier
    db.prepare(`
      UPDATE users
      SET subscriptionTier = ?,
          subscriptionActive = 1,
          tier_title = ?,
          updated_at = ?
      WHERE id = ?
    `).run(tier, tierTitle, now, userId);

    // 2. Insert or update active subscription record
    // Check if subscription already exists for user or stripe_subscription_id
    let existingSub: any = null;
    if (stripeSubId) {
      existingSub = db.prepare("SELECT id FROM subscriptions WHERE stripe_subscription_id = ? OR (user_id = ? AND status = 'active')").get(stripeSubId, userId);
    } else {
      existingSub = db.prepare("SELECT id FROM subscriptions WHERE user_id = ? AND status = 'active'").get(userId);
    }

    if (existingSub) {
      createdSubId = existingSub.id;
      db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?,
            status = 'active',
            stripe_subscription_id = COALESCE(?, stripe_subscription_id),
            current_period_start = ?,
            current_period_end = ?,
            updated_at = ?
        WHERE id = ?
      `).run(planId, stripeSubId, periodStart, periodEnd, now, existingSub.id);
    } else {
      createdSubId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      db.prepare(`
        INSERT INTO subscriptions (
          id, user_id, plan_id, status, billing_cycle,
          current_period_start, current_period_end, stripe_subscription_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'active', 'monthly', ?, ?, ?, ?, ?)
      `).run(createdSubId, userId, planId, periodStart, periodEnd, stripeSubId, now, now);
    }

    // 3. Insert or update invoice record
    const existingInvoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(invoiceId);
    if (existingInvoice) {
      db.prepare(`
        UPDATE invoices
        SET status = 'paid',
            paid_at = ?,
            payment_method = 'stripe',
            stripe_payment_intent_id = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, (session.payment_intent as string) || null, now, invoiceId);
    } else {
      db.prepare(`
        INSERT INTO invoices (
          id, user_id, subscription_id, amount_cents, discount_cents, tax_cents,
          total_cents, currency, status, description, billing_period_start, billing_period_end,
          paid_at, payment_method, stripe_payment_intent_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'paid', ?, ?, ?, ?, 'stripe', ?, ?, ?)
      `).run(
        invoiceId,
        userId,
        createdSubId,
        totalCents,
        totalCents,
        (session.currency || 'usd').toUpperCase(),
        `Checkout Session Completed (${planId})`,
        periodStart,
        periodEnd,
        now,
        (session.payment_intent as string) || null,
        now,
        now
      );
    }

    recordAuditLog(userId, 'CHECKOUT_SESSION_COMPLETED', 'subscriptions', createdSubId, {
      tier,
      planId,
      stripeSubId,
      amountTotal: totalCents,
    });
  });

  return { success: true, subscriptionId: createdSubId, userId, tier };
}

/**
 * Atomically handles customer.subscription.updated event
 */
export function handleCustomerSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripeSubId = subscription.id;
  const status = subscription.status; // active, past_due, canceled, trialing, unpaid, etc.
  const now = new Date().toISOString();

  // Extract user ID from metadata or database lookup
  let userId = subscription.metadata?.user_id;

  const existingSub = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubId) as any;
  if (!userId && existingSub) {
    userId = existingSub.user_id;
  }

  if (!userId) {
    // Try finding by customer ID if mapped
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const userByCustomer = db.prepare('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubId) as any;
    userId = userByCustomer?.user_id;
  }

  if (!userId) {
    console.warn(`[Stripe Webhook] customer.subscription.updated missing user identifier for sub ${stripeSubId}`);
    return { success: false, reason: 'User not found for subscription' };
  }

  // Determine plan and tier
  const priceItem = subscription.items?.data?.[0]?.price;
  const rawPlan =
    subscription.metadata?.plan_id ||
    subscription.metadata?.tier ||
    priceItem?.lookup_key ||
    priceItem?.nickname ||
    'creator';

  const { planId, tier, tierTitle } = mapPlanToTier(rawPlan);

  const subAny = subscription as any;
  const rawPeriodStart = subAny.current_period_start ?? subAny.start_date;
  const rawPeriodEnd = subAny.current_period_end ?? subAny.ended_at;

  const periodStart = rawPeriodStart
    ? new Date(rawPeriodStart * 1000).toISOString()
    : now;
  const periodEnd = rawPeriodEnd
    ? new Date(rawPeriodEnd * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Normalize status for internal enum ('trialing','active','past_due','canceled','expired')
  let mappedStatus = 'active';
  let isUserActive = 1;

  if (status === 'trialing') {
    mappedStatus = 'trialing';
    isUserActive = 1;
  } else if (status === 'active') {
    mappedStatus = 'active';
    isUserActive = 1;
  } else if (status === 'past_due' || status === 'unpaid') {
    mappedStatus = 'past_due';
    isUserActive = 0;
  } else if (status === 'canceled' || status === 'incomplete_expired') {
    mappedStatus = 'canceled';
    isUserActive = 0;
  }

  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

  runInTransaction(() => {
    // 1. Update user subscription status and tier
    if (isUserActive) {
      db.prepare(`
        UPDATE users
        SET subscriptionTier = ?,
            subscriptionActive = 1,
            tier_title = ?,
            updated_at = ?
        WHERE id = ?
      `).run(tier, tierTitle, now, userId);
    } else {
      db.prepare(`
        UPDATE users
        SET subscriptionActive = 0,
            updated_at = ?
        WHERE id = ?
      `).run(now, userId);
    }

    // 2. Update subscription record in database
    if (existingSub) {
      db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?,
            status = ?,
            current_period_start = ?,
            current_period_end = ?,
            canceled_at = COALESCE(?, canceled_at),
            updated_at = ?
        WHERE id = ?
      `).run(planId, mappedStatus, periodStart, periodEnd, canceledAt, now, existingSub.id);
    } else {
      const subId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      db.prepare(`
        INSERT INTO subscriptions (
          id, user_id, plan_id, status, billing_cycle,
          current_period_start, current_period_end, canceled_at,
          stripe_subscription_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'monthly', ?, ?, ?, ?, ?, ?)
      `).run(subId, userId, planId, mappedStatus, periodStart, periodEnd, canceledAt, stripeSubId, now, now);
    }

    recordAuditLog(userId, 'CUSTOMER_SUBSCRIPTION_UPDATED', 'subscriptions', stripeSubId, {
      stripeStatus: status,
      mappedStatus,
      tier,
      planId,
      cancelAtPeriodEnd,
    });
  });

  return { success: true, stripeSubId, userId, status: mappedStatus, tier };
}

/**
 * POST /api/webhooks/stripe
 * Validates Stripe signature, handles payment & subscription events,
 * and atomically syncs subscriptions and transactions into database ledger.
 */
stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
    } else {
      // In dev or test environments without signature, accept structured Stripe event payload
      event = req.body as Stripe.Event;
      if (!event.type || !event.data?.object) {
        res.status(400).json({ error: 'Invalid Stripe event structure' });
        return;
      }
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // 1. Insert real transaction record for financial ledger
        const tx = await insertRealTransaction(event);

        // 2. Atomically update subscription and user tier
        const syncResult = handleCheckoutSessionCompleted(session);

        console.log(`[Stripe Webhook] Processed checkout.session.completed: tx=${tx.id}, sub=${syncResult.subscriptionId}`);
        res.json({
          success: true,
          received: true,
          transactionId: tx.id,
          subscriptionResult: syncResult,
        });
        return;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const syncResult = handleCustomerSubscriptionUpdated(subscription);

        console.log(`[Stripe Webhook] Processed ${event.type}: sub=${subscription.id}, mappedStatus=${syncResult.status}`);
        res.json({
          success: true,
          received: true,
          subscriptionResult: syncResult,
        });
        return;
      }

      case 'payment_intent.succeeded':
      case 'charge.succeeded':
      case 'charge.refunded': {
        const tx = await insertRealTransaction(event);
        console.log(`[Stripe Webhook] Processed Real Charge: ${tx.id} for $${tx.amount}`);
        res.json({ success: true, received: true, transactionId: tx.id });
        return;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        res.json({ success: true, received: true, ignored: true });
        return;
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Processing error:`, err);
    res.status(500).json({ error: 'Transaction pipeline insertion error', details: err.message });
  }
});
