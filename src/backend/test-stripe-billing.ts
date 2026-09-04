import assert from 'assert';
import Stripe from 'stripe';
import { db, initDb, runInTransaction } from './db';
import {
  processCheckoutSessionCompleted,
  processCustomerSubscriptionUpdated,
} from './routes/stripeWebhook';

async function runStripeBillingTests() {
  console.log('🧪 Starting Stripe Billing & Webhook Integration Tests...\n');

  // 1. Initialize schema
  initDb();

  // 2. Setup test user
  const testUserId = `usr_test_stripe_${Date.now()}`;
  const refCode = `REF_STRIPE_${Date.now()}`;
  const testEmail = `stripe_tester_${Date.now()}@moneyplug.local`;
  const now = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, role, referral_code,
        subscriptionTier, subscriptionActive, tier_title, created_at, updated_at
      ) VALUES (?, ?, 'hash123', 'Stripe Tester', 'user', ?, 'FREE', 0, 'Novice Plug', ?, ?)
    `).run(testUserId, testEmail, refCode, now, now);
  });

  const initialUser = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(initialUser.subscriptionTier, 'FREE');
  assert.strictEqual(Number(initialUser.subscriptionActive), 0);
  console.log('✓ Step 1: Initialized test user with FREE tier.');

  // 3. Test checkout.session.completed for PRO Plan
  const checkoutSessionId = `cs_test_${Date.now()}`;
  const stripeSubId = `sub_test_pro_${Date.now()}`;
  const mockCheckoutEvent: Stripe.Event = {
    id: `evt_cs_${Date.now()}`,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: checkoutSessionId,
        object: 'checkout.session',
        amount_total: 14900,
        currency: 'usd',
        customer: 'cus_test_123',
        subscription: stripeSubId,
        payment_intent: `pi_test_${Date.now()}`,
        client_reference_id: testUserId,
        metadata: {
          user_id: testUserId,
          plan_id: 'plan_pro',
          tier: 'PRO',
        },
      } as any,
    },
  };

  const checkoutResult = await processCheckoutSessionCompleted(mockCheckoutEvent);
  assert.strictEqual(checkoutResult.userId, testUserId);
  assert.strictEqual(checkoutResult.tier, 'PRO');
  assert.strictEqual(checkoutResult.planId, 'plan_pro');

  const updatedUserPro = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(updatedUserPro.subscriptionTier, 'PRO');
  assert.strictEqual(Number(updatedUserPro.subscriptionActive), 1);
  assert.strictEqual(updatedUserPro.tier_title, 'Pro Master');

  const subRecordPro = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubId) as any;
  assert(subRecordPro, 'Subscription record must exist');
  assert.strictEqual(subRecordPro.plan_id, 'plan_pro');
  assert.strictEqual(subRecordPro.status, 'active');

  const invoiceRecordPro = db.prepare('SELECT * FROM invoices WHERE user_id = ?').get(testUserId) as any;
  assert(invoiceRecordPro, 'Invoice record must exist');
  assert.strictEqual(Number(invoiceRecordPro.total_cents), 14900);
  assert.strictEqual(invoiceRecordPro.status, 'paid');

  const ledgerTxPro = db.prepare('SELECT * FROM financial_transactions WHERE processor_id = ?').get(checkoutSessionId) as any;
  assert(ledgerTxPro, 'Financial transactions ledger entry must exist');
  assert.strictEqual(Number(ledgerTxPro.amount), 149.00);
  assert.strictEqual(Number(ledgerTxPro.is_real), 1);
  assert.strictEqual(ledgerTxPro.source, 'stripe');

  console.log('✓ Step 2: Atomic checkout.session.completed synced PRO tier, active status, subscription, invoice, and ledger.');

  // 4. Test customer.subscription.updated for upgrade to ENTERPRISE
  const mockSubUpdateEvent: Stripe.Event = {
    id: `evt_sub_upg_${Date.now()}`,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.updated',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: stripeSubId,
        object: 'subscription',
        status: 'active',
        customer: 'cus_test_123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        items: {
          data: [
            {
              price: {
                id: 'price_enterprise',
                nickname: 'Enterprise Sovereign',
                unit_amount: 49900,
                currency: 'usd',
              },
            },
          ],
        },
        metadata: {
          user_id: testUserId,
          tier: 'ENTERPRISE',
          plan_id: 'plan_enterprise',
        },
      } as any,
    },
  };

  const updateResult = await processCustomerSubscriptionUpdated(mockSubUpdateEvent);
  assert.strictEqual(updateResult.userId, testUserId);
  assert.strictEqual(updateResult.tier, 'ENTERPRISE');
  assert.strictEqual(updateResult.status, 'active');

  const updatedUserEnt = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(updatedUserEnt.subscriptionTier, 'ENTERPRISE');
  assert.strictEqual(Number(updatedUserEnt.subscriptionActive), 1);
  assert.strictEqual(updatedUserEnt.tier_title, 'Enterprise Sovereign');

  const subRecordEnt = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubId) as any;
  assert.strictEqual(subRecordEnt.plan_id, 'plan_enterprise');
  assert.strictEqual(subRecordEnt.status, 'active');

  const ledgerTxEnt = db.prepare('SELECT * FROM financial_transactions WHERE processor_id = ?').get(stripeSubId) as any;
  assert(ledgerTxEnt, 'Ledger entry for enterprise upgrade must exist');
  assert.strictEqual(Number(ledgerTxEnt.amount), 499.00);

  console.log('✓ Step 3: Atomic customer.subscription.updated upgraded user to ENTERPRISE tier & synced ledger.');

  // 5. Test customer.subscription.deleted / cancellation
  const mockSubCancelEvent: Stripe.Event = {
    id: `evt_sub_del_${Date.now()}`,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.deleted',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: stripeSubId,
        object: 'subscription',
        status: 'canceled',
        customer: 'cus_test_123',
        canceled_at: Math.floor(Date.now() / 1000),
        metadata: {
          user_id: testUserId,
        },
      } as any,
    },
  };

  const cancelResult = await processCustomerSubscriptionUpdated(mockSubCancelEvent);
  assert.strictEqual(cancelResult.status, 'canceled');
  assert.strictEqual(cancelResult.tier, 'FREE');

  const updatedUserCanceled = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(updatedUserCanceled.subscriptionTier, 'FREE');
  assert.strictEqual(Number(updatedUserCanceled.subscriptionActive), 0);
  assert.strictEqual(updatedUserCanceled.tier_title, 'Novice Plug');

  const subRecordCanceled = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(stripeSubId) as any;
  assert.strictEqual(subRecordCanceled.status, 'canceled');

  console.log('✓ Step 4: Atomic cancellation reset user to FREE tier & inactive status.');

  // 6. Test Idempotency for Checkout Session
  const dupeResult = await processCheckoutSessionCompleted(mockCheckoutEvent);
  assert.strictEqual(dupeResult.transaction.id, ledgerTxPro.id, 'Duplicate checkout session must return existing transaction ID without duplicating');

  const countTx = db.prepare('SELECT COUNT(*) as c FROM financial_transactions WHERE processor_id = ?').get(checkoutSessionId) as any;
  assert.strictEqual(Number(countTx.c), 1, 'Transaction count in ledger must remain 1');

  console.log('✓ Step 5: Webhook idempotency verified (zero duplicate ledger entries).');

  console.log('\n🎉 ALL STRIPE BILLING INTEGRATION TESTS PASSED 100% SUCCESS!\n');
  process.exit(0);
}

runStripeBillingTests().catch((err) => {
  console.error('❌ Stripe Billing Test Failed:', err);
  process.exit(1);
});
