import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, recordAuditLog } from '../db';

export interface AntiFraudContext {
  fingerprint: string;
  ip: string;
  userAgent: string;
  riskScore: number;
  flags: string[];
  isQuarantined: boolean;
}

export interface AntiFraudRequest extends Request {
  antiFraud?: AntiFraudContext;
}

// Configurable threshold constants
export const VELOCITY_LIMITS = {
  MAX_CLICKS_PER_IP_PER_HOUR: 10,
  MAX_CLICKS_PER_FINGERPRINT_PER_HOUR: 10,
  MAX_CONVERSIONS_PER_IP_PER_DAY: 3,
  MAX_CONVERSIONS_PER_FINGERPRINT_PER_DAY: 2,
};

export const RISK_THRESHOLDS = {
  QUARANTINE_SCORE: 70, // Risk score >= 70 triggers quarantine
  REJECT_SCORE: 90,     // Risk score >= 90 triggers hard rejection/block
};

/**
 * Initializes anti-fraud database tables & indexes if they don't exist yet.
 */
export function initAntiFraudSchema(): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS referral_quarantine (
        id TEXT PRIMARY KEY,
        referral_code TEXT NOT NULL,
        referrer_user_id TEXT NOT NULL,
        referred_user_id TEXT,
        click_id TEXT,
        commission_id TEXT,
        fingerprint TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        risk_score REAL NOT NULL,
        reasons TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'quarantined' CHECK(status IN ('quarantined', 'approved', 'rejected')),
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_referrer ON referral_quarantine(referrer_user_id);
      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_status ON referral_quarantine(status);
      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_fp ON referral_quarantine(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_ref_quarantine_ip ON referral_quarantine(ip_address);

      CREATE TABLE IF NOT EXISTS client_fingerprint_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        ip_address TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        user_agent TEXT,
        accept_language TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_fp_log_user ON client_fingerprint_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_fp_log_fp ON client_fingerprint_logs(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_fp_log_ip ON client_fingerprint_logs(ip_address);
    `);

    // Ensure columns exist on referral_clicks with individual error handling
    try { db.exec(`ALTER TABLE referral_clicks ADD COLUMN client_fingerprint TEXT;`); } catch (e) {}
    try { db.exec(`ALTER TABLE referral_clicks ADD COLUMN risk_score REAL DEFAULT 0.0;`); } catch (e) {}
    try { db.exec(`ALTER TABLE referral_clicks ADD COLUMN is_quarantined INTEGER DEFAULT 0;`); } catch (e) {}

    // Ensure columns exist on commission_ledger with individual error handling
    try { db.exec(`ALTER TABLE commission_ledger ADD COLUMN client_fingerprint TEXT;`); } catch (e) {}
    try { db.exec(`ALTER TABLE commission_ledger ADD COLUMN risk_score REAL DEFAULT 0.0;`); } catch (e) {}
    try { db.exec(`ALTER TABLE commission_ledger ADD COLUMN is_quarantined INTEGER DEFAULT 0;`); } catch (e) {}
  } catch (err) {
    console.error('Error initializing anti-fraud schema:', err);
  }
}

// Ensure schema is created on module load
initAntiFraudSchema();

/**
 * Extracts normalized IP address from request.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Generates a deterministic SHA-256 client fingerprint hash from HTTP headers & client telemetry.
 */
export function generateClientFingerprint(req: Request, extraData?: Record<string, any>): string {
  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] || '').trim();
  const acceptLang = (req.headers['accept-language'] || '').trim();
  const acceptEnc = (req.headers['accept-encoding'] || '').trim();
  const secChUa = (req.headers['sec-ch-ua'] as string || '').trim();
  const secChPlatform = (req.headers['sec-ch-ua-platform'] as string || '').trim();
  const secChMobile = (req.headers['sec-ch-ua-mobile'] as string || '').trim();
  const clientHeaderFp = (req.headers['x-client-fingerprint'] as string || '').trim();

  const components = [
    `ip:${ip}`,
    `ua:${ua}`,
    `lang:${acceptLang}`,
    `enc:${acceptEnc}`,
    `sec_ua:${secChUa}`,
    `sec_plat:${secChPlatform}`,
    `sec_mob:${secChMobile}`,
    `client_fp:${clientHeaderFp}`,
  ];

  if (extraData) {
    components.push(`extra:${JSON.stringify(extraData)}`);
  }

  const rawString = components.join('|');
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

/**
 * Logs a client fingerprint association for auditing & cross-referencing user sessions.
 */
export function logClientFingerprint(userId: string | null, req: Request, fingerprint: string): void {
  const ip = getClientIp(req);
  const ua = (req.headers['user-agent'] || '').substring(0, 500);
  const acceptLang = (req.headers['accept-language'] as string || '').substring(0, 200);
  const now = new Date().toISOString();
  const id = `fplog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  try {
    db.prepare(`
      INSERT INTO client_fingerprint_logs (id, user_id, ip_address, fingerprint, user_agent, accept_language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, ip, fingerprint, ua, acceptLang, now);
  } catch (err) {
    console.error('Failed to log client fingerprint:', err);
  }
}

/**
 * Performs IP & Fingerprint Velocity Rate Limit Checks.
 */
export function checkReferralVelocity(ip: string, fingerprint: string): {
  velocityExceeded: boolean;
  ipClickCountHour: number;
  fpClickCountHour: number;
  reasons: string[];
} {
  const reasons: string[] = [];

  // IP click count in last hour
  const ipClickRes = db.prepare(`
    SELECT COUNT(*) as cnt FROM referral_clicks
    WHERE ip_address = ? AND created_at > datetime('now', '-1 hour')
  `).get(ip) as any;
  const ipClickCountHour = Number(ipClickRes?.cnt || 0);

  if (ipClickCountHour >= VELOCITY_LIMITS.MAX_CLICKS_PER_IP_PER_HOUR) {
    reasons.push(`IP_VELOCITY_EXCEEDED: ${ipClickCountHour} clicks/hr (max ${VELOCITY_LIMITS.MAX_CLICKS_PER_IP_PER_HOUR})`);
  }

  // Fingerprint click count in last hour
  const fpClickRes = db.prepare(`
    SELECT COUNT(*) as cnt FROM referral_clicks
    WHERE client_fingerprint = ? AND created_at > datetime('now', '-1 hour')
  `).get(fingerprint) as any;
  const fpClickCountHour = Number(fpClickRes?.cnt || 0);

  if (fpClickCountHour >= VELOCITY_LIMITS.MAX_CLICKS_PER_FINGERPRINT_PER_HOUR) {
    reasons.push(`FINGERPRINT_VELOCITY_EXCEEDED: ${fpClickCountHour} clicks/hr (max ${VELOCITY_LIMITS.MAX_CLICKS_PER_FINGERPRINT_PER_HOUR})`);
  }

  return {
    velocityExceeded: reasons.length > 0,
    ipClickCountHour,
    fpClickCountHour,
    reasons,
  };
}

/**
 * Checks for Suspicious Self-Referrals & Cross-Account Fingerprint Correlation.
 */
export function detectSelfReferral(params: {
  referrerUserId: string;
  newUserId?: string;
  newUserEmail?: string;
  ip: string;
  fingerprint: string;
}): {
  isSelfReferral: boolean;
  riskScoreDelta: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let riskScoreDelta = 0;

  const { referrerUserId, newUserId, newUserEmail, ip, fingerprint } = params;

  // 1. Direct User ID equality check
  if (newUserId && newUserId === referrerUserId) {
    reasons.push('DIRECT_SELF_REFERRAL_USER_ID_MATCH');
    riskScoreDelta += 100;
  }

  // 2. Direct Referrer Details lookup
  const referrer = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(referrerUserId) as any;
  if (referrer && newUserEmail) {
    if (referrer.email.toLowerCase() === newUserEmail.toLowerCase()) {
      reasons.push('DIRECT_SELF_REFERRAL_EMAIL_MATCH');
      riskScoreDelta += 100;
    } else {
      // Email domain + name alias matching (e.g. john+ref1@gmail.com vs john@gmail.com)
      const normalizedReferrerBase = referrer.email.toLowerCase().replace(/\+.*@/, '@');
      const normalizedNewBase = newUserEmail.toLowerCase().replace(/\+.*@/, '@');
      if (normalizedReferrerBase === normalizedNewBase) {
        reasons.push('SELF_REFERRAL_EMAIL_ALIAS_MATCH');
        riskScoreDelta += 80;
      }
    }
  }

  // 3. Referrer recent fingerprint log check
  const referrerFpLogs = db.prepare(`
    SELECT COUNT(*) as cnt FROM client_fingerprint_logs
    WHERE user_id = ? AND fingerprint = ?
  `).get(referrerUserId, fingerprint) as any;

  if (Number(referrerFpLogs?.cnt || 0) > 0) {
    reasons.push('SELF_REFERRAL_REFERRER_FINGERPRINT_MATCH');
    riskScoreDelta += 75;
  }

  // 4. Referrer recent IP log check
  const referrerIpLogs = db.prepare(`
    SELECT COUNT(*) as cnt FROM client_fingerprint_logs
    WHERE user_id = ? AND ip_address = ? AND created_at > datetime('now', '-7 days')
  `).get(referrerUserId, ip) as any;

  if (Number(referrerIpLogs?.cnt || 0) > 0) {
    reasons.push('SELF_REFERRAL_REFERRER_IP_MATCH');
    riskScoreDelta += 40;
  }

  return {
    isSelfReferral: riskScoreDelta >= 70,
    riskScoreDelta,
    reasons,
  };
}

/**
 * Calculates total Risk Score (0 - 100) and returns anti-fraud evaluation result.
 */
export function evaluateReferralRisk(params: {
  referralCode: string;
  referrerUserId: string;
  newUserId?: string;
  newUserEmail?: string;
  req: Request;
}): {
  fingerprint: string;
  ip: string;
  riskScore: number;
  isQuarantined: boolean;
  isRejected: boolean;
  flags: string[];
} {
  const ip = getClientIp(params.req);
  const fingerprint = generateClientFingerprint(params.req);
  const flags: string[] = [];
  let riskScore = 0;

  // 1. Check IP & Fingerprint Velocity
  const velocity = checkReferralVelocity(ip, fingerprint);
  if (velocity.velocityExceeded) {
    flags.push(...velocity.reasons);
    riskScore += 35 * velocity.reasons.length;
  }

  // 2. Check Self-Referral Detection
  const selfRef = detectSelfReferral({
    referrerUserId: params.referrerUserId,
    newUserId: params.newUserId,
    newUserEmail: params.newUserEmail,
    ip,
    fingerprint,
  });

  if (selfRef.reasons.length > 0) {
    flags.push(...selfRef.reasons);
    riskScore += selfRef.riskScoreDelta;
  }

  // Cap risk score between 0 and 100
  riskScore = Math.min(100, Math.max(0, riskScore));

  const isQuarantined = riskScore >= RISK_THRESHOLDS.QUARANTINE_SCORE;
  const isRejected = riskScore >= RISK_THRESHOLDS.REJECT_SCORE;

  return {
    fingerprint,
    ip,
    riskScore,
    isQuarantined,
    isRejected,
    flags,
  };
}

/**
 * Quarantines a referral attempt/commission entry for admin review.
 */
export function quarantineReferral(params: {
  referralCode: string;
  referrerUserId: string;
  referredUserId?: string;
  clickId?: string;
  commissionId?: string;
  fingerprint: string;
  ipAddress: string;
  riskScore: number;
  reasons: string[];
}): string {
  const id = `quar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO referral_quarantine (
      id, referral_code, referrer_user_id, referred_user_id, click_id, commission_id,
      fingerprint, ip_address, risk_score, reasons, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined', ?)
  `).run(
    id,
    params.referralCode,
    params.referrerUserId,
    params.referredUserId || null,
    params.clickId || null,
    params.commissionId || null,
    params.fingerprint,
    params.ipAddress,
    params.riskScore,
    JSON.stringify(params.reasons),
    now
  );

  // Also log into legacy referral_fraud_log for backwards compatibility
  const fraudId = `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO referral_fraud_log (id, referral_code, ip_address, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    fraudId,
    params.referralCode,
    params.ipAddress,
    `QUARANTINED (Score: ${params.riskScore}): ${params.reasons.join(' | ')}`,
    now
  );

  recordAuditLog(
    params.referrerUserId,
    'REFERRAL_QUARANTINED',
    'referral_quarantine',
    id,
    {
      risk_score: params.riskScore,
      reasons: params.reasons,
      referred_user_id: params.referredUserId,
      commission_id: params.commissionId,
    }
  );

  return id;
}

/**
 * Express Middleware for Anti-Fraud Verification on Referral Endpoints.
 */
export function referralAntiFraudMiddleware(req: AntiFraudRequest, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const fingerprint = generateClientFingerprint(req);
  const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

  // Check velocity
  const velocity = checkReferralVelocity(ip, fingerprint);
  const flags = [...velocity.reasons];
  let riskScore = flags.length > 0 ? 35 * flags.length : 0;
  riskScore = Math.min(100, Math.max(0, riskScore));

  req.antiFraud = {
    fingerprint,
    ip,
    userAgent,
    riskScore,
    flags,
    isQuarantined: riskScore >= RISK_THRESHOLDS.QUARANTINE_SCORE,
  };

  // Log fingerprint for authenticated requests
  const authUser = (req as any).user;
  if (authUser?.id) {
    logClientFingerprint(authUser.id, req, fingerprint);
  }

  next();
}
