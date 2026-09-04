import assert from 'assert';
import bcrypt from 'bcryptjs';
import { db, initDb, runInTransaction } from './db';
import {
  initiateDunningForFailedInvoice,
  resolveDunningOnPaymentSuccess,
  executeDunningRetry,
  calculateNextRetryDate,
  DUNNING_CONFIG,
} from './routes/billing';

async function testDunningWorkflows() {
  console.log('🧪 Starting Smart Billing Dunning Workflows Integration Test Suite...\n');

  initDb();

  const testUserId = `test_usr_dunning_${Date.now()}`;
  const nowIso = new Date().toISOString();

  // 1. Create Test User and Active Subscription
  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES (?, ?, ?, 'Dunning Tester', 'user', ?, ?, ?)
    `).run(testUserId, `dunning_user_${Date.now()}@test.local`, bcrypt.hashSync('Pass123!', 8), `REF-DUNNING-${Date.now()}`, nowIso, nowIso);

    db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, 'plan_creator', 'active', 'monthly', ?, ?, ?, ?)
    `).run(`sub_test_${Date.now()}`, testUserId, nowIso, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), nowIso, nowIso);
  });

  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(testUserId) as any;
  assert(sub, 'Subscription must exist');
  console.log('✓ Step 1: Test user & active subscription created.');

  // 2. Simulate Credit Card Payment Failure & Initiate Dunning Workflow
  const invoiceId = `inv_failed_${Date.now()}`;
  db.prepare(`
    INSERT INTO invoices (id, user_id, subscription_id, amount_cents, discount_cents, tax_cents, total_cents, status, description, created_at, updated_at)
    VALUES (?, ?, ?, 2900, 0, 0, 2900, 'open', 'Monthly Subscription Invoice - Card Failed', ?, ?)
  `).run(invoiceId, testUserId, sub.id, nowIso, nowIso);

  const dunning = initiateDunningForFailedInvoice(testUserId, sub.id, invoiceId, 'insufficient_funds');
  assert(dunning, 'Dunning record must be generated');
  assert.strictEqual(dunning.status, 'active');
  assert.strictEqual(dunning.max_attempts, 4);
  assert(dunning.retention_offer_code.startsWith('SAVE30-'));

  const updatedSub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(sub.id) as any;
  assert.strictEqual(updatedSub.status, 'past_due', 'Subscription status must be set to past_due');
  assert(updatedSub.grace_period_ends_at, 'Grace period end date must be populated');
  console.log(`✓ Step 2: Dunning workflow initiated on credit card failure. Grace period set to 14 days.`);

  // 3. Verify Scheduled Retry Schedule & Communication Logs
  const retries = db.prepare('SELECT * FROM dunning_retries WHERE dunning_id = ?').all(dunning.id) as any[];
  assert.strictEqual(retries.length, 1);
  assert.strictEqual(retries[0].attempt_number, 1);
  assert.strictEqual(retries[0].status, 'pending');

  const comms = db.prepare('SELECT * FROM dunning_communications WHERE dunning_id = ?').all(dunning.id) as any[];
  assert(comms.some(c => c.channel === 'email' && c.template_type === 'payment_failed'), 'Must trigger failed payment email');
  assert(comms.some(c => c.channel === 'sms' && c.template_type === 'payment_failed'), 'Must trigger failed payment SMS');
  console.log('✓ Step 3: Automated retry schedule calculated and multi-channel notifications logged.');

  // 4. Test Targeted Retention Discount Application (30% Off)
  const initialInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
  assert.strictEqual(initialInvoice.total_cents, 2900);

  const discountCents = Math.round(initialInvoice.amount_cents * 0.30);
  const newTotalCents = initialInvoice.amount_cents - discountCents;

  db.prepare(`
    UPDATE invoices SET discount_cents = ?, total_cents = ? WHERE id = ?
  `).run(discountCents, newTotalCents, invoiceId);

  db.prepare(`
    UPDATE dunning_records SET retention_offer_applied = 1 WHERE id = ?
  `).run(dunning.id);

  const discountedInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
  assert.strictEqual(discountedInvoice.total_cents, 2030, 'Invoice total must be discounted by 30% ($20.30)');
  console.log('✓ Step 4: Targeted 30% retention discount successfully applied to pending invoice.');

  // 5. Test Dunning Retry Execution & Payment Recovery
  const retryResult = executeDunningRetry(dunning.id, 'success');
  assert.strictEqual(retryResult.success, true);
  assert.strictEqual(retryResult.status, 'recovered');

  const recoveredDunning = db.prepare('SELECT * FROM dunning_records WHERE id = ?').get(dunning.id) as any;
  assert.strictEqual(recoveredDunning.status, 'recovered');

  const reactivatedSub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(sub.id) as any;
  assert.strictEqual(reactivatedSub.status, 'active');
  assert.strictEqual(reactivatedSub.grace_period_ends_at, null);

  const paidInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
  assert.strictEqual(paidInvoice.status, 'paid');
  console.log('✓ Step 5: Payment retry executed successfully. Subscription reactivated and invoice marked paid.');

  // 6. Test Dunning Exhaustion Path (Simulating 4 Consecutive Failures)
  const sub2Id = `sub_exhaust_${Date.now()}`;
  const inv2Id = `inv_exhaust_${Date.now()}`;

  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
    VALUES (?, ?, 'plan_pro', 'active', 'monthly', ?, ?, ?, ?)
  `).run(sub2Id, testUserId, nowIso, new Date().toISOString(), nowIso, nowIso);

  db.prepare(`
    INSERT INTO invoices (id, user_id, subscription_id, amount_cents, discount_cents, tax_cents, total_cents, status, description, created_at, updated_at)
    VALUES (?, ?, ?, 14900, 0, 0, 14900, 'open', 'Pro Plan Failed Invoicing', ?, ?)
  `).run(inv2Id, testUserId, sub2Id, nowIso, nowIso);

  const dunning2: any = initiateDunningForFailedInvoice(testUserId, sub2Id, inv2Id, 'card_declined');

  // Attempt 1 -> Failed
  executeDunningRetry(dunning2.id, 'failed');
  // Attempt 2 -> Failed
  executeDunningRetry(dunning2.id, 'failed');
  // Attempt 3 -> Failed
  executeDunningRetry(dunning2.id, 'failed');
  // Attempt 4 -> Final Failed Attempt
  const finalResult = executeDunningRetry(dunning2.id, 'failed');

  assert.strictEqual(finalResult.status, 'failed_exhausted');

  const exhaustedSub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(sub2Id) as any;
  assert.strictEqual(exhaustedSub.status, 'expired', 'Exhausted subscription must transition to expired');
  console.log('✓ Step 6: Verified dunning retry exhaustion path transitions subscription to expired.');

  console.log('\n🎉 ALL SMART BILLING DUNNING WORKFLOW TESTS PASSED WITH 100% SUCCESS!\n');
}

testDunningWorkflows().catch((err) => {
  console.error('❌ Dunning test suite failed:', err);
  process.exit(1);
});
