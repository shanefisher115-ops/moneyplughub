/**
 * MoneyPlugHub Cloudflare Worker
 * Location: deploy/worker.ts
 *
 * Capabilities:
 *  1. Cache public referral link redirects at the Cloudflare edge (/go/*, /r/*, /referral/*, /api/referrals/track/*)
 *  2. Proxy real-time MoneyOS telemetry events with sub-20ms latency (/api/peersignal/*, /api/moneyos/*, /api/telemetry/*)
 *  3. Seamless passthrough proxying for all other application routes
 */

export interface Env {
  UPSTREAM_ORIGIN?: string;
  API_URL?: string;
  APP_NAME?: string;
  NODE_ENV?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Referral Link Redirect Handler (Cloudflare Edge Caching)
    if (isReferralRoute(pathname)) {
      return handleReferralRoute(request, env, ctx, url);
    }

    // 2. Real-Time MoneyOS Telemetry Proxy Handler (Sub-20ms Latency)
    if (isTelemetryRoute(pathname)) {
      return handleTelemetryRoute(request, env, ctx, url);
    }

    // 3. Fallback Passthrough Proxy
    return handleFallbackProxy(request, env, url);
  },
};

/**
 * Checks if URL pathname is a public referral link or redirect route
 */
export function isReferralRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/go/') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/referral/') ||
    pathname.startsWith('/api/referrals/track/') ||
    pathname.startsWith('/api/referrals/creator-card/') ||
    pathname.startsWith('/api/growth/share-card/') ||
    pathname.startsWith('/api/sigil/')
  );
}

/**
 * Checks if URL pathname is a real-time MoneyOS telemetry or event route
 */
export function isTelemetryRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/api/peersignal/') ||
    pathname.startsWith('/api/moneyos/') ||
    pathname.startsWith('/api/telemetry/')
  );
}

/**
 * Handles referral routes with Cloudflare Edge Caching
 */
export async function handleReferralRoute(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL
): Promise<Response> {
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cache = (globalThis as any).caches?.default;

  // Check Cloudflare Edge Cache for GET requests
  if (cache && request.method === 'GET') {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const responseHeaders = new Headers(cachedResponse.headers);
        responseHeaders.set('X-Worker-Cache', 'HIT');
        responseHeaders.set('X-Edge-Cache', 'HIT');
        responseHeaders.set('X-MoneyPlug-Referral-Edge', '1');

        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: responseHeaders,
        });
      }
    } catch (e) {
      // Cache match error fallback
    }
  }

  // Cache miss: Proxy to Upstream Origin
  const upstreamOrigin = getUpstreamOrigin(env, url);
  const targetUrl = new URL(url.pathname + url.search, upstreamOrigin);

  const upstreamRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'manual',
  });

  const originResponse = await fetch(upstreamRequest);

  // Construct cached edge response headers
  const responseHeaders = new Headers(originResponse.headers);
  responseHeaders.set('X-Worker-Cache', 'MISS');
  responseHeaders.set('X-Edge-Cache', 'MISS');
  responseHeaders.set('X-MoneyPlug-Referral-Edge', '1');

  // Apply Edge Cache-Control headers for referral redirects / cards
  const isCacheableStatus = [200, 301, 302, 307, 308].includes(originResponse.status);
  if (isCacheableStatus && request.method === 'GET') {
    responseHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  }

  const responseToReturn = new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: responseHeaders,
  });

  // Put into Cloudflare Edge Cache asynchronously
  if (cache && isCacheableStatus && request.method === 'GET') {
    try {
      const responseToCache = responseToReturn.clone();
      ctx.waitUntil(cache.put(cacheKey, responseToCache));
    } catch (e) {
      // Non-fatal cache put error
    }
  }

  return responseToReturn;
}

/**
 * Handles real-time MoneyOS Telemetry event proxying with sub-20ms latency
 */
export async function handleTelemetryRoute(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL
): Promise<Response> {
  const startTime = performance.now();
  const upstreamOrigin = getUpstreamOrigin(env, url);
  const targetUrl = new URL(url.pathname + url.search, upstreamOrigin);

  const isEmitEvent =
    request.method === 'POST' &&
    (url.pathname.includes('/emit') ||
      url.pathname.includes('/telemetry') ||
      url.pathname.includes('/endorse'));

  // Ultra-fast sub-20ms non-blocking dispatch for telemetry emit events
  if (isEmitEvent) {
    const clonedRequest = request.clone();

    // Dispatch telemetry payload to origin in background via ctx.waitUntil
    ctx.waitUntil(
      (async () => {
        try {
          await fetch(targetUrl.toString(), {
            method: 'POST',
            headers: clonedRequest.headers,
            body: await clonedRequest.arrayBuffer(),
          });
        } catch (err) {
          // Telemetry background push error handling
        }
      })()
    );

    const durationMs = performance.now() - startTime;
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-MoneyOS-Telemetry-Latency': `${durationMs.toFixed(2)}ms`,
      'X-Proxy-Latency-Ms': durationMs.toFixed(2),
      'Server-Timing': `worker;dur=${durationMs.toFixed(2)}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: 'queued',
        telemetry: 'MoneyOS telemetry event accepted at Cloudflare Edge',
        timestamp: new Date().toISOString(),
        latencyMs: Number(durationMs.toFixed(2)),
      }),
      {
        status: 202,
        statusText: 'Accepted',
        headers: responseHeaders,
      }
    );
  }

  // Synchronous telemetry query proxying (e.g. push-events, context, briefing)
  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  const originResponse = await fetch(proxyRequest, {
    // @ts-ignore Cloudflare Worker specific fetch options
    cf: { cacheTtl: 0 },
  });

  const durationMs = performance.now() - startTime;
  const responseHeaders = new Headers(originResponse.headers);

  responseHeaders.set('X-MoneyOS-Telemetry-Latency', `${durationMs.toFixed(2)}ms`);
  responseHeaders.set('X-Proxy-Latency-Ms', durationMs.toFixed(2));
  responseHeaders.set('Server-Timing', `worker;dur=${durationMs.toFixed(2)}`);

  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: responseHeaders,
  });
}

/**
 * Fallback proxy for all other application requests
 */
export async function handleFallbackProxy(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const upstreamOrigin = getUpstreamOrigin(env, url);
  const targetUrl = new URL(url.pathname + url.search, upstreamOrigin);

  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  return fetch(proxyRequest);
}

/**
 * Resolves upstream origin URL from environment variable or request fallback
 */
function getUpstreamOrigin(env: Env, url: URL): string {
  if (env.UPSTREAM_ORIGIN) return env.UPSTREAM_ORIGIN;
  if (env.API_URL) {
    try {
      const apiUrl = new URL(env.API_URL);
      return apiUrl.origin;
    } catch {}
  }
  return url.origin;
}
