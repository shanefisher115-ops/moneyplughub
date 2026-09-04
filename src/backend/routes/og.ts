import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { config } from '../config';
import { generateSigil, SigilCustomConfig } from './sigil';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  DYNAMIC OPENGRAPH IMAGE GENERATION SERVICE (1200x630 High-Res SVG)
//  Features:
//  - Deterministic SVG Sigil embedding
//  - Current Wealth Tier badge & level status
//  - Referral code & invitation CTA
//  - Mandatory FTC 16 CFR Part 255 disclosure overlays
//  - Multi-format output: Raw SVG, Base64 JSON, and HTML preview with OpenGraph tags
// ═══════════════════════════════════════════════════════════════════

export interface WealthTierMeta {
  tierNumber: number;
  name: string;
  title: string;
  badgeHex: string;
  glowRgba: string;
  multiplier: number;
  icon: string;
}

export const WEALTH_TIER_CONFIGS: Record<string, WealthTierMeta> = {
  'Novice Plug': {
    tierNumber: 1,
    name: 'Neo-Emerald Seed',
    title: 'Novice Plug',
    badgeHex: '#10b981',
    glowRgba: 'rgba(16, 185, 129, 0.4)',
    multiplier: 1.0,
    icon: '🌱',
  },
  'Budget Apprentice': {
    tierNumber: 2,
    name: 'Cyan Cashflow River',
    title: 'Budget Apprentice',
    badgeHex: '#38bdf8',
    glowRgba: 'rgba(56, 189, 248, 0.4)',
    multiplier: 1.1,
    icon: '🌊',
  },
  'Crypto Stacker': {
    tierNumber: 3,
    name: 'Amethyst Quantum Ledger',
    title: 'Crypto Stacker',
    badgeHex: '#a855f7',
    glowRgba: 'rgba(168, 85, 247, 0.45)',
    multiplier: 1.25,
    icon: '⚡',
  },
  'Wealth Builder': {
    tierNumber: 4,
    name: '24K Imperial Bullion',
    title: 'Wealth Builder',
    badgeHex: '#f59e0b',
    glowRgba: 'rgba(245, 158, 11, 0.5)',
    multiplier: 1.5,
    icon: '👑',
  },
  'Grand Money Plug': {
    tierNumber: 4,
    name: '24K Imperial Bullion',
    title: 'Grand Money Plug',
    badgeHex: '#eab308',
    glowRgba: 'rgba(234, 179, 8, 0.5)',
    multiplier: 1.6,
    icon: '🏆',
  },
  'Diamond Stacker': {
    tierNumber: 5,
    name: 'Sovereign Diamond Treasury',
    title: 'Diamond Stacker',
    badgeHex: '#06b6d4',
    glowRgba: 'rgba(6, 182, 212, 0.55)',
    multiplier: 2.0,
    icon: '💎',
  },
  'Cosmic Money Plug': {
    tierNumber: 6,
    name: 'Celestial Osmium Singularity',
    title: 'Cosmic Money Plug',
    badgeHex: '#f43f5e',
    glowRgba: 'rgba(244, 63, 94, 0.6)',
    multiplier: 3.0,
    icon: '🌌',
  },
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getWealthTierMeta(title?: string): WealthTierMeta {
  if (title && WEALTH_TIER_CONFIGS[title]) {
    return WEALTH_TIER_CONFIGS[title];
  }
  return WEALTH_TIER_CONFIGS['Novice Plug'];
}

export interface OgImageOptions {
  referralCode: string;
  displayName: string;
  tierTitle: string;
  level: number;
  xp: number;
  referralCount: number;
  width?: number;
  height?: number;
  sigilConfig?: SigilCustomConfig;
  themeAccent?: string;
}

/**
 * Generate a high-resolution 1200x630 OpenGraph social share SVG card.
 */
export function generateOpenGraphSvg(opts: OgImageOptions): string {
  const width = opts.width || 1200;
  const height = opts.height || 630;
  const code = opts.referralCode.toUpperCase();
  const name = escapeXml(opts.displayName || 'Sovereign Creator');
  const level = opts.level || 1;
  const xpFormatted = (opts.xp || 0).toLocaleString();
  const refCount = opts.referralCount || 0;

  const tierMeta = getWealthTierMeta(opts.tierTitle);
  const accentHex = opts.themeAccent || tierMeta.badgeHex;
  const glowColor = tierMeta.glowRgba;

  // Render 360px Sigil SVG embedded as base64
  const sigilSvg = generateSigil(code, 360, opts.sigilConfig);
  const sigilBase64 = Buffer.from(sigilSvg).toString('base64');

  const referralLink = `${config.appUrl}/register?ref=${code}`;
  const verifyHash = crypto
    .createHash('sha256')
    .update(`${code}_${opts.tierTitle}_OG_VERIFIED_2026`)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <!-- Background Space Gradients -->
    <linearGradient id="ogBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030712"/>
      <stop offset="45%" stop-color="#0b1120"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>

    <radialGradient id="ogAuraGlow" cx="20%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${accentHex}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="ogSecondaryGlow" cx="85%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
    </radialGradient>

    <!-- Filter Shaders -->
    <filter id="ogGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="ogCardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.85"/>
    </filter>
  </defs>

  <!-- Base Canvas Fill -->
  <rect width="${width}" height="${height}" fill="url(#ogBg)"/>
  <rect width="${width}" height="${height}" fill="url(#ogAuraGlow)"/>
  <rect width="${width}" height="${height}" fill="url(#ogSecondaryGlow)"/>

  <!-- Outer Frame & Cosmic Border -->
  <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="28" fill="none" stroke="${accentHex}" stroke-width="2.5" stroke-opacity="0.45"/>
  <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="20" fill="none" stroke="${accentHex}" stroke-width="1" stroke-opacity="0.2" stroke-dasharray="6 6"/>

  <!-- Mandatory FTC 16 CFR Part 255 Disclosure Badge Overlay (Top Right) -->
  <g transform="translate(710, 36)">
    <rect x="0" y="0" width="445" height="34" rx="10" fill="#0b1329" fill-opacity="0.94" stroke="${accentHex}" stroke-width="1.2" stroke-opacity="0.6"/>
    <circle cx="18" cy="17" r="4.5" fill="#f59e0b"/>
    <text x="32" y="22" fill="#cbd5e1" font-family="'JetBrains Mono', monospace, sans-serif" font-size="11.5" font-weight="700" letter-spacing="0.5">
      #ad · Paid Referral Link · FTC 16 CFR Part 255 Compliant
    </text>
  </g>

  <!-- Left Column: Creator Sigil & Frame -->
  <g transform="translate(65, 125)">
    <circle cx="180" cy="180" r="200" fill="${accentHex}" fill-opacity="0.08" filter="url(#ogGlow)"/>
    <rect x="-10" y="-10" width="380" height="380" rx="24" fill="#030712" fill-opacity="0.75" stroke="${accentHex}" stroke-width="1.5" stroke-opacity="0.3"/>
    <image href="data:image/svg+xml;base64,${sigilBase64}" x="0" y="0" width="360" height="360"/>
  </g>

  <!-- Right Column: Identity, Wealth Tier & Referral CTAs -->
  <g transform="translate(485, 110)">
    <!-- Header Protocol Brand -->
    <text x="0" y="24" fill="#64748b" font-family="'JetBrains Mono', monospace, sans-serif" font-size="14" font-weight="800" letter-spacing="4">
      MONEYPLUGHUB • CREATOR MONEY OS
    </text>

    <!-- Creator Name -->
    <text x="0" y="92" fill="#ffffff" font-family="'Inter', system-ui, -apple-system, sans-serif" font-size="48" font-weight="900" letter-spacing="-1">
      ${name}
    </text>

    <!-- Current Wealth Tier Badge Overlay -->
    <g transform="translate(0, 118)">
      <rect x="0" y="0" width="420" height="46" rx="12" fill="${accentHex}" fill-opacity="0.16" stroke="${accentHex}" stroke-width="1.8"/>
      <text x="18" y="29" fill="${accentHex}" font-family="'Inter', system-ui, sans-serif" font-size="19" font-weight="900" letter-spacing="0.5">
        ${tierMeta.icon} ${escapeXml(tierMeta.title)} • Level ${level} (${tierMeta.multiplier}×)
      </text>
    </g>

    <!-- Key Wealth Stats Grid -->
    <g transform="translate(0, 192)">
      <!-- Box 1: Reward XP -->
      <rect x="0" y="0" width="195" height="82" rx="14" fill="#0b1329" fill-opacity="0.85" stroke="#1e293b" stroke-width="1.5"/>
      <text x="18" y="30" fill="#64748b" font-family="'Inter', sans-serif" font-size="12" font-weight="800" letter-spacing="1">
        STORED REWARD XP
      </text>
      <text x="18" y="62" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="26" font-weight="900">
        ${xpFormatted}
      </text>

      <!-- Box 2: Network Referrals -->
      <rect x="215" y="0" width="195" height="82" rx="14" fill="#0b1329" fill-opacity="0.85" stroke="#1e293b" stroke-width="1.5"/>
      <text x="233" y="30" fill="#64748b" font-family="'Inter', sans-serif" font-size="12" font-weight="800" letter-spacing="1">
        NETWORK REFERRALS
      </text>
      <text x="233" y="62" fill="#38bdf8" font-family="'JetBrains Mono', monospace" font-size="26" font-weight="900">
        ${refCount} Members
      </text>
    </g>

    <!-- High-Converting Referral Code CTA Button -->
    <g transform="translate(0, 304)">
      <rect x="0" y="0" width="480" height="62" rx="16" fill="${accentHex}" filter="url(#ogGlow)" opacity="0.95"/>
      <text x="240" y="39" fill="#030712" font-family="'Inter', system-ui, sans-serif" font-size="20" font-weight="900" text-anchor="middle" letter-spacing="1">
        JOIN NETWORK WITH CODE [${code}] →
      </text>
    </g>
  </g>

  <!-- Bottom Mandatory Disclosure & Telemetry Footer -->
  <line x1="50" y1="540" x2="${width - 50}" y2="540" stroke="#1e293b" stroke-width="1.2"/>

  <!-- Left Footer: Hash & Verification -->
  <text x="50" y="568" fill="#475569" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700">
    AUTHENTICATED SIGIL HASH • VERIFY: ${verifyHash}
  </text>
  <text x="50" y="592" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="600">
    FTC 16 CFR PART 255 DISCLOSURE: Material connection exists. Referring creator receives cash commissions &amp; XP rewards.
  </text>

  <!-- Right Footer: Code & Compliance Stamp -->
  <text x="${width - 50}" y="568" fill="${accentHex}" font-family="'JetBrains Mono', monospace" font-size="15" font-weight="800" text-anchor="end">
    INVITE CODE: ${code}
  </text>
  <text x="${width - 50}" y="592" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="600" text-anchor="end">
    #ad · Paid Referral Link · Creator Money OS
  </text>
</svg>`;
}

/**
 * Render complete HTML page wrapping OpenGraph card with full `<meta og:...>` tags.
 */
export function renderOpenGraphHtmlWrapper(user: any, cardSvg: string, code: string): string {
  const displayName = escapeXml(user?.display_name || 'Creator Plug');
  const tierTitle = escapeXml(user?.tier_title || 'Novice Plug');
  const level = user?.level || 1;
  const ogImageUrl = `${config.appUrl}/api/og/${code}?format=svg`;
  const registerUrl = `${config.appUrl}/register?ref=${code}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ ${displayName} — Creator Money OS OpenGraph Card</title>

  <!-- OpenGraph Primary Social Share Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MoneyPlugHub — Creator Money OS">
  <meta property="og:title" content="${displayName} • ${tierTitle} (Level ${level})">
  <meta property="og:description" content="[#ad] Claim your starter XP & join my private wealth network with code ${code} · Paid Referral Link · FTC 16 CFR Part 255 Compliant">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/svg+xml">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${registerUrl}">

  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${displayName} • ${tierTitle} (Level ${level})">
  <meta name="twitter:description" content="[#ad] Join my private wealth network on Creator Money OS using code ${code}. FTC 16 CFR Part 255 Compliant.">
  <meta name="twitter:image" content="${ogImageUrl}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #030712;
      color: #f3f4f6;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card-wrapper {
      width: 100%;
      max-width: 1200px;
      aspect-ratio: 1200 / 630;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 25px 60px -15px rgba(0,0,0,0.9);
      cursor: pointer;
    }
    .card-wrapper svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .action-row {
      margin-top: 1.5rem;
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      font-weight: 800;
      font-size: 0.9rem;
      text-decoration: none;
      color: #030712;
      background: #10b981;
      border: none;
      cursor: pointer;
    }
    .btn-dark {
      background: #1f2937;
      color: #f3f4f6;
      border: 1px solid #374151;
    }
  </style>
</head>
<body>
  <div class="card-wrapper" onclick="window.location.href='${registerUrl}'">
    ${cardSvg}
  </div>

  <div class="action-row">
    <a href="${registerUrl}" class="btn">🚀 Join Network with Code ${code}</a>
    <a href="${ogImageUrl}" download="og-card-${code}.svg" class="btn btn-dark">💾 Download SVG</a>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/og/:code
 * Dynamic OpenGraph image generator.
 * Format query parameter options:
 *  - format=svg or format=image : Returns raw image/svg+xml
 *  - format=json : Returns JSON with base64 data URI
 *  - Default browser direct navigation : Returns full HTML with <meta og:...> tags
 */
router.get(['/:code', '/image/:code'], (req: Request, res: Response) => {
  const code = req.params.code.trim().toUpperCase();

  const user = db.prepare(
    'SELECT id, display_name, referral_code, tier_title, level, xp, referral_count FROM users WHERE referral_code = ? COLLATE NOCASE'
  ).get(code) as any;

  const activeUser = user || {
    id: 'guest',
    display_name: 'Sovereign Creator',
    referral_code: code,
    tier_title: 'Novice Plug',
    level: 1,
    xp: 250,
    referral_count: 0,
  };

  // Fetch equipped sigil custom config if exists
  let sigilConfig: SigilCustomConfig = {};
  if (activeUser.id !== 'guest') {
    const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(activeUser.id) as any;
    if (cfg) {
      sigilConfig = {
        aura: cfg.aura || null,
        glyph: cfg.glyph || null,
        ring: cfg.ring || null,
        crest: cfg.crest || null,
        handle: cfg.handle || activeUser.display_name,
        motto: cfg.motto || null,
        monogram: cfg.monogram || null,
      };
    }
  }

  // Override via query parameters
  if (req.query.aura) sigilConfig.aura = req.query.aura as string;
  if (req.query.glyph) sigilConfig.glyph = req.query.glyph as string;
  if (req.query.ring) sigilConfig.ring = req.query.ring as string;
  if (req.query.crest) sigilConfig.crest = req.query.crest as string;

  const width = parseInt(req.query.width as string) || 1200;
  const height = parseInt(req.query.height as string) || 630;

  const svg = generateOpenGraphSvg({
    referralCode: activeUser.referral_code,
    displayName: activeUser.display_name,
    tierTitle: activeUser.tier_title,
    level: activeUser.level,
    xp: activeUser.xp,
    referralCount: activeUser.referral_count,
    width,
    height,
    sigilConfig,
    themeAccent: req.query.accent as string,
  });

  // 1. JSON Base64 Response
  if (req.query.format === 'json') {
    const base64 = Buffer.from(svg).toString('base64');
    res.json({
      success: true,
      data: {
        referral_code: activeUser.referral_code,
        display_name: activeUser.display_name,
        tier_title: activeUser.tier_title,
        level: activeUser.level,
        svg_base64: base64,
        svg_data_uri: `data:image/svg+xml;base64,${base64}`,
        ftc_disclosure: 'FTC 16 CFR Part 255 Compliant. Material connection exists.',
        og_url: `${config.appUrl}/api/og/${activeUser.referral_code}?format=svg`,
      }
    });
    return;
  }

  // 2. Direct SVG Image Request
  if (req.query.format === 'svg' || req.query.format === 'image' || req.query.raw === 'true' || req.headers.accept?.includes('image/svg+xml')) {
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, immutable',
    });
    res.send(svg);
    return;
  }

  // 3. Full HTML Presentation Page
  res.set({ 'Content-Type': 'text/html; charset=utf-8' });
  res.send(renderOpenGraphHtmlWrapper(activeUser, svg, activeUser.referral_code));
});

export default router;
