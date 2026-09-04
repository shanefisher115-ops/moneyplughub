import assert from 'assert';
import jwt from 'jsonwebtoken';
import { db, initDb, runInTransaction } from './db';
import { validateTINFormat } from './routes/taxCompliance';
import { config } from './config';

async function testTaxCompliance() {
  console.log('🧪 Starting Tax Compliance & 1099-MISC Automated Test Suite...\n');

  initDb();

  // 1. Validate TIN/EIN Format Utility
  console.log('1. Testing TIN/EIN Validation Rules...');

  // Valid SSN
  const ssnValid = validateTINFormat('123456789', 'SSN');
  assert.strictEqual(ssnValid.valid, true);
  assert.strictEqual(ssnValid.formatted, '123-45-6789');

  // Valid EIN
  const einValid = validateTINFormat('12-3456789', 'EIN');
  assert.strictEqual(einValid.valid, true);
  assert.strictEqual(einValid.formatted, '12-3456789');

  // Invalid SSN (Wrong Digits)
  const ssnInvalidDigits = validateTINFormat('1234', 'SSN');
  assert.strictEqual(ssnInvalidDigits.valid, false);

  // Invalid Repetitive SSN
  const ssnRepetitive = validateTINFormat('000000000', 'SSN');
  assert.strictEqual(ssnRepetitive.valid, false);

  console.log('✓ TIN/EIN Format Validation passed.');

  // 2. Database W-9, Digital Signature, and 1099 Export Operations
  console.log('\n2. Testing W-9 & 1099 Database Ledger Operations...');
  const testUserId = `test_tax_usr_${Date.now()}`;
  const now = new Date().toISOString();

  const referredUserId = `referred_${Date.now()}`;
  const rand = Math.random().toString(36).substring(2, 7);
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, role, referral_code, created_at, updated_at
    ) VALUES (?, ?, 'hash', 'Tax Creator', 'user', ?, ?, ?)
  `).run(testUserId, `tax_test_${rand}@moneyplughub.local`, `TAX-${rand}`, now, now);

  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, role, referral_code, created_at, updated_at
    ) VALUES (?, ?, 'hash', 'Referred User', 'user', ?, ?, ?)
  `).run(referredUserId, `referred_test_${rand}@moneyplughub.local`, `REF-${rand}`, now, now);

  // Insert sample earnings in commission_ledger for 2026 ($750.00 = 75000 cents)
  db.prepare(`
    INSERT INTO commission_ledger (
      id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, 75000, 'USD', 'paid', '2026 Creator Revenue', ?, ?)
  `).run(`comm_${Date.now()}`, testUserId, referredUserId, now, now);

  // Verify W-9 Submission insert
  const w9Id = `w9_${testUserId}_1`;
  db.prepare(`
    INSERT INTO creator_w9_forms (
      id, user_id, legal_name, business_name, tax_classification, tin_type, tin_last_4, tin_hash,
      address_line1, city, state, zip_code, status, created_at, updated_at
    ) VALUES (?, ?, 'Jane Creator', 'Jane Creator LLC', 'llc', 'SSN', '6789', 'hash123', '100 Sovereign Way', 'Austin', 'TX', '78701', 'submitted', ?, ?)
  `).run(w9Id, testUserId, now, now);

  const w9Row = db.prepare('SELECT * FROM creator_w9_forms WHERE user_id = ?').get(testUserId) as any;
  assert.strictEqual(w9Row.legal_name, 'Jane Creator');
  assert.strictEqual(w9Row.tin_last_4, '6789');

  // Verify Digital Signature Audit Log
  const sigId = `sig_${Date.now()}`;
  db.prepare(`
    INSERT INTO digital_signature_logs (
      id, w9_id, user_id, signature_name, ip_address, user_agent, consent_agreed, signed_at
    ) VALUES (?, ?, ?, 'Jane Creator Signature', '192.168.1.1', 'NodeTest', 1, ?)
  `).run(sigId, w9Id, testUserId, now);

  const sigLogs = db.prepare('SELECT * FROM digital_signature_logs WHERE w9_id = ?').all(w9Id) as any[];
  assert.strictEqual(sigLogs.length, 1);
  assert.strictEqual(sigLogs[0].signature_name, 'Jane Creator Signature');

  // Verify 1099 Export Record
  const exportId = `exp_1099_${testUserId}_2026`;
  db.prepare(`
    INSERT INTO tax_1099_exports (
      id, year, user_id, gross_earnings_cents, threshold_exceeded, status, export_data_json, created_at
    ) VALUES (?, 2026, ?, 75000, 1, 'generated', '{}', ?)
  `).run(exportId, testUserId, now);

  const expRow = db.prepare('SELECT * FROM tax_1099_exports WHERE id = ?').get(exportId) as any;
  assert.strictEqual(expRow.gross_earnings_cents, 75000);
  assert.strictEqual(expRow.threshold_exceeded, 1);

  console.log('✓ Database W-9, Digital Signature Log, and 1099 Export ledger verified.');

  console.log('\n🎉 ALL TAX COMPLIANCE TESTS PASSED SUCCESSFULLY!\n');
}

testTaxCompliance().catch((err) => {
  console.error('❌ Tax Compliance test failed:', err);
  process.exit(1);
});
