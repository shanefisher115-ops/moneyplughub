import { db, runInTransaction, initDb } from '../../src/backend/db';
import crypto from 'crypto';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`  ✓ ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ name, passed: false, durationMs, error: err.message, details: err.stack });
    console.error(`  ✗ ${name} (${durationMs}ms): ${err.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function assertEquals(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${msg} (expected ${expected}, got ${actual})`);
  }
}

export async function runMilestone1BackendStressSuite() {
  console.log('\n============================================================');
  console.log('  CHALLENGER 2: BACKEND SQL & DURABILITY EMPIRICAL STRESS TEST');
  console.log('============================================================\n');

  // Initialize DB
  initDb();

  // Test 1: SQLite PRAGMA configuration verification
  await runTest('1. SQLite Durability & Concurrency PRAGMAs', () => {
    const journalMode = (db.prepare('PRAGMA journal_mode;').get() as any)?.journal_mode;
    const foreignKeys = (db.prepare('PRAGMA foreign_keys;').get() as any)?.foreign_keys;
    const busyTimeout = (db.prepare('PRAGMA busy_timeout;').get() as any)?.timeout;
    const synchronous = (db.prepare('PRAGMA synchronous;').get() as any)?.synchronous;

    assertEquals(journalMode.toLowerCase(), 'wal', 'Journal mode must be WAL');
    assertEquals(foreignKeys, 1, 'Foreign keys must be ON');
    assert(busyTimeout >= 5000, `Busy timeout must be >= 5000ms (got ${busyTimeout})`);
    assert(synchronous !== undefined, 'Synchronous mode must be set');
  });

  // Test 2: Commission Ledger Schema & Aggregation Queries in moneyos.ts
  await runTest('2. Commission Ledger Aggregations & Edge Cases', () => {
    const testUserId = `user_test_comm_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Create user
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Test Commission User', ?, ?, ?)
    `).run(testUserId, `${testUserId}@example.com`, `REF_${crypto.randomUUID()}`, now, now);

    // Empty ledger test
    const emptyCount = (db.prepare('SELECT COUNT(*) as count FROM commission_ledger WHERE referrer_user_id = ?').get(testUserId) as any)?.count;
    const emptyTotal = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE referrer_user_id = ?').get(testUserId) as any)?.total;
    assertEquals(emptyCount, 0, 'Empty ledger count must be 0');
    assertEquals(emptyTotal, 0, 'Empty ledger total must be 0');

    // Insert 10 referred users and commission rows
    let expectedTotalCents = 0;
    const amounts = [1500, 3000, 2500, 5000, 10000, 4500, 2000, 3500, 6000, 12500]; // Total: 50500 cents ($505.00)

    amounts.forEach((amt, idx) => {
      const refUserId = `user_ref_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, referral_code, referrer_user_id, created_at, updated_at)
        VALUES (?, ?, 'hash', ?, ?, ?, ?, ?)
      `).run(refUserId, `${refUserId}@example.com`, `Ref ${idx}`, `REF_${crypto.randomUUID()}`, testUserId, now, now);

      db.prepare(`
        INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'USD', ?, ?, ?)
      `).run(`comm_${crypto.randomUUID()}`, testUserId, refUserId, amt, idx % 2 === 0 ? 'approved' : 'pending', now, now);

      expectedTotalCents += amt;
    });

    const populatedCount = (db.prepare('SELECT COUNT(*) as count FROM commission_ledger WHERE referrer_user_id = ?').get(testUserId) as any)?.count;
    const populatedTotal = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE referrer_user_id = ?').get(testUserId) as any)?.total;
    assertEquals(populatedCount, 10, 'Populated ledger count must be 10');
    assertEquals(populatedTotal, expectedTotalCents, `Populated ledger total must be ${expectedTotalCents} (got ${populatedTotal})`);

    // Verify USD conversion precision
    const totalUsd = (populatedTotal / 100).toFixed(2);
    assertEquals(totalUsd, '505.00', 'USD string conversion must be exact 505.00');

    // Check check-constraint enforcement: amount_cents > 0
    let constraintViolated = false;
    try {
      db.prepare(`
        INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'USD', 'pending', ?, ?)
      `).run(`comm_invalid_${crypto.randomUUID()}`, testUserId, testUserId, 0, now, now);
    } catch (e: any) {
      constraintViolated = true;
    }
    assert(constraintViolated, 'Inserting amount_cents <= 0 into commission_ledger must throw CHECK constraint violation');
  });

  // Test 3: Foreign Key Constraints & Cascade/Restrict Behaviors
  await runTest('3. Foreign Key Integrity & RESTRICT / CASCADE Safety', () => {
    const parentUserId = `user_fk_parent_${crypto.randomUUID()}`;
    const childUserId = `user_fk_child_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'FK Parent', ?, ?, ?)
    `).run(parentUserId, `${parentUserId}@example.com`, `REF_${crypto.randomUUID()}`, now, now);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, referrer_user_id, created_at, updated_at)
      VALUES (?, ?, 'hash', 'FK Child', ?, ?, ?, ?)
    `).run(childUserId, `${childUserId}@example.com`, `REF_${crypto.randomUUID()}`, parentUserId, now, now);

    // Create Account and Transaction for child (CASCADE)
    const accId = `acc_fk_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, balance_cents, created_at, updated_at)
      VALUES (?, ?, 'FK Account', 'bank', 50000, ?, ?)
    `).run(accId, childUserId, now, now);

    const txId = `tx_fk_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
      VALUES (?, ?, ?, 'General', 'expense', 1500, 'Test Tx', '2026-08-26', ?)
    `).run(txId, childUserId, accId, now);

    // Create commission ledger entry between parent and child (RESTRICT)
    const commId = `comm_fk_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, created_at, updated_at)
      VALUES (?, ?, ?, 3000, 'USD', 'approved', ?, ?)
    `).run(commId, parentUserId, childUserId, now, now);

    // Trying to delete parent user directly should FAIL with RESTRICT due to commission_ledger
    let parentDeleteFailed = false;
    try {
      db.prepare('DELETE FROM users WHERE id = ?').run(parentUserId);
    } catch (e: any) {
      parentDeleteFailed = true;
    }
    assert(parentDeleteFailed, 'Deleting referrer with active commission_ledger must be RESTRICTED by foreign key');

    // Clean up commission entry
    db.prepare('DELETE FROM commission_ledger WHERE id = ?').run(commId);

    // Now deleting child user should CASCADE delete account and transaction
    db.prepare('DELETE FROM users WHERE id = ?').run(childUserId);

    const remainingAcc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accId);
    const remainingTx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(txId);
    assertEquals(remainingAcc, undefined, 'Account must be CASCADE deleted when user is deleted');
    assertEquals(remainingTx, undefined, 'Transaction must be CASCADE deleted when user is deleted');
  });

  // Test 4: ACID Atomic Transactions and Rollback Protection
  await runTest('4. ACID runInTransaction() Atomicity & Rollback Correctness', () => {
    const txUserId = `user_acid_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'ACID User', ?, ?, ?)
    `).run(txUserId, `${txUserId}@example.com`, `REF_${crypto.randomUUID()}`, now, now);

    const acc1 = `acc_acid_1_${crypto.randomUUID()}`;
    const acc2 = `acc_acid_2_${crypto.randomUUID()}`;

    db.prepare('INSERT INTO accounts (id, user_id, name, type, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(acc1, txUserId, 'Checking', 'bank', 100000, now, now);
    db.prepare('INSERT INTO accounts (id, user_id, name, type, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(acc2, txUserId, 'Savings', 'bank', 50000, now, now);

    // Successful transfer inside runInTransaction
    runInTransaction(() => {
      db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(20000, acc1);
      db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(20000, acc2);
      db.prepare(`
        INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
        VALUES (?, ?, ?, 'Transfer', 'transfer', 20000, 'Test Transfer', '2026-08-26', ?)
      `).run(`tx_succ_${crypto.randomUUID()}`, txUserId, acc2, now);
    });

    const bal1 = (db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(acc1) as any).balance_cents;
    const bal2 = (db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(acc2) as any).balance_cents;
    assertEquals(bal1, 80000, 'Checking balance after successful transfer must be 80000');
    assertEquals(bal2, 70000, 'Savings balance after successful transfer must be 70000');

    // Failing transfer that triggers rollback
    let rollbackCaught = false;
    try {
      runInTransaction(() => {
        // Step 1: deduct from acc1
        db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(30000, acc1);
        // Step 2: attempt invalid insert (violating non-null or foreign key)
        db.prepare(`
          INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
          VALUES (?, ?, 'non_existent_account', 'Transfer', 'transfer', 30000, 'Broken Tx', '2026-08-26', ?)
        `).run(`tx_fail_${crypto.randomUUID()}`, txUserId, now);
      });
    } catch (err) {
      rollbackCaught = true;
    }

    assert(rollbackCaught, 'Transaction failure must throw and rollback');

    // Balances must remain unchanged (80000 and 70000)
    const bal1AfterRollback = (db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(acc1) as any).balance_cents;
    const bal2AfterRollback = (db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(acc2) as any).balance_cents;
    assertEquals(bal1AfterRollback, 80000, 'Checking balance must rollback to 80000');
    assertEquals(bal2AfterRollback, 70000, 'Savings balance must rollback to 70000');
  });

  // Test 5: High-Volume Ledger Stress & Aggregation Scalability
  await runTest('5. High-Volume Ledger Stress (1,000 Commission Entries)', () => {
    const stressUserId = `user_stress_1000_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Stress User', ?, ?, ?)
    `).run(stressUserId, `${stressUserId}@example.com`, `REF_${crypto.randomUUID()}`, now, now);

    const insertUserStmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, referrer_user_id, created_at, updated_at)
      VALUES (?, ?, 'hash', ?, ?, ?, ?, ?)
    `);

    const insertCommStmt = db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'USD', 'approved', ?, ?)
    `);

    const NUM_ROWS = 1000;
    const AMT_PER_ROW = 1500; // $15.00 each
    const EXPECTED_TOTAL = NUM_ROWS * AMT_PER_ROW; // 1,500,000 cents ($15,000.00)

    // Execute bulk write inside single atomic transaction for maximum speed & durability
    runInTransaction(() => {
      for (let i = 0; i < NUM_ROWS; i++) {
        const refId = `user_s_${crypto.randomUUID()}`;
        insertUserStmt.run(refId, `${refId}@example.com`, `User ${i}`, `REF_${crypto.randomUUID()}`, stressUserId, now, now);
        insertCommStmt.run(`comm_s_${crypto.randomUUID()}`, stressUserId, refId, AMT_PER_ROW, now, now);
      }
    });

    const count = (db.prepare('SELECT COUNT(*) as count FROM commission_ledger WHERE referrer_user_id = ?').get(stressUserId) as any)?.count;
    const sumCents = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE referrer_user_id = ?').get(stressUserId) as any)?.total;

    assertEquals(count, NUM_ROWS, `Commission count must equal ${NUM_ROWS}`);
    assertEquals(sumCents, EXPECTED_TOTAL, `Commission sum must equal ${EXPECTED_TOTAL}`);
  });

  // Test 6: MoneyOS Financial Commands Simulation & State Durability
  await runTest('6. MoneyOS Financial Command Invariant Verification', () => {
    const osUserId = `user_os_cmd_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'MoneyOS Cmd User', ?, ?, ?)
    `).run(osUserId, `${osUserId}@example.com`, `REF_${crypto.randomUUID()}`, now, now);

    const bankAcc = `acc_cmd_bank_${crypto.randomUUID()}`;
    const debtId = `debt_cmd_${crypto.randomUUID()}`;

    db.prepare('INSERT INTO accounts (id, user_id, name, type, balance_cents, is_liability, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
      .run(bankAcc, osUserId, 'Primary Checking', 'bank', 250000, now, now); // $2,500.00

    db.prepare('INSERT INTO debts (id, user_id, name, total_balance_cents, minimum_payment_cents, interest_rate, due_date, strategy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(debtId, osUserId, 'Chase Sapphire Card', 150000, 4500, 24.99, '2026-09-01', 'avalanche', now, now); // $1,500.00

    // Simulate Pay Debt command ($300.00 payment)
    const paymentCents = 30000;
    runInTransaction(() => {
      db.prepare('UPDATE accounts SET balance_cents = balance_cents - ?, updated_at = ? WHERE id = ?')
        .run(paymentCents, now, bankAcc);
      db.prepare('UPDATE debts SET total_balance_cents = MAX(0, total_balance_cents - ?), updated_at = ? WHERE id = ?')
        .run(paymentCents, now, debtId);
      db.prepare(`
        INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at)
        VALUES (?, ?, ?, 'Debt Payment', 'debt_payment', ?, 'MoneyOS Debt Payment', '2026-08-26', 0, ?)
      `).run(`tx_cmd_${crypto.randomUUID()}`, osUserId, bankAcc, paymentCents, now);
    });

    const newBankBal = (db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(bankAcc) as any).balance_cents;
    const newDebtBal = (db.prepare('SELECT total_balance_cents FROM debts WHERE id = ?').get(debtId) as any).total_balance_cents;

    assertEquals(newBankBal, 220000, 'Bank balance must decrease by $300.00 (220000 cents)');
    assertEquals(newDebtBal, 120000, 'Debt balance must decrease by $300.00 (120000 cents)');

    // Overpayment check (pay $2,000 on remaining $1,200 debt)
    const overpaymentCents = 200000;
    runInTransaction(() => {
      db.prepare('UPDATE debts SET total_balance_cents = MAX(0, total_balance_cents - ?), updated_at = ? WHERE id = ?')
        .run(overpaymentCents, now, debtId);
    });

    const clampedDebtBal = (db.prepare('SELECT total_balance_cents FROM debts WHERE id = ?').get(debtId) as any).total_balance_cents;
    assertEquals(clampedDebtBal, 0, 'Debt balance must clamp to 0 with MAX(0, ...), never going negative');
  });

  // Test 7: Briefing Mathematical Formulas & Threshold Verification
  await runTest('7. Briefing Mathematical Formulas & Stability Score Boundaries', () => {
    // Stability calculation formula from moneyos.ts:
    // stabilityScore = Math.min(100, Math.max(40, Math.round((cash / Math.max(1, cash + debt)) * 100)))
    const calcStability = (cash: number, debt: number) => {
      return Math.min(100, Math.max(40, Math.round((cash / Math.max(1, cash + debt)) * 100)));
    };

    assertEquals(calcStability(0, 0), 40, 'Zero cash and zero debt should safely return baseline 40% without NaN/div0');
    assertEquals(calcStability(10000, 0), 100, 'High cash and zero debt should cap at 100%');
    assertEquals(calcStability(0, 50000), 40, 'Zero cash and high debt should floor at 40%');
    assertEquals(calcStability(5000, 5000), 50, 'Equal cash and debt should yield 50%');

    // XP Tier Progression logic verification
    const getNextTier = (xp: number) => {
      let nextTierName = 'Active Plug';
      let xpNeeded = 800 - xp;
      if (xp >= 5000) {
        nextTierName = 'Grand Money Plug';
        xpNeeded = Math.max(0, 10000 - xp);
      } else if (xp >= 2000) {
        nextTierName = 'Diamond Stacker';
        xpNeeded = 5000 - xp;
      } else if (xp >= 800) {
        nextTierName = 'Wealth Builder';
        xpNeeded = 2000 - xp;
      }
      return { nextTierName, xpNeeded: Math.max(0, xpNeeded) };
    };

    assertEquals(getNextTier(0).nextTierName, 'Active Plug', '0 XP -> Active Plug');
    assertEquals(getNextTier(0).xpNeeded, 800, '0 XP -> 800 needed');
    assertEquals(getNextTier(800).nextTierName, 'Wealth Builder', '800 XP -> Wealth Builder');
    assertEquals(getNextTier(800).xpNeeded, 1200, '800 XP -> 1200 needed');
    assertEquals(getNextTier(2500).nextTierName, 'Diamond Stacker', '2500 XP -> Diamond Stacker');
    assertEquals(getNextTier(2500).xpNeeded, 2500, '2500 XP -> 2500 needed');
    assertEquals(getNextTier(6000).nextTierName, 'Grand Money Plug', '6000 XP -> Grand Money Plug');
    assertEquals(getNextTier(6000).xpNeeded, 4000, '6000 XP -> 4000 needed');
    assertEquals(getNextTier(15000).xpNeeded, 0, '15000 XP -> 0 needed (max tier reached)');
  });

  // Test 8: Rapid Sequential Transactions Concurrency Stress
  await runTest('8. Rapid Sequential Transactions & Durability Stress (100 Transactions)', () => {
    const concUserId = `user_conc_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Concurrent User', ?, ?, ?)
    `).run(concUserId, `${concUserId}@example.com`, `REF_${crypto.randomUUID()}`, now, now);

    const sourceAcc = `acc_s_${crypto.randomUUID()}`;
    const targetAcc = `acc_t_${crypto.randomUUID()}`;

    db.prepare('INSERT INTO accounts (id, user_id, name, type, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(sourceAcc, concUserId, 'Source Account', 'bank', 1000000, now, now); // $10,000.00
    db.prepare('INSERT INTO accounts (id, user_id, name, type, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(targetAcc, concUserId, 'Target Account', 'bank', 0, now, now);

    const NUM_TXS = 100;
    const TX_AMOUNT = 500; // $5.00 each = $500.00 total

    for (let i = 0; i < NUM_TXS; i++) {
      runInTransaction(() => {
        db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(TX_AMOUNT, sourceAcc);
        db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(TX_AMOUNT, targetAcc);
        db.prepare(`
          INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
          VALUES (?, ?, ?, 'Transfer', 'transfer', ?, 'Sequential Stress', '2026-08-26', ?)
        `).run(`tx_conc_${i}_${crypto.randomUUID()}`, concUserId, targetAcc, TX_AMOUNT, now);
      });
    }

    const finalSourceBal = (db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(sourceAcc) as any).balance_cents;
    const finalTargetBal = (db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(targetAcc) as any).balance_cents;
    const txCount = (db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(concUserId) as any).count;

    assertEquals(finalSourceBal, 1000000 - (NUM_TXS * TX_AMOUNT), 'Source balance must reflect exact deductions');
    assertEquals(finalTargetBal, NUM_TXS * TX_AMOUNT, 'Target balance must reflect exact credits');
    assertEquals(txCount, NUM_TXS, `Total transaction count in SQLite must be ${NUM_TXS}`);
  });

  // Summary
  console.log('\n============================================================');
  console.log(`STRESS TEST RESULTS: ${results.filter(r => r.passed).length}/${results.length} PASSED`);
  console.log('============================================================\n');

  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    throw new Error(`${failed.length} stress test(s) failed!`);
  }
}

if (process.argv[1]?.endsWith('m1_backend_stress.test.ts')) {
  runMilestone1BackendStressSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
