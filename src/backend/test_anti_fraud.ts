import assert from 'assert';
import { db, initDb, runInTransaction } from './db';
import {
  generateClientFingerprint,
  checkReferralVelocity,
  checkSelfReferralAndQuarantine,
  getQuarantineQueue,
  releaseQuarantinedReferral,
  rejectQuarantinedReferral,
  initAntiFraudSchema,
} from './middleware/referralAntiFraud';
import { attributeReferralConversion } from './routes/referrals';

async function runAntiFraudTests() {
  console.log('🛡️ Starting Anti-Fraud Security Middleware & Quarantine Test Suite...\n');

  // 1. Initialize schema
  initDb();
  initAntiFraudSchema();
  console.log('✓ Step 1: Database and anti-fraud schema initialized.');

  // 2. Client Fingerprint Hashing Test
  const mockReq1 = {
    headers: {
      'x-forwarded-for': '203.0.113.195',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
    },
    ip: '203.0.113.195',
    socket: { remoteAddress: '203.0.113.195' },
  } as any;

  const mockReq2 = { ...mockReq1 };

  const fp1 = generateClientFingerprint(mockReq1);
  const fp2 = generateClientFingerprint(mockReq2);

  assert.strictEqual(typeof fp1.hash, 'string');
  assert.strictEqual(fp1.hash.length, 64, 'SHA-256 hash must be 64 characters long');
  assert.strictEqual(fp1.hash, fp2.hash, 'Identical request headers must produce identical fingerprint hash');

  const mockReqDiff = {
    ...mockReq1,
    headers: {
      ...mockReq1.headers,
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
    },
  } as any;

  const fpDiff = generateClientFingerprint(mockReqDiff);
  assert.notStrictEqual(fp1.hash, fpDiff.hash, 'Different User-Agent must produce different fingerprint hash');
  console.log('✓ Step 2: Client fingerprint hashing verified.');

  // 3. IP & Fingerprint Velocity Checks Test
  const testIp = '198.51.100.42';
  const testFp = fp1.hash;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const testCode = `PLUG-TF${rand}`;

  const now = new Date().toISOString();
  const testRefUser = `usr_test_ref_${Date.now()}_${rand}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
    VALUES (?, ?, 'hash', 'Test Ref', ?, ?, ?)
  `).run(testRefUser, `testref_${rand}@local.test`, testCode, now, now);

  // Ensure fresh start for velocity test IP
  db.prepare('DELETE FROM referral_clicks WHERE ip_address = ? OR client_fingerprint = ?').run(testIp, testFp);

  // Initial check should be allowed
  const v1 = checkReferralVelocity(testIp, testFp, { maxPerMinute: 3, maxPerHour: 10 });
  assert.strictEqual(v1.allowed, true);

  // Insert 3 clicks to hit 1-minute velocity limit
  for (let i = 0; i < 3; i++) {
    db.prepare(`
      INSERT INTO referral_clicks (
        id, referral_code, referrer_user_id, ip_address, client_fingerprint, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(`click_vel_${i}_${Date.now()}`, testCode, testRefUser, testIp, testFp, now);
  }

  const v2 = checkReferralVelocity(testIp, testFp, { maxPerMinute: 3, maxPerHour: 10 });
  assert.strictEqual(v2.allowed, false, 'Velocity check must fail when 1-minute limit is reached');
  assert(v2.reason?.includes('velocity limit exceeded'));
  console.log('✓ Step 3: Referral IP/Fingerprint velocity rate limiting verified.');

  // 4. Self-Referral Detection & Quarantine Test
  const randOwner = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ownerCode = `PLUG-OWN${randOwner}`;
  const referrerId = `usr_ref_owner_${Date.now()}_${randOwner}`;
  const sameUserRefId = referrerId; // Direct self referral
  const newUserId = `usr_new_referred_${Date.now()}_${randOwner}`;

  // Insert referrer user
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
    VALUES (?, ?, 'hash', 'Owner User', ?, ?, ?)
  `).run(referrerId, `owner_${randOwner}@test.local`, ownerCode, now, now);

  // Test 4A: Direct Self-Referral (same user ID)
  const selfRefCheck = checkSelfReferralAndQuarantine({
    referrerUserId: referrerId,
    newUserId: sameUserRefId,
    ip: '198.51.100.99',
    fingerprint: 'fp_self_123',
    referralCode: ownerCode,
  });

  assert.strictEqual(selfRefCheck.isQuarantined, true);
  assert(selfRefCheck.reasons.includes('DIRECT_SELF_REFERRAL'));
  assert.strictEqual(selfRefCheck.riskScore, 1.0);
  console.log('✓ Step 4A: Direct self-referral detected and quarantined.');

  // Test 4B: IP / Fingerprint Match Self-Referral
  // Record click history for referrer with specific IP and Fingerprint
  const sharedIp = '203.0.113.88';
  const sharedFp = 'fp_shared_device_456';

  db.prepare(`
    INSERT INTO referral_clicks (id, referral_code, referrer_user_id, ip_address, client_fingerprint, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`click_hist_${Date.now()}`, ownerCode, referrerId, sharedIp, sharedFp, now);

  const ipFpMatchCheck = checkSelfReferralAndQuarantine({
    referrerUserId: referrerId,
    newUserId: newUserId,
    ip: sharedIp,
    fingerprint: sharedFp,
    referralCode: ownerCode,
  });

  assert.strictEqual(ipFpMatchCheck.isQuarantined, true);
  assert(ipFpMatchCheck.reasons.includes('REFERRER_IP_MATCH'));
  assert(ipFpMatchCheck.reasons.includes('REFERRER_FINGERPRINT_MATCH'));
  assert(ipFpMatchCheck.riskScore >= 0.8);
  console.log('✓ Step 4B: IP and Client Fingerprint matching self-referrals quarantined.');

  // 5. Admin Quarantine Queue Management Test
  // Insert newUserId into users table first
  const referredCode = `PLUG-REF${randOwner}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
    VALUES (?, ?, 'hash', 'Referred User', ?, ?, ?)
  `).run(newUserId, `referred_${randOwner}@test.local`, referredCode, now, now);

  // Create a commission to test quarantine release and rejection
  const commId = `comm_quar_${Date.now()}`;
  db.prepare(`
    INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, 2500, 'USD', 'pending', 'Test commission for quarantine', ?, ?)
  `).run(commId, referrerId, newUserId, now, now);

  // Trigger conversion attribution with self-referral to create quarantine record tied to commission
  attributeReferralConversion(newUserId, referrerId, sharedIp, sharedFp, commId);

  const queue = getQuarantineQueue('quarantined');
  assert(queue.length > 0, 'Quarantine queue must contain quarantined items');

  const quarItem = queue.find((item) => item.commission_id === commId);
  assert(quarItem, 'Quarantined commission must appear in quarantine queue');
  assert.strictEqual(quarItem.status, 'quarantined');

  // Test 5A: Release Quarantined Referral
  const adminId = `usr_admin_tester_${randOwner}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
    VALUES (?, ?, 'hash', 'Admin Tester', 'admin', ?, ?, ?)
  `).run(adminId, `admin_${randOwner}@test.local`, `PLUG-ADM${randOwner}`, now, now);

  const releaseRes = releaseQuarantinedReferral(quarItem.id, adminId);
  assert.strictEqual(releaseRes.success, true);

  const releasedItem = db.prepare('SELECT * FROM referral_quarantine WHERE id = ?').get(quarItem.id) as any;
  assert.strictEqual(releasedItem.status, 'released');
  console.log('✓ Step 5A: Admin release of quarantined referral verified.');

  // Test 5B: Reject Quarantined Referral
  // Create another quarantined item to test rejection with unique referred user
  const newUserId2 = `usr_new_referred_2_${Date.now()}_${randOwner}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
    VALUES (?, ?, 'hash', 'Referred User 2', ?, ?, ?)
  `).run(newUserId2, `referred2_${randOwner}@test.local`, `PLUG-REF2${randOwner}`, now, now);

  const quarId2 = `quar_reject_test_${Date.now()}`;
  const commId2 = `comm_quar_rej_${Date.now()}`;

  db.prepare(`
    INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, 3500, 'USD', 'pending', 'To be rejected', ?, ?)
  `).run(commId2, referrerId, newUserId2, now, now);

  db.prepare(`
    INSERT INTO referral_quarantine (id, referral_code, referrer_user_id, referred_user_id, commission_id, risk_score, reasons, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1.0, 'DIRECT_SELF_REFERRAL', 'quarantined', ?, ?)
  `).run(quarId2, ownerCode, referrerId, newUserId2, commId2, now, now);

  const rejectRes = rejectQuarantinedReferral(quarId2, adminId);
  assert.strictEqual(rejectRes.success, true);

  const rejectedItem = db.prepare('SELECT * FROM referral_quarantine WHERE id = ?').get(quarId2) as any;
  assert.strictEqual(rejectedItem.status, 'rejected');

  const deletedComm = db.prepare('SELECT id FROM commission_ledger WHERE id = ?').get(commId2);
  assert.strictEqual(deletedComm, undefined, 'Rejected quarantined commission must be cancelled/removed');
  console.log('✓ Step 5B: Admin rejection and cancellation of quarantined referral verified.');

  console.log('\n🎉 ANTI-FRAUD SECURITY MIDDLEWARE & QUARANTINE TEST SUITE PASSED 100%!\n');
}

runAntiFraudTests().catch((err) => {
  console.error('❌ Anti-fraud test failed:', err);
  process.exit(1);
});
