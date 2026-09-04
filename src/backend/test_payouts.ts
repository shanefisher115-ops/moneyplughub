import assert from 'assert';
import { db, runInTransaction, initDb } from './db';
import {
  aggregateCommissionBalances,
  validateMinimumThreshold,
  generateStripeConnectBatchPayload,
  executePayoutBatch,
} from './routes/payouts';

async function runPayoutProcessorTests() {
  console.log('🧪 Testing Creator Payout Processor (src/backend/routes/payouts.ts)...');

  initDb();

  const now = new Date().toISOString();
  const timestamp = Date.now();
  const creator1Id = `usr_creator1_${timestamp}`;
  const creator2Id = `usr_creator2_${timestamp}`;
  const creator3Id = `usr_creator3_${timestamp}`;

  // 1. Seed test users
  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_connect_id, created_at, updated_at)
      VALUES (?, 'creator1_${timestamp}@test.local', 'hash', 'Creator One', 'user', 'CODE-CR1-${timestamp}', 'acct_stripe_connect_001', ?, ?)
    `).run(creator1Id, now, now);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_connect_id, created_at, updated_at)
      VALUES (?, 'creator2_${timestamp}@test.local', 'hash', 'Creator Two', 'user', 'CODE-CR2-${timestamp}', 'acct_stripe_connect_002', ?, ?)
    `).run(creator2Id, now, now);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_connect_id, created_at, updated_at)
      VALUES (?, 'creator3_${timestamp}@test.local', 'hash', 'Creator Three (No Stripe)', 'user', 'CODE-CR3-${timestamp}', NULL, ?, ?)
    `).run(creator3Id, now, now);
  });

  // Seed referred user
  const refUserId = `usr_ref_${timestamp}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
    VALUES (?, 'referred_${timestamp}@test.local', 'hash', 'Referred User', 'user', 'CODE-REF-${timestamp}', ?, ?)
  `).run(refUserId, now, now);

  // 2. Seed commission_ledger entries
  // Creator 1: 3 approved commissions of $20 (total $60 = 6000 cents -> Above $50 threshold)
  // Creator 2: 1 approved commission of $30 (total $30 = 3000 cents -> Below $50 threshold)
  // Creator 3: 1 approved commission of $80 (total $80 = 8000 cents -> Above $50, but NO Stripe Connect ID)
  const comm1 = `comm_c1_1_${timestamp}`;
  const comm2 = `comm_c1_2_${timestamp}`;
  const comm3 = `comm_c1_3_${timestamp}`;
  const comm4 = `comm_c2_1_${timestamp}`;
  const comm5 = `comm_c3_1_${timestamp}`;
  const commPending = `comm_c1_pending_${timestamp}`;

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, status, created_at, updated_at)
      VALUES (?, ?, ?, 2000, 'approved', ?, ?)
    `).run(comm1, creator1Id, refUserId, now, now);

    const ref2 = `usr_ref2_${timestamp}`;
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, 'ref2_${timestamp}@test.local', 'hash', 'Ref2', 'user', 'R2-${timestamp}', ?, ?)`).run(ref2, now, now);
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, 2000, 'approved', ?, ?)`).run(comm2, creator1Id, ref2, now, now);

    const ref3 = `usr_ref3_${timestamp}`;
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, 'ref3_${timestamp}@test.local', 'hash', 'Ref3', 'user', 'R3-${timestamp}', ?, ?)`).run(ref3, now, now);
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, 2000, 'approved', ?, ?)`).run(comm3, creator1Id, ref3, now, now);

    const ref4 = `usr_ref4_${timestamp}`;
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, 'ref4_${timestamp}@test.local', 'hash', 'Ref4', 'user', 'R4-${timestamp}', ?, ?)`).run(ref4, now, now);
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, 3000, 'approved', ?, ?)`).run(comm4, creator2Id, ref4, now, now);

    const ref5 = `usr_ref5_${timestamp}`;
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, 'ref5_${timestamp}@test.local', 'hash', 'Ref5', 'user', 'R5-${timestamp}', ?, ?)`).run(ref5, now, now);
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, 8000, 'approved', ?, ?)`).run(comm5, creator3Id, ref5, now, now);

    const ref6 = `usr_ref6_${timestamp}`;
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, 'ref6_${timestamp}@test.local', 'hash', 'Ref6', 'user', 'R6-${timestamp}', ?, ?)`).run(ref6, now, now);
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, 1000, 'pending', ?, ?)`).run(commPending, creator1Id, ref6, now, now);
  });

  // Test Step 1: Balance Aggregation
  console.log('Step 1: Testing commission_ledger balance aggregation...');
  const aggregated = aggregateCommissionBalances(5000);
  const c1Summary = aggregated.find((a) => a.referrer_user_id === creator1Id);
  const c2Summary = aggregated.find((a) => a.referrer_user_id === creator2Id);
  const c3Summary = aggregated.find((a) => a.referrer_user_id === creator3Id);

  assert.strictEqual(c1Summary?.approved_cents, 6000, 'Creator 1 should have 6000 cents ($60.00) approved');
  assert.strictEqual(c1Summary?.is_eligible, true, 'Creator 1 should be eligible for $50 threshold');
  assert.strictEqual(c2Summary?.approved_cents, 3000, 'Creator 2 should have 3000 cents ($30.00) approved');
  assert.strictEqual(c2Summary?.is_eligible, false, 'Creator 2 should NOT be eligible for $50 threshold');
  assert.strictEqual(c3Summary?.approved_cents, 8000, 'Creator 3 should have 8000 cents ($80.00) approved');
  console.log('✓ Step 1 passed: Balance aggregation accurate.');

  // Test Step 2: Minimum Threshold Validation
  console.log('Step 2: Testing minimum threshold validation...');
  const testSummaries = [c1Summary!, c2Summary!, c3Summary!];
  const { eligible, ineligible } = validateMinimumThreshold(testSummaries, 5000);
  assert(eligible.some((e) => e.referrer_user_id === creator1Id));
  assert(eligible.some((e) => e.referrer_user_id === creator3Id));
  assert(ineligible.some((e) => e.referrer_user_id === creator2Id));
  assert.strictEqual(eligible.length, 2);
  assert.strictEqual(ineligible.length, 1);
  console.log('✓ Step 2 passed: Minimum threshold validation correct.');

  // Test Step 3: Stripe Connect Batch Payload Generation
  console.log('Step 3: Testing batch Stripe Connect payload generation...');
  const batchPayload = generateStripeConnectBatchPayload(eligible, 'test_batch_group_123');
  assert.strictEqual(batchPayload.transfers.length, 1, 'Only Creator 1 has a Stripe Connect ID');
  assert.strictEqual(batchPayload.skippedNoStripeAccount.length, 1, 'Creator 3 skipped due to missing stripe_connect_id');

  const transfer = batchPayload.transfers[0];
  assert.strictEqual(transfer.amount, 6000);
  assert.strictEqual(transfer.destination, 'acct_stripe_connect_001');
  assert.strictEqual(transfer.currency, 'usd');
  assert.strictEqual(transfer.transfer_group, 'test_batch_group_123');
  assert.strictEqual(transfer.metadata.referrer_user_id, creator1Id);
  console.log('✓ Step 3 passed: Stripe Connect payload format validated.');

  // Test Step 4: Batch Execution
  console.log('Step 4: Testing batch payout execution and status updates...');
  const batchId = `pbatch_test_${timestamp}`;
  const execResult = executePayoutBatch(
    batchId,
    creator1Id,
    eligible,
    batchPayload.transfer_group,
    batchPayload.transfers
  );

  assert.strictEqual(execResult.processedCount, 1);
  assert.strictEqual(execResult.totalAmountCents, 6000);

  // Verify comm1, comm2, comm3 status is updated to 'paid'
  const comm1Row = db.prepare('SELECT status FROM commission_ledger WHERE id = ?').get(comm1) as any;
  assert.strictEqual(comm1Row.status, 'paid', 'Commission 1 should now be paid');

  const commPendingRow = db.prepare('SELECT status FROM commission_ledger WHERE id = ?').get(commPending) as any;
  assert.strictEqual(commPendingRow.status, 'pending', 'Pending commission should remain pending');

  // Verify payout_batches DB entry
  const batchRow = db.prepare('SELECT * FROM payout_batches WHERE id = ?').get(batchId) as any;
  assert.strictEqual(batchRow.status, 'completed');
  assert.strictEqual(batchRow.transfer_group, 'test_batch_group_123');

  console.log('✓ Step 4 passed: Batch execution, ledger transition, and transaction logging verified.');
  console.log('\n🎉 ALL CREATOR PAYOUT PROCESSOR TESTS PASSED 100%!');
}

runPayoutProcessorTests().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
