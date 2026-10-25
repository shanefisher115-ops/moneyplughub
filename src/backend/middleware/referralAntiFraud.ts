import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, recordAuditLog } from '../db';

export interface AntiFraudRequest extends Request {
  clientFingerprint?: string;
  clientIp?: string;
  antiFraudResult?: {
    isSuspicious: boolean;
    isSelfReferral: boolean;
    quarantineRequired: boolean;
    reason?: string;
    riskScore: number;
  };
}

/**
 * Generates a deterministic SHA-256 client fingerprint hash from HTTP headers & network attributes.
 */
export function generateClientFingerprint(req: Request): string {
  const explicitFingerprint = (req.headers['x-client-fingerprint'] as string || '').trim();
  if (explicitFingerprint) {
    return crypto.createHash('sha256').update(`explicit:${explicitFingerprint}`).digest('hex');
  }

  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] || '').trim();
  const acceptLang = (req.headers['accept-language'] || '').trim();
  const secChUa = (req.headers['sec-ch-ua'] as string || '').trim();
  const secChUaPlatform = (req.headers['sec-ch-ua-platform'] as string || '').trim();
  const acceptEncoding = (req.headers['accept-encoding'] || '').trim();

  const rawFingerprint = [
    `ip:${ip}`,
    `ua:${userAgent}`,
    `lang:${acceptLang}`,
    `sec_ua:${secChUa}`,
    `sec_platform:${secChUaPlatform}`,
    `encoding:${acceptEncoding}`
  ].join('|');

  return crypto.createHash('sha256').update(rawFingerprint).digest('hex');
}

/**
 * Helper to safely extract client IP address across proxy headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket?.remoteAddress || '127.0.0.1').trim();
}

/**
 * IP & Fingerprint Velocity Rate Checking
 * Limits frequency of referral clicks/requests per IP and Fingerprint.
 */
export function checkIpVelocity(ip: string, windowMinutes: number = 60, maxAllowed: number = 5): { exceeded: boolean; count: number } {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM referral_clicks
      WHERE ip_address = ? AND created_at > datetime('now', '-' || ? || ' minutes')
    `).get(ip, windowMinutes) as { cnt: number } | undefined;

    const count = Number(row?.cnt || 0);
    return { exceeded: count >= maxAllowed, count };
  } catch (err) {
    console.error('[AntiFraud] Error checking IP velocity:', err);
    return { exceeded: false, count: 0 };
  }
}

export function checkFingerprintVelocity(fingerprint: string, windowMinutes: number = 60, maxAllowed: number = 8): { exceeded: boolean; count: number } {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM referral_clicks
      WHERE client_fingerprint = ? AND created_at > datetime('now', '-' || ? || ' minutes')
    `).get(fingerprint, windowMinutes) as { cnt: number } | undefined;

    const count = Number(row?.cnt || 0);
    return { exceeded: count >= maxAllowed, count };
  } catch (err) {
    console.error('[AntiFraud] Error checking fingerprint velocity:', err);
    return { exceeded: false, count: 0 };
  }
}

/**
 * Self-Referral & Suspicious Pattern Risk Evaluator
 */
export function evaluateReferralRisk(params: {
  referrerId: string;
  referredUserId?: string;
  email?: string;
  ip: string;
  fingerprint: string;
  cookies?: Record<string, string>;
}): {
  isSuspicious: boolean;
  isSelfReferral: boolean;
  quarantineRequired: boolean;
  reason?: string;
  riskScore: number; // 0 to 100 scale
} {
  const { referrerId, referredUserId, email, ip, fingerprint } = params;
  let riskScore = 0;
  const reasons: string[] = [];
  let isSelfReferral = false;

  // 1. Direct ID match
  if (referredUserId && referredUserId === referrerId) {
    isSelfReferral = true;
    riskScore += 100;
    reasons.push('Direct user ID self-referral match');
  }

  // Fetch referrer profile for comparison
  const referrer = db.prepare('SELECT id, email FROM users WHERE id = ?').get(referrerId) as { id: string; email: string } | undefined;

  if (referrer) {
    // 2. Email match or same domain / alias pattern
    if (email) {
      const normalizedRefEmail = email.trim().toLowerCase();
      const normalizedReferrerEmail = referrer.email.trim().toLowerCase();

      if (normalizedRefEmail === normalizedReferrerEmail) {
        isSelfReferral = true;
        riskScore += 100;
        reasons.push('Email address identical to referrer email');
      } else {
        // Check email alias patterns (e.g. user+1@gmail.com vs user+2@gmail.com)
        const [refLocal, refDomain] = normalizedRefEmail.split('@');
        const [referrerLocal, referrerDomain] = normalizedReferrerEmail.split('@');

        if (refDomain === referrerDomain) {
          const refBase = refLocal.split('+')[0];
          const referrerBase = referrerLocal.split('+')[0];
          if (refBase === referrerBase && refBase.length > 2) {
            isSelfReferral = true;
            riskScore += 80;
            reasons.push(`Email alias pattern match (${refBase}...)`);
          }
        }
      }
    }

    // 3. Fingerprint match with referrer's recent clicks or logins
    const matchingFingerprint = db.prepare(`
      SELECT id FROM referral_clicks
      WHERE referrer_user_id = ? AND client_fingerprint = ? AND created_at > datetime('now', '-30 days')
      LIMIT 1
    `).get(referrerId, fingerprint);

    if (matchingFingerprint) {
      riskScore += 50;
      reasons.push('Client fingerprint matches referrer device history');
    }

    // 4. IP match with referrer's recent clicks
    const matchingIp = db.prepare(`
      SELECT id FROM referral_clicks
      WHERE referrer_user_id = ? AND ip_address = ? AND created_at > datetime('now', '-14 days')
      LIMIT 1
    `).get(referrerId, ip);

    if (matchingIp) {
      riskScore += 40;
      reasons.push('IP address matches referrer activity within 14 days');
    }
  }

  const isSuspicious = riskScore >= 50;
  const quarantineRequired = isSelfReferral || riskScore >= 70;

  return {
    isSuspicious,
    isSelfReferral,
    quarantineRequired,
    reason: reasons.join('; ') || undefined,
    riskScore: Math.min(100, riskScore)
  };
}

/**
 * Express Middleware for Client Fingerprinting & IP Velocity Enforcement
 */
export function referralAntiFraudMiddleware(req: AntiFraudRequest, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const fingerprint = generateClientFingerprint(req);

  req.clientIp = ip;
  req.clientFingerprint = fingerprint;

  // Check IP Velocity (max 5 clicks/hour)
  const ipVelocity = checkIpVelocity(ip, 60, 5);
  if (ipVelocity.exceeded) {
    const now = new Date().toISOString();
    const code = (req.params.code || req.body?.referral_code || 'UNKNOWN').toString().toUpperCase();

    db.prepare(`
      INSERT INTO referral_fraud_log (id, referral_code, ip_address, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code,
      ip,
      `IP velocity limit exceeded (${ipVelocity.count} clicks/hour)`,
      now
    );

    recordAuditLog(null, 'REFERRAL_VELOCITY_BLOCKED', 'referral_clicks', code, {
      ip,
      fingerprint,
      click_count: ipVelocity.count
    });

    // If request accepts HTML / is a redirect route (like /track/:code), allow redirect with cookie but log flag
    if (req.accepts('html') && req.params.code) {
      res.cookie('ref', code, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
      res.redirect(req.query.redirect as string || `/?ref=${code}`);
      return;
    }

    res.status(429).json({
      success: false,
      error: 'Referral tracking velocity limit reached. Please try again later.'
    });
    return;
  }

  // Check Fingerprint Velocity (max 8 clicks/hour)
  const fpVelocity = checkFingerprintVelocity(fingerprint, 60, 8);
  if (fpVelocity.exceeded) {
    const now = new Date().toISOString();
    const code = (req.params.code || req.body?.referral_code || 'UNKNOWN').toString().toUpperCase();

    db.prepare(`
      INSERT INTO referral_fraud_log (id, referral_code, ip_address, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `fraud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code,
      ip,
      `Fingerprint velocity limit exceeded (${fpVelocity.count} clicks/hour, FP: ${fingerprint.substring(0, 10)})`,
      now
    );

    if (req.accepts('html') && req.params.code) {
      res.cookie('ref', code, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
      res.redirect(req.query.redirect as string || `/?ref=${code}`);
      return;
    }

    res.status(429).json({
      success: false,
      error: 'Too many referral requests from this client environment.'
    });
    return;
  }

  next();
}
