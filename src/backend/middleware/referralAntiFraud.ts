import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, recordAuditLog } from '../db';

// ── Configuration Constants ──────────────────────────────────────
export const FRAUD_CONFIG = {
  MAX_CLICKS_PER_IP_HOUR: 5,
  MAX_CLICKS_PER_FP_HOUR: 8,
  MAX_CONVERSIONS_PER_IP_DAY: 3,
  MAX_CONVERSIONS_PER_FP_DAY: 3,
  SUSPICIOUS_VELOCITY_WINDOW_HOURS: 1,
  SELF_REFERRAL_RISK_THRESHOLD: 0.70,
};

// ── Types ─────────────────────────────────────────────────────────
export interface ClientFingerprint {
  hash: string;
  ip: string;
  userAgent: string;
  acceptLanguage: string;
  rawFingerprintToken?: string;
  components: {
    ip: string;
    ua: string;
    lang: string;
    platform?: string;
  };
}

export interface FraudAssessment {
  isAllowed: boolean;
  isVelocityExceeded: boolean;
  isSelfReferral: boolean;
  isSuspicious: boolean;
  riskScore: number;
  reasons: string[];
  fingerprint: ClientFingerprint;
}

export interface AntiFraudRequest extends Request {
  clientFingerprint?: ClientFingerprint;
  fraudAssessment?: FraudAssessment;
}

// ── Schema Initialization ─────────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS referral_quarantine (
      id TEXT PRIMARY KEY,
      referral_code TEXT NOT NULL,
      referrer_user_id TEXT,
      referred_user_id TEXT,
      ip_address TEXT,
      fingerprint_hash TEXT,
      risk_score REAL NOT NULL DEFAULT 1.0,
      reasons_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'quarantined' CHECK(status IN ('quarantined', 'released', 'rejected')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ref_quarantine_code ON referral_quarantine(referral_code);
    CREATE INDEX IF NOT EXISTS idx_ref_quarantine_referrer ON referral_quarantine(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_ref_quarantine_ip ON referral_quarantine(ip_address);
    CREATE INDEX IF NOT EXISTS idx_ref_quarantine_fp ON referral_quarantine(fingerprint_hash);
    CREATE INDEX IF NOT EXISTS idx_ref_quarantine_status ON referral_quarantine(status);
  `);

  // Column migrations for referral_clicks and referral_fraud_log
  try {
    db.exec(`ALTER TABLE referral_clicks ADD COLUMN fingerprint_hash TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE referral_fraud_log ADD COLUMN fingerprint_hash TEXT;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE referral_fraud_log ADD COLUMN risk_score REAL DEFAULT 1.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE referral_fraud_log ADD COLUMN status TEXT DEFAULT 'flagged';`);
  } catch (e) {}
} catch (e) {
  // Table initialization safe fallback
}

/**
 * 1. CLIENT FINGERPRINT HASHING
 * Generates a deterministic SHA-256 fingerprint hash from client request parameters.
 */
export function computeClientFingerprint(req: Request): ClientFingerprint {
  const rawIp = (
    (req.headers['x-forwarded-for'] as string) ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
  const ip = rawIp.split(',')[0].trim();

  const userAgent = (req.headers['user-agent'] || '').trim();
  const acceptLanguage = (req.headers['accept-language'] || '').trim();
  const secChUa = (req.headers['sec-ch-ua'] as string) || '';
  const secChPlatform = (req.headers['sec-ch-ua-platform'] as string) || '';

  // Optional client-side fingerprint string passed via headers or query
  const rawToken = (
    (req.headers['x-client-fingerprint'] as string) ||
    (req.query.fp as string) ||
    (req.body?.fingerprint as string) ||
    ''
  ).trim();

  const payload = [
    ip,
    userAgent,
    acceptLanguage,
    secChUa,
    secChPlatform,
    rawToken,
  ].join('|');

  const hash = crypto.createHash('sha256').update(payload).digest('hex');

  return {
    hash,
    ip,
    userAgent,
    acceptLanguage,
    rawFingerprintToken: rawToken || undefined,
    components: {
      ip,
      ua: userAgent,
      lang: acceptLanguage,
      platform: secChPlatform || undefined,
    },
  };
}

/**
 * 2. IP & FINGERPRINT VELOCITY CHECKS
 * Checks click and signup frequencies against rate thresholds.
 */
export function checkReferralVelocity(
  ip: string,
  fingerprintHash: string,
  referralCode?: string
): { isExceeded: boolean; reasons: string[]; clickCountIp: number; clickCountFp: number } {
  const reasons: string[] = [];

  // Hourly click counts by IP
  const clicksIp = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM referral_clicks
    WHERE ip_address = ? AND created_at > datetime('now', '-1 hour')
  `).get(ip) as any;
  const clickCountIp = Number(clicksIp?.cnt || 0);

  if (clickCountIp >= FRAUD_CONFIG.MAX_CLICKS_PER_IP_HOUR) {
    reasons.push(`IP velocity limit exceeded (${clickCountIp}/${FRAUD_CONFIG.MAX_CLICKS_PER_IP_HOUR} clicks/hr)`);
  }

  // Hourly click counts by Fingerprint
  const clicksFp = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM referral_clicks
    WHERE fingerprint_hash = ? AND created_at > datetime('now', '-1 hour')
  `).get(fingerprintHash) as any;
  const clickCountFp = Number(clicksFp?.cnt || 0);

  if (clickCountFp >= FRAUD_CONFIG.MAX_CLICKS_PER_FP_HOUR) {
    reasons.push(`Fingerprint velocity limit exceeded (${clickCountFp}/${FRAUD_CONFIG.MAX_CLICKS_PER_FP_HOUR} clicks/hr)`);
  }

  // Check 24h conversion rate by IP & FP
  const convsIp = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM referral_clicks
    WHERE ip_address = ? AND converted = 1 AND created_at > datetime('now', '-24 hours')
  `).get(ip) as any;
  const convCountIp = Number(convsIp?.cnt || 0);

  if (convCountIp >= FRAUD_CONFIG.MAX_CONVERSIONS_PER_IP_DAY) {
    reasons.push(`IP conversion velocity limit exceeded (${convCountIp}/${FRAUD_CONFIG.MAX_CONVERSIONS_PER_IP_DAY} conversions/24h)`);
  }

  const convsFp = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM referral_clicks
    WHERE fingerprint_hash = ? AND converted = 1 AND created_at > datetime('now', '-24 hours')
  `).get(fingerprintHash) as any;
  const convCountFp = Number(convsFp?.cnt || 0);

  if (convCountFp >= FRAUD_CONFIG.MAX_CONVERSIONS_PER_FP_DAY) {
    reasons.push(`Fingerprint conversion velocity limit exceeded (${convCountFp}/${FRAUD_CONFIG.MAX_CONVERSIONS_PER_FP_DAY} conversions/24h)`);
  }

  return {
    isExceeded: reasons.length > 0,
    reasons,
    clickCountIp,
    clickCountFp,
  };
}

/**
 * 3. SUSPICIOUS SELF-REFERRAL DETECTION
 * Analyzes whether a conversion or referral action exhibits self-referral indicators.
 */
export function assessSelfReferralRisk(params: {
  referrerUserId: string;
  convertingUserId?: string;
  convertingEmail?: string;
  ip: string;
  fingerprintHash: string;
}): { isSelfReferral: boolean; isSuspicious: boolean; riskScore: number; reasons: string[] } {
  const { referrerUserId, convertingUserId, convertingEmail, ip, fingerprintHash } = params;
  const reasons: string[] = [];
  let riskScore = 0.0;
  let isSelfReferral = false;

  // 1. Direct User ID match
  if (convertingUserId && convertingUserId === referrerUserId) {
    isSelfReferral = true;
    riskScore += 1.0;
    reasons.push('Direct self-referral: Converting User ID matches Referrer User ID');
  }

  // Get Referrer profile details
  const referrer = db.prepare('SELECT id, email, referral_code FROM users WHERE id = ?').get(referrerUserId) as any;

  if (referrer) {
    // 2. Email / Email Domain Match
    if (convertingEmail) {
      const normConvertingEmail = convertingEmail.trim().toLowerCase();
      const normReferrerEmail = (referrer.email || '').trim().toLowerCase();

      if (normConvertingEmail === normReferrerEmail) {
        isSelfReferral = true;
        riskScore += 1.0;
        reasons.push('Email match: Converting user email identical to Referrer email');
      } else {
        // Check base email before '+' alias (e.g. user+ref1@gmail.com vs user+ref2@gmail.com)
        const convertingBase = normConvertingEmail.split('@')[0].split('+')[0];
        const referrerBase = normReferrerEmail.split('@')[0].split('+')[0];
        const convertingDomain = normConvertingEmail.split('@')[1];
        const referrerDomain = normReferrerEmail.split('@')[1];

        if (convertingBase === referrerBase && convertingDomain === referrerDomain) {
          isSelfReferral = true;
          riskScore += 0.90;
          reasons.push(`Email alias match: ${normConvertingEmail} matched referrer base email ${normReferrerEmail}`);
        }
      }
    }

    // 3. Same IP as Referrer Recent Activity
    const referrerRecentIp = db.prepare(`
      SELECT id FROM referral_clicks
      WHERE referrer_user_id = ? AND ip_address = ? AND created_at > datetime('now', '-14 days')
      LIMIT 1
    `).get(referrerUserId, ip) as any;

    if (referrerRecentIp) {
      riskScore += 0.45;
      reasons.push(`Same IP match: Converting user IP (${ip}) matches referrer activity in past 14 days`);
    }

    // 4. Same Fingerprint Hash as Referrer Activity
    const referrerRecentFp = db.prepare(`
      SELECT id FROM referral_clicks
      WHERE referrer_user_id = ? AND fingerprint_hash = ? AND created_at > datetime('now', '-14 days')
      LIMIT 1
    `).get(referrerUserId, fingerprintHash) as any;

    if (referrerRecentFp) {
      riskScore += 0.55;
      reasons.push(`Same Fingerprint match: Converting device fingerprint matches referrer activity in past 14 days`);
    }

    // 5. High Velocity Rapid Click-to-Signup Anomaly (< 3 seconds)
    const recentClick = db.prepare(`
      SELECT created_at FROM referral_clicks
      WHERE referrer_user_id = ? AND (ip_address = ? OR fingerprint_hash = ?)
      ORDER BY created_at DESC LIMIT 1
    `).get(referrerUserId, ip, fingerprintHash) as any;

    if (recentClick && recentClick.created_at) {
      const clickTime = new Date(recentClick.created_at).getTime();
      const diffMs = Date.now() - clickTime;
      if (diffMs >= 0 && diffMs < 3000) { // under 3 seconds
        riskScore += 0.35;
        reasons.push(`Rapid conversion anomaly: Conversion completed ${diffMs}ms after referral click`);
      }
    }
  }

  // Cap risk score at 1.0
  riskScore = Math.min(1.0, Number(riskScore.toFixed(2)));
  const isSuspicious = riskScore >= FRAUD_CONFIG.SELF_REFERRAL_RISK_THRESHOLD || isSelfReferral;

  return {
    isSelfReferral,
    isSuspicious,
    riskScore,
    reasons,
  };
}

/**
 * 4. QUARANTINE REFERRAL
 * Places a suspicious referral or self-referral in quarantine state and logs fraud telemetry.
 */
export function quarantineReferral(params: {
  referralCode: string;
  referrerUserId?: string;
  referredUserId?: string;
  ip: string;
  fingerprintHash: string;
  riskScore: number;
  reasons: string[];
  notes?: string;
}): string {
  const { referralCode, referrerUserId, referredUserId, ip, fingerprintHash, riskScore, reasons, notes } = params;
  const now = new Date().toISOString();
  const quarantineId = `quar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fraudLogId = `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Insert into referral_quarantine
  db.prepare(`
    INSERT INTO referral_quarantine (
      id, referral_code, referrer_user_id, referred_user_id, ip_address,
      fingerprint_hash, risk_score, reasons_json, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', ?, ?, ?)
  `).run(
    quarantineId,
    referralCode,
    referrerUserId || null,
    referredUserId || null,
    ip,
    fingerprintHash,
    riskScore,
    JSON.stringify(reasons),
    notes || 'Flagged by anti-fraud security engine for self-referral / velocity risk',
    now,
    now
  );

  // Insert into referral_fraud_log
  db.prepare(`
    INSERT INTO referral_fraud_log (
      id, referral_code, ip_address, fingerprint_hash, reason, risk_score, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'quarantined', ?)
  `).run(
    fraudLogId,
    referralCode,
    ip,
    fingerprintHash,
    reasons.join('; '),
    riskScore,
    now
  );

  recordAuditLog(
    referredUserId || null,
    'REFERRAL_QUARANTINED',
    'referral_quarantine',
    quarantineId,
    { referral_code: referralCode, referrer_id: referrerUserId, risk_score: riskScore, reasons }
  );

  return quarantineId;
}

/**
 * 5. EXPRESS ANTI-FRAUD SECURITY MIDDLEWARE
 * Executed on referral tracking and conversion endpoints.
 */
export function referralAntiFraudMiddleware(req: AntiFraudRequest, res: Response, next: NextFunction): void {
  const fp = computeClientFingerprint(req);
  req.clientFingerprint = fp;

  const referralCode = (req.params.code || req.body?.referral_code || req.query.ref || '').toString().trim().toUpperCase();

  // Velocity Check
  const velocity = checkReferralVelocity(fp.ip, fp.hash, referralCode);

  req.fraudAssessment = {
    isAllowed: !velocity.isExceeded,
    isVelocityExceeded: velocity.isExceeded,
    isSelfReferral: false,
    isSuspicious: velocity.isExceeded,
    riskScore: velocity.isExceeded ? 0.85 : 0.0,
    reasons: velocity.reasons,
    fingerprint: fp,
  };

  // If velocity is exceeded on a tracking call, log to fraud log
  if (velocity.isExceeded && referralCode) {
    const fraudId = `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO referral_fraud_log (id, referral_code, ip_address, fingerprint_hash, reason, risk_score, status, created_at)
      VALUES (?, ?, ?, ?, ?, 0.85, 'flagged', ?)
    `).run(
      fraudId,
      referralCode,
      fp.ip,
      fp.hash,
      velocity.reasons.join('; '),
      now
    );
  }

  next();
}
