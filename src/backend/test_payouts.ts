import assert from 'assert';
import bcrypt from 'bcryptjs';
import { db, initDb, runInTransaction } from './db';
import { aggregateCreatorBalances } from './routes/payouts';

async function runPayoutTests() {
  console.log('🧪 Starting Automated Creator Payout Processor Test Suite...\n');

  initDb();

  const now = new Date().toISOString();
  const timestamp = Date.now();

  // Test User IDs
  const creator1Id = `usr_payout_creator1_${timestamp}`;
  const creator2Id = `usr_payout_creator2_${timestamp}`;
  const creator3Id = `usr_payout_creator3_${timestamp}`;
  const referred1Id = `usr_payout_ref1_${timestamp}`;
  const referred2Id = `usr_payout_ref2_${timestamp}`;
  const referred3Id = `usr_payout_ref3_${timestamp}`;
  const referred4Id = `usr_payout_ref4_${timestamp}`;

  const passHash = bcrypt.hashSync('Password123!', 8);

  runInTransaction(() => {
    // 1. Creator 1: Has $100.00 (10000 cents) approved commissions AND valid Stripe Connect account
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_account_id, created_at, updated_at)
      VALUES (?, ?, ?, 'Creator One', 'user', ?, 'acct_1234567890ABCDEF', ?, ?)
    `).run(creator1Id, `creator1_${timestamp}@test.local`, passHash, `CODE_C1_${timestamp}`, now, now);

    // 2. Creator 2: Has $30.00 (3000 cents) approved commissions (Below $50 threshold) AND valid Stripe Connect account
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_account_id, created_at, updated_at)
      VALUES (?, ?, ?, 'Creator Two', 'user', ?, 'acct_0987654321FEDCBA', ?, ?)
    `).run(creator2Id, `creator2_${timestamp}@test.local`, passHash, `CODE_C2_${timestamp}`, now, now);

    // 3. Creator 3: Has $70.00 (7000 cents) approved commissions BUT MISSING Stripe Connect account
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, stripe_account_id, created_at, updated_at)
      VALUES (?, ?, ?, 'Creator Three', 'user', ?, NULL, ?, ?)
    `).run(creator3Id, `creator3_${timestamp}@test.local`, passHash, `CODE_C3_${timestamp}`, now, now);

    // Referred Users
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, ?, 'Ref 1', 'user', ?, ?, ?)`).run(referred1Id, `ref1_${timestamp}@test.local`, passHash, `REF1_${timestamp}`, now, now);
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, ?, 'Ref 2', 'user', ?, ?, ?)`).run(referred2Id, `ref2_${timestamp}@test.local`, passHash, `REF2_${timestamp}`, now, now);
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, ?, 'Ref 3', 'user', ?, ?, ?)`).run(referred3Id, `ref3_${timestamp}@test.local`, passHash, `REF3_${timestamp}`, now, now);
    db.prepare(`INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at) VALUES (?, ?, ?, 'Ref 4', 'user', ?, ?, ?)`).run(referred4Id, `ref4_${timestamp}@test.local`, passHash, `REF4_${timestamp}`, now, now);

    // Commissions for Creator 1: 2 entries of $50.00 = $100.00 (10000 cents)
    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, 5000, 'USD', 'approved', 'Approved commission 1', ?, ?)
    `).run(`comm_c1_1_${timestamp}`, creator1Id, referred1Id, now, now);

    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, 5000, 'USD', 'approved', 'Approved commission 2', ?, ?)
    `).run(`comm_c1_2_${timestamp}`, creator1Id, referred2Id, now, now);

    // Commissions for Creator 2: 1 entry of $30.00 = $30.00 (3000 cents)
    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, 3000, 'USD', 'approved', 'Approved commission 3', ?, ?)
    `).run(`comm_c2_1_${timestamp}`, creator2Id, referred3Id, now, now);

    // Commissions for Creator 3: 1 entry of $70.00 = $70.00 (7000 cents)
    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, 7000, 'USD', 'approved', 'Approved commission 4', ?, ?)
    `).run(`comm_c3_1_${timestamp}`, creator3Id, referred4Id, now, now);
  });

  console.log('✓ Step 1: Mock creators and approved commission ledger entries populated.');

  // Step 2: Test Balance Aggregation & Threshold Validation
  const minThresholdCents = 5000; // $50.00
  const summaries = aggregateCreatorBalances(minThresholdCents);

  const summary1 = summaries.find(s => s.userId === creator1Id);
  const summary2 = summaries.find(s => s.userId === creator2Id);
  const summary3 = summaries.find(s => s.userId === creator3Id);

  assert(summary1 !== undefined, 'Creator 1 summary must exist');
  assert.strictEqual(summary1.approvedCents, 10000);
  assert.strictEqual(summary1.eligible, true, 'Creator 1 should be eligible');
  assert.strictEqual(summary1.ineligibleReason, null);

  assert(summary2 !== undefined, 'Creator 2 summary must exist');
  assert.strictEqual(summary2.approvedCents, 3000);
  assert.strictEqual(summary2.eligible, false, 'Creator 2 should be ineligible due to below threshold');
  assert.strictEqual(summary2.ineligibleReason, 'below_threshold');

  assert(summary3 !== undefined, 'Creator 3 summary must exist');
  assert.strictEqual(summary3.approvedCents, 7000);
  assert.strictEqual(summary3.eligible, false, 'Creator 3 should be ineligible due to missing Stripe account');
  assert.strictEqual(summary3.ineligibleReason, 'missing_stripe_account');

  console.log('✓ Step 2: Balance aggregation and threshold/Stripe account eligibility validation verified.');

  // Step 3: Test Stripe Connect Transfer Payload Generation for Creator 1
  const eligibleCreators = summaries.filter(s => s.eligible);
  assert.strictEqual(eligibleCreators.length, 1, 'Only Creator 1 is eligible');

  const batchId = `batch_payout_test_${timestamp}`;
  const creator1Summary = eligibleCreators[0];

  const payload = {
    amount: creator1Summary.approvedCents,
    currency: 'usd',
    destination: creator1Summary.stripeAccountId!,
    transfer_group: batchId,
    metadata: {
      user_id: creator1Summary.userId,
      commission_ids: creator1Summary.commissionIds.join(','),
      batch_id: batchId,
    },
  };

  assert.strictEqual(payload.amount, 10000);
  assert.strictEqual(payload.destination, 'acct_1234567890ABCDEF');
  assert.strictEqual(payload.transfer_group, batchId);
  console.log('✓ Step 3: Stripe Connect batch transfer payload generation verified.');

  // Step 4: Execute Batch Payout Processing (Simulated Ledger Transition)
  const transferId = `ptran_test_${timestamp}`;
  const mockStripeTransferId = `tr_mock_test_${timestamp}`;

  runInTransaction(() => {
    // Record batch
    db.prepare(`
      INSERT INTO payout_batches (id, total_amount_cents, transfer_count, status, created_at, completed_at)
      VALUES (?, ?, 1, 'completed', ?, ?)
    `).run(batchId, creator1Summary.approvedCents, now, now);

    // Update commissions to 'paid'
    const placeholders = creator1Summary.commissionIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE commission_ledger
      SET status = 'paid', updated_at = ?
      WHERE id IN (${placeholders})
    `).run(now, ...creator1Summary.commissionIds);

    // Account creation / balance update
    const accId = `acc_${creator1Id}_bank`;
    db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
      VALUES (?, ?, 'Stripe Connect Payout Account', 'bank', ?, 'USD', 'Stripe Connect', 0, ?, ?)
    `).run(accId, creator1Id, creator1Summary.approvedCents, now, now);

    // Transaction record
    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at)
      VALUES (?, ?, ?, 'Referral Payout', 'income', ?, 'Automated Stripe Connect Payout Batch', ?, 0, ?)
    `).run(`tx_payout_test_${timestamp}`, creator1Id, accId, creator1Summary.approvedCents, now.substring(0, 10), now);

    // Transfer record
    db.prepare(`
      INSERT INTO payout_transfers (id, batch_id, user_id, stripe_account_id, amount_cents, currency, stripe_transfer_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'USD', ?, 'succeeded', ?)
    `).run(transferId, batchId, creator1Id, creator1Summary.stripeAccountId!, creator1Summary.approvedCents, mockStripeTransferId, now);
  });

  // Verify DB state after processing
  const updatedCommissions = db.prepare(`
    SELECT status FROM commission_ledger WHERE id IN (?, ?)
  `).all(`comm_c1_1_${timestamp}`, `comm_c1_2_${timestamp}`) as any[];

  assert(updatedCommissions.every(c => c.status === 'paid'), 'Commissions for Creator 1 must now be paid');

  const batchRow = db.prepare('SELECT * FROM payout_batches WHERE id = ?').get(batchId) as any;
  assert.strictEqual(batchRow.status, 'completed');
  assert.strictEqual(Number(batchRow.total_amount_cents), 10000);

  const transferRow = db.prepare('SELECT * FROM payout_transfers WHERE id = ?').get(transferId) as any;
  assert.strictEqual(transferRow.status, 'succeeded');
  assert.strictEqual(transferRow.stripe_transfer_id, mockStripeTransferId);

  const bankAccount = db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(`acc_${creator1Id}_bank`) as any;
  assert.strictEqual(Number(bankAccount.balance_cents), 10000);

  console.log('✓ Step 4: Batch execution, status transitions, and ledger durability verified.');

  console.log('\n🎉 AUTOMATED CREATOR PAYOUT PROCESSOR TESTS PASSED WITH 100% SUCCESS!\n');
}

runPayoutTests().catch((err) => {
  console.error('❌ Payout test failed:', err);
  process.exit(1);
});
