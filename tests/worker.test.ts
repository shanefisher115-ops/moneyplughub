import assert from 'assert';
import worker, { isReferralRoute, isTelemetryRoute, Env } from '../deploy/worker';

async function runWorkerTests() {
  console.log('⚡ Running Cloudflare Worker Edge & Telemetry Proxy Tests...\n');

  // Test 1: Route Matching Functions
  console.log('Test 1: Route Matching Functions...');
  assert.strictEqual(isReferralRoute('/go/maxbounty'), true);
  assert.strictEqual(isReferralRoute('/r/CREATOR777'), true);
  assert.strictEqual(isReferralRoute('/api/referrals/track/PLUG-ALEX'), true);
  assert.strictEqual(isReferralRoute('/api/referrals/creator-card/PLUG-ALEX'), true);
  assert.strictEqual(isReferralRoute('/dashboard'), false);

  assert.strictEqual(isTelemetryRoute('/api/peersignal/emit'), true);
  assert.strictEqual(isTelemetryRoute('/api/peersignal/push-events'), true);
  assert.strictEqual(isTelemetryRoute('/api/moneyos/chat'), true);
  assert.strictEqual(isTelemetryRoute('/api/moneyos/telemetry'), true);
  assert.strictEqual(isTelemetryRoute('/api/telemetry/event'), true);
  assert.strictEqual(isTelemetryRoute('/api/users/profile'), false);
  console.log('✓ Test 1 Passed: Route matchers correctly identify referral and telemetry endpoints.');

  // Mock Environment and ExecutionContext
  const mockEnv: Env = {
    UPSTREAM_ORIGIN: 'https://moneyplughub.com',
    API_URL: 'https://moneyplughub.com/api',
    APP_NAME: 'MoneyPlugHub',
    NODE_ENV: 'test',
  };

  const waitUntilTasks: Promise<any>[] = [];
  const mockCtx: ExecutionContext = {
    waitUntil(promise: Promise<any>) {
      waitUntilTasks.push(promise);
    },
    passThroughOnException() {},
  };

  // Mock global fetch for testing
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.includes('/api/referrals/track/TESTCODE')) {
      return new Response(JSON.stringify({ success: true, tracking: 'applied' }), {
        status: 302,
        headers: {
          'Location': 'https://moneyplughub.com/?ref=TESTCODE',
          'Content-Type': 'application/json',
        },
      });
    }

    if (urlStr.includes('/api/moneyos/context')) {
      return new Response(JSON.stringify({ success: true, data: { netWorthUsd: '10000.00' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Default Mock' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    // Test 2: Referral Link Edge Caching Proxy
    console.log('Test 2: Referral Link Edge Caching...');
    const reqReferral = new Request('https://moneyplughub.com/api/referrals/track/TESTCODE', {
      method: 'GET',
    });

    const resReferral = await worker.fetch(reqReferral, mockEnv, mockCtx);
    assert.strictEqual(resReferral.status, 302);
    assert.strictEqual(resReferral.headers.get('X-Worker-Cache'), 'MISS');
    assert.strictEqual(resReferral.headers.get('X-MoneyPlug-Referral-Edge'), '1');
    assert(resReferral.headers.get('Cache-Control')?.includes('s-maxage=86400'), 'Must include s-maxage edge cache header');
    console.log('✓ Test 2 Passed: Referral link proxy sets Cache-Control and edge headers.');

    // Test 3: Real-Time MoneyOS Telemetry Emit Sub-20ms Latency Response
    console.log('Test 3: Real-Time Telemetry Emit Sub-20ms Latency Response...');
    const reqTelemetry = new Request('https://moneyplughub.com/api/peersignal/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'PEER_SIGNAL_BURST', payload: { delta: 100 } }),
    });

    const startTime = performance.now();
    const resTelemetry = await worker.fetch(reqTelemetry, mockEnv, mockCtx);
    const durationMs = performance.now() - startTime;

    assert.strictEqual(resTelemetry.status, 202, 'Emit events must return 202 Accepted');
    assert(durationMs < 20, `Telemetry emit response must be sub-20ms (got ${durationMs.toFixed(2)}ms)`);

    const telemetryData = await resTelemetry.json();
    assert.strictEqual(telemetryData.success, true);
    assert.strictEqual(telemetryData.status, 'queued');

    assert(resTelemetry.headers.has('X-MoneyOS-Telemetry-Latency'), 'Must return latency header');
    assert(resTelemetry.headers.has('X-Proxy-Latency-Ms'), 'Must return proxy latency ms header');
    assert(resTelemetry.headers.has('Server-Timing'), 'Must return Server-Timing header');
    console.log(`✓ Test 3 Passed: Telemetry emit responded in ${durationMs.toFixed(2)}ms (<20ms target).`);

    // Test 4: Synchronous MoneyOS Route Proxy with Timing
    console.log('Test 4: Synchronous MoneyOS Route Proxying...');
    const reqMoneyOS = new Request('https://moneyplughub.com/api/moneyos/context', {
      method: 'GET',
    });

    const resMoneyOS = await worker.fetch(reqMoneyOS, mockEnv, mockCtx);
    assert.strictEqual(resMoneyOS.status, 200);
    assert(resMoneyOS.headers.has('X-MoneyOS-Telemetry-Latency'));
    assert(resMoneyOS.headers.has('Server-Timing'));
    const osData = await resMoneyOS.json();
    assert.strictEqual(osData.data.netWorthUsd, '10000.00');
    console.log('✓ Test 4 Passed: Synchronous MoneyOS context route proxied with timing.');

    console.log('\n🎉 ALL CLOUDFLARE WORKER TESTS PASSED WITH 100% SUCCESS!\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runWorkerTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Worker Test failed:', err);
    process.exit(1);
  });
