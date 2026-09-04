import assert from 'assert';
import bcrypt from 'bcryptjs';
import { db, initDb, runInTransaction } from './db';
import {
  aggregateCreatorBalances,
  generateBatchStripeTransferPayloads,
  processBatchPayout,
  DEFAULT_MIN_PAYOUT_THRESHOLD_CENTS,
  getCreatorStripeAccountId,
} from './routes/payouts';

export async function runPayoutsTests() {
  console.log('🧪 Starting Creator Payout Processor Test Suite...\n');

  initDb();

  const now = new Date().toISOString();
  const testRunId = Date.now().toString().substring(6);

  // Define test users
  const creatorAId = `test_creator_a_${testRunId}`;
  const creatorBId = `test_creator_b_${testRunId}`;
  const creatorCId = `test_creator_c_${testRunId}`;

  const referred1Id = `test_ref_1_${testRunId}`;
  const referred2Id = `test_ref_2_${testRunId}`;
  const referred3Id = `test_ref_3_${testRunId}`;
  const referred4Id = `test_ref_4_${testRunId}`;
  const referred5Id = `test_ref_5_${testRunId}`;

  runInTransaction(() => {
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'user', ?, NULL, 0, 0, 1, 1, 'Novice Plug', ?, ?)
    `);

    const pwd = bcrypt.hashSync('Password123!', 8);

    insertUser.run(creatorAId, `creatorA_${testRunId}@test.local`, pwd, 'Creator Alpha (Eligible)', `REFA${testRunId}`, now, now);
    insertUser.run(creatorBId, `creatorB_${testRunId}@test.local`, pwd, 'Creator Beta (Under Threshold)', `REFB${testRunId}`, now, now);
    insertUser.run(creatorCId, `creatorC_${testRunId}@test.local`, pwd, 'Creator Gamma (Pending Only)', `REFC${testRunId}`, now, now);

    insertUser.run(referred1Id, `ref1_${testRunId}@test.local`, pwd, 'Referred User 1', `REF1${testRunId}`, now, now);
    insertUser.run(referred2Id, `ref2_${testRunId}@test.local`, pwd, 'Referred User 2', `REF2${testRunId}`, now, now);
    insertUser.run(referred3Id, `ref3_${testRunId}@test.local`, pwd, 'Referred User 3', `REF3${testRunId}`, now, now);
    insertUser.run(referred4Id, `ref4_${testRunId}@test.local`, pwd, 'Referred User 4', `REF4${testRunId}`, now, now);
    insertUser.run(referred5Id, `ref5_${testRunId}@test.local`, pwd, 'Referred User 5', `REF5${testRunId}`, now, now);

    // Insert commission ledger records:
    // Creator A: $35.00 approved + $25.00 approved = $60.00 (6000 cents >= 5000 threshold)
    // Creator B: $30.00 approved = $30.00 (3000 cents < 5000 threshold)
    // Creator C: $100.00 pending = $0 approved (0 cents < 5000 threshold)
    const insertComm = db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'USD', ?, 'Test commission entry', ?, ?)
    `);

    insertComm.run(`comm_${testRunId}_a1`, creatorAId, referred1Id, 3500, 'approved', now, now);
    insertComm.run(`comm_${testRunId}_a2`, creatorAId, referred2Id, 2500, 'approved', now, now);
    insertComm.run(`comm_${testRunId}_b1`, creatorBId, referred3Id, 3000, 'approved', now, now);
    insertComm.run(`comm_${testRunId}_c1`, creatorCId, referred4Id, 10000, 'pending', now, now);
  });

  console.log('✓ Step 1: Seeded test creators and commission ledger records.');

  // 1. Test aggregateCreatorBalances
  const summariesA = aggregateCreatorBalances({ userId: creatorAId, minThresholdCents: 5000 });
  assert.strictEqual(summariesA.length, 1, 'Should find Creator A summary');
  const summaryA = summariesA[0];
  assert.strictEqual(summaryA.approvedCents, 6000, 'Creator A approved cents should be 6000 ($60.00)');
  assert.strictEqual(summaryA.isEligibleForPayout, true, 'Creator A should be eligible for payout');
  assert.strictEqual(summaryA.shortfallCents, 0, 'Shortfall should be 0');

  const summariesB = aggregateCreatorBalances({ userId: creatorBId, minThresholdCents: 5000 });
  assert.strictEqual(summariesB.length, 1, 'Should find Creator B summary');
  const summaryB = summariesB[0];
  assert.strictEqual(summaryB.approvedCents, 3000, 'Creator B approved cents should be 3000 ($30.00)');
  assert.strictEqual(summaryB.isEligibleForPayout, false, 'Creator B should NOT be eligible for payout');
  assert.strictEqual(summaryB.shortfallCents, 2000, 'Creator B shortfall should be 2000 cents ($20.00)');

  console.log('✓ Step 2: aggregateCreatorBalances verified with threshold validation logic.');

  // 2. Test generateBatchStripeTransferPayloads
  const batchPayload = generateBatchStripeTransferPayloads({
    minThresholdCents: 5000,
    creatorUserIds: [creatorAId, creatorBId, creatorCId],
    statusFilter: 'approved',
  });

  assert(batchPayload.batchId.startsWith('payout_batch_'), 'Batch ID format check');
  assert.strictEqual(batchPayload.totalCreatorsEligible, 1, 'Exactly 1 creator should be eligible');
  assert.strictEqual(batchPayload.totalPayoutCents, 6000, 'Total payout cents should equal 6000');

  const transferItem = batchPayload.transfers[0];
  assert.strictEqual(transferItem.creator.userId, creatorAId);
  assert.strictEqual(transferItem.amountCents, 6000);
  assert.strictEqual(transferItem.commissionIds.length, 2);

  // Verify Stripe payload structure
  const stripePayload = transferItem.stripePayload;
  assert.strictEqual(stripePayload.amount, 6000, 'Stripe payload amount must be 6000 cents integer');
  assert.strictEqual(stripePayload.currency, 'usd');
  assert.strictEqual(stripePayload.transfer_group, batchPayload.batchId);
  assert(stripePayload.destination.startsWith('acct_'), 'Destination must be a Stripe Connect account ID');
  assert.strictEqual(stripePayload.metadata.referrer_user_id, creatorAId);
  assert.strictEqual(stripePayload.metadata.batch_id, batchPayload.batchId);

  // Verify ineligible list includes Creator B
  assert(
    batchPayload.ineligibleCreators.some((c) => c.userId === creatorBId && c.shortfallCents === 2000),
    'Creator B should be listed under ineligibleCreators with shortfall of 2000 cents'
  );

  console.log('✓ Step 3: generateBatchStripeTransferPayloads verified with complete Stripe Connect payloads.');

  // 3. Test processBatchPayout
  const executionResult = await processBatchPayout(batchPayload, { executeRealStripe: false });

  if (executionResult.failedPayouts.length > 0) {
    console.error('Failed payouts debug:', executionResult.failedPayouts);
  }

  assert.strictEqual(executionResult.totalProcessed, 1);
  assert.strictEqual(executionResult.totalSuccessCents, 6000);
  assert.strictEqual(executionResult.totalFailed, 0);

  const successItem = executionResult.successfulPayouts[0];
  assert.strictEqual(successItem.userId, creatorAId);
  assert.strictEqual(successItem.amountCents, 6000);
  assert.strictEqual(successItem.commissionsPaidCount, 2);
  assert(successItem.stripeTransferId.startsWith('tr_'), 'Stripe transfer ID returned');

  // Verify commission ledger entries updated from 'approved' to 'paid'
  const updatedComms = db.prepare(`
    SELECT id, status FROM commission_ledger WHERE referrer_user_id = ?
  `).all(creatorAId) as any[];

  assert.strictEqual(updatedComms.length, 2);
  assert(updatedComms.every((c) => c.status === 'paid'), 'All Creator A commission ledger entries should now be status paid');

  // Verify transaction record was created
  const txRows = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? AND category = 'Creator Payout'
  `).all(creatorAId) as any[];

  assert.strictEqual(txRows.length, 1);
  assert.strictEqual(txRows[0].amount_cents, 6000);

  // Verify audit log record
  const auditRows = db.prepare(`
    SELECT * FROM audit_logs WHERE action = 'BATCH_CREATOR_PAYOUT' AND target_id = ?
  `).all(batchPayload.batchId) as any[];

  assert.strictEqual(auditRows.length, 1);

  console.log('✓ Step 4: processBatchPayout verified with database updates, transactions, and audit logs.');

  console.log('\n🎉 ALL CREATOR PAYOUT PROCESSOR TESTS PASSED WITH 100% SUCCESS!\n');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('test_payouts.ts')) {
  runPayoutsTests().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}
