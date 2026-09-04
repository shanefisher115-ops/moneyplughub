import assert from 'assert';
import { db, initDb, runInTransaction } from './db';
import { handleStripeWebhookEvent, processCheckoutSessionCompleted, processSubscriptionUpdated } from './routes/billing';

export async function testStripeBillingIntegration() {
  console.log('🧪 Testing Stripe Billing & Webhook Integration with Atomic Ledger Sync...');

  initDb();

  // Create test user
  const testUserId = `usr_stripe_test_${Date.now()}`;
  const now = new Date().toISOString();

  const referralCode = `REF-${Date.now()}`;
  const testEmail = `stripe_test_${Date.now()}@example.com`;
  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, subscriptionTier, subscriptionActive, tier_title, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Stripe Tester', 'user', ?, 'FREE', 0, 'Novice Plug', ?, ?)
    `).run(testUserId, testEmail, referralCode, now, now);
  });

  // Verify initial state
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(user.subscriptionTier, 'FREE');
  assert.strictEqual(Number(user.subscriptionActive), 0);

  // 1. Test checkout.session.completed for PRO Plan
  const checkoutEvent: any = {
    id: `evt_cs_${Date.now()}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: 'checkout.session',
        subscription: `sub_stripe_${Date.now()}`,
        customer: `cus_test_${Date.now()}`,
        client_reference_id: testUserId,
        amount_total: 14900,
        currency: 'usd',
        metadata: {
          user_id: testUserId,
          plan_id: 'plan_pro',
          tier: 'PRO',
          billing_cycle: 'monthly'
        }
      }
    }
  };

  const checkoutResult = await handleStripeWebhookEvent(checkoutEvent);
  assert.strictEqual(checkoutResult.eventType, 'checkout.session.completed');
  assert.strictEqual(checkoutResult.tier, 'PRO');

  // Verify DB state after checkout.session.completed
  user = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(user.subscriptionTier, 'PRO');
  assert.strictEqual(Number(user.subscriptionActive), 1);
  assert.strictEqual(user.tier_title, 'Pro Master');

  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(testUserId) as any;
  assert.strictEqual(sub.plan_id, 'plan_pro');
  assert.strictEqual(sub.status, 'active');

  const tx = db.prepare('SELECT * FROM financial_transactions WHERE user_id = ? AND processor_id = ?')
    .get(testUserId, checkoutEvent.data.object.id) as any;
  assert(tx !== undefined, 'Transaction record must exist in financial_transactions ledger');
  assert.strictEqual(tx.amount, 149);
  assert.strictEqual(tx.is_real, 1);
  assert.strictEqual(tx.source, 'stripe');

  console.log('  ✓ checkout.session.completed correctly synced subscription, tier, and financial_transactions ledger atomically.');

  // 2. Test customer.subscription.updated (Tier Upgrade to ENTERPRISE)
  const upgradeSubId = sub.stripe_subscription_id;
  const upgradeEvent: any = {
    id: `evt_sub_up_${Date.now()}`,
    type: 'customer.subscription.updated',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: upgradeSubId,
        object: 'subscription',
        customer: checkoutEvent.data.object.customer,
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        metadata: {
          user_id: testUserId,
          plan_id: 'plan_enterprise'
        },
        items: {
          data: [{ price: { id: 'price_enterprise', unit_amount: 49900 } }]
        },
        latest_invoice: {
          id: `inv_up_${Date.now()}`,
          amount_paid: 49900
        }
      }
    }
  };

  const upgradeResult = await handleStripeWebhookEvent(upgradeEvent);
  assert.strictEqual(upgradeResult.eventType, 'customer.subscription.updated');
  assert.strictEqual(upgradeResult.tier, 'ENTERPRISE');

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(user.subscriptionTier, 'ENTERPRISE');
  assert.strictEqual(Number(user.subscriptionActive), 1);
  assert.strictEqual(user.tier_title, 'Enterprise Sovereign');

  const subUpgraded = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(testUserId) as any;
  assert.strictEqual(subUpgraded.plan_id, 'plan_enterprise');

  const txUpgrade = db.prepare('SELECT * FROM financial_transactions WHERE processor_id = ?')
    .get(`inv_${upgradeEvent.data.object.latest_invoice.id}`) as any;
  assert(txUpgrade !== undefined, 'Renewal/upgrade invoice tx must exist in ledger');
  assert.strictEqual(txUpgrade.amount, 499);

  console.log('  ✓ customer.subscription.updated (upgrade) updated user tier & subscription record atomically.');

  // 3. Test customer.subscription.updated (Downgrade/Cancellation to FREE)
  const cancelEvent: any = {
    id: `evt_sub_del_${Date.now()}`,
    type: 'customer.subscription.updated',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: upgradeSubId,
        object: 'subscription',
        customer: checkoutEvent.data.object.customer,
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000),
        metadata: {
          user_id: testUserId,
          plan_id: 'plan_enterprise'
        }
      }
    }
  };

  const cancelResult = await handleStripeWebhookEvent(cancelEvent);
  assert.strictEqual(cancelResult.tier, 'FREE');

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId) as any;
  assert.strictEqual(user.subscriptionTier, 'FREE');
  assert.strictEqual(Number(user.subscriptionActive), 0);
  assert.strictEqual(user.tier_title, 'Novice Plug');

  const subCanceled = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(testUserId) as any;
  assert.strictEqual(subCanceled.status, 'canceled');

  console.log('  ✓ customer.subscription.updated (cancellation) downgraded user tier to FREE atomically.');

  console.log('✅ ALL STRIPE BILLING & WEBHOOK SYNC TESTS PASSED SUCCESSFULLY!\n');
}

if (require.main === module) {
  testStripeBillingIntegration().catch(err => {
    console.error('❌ Stripe Billing Integration Test Failed:', err);
    process.exit(1);
  });
}
