import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { config } from '../config';
import { generateSigil, SigilCustomConfig } from './sigil';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  DYNAMIC OPENGRAPH IMAGE GENERATION SERVICE — Creator Money OS
//  Renders high-res social share cards (1200x630) with:
//  1. Creator Deterministic SVG Sigil
//  2. Current Wealth Tier Badge & Level Pill
//  3. Stylized Referral Code & Network Link
//  4. Mandatory FTC 16 CFR Part 255 Disclosure Overlays
// ═══════════════════════════════════════════════════════════════════

export interface TierMeta {
  hex: string;
  glow: string;
  badge: string;
  name: string;
  booster: number;
}

/**
 * Returns tier metadata and color themes for current Wealth Tiers
 */
export function getTierMetaData(tierTitle: string = 'Novice Plug'): TierMeta {
  const tiers: Record<string, TierMeta> = {
    'Novice Plug': { hex: '#94a3b8', glow: 'rgba(148,163,184,0.35)', badge: '🌱 Novice Plug', name: 'Novice Plug', booster: 1.00 },
    'Budget Apprentice': { hex: '#38bdf8', glow: 'rgba(56,189,248,0.40)', badge: '⚡ Budget Apprentice', name: 'Budget Apprentice', booster: 1.05 },
    'Crypto Stacker': { hex: '#22c55e', glow: 'rgba(34,197,94,0.40)', badge: '💎 Crypto Stacker', name: 'Crypto Stacker', booster: 1.10 },
    'Wealth Builder': { hex: '#eab308', glow: 'rgba(234,179,8,0.45)', badge: '👑 Wealth Builder', name: 'Wealth Builder', booster: 1.20 },
    'Grand Money Plug': { hex: '#a855f7', glow: 'rgba(168,85,247,0.50)', badge: '🔮 Grand Money Plug', name: 'Grand Money Plug', booster: 1.30 },
    'Diamond Stacker': { hex: '#06b6d4', glow: 'rgba(6,182,212,0.50)', badge: '💎 Diamond Stacker', name: 'Diamond Stacker', booster: 1.40 },
    'Cosmic Money Plug': { hex: '#f43f5e', glow: 'rgba(244,63,94,0.60)', badge: '🪐 Cosmic Money Plug', name: 'Cosmic Money Plug', booster: 1.50 },
    'Cosmic Sovereign': { hex: '#ffd700', glow: 'rgba(255,215,0,0.65)', badge: '🌌 Cosmic Sovereign', name: 'Cosmic Sovereign', booster: 2.00 },
  };

  return tiers[tierTitle] || { hex: '#00ff88', glow: 'rgba(0,255,136,0.40)', badge: '✨ Sovereign Creator', name: tierTitle || 'Novice Plug', booster: 1.00 };
}

function escSvg(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Core SVG Share Card Renderer (High-Res 1200x630 OpenGraph Standard)
 */
export function renderOpenGraphCardSvg(user: any, customConfig?: SigilCustomConfig): string {
  const referralCode = (user.referral_code || 'CREATOR-PLUG').toUpperCase();
  const displayName = user.display_name || 'Creator Plug';
  const tierTitle = user.tier_title || 'Novice Plug';
  const level = user.level || 1;
  const xp = user.xp || 0;
  const referralCount = user.referral_count || 0;
  const tier = getTierMetaData(tierTitle);

  // Generate deterministic SVG sigil base64 string
  const sigilSvg = generateSigil(referralCode, 350, customConfig);
  const sigilB64 = Buffer.from(sigilSvg).toString('base64');

  const sha256Hash = crypto.createHash('sha256').update(`${user.id}_${referralCode}_FTC_255`).digest('hex').substring(0, 16).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid meet">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="ogBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#05070f"/>
      <stop offset="40%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#140e2b"/>
    </linearGradient>

    <!-- Radial Tier Aura Glow -->
    <radialGradient id="ogTierAura" cx="22%" cy="48%" r="55%">
      <stop offset="0%" stop-color="${tier.hex}" stop-opacity="0.28"/>
      <stop offset="50%" stop-color="${tier.hex}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#05070f" stop-opacity="0"/>
    </radialGradient>

    <!-- High Intensity Glow Filter -->
    <filter id="ogGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="ogSubtleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Button Gradient -->
    <linearGradient id="ogBtnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${tier.hex}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>

  <!-- 1. Background Fill & Aura -->
  <rect width="1200" height="630" fill="url(#ogBgGrad)"/>
  <rect width="1200" height="630" fill="url(#ogTierAura)"/>

  <!-- Cosmic Grid Microdots -->
  <g opacity="0.15">
    <circle cx="100" cy="80" r="1.5" fill="#ffffff"/>
    <circle cx="300" cy="120" r="1" fill="#ffffff"/>
    <circle cx="550" cy="60" r="2" fill="#ffffff"/>
    <circle cx="850" cy="140" r="1.5" fill="#ffffff"/>
    <circle cx="1100" cy="90" r="1" fill="#ffffff"/>
    <circle cx="200" cy="520" r="1.5" fill="#ffffff"/>
    <circle cx="450" cy="580" r="1" fill="#ffffff"/>
    <circle cx="750" cy="510" r="2" fill="#ffffff"/>
    <circle cx="1050" cy="560" r="1.5" fill="#ffffff"/>
  </g>

  <!-- 2. Cybernetic Outer Frame Borders -->
  <rect x="12" y="12" width="1176" height="606" rx="28" fill="none" stroke="${tier.hex}" stroke-width="2.5" stroke-opacity="0.45"/>
  <rect x="22" y="22" width="1156" height="586" rx="20" fill="none" stroke="${tier.hex}" stroke-width="1" stroke-opacity="0.20" stroke-dasharray="10 8"/>

  <!-- Corner Tech Accent Brackets -->
  <path d="M 28 50 L 28 28 L 50 28" fill="none" stroke="${tier.hex}" stroke-width="3" stroke-linecap="round"/>
  <path d="M 1172 50 L 1172 28 L 1150 28" fill="none" stroke="${tier.hex}" stroke-width="3" stroke-linecap="round"/>
  <path d="M 28 580 L 28 602 L 50 602" fill="none" stroke="${tier.hex}" stroke-width="3" stroke-linecap="round"/>
  <path d="M 1172 580 L 1172 602 L 1150 602" fill="none" stroke="${tier.hex}" stroke-width="3" stroke-linecap="round"/>

  <!-- 3. MANDATORY FTC 16 CFR PART 255 DISCLOSURE OVERLAY (Top Banner Badge) -->
  <g transform="translate(730, 32)">
    <rect x="0" y="0" width="420" height="34" rx="10" fill="#0b1329" fill-opacity="0.94" stroke="${tier.hex}" stroke-width="1.2" stroke-opacity="0.6"/>
    <circle cx="18" cy="17" r="5" fill="#f59e0b" filter="url(#ogSubtleGlow)"/>
    <text x="32" y="22" fill="#e2e8f0" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="11.5" font-weight="700" letter-spacing="0.5">#ad · Paid Referral Link · FTC 16 CFR Part 255</text>
  </g>

  <!-- 4. Left Column: Creator Deterministic SVG Sigil -->
  <g transform="translate(60, 130)">
    <!-- Ambient Aura Backlight -->
    <circle cx="175" cy="175" r="195" fill="${tier.hex}" fill-opacity="0.08" filter="url(#ogGlowFilter)"/>

    <!-- Outer Sigil Boundary Ring -->
    <circle cx="175" cy="175" r="180" fill="#070c1a" fill-opacity="0.85" stroke="${tier.hex}" stroke-width="2" stroke-opacity="0.5"/>
    <circle cx="175" cy="175" r="172" fill="none" stroke="${tier.hex}" stroke-width="1" stroke-dasharray="6 6" stroke-opacity="0.3"/>

    <!-- Embedded Sigil Image -->
    <image href="data:image/svg+xml;base64,${sigilB64}" x="0" y="0" width="350" height="350"/>
  </g>

  <!-- 5. Right Column: Creator Identity, Wealth Tier & Metrics -->
  <g transform="translate(480, 110)">
    <!-- Subheader / Platform Brand -->
    <text x="0" y="28" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="15" font-weight="800" letter-spacing="4">MONEYPLUGHUB • CREATOR MONEY OS</text>

    <!-- Creator Display Name -->
    <text x="0" y="90" fill="#ffffff" font-family="System-UI, -apple-system, sans-serif" font-size="48" font-weight="900" letter-spacing="-1">${escSvg(displayName)}</text>

    <!-- Current Wealth Tier Badge & Level Pill -->
    <g transform="translate(0, 115)">
      <rect x="0" y="0" width="380" height="44" rx="14" fill="${tier.hex}" fill-opacity="0.14" stroke="${tier.hex}" stroke-width="1.8"/>
      <circle cx="22" cy="22" r="7" fill="${tier.hex}" filter="url(#ogSubtleGlow)"/>
      <text x="38" y="28" fill="${tier.hex}" font-family="System-UI, -apple-system, sans-serif" font-size="18" font-weight="800" letter-spacing="0.5">${escSvg(tier.badge)} • Level ${level}</text>
    </g>

    <!-- Metrics Grid Cards -->
    <g transform="translate(0, 185)">
      <!-- Stored XP Card -->
      <rect x="0" y="0" width="180" height="78" rx="16" fill="#0b1329" stroke="#1e293b" stroke-width="1.5"/>
      <text x="18" y="26" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1">STORED REWARD XP</text>
      <text x="18" y="58" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="800">${xp.toLocaleString()}</text>

      <!-- Referrals Card -->
      <rect x="195" y="0" width="180" height="78" rx="16" fill="#0b1329" stroke="#1e293b" stroke-width="1.5"/>
      <text x="213" y="26" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1">ACTIVE REFERRALS</text>
      <text x="213" y="58" fill="#38bdf8" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="800">${referralCount}</text>

      <!-- Status Multiplier Card -->
      <rect x="390" y="0" width="180" height="78" rx="16" fill="#0b1329" stroke="#1e293b" stroke-width="1.5"/>
      <text x="408" y="26" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1">STATUS MULTIPLIER</text>
      <text x="408" y="58" fill="${tier.hex}" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="800">${tier.booster.toFixed(2)}×</text>
    </g>

    <!-- Referral Code Badge & Network CTA Block -->
    <g transform="translate(0, 290)">
      <!-- Referral Code Box -->
      <rect x="0" y="0" width="570" height="66" rx="18" fill="${tier.hex}" fill-opacity="0.92" filter="url(#ogGlowFilter)"/>
      <text x="28" y="41" fill="#05070f" font-family="'JetBrains Mono', monospace" font-size="18" font-weight="800">CODE: ${escSvg(referralCode)}</text>
      <text x="542" y="41" fill="#05070f" font-family="System-UI, -apple-system, sans-serif" font-size="18" font-weight="900" text-anchor="end" letter-spacing="1">JOIN MY NETWORK →</text>
    </g>
  </g>

  <!-- 6. Footer Info Bar & MANDATORY FTC 16 CFR PART 255 DISCLOSURE OVERLAY -->
  <line x1="60" y1="540" x2="1140" y2="540" stroke="#1e293b" stroke-width="1.2"/>

  <text x="60" y="566" fill="#475569" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="600">DETERMINISTIC VERIFICATION HASH • SHA-256(${referralCode}) [${sha256Hash}]</text>
  <text x="1140" y="566" fill="${tier.hex}" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="800" text-anchor="end">${referralCode}</text>

  <!-- Mandatory FTC 16 CFR Part 255 Disclosure Notice Text -->
  <text x="60" y="592" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600">FTC 16 CFR PART 255 DISCLOSURE: Material connection exists. Referring creator receives affiliate commissions &amp; XP rewards.</text>
  <text x="1140" y="592" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" text-anchor="end">#ad · Paid Referral Link · Creator Money OS</text>
</svg>`;
}

/**
 * Render Interactive HTML Presentation Shell for Browser Requests
 */
function renderOpenGraphHtmlPage(user: any, customConfig?: SigilCustomConfig): string {
  const referralCode = (user.referral_code || 'CREATOR-PLUG').toUpperCase();
  const displayName = escSvg(user.display_name || 'Creator Plug');
  const tier = getTierMetaData(user.tier_title);
  const cardSvg = renderOpenGraphCardSvg(user, customConfig);
  const referralLink = `${config.appUrl}/api/referrals/track/${referralCode}`;
  const ogImageUrl = `${config.appUrl}/api/og/${referralCode}?format=svg`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${displayName} — OpenGraph Creator Share Card | MoneyPlugHub</title>

  <!-- Mandatory FTC Compliant OpenGraph & Twitter Card Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${displayName} • ${escSvg(tier.name)} (Level ${user.level || 1})">
  <meta property="og:description" content="[#ad] Claim your starter XP &amp; join my private wealth network with code ${referralCode} · Paid Referral Link · FTC 16 CFR Part 255 Compliant">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/svg+xml">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${config.appUrl}/api/og/${referralCode}">
  <meta property="og:site_name" content="MoneyPlugHub — Creator Money OS">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${displayName} • ${escSvg(tier.name)}">
  <meta name="twitter:description" content="[#ad] Paid Referral Link · Join my network with code ${referralCode} · FTC 16 CFR Part 255 Compliant">
  <meta name="twitter:image" content="${ogImageUrl}">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100vw;
      height: 100vh;
      background-color: #05070f;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
    }

    .cosmic-glow {
      position: absolute;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      background: radial-gradient(circle, ${tier.glow} 0%, rgba(5,7,15,0) 70%);
      pointer-events: none;
      filter: blur(80px);
      z-index: 0;
      animation: pulseGlow 6s ease-in-out infinite alternate;
    }

    @keyframes pulseGlow {
      0% { transform: scale(0.9) translate(-5%, -5%); opacity: 0.5; }
      100% { transform: scale(1.1) translate(5%, 5%); opacity: 0.85; }
    }

    .card-container {
      position: relative;
      z-index: 10;
      width: 92vw;
      max-width: 1200px;
      height: auto;
      max-height: 82vh;
      aspect-ratio: 1200 / 630;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 28px;
      box-shadow: 0 30px 80px -20px rgba(0,0,0,0.95), 0 0 50px -10px ${tier.glow};
      overflow: hidden;
      transition: transform 0.3s ease;
      cursor: pointer;
    }

    .card-container svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .action-bar {
      position: relative;
      z-index: 20;
      margin-top: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .btn {
      padding: 12px 22px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .btn-primary {
      background: ${tier.hex};
      color: #05070f;
      box-shadow: 0 10px 25px -5px ${tier.glow};
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      filter: brightness(1.1);
    }

    .btn-secondary {
      background: #0f172a;
      color: #e2e8f0;
      border-color: #334155;
    }
    .btn-secondary:hover {
      background: #1e293b;
      color: #fff;
      transform: translateY(-2px);
    }

    .ftc-notice {
      position: relative;
      z-index: 20;
      margin-top: 14px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      max-width: 920px;
      padding: 0 16px;
      font-family: 'JetBrains Mono', monospace;
    }

    #toast {
      position: fixed;
      bottom: 30px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid ${tier.hex};
      color: ${tier.hex};
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      font-family: monospace;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 100;
      pointer-events: none;
      backdrop-filter: blur(12px);
    }
    #toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="cosmic-glow"></div>

  <div class="card-container" id="cardContainer" onclick="window.location.href='${referralLink}'">
    ${cardSvg}
  </div>

  <div class="action-bar">
    <a href="${referralLink}" class="btn btn-primary">
      🚀 Join My Private Network (Claim XP)
    </a>

    <button onclick="copyLink('${referralLink}', 'Referral link')" class="btn btn-secondary">
      📋 Copy Referral Link
    </button>

    <button onclick="copyLink('${ogImageUrl}', 'OpenGraph image URL')" class="btn btn-secondary">
      🖼️ Copy OpenGraph Card URL
    </button>

    <a href="${ogImageUrl}" download="opengraph-card-${referralCode}.svg" class="btn btn-secondary">
      💾 Download 4K SVG Card
    </a>
  </div>

  <div class="ftc-notice">
    ⚖️ <strong>FTC 16 CFR Part 255 Disclosure:</strong> Material connection exists. Referring creator receives affiliate commissions ($10 base cash + recurring) &amp; XP leveling rewards when referred users sign up.
  </div>

  <div id="toast">📋 Link copied!</div>

  <script>
    function copyLink(text, label) {
      navigator.clipboard.writeText(text).then(() => {
        showToast("✨ " + label + " copied!");
      }).catch(() => {
        showToast("👉 " + label + ": " + text);
      });
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3500);
    }
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/og/:code
 * GET /api/og/share-card/:code
 * GET /api/og/card/:code
 * Generates high-res dynamic OpenGraph social share card
 */
router.get(['/:code', '/share-card/:code', '/card/:code'], (req: Request, res: Response) => {
  const code = req.params.code.trim().toUpperCase();

  const user = db.prepare(
    'SELECT id, display_name, referral_code, xp, level, tier_title, referral_count FROM users WHERE referral_code = ? COLLATE NOCASE'
  ).get(code) as any;

  if (!user) {
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Referral Card Not Found</title></head>
        <body style="background:#05070f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;">
            <h2>⚠️ Invalid Creator Code</h2>
            <p style="color:#64748b;">Code <code>${code}</code> was not found.</p>
            <a href="/" style="color:#00ff88;text-decoration:none;">← Return to Creator Money OS</a>
          </div>
        </body>
      </html>
    `);
    return;
  }

  // Load user's saved Sigil Forge configuration
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

  // Allow query overrides for preview testing (e.g. ?aura=aura_solar_flare)
  if (req.query.aura) customConfig.aura = req.query.aura as string;
  if (req.query.glyph) customConfig.glyph = req.query.glyph as string;
  if (req.query.ring) customConfig.ring = req.query.ring as string;
  if (req.query.crest) customConfig.crest = req.query.crest as string;

  const cardSvg = renderOpenGraphCardSvg(user, customConfig);

  // 1. JSON Request (`?format=json`)
  if (req.query.format === 'json') {
    const b64 = Buffer.from(cardSvg).toString('base64');
    const tier = getTierMetaData(user.tier_title);
    res.json({
      success: true,
      data: {
        referral_code: user.referral_code,
        display_name: user.display_name,
        tier: tier.name,
        tier_badge: tier.badge,
        level: user.level || 1,
        xp: user.xp || 0,
        referrals: user.referral_count || 0,
        status_multiplier: tier.booster,
        ftc_disclosure: '#ad · Paid Referral Link · FTC 16 CFR Part 255 Compliant',
        svg_data_uri: `data:image/svg+xml;base64,${b64}`,
        og_image_url: `${config.appUrl}/api/og/${user.referral_code}?format=svg`,
        referral_url: `${config.appUrl}/api/referrals/track/${user.referral_code}`,
      }
    });
    return;
  }

  // 2. Direct SVG Image Request (`?format=svg` or `?raw=1` or `Accept: image/svg+xml`)
  if (
    req.query.format === 'svg' ||
    req.query.format === 'raw' ||
    req.query.raw === 'true' ||
    req.headers.accept?.includes('image/svg+xml')
  ) {
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    });
    res.send(cardSvg);
    return;
  }

  // 3. Browser Presentation Page (Default for web navigation)
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.send(renderOpenGraphHtmlPage(user, customConfig));
});

export default router;
