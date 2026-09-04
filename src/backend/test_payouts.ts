import assert from 'assert';
import { db, initDb, runInTransaction } from './db';
import {
  aggregateCommissionBalances,
  generateStripeConnectBatchPayloads,
  executeBatchPayouts,
} from './routes/payouts';

async function testPayouts() {
  console.log('🧪 Starting Creator Payout Processor Integration Tests...\n');

  // 1. Initialize schema
  initDb();
  console.log('✓ Step 1: Database initialized.');

  // Clean test data
  const now = new Date().toISOString();
  const timestamp = Date.now();

  const userAId = `usr_payout_test_a_${timestamp}`;
  const userBId = `usr_payout_test_b_${timestamp}`;
  const userCId = `usr_payout_test_c_${timestamp}`;
  const userDId = `usr_payout_test_d_${timestamp}`;

  const referred1Id = `usr_ref_1_${timestamp}`;
  const referred2Id = `usr_ref_2_${timestamp}`;
  const referred3Id = `usr_ref_3_${timestamp}`;
  const referred4Id = `usr_ref_4_${timestamp}`;
  const referred5Id = `usr_ref_5_${timestamp}`;

  runInTransaction(() => {
    // Insert Creators
    // Creator A: $75.00 approved, has connect account (Eligible)
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_connect_account_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Creator A (Eligible)', 'user', ?, 'acct_test_creator_a', ?, ?)
    `).run(userAId, `creator_a_${timestamp}@test.com`, `REF-A-${timestamp}`, now, now);

    // Creator B: $30.00 approved, has connect account (Below Threshold)
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_connect_account_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Creator B (Below Threshold)', 'user', ?, 'acct_test_creator_b', ?, ?)
    `).run(userBId, `creator_b_${timestamp}@test.com`, `REF-B-${timestamp}`, now, now);

    // Creator C: $100.00 approved, missing connect account
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_connect_account_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Creator C (No Connect)', 'user', ?, NULL, ?, ?)
    `).run(userCId, `creator_c_${timestamp}@test.com`, `REF-C-${timestamp}`, now, now);

    // Creator D: $60.00 pending, has connect account
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_connect_account_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Creator D (Pending)', 'user', ?, 'acct_test_creator_d', ?, ?)
    `).run(userDId, `creator_d_${timestamp}@test.com`, `REF-D-${timestamp}`, now, now);

    // Insert Referred Users
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, 'hash', 'R1', 'user', ?, ?, ?)`).run(referred1Id, `r1_${timestamp}@test.com`, `R1-${timestamp}`, now, now);
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, 'hash', 'R2', 'user', ?, ?, ?)`).run(referred2Id, `r2_${timestamp}@test.com`, `R2-${timestamp}`, now, now);
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, 'hash', 'R3', 'user', ?, ?, ?)`).run(referred3Id, `r3_${timestamp}@test.com`, `R3-${timestamp}`, now, now);
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, 'hash', 'R4', 'user', ?, ?, ?)`).run(referred4Id, `r4_${timestamp}@test.com`, `R4-${timestamp}`, now, now);
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, 'hash', 'R5', 'user', ?, ?, ?)`).run(referred5Id, `r5_${timestamp}@test.com`, `R5-${timestamp}`, now, now);

    // Insert Bank Accounts for creators
    db.prepare(`INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, created_at, updated_at) VALUES (?, ?, 'Primary Bank', 'bank', 0, 'USD', 'Test Bank', ?, ?)`).run(`acc_${userAId}`, userAId, now, now);

    // Insert Commission Ledger Entries
    // Creator A: 2 entries ($50.00 + $25.00 = 7500 cents) -> Approved
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at) VALUES (?, ?, ?, 5000, 'USD', 'approved', 'Comm 1', ?, ?)`).run(`comm_a1_${timestamp}`, userAId, referred1Id, now, now);
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at) VALUES (?, ?, ?, 2500, 'USD', 'approved', 'Comm 2', ?, ?)`).run(`comm_a2_${timestamp}`, userAId, referred2Id, now, now);

    // Creator B: 1 entry ($30.00 = 3000 cents) -> Approved
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at) VALUES (?, ?, ?, 3000, 'USD', 'approved', 'Comm 3', ?, ?)`).run(`comm_b1_${timestamp}`, userBId, referred3Id, now, now);

    // Creator C: 1 entry ($100.00 = 10000 cents) -> Approved
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at) VALUES (?, ?, ?, 10000, 'USD', 'approved', 'Comm 4', ?, ?)`).run(`comm_c1_${timestamp}`, userCId, referred4Id, now, now);

    // Creator D: 1 entry ($60.00 = 6000 cents) -> Pending
    db.prepare(`INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at) VALUES (?, ?, ?, 6000, 'USD', 'pending', 'Comm 5', ?, ?)`).run(`comm_d1_${timestamp}`, userDId, referred5Id, now, now);
  });

  console.log('✓ Step 2: Test users and commission ledger entries created.');

  // 2. Test Aggregation with $50.00 threshold
  console.log('\n--- Test 1: Commission Aggregation & Threshold Validation ---');
  const aggResult = aggregateCommissionBalances({ minThresholdCents: 5000, statusFilter: 'approved' });

  const eligibleA = aggResult.eligible_creators.find(c => c.user_id === userAId);
  assert(eligibleA !== undefined, 'Creator A must be eligible');
  assert.strictEqual(eligibleA.total_unpaid_cents, 7500, 'Creator A total unpaid must be 7500 cents');
  assert.strictEqual(eligibleA.commission_count, 2, 'Creator A commission count must be 2');
  assert.strictEqual(eligibleA.meets_threshold, true);
  assert.strictEqual(eligibleA.has_connect_account, true);

  const missingC = aggResult.creators_missing_connect.find(c => c.user_id === userCId);
  assert(missingC !== undefined, 'Creator C must be in missing connect list');
  assert.strictEqual(missingC.total_unpaid_cents, 10000);
  assert.strictEqual(missingC.meets_threshold, true);
  assert.strictEqual(missingC.has_connect_account, false);

  const belowB = aggResult.below_threshold_creators.find(c => c.user_id === userBId);
  assert(belowB !== undefined, 'Creator B must be below threshold');
  assert.strictEqual(belowB.total_unpaid_cents, 3000);
  assert.strictEqual(belowB.meets_threshold, false);

  const pendingD = aggResult.eligible_creators.find(c => c.user_id === userDId);
  assert.strictEqual(pendingD, undefined, 'Pending commissions must not be included in approved aggregation');

  console.log('✓ Test 1 Passed: Aggregation correctly categorizes creators by threshold and Connect status.');

  // 3. Test Stripe Connect Batch Payload Generation
  console.log('\n--- Test 2: Batch Stripe Connect Payload Generation ---');
  const testBatchId = `batch_test_${timestamp}`;
  const batchResult = generateStripeConnectBatchPayloads({ minThresholdCents: 5000, batchId: testBatchId });

  assert.strictEqual(batchResult.batch_id, testBatchId);
  assert.strictEqual(batchResult.payloads.length, 1, 'Only Creator A should have a generated payload');

  const payloadA = batchResult.payloads[0];
  assert.strictEqual(payloadA.amount, 7500);
  assert.strictEqual(payloadA.destination, 'acct_test_creator_a');
  assert.strictEqual(payloadA.currency, 'usd');
  assert.strictEqual(payloadA.transfer_group, testBatchId);
  assert.strictEqual(payloadA.metadata.user_id, userAId);

  // Check DB persistence for batch and item
  const savedBatch = db.prepare('SELECT * FROM payout_batches WHERE batch_id = ?').get(testBatchId) as any;
  assert(savedBatch !== undefined, 'Batch record must be saved in database');
  assert.strictEqual(Number(savedBatch.total_amount_cents), 7500);
  assert.strictEqual(Number(savedBatch.creator_count), 1);
  assert.strictEqual(savedBatch.status, 'draft');

  const savedItems = db.prepare('SELECT * FROM payout_items WHERE batch_id = ?').all(testBatchId) as any[];
  assert.strictEqual(savedItems.length, 1);
  assert.strictEqual(savedItems[0].user_id, userAId);
  assert.strictEqual(savedItems[0].status, 'pending');

  console.log('✓ Test 2 Passed: Batch Stripe Connect payloads generated and stored in database.');

  // 4. Test Batch Payout Execution
  console.log('\n--- Test 3: Batch Payout Execution & Ledger Update ---');
  const execResult = await executeBatchPayouts(testBatchId, { mockStripe: true });

  assert.strictEqual(execResult.success, true);
  assert.strictEqual(execResult.transferred_count, 1);
  assert.strictEqual(execResult.total_transferred_cents, 7500);
  assert.strictEqual(execResult.results[0].status, 'transferred');
  assert(execResult.results[0].stripe_transfer_id?.startsWith('tr_mock_'));

  // Check commission_ledger status updated to 'paid' for Creator A
  const commA1 = db.prepare(`SELECT status FROM commission_ledger WHERE id = ?`).get(`comm_a1_${timestamp}`) as any;
  const commA2 = db.prepare(`SELECT status FROM commission_ledger WHERE id = ?`).get(`comm_a2_${timestamp}`) as any;
  assert.strictEqual(commA1.status, 'paid', 'Comm A1 status must be updated to paid');
  assert.strictEqual(commA2.status, 'paid', 'Comm A2 status must be updated to paid');

  // Check Creator B commission remains 'approved'
  const commB1 = db.prepare(`SELECT status FROM commission_ledger WHERE id = ?`).get(`comm_b1_${timestamp}`) as any;
  assert.strictEqual(commB1.status, 'approved', 'Comm B1 status must remain approved');

  // Check Creator A bank account credited
  const accountA = db.prepare('SELECT balance_cents FROM accounts WHERE user_id = ?').get(userAId) as any;
  assert.strictEqual(Number(accountA.balance_cents), 7500, 'Creator A bank account must be credited 7500 cents');

  // Check payout batch updated to completed
  const updatedBatch = db.prepare('SELECT status FROM payout_batches WHERE batch_id = ?').get(testBatchId) as any;
  assert.strictEqual(updatedBatch.status, 'completed');

  console.log('✓ Test 3 Passed: Batch payout executed, commissions marked paid, accounts credited.');

  console.log('\n🎉 ALL CREATOR PAYOUT PROCESSOR TESTS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
}

testPayouts().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
