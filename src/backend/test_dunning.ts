import assert from 'assert';
import bcrypt from 'bcryptjs';
import { db, initDb, runInTransaction } from './db';
import { seed } from './seed';
import { DunningEngine } from './engine/dunningEngine';

async function runDunningTests() {
  console.log('🧪 Starting Smart Billing Dunning Workflows Integration Test Suite...\n');

  // 1. Initialize schema & seed
  initDb();
  seed();
  console.log('✓ Step 1: Database initialized.');

  // 2. Setup mock test user, active subscription, and unpaid invoice
  const userId = `usr_dunning_test_${Date.now()}`;
  const subId = `sub_dunning_test_${Date.now()}`;
  const invoiceId = `inv_dunning_test_${Date.now()}`;
  const now = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  runInTransaction(() => {
    const refCode = `REF-DUNNING-${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES (?, ?, ?, 'Dunning Tester', 'user', ?, ?, ?)
    `).run(userId, `${userId}@test.local`, bcrypt.hashSync('Password123!', 8), refCode, now, now);

    db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, 'plan_creator', 'active', 'monthly', ?, ?, ?, ?)
    `).run(subId, userId, now, periodEnd, now, now);

    db.prepare(`
      INSERT INTO invoices (id, user_id, subscription_id, amount_cents, discount_cents, tax_cents, total_cents, currency, status, description, created_at, updated_at)
      VALUES (?, ?, ?, 2900, 0, 0, 2900, 'USD', 'open', 'Monthly Creator Subscription Renewal', ?, ?)
    `).run(invoiceId, userId, subId, now, now);
  });

  console.log('✓ Step 2: Created test user, subscription, and open invoice.');

  // 3. Trigger initial credit card payment failure -> Dunning workflow creation
  const dunningEvent = DunningEngine.handlePaymentFailure(
    subId,
    invoiceId,
    userId,
    'Card declined: Insufficient funds'
  );

  assert(dunningEvent !== null, 'Dunning event must be created');
  assert.strictEqual(dunningEvent.status, 'retrying');
  assert.strictEqual(dunningEvent.attempt_count, 0);
  assert.strictEqual(dunningEvent.max_attempts, 4);
  assert(dunningEvent.next_retry_at !== null, 'Next retry must be scheduled');

  // Verify subscription status updated to past_due
  const updatedSub: any = db.prepare('SELECT status FROM subscriptions WHERE id = ?').get(subId);
  assert.strictEqual(updatedSub.status, 'past_due', 'Subscription status must be past_due');

  console.log('✓ Step 3: Payment failure handled properly -> Dunning workflow & grace period initiated.');

  // 4. Verify targeted discount offer dispatch (email/sms/in-app)
  const offers = db.prepare('SELECT * FROM dunning_offers WHERE dunning_event_id = ?').all(dunningEvent.id) as any[];
  assert(offers.length > 0, 'Targeted discount offer must be created and sent');
  const primaryOffer = offers[0];
  assert.strictEqual(primaryOffer.discount_percent, 20.0);
  assert.strictEqual(primaryOffer.status, 'sent');

  console.log(`✓ Step 4: Targeted discount retention offer dispatched (${primaryOffer.discount_percent}% off code: ${primaryOffer.offer_code}).`);

  // 5. Test User Dunning Status retrieval API helper
  const userStatus = DunningEngine.getDunningStatusForUser(userId);
  assert.strictEqual(userStatus.hasActiveDunning, true);
  assert.strictEqual(userStatus.dunningEvent.id, dunningEvent.id);
  assert.strictEqual(userStatus.offers.length, 1);
  assert(userStatus.logs.length >= 2, 'Must log payment failure and offer dispatch');

  console.log('✓ Step 5: User dunning status & active offer payload verified.');

  // 6. Test Retention Offer Acceptance
  const acceptResult = DunningEngine.acceptRetentionOffer(primaryOffer.id, userId);
  assert.strictEqual(acceptResult.success, true);

  const updatedOffer: any = db.prepare('SELECT status FROM dunning_offers WHERE id = ?').get(primaryOffer.id);
  assert.strictEqual(updatedOffer.status, 'accepted');

  console.log('✓ Step 6: Churn retention offer successfully accepted & applied.');

  // 7. Test Retry Payment Failure & Attempt Increment
  const failedRetryRes = DunningEngine.retryInvoicePayment(dunningEvent.id, false);
  assert.strictEqual(failedRetryRes.success, false);
  assert.strictEqual(failedRetryRes.recovered, false);

  const updatedDunning1: any = db.prepare('SELECT attempt_count FROM dunning_events WHERE id = ?').get(dunningEvent.id);
  assert.strictEqual(updatedDunning1.attempt_count, 1);

  console.log('✓ Step 7: Retry payment failure handled (Attempt count incremented to 1).');

  // 8. Test Successful Retry Payment & Subscription Recovery
  const successRetryRes = DunningEngine.retryInvoicePayment(dunningEvent.id, true);
  assert.strictEqual(successRetryRes.success, true);
  assert.strictEqual(successRetryRes.recovered, true);

  const recoveredDunning: any = db.prepare('SELECT status FROM dunning_events WHERE id = ?').get(dunningEvent.id);
  assert.strictEqual(recoveredDunning.status, 'recovered');

  const recoveredSub: any = db.prepare('SELECT status FROM subscriptions WHERE id = ?').get(subId);
  assert.strictEqual(recoveredSub.status, 'active');

  const paidInvoice: any = db.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId);
  assert.strictEqual(paidInvoice.status, 'paid');

  console.log('✓ Step 8: Successful retry payment -> Subscription fully recovered & invoice marked paid.');

  // 9. Verify Admin Dunning Metrics
  const adminMetrics = DunningEngine.getDunningMetrics();
  assert(adminMetrics.totalEvents >= 1);
  assert(adminMetrics.offersSent >= 1);
  assert(adminMetrics.offersAccepted >= 1);

  console.log('✓ Step 9: Admin Dunning metrics verified:', {
    totalEvents: adminMetrics.totalEvents,
    recoveryRate: adminMetrics.recoveryRatePct,
    offerConversionRate: adminMetrics.offerConversionPct,
  });

  console.log('\n🎉 ALL SMART BILLING DUNNING WORKFLOW INTEGRATION TESTS PASSED WITH 100% SUCCESS!\n');
}

runDunningTests().catch((err) => {
  console.error('❌ Dunning integration test failed:', err);
  process.exit(1);
});
