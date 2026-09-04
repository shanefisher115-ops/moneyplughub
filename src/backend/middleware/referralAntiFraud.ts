import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, runInTransaction, recordAuditLog } from '../db';

export interface AntiFraudContext {
  fingerprintHash: string;
  ipAddress: string;
  isFlagged: boolean;
  riskScore: number;
  reasons: string[];
}

export interface AntiFraudRequest extends Request {
  fingerprintHash?: string;
  antiFraud?: AntiFraudContext;
}

/**
 * Ensures SQLite schema migrations for referral anti-fraud & quarantine tracking
 */
export function initAntiFraudSchema(): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS referral_quarantine (
        id TEXT PRIMARY KEY,
        referral_code TEXT NOT NULL,
        referrer_user_id TEXT,
        referred_user_id TEXT,
        click_id TEXT,
        commission_id TEXT,
        ip_address TEXT,
        client_fingerprint TEXT,
        risk_score REAL NOT NULL DEFAULT 0.0,
        reasons TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'quarantined' CHECK(status IN ('quarantined', 'released', 'rejected')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_code ON referral_quarantine(referral_code);
      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_status ON referral_quarantine(status);
      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_referrer ON referral_quarantine(referrer_user_id);
      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_fp ON referral_quarantine(client_fingerprint);
    `);

    // Column migrations
    try {
      db.exec(`ALTER TABLE referral_clicks ADD COLUMN client_fingerprint TEXT;`);
    } catch {}

    try {
      db.exec(`ALTER TABLE program_clicks ADD COLUMN client_fingerprint TEXT;`);
    } catch {}

    try {
      db.exec(`ALTER TABLE referral_fraud_log ADD COLUMN client_fingerprint TEXT;`);
    } catch {}

    try {
      db.exec(`ALTER TABLE referral_fraud_log ADD COLUMN risk_score REAL DEFAULT 0.5;`);
    } catch {}

    try {
      db.exec(`ALTER TABLE referral_fraud_log ADD COLUMN status TEXT DEFAULT 'flagged';`);
    } catch {}
  } catch (err) {
    console.error('Failed to initialize anti-fraud schema:', err);
  }
}

/**
 * Client Fingerprint Hashing
 * Combines request characteristics into a unique SHA-256 hash.
 */
export function generateClientFingerprint(req: Request): { hash: string; components: Record<string, string> } {
  const ip = (req.headers['x-forwarded-for'] as string || req.ip || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
  const userAgent = (req.headers['user-agent'] || '').trim();
  const acceptLang = (req.headers['accept-language'] || '').trim();
  const acceptEnc = (req.headers['accept-encoding'] || '').trim();
  const clientProvided = (req.headers['x-client-fingerprint'] || req.body?.fingerprint || req.query?.fingerprint || '').toString().trim();

  const components = {
    ip,
    userAgent,
    acceptLang,
    acceptEnc,
    clientProvided,
  };

  const rawString = `${ip}|${userAgent}|${acceptLang}|${acceptEnc}|${clientProvided}`;
  const hash = crypto.createHash('sha256').update(rawString).digest('hex');

  return { hash, components };
}

/**
 * IP & Fingerprint Velocity Rate Check
 * Checks referral tracking request frequency per IP and fingerprint.
 */
export function checkReferralVelocity(
  ip: string,
  fingerprint: string,
  limits = { maxPerMinute: 5, maxPerHour: 20 }
): { allowed: boolean; count1m: number; count1h: number; reason?: string; riskScore: number } {
  const now = new Date().toISOString();

  // Check clicks by IP or fingerprint in last 1 min and 1 hour
  const stats1m = db.prepare(`
    SELECT COUNT(*) as cnt FROM referral_clicks
    WHERE (ip_address = ? OR client_fingerprint = ?) AND created_at > datetime('now', '-1 minute')
  `).get(ip, fingerprint) as any;

  const stats1h = db.prepare(`
    SELECT COUNT(*) as cnt FROM referral_clicks
    WHERE (ip_address = ? OR client_fingerprint = ?) AND created_at > datetime('now', '-1 hour')
  `).get(ip, fingerprint) as any;

  const count1m = Number(stats1m?.cnt || 0);
  const count1h = Number(stats1h?.cnt || 0);

  if (count1m >= limits.maxPerMinute) {
    return {
      allowed: false,
      count1m,
      count1h,
      reason: `IP/Fingerprint 1-minute velocity limit exceeded (${count1m}/${limits.maxPerMinute})`,
      riskScore: 0.85,
    };
  }

  if (count1h >= limits.maxPerHour) {
    return {
      allowed: false,
      count1m,
      count1h,
      reason: `IP/Fingerprint 1-hour velocity limit exceeded (${count1h}/${limits.maxPerHour})`,
      riskScore: 0.90,
    };
  }

  return {
    allowed: true,
    count1m,
    count1h,
    riskScore: 0.1,
  };
}

/**
 * Detect Suspicious Self-Referrals & Quarantine
 */
export function checkSelfReferralAndQuarantine(params: {
  referrerUserId: string;
  newUserId?: string;
  ip: string;
  fingerprint: string;
  referralCode: string;
  clickId?: string;
  commissionId?: string;
}): { isQuarantined: boolean; riskScore: number; reasons: string[]; quarantineId?: string } {
  const { referrerUserId, newUserId, ip, fingerprint, referralCode, clickId, commissionId } = params;
  const now = new Date().toISOString();
  const reasons: string[] = [];
  let riskScore = 0.0;

  // 1. Direct Self-Referral Check
  if (newUserId && referrerUserId === newUserId) {
    reasons.push('DIRECT_SELF_REFERRAL');
    riskScore += 1.0;
  }

  // Check if new user shares referral code of referrer
  if (newUserId) {
    const newUserObj = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(newUserId) as any;
    if (newUserObj && newUserObj.referral_code?.toUpperCase() === referralCode.toUpperCase()) {
      if (!reasons.includes('DIRECT_SELF_REFERRAL')) {
        reasons.push('DIRECT_SELF_REFERRAL');
        riskScore += 1.0;
      }
    }
  }

  // 2. IP Match Self-Referral
  const referrerIpMatch = db.prepare(`
    SELECT id FROM referral_clicks
    WHERE referrer_user_id = ? AND ip_address = ? AND created_at > datetime('now', '-30 days')
    LIMIT 1
  `).get(referrerUserId, ip) as any;

  if (referrerIpMatch) {
    reasons.push('REFERRER_IP_MATCH');
    riskScore += 0.6;
  }

  // 3. Client Fingerprint Match Self-Referral
  const referrerFpMatch = db.prepare(`
    SELECT id FROM referral_clicks
    WHERE referrer_user_id = ? AND client_fingerprint = ? AND created_at > datetime('now', '-30 days')
    LIMIT 1
  `).get(referrerUserId, fingerprint) as any;

  if (referrerFpMatch) {
    reasons.push('REFERRER_FINGERPRINT_MATCH');
    riskScore += 0.7;
  }

  // Cap risk score at 1.0
  riskScore = Math.min(1.0, riskScore);

  // Quarantine if risk score >= 0.5 or any suspicious reason detected
  if (riskScore >= 0.5 || reasons.length > 0) {
    const quarantineId = `quar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const reasonsStr = reasons.join(', ');

    db.prepare(`
      INSERT INTO referral_quarantine (
        id, referral_code, referrer_user_id, referred_user_id, click_id, commission_id,
        ip_address, client_fingerprint, risk_score, reasons, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', ?, ?)
    `).run(
      quarantineId, referralCode, referrerUserId, newUserId || null, clickId || null, commissionId || null,
      ip, fingerprint, riskScore, reasonsStr, now, now
    );

    // Also record in referral_fraud_log
    const fraudId = `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO referral_fraud_log (id, referral_code, ip_address, client_fingerprint, risk_score, status, reason, created_at)
      VALUES (?, ?, ?, ?, ?, 'quarantined', ?, ?)
    `).run(fraudId, referralCode, ip, fingerprint, riskScore, `QUARANTINE: ${reasonsStr}`, now);

    // If a commission exists, place it in 'pending' status with quarantine notes (or update status)
    if (commissionId) {
      db.prepare(`
        UPDATE commission_ledger
        SET notes = COALESCE(notes, '') || ' [QUARANTINED: ' || ? || ']', updated_at = ?
        WHERE id = ?
      `).run(reasonsStr, now, commissionId);
    }

    return { isQuarantined: true, riskScore, reasons, quarantineId };
  }

  return { isQuarantined: false, riskScore: 0.1, reasons: [] };
}

/**
 * Express Middleware: Anti-Fraud Security Middleware for Referral Tracking
 */
export function referralAntiFraudMiddleware(req: AntiFraudRequest, res: Response, next: NextFunction): void {
  initAntiFraudSchema();

  const { hash: fingerprintHash, components } = generateClientFingerprint(req);
  const ipAddress = components.ip;

  req.fingerprintHash = fingerprintHash;

  // Perform IP & Fingerprint Velocity Check
  const velocity = checkReferralVelocity(ipAddress, fingerprintHash);

  const context: AntiFraudContext = {
    fingerprintHash,
    ipAddress,
    isFlagged: !velocity.allowed,
    riskScore: velocity.riskScore,
    reasons: velocity.reason ? [velocity.reason] : [],
  };

  req.antiFraud = context;

  if (!velocity.allowed) {
    const code = req.params?.code || req.params?.slug || 'UNKNOWN';
    const now = new Date().toISOString();
    const fraudId = `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      db.prepare(`
        INSERT INTO referral_fraud_log (id, referral_code, ip_address, client_fingerprint, risk_score, status, reason, created_at)
        VALUES (?, ?, ?, ?, ?, 'velocity_exceeded', ?, ?)
      `).run(fraudId, code, ipAddress, fingerprintHash, velocity.riskScore, velocity.reason, now);
    } catch {}
  }

  next();
}

/**
 * Admin: Get Quarantined Referrals Queue
 */
export function getQuarantineQueue(statusFilter?: string): any[] {
  initAntiFraudSchema();

  let query = `
    SELECT q.*,
           u1.display_name as referrer_name, u1.email as referrer_email,
           u2.display_name as referred_name, u2.email as referred_email
    FROM referral_quarantine q
    LEFT JOIN users u1 ON u1.id = q.referrer_user_id
    LEFT JOIN users u2 ON u2.id = q.referred_user_id
  `;
  const params: any[] = [];

  if (statusFilter && ['quarantined', 'released', 'rejected'].includes(statusFilter)) {
    query += ` WHERE q.status = ?`;
    params.push(statusFilter);
  }

  query += ` ORDER BY q.created_at DESC LIMIT 100`;

  return db.prepare(query).all(...params) as any[];
}

/**
 * Admin: Release Quarantined Referral
 */
export function releaseQuarantinedReferral(quarantineId: string, adminUserId: string): { success: boolean; message: string } {
  const now = new Date().toISOString();

  const item = db.prepare('SELECT * FROM referral_quarantine WHERE id = ?').get(quarantineId) as any;
  if (!item) {
    return { success: false, message: 'Quarantined record not found' };
  }

  if (item.status !== 'quarantined') {
    return { success: false, message: `Record is already ${item.status}` };
  }

  runInTransaction(() => {
    db.prepare(`
      UPDATE referral_quarantine
      SET status = 'released', resolved_at = ?, resolved_by = ?, updated_at = ?
      WHERE id = ?
    `).run(now, adminUserId, now, quarantineId);

    if (item.commission_id) {
      db.prepare(`
        UPDATE commission_ledger
        SET notes = COALESCE(notes, '') || ' [RELEASED FROM QUARANTINE BY ADMIN]', updated_at = ?
        WHERE id = ?
      `).run(now, item.commission_id);
    }

    recordAuditLog(adminUserId, 'REFERRAL_QUARANTINE_RELEASED', 'referral_quarantine', quarantineId, {
      referral_code: item.referral_code,
      referrer_user_id: item.referrer_user_id,
    });
  });

  return { success: true, message: 'Quarantined referral released successfully' };
}

/**
 * Admin: Reject Quarantined Referral
 */
export function rejectQuarantinedReferral(quarantineId: string, adminUserId: string): { success: boolean; message: string } {
  const now = new Date().toISOString();

  const item = db.prepare('SELECT * FROM referral_quarantine WHERE id = ?').get(quarantineId) as any;
  if (!item) {
    return { success: false, message: 'Quarantined record not found' };
  }

  if (item.status !== 'quarantined') {
    return { success: false, message: `Record is already ${item.status}` };
  }

  runInTransaction(() => {
    db.prepare(`
      UPDATE referral_quarantine
      SET status = 'rejected', resolved_at = ?, resolved_by = ?, updated_at = ?
      WHERE id = ?
    `).run(now, adminUserId, now, quarantineId);

    if (item.commission_id) {
      db.prepare(`
        DELETE FROM commission_ledger WHERE id = ?
      `).run(item.commission_id);
    }

    recordAuditLog(adminUserId, 'REFERRAL_QUARANTINE_REJECTED', 'referral_quarantine', quarantineId, {
      referral_code: item.referral_code,
      referrer_user_id: item.referrer_user_id,
    });
  });

  return { success: true, message: 'Quarantined referral rejected and cancelled' };
}
