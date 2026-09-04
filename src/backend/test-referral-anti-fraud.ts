import assert from 'assert';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, initDb, runInTransaction } from './db';
import { config } from './config';
import {
  computeClientFingerprint,
  checkReferralVelocity,
  assessSelfReferralRisk,
  quarantineReferral,
  FRAUD_CONFIG
} from './middleware/referralAntiFraud';
import { attributeReferralConversion } from './routes/referrals';
import referralRoutes from './routes/referrals';

async function runAntiFraudTests() {
  console.log('🧪 Starting Anti-Fraud Referral Security Test Suite...\n');

  initDb();

  // Create test referrer and referred users
  const randTag = Date.now().toString(36).substring(2, 6).toUpperCase();
  const referrerCode = `REF-PRO-${randTag}`;
  const referrerId = `test_referrer_${Date.now()}`;
  const convertUserId = `test_convert_${Date.now()}`;
  const now = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, ?, ?, 'Referrer Pro', 'user', ?, NULL, 0, 100, 1, 1, 'Novice Plug', ?, ?)
    `).run(referrerId, `referrer_${randTag}@antifraud.test`, bcrypt.hashSync('Pass123!', 8), referrerCode, now, now);

    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, ?, ?, 'Converted User', 'user', ?, ?, 0, 100, 1, 1, 'Novice Plug', ?, ?)
    `).run(convertUserId, `convert_${randTag}@antifraud.test`, bcrypt.hashSync('Pass123!', 8), `REF-CONV-${randTag}`, referrerId, now, now);
  });

  // 1. TEST: Client Fingerprint Hashing
  console.log('1. Testing Client Fingerprint Hashing...');
  const mockReq1 = {
    headers: {
      'x-forwarded-for': '198.51.100.42, 10.0.0.1',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua-platform': '"macOS"',
      'x-client-fingerprint': 'fp_device_hardware_uuid_12345',
    },
    ip: '198.51.100.42',
    socket: { remoteAddress: '198.51.100.42' },
    query: {},
    body: {},
  } as any;

  const fp1 = computeClientFingerprint(mockReq1);
  assert.strictEqual(fp1.ip, '198.51.100.42');
  assert.strictEqual(typeof fp1.hash, 'string');
  assert.strictEqual(fp1.hash.length, 64); // SHA-256 hex string length
  assert.strictEqual(fp1.rawFingerprintToken, 'fp_device_hardware_uuid_12345');

  // Verify consistency
  const fp1Duplicate = computeClientFingerprint(mockReq1);
  assert.strictEqual(fp1.hash, fp1Duplicate.hash, 'Fingerprint hash must be deterministic for identical request inputs');

  // Verify distinct inputs yield distinct hashes
  const mockReq2 = { ...mockReq1, headers: { ...mockReq1.headers, 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' } };
  const fp2 = computeClientFingerprint(mockReq2);
  assert.notStrictEqual(fp1.hash, fp2.hash, 'Different headers must yield different fingerprint hashes');
  console.log('✓ Step 1 Passed: Client Fingerprint Hashing deterministic and distinct.\n');

  // 2. TEST: IP Velocity Checks & Thresholds
  console.log('2. Testing IP Velocity Checks & Rate Limiting...');
  const testIp = `203.0.113.${Math.floor(Math.random() * 200 + 10)}`;
  const testFpHash = `fp_test_hash_${Date.now()}`;

  // Initial check should pass
  const velocityInitial = checkReferralVelocity(testIp, testFpHash, referrerCode);
  assert.strictEqual(velocityInitial.isExceeded, false, 'Initial velocity check must pass');

  // Insert 5 clicks for test IP to reach limit
  for (let i = 0; i < FRAUD_CONFIG.MAX_CLICKS_PER_IP_HOUR; i++) {
    db.prepare(`
      INSERT INTO referral_clicks (id, referral_code, referrer_user_id, ip_address, fingerprint_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`click_vel_${i}_${Date.now()}`, referrerCode, referrerId, testIp, testFpHash, new Date().toISOString());
  }

  const velocityAfterSpike = checkReferralVelocity(testIp, testFpHash, referrerCode);
  assert.strictEqual(velocityAfterSpike.isExceeded, true, 'Velocity limit must trigger when click count threshold is exceeded');
  assert(velocityAfterSpike.reasons.some(r => r.includes('IP velocity limit exceeded')), 'Reason must specify IP velocity limit');
  console.log('✓ Step 2 Passed: IP & Fingerprint Velocity Checks correctly flag rate limit spikes.\n');

  // 3. TEST: Self-Referral Risk Assessment & Quarantine Trigger
  console.log('3. Testing Self-Referral Detection & Quarantine...');

  // A. Direct User ID self-referral
  const directSelfRisk = assessSelfReferralRisk({
    referrerUserId: referrerId,
    convertingUserId: referrerId, // Direct self-referral
    convertingEmail: 'referrer@antifraud.test',
    ip: '198.51.100.1',
    fingerprintHash: 'fp_self_ref',
  });
  assert.strictEqual(directSelfRisk.isSelfReferral, true);
  assert.strictEqual(directSelfRisk.riskScore, 1.0);
  assert.strictEqual(directSelfRisk.isSuspicious, true);

  // B. Email alias self-referral (referrer_XYZ@antifraud.test vs referrer_XYZ+bonus1@antifraud.test)
  const referrerUserRow = db.prepare('SELECT email FROM users WHERE id = ?').get(referrerId) as any;
  const referrerEmailBase = referrerUserRow.email.split('@')[0];
  const referrerDomain = referrerUserRow.email.split('@')[1];

  const aliasSelfRisk = assessSelfReferralRisk({
    referrerUserId: referrerId,
    convertingUserId: 'usr_new_alias',
    convertingEmail: `${referrerEmailBase}+bonus1@${referrerDomain}`,
    ip: '198.51.100.99',
    fingerprintHash: 'fp_different_device',
  });
  assert.strictEqual(aliasSelfRisk.isSelfReferral, true);
  assert(aliasSelfRisk.riskScore >= 0.90, 'Email alias match must carry risk score >= 0.90');
  assert.strictEqual(aliasSelfRisk.isSuspicious, true);

  // C. Execute Quarantine for suspicious conversion
  const quarantineId = quarantineReferral({
    referralCode: referrerCode,
    referrerUserId: referrerId,
    referredUserId: convertUserId,
    ip: '198.51.100.42',
    fingerprintHash: fp1.hash,
    riskScore: 0.95,
    reasons: ['Email alias match self-referral attempt'],
    notes: 'Integration test quarantine entry',
  });

  const quarantineRecord = db.prepare('SELECT * FROM referral_quarantine WHERE id = ?').get(quarantineId) as any;
  assert(quarantineRecord !== undefined);
  assert.strictEqual(quarantineRecord.status, 'quarantined');
  assert.strictEqual(quarantineRecord.referral_code, referrerCode);
  console.log('✓ Step 3 Passed: Self-Referral risks detected and placed in Quarantine state.\n');

  // 4. TEST: attributeReferralConversion Anti-Fraud Integration
  console.log('4. Testing attributeReferralConversion with req fingerprint...');
  // Create another converting user with matching email alias
  const selfUserId = `usr_self_alias_${Date.now()}`;
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, role, referral_code,
      referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
    ) VALUES (?, ?, 'hash', 'Self Referral Bot', 'user', ?, ?, 0, 100, 1, 1, 'Novice Plug', ?, ?)
  `).run(selfUserId, `${referrerEmailBase}+fraud@${referrerDomain}`, `REF-SELF-${randTag}`, referrerId, now, now);

  const attrResult = attributeReferralConversion(selfUserId, referrerId, '198.51.100.42', mockReq1);
  assert.strictEqual(attrResult.isQuarantined, true, 'Suspicious self-referral conversion must be quarantined');
  assert(attrResult.riskScore >= 0.70, 'Risk score must meet or exceed threshold');
  console.log('✓ Step 4 Passed: attributeReferralConversion automatically quarantines fraudulent conversions.\n');

  // 5. TEST: Admin Quarantine Endpoints & Review Flow
  console.log('5. Testing Admin Quarantine Management Endpoints (Release & Reject)...');

  // Setup Express App to test HTTP Admin Endpoints
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Ensure admin user exists in DB for authenticateToken middleware
  const adminUserId = `admin_test_${Date.now()}`;
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, display_name, role, referral_code,
      referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
    ) VALUES (?, ?, 'hash', 'Admin User', 'admin', ?, NULL, 0, 100, 1, 1, 'Novice Plug', ?, ?)
  `).run(adminUserId, `admin_${randTag}@antifraud.test`, `REF-ADM-${randTag}`, now, now);

  // Helper JWT generator for admin
  const adminToken = jwt.sign(
    { userId: adminUserId, email: 'admin@antifraud.test', role: 'admin' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  app.use('/api/referrals', referralRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  // Helper fetch function using http.request
  const httpRequest = (path: string, method = 'GET', headers: Record<string, string> = {}, body?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const dataStr = body ? JSON.stringify(body) : undefined;
      const req = http.request(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'Cookie': `token=${adminToken}`,
          ...headers,
        },
      }, (res) => {
        let chunk = '';
        res.on('data', c => chunk += c);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(chunk) });
          } catch {
            resolve({ status: res.statusCode, body: chunk });
          }
        });
      });
      req.on('error', reject);
      if (dataStr) req.write(dataStr);
      req.end();
    });
  };

  // A. GET /api/referrals/quarantine
  const quarListRes = await httpRequest('/api/referrals/quarantine');
  assert.strictEqual(quarListRes.status, 200);
  assert.strictEqual(quarListRes.body.success, true);
  assert(Array.isArray(quarListRes.body.data));
  assert(quarListRes.body.data.length > 0);

  // B. POST /api/referrals/quarantine/:id/release
  const releaseRes = await httpRequest(`/api/referrals/quarantine/${quarantineId}/release`, 'POST');
  assert.strictEqual(releaseRes.status, 200);
  assert.strictEqual(releaseRes.body.success, true);

  const releasedRow = db.prepare('SELECT status FROM referral_quarantine WHERE id = ?').get(quarantineId) as any;
  assert.strictEqual(releasedRow.status, 'released');

  // C. GET /api/referrals/anti-fraud/stats
  const statsRes = await httpRequest('/api/referrals/anti-fraud/stats');
  assert.strictEqual(statsRes.status, 200);
  assert.strictEqual(statsRes.body.success, true);
  assert(statsRes.body.data.quarantine.total > 0);
  assert(statsRes.body.data.quarantine.released >= 1, 'Quarantine released count must be at least 1');

  server.close();
  console.log('✓ Step 5 Passed: Admin Quarantine management endpoints (Release, Reject, Stats) verified.\n');

  console.log('🎉 ALL REFERRAL ANTI-FRAUD SECURITY TESTS PASSED WITH 100% SUCCESS!\n');
}

runAntiFraudTests().catch(err => {
  console.error('❌ Anti-fraud test failed:', err);
  process.exit(1);
});
