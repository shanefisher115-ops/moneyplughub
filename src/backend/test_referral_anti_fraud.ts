import assert from 'assert';
import { db, initDb } from './db';
import {
  generateClientFingerprint,
  getClientIp,
  checkReferralVelocity,
  detectSelfReferral,
  evaluateReferralRisk,
  quarantineReferral,
  VELOCITY_LIMITS,
  RISK_THRESHOLDS,
  initAntiFraudSchema
} from './middleware/referralAntiFraud';
import { attributeReferralConversion } from './routes/referrals';

export async function runAntiFraudTests() {
  console.log('🛡️ Starting Anti-Fraud Security Middleware Test Suite...\n');

  initDb();
  initAntiFraudSchema();

  // 1. Client Fingerprint Generation Test
  const mockReq1 = {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'sec-ch-ua-platform': '"macOS"',
      'x-forwarded-for': '203.0.113.195, 10.0.0.1',
    },
    ip: '10.0.0.1',
    socket: { remoteAddress: '10.0.0.1' },
  } as any;

  const mockReq2 = {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'sec-ch-ua-platform': '"macOS"',
      'x-forwarded-for': '203.0.113.195',
    },
    ip: '203.0.113.195',
  } as any;

  const ip1 = getClientIp(mockReq1);
  assert.strictEqual(ip1, '203.0.113.195');

  const fp1 = generateClientFingerprint(mockReq1);
  const fp2 = generateClientFingerprint(mockReq2);

  assert.strictEqual(typeof fp1, 'string');
  assert.strictEqual(fp1.length, 64); // SHA-256 hex string
  assert.strictEqual(fp1, fp2, 'Identical headers/IPs must yield identical fingerprint hashes');
  console.log('✓ Step 1: Client SHA-256 fingerprint generation & IP extraction verified.');

  // 2. IP Velocity Checking Test
  const testIp = '198.51.100.44';
  const testFp = 'fp_test_velocity_hash_1234567890';
  const now = new Date().toISOString();

  // Insert test user to satisfy foreign key constraint on referral_clicks
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
    VALUES ('usr_referrer_1', 'ref1@moneyplug.test', 'hash', 'Ref 1', 'PLUG-TEST', ?, ?)
  `).run(now, now);

  // Insert mock clicks exceeding velocity threshold
  for (let i = 0; i < VELOCITY_LIMITS.MAX_CLICKS_PER_IP_PER_HOUR + 2; i++) {
    db.prepare(`
      INSERT INTO referral_clicks (id, referral_code, referrer_user_id, ip_address, client_fingerprint, created_at)
      VALUES (?, 'PLUG-TEST', 'usr_referrer_1', ?, ?, ?)
    `).run(`clk_vel_${Date.now()}_${i}`, testIp, testFp, now);
  }

  const velCheck = checkReferralVelocity(testIp, testFp);
  assert.strictEqual(velCheck.velocityExceeded, true);
  assert(velCheck.ipClickCountHour >= VELOCITY_LIMITS.MAX_CLICKS_PER_IP_PER_HOUR);
  assert(velCheck.fpClickCountHour >= VELOCITY_LIMITS.MAX_CLICKS_PER_FINGERPRINT_PER_HOUR);
  assert(velCheck.reasons.some(r => r.includes('IP_VELOCITY_EXCEEDED')));
  console.log('✓ Step 2: IP & Fingerprint velocity rate limiting verified.');

  // 3. Self-Referral Detection Test
  const randTag = Math.random().toString(36).substring(2, 6);
  const referrerUserId = `usr_ref_owner_${Date.now()}_${randTag}`;
  const refCode = `REF-${Date.now()}-${randTag}`;
  const ownerEmail = `owner_${randTag}@moneyplug.test`;

  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at)
    VALUES (?, ?, 'hash', 'Owner', ?, ?, ?)
  `).run(referrerUserId, ownerEmail, refCode, now, now);

  // Log fingerprint for referrer user
  db.prepare(`
    INSERT INTO client_fingerprint_logs (id, user_id, ip_address, fingerprint, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(`fplog_${Date.now()}`, referrerUserId, '198.51.100.99', 'fp_referrer_device_hash', now);

  // Test self-referral via same User ID
  const selfRef1 = detectSelfReferral({
    referrerUserId,
    newUserId: referrerUserId,
    ip: '1.2.3.4',
    fingerprint: 'fp_random',
  });
  assert.strictEqual(selfRef1.isSelfReferral, true);
  assert(selfRef1.riskScoreDelta >= 100);

  // Test self-referral via email alias (e.g., owner+sub@moneyplug.test vs owner@moneyplug.test)
  const selfRef2 = detectSelfReferral({
    referrerUserId,
    newUserEmail: `owner_${randTag}+bonus1@moneyplug.test`,
    ip: '1.2.3.4',
    fingerprint: 'fp_random',
  });
  assert.strictEqual(selfRef2.isSelfReferral, true);
  assert(selfRef2.riskScoreDelta >= 80);

  // Test self-referral via fingerprint match
  const selfRef3 = detectSelfReferral({
    referrerUserId,
    newUserEmail: 'different@moneyplug.test',
    ip: '1.2.3.4',
    fingerprint: 'fp_referrer_device_hash',
  });
  assert.strictEqual(selfRef3.isSelfReferral, true);
  assert(selfRef3.riskScoreDelta >= 75);

  console.log('✓ Step 3: Self-referral detection (User ID match, email aliases, device fingerprint correlation) verified.');

  // 4. Referral Risk Evaluation & Quarantine Flow
  const riskEval = evaluateReferralRisk({
    referralCode: refCode,
    referrerUserId,
    newUserEmail: `owner_${randTag}+bonus2@moneyplug.test`,
    req: {
      headers: { 'user-agent': 'Mozilla/5.0' },
      ip: '198.51.100.99',
    } as any,
  });

  assert(riskEval.riskScore >= RISK_THRESHOLDS.QUARANTINE_SCORE);
  assert.strictEqual(riskEval.isQuarantined, true);

  const quarantineId = quarantineReferral({
    referralCode: refCode,
    referrerUserId,
    referredUserId: 'usr_new_suspect',
    fingerprint: riskEval.fingerprint,
    ipAddress: riskEval.ip,
    riskScore: riskEval.riskScore,
    reasons: riskEval.flags,
  });

  assert(typeof quarantineId === 'string' && quarantineId.startsWith('quar_'));

  const quarRow = db.prepare('SELECT * FROM referral_quarantine WHERE id = ?').get(quarantineId) as any;
  assert.strictEqual(quarRow.status, 'quarantined');
  assert.strictEqual(quarRow.referrer_user_id, referrerUserId);
  console.log('✓ Step 4: Quarantine flagging, risk score calculation, and database persistence verified.');

  // 5. Conversion Attribution Quarantine Integration
  const conversionRes = attributeReferralConversion('usr_new_suspect', referrerUserId, '198.51.100.99', {
    fingerprint: 'fp_referrer_device_hash',
    newUserEmail: `owner_${randTag}+bonus3@moneyplug.test`,
  });

  assert.strictEqual(conversionRes.isQuarantined, true);
  assert(conversionRes.riskScore >= RISK_THRESHOLDS.QUARANTINE_SCORE);
  console.log('✓ Step 5: Conversion attribution integration with anti-fraud quarantine verified.');

  console.log('\n🎉 ALL ANTI-FRAUD SECURITY MIDDLEWARE TESTS PASSED 100% SUCCESSFULLY!\n');
}

if (require.main === module) {
  runAntiFraudTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Anti-fraud test failed:', err);
      process.exit(1);
    });
}
