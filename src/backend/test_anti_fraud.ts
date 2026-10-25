import assert from 'assert';
import { Request, Response } from 'express';
import { db, initDb, runInTransaction } from './db';
import {
  generateClientFingerprint,
  getClientIp,
  checkIpVelocity,
  checkFingerprintVelocity,
  evaluateReferralRisk,
  referralAntiFraudMiddleware
} from './middleware/referralAntiFraud';
import { attributeReferralConversion } from './routes/referrals';

function runAntiFraudTests() {
  console.log('🧪 Running Referral Anti-Fraud Security Middleware Test Suite...\n');

  initDb();

  // 1. Client Fingerprint Hashing Consistency
  console.log('1. Testing Client Fingerprint Hashing...');
  const mockReq1 = {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Chromium";v="120"',
      'sec-ch-ua-platform': '"macOS"',
      'accept-encoding': 'gzip, deflate, br'
    },
    socket: { remoteAddress: '198.51.100.42' }
  } as unknown as Request;

  const fp1 = generateClientFingerprint(mockReq1);
  const fp2 = generateClientFingerprint(mockReq1);
  assert.strictEqual(fp1.length, 64, 'Fingerprint must be a 64-character SHA-256 hex string');
  assert.strictEqual(fp1, fp2, 'Fingerprints generated from identical headers must be deterministic and equal');

  const mockReq2 = {
    headers: {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'accept-language': 'fr-FR,fr;q=0.9',
    },
    socket: { remoteAddress: '203.0.113.15' }
  } as unknown as Request;

  const fp3 = generateClientFingerprint(mockReq2);
  assert.notStrictEqual(fp1, fp3, 'Different environments must produce different client fingerprints');
  console.log('✓ Fingerprint hashing generates deterministic SHA-256 tokens.');

  // 2. IP & Fingerprint Velocity Checks
  console.log('\n2. Testing IP Velocity Checks...');
  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const testFp = `fp_test_vel_${Date.now()}`;
  const now = new Date().toISOString();

  // Initially zero clicks
  const vel0 = checkIpVelocity(testIp, 60, 5);
  assert.strictEqual(vel0.exceeded, false);

  // Ensure referrer user exists for foreign key constraint
  const adminExists = db.prepare('SELECT id FROM users WHERE id = ?').get('usr_admin');
  if (!adminExists) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES ('usr_admin', 'admin@test.local', 'hash', 'Admin', 'admin', 'PLUG-TEST', ?, ?)
    `).run(now, now);
  }

  // Insert 5 click events within last 10 minutes
  for (let i = 0; i < 5; i++) {
    db.prepare(`
      INSERT INTO referral_clicks (id, referral_code, referrer_user_id, ip_address, client_fingerprint, created_at)
      VALUES (?, 'PLUG-TEST', 'usr_admin', ?, ?, ?)
    `).run(`rclick_test_vel_${Date.now()}_${i}`, testIp, testFp, now);
  }

  const velExceeded = checkIpVelocity(testIp, 60, 5);
  assert.strictEqual(velExceeded.exceeded, true, 'IP velocity must trigger exceeded=true when 5+ clicks exist in window');

  const fpVelExceeded = checkFingerprintVelocity(testFp, 60, 5);
  assert.strictEqual(fpVelExceeded.exceeded, true, 'Fingerprint velocity must trigger exceeded=true');
  console.log('✓ IP and Fingerprint velocity checks correctly detect frequency thresholds.');

  // 3. Self-Referral & Suspicious Pattern Risk Evaluator
  console.log('\n3. Testing Self-Referral Risk Evaluator & Quarantine Flagging...');

  // Create mock users in DB for referral risk test
  const timestamp = Date.now();
  const referrerId = `usr_ref_${timestamp}`;
  const referredId = `usr_new_${timestamp}`;

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, referral_count, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Creator One', 'user', ?, 0, ?, ?)
    `).run(referrerId, `creator${timestamp}@moneyplughub.com`, `REF-CR1-${timestamp}`, now, now);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, referral_count, created_at, updated_at)
      VALUES (?, ?, 'hash', 'Alt Creator', 'user', ?, 0, ?, ?)
    `).run(referredId, `creator${timestamp}+alt@moneyplughub.com`, `REF-ALT-${timestamp}`, now, now);
  });

  // Direct ID self-referral
  const directSelfRisk = evaluateReferralRisk({
    referrerId,
    referredUserId: referrerId,
    ip: '1.2.3.4',
    fingerprint: 'fp_random'
  });
  assert.strictEqual(directSelfRisk.isSelfReferral, true);
  assert.strictEqual(directSelfRisk.quarantineRequired, true);
  assert.strictEqual(directSelfRisk.riskScore, 100);

  // Email alias self-referral
  const emailAliasRisk = evaluateReferralRisk({
    referrerId,
    referredUserId: referredId,
    email: `creator${timestamp}+alt@moneyplughub.com`,
    ip: '1.2.3.4',
    fingerprint: 'fp_random'
  });
  assert.strictEqual(emailAliasRisk.isSelfReferral, true);
  assert.strictEqual(emailAliasRisk.quarantineRequired, true);

  // Legitimate distinct user referral
  const legitId = `usr_legit_${Date.now()}`;
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, role, referral_code, referral_count, created_at, updated_at)
    VALUES (?, ?, 'hash', 'Legit Person', 'user', ?, 0, ?, ?)
  `).run(legitId, `distinct_${timestamp}@gmail.com`, `REF-LEGIT-${timestamp}`, now, now);

  const legitRisk = evaluateReferralRisk({
    referrerId,
    referredUserId: legitId,
    email: 'distinct.person@gmail.com',
    ip: '8.8.8.8',
    fingerprint: 'fp_completely_different'
  });
  assert.strictEqual(legitRisk.isSelfReferral, false);
  assert.strictEqual(legitRisk.quarantineRequired, false);
  console.log('✓ Risk evaluator accurately identifies self-referrals, email alias patterns, and legitimate referrals.');

  // 4. Conversion Attribution & Commission Quarantine
  console.log('\n4. Testing Commission Quarantine Status Transition...');

  // Insert a pending commission
  const commId = `comm_quarantine_test_${Date.now()}`;
  db.prepare(`
    INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, 1000, 'USD', 'pending', 'Test commission', ?, ?)
  `).run(commId, referrerId, referrerId, now, now);

  const quarantineRes = attributeReferralConversion(referrerId, referrerId, '1.2.3.4', { email: `creator${timestamp}@moneyplughub.com` });
  assert.strictEqual(quarantineRes.quarantined, true);

  const updatedComm = db.prepare('SELECT status FROM commission_ledger WHERE id = ?').get(commId) as { status: string };
  assert.strictEqual(updatedComm.status, 'quarantined');
  console.log('✓ Suspicious self-referral commission ledger entry was successfully quarantined.');

  console.log('\n🎉 ALL REFERRAL ANTI-FRAUD TESTS PASSED WITH 100% VERIFICATION!\n');
}

runAntiFraudTests();
