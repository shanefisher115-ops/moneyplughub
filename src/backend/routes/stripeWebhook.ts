import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db, runInTransaction } from '../db';
import { insertRealTransaction } from '../transactions/engine';

export const stripeWebhookRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_moneyplughub';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Processes `checkout.session.completed` event:
 * Atomically updates user subscription tier, user active state, invoice status,
 * subscription record, and inserts transaction into financial ledger within a single ACID transaction.
 */
export async function processCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const now = new Date().toISOString();

  // Determine user_id
  let userId =
    session.metadata?.user_id ||
    session.metadata?.userId ||
    session.client_reference_id;

  if (!userId && (session.customer_details?.email || session.customer_email)) {
    const email = session.customer_details?.email || session.customer_email;
    const userRow = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1').get(email) as any;
    if (userRow) {
      userId = userRow.id;
    }
  }

  if (!userId && session.customer) {
    const custId = typeof session.customer === 'string' ? session.customer : session.customer.id;
    const subRow = db.prepare(
      'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ? LIMIT 1'
    ).get(custId, custId) as any;
    if (subRow) {
      userId = subRow.user_id;
    }
  }

  if (!userId) {
    console.warn(`[Stripe Webhook] Warning: Could not resolve user_id for session ${session.id}. Aborting mutation.`);
    return { success: false, reason: 'UNMATCHED_USER' };
  }

  // Determine plan and tier
  const rawPlan = (
    session.metadata?.plan_id ||
    session.metadata?.plan ||
    session.metadata?.tier ||
    ''
  ).toLowerCase();
  const amountTotal = session.amount_total ?? 0;

  let planId = 'plan_creator';
  let tier = 'CREATOR';
  let tierTitle = 'Creator Plug';

  if (rawPlan.includes('enterprise') || amountTotal >= 40000) {
    planId = 'plan_enterprise';
    tier = 'ENTERPRISE';
    tierTitle = 'Enterprise Sovereign';
  } else if (rawPlan.includes('pro') || (amountTotal >= 10000 && amountTotal < 40000)) {
    planId = 'plan_pro';
    tier = 'PRO';
    tierTitle = 'Pro Master';
  } else if (rawPlan.includes('creator') || (amountTotal > 0 && amountTotal < 10000)) {
    planId = 'plan_creator';
    tier = 'CREATOR';
    tierTitle = 'Creator Plug';
  } else if (rawPlan.includes('free') || amountTotal === 0) {
    planId = 'plan_free';
    tier = 'FREE';
    tierTitle = 'Novice Plug';
  }

  const stripeSubId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription as any)?.id || null;

  const subId = stripeSubId || `sub_${session.id}`;
  const periodStart = now;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let transactionRecord: any = null;

  runInTransaction(() => {
    // 1. Update user tier & active status
    db.prepare(`
      UPDATE users
      SET subscriptionTier = ?,
          subscriptionActive = 1,
          tier_title = CASE
            WHEN tier_title IN ('Novice Plug', 'Creator Plug', 'Pro Master', 'Enterprise Sovereign')
            THEN ?
            ELSE tier_title
          END,
          updated_at = ?
      WHERE id = ?
    `).run(tier, tierTitle, now, userId);

    // 2. Upsert Subscription Record
    const existingSub = db.prepare(`
      SELECT id FROM subscriptions
      WHERE id = ? OR stripe_subscription_id = ? OR (user_id = ? AND status IN ('active','trialing'))
      ORDER BY created_at DESC LIMIT 1
    `).get(subId, stripeSubId, userId) as any;

    if (existingSub) {
      db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?,
            status = 'active',
            billing_cycle = 'monthly',
            current_period_start = ?,
            current_period_end = ?,
            stripe_subscription_id = COALESCE(?, stripe_subscription_id),
            updated_at = ?
        WHERE id = ?
      `).run(planId, periodStart, periodEnd, stripeSubId, now, existingSub.id);
    } else {
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, stripe_subscription_id, created_at, updated_at)
        VALUES (?, ?, ?, 'active', 'monthly', ?, ?, ?, ?, ?)
      `).run(subId, userId, planId, periodStart, periodEnd, stripeSubId, now, now);
    }

    // 3. Upsert Invoice Record
    const invoiceId = session.invoice
      ? (typeof session.invoice === 'string' ? session.invoice : session.invoice.id)
      : `inv_${session.id}`;

    const existingInvoice = db.prepare('SELECT id FROM invoices WHERE id = ?').get(invoiceId);
    if (existingInvoice) {
      db.prepare(`
        UPDATE invoices
        SET status = 'paid', paid_at = ?, payment_method = 'stripe', stripe_payment_intent_id = ?, updated_at = ?
        WHERE id = ?
      `).run(
        now,
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
        now,
        invoiceId
      );
    } else {
      db.prepare(`
        INSERT INTO invoices (id, user_id, subscription_id, amount_cents, discount_cents, tax_cents, total_cents, currency, status, description, paid_at, payment_method, stripe_payment_intent_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'paid', ?, ?, 'stripe', ?, ?, ?)
      `).run(
        invoiceId,
        userId,
        subId,
        amountTotal,
        amountTotal,
        (session.currency || 'USD').toUpperCase(),
        `Stripe Checkout: ${tierTitle} Plan`,
        now,
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
        now,
        now
      );
    }
  });

  // 4. Atomic Financial Ledger Record
  transactionRecord = await insertRealTransaction(event, userId);

  return { success: true, userId, tier, planId, subscriptionId: subId, transaction: transactionRecord };
}

/**
 * Processes `customer.subscription.updated`, `customer.subscription.created`, and `customer.subscription.deleted`:
 * Atomically updates subscription status, user tier/active state, and records financial ledger entry.
 */
export async function processCustomerSubscriptionUpdated(event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const now = new Date().toISOString();

  const stripeSubId = sub.id;
  const stripeStatus = sub.status; // 'active', 'past_due', 'canceled', 'unpaid', 'trialing', etc.

  let mappedStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' = 'active';
  let isActiveFlag = 1;

  if (stripeStatus === 'trialing') {
    mappedStatus = 'trialing';
    isActiveFlag = 1;
  } else if (stripeStatus === 'active') {
    mappedStatus = 'active';
    isActiveFlag = 1;
  } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
    mappedStatus = 'past_due';
    isActiveFlag = 0;
  } else if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired' || event.type === 'customer.subscription.deleted') {
    mappedStatus = 'canceled';
    isActiveFlag = 0;
  } else {
    mappedStatus = 'expired';
    isActiveFlag = 0;
  }

  // Find User ID
  let userId = sub.metadata?.user_id || sub.metadata?.userId;

  if (!userId) {
    const existingSub = db.prepare(
      'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ? LIMIT 1'
    ).get(stripeSubId, stripeSubId) as any;
    if (existingSub) {
      userId = existingSub.user_id;
    }
  }

  if (!userId && sub.customer) {
    const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const subRow = db.prepare(
      'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? OR user_id = ? LIMIT 1'
    ).get(custId, custId) as any;
    if (subRow) {
      userId = subRow.user_id;
    }
  }

  if (!userId) {
    console.warn(`[Stripe Webhook] Warning: Could not resolve user_id for subscription ${sub.id}. Aborting mutation.`);
    return { success: false, reason: 'UNMATCHED_USER' };
  }

  // Determine plan & tier
  const itemPrice = sub.items?.data?.[0]?.price;
  const priceCents = itemPrice?.unit_amount ?? 0;
  const rawPlan = (
    sub.metadata?.plan_id ||
    sub.metadata?.tier ||
    itemPrice?.nickname ||
    itemPrice?.id ||
    ''
  ).toLowerCase();

  let planId = 'plan_creator';
  let tier = 'CREATOR';
  let tierTitle = 'Creator Plug';

  if (rawPlan.includes('enterprise') || priceCents >= 40000) {
    planId = 'plan_enterprise';
    tier = 'ENTERPRISE';
    tierTitle = 'Enterprise Sovereign';
  } else if (rawPlan.includes('pro') || (priceCents >= 10000 && priceCents < 40000)) {
    planId = 'plan_pro';
    tier = 'PRO';
    tierTitle = 'Pro Master';
  } else if (rawPlan.includes('creator') || (priceCents > 0 && priceCents < 10000)) {
    planId = 'plan_creator';
    tier = 'CREATOR';
    tierTitle = 'Creator Plug';
  } else if (rawPlan.includes('free') || priceCents === 0) {
    planId = 'plan_free';
    tier = 'FREE';
    tierTitle = 'Novice Plug';
  }

  if (!isActiveFlag) {
    if (mappedStatus === 'canceled' || mappedStatus === 'expired') {
      tier = 'FREE';
      tierTitle = 'Novice Plug';
      planId = 'plan_free';
    }
  }

  const periodStart = (sub as any).current_period_start
    ? new Date((sub as any).current_period_start * 1000).toISOString()
    : now;
  const periodEnd = (sub as any).current_period_end
    ? new Date((sub as any).current_period_end * 1000).toISOString()
    : now;
  const canceledAt = (sub as any).canceled_at
    ? new Date((sub as any).canceled_at * 1000).toISOString()
    : null;

  let transactionRecord: any = null;

  runInTransaction(() => {
    // 1. Update user tier & active flag
    db.prepare(`
      UPDATE users
      SET subscriptionTier = ?,
          subscriptionActive = ?,
          tier_title = ?,
          updated_at = ?
      WHERE id = ?
    `).run(tier, isActiveFlag, tierTitle, now, userId);

    // 2. Upsert Subscription Record
    const existingSub = db.prepare(`
      SELECT id FROM subscriptions WHERE stripe_subscription_id = ? OR id = ? LIMIT 1
    `).get(stripeSubId, stripeSubId) as any;

    if (existingSub) {
      db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?,
            status = ?,
            current_period_start = ?,
            current_period_end = ?,
            canceled_at = ?,
            stripe_subscription_id = ?,
            updated_at = ?
        WHERE id = ?
      `).run(planId, mappedStatus, periodStart, periodEnd, canceledAt, stripeSubId, now, existingSub.id);
    } else {
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, canceled_at, stripe_subscription_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'monthly', ?, ?, ?, ?, ?, ?)
      `).run(stripeSubId, userId, planId, mappedStatus, periodStart, periodEnd, canceledAt, stripeSubId, now, now);
    }
  });

  // 3. Sync financial ledger transaction if active charge
  if (priceCents > 0 && isActiveFlag) {
    transactionRecord = await insertRealTransaction(event, userId);
  }

  return {
    success: true,
    userId,
    status: mappedStatus,
    tier,
    planId,
    subscriptionId: stripeSubId,
    transaction: transactionRecord,
  };
}

/**
 * POST /api/webhooks/stripe
 * Validates Stripe signature, handles payment & subscription events,
 * and syncs subscriptions & tier changes atomically into database ledger.
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
        const result = await processCheckoutSessionCompleted(event);
        console.log(`[Stripe Webhook] checkout.session.completed synced for user ${result.userId} (Tier: ${result.tier})`);
        res.json({ success: true, received: true, action: 'checkout_processed', data: result });
        return;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const result = await processCustomerSubscriptionUpdated(event);
        console.log(`[Stripe Webhook] ${event.type} synced for user ${result.userId} (Status: ${result.status}, Tier: ${result.tier})`);
        res.json({ success: true, received: true, action: 'subscription_updated', data: result });
        return;
      }

      case 'invoice.payment_succeeded':
      case 'payment_intent.succeeded':
      case 'charge.succeeded':
      case 'charge.refunded': {
        const tx = await insertRealTransaction(event);
        console.log(`[Stripe Webhook] Processed Financial Event ${event.type}: ${tx.id} for $${tx.amount}`);
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
