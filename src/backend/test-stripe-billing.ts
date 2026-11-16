import assert from 'assert';
import Stripe from 'stripe';
import { db, initDb, runInTransaction } from './db';
import { handleCheckoutSessionCompleted, handleCustomerSubscriptionUpdated } from './routes/stripeWebhook';
import { getUserTransactions } from './transactions/engine';

export async function runStripeBillingIntegrationTests() {
  console.log('🧪 Starting Stripe Billing Webhook Integration Tests...\n');
  initDb();

  // 1. Create test user
  const userId = `usr_stripe_test_${Date.now()}`;
  const now = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Stripe Tester', 'user', ?, ?, ?)
    `).run(userId, `stripe_test_${Date.now()}@example.com`, `REF_${Date.now()}`, now, now);
  });

  const initialUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  assert.strictEqual(initialUser.subscriptionTier, 'FREE');
  assert.strictEqual(Number(initialUser.subscriptionActive), 0);
  console.log('✅ Test user created in FREE state.');

  // 2. Test checkout.session.completed event (Upgrade to Pro)
  console.log('\n💳 Testing checkout.session.completed (Pro Tier)...');
  const mockCheckoutSession: Partial<Stripe.Checkout.Session> = {
    id: `cs_test_${Date.now()}`,
    object: 'checkout.session',
    amount_total: 14900,
    currency: 'usd',
    customer: `cus_${Date.now()}`,
    subscription: `sub_stripe_pro_${Date.now()}`,
    payment_intent: `pi_test_${Date.now()}`,
    metadata: {
      user_id: userId,
      plan_id: 'pro',
    },
  };

  const checkoutResult = handleCheckoutSessionCompleted(mockCheckoutSession as Stripe.Checkout.Session);
  assert.strictEqual(checkoutResult.success, true);
  assert.strictEqual(checkoutResult.tier, 'PRO');

  // Verify DB state for User
  const updatedUserPro = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  assert.strictEqual(updatedUserPro.subscriptionTier, 'PRO');
  assert.strictEqual(Number(updatedUserPro.subscriptionActive), 1);
  assert.strictEqual(updatedUserPro.tier_title, 'Pro Master');

  // Verify DB state for Subscription
  const activeSub = db.prepare("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'").get(userId) as any;
  assert(activeSub, 'Active subscription record must exist');
  assert.strictEqual(activeSub.plan_id, 'plan_pro');
  assert.strictEqual(activeSub.stripe_subscription_id, mockCheckoutSession.subscription);

  // Verify Invoice created
  const invoice = db.prepare('SELECT * FROM invoices WHERE user_id = ?').get(userId) as any;
  assert(invoice, 'Invoice record must exist');
  assert.strictEqual(invoice.status, 'paid');
  assert.strictEqual(invoice.amount_cents, 14900);
  console.log('✅ checkout.session.completed synced subscription, tier title, and invoice successfully.');

  // 3. Test customer.subscription.updated event (Upgrade to Enterprise)
  console.log('\n🚀 Testing customer.subscription.updated (Enterprise Upgrade)...');
  const mockSubEnterprise: Record<string, any> = {
    id: mockCheckoutSession.subscription as string,
    object: 'subscription',
    status: 'active',
    customer: mockCheckoutSession.customer as string,
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    items: {
      object: 'list',
      data: [{
        id: 'si_123',
        object: 'subscription_item',
        price: {
          id: 'price_enterprise',
          object: 'price',
          lookup_key: 'enterprise',
          nickname: 'Enterprise Plan',
        } as any,
      }] as any,
      has_more: false,
      url: '',
    },
    metadata: {
      user_id: userId,
      plan_id: 'enterprise',
    },
  };

  const updateResultEnterprise = handleCustomerSubscriptionUpdated(mockSubEnterprise as Stripe.Subscription);
  assert.strictEqual(updateResultEnterprise.success, true);
  assert.strictEqual(updateResultEnterprise.tier, 'ENTERPRISE');

  const updatedUserEnterprise = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  assert.strictEqual(updatedUserEnterprise.subscriptionTier, 'ENTERPRISE');
  assert.strictEqual(updatedUserEnterprise.tier_title, 'Enterprise Sovereign');
  assert.strictEqual(Number(updatedUserEnterprise.subscriptionActive), 1);
  console.log('✅ customer.subscription.updated (Upgrade) updated user tier to ENTERPRISE atomically.');

  // 4. Test customer.subscription.updated event (Payment Failure / Past Due)
  console.log('\n⚠️ Testing customer.subscription.updated (Past Due / Suspension)...');
  const mockSubPastDue: Partial<Stripe.Subscription> = {
    ...mockSubEnterprise,
    status: 'past_due',
  };

  const updateResultPastDue = handleCustomerSubscriptionUpdated(mockSubPastDue as Stripe.Subscription);
  assert.strictEqual(updateResultPastDue.success, true);
  assert.strictEqual(updateResultPastDue.status, 'past_due');

  const updatedUserPastDue = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  assert.strictEqual(Number(updatedUserPastDue.subscriptionActive), 0);

  const pastDueSub = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(mockCheckoutSession.subscription as string) as any;
  assert.strictEqual(pastDueSub.status, 'past_due');
  console.log('✅ customer.subscription.updated (Past Due) set subscriptionActive=0 atomically.');

  // 5. Test customer.subscription.updated event (Cancellation)
  console.log('\n❌ Testing customer.subscription.updated (Cancellation)...');
  const mockSubCanceled: Record<string, any> = {
    ...mockSubEnterprise,
    status: 'canceled',
    canceled_at: Math.floor(Date.now() / 1000),
  };

  const updateResultCanceled = handleCustomerSubscriptionUpdated(mockSubCanceled as Stripe.Subscription);
  assert.strictEqual(updateResultCanceled.success, true);
  assert.strictEqual(updateResultCanceled.status, 'canceled');

  const canceledSub = db.prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(mockCheckoutSession.subscription as string) as any;
  assert.strictEqual(canceledSub.status, 'canceled');
  assert(canceledSub.canceled_at !== null, 'canceled_at must be populated');
  console.log('✅ customer.subscription.updated (Canceled) updated subscription state atomically.');

  console.log('\n🎉 ALL STRIPE BILLING INTEGRATION TESTS PASSED PERFECTLY!\n');
}

// Run if called directly via tsx
if (process.argv[1]?.includes('test-stripe-billing')) {
  runStripeBillingIntegrationTests().catch((err) => {
    console.error('❌ Integration test failed:', err);
    process.exit(1);
  });
}
