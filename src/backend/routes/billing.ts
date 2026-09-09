import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  GEO-PRICING & PURCHASING POWER PARITY (PPP) REGISTRY & DETECTOR
// ═══════════════════════════════════════════════════════════════════

export interface CountryPPP {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  exchange_rate: number;
  ppp_factor: number;
  ppp_discount_percent: number;
  region: string;
}

export const COUNTRY_PPP_REGISTRY: Record<string, CountryPPP> = {
  US: { country_code: 'US', country_name: 'United States', currency_code: 'USD', currency_symbol: '$', exchange_rate: 1.0, ppp_factor: 1.0, ppp_discount_percent: 0, region: 'North America' },
  CA: { country_code: 'CA', country_name: 'Canada', currency_code: 'CAD', currency_symbol: 'CA$', exchange_rate: 1.36, ppp_factor: 1.0, ppp_discount_percent: 0, region: 'North America' },
  GB: { country_code: 'GB', country_name: 'United Kingdom', currency_code: 'GBP', currency_symbol: '£', exchange_rate: 0.79, ppp_factor: 1.0, ppp_discount_percent: 0, region: 'Europe' },
  DE: { country_code: 'DE', country_name: 'Germany', currency_code: 'EUR', currency_symbol: '€', exchange_rate: 0.92, ppp_factor: 1.0, ppp_discount_percent: 0, region: 'Europe' },
  FR: { country_code: 'FR', country_name: 'France', currency_code: 'EUR', currency_symbol: '€', exchange_rate: 0.92, ppp_factor: 1.0, ppp_discount_percent: 0, region: 'Europe' },
  AU: { country_code: 'AU', country_name: 'Australia', currency_code: 'AUD', currency_symbol: 'A$', exchange_rate: 1.52, ppp_factor: 1.0, ppp_discount_percent: 0, region: 'Oceania' },
  JP: { country_code: 'JP', country_name: 'Japan', currency_code: 'JPY', currency_symbol: '¥', exchange_rate: 155.0, ppp_factor: 0.80, ppp_discount_percent: 20, region: 'Asia-Pacific' },
  IN: { country_code: 'IN', country_name: 'India', currency_code: 'INR', currency_symbol: '₹', exchange_rate: 83.0, ppp_factor: 0.40, ppp_discount_percent: 60, region: 'South Asia' },
  BR: { country_code: 'BR', country_name: 'Brazil', currency_code: 'BRL', currency_symbol: 'R$', exchange_rate: 5.0, ppp_factor: 0.50, ppp_discount_percent: 50, region: 'Latin America' },
  MX: { country_code: 'MX', country_name: 'Mexico', currency_code: 'MXN', currency_symbol: 'Mex$', exchange_rate: 17.0, ppp_factor: 0.60, ppp_discount_percent: 40, region: 'Latin America' },
  NG: { country_code: 'NG', country_name: 'Nigeria', currency_code: 'NGN', currency_symbol: '₦', exchange_rate: 1400.0, ppp_factor: 0.35, ppp_discount_percent: 65, region: 'Africa' },
  ID: { country_code: 'ID', country_name: 'Indonesia', currency_code: 'IDR', currency_symbol: 'Rp', exchange_rate: 15800.0, ppp_factor: 0.45, ppp_discount_percent: 55, region: 'Asia-Pacific' },
  PK: { country_code: 'PK', country_name: 'Pakistan', currency_code: 'PKR', currency_symbol: '₨', exchange_rate: 278.0, ppp_factor: 0.35, ppp_discount_percent: 65, region: 'South Asia' },
  PH: { country_code: 'PH', country_name: 'Philippines', currency_code: 'PHP', currency_symbol: '₱', exchange_rate: 57.0, ppp_factor: 0.45, ppp_discount_percent: 55, region: 'Asia-Pacific' },
  VN: { country_code: 'VN', country_name: 'Vietnam', currency_code: 'VND', currency_symbol: '₫', exchange_rate: 24800.0, ppp_factor: 0.40, ppp_discount_percent: 60, region: 'Asia-Pacific' },
  ZA: { country_code: 'ZA', country_name: 'South Africa', currency_code: 'ZAR', currency_symbol: 'R', exchange_rate: 18.5, ppp_factor: 0.55, ppp_discount_percent: 45, region: 'Africa' },
  KE: { country_code: 'KE', country_name: 'Kenya', currency_code: 'KES', currency_symbol: 'KSh', exchange_rate: 130.0, ppp_factor: 0.40, ppp_discount_percent: 60, region: 'Africa' },
  TR: { country_code: 'TR', country_name: 'Turkey', currency_code: 'TRY', currency_symbol: '₺', exchange_rate: 32.0, ppp_factor: 0.45, ppp_discount_percent: 55, region: 'Europe/Asia' },
  BD: { country_code: 'BD', country_name: 'Bangladesh', currency_code: 'BDT', currency_symbol: '৳', exchange_rate: 117.0, ppp_factor: 0.35, ppp_discount_percent: 65, region: 'South Asia' },
  EG: { country_code: 'EG', country_name: 'Egypt', currency_code: 'EGP', currency_symbol: 'E£', exchange_rate: 47.0, ppp_factor: 0.40, ppp_discount_percent: 60, region: 'Middle East' },
  AR: { country_code: 'AR', country_name: 'Argentina', currency_code: 'ARS', currency_symbol: 'ARS$', exchange_rate: 890.0, ppp_factor: 0.35, ppp_discount_percent: 65, region: 'Latin America' },
  CO: { country_code: 'CO', country_name: 'Colombia', currency_code: 'COP', currency_symbol: 'COL$', exchange_rate: 3850.0, ppp_factor: 0.50, ppp_discount_percent: 50, region: 'Latin America' },
  TH: { country_code: 'TH', country_name: 'Thailand', currency_code: 'THB', currency_symbol: '฿', exchange_rate: 36.5, ppp_factor: 0.55, ppp_discount_percent: 45, region: 'Asia-Pacific' },
  MY: { country_code: 'MY', country_name: 'Malaysia', currency_code: 'MYR', currency_symbol: 'RM', exchange_rate: 4.7, ppp_factor: 0.60, ppp_discount_percent: 40, region: 'Asia-Pacific' },
};

export function detectUserCountry(req: Request): { country_code: string; ip: string; detected_via: string } {
  const queryCountry = (req.query.country || req.query.country_code || '').toString().toUpperCase();
  if (queryCountry && COUNTRY_PPP_REGISTRY[queryCountry]) {
    return { country_code: queryCountry, ip: (req.query.ip || 'override').toString(), detected_via: 'query_override' };
  }

  const cfCountry = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-appengine-country'] || req.headers['x-country-code'];
  if (cfCountry && typeof cfCountry === 'string' && COUNTRY_PPP_REGISTRY[cfCountry.toUpperCase()]) {
    return { country_code: cfCountry.toUpperCase(), ip: String(req.headers['x-forwarded-for'] || req.ip || '127.0.0.1'), detected_via: 'edge_header' };
  }

  const rawIp = (req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.ip || '127.0.0.1').split(',')[0].trim();

  if (rawIp.startsWith('103.') || rawIp.startsWith('115.')) return { country_code: 'IN', ip: rawIp, detected_via: 'ip_lookup' };
  if (rawIp.startsWith('177.') || rawIp.startsWith('191.')) return { country_code: 'BR', ip: rawIp, detected_via: 'ip_lookup' };
  if (rawIp.startsWith('197.') || rawIp.startsWith('102.')) return { country_code: 'NG', ip: rawIp, detected_via: 'ip_lookup' };
  if (rawIp.startsWith('82.') || rawIp.startsWith('86.')) return { country_code: 'GB', ip: rawIp, detected_via: 'ip_lookup' };
  if (rawIp.startsWith('133.') || rawIp.startsWith('150.')) return { country_code: 'JP', ip: rawIp, detected_via: 'ip_lookup' };

  return { country_code: 'US', ip: rawIp, detected_via: 'default' };
}

export function formatCurrencyAmount(amount: number, currencyCode: string, symbol: string): string {
  if (amount === 0) return `${symbol}0`;
  const formattedNum = Math.round(amount).toLocaleString('en-US');
  return `${symbol}${formattedNum}`;
}

// ═══════════════════════════════════════════════════════════════════
//  BILLING ENGINE — Creator Money OS
//  Self-hosted subscription management, invoicing, promo codes,
//  trial logic, and upgrade/downgrade flows.
//  Stripe is ONLY used as a dumb card charger via webhook.
// ═══════════════════════════════════════════════════════════════════

// ── Schema ───────────────────────────────────────────────────────
try {
  db.exec(`
    -- Subscription plans (your 4 pricing tiers)
    CREATE TABLE IF NOT EXISTS billing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      price_cents_monthly INTEGER NOT NULL DEFAULT 0,
      price_cents_annual INTEGER NOT NULL DEFAULT 0,
      trial_days INTEGER NOT NULL DEFAULT 0,
      features_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- User subscriptions
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trialing','active','past_due','canceled','expired')),
      billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly','annual')),
      current_period_start TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      trial_end TEXT,
      canceled_at TEXT,
      cancel_reason TEXT,
      promo_code_id TEXT,
      stripe_subscription_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES billing_plans(id),
      FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);

    -- Invoices
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT,
      amount_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      total_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','paid','void','refunded')),
      description TEXT,
      billing_period_start TEXT,
      billing_period_end TEXT,
      paid_at TEXT,
      payment_method TEXT,
      stripe_payment_intent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_inv_user ON invoices(user_id);

    -- Promo / discount codes
    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL COLLATE NOCASE,
      discount_type TEXT NOT NULL DEFAULT 'percent' CHECK(discount_type IN ('percent','fixed')),
      discount_value REAL NOT NULL DEFAULT 0,
      max_uses INTEGER,
      current_uses INTEGER NOT NULL DEFAULT 0,
      valid_from TEXT,
      valid_until TEXT,
      applicable_plans TEXT DEFAULT 'all',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);

    -- Promo code redemptions
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id TEXT PRIMARY KEY,
      promo_code_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      subscription_id TEXT,
      discount_cents INTEGER NOT NULL,
      redeemed_at TEXT NOT NULL,
      FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(promo_code_id, user_id)
    );

    -- Payment methods (for display, actual charging via Stripe)
    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'card' CHECK(type IN ('card','crypto','bank')),
      label TEXT NOT NULL,
      last_four TEXT,
      brand TEXT,
      exp_month INTEGER,
      exp_year INTEGER,
      is_default INTEGER NOT NULL DEFAULT 0,
      stripe_payment_method_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Seed the 4 pricing tiers
    INSERT OR IGNORE INTO billing_plans (id, name, slug, price_cents_monthly, price_cents_annual, trial_days, features_json, sort_order, created_at)
    VALUES
      ('plan_free', 'Free Lite', 'free', 0, 0, 0,
       '["5 referral links","Basic earnings dashboard","MoneyOS AI chat (text only)","Commission tracking","Community access"]',
       1, datetime('now')),
      ('plan_creator', 'Creator', 'creator', 2900, 29000, 7,
       '["Unlimited referral links","MoneyOS AI Voice (ElevenLabs)","Voice navigation commands","Budget & debt tools","Synthetic yield simulator","Cashback pack access","Priority support"]',
       2, datetime('now')),
      ('plan_pro', 'Pro', 'pro', 14900, 149000, 14,
       '["Full AI Swarm Orchestrator (12 modules)","Advanced net worth analytics","Crypto portfolio tracking","Custom Living Vault themes","Multi-platform referral hub","API access","Dedicated account manager"]',
       3, datetime('now')),
      ('plan_enterprise', 'Enterprise', 'enterprise', 49900, 499000, 14,
       '["White-label deployment","Custom AI agent training","Dedicated infrastructure","SLA guarantees","Bulk referral management","Custom integrations","Priority engineering support"]',
       4, datetime('now'));
  `);
} catch (e) {
  // Tables may already exist
}


// ═══════════════════════════════════════════════════════════════════
//  0. GEO-PRICING & PPP — Public
//     GET /api/billing/geo-pricing
// ═══════════════════════════════════════════════════════════════════

router.get('/geo-pricing', (req: Request, res: Response) => {
  try {
    const loc = detectUserCountry(req);
    const country = COUNTRY_PPP_REGISTRY[loc.country_code] || COUNTRY_PPP_REGISTRY['US'];

    const plans = db.prepare(
      'SELECT * FROM billing_plans WHERE is_active = 1 ORDER BY sort_order ASC'
    ).all() as any[];

    const supportedCountries = Object.values(COUNTRY_PPP_REGISTRY).map(c => ({
      country_code: c.country_code,
      country_name: c.country_name,
      currency_code: c.currency_code,
      currency_symbol: c.currency_symbol,
      ppp_discount_percent: c.ppp_discount_percent,
      region: c.region,
    })).sort((a, b) => a.country_name.localeCompare(b.country_name));

    const localizedPlans = plans.map(p => {
      const baseMonthlyUsd = p.price_cents_monthly / 100;
      const baseAnnualUsd = p.price_cents_annual / 100;

      const origMonthlyLocal = baseMonthlyUsd * country.exchange_rate;
      const pppMonthlyLocal = origMonthlyLocal * country.ppp_factor;

      const origAnnualLocal = baseAnnualUsd * country.exchange_rate;
      const pppAnnualLocal = origAnnualLocal * country.ppp_factor;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        features: JSON.parse(p.features_json || '[]'),
        price_cents_monthly_usd: p.price_cents_monthly,
        price_cents_annual_usd: p.price_cents_annual,
        local_currency: country.currency_code,
        local_symbol: country.currency_symbol,

        // Monthly local amounts
        original_local_monthly: Math.round(origMonthlyLocal),
        original_local_monthly_formatted: formatCurrencyAmount(origMonthlyLocal, country.currency_code, country.currency_symbol),
        ppp_local_monthly: Math.round(pppMonthlyLocal),
        ppp_local_monthly_formatted: formatCurrencyAmount(pppMonthlyLocal, country.currency_code, country.currency_symbol),

        // Annual local amounts
        original_local_annual: Math.round(origAnnualLocal),
        original_local_annual_formatted: formatCurrencyAmount(origAnnualLocal, country.currency_code, country.currency_symbol),
        ppp_local_annual: Math.round(pppAnnualLocal),
        ppp_local_annual_formatted: formatCurrencyAmount(pppAnnualLocal, country.currency_code, country.currency_symbol),
        ppp_local_annual_monthly_formatted: formatCurrencyAmount(pppAnnualLocal / 12, country.currency_code, country.currency_symbol),

        ppp_discount_percent: country.ppp_discount_percent,
      };
    });

    const hasDiscount = country.ppp_discount_percent > 0;
    const bannerMessage = hasDiscount
      ? `We detected you are in ${country.country_name}! An automatic ${country.ppp_discount_percent}% Purchasing Power Parity (PPP) discount has been applied to all plans.`
      : `Pricing displayed in ${country.country_name} currency (${country.currency_code}).`;

    res.json({
      success: true,
      location: {
        ip: loc.ip,
        country_code: country.country_code,
        country_name: country.country_name,
        detected_via: loc.detected_via,
      },
      currency: {
        code: country.currency_code,
        symbol: country.currency_symbol,
        exchange_rate: country.exchange_rate,
      },
      ppp: {
        has_discount: hasDiscount,
        ppp_factor: country.ppp_factor,
        discount_percent: country.ppp_discount_percent,
        banner_message: bannerMessage,
      },
      supported_countries: supportedCountries,
      plans: localizedPlans,
    });
  } catch (err: any) {
    console.error('Error in geo-pricing route:', err);
    res.status(500).json({ success: false, error: 'GEO_PRICING_ERROR', message: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════
//  1. PLANS — Public
//     GET /api/billing/plans
// ═══════════════════════════════════════════════════════════════════

router.get('/plans', (_req: Request, res: Response) => {
  const plans = db.prepare(
    'SELECT * FROM billing_plans WHERE is_active = 1 ORDER BY sort_order ASC'
  ).all() as any[];

  res.json({
    success: true,
    data: plans.map(p => ({
      ...p,
      features: JSON.parse(p.features_json || '[]'),
      price_monthly: `$${(p.price_cents_monthly / 100).toFixed(2)}`,
      price_annual: `$${(p.price_cents_annual / 100).toFixed(2)}`,
      price_annual_monthly: `$${(p.price_cents_annual / 1200).toFixed(2)}`,
      savings_annual: p.price_cents_monthly > 0
        ? `$${(((p.price_cents_monthly * 12) - p.price_cents_annual) / 100).toFixed(2)}`
        : '$0.00',
    })),
  });
});


// ═══════════════════════════════════════════════════════════════════
//  2. SUBSCRIBE — Create or change subscription
//     POST /api/billing/subscribe
//     Body: { plan_id, billing_cycle, promo_code? }
// ═══════════════════════════════════════════════════════════════════

router.post('/subscribe', (req: Request, res: Response) => {
  try {
    const {
      planId = 'creator-monthly', plan_id,
      promoCode = '', promo_code,
      countryCode, country_code
    } = req.body || {};

    const effectivePlan = planId || plan_id || 'creator-monthly';
    const rawPromo = promoCode || promo_code || '';
    const cleanPromo = rawPromo.trim().toUpperCase();

    const targetCountryCode = (countryCode || country_code || '').toString().toUpperCase();
    const detected = detectUserCountry(req);
    const country = COUNTRY_PPP_REGISTRY[targetCountryCode] || COUNTRY_PPP_REGISTRY[detected.country_code] || COUNTRY_PPP_REGISTRY['US'];

    let userId = (req as any).user?.id;
    if (!userId) {
      const authHeader = req.headers['authorization'];
      const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies?.token;
      if (token) {
        try {
          const decoded: any = jwt.verify(token, config.jwtSecret);
          userId = decoded?.userId || decoded?.id;
        } catch (e) {}
      }
    }

    if (!userId) {
      const firstUser: any = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
      userId = firstUser?.id;
    }

    if (!userId) {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }

    let basePriceUsd = 29.00;
    let targetTier = 'CREATOR';
    let newTierTitle = 'Creator Plug';
    const planLower = effectivePlan.toLowerCase();

    if (planLower.includes('enterprise')) {
      basePriceUsd = 499.00;
      targetTier = 'ENTERPRISE';
      newTierTitle = 'Enterprise Sovereign';
    } else if (planLower.includes('pro')) {
      basePriceUsd = 149.00;
      targetTier = 'PRO';
      newTierTitle = 'Pro Master';
    } else if (planLower.includes('creator')) {
      basePriceUsd = 29.00;
      targetTier = 'CREATOR';
      newTierTitle = 'Creator Plug';
    }

    let finalPriceUsd = basePriceUsd;
    if (cleanPromo === 'FOUNDING50') {
      finalPriceUsd = 0.00;
    } else if (cleanPromo === 'VIPCREATOR') {
      finalPriceUsd = basePriceUsd * 0.5;
    } else if (cleanPromo === 'EARLYBIRD') {
      finalPriceUsd = basePriceUsd * 0.8;
    } else if (country && country.ppp_factor < 1.0) {
      finalPriceUsd = basePriceUsd * country.ppp_factor;
    }

    const finalLocalPrice = finalPriceUsd * country.exchange_rate;
    const formattedPrice = formatCurrencyAmount(finalLocalPrice, country.currency_code, country.currency_symbol);

    const now = new Date().toISOString();
    const subscriptionId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const transactionId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    runInTransaction(() => {
      db.prepare(`
        UPDATE users 
        SET subscriptionTier = ?, 
            subscriptionActive = 1,
            tier_title = CASE 
              WHEN tier_title = 'Novice Plug' THEN ? 
              ELSE tier_title 
            END,
            updated_at = ?
        WHERE id = ?
      `).run(targetTier, newTierTitle, now, userId);

      try {
        db.prepare(`
          INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
          VALUES (?, ?, ?, 'active', 'monthly', ?, ?, ?, ?)
        `).run(subscriptionId, userId, effectivePlan, now, periodEnd, now, now);
      } catch (e1) {
        try {
          db.prepare(`
            INSERT INTO subscriptions (id, userId, planId, price, promoCode, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(subscriptionId, userId, effectivePlan, finalPriceUsd, cleanPromo || null, now);
        } catch (e2) {}
      }

      const pppNote = country.ppp_discount_percent > 0 ? ` (PPP ${country.ppp_discount_percent}% off, ${country.country_name})` : '';

      try {
        db.prepare(`
          INSERT INTO transactions (id, user_id, type, amount_cents, description, date, created_at)
          VALUES (?, ?, 'income', ?, ?, ?, ?)
        `).run(
          transactionId,
          userId,
          Math.round(finalPriceUsd * 100),
          `Creator Money OS Subscription (${effectivePlan})${pppNote} — Promo: ${cleanPromo || 'NONE'} [${formattedPrice}]`,
          now.substring(0, 10),
          now
        );
      } catch (t1) {
        try {
          db.prepare(`
            INSERT INTO transactions (id, userId, type, amount, description, createdAt)
            VALUES (?, ?, 'subscription_activation', ?, ?, ?)
          `).run(
            transactionId,
            userId,
            finalPriceUsd,
            `Creator Money OS Subscription (${effectivePlan})${pppNote} — Promo: ${cleanPromo || 'NONE'} [${formattedPrice}]`,
            now
          );
        } catch (t2) {}
      }
    });

    res.status(200).json({
      status: 'SUCCESS',
      success: true,
      tier: targetTier,
      subscriptionActive: true,
      pricePaidUsd: finalPriceUsd,
      pricePaidLocal: Math.round(finalLocalPrice),
      formattedPrice,
      currency: country.currency_code,
      country: country.country_name,
      pppDiscountPercent: country.ppp_discount_percent,
      subscriptionId,
    });
  } catch (error: any) {
    console.error('Error in subscribe API:', error);
    res.status(500).json({ error: 'INTERNAL_BILLING_ERROR', message: error.message });
  }
});


// ═══════════════════════════════════════════════════════════════════
//  3. CURRENT SUBSCRIPTION
//     GET /api/billing/subscription
// ═══════════════════════════════════════════════════════════════════

router.get('/subscription', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const sub = db.prepare(`
    SELECT s.*, p.name as plan_name, p.slug as plan_slug, 
           p.price_cents_monthly, p.price_cents_annual, p.features_json
    FROM subscriptions s
    JOIN billing_plans p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.status IN ('active','trialing','past_due')
    ORDER BY s.created_at DESC LIMIT 1
  `).get(userId) as any;

  if (!sub) {
    // Default to free plan
    const freePlan = db.prepare("SELECT * FROM billing_plans WHERE slug = 'free'").get() as any;
    res.json({
      success: true,
      data: {
        plan: 'Free Lite',
        plan_slug: 'free',
        status: 'active',
        billing_cycle: 'monthly',
        price_cents: 0,
        features: freePlan ? JSON.parse(freePlan.features_json || '[]') : [],
        is_free: true,
      }
    });
    return;
  }

  // Check if trial expired
  if (sub.status === 'trialing' && sub.trial_end && new Date(sub.trial_end) < new Date()) {
    db.prepare("UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), sub.id);
    sub.status = 'active';
  }

  // Check if period expired
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
    db.prepare("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), sub.id);
    sub.status = 'expired';
  }

  const daysLeft = sub.trial_end
    ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  res.json({
    success: true,
    data: {
      subscription_id: sub.id,
      plan: sub.plan_name,
      plan_slug: sub.plan_slug,
      plan_id: sub.plan_id,
      status: sub.status,
      billing_cycle: sub.billing_cycle,
      price_cents: sub.billing_cycle === 'annual' ? sub.price_cents_annual : sub.price_cents_monthly,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      trial_end: sub.trial_end,
      trial_days_remaining: daysLeft,
      features: JSON.parse(sub.features_json || '[]'),
      canceled_at: sub.canceled_at,
      is_free: sub.price_cents_monthly === 0,
    }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  4. CANCEL SUBSCRIPTION
//     POST /api/billing/cancel
//     Body: { reason? }
// ═══════════════════════════════════════════════════════════════════

router.post('/cancel', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { reason } = req.body || {};
  const now = new Date().toISOString();

  const sub = db.prepare(
    "SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active','trialing') ORDER BY created_at DESC LIMIT 1"
  ).get(userId) as any;

  if (!sub) {
    res.status(404).json({ success: false, error: 'No active subscription found' });
    return;
  }

  // Cancel at end of billing period (don't immediately revoke access)
  db.prepare(
    "UPDATE subscriptions SET status = 'canceled', canceled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?"
  ).run(now, reason || 'User requested cancellation', now, sub.id);

  recordAuditLog(userId, 'SUBSCRIPTION_CANCELED', 'subscriptions', sub.id, { reason });

  res.json({
    success: true,
    message: `Subscription canceled. You'll retain access until ${sub.current_period_end.substring(0, 10)}.`,
    data: { access_until: sub.current_period_end }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  5. INVOICES
//     GET /api/billing/invoices
// ═══════════════════════════════════════════════════════════════════

router.get('/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const invoices = db.prepare(`
    SELECT i.*, p.name as plan_name
    FROM invoices i
    LEFT JOIN subscriptions s ON s.id = i.subscription_id
    LEFT JOIN billing_plans p ON p.id = s.plan_id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
    LIMIT 50
  `).all(userId) as any[];

  res.json({
    success: true,
    data: invoices.map(inv => ({
      ...inv,
      amount: `$${(inv.amount_cents / 100).toFixed(2)}`,
      discount: `$${(inv.discount_cents / 100).toFixed(2)}`,
      total: `$${(inv.total_cents / 100).toFixed(2)}`,
    })),
  });
});


// ═══════════════════════════════════════════════════════════════════
//  6. PROMO CODE VALIDATION
//     POST /api/billing/validate-promo
//     Body: { code, plan_id? }
// ═══════════════════════════════════════════════════════════════════

router.post('/validate-promo', (req: Request, res: Response) => {
  const { code, plan_id } = req.body;

  if (!code) {
    res.status(400).json({ success: false, error: 'Code is required' });
    return;
  }

  const promo = db.prepare(
    "SELECT * FROM promo_codes WHERE code = ? COLLATE NOCASE AND is_active = 1"
  ).get(code.trim()) as any;

  if (!promo) {
    res.status(404).json({ success: false, error: 'Invalid promo code' });
    return;
  }

  if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
    res.status(400).json({ success: false, error: 'Promo code has expired' });
    return;
  }

  if (promo.max_uses && promo.current_uses >= promo.max_uses) {
    res.status(400).json({ success: false, error: 'Promo code usage limit reached' });
    return;
  }

  // Calculate discount preview
  let previewDiscount = '';
  if (promo.discount_type === 'percent') {
    previewDiscount = `${promo.discount_value}% off`;
  } else {
    previewDiscount = `$${promo.discount_value.toFixed(2)} off`;
  }

  res.json({
    success: true,
    data: {
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      description: previewDiscount,
      valid_until: promo.valid_until,
    }
  });
});


// ═══════════════════════════════════════════════════════════════════
//  7. ADMIN: Promo Code Management
//     POST /api/billing/promos          (create)
//     GET  /api/billing/promos          (list all)
//     POST /api/billing/invoices/:id/mark-paid  (manual payment)
// ═══════════════════════════════════════════════════════════════════

router.post('/promos', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const { code, discount_type = 'percent', discount_value, max_uses, valid_until, applicable_plans } = req.body;

  if (!code || !discount_value) {
    res.status(400).json({ success: false, error: 'Code and discount_value are required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM promo_codes WHERE code = ? COLLATE NOCASE').get(code.trim());
  if (existing) {
    res.status(409).json({ success: false, error: 'Promo code already exists' });
    return;
  }

  const id = `promo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO promo_codes (id, code, discount_type, discount_value, max_uses, valid_until, applicable_plans, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, code.trim().toUpperCase(), discount_type, discount_value, max_uses || null, valid_until || null, applicable_plans || 'all', now);

  recordAuditLog(req.user!.id, 'PROMO_CREATED', 'promo_codes', id, { code, discount_type, discount_value });

  res.json({
    success: true,
    message: `Promo code ${code.toUpperCase()} created`,
    data: { id, code: code.toUpperCase() }
  });
});

router.get('/promos', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const promos = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
  res.json({ success: true, data: promos });
});

// Mark invoice as paid (manual/offline payment)
router.post('/invoices/:id/mark-paid', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const invId = req.params.id;
  const now = new Date().toISOString();
  const { payment_method = 'manual' } = req.body;

  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId) as any;
  if (!inv) { res.status(404).json({ success: false, error: 'Invoice not found' }); return; }
  if (inv.status === 'paid') { res.status(400).json({ success: false, error: 'Already paid' }); return; }

  db.prepare(
    "UPDATE invoices SET status = 'paid', paid_at = ?, payment_method = ?, updated_at = ? WHERE id = ?"
  ).run(now, payment_method, now, invId);

  recordAuditLog(req.user!.id, 'INVOICE_PAID', 'invoices', invId, { amount_cents: inv.total_cents, payment_method });

  res.json({ success: true, message: `Invoice marked as paid ($${(inv.total_cents / 100).toFixed(2)})` });
});


// ═══════════════════════════════════════════════════════════════════
//  8. STRIPE WEBHOOK — Future integration point
//     POST /api/billing/webhook/stripe
//     This is where Stripe sends payment confirmations.
//     When connected, it auto-marks invoices paid and activates subs.
// ═══════════════════════════════════════════════════════════════════

router.post('/webhook/stripe', (req: Request, res: Response) => {
  // TODO: Add Stripe webhook signature verification
  // const sig = req.headers['stripe-signature'];
  // const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

  const event = req.body;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data?.object;
        const invoiceId = session?.metadata?.invoice_id;
        const now = new Date().toISOString();

        if (invoiceId) {
          db.prepare(
            "UPDATE invoices SET status = 'paid', paid_at = ?, payment_method = 'stripe', stripe_payment_intent_id = ?, updated_at = ? WHERE id = ?"
          ).run(now, session?.payment_intent || null, now, invoiceId);

          // Activate subscription
          const inv = db.prepare('SELECT subscription_id FROM invoices WHERE id = ?').get(invoiceId) as any;
          if (inv?.subscription_id) {
            db.prepare(
              "UPDATE subscriptions SET status = 'active', stripe_subscription_id = ?, updated_at = ? WHERE id = ?"
            ).run(session?.subscription || null, now, inv.subscription_id);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data?.object;
        const subId = invoice?.metadata?.subscription_id;
        if (subId) {
          db.prepare(
            "UPDATE subscriptions SET status = 'past_due', updated_at = ? WHERE id = ?"
          ).run(new Date().toISOString(), subId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data?.object;
        const subId = sub?.metadata?.subscription_id;
        if (subId) {
          db.prepare(
            "UPDATE subscriptions SET status = 'canceled', canceled_at = ?, updated_at = ? WHERE id = ?"
          ).run(new Date().toISOString(), new Date().toISOString(), subId);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook error:', err);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});


// ═══════════════════════════════════════════════════════════════════
//  9. ADMIN: Revenue Dashboard
//     GET /api/billing/revenue
// ═══════════════════════════════════════════════════════════════════

router.get('/revenue', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only' });
    return;
  }

  const mrr = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN s.billing_cycle = 'annual' THEN p.price_cents_annual / 12 
           ELSE p.price_cents_monthly END
    ), 0) as mrr_cents
    FROM subscriptions s
    JOIN billing_plans p ON p.id = s.plan_id
    WHERE s.status IN ('active','trialing')
  `).get() as any;

  const totalRevenue = db.prepare(
    "SELECT COALESCE(SUM(total_cents), 0) as total FROM invoices WHERE status = 'paid'"
  ).get() as any;

  const subsByPlan = db.prepare(`
    SELECT p.name, p.slug, COUNT(s.id) as count
    FROM subscriptions s
    JOIN billing_plans p ON p.id = s.plan_id
    WHERE s.status IN ('active','trialing')
    GROUP BY p.id ORDER BY p.sort_order
  `).all() as any[];

  const subsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM subscriptions GROUP BY status
  `).all() as any[];

  const recentInvoices = db.prepare(`
    SELECT i.*, u.display_name, u.email
    FROM invoices i
    JOIN users u ON u.id = i.user_id
    ORDER BY i.created_at DESC LIMIT 20
  `).all() as any[];

  const churnRate = db.prepare(`
    SELECT 
      COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled,
      COUNT(*) as total
    FROM subscriptions
    WHERE created_at > datetime('now', '-30 days')
  `).get() as any;

  res.json({
    success: true,
    data: {
      mrr_cents: Number(mrr?.mrr_cents || 0),
      mrr: `$${(Number(mrr?.mrr_cents || 0) / 100).toFixed(2)}`,
      arr: `$${(Number(mrr?.mrr_cents || 0) * 12 / 100).toFixed(2)}`,
      total_revenue_cents: Number(totalRevenue?.total || 0),
      total_revenue: `$${(Number(totalRevenue?.total || 0) / 100).toFixed(2)}`,
      subscribers_by_plan: subsByPlan,
      subscriptions_by_status: subsByStatus,
      churn_rate_30d: churnRate?.total > 0
        ? `${((churnRate.canceled / churnRate.total) * 100).toFixed(1)}%`
        : '0.0%',
      recent_invoices: recentInvoices.map((inv: any) => ({
        ...inv,
        total: `$${(inv.total_cents / 100).toFixed(2)}`,
      })),
    }
  });
});

export default router;
