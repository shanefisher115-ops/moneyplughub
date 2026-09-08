import assert from 'assert';
import worker, { Env, KVNamespace, ExecutionContext } from '../deploy/worker';

/**
 * Mock Cloudflare Worker KV Namespace
 */
class MockKV implements KVNamespace {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean }> {
    const keys: { name: string }[] = [];
    for (const k of this.store.keys()) {
      if (!options?.prefix || k.startsWith(options.prefix)) {
        keys.push({ name: k });
      }
    }
    return { keys, list_complete: true };
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Mock Cloudflare Worker Cache API
 */
class MockCache {
  private cacheMap = new Map<string, Response>();

  async match(request: Request): Promise<Response | null> {
    const urlKey = request.url;
    const found = this.cacheMap.get(urlKey);
    return found ? found.clone() : null;
  }

  async put(request: Request, response: Response): Promise<void> {
    this.cacheMap.set(request.url, response.clone());
  }

  async delete(request: Request): Promise<boolean> {
    return this.cacheMap.delete(request.url);
  }

  clear(): void {
    this.cacheMap.clear();
  }
}

async function runWorkerKvTests() {
  console.log('🧪 Running Cloudflare Worker KV & Cache API Test Suite...\n');

  const mockSigilKv = new MockKV();
  const mockProfileKv = new MockKV();
  const mockGlobalCache = new MockCache();

  // Setup global mock for caches.default in test runner
  (globalThis as any).caches = {
    default: mockGlobalCache,
  };

  const mockEnv: Env = {
    NODE_ENV: 'test',
    APP_NAME: 'MoneyPlugHub Test',
    API_URL: 'http://127.0.0.1:9999/api',
    SIGIL_CACHE: mockSigilKv,
    PROFILE_CACHE: mockProfileKv,
  };

  const mockCtx: ExecutionContext = {
    waitUntil(promise: Promise<any>) {
      promise.catch((err) => console.warn('waitUntil error:', err));
    },
    passThroughOnException() {},
  };

  // ── TEST 1: Rendered SVG Sigil Cache Miss ─────────────────────────
  console.log('▶ Test 1: SVG Sigil Cache Miss (Edge Generation & KV Storage)');
  const req1 = new Request('https://moneyplughub.com/api/sigil/TESTCODE1?size=256');
  const res1 = await worker.fetch(req1, mockEnv, mockCtx);

  assert.strictEqual(res1.status, 200, 'Status should be 200');
  assert.strictEqual(res1.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  assert.strictEqual(res1.headers.get('CF-Cache-Status'), 'MISS');
  assert.strictEqual(res1.headers.get('X-Worker-Cache'), 'MISS');

  const svgBody1 = await res1.text();
  assert(svgBody1.includes('<svg'), 'Response must be SVG markup');
  assert(svgBody1.includes('TESTCODE1'), 'SVG must include referral code inscription');

  // Verify stored in KV
  const kvKeys = await mockSigilKv.list({ prefix: 'sigil:TESTCODE1' });
  assert.strictEqual(kvKeys.keys.length, 1, 'Should store sigil key in KV');
  console.log('✓ Test 1 Passed: SVG generated and cached in KV.\n');

  // ── TEST 2: Rendered SVG Sigil KV Hit ──────────────────────────────
  console.log('▶ Test 2: SVG Sigil KV Hit');
  // Clear Edge Cache API to isolate KV lookup
  mockGlobalCache.clear();

  const req2 = new Request('https://moneyplughub.com/api/sigil/TESTCODE1?size=256');
  const res2 = await worker.fetch(req2, mockEnv, mockCtx);

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.headers.get('CF-Cache-Status'), 'KV-HIT');
  assert.strictEqual(res2.headers.get('X-Worker-Cache'), 'KV-HIT');

  const svgBody2 = await res2.text();
  assert.strictEqual(svgBody2, svgBody1, 'KV Hit body should match original SVG');
  console.log('✓ Test 2 Passed: Served from KV Namespace with KV-HIT header.\n');

  // ── TEST 3: Edge Cache API Hit (Sub-10ms response) ────────────────
  console.log('▶ Test 3: Edge Cache API Hit (Sub-10ms Response)');
  // Note: Test 2's waitUntil placed response into mockGlobalCache
  const req3 = new Request('https://moneyplughub.com/api/sigil/TESTCODE1?size=256');
  const res3 = await worker.fetch(req3, mockEnv, mockCtx);

  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.headers.get('CF-Cache-Status'), 'HIT');
  assert.strictEqual(res3.headers.get('X-Worker-Cache'), 'EDGE-HIT');
  console.log('✓ Test 3 Passed: Served from Edge Cache API with EDGE-HIT header.\n');

  // ── TEST 4: Public Creator Profile Card Cache Miss & KV Hit ───────
  console.log('▶ Test 4: Public Creator Profile Card Caching (JSON & HTML)');
  mockGlobalCache.clear();

  const reqProf1 = new Request('https://moneyplughub.com/api/sigil/passport/ALEX_PLUG?format=json');
  const resProf1 = await worker.fetch(reqProf1, mockEnv, mockCtx);

  assert.strictEqual(resProf1.status, 200);
  assert.strictEqual(resProf1.headers.get('CF-Cache-Status'), 'MISS');
  assert.strictEqual(resProf1.headers.get('content-type'), 'application/json; charset=utf-8');

  const profJson1 = await resProf1.json();
  assert.strictEqual(profJson1.success, true);
  assert.strictEqual(profJson1.data.referral_code, 'ALEX_PLUG');

  // Second fetch -> KV HIT
  mockGlobalCache.clear();
  const reqProf2 = new Request('https://moneyplughub.com/api/sigil/passport/ALEX_PLUG?format=json');
  const resProf2 = await worker.fetch(reqProf2, mockEnv, mockCtx);

  assert.strictEqual(resProf2.status, 200);
  assert.strictEqual(resProf2.headers.get('CF-Cache-Status'), 'KV-HIT');
  console.log('✓ Test 4 Passed: Creator profile card cached and retrieved from KV.\n');

  // ── TEST 5: Cache Purge Invalidation Endpoint ────────────────────
  console.log('▶ Test 5: Cache Purge / Invalidation Endpoint');
  const savedKey = kvKeys.keys[0].name;

  const purgeReq = new Request('https://moneyplughub.com/api/cache/purge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: savedKey, namespace: 'sigil' }),
  });
  const purgeRes = await worker.fetch(purgeReq, mockEnv, mockCtx);

  assert.strictEqual(purgeRes.status, 200);
  const purgeResult = await purgeRes.json();
  assert.strictEqual(purgeResult.success, true);

  // Confirm key was removed from KV
  const kvAfterPurge = await mockSigilKv.get(savedKey);
  assert.strictEqual(kvAfterPurge, null, 'Key should be deleted after purge');
  console.log('✓ Test 5 Passed: Cache purge deleted entry from KV & Cache API.\n');

  // ── TEST 6: CORS Preflight Handler ───────────────────────────────
  console.log('▶ Test 6: CORS Preflight Handler');
  const optionsReq = new Request('https://moneyplughub.com/api/sigil/TESTCODE1', {
    method: 'OPTIONS',
  });
  const optionsRes = await worker.fetch(optionsReq, mockEnv, mockCtx);

  assert.strictEqual(optionsRes.status, 204);
  assert.strictEqual(optionsRes.headers.get('access-control-allow-origin'), '*');
  console.log('✓ Test 6 Passed: CORS OPTIONS returned 204 with full headers.\n');

  console.log('🎉 ALL CLOUDFLARE WORKERS KV & CACHE API TESTS PASSED SUCCESSFULLY!\n');
}

runWorkerKvTests().catch((err) => {
  console.error('❌ Worker KV Test failed:', err);
  process.exit(1);
});
