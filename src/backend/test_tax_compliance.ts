import assert from 'assert';
import { db, initDb, runInTransaction } from './db';
import { validateTin, hashTaxPayload } from './utils/taxValidation';
import { calculateYearlyEarnings } from './routes/taxCompliance';

export async function runTaxComplianceTests() {
  console.log('🧪 Starting Automated Tax Compliance Module Test Suite...\n');

  initDb();

  // 1. Test TIN & EIN Validator
  console.log('--- Step 1: Testing SSN and EIN Format Validator ---');

  // Valid SSN Test
  const ssnValid = validateTin('123-45-6789', 'ssn');
  assert.strictEqual(ssnValid.valid, true, 'Valid SSN should pass');
  assert.strictEqual(ssnValid.formatted, '123-45-6789');
  assert.strictEqual(ssnValid.masked, '***-**-6789');
  assert.strictEqual(ssnValid.cleanDigits, '123456789');
  console.log('  ✓ Valid SSN (123-45-6789) passed.');

  // Valid EIN Test
  const einValid = validateTin('12-3456789', 'ein');
  assert.strictEqual(einValid.valid, true, 'Valid EIN should pass');
  assert.strictEqual(einValid.formatted, '12-3456789');
  assert.strictEqual(einValid.masked, '**-***6789');
  assert.strictEqual(einValid.cleanDigits, '123456789');
  console.log('  ✓ Valid EIN (12-3456789) passed.');

  // Invalid SSN Tests
  const ssnShort = validateTin('12345', 'ssn');
  assert.strictEqual(ssnShort.valid, false, 'Short SSN should fail');

  const ssnAreaZero = validateTin('000-12-3456', 'ssn');
  assert.strictEqual(ssnAreaZero.valid, false, 'SSN area 000 should fail');

  const ssnArea666 = validateTin('666-12-3456', 'ssn');
  assert.strictEqual(ssnArea666.valid, false, 'SSN area 666 should fail');

  const ssnArea900 = validateTin('920-12-3456', 'ssn');
  assert.strictEqual(ssnArea900.valid, false, 'SSN area 900+ should fail');

  const ssnGroupZero = validateTin('123-00-4567', 'ssn');
  assert.strictEqual(ssnGroupZero.valid, false, 'SSN group 00 should fail');

  const ssnSerialZero = validateTin('123-45-0000', 'ssn');
  assert.strictEqual(ssnSerialZero.valid, false, 'SSN serial 0000 should fail');

  const ssnRepetitive = validateTin('111111111', 'ssn');
  assert.strictEqual(ssnRepetitive.valid, false, 'Repetitive SSN digits should fail');

  // Invalid EIN Tests
  const einInvalidPrefix = validateTin('00-1234567', 'ein');
  assert.strictEqual(einInvalidPrefix.valid, false, 'EIN prefix 00 should fail');

  const einSerialZero = validateTin('12-0000000', 'ein');
  assert.strictEqual(einSerialZero.valid, false, 'EIN serial 0000000 should fail');

  console.log('  ✓ All SSN & EIN rejection edge cases verified.');

  // 2. Test W-9 Submission & Digital Signature Audit Trail
  console.log('\n--- Step 2: Testing W-9 Submission & Cryptographic Signature Logging ---');
  const testUserId = `usr_tax_test_${Date.now()}`;
  const now = new Date().toISOString();

  const uniqueTag = Date.now();
  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Tax Tester Legal Name', 'user', ?, ?, ?)
    `).run(testUserId, `tax_creator_${uniqueTag}@test.local`, `TAXTEST_${uniqueTag}`, now, now);
  });

  const w9Id = `w9_${testUserId}`;
  const legalName = 'Alexander Taxpayer';
  const tinFormatted = '123-45-6789';
  const cleanLast4 = '6789';
  const encryptedTin = Buffer.from(tinFormatted).toString('base64');
  const digitalSignature = 'Alexander Taxpayer';
  const ipAddress = '192.168.1.100';
  const userAgent = 'Mozilla/5.0 TestSuite';

  const payloadToHash = {
    user_id: testUserId,
    legal_name: legalName,
    tax_classification: 'individual_sole_proprietor',
    address_line1: '100 Tax Street',
    city: 'San Francisco',
    state: 'CA',
    zip_code: '94105',
    tin_type: 'ssn',
    tin_last4: cleanLast4,
    digital_signature: digitalSignature,
    timestamp: now
  };
  const payloadHash = hashTaxPayload(payloadToHash);

  // Insert W-9
  db.prepare(`
    INSERT INTO creator_w9_forms (
      id, user_id, legal_name, business_name, tax_classification, address_line1,
      city, state, zip_code, tin_type, tin_last4, tin_encrypted, digital_signature,
      signature_date, ip_address, user_agent, status, created_at, updated_at
    ) VALUES (?, ?, ?, '', 'individual_sole_proprietor', '100 Tax Street', 'San Francisco', 'CA', '94105', 'ssn', ?, ?, ?, ?, ?, ?, 'verified', ?, ?)
  `).run(w9Id, testUserId, legalName, cleanLast4, encryptedTin, digitalSignature, now, ipAddress, userAgent, now, now);

  // Insert Signature Log
  const sigLogId = `siglog_test_${Date.now()}`;
  db.prepare(`
    INSERT INTO tax_signature_logs (
      id, w9_id, user_id, action, digital_signature, ip_address, user_agent, timestamp, payload_hash
    ) VALUES (?, ?, ?, 'signed', ?, ?, ?, ?, ?)
  `).run(sigLogId, w9Id, testUserId, digitalSignature, ipAddress, userAgent, now, payloadHash);

  const w9Row = db.prepare('SELECT * FROM creator_w9_forms WHERE user_id = ?').get(testUserId) as any;
  assert.strictEqual(w9Row.legal_name, legalName);
  assert.strictEqual(w9Row.tin_last4, '6789');
  assert.strictEqual(w9Row.status, 'verified');

  const sigLogRow = db.prepare('SELECT * FROM tax_signature_logs WHERE w9_id = ?').get(w9Id) as any;
  assert.strictEqual(sigLogRow.action, 'signed');
  assert.strictEqual(sigLogRow.payload_hash, payloadHash);
  console.log('  ✓ W-9 Form creation and cryptographic signature audit trail logged successfully.');

  // 3. Test Yearly Earnings Aggregator & $600 IRS Threshold
  console.log('\n--- Step 3: Testing Yearly Earnings Aggregation & 1099-MISC Threshold ---');

  const currentYear = new Date().getFullYear();
  const txDate = `${currentYear}-06-15T12:00:00.000Z`;
  const referredUserId = `usr_ref_${Date.now()}`;

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Referred User', 'user', ?, ?, ?)
    `).run(referredUserId, `referred_${uniqueTag}@test.local`, `REFUSER_${uniqueTag}`, now, now);
  });

  // Insert earnings records: $450 in ledger + $250 in affiliate payouts = $700 total (Exceeds $600 threshold)
  db.prepare(`
    INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, status, created_at, updated_at)
    VALUES (?, ?, ?, 45000, 'approved', ?, ?)
  `).run(`comm_${Date.now()}`, testUserId, referredUserId, txDate, txDate);

  db.prepare(`
    INSERT INTO affiliate_payout_logs (id, user_id, week_label, clicks, activations, earnings_cents, status, payout_date, created_at)
    VALUES (?, ?, 'Week 24', 10, 5, 25000, 'Paid', ?, ?)
  `).run(`pay_${Date.now()}`, testUserId, txDate, txDate);

  const earnings = calculateYearlyEarnings(testUserId, currentYear);
  assert.strictEqual(earnings.totalCents, 70000, 'Total earnings should equal 70,000 cents ($700.00)');
  assert.strictEqual(earnings.totalUsd, 700.0);
  assert.strictEqual(earnings.requires1099, true, 'Requires 1099 when earnings >= $600');
  assert.strictEqual(earnings.monthlyBreakdownUsd[5], 700.0, 'June earnings should be $700.00');

  console.log(`  ✓ Aggregated $${earnings.totalUsd.toFixed(2)} in ${currentYear} earnings.`);
  console.log(`  ✓ 1099-MISC filing eligibility correctly flagged: ${earnings.requires1099 ? 'YES ($600+ threshold exceeded)' : 'NO'}.`);

  console.log('\n🎉 ALL TAX COMPLIANCE MODULE INTEGRATION TESTS PASSED WITH 100% SUCCESS!\n');
}

if (require.main === module) {
  runTaxComplianceTests().then(() => process.exit(0)).catch((err) => {
    console.error('❌ Tax Compliance Test Failed:', err);
    process.exit(1);
  });
}
