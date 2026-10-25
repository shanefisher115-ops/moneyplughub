/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  MONEYPLUGHUB CLOUDFLARE WORKER & GLOBAL EDGE CACHE ENGINE
 *  Sub-10ms Global Edge Caching via Cloudflare Workers KV & Cache API
 * ══════════════════════════════════════════════════════════════════════════════
 */

export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' } | any): Promise<string | any | null>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expirationTtl?: number; expiration?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  NODE_ENV?: string;
  APP_NAME?: string;
  API_URL?: string;
  SIGIL_CACHE?: KVNamespace;
  PROFILE_CACHE?: KVNamespace;
  CACHE_KV?: KVNamespace;
}

// ── Simple SHA-256 / Byte Digest Helper for Edge Sigil Generation ──────────
function simpleHashBytes(input: string): number[] {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const bytes: number[] = [];
  for (let i = 0; i < 32; i++) {
    const val = Math.abs((i % 2 === 0 ? h1 : h2) ^ (i * 0x9e3779b9)) % 256;
    bytes.push(val);
  }
  return bytes;
}

function hf(bytes: number[], i: number): number {
  return bytes[i % bytes.length] / 255;
}

function hi(bytes: number[], i: number, min: number, max: number): number {
  return Math.floor(hf(bytes, i) * (max - min + 1)) + min;
}

function hslColor(bytes: number[], offset: number, satMin = 50, satMax = 90, lightMin = 45, lightMax = 70): string {
  const h = Math.floor(hf(bytes, offset) * 360);
  const s = hi(bytes, offset + 1, satMin, satMax);
  const l = hi(bytes, offset + 2, lightMin, lightMax);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Procedural Deterministic Vector Sigil Generator running at Edge Locations.
 */
export function generateEdgeSigil(code: string, size = 256, customConfig: Record<string, string | null> = {}): string {
  const cleanCode = (code || 'PLUG-FOUNDER').trim().toUpperCase();
  const bytes = simpleHashBytes(cleanCode);

  let primary = hslColor(bytes, 0, 60, 95, 50, 70);
  let secondary = hslColor(bytes, 3, 50, 85, 40, 65);
  let accent = hslColor(bytes, 6, 70, 100, 55, 80);
  let bgDark = `hsl(${hi(bytes, 9, 200, 280)}, ${hi(bytes, 10, 15, 30)}%, ${hi(bytes, 11, 5, 12)}%)`;

  const auraTheme = customConfig.aura || 'aura_cyber_emerald';
  const themeMap: Record<string, { p: string; s: string; a: string; bg: string }> = {
    aura_cyber_emerald: { p: '#00ff88', s: '#00bb66', a: '#38ef7d', bg: '#021209' },
    aura_synthwave_sunset: { p: '#ec4899', s: '#f97316', a: '#fbbf24', bg: '#14031f' },
    aura_cosmic_nebula: { p: '#c084fc', s: '#38bdf8', a: '#f472b6', bg: '#0b0217' },
    aura_quantum_ice: { p: '#22d3ee', s: '#38bdf8', a: '#e0f2fe', bg: '#021320' },
    aura_solar_flare: { p: '#fbbf24', s: '#f59e0b', a: '#f97316', bg: '#170900' },
    aura_osmium_diamond: { p: '#38bdf8', s: '#818cf8', a: '#e0e7ff', bg: '#040b17' },
    aura_void_singularity: { p: '#f43f5e', s: '#881337', a: '#fb7185', bg: '#040008' },
    aura_primordial_gold: { p: '#ffd700', s: '#eab308', a: '#fffbeb', bg: '#140c00' },
  };

  if (themeMap[auraTheme]) {
    const t = themeMap[auraTheme];
    primary = t.p; secondary = t.s; accent = t.a; bgDark = t.bg;
  }

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.40;
  const outerR = maxR * 0.90;
  const innerR = maxR * 0.40;

  let elements = '';

  // Background Particles
  for (let p = 0; p < 16; p++) {
    const px = cx + (hf(bytes, p * 2) - 0.5) * (size * 0.8);
    const py = cy + (hf(bytes, p * 2 + 1) - 0.5) * (size * 0.8);
    elements += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.5" fill="${accent}" opacity="0.6"/>`;
  }

  // Radial Rings
  elements += `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${primary}" stroke-width="2" opacity="0.8"/>`;
  elements += `<circle cx="${cx}" cy="${cy}" r="${outerR - 6}" fill="none" stroke="${secondary}" stroke-width="1" stroke-dasharray="3 5" opacity="0.6"/>`;
  elements += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${accent}" stroke-width="2" opacity="0.8"/>`;

  // Radial Spikes & Circuit Lines
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const x1 = cx + Math.cos(a) * innerR;
    const y1 = cy + Math.sin(a) * innerR;
    const x2 = cx + Math.cos(a) * (outerR - 4);
    const y2 = cy + Math.sin(a) * (outerR - 4);
    elements += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 2 === 0 ? primary : accent}" stroke-width="1.2" opacity="0.7"/>`;
  }

  // Center Core Geometry
  const glyphR = maxR * 0.25;
  elements += `<polygon points="${cx},${cy - glyphR} ${cx + glyphR * 0.86},${cy + glyphR * 0.5} ${cx - glyphR * 0.86},${cy + glyphR * 0.5}" fill="${accent}" opacity="0.5"/>`;
  elements += `<polygon points="${cx},${cy + glyphR} ${cx + glyphR * 0.86},${cy - glyphR * 0.5} ${cx - glyphR * 0.86},${cy - glyphR * 0.5}" fill="${primary}" opacity="0.5"/>`;
  elements += `<circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>`;

  // Crest Top Spike
  const topY = cy - outerR - 4;
  elements += `<polygon points="${cx - 8},${topY} ${cx},${topY - 14} ${cx + 8},${topY}" fill="${accent}"/>`;

  // Text Rim Inscription
  const handle = customConfig.handle || customConfig.motto || cleanCode;
  elements += `<text x="${cx}" y="${(cy + outerR + 14).toFixed(1)}" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="7" font-weight="bold" letter-spacing="2" opacity="0.8">• ${handle} • CREATOR OS •</text>`;

  const defs = `
    <defs>
      <filter id="sigilGlowEdge" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <radialGradient id="sigilBgEdge" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${bgDark}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#020408" stop-opacity="1"/>
      </radialGradient>
    </defs>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${defs}
  <rect width="${size}" height="${size}" fill="url(#sigilBgEdge)" rx="20"/>
  <rect width="${size - 4}" height="${size - 4}" x="2" y="2" fill="none" stroke="${accent}" stroke-width="1" rx="18" opacity="0.5"/>
  <g filter="url(#sigilGlowEdge)">
    ${elements}
  </g>
</svg>`;
}

/**
 * Generates public creator profile card HTML / JSON.
 */
export function generateEdgeProfileCard(code: string, userData?: any): { html: string; json: any } {
  const activeCode = (code || 'FOUNDER-PLUG').toUpperCase();
  const displayName = userData?.display_name || userData?.name || `Creator [${activeCode}]`;
  const tierTitle = userData?.tier_title || 'Cosmic Money Plug';
  const level = userData?.level || 1;
  const xp = (userData?.xp || 2500).toLocaleString();
  const referralCount = userData?.referral_count || 5;

  const svg = generateEdgeSigil(activeCode, 240);

  const json = {
    success: true,
    data: {
      referral_code: activeCode,
      display_name: displayName,
      tier_title: tierTitle,
      level,
      xp: userData?.xp || 2500,
      stats: {
        active_referrals: referralCount,
        mrr_usd: referralCount * 10,
        annual_arr: referralCount * 120,
      },
      sigil_svg: svg,
    }
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ ${displayName}'s Verified Creator Profile | MoneyPlugHub Edge</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #02050e;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 24px;
      padding: 2rem;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(56, 189, 248, 0.15);
    }
    .sigil-box {
      width: 200px;
      height: 200px;
      margin: 0 auto 1.2rem auto;
    }
    .name { font-size: 1.5rem; font-weight: 800; color: #fff; margin-bottom: 0.3rem; }
    .title { font-size: 0.85rem; color: #38bdf8; font-family: monospace; font-weight: 700; margin-bottom: 1.2rem; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1.5rem; }
    .stat { background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 12px; padding: 0.6rem; }
    .lbl { font-size: 0.65rem; color: #64748b; text-transform: uppercase; }
    .val { font-size: 0.9rem; font-weight: 700; color: #34d399; font-family: monospace; }
    .btn {
      display: block; width: 100%; background: linear-gradient(135deg, #06b6d4, #10b981);
      color: #020617; font-weight: 800; padding: 0.85rem; border-radius: 14px; text-decoration: none; font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="sigil-box">${svg}</div>
    <div class="name">${displayName}</div>
    <div class="title">CODE: [${activeCode}] • ${tierTitle}</div>
    <div class="stats">
      <div class="stat"><div class="lbl">Level</div><div class="val">Lv. ${level}</div></div>
      <div class="stat"><div class="lbl">XP</div><div class="val">${xp}</div></div>
      <div class="stat"><div class="lbl">Referrals</div><div class="val">${referralCount}</div></div>
    </div>
    <a href="https://moneyplughub.com/go/${activeCode}" class="btn">🚀 Claim Creator Sigil & Join Network</a>
  </div>
</body>
</html>`;

  return { html, json };
}

// ── Standard CORS Headers ──────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PURGE, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control',
  'Access-Control-Max-Age': '86400',
};

/**
 * Main Cloudflare Worker Fetch Handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = performance.now();
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // Handle CORS preflight OPTIONS request
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Cache Bypass check
    const bypassCache = url.searchParams.get('nocache') === '1' || url.searchParams.get('bypass') === 'true';

    // Build Cache API Request Key
    const cacheKey = new Request(url.toString(), { method: 'GET', headers: request.headers });
    const globalCache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;

    // ─────────────────────────────────────────────────────────────────
    //  LAYER 1: Cloudflare Cache API (Sub-10ms Edge Location Match)
    // ─────────────────────────────────────────────────────────────────
    if (method === 'GET' && !bypassCache && globalCache) {
      try {
        const edgeHit = await globalCache.match(cacheKey);
        if (edgeHit) {
          const headers = new Headers(edgeHit.headers);
          const responseTime = (performance.now() - startTime).toFixed(2);
          headers.set('CF-Cache-Status', 'HIT');
          headers.set('X-Worker-Cache', 'EDGE-HIT');
          headers.set('Server-Timing', `cf-edge;desc="HIT";dur=${responseTime}`);
          Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

          return new Response(edgeHit.body, {
            status: edgeHit.status,
            statusText: edgeHit.statusText,
            headers,
          });
        }
      } catch (err) {
        console.warn('Cache API lookup error:', err);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    //  PURGE / INVALIDATION ENDPOINT: POST or PURGE /api/cache/purge
    // ─────────────────────────────────────────────────────────────────
    if (method === 'PURGE' || (url.pathname === '/api/cache/purge' && (method === 'POST' || method === 'DELETE'))) {
      let keyToPurge = url.searchParams.get('key');
      let namespaceName = url.searchParams.get('namespace') || 'all';

      if (!keyToPurge && method === 'POST') {
        try {
          const body: any = await request.json();
          keyToPurge = body?.key || null;
          namespaceName = body?.namespace || namespaceName;
        } catch {}
      }

      if (keyToPurge) {
        if (env.SIGIL_CACHE && (namespaceName === 'sigil' || namespaceName === 'all')) {
          await env.SIGIL_CACHE.delete(keyToPurge);
        }
        if (env.PROFILE_CACHE && (namespaceName === 'profile' || namespaceName === 'all')) {
          await env.PROFILE_CACHE.delete(keyToPurge);
        }
        if (env.CACHE_KV) {
          await env.CACHE_KV.delete(keyToPurge);
        }
        if (globalCache) {
          await globalCache.delete(cacheKey);
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Successfully purged cache key [${keyToPurge}]`,
          timestamp: new Date().toISOString(),
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          }
        });
      }
    }

    const kvSigil = env.SIGIL_CACHE || env.CACHE_KV;
    const kvProfile = env.PROFILE_CACHE || env.CACHE_KV;

    // ─────────────────────────────────────────────────────────────────
    //  ROUTE A: Rendered SVG Sigils (/api/sigil/:code or /sigil/:code)
    // ─────────────────────────────────────────────────────────────────
    const sigilMatch = url.pathname.match(/^\/(?:api\/)?sigil\/([A-Za-z0-9_\-]+)$/);
    if (sigilMatch && !url.pathname.includes('/passport/') && !url.pathname.includes('/market') && !url.pathname.includes('/config') && !url.pathname.includes('/points') && !url.pathname.includes('/ai-architect')) {
      const code = sigilMatch[1].toUpperCase();
      const size = parseInt(url.searchParams.get('size') || '256', 10);
      const aura = url.searchParams.get('aura') || '';
      const glyph = url.searchParams.get('glyph') || '';
      const ring = url.searchParams.get('ring') || '';
      const crest = url.searchParams.get('crest') || '';
      const handle = url.searchParams.get('handle') || '';
      const motto = url.searchParams.get('motto') || '';

      const kvKey = `sigil:${code}:${size}:${aura}:${glyph}:${ring}:${crest}:${handle}:${motto}`;

      // ── LAYER 2: Cloudflare Workers KV Namespace Lookup ──
      if (!bypassCache && kvSigil) {
        try {
          const cachedSvg = await kvSigil.get(kvKey);
          if (cachedSvg) {
            const responseTime = (performance.now() - startTime).toFixed(2);
            const headers = new Headers({
              'Content-Type': 'image/svg+xml; charset=utf-8',
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
              'CF-Cache-Status': 'KV-HIT',
              'X-Worker-Cache': 'KV-HIT',
              'Server-Timing': `kv;desc="HIT";dur=${responseTime}`,
              ...CORS_HEADERS,
            });

            const res = new Response(cachedSvg, { status: 200, headers });
            if (globalCache && ctx && typeof ctx.waitUntil === 'function') {
              ctx.waitUntil(globalCache.put(cacheKey, res.clone()));
            }
            return res;
          }
        } catch (kvErr) {
          console.warn('KV Sigil fetch error:', kvErr);
        }
      }

      // ── LAYER 3: Edge Generation or Origin Fallback ──
      let svg: string;
      try {
        const originUrl = `${env.API_URL || 'https://moneyplughub.com/api'}/sigil/${code}${url.search}`;
        const originRes = await fetch(originUrl, { headers: { 'Accept': 'image/svg+xml' } });
        const contentType = originRes.headers.get('content-type') || '';
        if (originRes.ok && contentType.includes('image/svg')) {
          svg = await originRes.text();
        } else {
          svg = generateEdgeSigil(code, size, { aura, glyph, ring, crest, handle, motto });
        }
      } catch (err) {
        svg = generateEdgeSigil(code, size, { aura, glyph, ring, crest, handle, motto });
      }

      // Store in KV asynchronously
      if (kvSigil) {
        try {
          await kvSigil.put(kvKey, svg, { expirationTtl: 604800 }); // 7 Days TTL
        } catch (putErr) {
          console.warn('KV Sigil put error:', putErr);
        }
      }

      const responseTime = (performance.now() - startTime).toFixed(2);
      const headers = new Headers({
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
        'CF-Cache-Status': 'MISS',
        'X-Worker-Cache': 'MISS',
        'Server-Timing': `miss;dur=${responseTime}`,
        ...CORS_HEADERS,
      });

      const response = new Response(svg, { status: 200, headers });
      if (globalCache && ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(globalCache.put(cacheKey, response.clone()));
      }
      return response;
    }

    // ─────────────────────────────────────────────────────────────────
    //  ROUTE B: Public Creator Profile Cards & Passports (/api/sigil/passport/:code or /api/creator/:code)
    // ─────────────────────────────────────────────────────────────────
    const passportMatch = url.pathname.match(/^\/(?:api\/)?(?:sigil\/passport|creator|passport)\/([A-Za-z0-9_\-]+)$/);
    if (passportMatch) {
      const code = passportMatch[1].toUpperCase();
      const format = url.searchParams.get('format') || (request.headers.get('accept')?.includes('text/html') ? 'html' : 'json');
      const kvKey = `profile:${code}:${format}`;

      // ── LAYER 2: Cloudflare Workers KV Namespace Lookup ──
      if (!bypassCache && kvProfile) {
        try {
          const cachedData = await kvProfile.get(kvKey);
          if (cachedData) {
            const responseTime = (performance.now() - startTime).toFixed(2);
            const contentType = format === 'html' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8';
            const headers = new Headers({
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=300, s-maxage=3600',
              'CF-Cache-Status': 'KV-HIT',
              'X-Worker-Cache': 'KV-HIT',
              'Server-Timing': `kv;desc="HIT";dur=${responseTime}`,
              ...CORS_HEADERS,
            });

            const res = new Response(cachedData, { status: 200, headers });
            if (globalCache && ctx && typeof ctx.waitUntil === 'function') {
              ctx.waitUntil(globalCache.put(cacheKey, res.clone()));
            }
            return res;
          }
        } catch (kvErr) {
          console.warn('KV Profile fetch error:', kvErr);
        }
      }

      // ── LAYER 3: Origin Fetch or Edge Generation Fallback ──
      let profileBody: string;
      let isHtml = format === 'html';

      try {
        const originUrl = `${env.API_URL || 'https://moneyplughub.com/api'}/sigil/passport/${code}`;
        const originRes = await fetch(originUrl, { headers: { 'Accept': request.headers.get('accept') || 'application/json' } });
        const contentType = originRes.headers.get('content-type') || '';

        if (originRes.ok && (contentType.includes('application/json') || contentType.includes('text/html'))) {
          profileBody = await originRes.text();
          if (contentType.includes('text/html')) {
            isHtml = true;
          }
        } else {
          const edgeData = generateEdgeProfileCard(code);
          profileBody = isHtml ? edgeData.html : JSON.stringify(edgeData.json);
        }
      } catch (err) {
        const edgeData = generateEdgeProfileCard(code);
        profileBody = isHtml ? edgeData.html : JSON.stringify(edgeData.json);
      }

      // Store in KV asynchronously
      if (kvProfile) {
        try {
          await kvProfile.put(kvKey, profileBody, { expirationTtl: 3600 }); // 1 Hour TTL
        } catch (putErr) {
          console.warn('KV Profile put error:', putErr);
        }
      }

      const responseTime = (performance.now() - startTime).toFixed(2);
      const contentType = isHtml ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8';
      const headers = new Headers({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'CF-Cache-Status': 'MISS',
        'X-Worker-Cache': 'MISS',
        'Server-Timing': `miss;dur=${responseTime}`,
        ...CORS_HEADERS,
      });

      const response = new Response(profileBody, { status: 200, headers });
      if (globalCache && ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(globalCache.put(cacheKey, response.clone()));
      }
      return response;
    }

    // ─────────────────────────────────────────────────────────────────
    //  FALLTHROUGH: Proxy standard requests to origin
    // ─────────────────────────────────────────────────────────────────
    try {
      const originUrl = `${env.API_URL || 'https://moneyplughub.com/api'}${url.pathname.replace(/^\/api/, '')}${url.search}`;
      const originRes = await fetch(originUrl, {
        method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : await request.blob(),
      });

      const headers = new Headers(originRes.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

      return new Response(originRes.body, {
        status: originRes.status,
        statusText: originRes.statusText,
        headers,
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: 'WORKER_ORIGIN_ERROR', message: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  }
};
