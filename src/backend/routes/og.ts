import { Router, Request, Response } from 'express';
import { db } from '../db';
import { config } from '../config';
import { generateSigil, SigilCustomConfig } from './sigil';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  DYNAMIC OPENGRAPH IMAGE GENERATION SERVICE
//  Renders high-res 1200x630 (or 2400x1260 2K) social share cards with:
//  1. Creator deterministic SVG sigil (with equipped custom config)
//  2. Current Wealth Tier badge, level, stored XP & boost multiplier
//  3. Referral code & CTA
//  4. Mandatory FTC 16 CFR Part 255 disclosure overlays
// ═══════════════════════════════════════════════════════════════════

export interface WealthTierMeta {
  name: string;
  hex: string;
  secondaryHex: string;
  glow: string;
  icon: string;
  multiplier: string;
}

export const WEALTH_TIER_MAP: Record<string, WealthTierMeta> = {
  'Novice Plug': {
    name: 'Novice Plug',
    hex: '#94a3b8',
    secondaryHex: '#64748b',
    glow: 'rgba(148, 163, 184, 0.35)',
    icon: '⚡',
    multiplier: '1.0×',
  },
  'Budget Apprentice': {
    name: 'Budget Apprentice',
    hex: '#38bdf8',
    secondaryHex: '#0284c7',
    glow: 'rgba(56, 189, 248, 0.4)',
    icon: '🛠️',
    multiplier: '1.0×',
  },
  'Crypto Stacker': {
    name: 'Crypto Stacker',
    hex: '#22c55e',
    secondaryHex: '#16a34a',
    glow: 'rgba(34, 197, 94, 0.45)',
    icon: '🪙',
    multiplier: '1.05×',
  },
  'Wealth Builder': {
    name: 'Wealth Builder',
    hex: '#eab308',
    secondaryHex: '#ca8a04',
    glow: 'rgba(234, 179, 8, 0.45)',
    icon: '📈',
    multiplier: '1.10×',
  },
  'Grand Money Plug': {
    name: 'Grand Money Plug',
    hex: '#a855f7',
    secondaryHex: '#9333ea',
    glow: 'rgba(168, 85, 247, 0.5)',
    icon: '🔮',
    multiplier: '1.20×',
  },
  'Diamond Stacker': {
    name: 'Diamond Stacker',
    hex: '#06b6d4',
    secondaryHex: '#0891b2',
    glow: 'rgba(6, 182, 212, 0.55)',
    icon: '💎',
    multiplier: '1.30×',
  },
  'Cosmic Money Plug': {
    name: 'Cosmic Money Plug',
    hex: '#f43f5e',
    secondaryHex: '#e11d48',
    glow: 'rgba(244, 63, 94, 0.6)',
    icon: '🌌',
    multiplier: '1.50×',
  },
  'Cosmic Sovereign': {
    name: 'Cosmic Sovereign',
    hex: '#ffd700',
    secondaryHex: '#f59e0b',
    glow: 'rgba(255, 215, 0, 0.65)',
    icon: '👑',
    multiplier: '2.00×',
  },
  'Sovereign Syndicate': {
    name: 'Sovereign Syndicate',
    hex: '#10b981',
    secondaryHex: '#059669',
    glow: 'rgba(16, 185, 129, 0.6)',
    icon: '🏆',
    multiplier: '2.50×',
  },
};

export function getWealthTierMeta(tierTitle?: string): WealthTierMeta {
  if (!tierTitle) return WEALTH_TIER_MAP['Novice Plug'];
  return WEALTH_TIER_MAP[tierTitle] || {
    name: tierTitle,
    hex: '#00ff88',
    secondaryHex: '#00bb66',
    glow: 'rgba(0, 255, 136, 0.4)',
    icon: '⚡',
    multiplier: '1.0×',
  };
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders high-res 1200x630 SVG social share card with OpenGraph assets & FTC Part 255 disclosures.
 */
export function renderOpenGraphCardSvg(
  code: string,
  user: any,
  customConfig: SigilCustomConfig,
  scale2k: boolean = false
): string {
  const width = scale2k ? 2400 : 1200;
  const height = scale2k ? 1260 : 630;
  const activeCode = (user?.referral_code || code).toUpperCase();
  const displayName = user?.display_name || 'Creator Plug';
  const tierTitle = user?.tier_title || 'Novice Plug';
  const level = user?.level || 1;
  const xp = (user?.xp || 0).toLocaleString();
  const refCount = user?.referral_count || 0;
  const tier = getWealthTierMeta(tierTitle);

  // Generate deterministic SVG sigil
  const sigilSvg = generateSigil(activeCode, 360, customConfig);
  const sigilB64 = Buffer.from(sigilSvg).toString('base64');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid meet">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="ogBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#030712"/>
      <stop offset="40%" stop-color="#0b0f19"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>

    <!-- Radial Wealth Aura -->
    <radialGradient id="ogAuraGrad" cx="22%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${tier.hex}" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="${tier.secondaryHex}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
    </radialGradient>

    <!-- Card Glass Gradient -->
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f2937" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#111827" stop-opacity="0.85"/>
    </linearGradient>

    <!-- Outer Border Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${tier.hex}" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#374151" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${tier.secondaryHex}" stop-opacity="0.6"/>
    </linearGradient>

    <!-- Glow Filter -->
    <filter id="ogGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="sigilAura" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="20" result="blur2"/>
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Canvas Background -->
  <rect width="1200" height="630" fill="url(#ogBgGrad)"/>
  <rect width="1200" height="630" fill="url(#ogAuraGrad)"/>

  <!-- Background Grid Pattern -->
  <g opacity="0.07" stroke="#9ca3af" stroke-width="1">
    <path d="M 0 70 L 1200 70 M 0 140 L 1200 140 M 0 210 L 1200 210 M 0 280 L 1200 280 M 0 350 L 1200 350 M 0 420 L 1200 420 M 0 490 L 1200 490 M 0 560 L 1200 560" />
    <path d="M 120 0 L 120 630 M 240 0 L 240 630 M 360 0 L 360 630 M 480 0 L 480 630 M 600 0 L 600 630 M 720 0 L 720 630 M 840 0 L 840 630 M 960 0 L 960 630 M 1080 0 L 1080 630" />
  </g>

  <!-- Outer Frame & Border -->
  <rect x="12" y="12" width="1176" height="606" rx="24" fill="none" stroke="url(#borderGrad)" stroke-width="2.5"/>
  <rect x="22" y="22" width="1156" height="586" rx="18" fill="none" stroke="${tier.hex}" stroke-width="1" stroke-opacity="0.25" stroke-dasharray="6 6"/>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- MANDATORY FTC 16 CFR PART 255 DISCLOSURE BADGE (TOP RIGHT) -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <g transform="translate(740, 32)">
    <rect x="0" y="0" width="428" height="34" rx="10" fill="#0f172a" fill-opacity="0.95" stroke="${tier.hex}" stroke-width="1.2" stroke-opacity="0.6"/>
    <circle cx="18" cy="17" r="5" fill="#f59e0b"/>
    <text x="32" y="22" fill="#e2e8f0" font-family="'JetBrains Mono', 'Fira Code', monospace, sans-serif" font-size="11.5" font-weight="800" letter-spacing="0.5">#ad · Paid Referral Link · FTC 16 CFR Part 255</text>
  </g>

  <!-- Brand / OS Emblem Header (Top Left) -->
  <g transform="translate(54, 34)">
    <rect x="0" y="0" width="32" height="32" rx="8" fill="${tier.hex}" fill-opacity="0.2" stroke="${tier.hex}" stroke-width="1.5"/>
    <text x="16" y="22" fill="${tier.hex}" font-family="sans-serif" font-size="16" font-weight="900" text-anchor="middle">⚡</text>
    <text x="44" y="22" fill="#94a3b8" font-family="'JetBrains Mono', 'Fira Code', monospace" font-size="13" font-weight="800" letter-spacing="3">MONEYPLUGHUB • CREATOR MONEY OS</text>
  </g>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- LEFT PANEL: DETERMINISTIC SVG SIGIL & AURA SHADOW -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <g transform="translate(54, 115)">
    <!-- Aura Ambient Circle -->
    <circle cx="180" cy="180" r="200" fill="${tier.hex}" fill-opacity="0.1" filter="url(#sigilAura)"/>
    <rect x="0" y="0" width="360" height="360" rx="32" fill="url(#glassGrad)" stroke="${tier.hex}" stroke-opacity="0.3" stroke-width="1.5"/>
    <image href="data:image/svg+xml;base64,${sigilB64}" x="15" y="15" width="330" height="330"/>
  </g>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- RIGHT PANEL: CREATOR IDENTITY, WEALTH TIER BADGE & METRICS -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <g transform="translate(460, 105)">
    <!-- Creator Display Name -->
    <text x="0" y="48" fill="#ffffff" font-family="Inter, -apple-system, sans-serif" font-size="46" font-weight="900" letter-spacing="-1">${escapeXml(displayName)}</text>

    <!-- WEALTH TIER BADGE CONTAINER -->
    <g transform="translate(0, 70)">
      <rect x="0" y="0" width="410" height="46" rx="14" fill="${tier.hex}" fill-opacity="0.18" stroke="${tier.hex}" stroke-width="2" filter="url(#ogGlow)"/>
      <text x="18" y="29" fill="${tier.hex}" font-family="Inter, sans-serif" font-size="19" font-weight="900">${tier.icon}  ${escapeXml(tier.name)}  •  Lv. ${level}</text>
      <rect x="300" y="8" width="98" height="30" rx="8" fill="${tier.hex}"/>
      <text x="349" y="28" fill="#030712" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="900" text-anchor="middle">${tier.multiplier} BOOST</text>
    </g>

    <!-- METRICS GRID -->
    <g transform="translate(0, 145)">
      <!-- Metric 1: Stored XP -->
      <rect x="0" y="0" width="215" height="85" rx="16" fill="#0f172a" fill-opacity="0.9" stroke="#1e293b" stroke-width="1.5"/>
      <text x="20" y="28" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="800" letter-spacing="1">STORED REWARD XP</text>
      <text x="20" y="62" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="900">${xp}</text>

      <!-- Metric 2: Active Referrals -->
      <rect x="235" y="0" width="215" height="85" rx="16" fill="#0f172a" fill-opacity="0.9" stroke="#1e293b" stroke-width="1.5"/>
      <text x="255" y="28" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="800" letter-spacing="1">ACTIVE REFERRALS</text>
      <text x="255" y="62" fill="${tier.hex}" font-family="'JetBrains Mono', monospace" font-size="28" font-weight="900">${refCount}</text>
    </g>

    <!-- CALL-TO-ACTION CARD BLOCK -->
    <g transform="translate(0, 258)">
      <rect x="0" y="0" width="670" height="72" rx="20" fill="${tier.hex}" filter="url(#ogGlow)" opacity="0.95"/>
      <text x="335" y="44" fill="#030712" font-family="Inter, sans-serif" font-size="22" font-weight="900" text-anchor="middle" letter-spacing="1">🚀 JOIN NETWORK &amp; CLAIM STARTER XP →</text>
    </g>
  </g>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- MANDATORY FTC 16 CFR PART 255 FOOTER OVERLAY & HASH SEAL -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <line x1="54" y1="535" x2="1146" y2="535" stroke="#1e293b" stroke-width="1.5"/>

  <text x="54" y="562" fill="#475569" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700">SIGIL HASH: SHA-256(${activeCode}) • VERIFIED CREATOR PASSPORT</text>
  <text x="1146" y="562" fill="${tier.hex}" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="900" text-anchor="end">CODE: ${activeCode}</text>

  <text x="54" y="588" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="600">FTC 16 CFR PART 255 DISCLOSURE: Material connection exists. Referring creator receives affiliate commissions &amp; XP rewards.</text>
  <text x="1146" y="588" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="600" text-anchor="end">#ad · Paid Referral Link · Creator Money OS</text>
</svg>`;
}

function renderHtmlOpenGraphPreview(code: string, user: any, customConfig: SigilCustomConfig, reqUrl: string): string {
  const activeCode = (user?.referral_code || code).toUpperCase();
  const displayName = user?.display_name || 'Creator Plug';
  const tierTitle = user?.tier_title || 'Novice Plug';
  const level = user?.level || 1;
  const tier = getWealthTierMeta(tierTitle);
  const cardImgUrl = `${config.appUrl}/api/og/${activeCode}?format=svg`;
  const trackingLink = `${config.appUrl}/api/referrals/track/${activeCode}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(displayName)} — Creator Money OS Share Card</title>

  <!-- OpenGraph / Social Share Meta Tags (FTC 16 CFR Part 255 Compliant) -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${trackingLink}" />
  <meta property="og:title" content="${escapeXml(displayName)} • ${escapeXml(tier.name)} (Level ${level})" />
  <meta property="og:description" content="[#ad] Claim your starter XP &amp; join my private wealth network with code ${activeCode} · Paid Referral Link · FTC 16 CFR Part 255 Compliant" />
  <meta property="og:image" content="${cardImgUrl}" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="MoneyPlugHub Creator Money OS" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeXml(displayName)} • ${escapeXml(tier.name)} (Level ${level})" />
  <meta name="twitter:description" content="[#ad] Claim your starter XP &amp; join my private wealth network with code ${activeCode} · Paid Referral Link" />
  <meta name="twitter:image" content="${cardImgUrl}" />

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #030712;
      color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
      aspect-ratio: 1200 / 630;
      background: #0b0f19;
      border-radius: 20px;
      box-shadow: 0 25px 60px -15px rgba(0,0,0,0.9), 0 0 40px ${tier.glow};
      overflow: hidden;
      margin-bottom: 24px;
    }
    .card-wrapper svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .controls {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 16px;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
      color: #030712;
      background: ${tier.hex};
      border: none;
      cursor: pointer;
      transition: transform 0.15s ease;
      font-family: monospace;
    }
    .btn:hover { transform: translateY(-2px); }
    .btn-secondary {
      background: #1f2937;
      color: #e5e7eb;
      border: 1px solid #374151;
    }
    .ftc-notice {
      font-size: 11px;
      color: #6b7280;
      font-family: monospace;
      text-align: center;
      max-width: 800px;
    }
  </style>
</head>
<body>
  <div class="card-wrapper">
    ${renderOpenGraphCardSvg(activeCode, user, customConfig)}
  </div>

  <div class="controls">
    <a href="${trackingLink}" class="btn">🚀 Join Network with Code [${activeCode}]</a>
    <a href="/api/og/${activeCode}?format=svg" download="og-card-${activeCode}.svg" class="btn btn-secondary">💾 Download 4K SVG</a>
    <button onclick="navigator.clipboard.writeText('${trackingLink}')" class="btn btn-secondary">📋 Copy Referral Link</button>
  </div>

  <div class="ftc-notice">
    ⚖️ <strong>FTC 16 CFR Part 255 Disclosure Notice:</strong> Material connection exists between endorser and platform. Referral links generate cash commissions ($10.00 base) &amp; XP leveling rewards.
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/og/:code
 * GET /api/og/card/:code
 * GET /api/og/image/:code
 * Generates dynamic high-res OpenGraph social share card images
 */
router.get(['/:code', '/card/:code', '/image/:code'], (req: Request, res: Response) => {
  const code = (req.params.code || 'CREATOR-OS').trim().toUpperCase();
  const is2k = req.query.size === '2k' || req.query.res === 'high';

  // Fetch creator profile
  const user = db.prepare(
    'SELECT id, display_name, referral_code, level, xp, tier_title, referral_count FROM users WHERE referral_code = ? COLLATE NOCASE'
  ).get(code) as any;

  // Fetch equipped Sigil customizations
  let customConfig: SigilCustomConfig = {};
  if (user?.id) {
    const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(user.id) as any;
    if (cfg) {
      customConfig = {
        aura: cfg.aura || null,
        glyph: cfg.glyph || null,
        ring: cfg.ring || null,
        crest: cfg.crest || null,
        handle: cfg.handle || user.display_name || user.referral_code,
        motto: cfg.motto || null,
        monogram: cfg.monogram || null,
      };
    }
  }

  // Allow query overrides for preview testing
  if (req.query.aura) customConfig.aura = req.query.aura as string;
  if (req.query.glyph) customConfig.glyph = req.query.glyph as string;
  if (req.query.ring) customConfig.ring = req.query.ring as string;
  if (req.query.crest) customConfig.crest = req.query.crest as string;

  const cardSvg = renderOpenGraphCardSvg(code, user, customConfig, is2k);

  // 1. Return JSON payload
  if (req.query.format === 'json') {
    const b64 = Buffer.from(cardSvg).toString('base64');
    res.json({
      success: true,
      data: {
        referral_code: user?.referral_code || code,
        display_name: user?.display_name || 'Creator Plug',
        tier: getWealthTierMeta(user?.tier_title),
        level: user?.level || 1,
        xp: user?.xp || 0,
        ftc_disclosure: '#ad · Paid Referral Link · FTC 16 CFR Part 255 Compliant',
        svg_base64: b64,
        svg_data_uri: `data:image/svg+xml;base64,${b64}`,
        og_image_url: `${config.appUrl}/api/og/${code}?format=svg`,
      }
    });
    return;
  }

  // 2. Return HTML preview with OpenGraph meta tags if viewed in browser address bar
  if (req.headers.accept?.includes('text/html') && req.query.raw !== '1' && req.query.format !== 'svg') {
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(renderHtmlOpenGraphPreview(code, user, customConfig, req.originalUrl));
    return;
  }

  // 3. Return SVG image stream (Default)
  res.set({
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'Access-Control-Allow-Origin': '*',
  });
  res.send(cardSvg);
});

export default router;
