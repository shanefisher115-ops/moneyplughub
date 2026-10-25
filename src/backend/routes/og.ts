import { Router, Request, Response } from 'express';
import { db } from '../db';
import { config } from '../config';
import { generateSigil, SigilCustomConfig } from './sigil';
import { getTierBooster } from './growth';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  OPENGRAPH DYNAMIC IMAGE GENERATION SERVICE (OG Engine OS)
//  Renders high-res (1200x630) social share cards with:
//  • Creator's deterministic SVG sigil & equipped customizer artifacts
//  • Current Wealth Tier badge & level status
//  • Referral code & single-click referral tracking link
//  • Mandatory FTC 16 CFR Part 255 disclosure overlays (#ad)
// ═══════════════════════════════════════════════════════════════════

export interface WealthTierStyle {
  name: string;
  hex: string;
  secondaryHex: string;
  glow: string;
  bgGradient: string;
  icon: string;
}

const WEALTH_TIER_STYLES: Record<string, WealthTierStyle> = {
  'Novice Plug': {
    name: 'Novice Plug',
    hex: '#94a3b8',
    secondaryHex: '#64748b',
    glow: 'rgba(148,163,184,0.35)',
    bgGradient: 'linear-gradient(135deg, #070a14 0%, #0f172a 50%, #1e293b 100%)',
    icon: '⚡',
  },
  'Budget Apprentice': {
    name: 'Budget Apprentice',
    hex: '#38bdf8',
    secondaryHex: '#0284c7',
    glow: 'rgba(56,189,248,0.4)',
    bgGradient: 'linear-gradient(135deg, #031322 0%, #0b253a 50%, #075985 100%)',
    icon: '🛡️',
  },
  'Crypto Stacker': {
    name: 'Crypto Stacker',
    hex: '#22c55e',
    secondaryHex: '#15803d',
    glow: 'rgba(34,197,94,0.45)',
    bgGradient: 'linear-gradient(135deg, #02140a 0%, #06371e 50%, #14532d 100%)',
    icon: '🪙',
  },
  'Wealth Builder': {
    name: 'Wealth Builder',
    hex: '#eab308',
    secondaryHex: '#ca8a04',
    glow: 'rgba(234,179,8,0.45)',
    bgGradient: 'linear-gradient(135deg, #170900 0%, #3d2000 50%, #713f12 100%)',
    icon: '🏛️',
  },
  'Grand Money Plug': {
    name: 'Grand Money Plug',
    hex: '#a855f7',
    secondaryHex: '#7e22ce',
    glow: 'rgba(168,85,247,0.5)',
    bgGradient: 'linear-gradient(135deg, #0b0217 0%, #290a4d 50%, #581c87 100%)',
    icon: '👑',
  },
  'Diamond Stacker': {
    name: 'Diamond Stacker',
    hex: '#06b6d4',
    secondaryHex: '#0e7490',
    glow: 'rgba(6,182,212,0.55)',
    bgGradient: 'linear-gradient(135deg, #021320 0%, #083344 50%, #155e75 100%)',
    icon: '💎',
  },
  'Cosmic Money Plug': {
    name: 'Cosmic Money Plug',
    hex: '#f43f5e',
    secondaryHex: '#be123c',
    glow: 'rgba(244,63,94,0.6)',
    bgGradient: 'linear-gradient(135deg, #160206 0%, #4c0519 50%, #881337 100%)',
    icon: '🌌',
  },
  'Sovereign Operator': {
    name: 'Sovereign Operator',
    hex: '#ffd700',
    secondaryHex: '#b45309',
    glow: 'rgba(255,215,0,0.65)',
    bgGradient: 'linear-gradient(135deg, #180a00 0%, #451a03 50%, #78350f 100%)',
    icon: '🔱',
  },
};

function getTierStyle(tierTitle: string): WealthTierStyle {
  if (WEALTH_TIER_STYLES[tierTitle]) return WEALTH_TIER_STYLES[tierTitle];
  return {
    name: tierTitle || 'Novice Plug',
    hex: '#00ff88',
    secondaryHex: '#00bb66',
    glow: 'rgba(0,255,136,0.4)',
    bgGradient: 'linear-gradient(135deg, #021209 0%, #06371e 50%, #0f172a 100%)',
    icon: '⚡',
  };
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface RenderOpenGraphOptions {
  displayName: string;
  referralCode: string;
  tierTitle: string;
  level: number;
  xp: number;
  referralCount: number;
  sigilSvgBase64: string;
  customMotto?: string;
}

/**
 * Generates a 1200x630 high-resolution OpenGraph SVG social card.
 */
export function generateOpenGraphSvg(opts: RenderOpenGraphOptions): string {
  const tier = getTierStyle(opts.tierTitle);
  const safeName = escapeXml(opts.displayName);
  const safeCode = escapeXml(opts.referralCode);
  const safeTier = escapeXml(tier.name);
  const safeMotto = escapeXml(opts.customMotto || 'SOVEREIGN CREATOR OS');
  const booster = getTierBooster(opts.tierTitle);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid meet">
  <defs>
    <!-- Background Gradients -->
    <linearGradient id="ogBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050814"/>
      <stop offset="40%" stop-color="#0b1124"/>
      <stop offset="100%" stop-color="#140f2d"/>
    </linearGradient>

    <radialGradient id="auraGlow" cx="22%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${tier.hex}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#050814" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="cardBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${tier.hex}" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="#1e293b" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${tier.secondaryHex}" stop-opacity="0.8"/>
    </linearGradient>

    <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${tier.hex}"/>
      <stop offset="100%" stop-color="${tier.secondaryHex}"/>
    </linearGradient>

    <filter id="ogGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="badgeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- 1. Background Layers -->
  <rect width="1200" height="630" fill="url(#ogBg)"/>
  <rect width="1200" height="630" fill="url(#auraGlow)"/>

  <!-- Subtle Cybernetic Grid Pattern Overlay -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="0.8">
    <line x1="0" y1="105" x2="1200" y2="105"/>
    <line x1="0" y1="210" x2="1200" y2="210"/>
    <line x1="0" y1="315" x2="1200" y2="315"/>
    <line x1="0" y1="420" x2="1200" y2="420"/>
    <line x1="0" y1="525" x2="1200" y2="525"/>
    <line x1="200" y1="0" x2="200" y2="630"/>
    <line x1="400" y1="0" x2="400" y2="630"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
    <line x1="800" y1="0" x2="800" y2="630"/>
    <line x1="1000" y1="0" x2="1000" y2="630"/>
  </g>

  <!-- 2. Outer Border & Frame -->
  <rect x="12" y="12" width="1176" height="606" rx="28" fill="none" stroke="url(#cardBorder)" stroke-width="2.5"/>
  <rect x="22" y="22" width="1156" height="586" rx="20" fill="none" stroke="${tier.hex}" stroke-width="1" stroke-opacity="0.25" stroke-dasharray="10 6"/>

  <!-- 3. MANDATORY FTC 16 CFR PART 255 DISCLOSURE BADGE (TOP RIGHT OVERLAY) -->
  <g transform="translate(730, 32)">
    <rect x="0" y="0" width="430" height="34" rx="10" fill="#0f172a" fill-opacity="0.94" stroke="${tier.hex}" stroke-width="1.2" stroke-opacity="0.6"/>
    <circle cx="18" cy="17" r="4.5" fill="#f59e0b" filter="url(#badgeGlow)"/>
    <text x="32" y="22" fill="#e2e8f0" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="11.5" font-weight="800" letter-spacing="0.5">#ad · Paid Referral Link · Creator Money OS</text>
  </g>

  <!-- 4. Top Left Platform Brand Header -->
  <g transform="translate(60, 48)">
    <text x="0" y="0" fill="#38bdf8" font-family="'JetBrains Mono', monospace, sans-serif" font-size="13" font-weight="800" letter-spacing="4">⚡ MONEYPLUGHUB</text>
    <text x="185" y="0" fill="#64748b" font-family="'JetBrains Mono', monospace, sans-serif" font-size="13" font-weight="700" letter-spacing="2">• OFFICIAL CREATOR PASSPORT</text>
  </g>

  <!-- 5. Left Column: Creator Deterministic SVG Sigil Container -->
  <g transform="translate(60, 115)">
    <!-- Ambient Backdrop Aura -->
    <circle cx="190" cy="190" r="200" fill="${tier.hex}" fill-opacity="0.08" filter="url(#ogGlow)"/>
    <!-- Sigil Image (Embedded Vector) -->
    <image href="data:image/svg+xml;base64,${opts.sigilSvgBase64}" x="0" y="0" width="380" height="380"/>
  </g>

  <!-- 6. Right Column: Creator Identity, Wealth Tier & KPI Metrics -->
  <g transform="translate(490, 105)">
    <!-- Custom Motto / Subtitle -->
    <text x="0" y="20" fill="${tier.hex}" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="800" letter-spacing="3">• ${safeMotto} •</text>

    <!-- Creator Display Name -->
    <text x="0" y="70" fill="#ffffff" font-family="Inter, -apple-system, sans-serif" font-size="46" font-weight="900" letter-spacing="-1">${safeName}</text>

    <!-- Wealth Tier Badge & Level Status Pill -->
    <g transform="translate(0, 92)">
      <rect x="0" y="0" width="410" height="46" rx="14" fill="${tier.hex}" fill-opacity="0.15" stroke="${tier.hex}" stroke-width="1.8"/>
      <text x="20" y="29" fill="#ffffff" font-size="20">${tier.icon}</text>
      <text x="48" y="29" fill="${tier.hex}" font-family="Inter, sans-serif" font-size="18" font-weight="800" letter-spacing="0.5">${safeTier}</text>
      <line x1="280" y1="10" x2="280" y2="36" stroke="${tier.hex}" stroke-opacity="0.4" stroke-width="1.2"/>
      <text x="296" y="29" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800">Lv. ${opts.level}</text>
    </g>

    <!-- Metrics Grid: Stored XP, Active Referrals, Status Multiplier -->
    <g transform="translate(0, 168)">
      <!-- Box 1: XP -->
      <rect x="0" y="0" width="200" height="80" rx="16" fill="#0f172a" fill-opacity="0.9" stroke="#1e293b" stroke-width="1.5"/>
      <text x="20" y="28" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="800" letter-spacing="1">REWARD XP</text>
      <text x="20" y="60" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="900">${opts.xp.toLocaleString()}</text>

      <!-- Box 2: Referrals -->
      <rect x="215" y="0" width="200" height="80" rx="16" fill="#0f172a" fill-opacity="0.9" stroke="#1e293b" stroke-width="1.5"/>
      <text x="235" y="28" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="800" letter-spacing="1">NETWORK</text>
      <text x="235" y="60" fill="#38bdf8" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="900">${opts.referralCount} Refs</text>
    </g>

    <!-- Referral Code CTA Banner -->
    <g transform="translate(0, 275)">
      <rect x="0" y="0" width="630" height="66" rx="18" fill="url(#ctaGrad)" filter="url(#ogGlow)" opacity="0.95"/>
      <text x="315" y="41" fill="#050814" font-family="Inter, sans-serif" font-size="21" font-weight="900" text-anchor="middle" letter-spacing="1.5">CLAIM ACCESS WITH CODE: ${safeCode} →</text>
    </g>
  </g>

  <!-- 7. Footer Divider & FTC 16 CFR Part 255 Disclosure Notice -->
  <line x1="60" y1="540" x2="1140" y2="540" stroke="#1e293b" stroke-width="1.2"/>

  <text x="60" y="568" fill="#475569" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="600">CREATOR REFERRAL CODE: [${safeCode}] • MULTIPLIER: ${booster}×</text>
  <text x="1140" y="568" fill="${tier.hex}" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="800" text-anchor="end">SHA-256 VERIFIED CREATOR PASSPORT</text>

  <!-- Mandatory FTC Legal Footnote -->
  <text x="60" y="594" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600">FTC 16 CFR PART 255 DISCLOSURE: Material connection exists. Referring creator receives affiliate commissions &amp; XP rewards.</text>
  <text x="1140" y="594" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="end">#ad · Paid Referral Link · Creator Money OS</text>
</svg>`;
}

function renderOpenGraphHtmlPreview(user: any, referralCode: string, svgCard: string): string {
  const displayName = user?.display_name || 'Creator Plug';
  const tierTitle = user?.tier_title || 'Novice Plug';
  const level = user?.level || 1;
  const cardUrl = `${config.appUrl}/api/og/${referralCode}?format=svg`;
  const registerUrl = `${config.appUrl}/register?ref=${referralCode}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(displayName)} — Creator Money OS Share Card</title>

  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeXml(displayName)} • ${escapeXml(tierTitle)} (Level ${level})">
  <meta property="og:description" content="[#ad] Join my private wealth network with code ${escapeXml(referralCode)}. Earn $10.00 cash bounties & XP rewards. Paid Referral Link · FTC 16 CFR Part 255 Compliant.">
  <meta property="og:image" content="${cardUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${registerUrl}">

  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeXml(displayName)} • ${escapeXml(tierTitle)} (Level ${level})">
  <meta name="twitter:description" content="[#ad] Join my private wealth network with code ${escapeXml(referralCode)}. Paid Referral Link · FTC 16 CFR Part 255 Compliant.">
  <meta name="twitter:image" content="${cardUrl}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #050814;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card-wrapper {
      width: 100%;
      max-width: 1100px;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 25px 70px -15px rgba(0, 0, 0, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
    .card-wrapper svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .toolbar {
      margin-top: 24px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 14px;
      text-decoration: none;
      transition: transform 0.15s ease;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: #38bdf8; color: #050814; }
    .btn-secondary { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; }
    .btn:hover { transform: translateY(-2px); }
    .ftc-notice {
      margin-top: 16px;
      font-size: 11px;
      color: #64748b;
      font-family: monospace;
      text-align: center;
      max-width: 800px;
    }
  </style>
</head>
<body>
  <div class="card-wrapper">
    ${svgCard}
  </div>

  <div class="toolbar">
    <a href="${registerUrl}" class="btn btn-primary">🚀 Join Network with Code [${escapeXml(referralCode)}]</a>
    <a href="${cardUrl}" download="opengraph-${escapeXml(referralCode)}.svg" class="btn btn-secondary">💾 Download 1200×630 OpenGraph SVG</a>
  </div>

  <div class="ftc-notice">
    ⚖️ <strong>FTC 16 CFR Part 255 Disclosure:</strong> Material connection exists between referring creator and platform. Referral link earns cash commissions ($10.00 base) &amp; XP rewards.
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  OPENGRAPH API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/og/:code
 * Dynamic OpenGraph share card endpoint.
 * Query params:
 *   - format=svg | json | html
 *   - size=1200
 *   - aura, glyph, ring, crest (Forge overrides)
 */
router.get('/:code', (req: Request, res: Response) => {
  const code = req.params.code.trim().toUpperCase();

  const user = db.prepare(
    'SELECT id, display_name, referral_code, tier_title, level, xp, referral_count FROM users WHERE referral_code = ? COLLATE NOCASE'
  ).get(code) as any;

  const activeCode = user?.referral_code || code;
  const displayName = user?.display_name || 'Sovereign Creator';
  const tierTitle = user?.tier_title || 'Novice Plug';
  const level = user?.level || 1;
  const xp = user?.xp || 500;
  const referralCount = user?.referral_count || 0;

  // Custom Sigil configuration
  let customConfig: SigilCustomConfig = {};
  if (user?.id) {
    const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(user.id) as any;
    if (cfg) {
      customConfig = {
        aura: cfg.aura || null,
        glyph: cfg.glyph || null,
        ring: cfg.ring || null,
        crest: cfg.crest || null,
        handle: cfg.handle || displayName,
        motto: cfg.motto || null,
        monogram: cfg.monogram || null,
      };
    }
  }

  // Allow query overrides for Forge testing
  if (req.query.aura) customConfig.aura = req.query.aura as string;
  if (req.query.glyph) customConfig.glyph = req.query.glyph as string;
  if (req.query.ring) customConfig.ring = req.query.ring as string;
  if (req.query.crest) customConfig.crest = req.query.crest as string;
  if (req.query.motto) customConfig.motto = req.query.motto as string;

  const sigilSvg = generateSigil(activeCode, 350, customConfig);
  const sigilB64 = Buffer.from(sigilSvg).toString('base64');

  const ogSvg = generateOpenGraphSvg({
    displayName,
    referralCode: activeCode,
    tierTitle,
    level,
    xp,
    referralCount,
    sigilSvgBase64: sigilB64,
    customMotto: customConfig.motto || undefined,
  });

  // JSON format
  if (req.query.format === 'json') {
    const cardB64 = Buffer.from(ogSvg).toString('base64');
    res.json({
      success: true,
      data: {
        referral_code: activeCode,
        creator: {
          display_name: displayName,
          tier_title: tierTitle,
          level,
          xp,
          referral_count: referralCount,
        },
        ftc_disclosure: {
          tag: '#ad',
          type: 'Paid Referral Link',
          standard: 'FTC 16 CFR Part 255',
          statement: 'Material connection exists. Referring creator receives affiliate commissions & XP rewards.',
        },
        card_dimensions: { width: 1200, height: 630 },
        svg_data_uri: `data:image/svg+xml;base64,${cardB64}`,
        share_url: `${config.appUrl}/api/og/${activeCode}`,
      }
    });
    return;
  }

  // Direct SVG image format (e.g., format=svg or raw=true or accept header)
  if (req.query.format === 'svg' || req.query.raw === 'true' || req.headers.accept?.includes('image/svg+xml')) {
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, immutable',
    });
    res.send(ogSvg);
    return;
  }

  // HTML page response with meta tags
  res.set({ 'Content-Type': 'text/html; charset=utf-8' });
  res.send(renderOpenGraphHtmlPreview(user, activeCode, ogSvg));
});

/**
 * POST /api/og/render
 * Generates an OpenGraph card dynamically from provided payload options.
 */
router.post('/render', (req: Request, res: Response) => {
  const {
    displayName = 'Sovereign Creator',
    referralCode = 'CREATOR-PLUG',
    tierTitle = 'Novice Plug',
    level = 1,
    xp = 1000,
    referralCount = 5,
    customConfig = {},
  } = req.body || {};

  const sigilSvg = generateSigil(referralCode, 350, customConfig);
  const sigilB64 = Buffer.from(sigilSvg).toString('base64');

  const ogSvg = generateOpenGraphSvg({
    displayName,
    referralCode,
    tierTitle,
    level,
    xp,
    referralCount,
    sigilSvgBase64: sigilB64,
    customMotto: customConfig.motto,
  });

  const cardB64 = Buffer.from(ogSvg).toString('base64');

  res.json({
    success: true,
    data: {
      referral_code: referralCode,
      ftc_disclosure: {
        tag: '#ad',
        type: 'Paid Referral Link',
        standard: 'FTC 16 CFR Part 255',
        statement: 'Material connection exists. Referring creator receives affiliate commissions & XP rewards.',
      },
      card_dimensions: { width: 1200, height: 630 },
      svg_base64: cardB64,
      svg_data_uri: `data:image/svg+xml;base64,${cardB64}`,
    }
  });
});

export default router;
