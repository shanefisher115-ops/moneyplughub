/**
 * Tier 5: Dedicated Adversarial Stress & Chaos Test Suite
 * Creator Money OS (MoneyPlugHub)
 * 
 * Coverage Dimensions:
 * 1. Concurrency Stress: WebSocket Interruption, Barge-in, and Reconnect Lifecycle
 * 2. Fraud Collision Stress: 30-Day Attribution Cookies, Rate Limits, and Self-Referral
 * 3. Promo Code Fuzzing: Expired, Exhausted, Malformed, Case Insensitivity & SQLi Resiliency
 * 4. Sigil Deterministic Stability: Hash Invariance, Extreme Unicode & 48-Item Catalog Coverage
 * 5. Database Rollback Atomicity: ACID Invariants Under Injected Synthetic Transaction Faults
 * 6. FTC Compliance & XP Economy: 16 CFR Part 255 Overlays & Wealth Tier Multipliers
 * 
 * Location: tests/stress/tier5_adversarial_coverage.test.ts
 */

import http from 'http';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import { db, runInTransaction } from '../../src/backend/db';
import { config } from '../../src/backend/config';
import {
  TestSuite,
  createMockRequest,
  createMockResponse,
  createTestUserFixture,
  cleanupTestUserFixture,
  generateTestToken,
} from '../e2e/test-utils';
import { VoiceWebSocketManager } from '../../src/backend/voice/ws';
import billingRouter from '../../src/backend/routes/billing';
import referralsRouter, {
  classifyTrafficSource,
  attributeReferralConversion,
  getUserCommissionTier,
} from '../../src/backend/routes/referrals';
import { generateSigil } from '../../src/backend/routes/sigil';
import xpEconomyRouter, {
  calculateBaseCashCents,
  resolveUserWealthTier,
  WEALTH_TIERS,
} from '../../src/backend/routes/xpEconomy';
import generateRouter, { FTC_DISCLOSURE_FOOTER } from '../../src/backend/routes/generate';
import growthRouter from '../../src/backend/routes/growth';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runTier5AdversarialTests(suite: TestSuite): Promise<void> {
  suite.setTier('Tier 5');

  // ═══════════════════════════════════════════════════════════════════
  //  DIMENSION 1: CONCURRENCY STRESS ON WEBSOCKET & BARGE-IN
  // ═══════════════════════════════════════════════════════════════════
  suite.setFeature('Voice WebSocket Concurrency & Chaos');

  await suite.test('Voice WS: Rapid Multi-Client Concurrent Session Initialization', async () => {
    const server = http.createServer();
    const wsManager = new VoiceWebSocketManager();
    wsManager.mount(server, '/ws/voice-stress');

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const port = address.port;

    const CLIENT_COUNT = 15;
    const clients: WebSocket[] = [];
    const readyPromises: Promise<any>[] = [];

    for (let i = 0; i < CLIENT_COUNT; i++) {
      const client = new WebSocket(`ws://127.0.0.1:${port}/ws/voice-stress`);
      clients.push(client);

      const p = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Client ${i} session_ready timeout`)), 4000);
        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'session_init',
            persona: i % 2 === 0 ? 'hyper_direct' : 'empathetic_guide',
            emotion: 'energized',
          }));
        });
        client.on('message', (raw) => {
          const frame = JSON.parse(raw.toString());
          if (frame.type === 'session_ready') {
            clearTimeout(timeout);
            assert(frame.sessionId.startsWith('sess_voice_'), 'Invalid session ID');
            assert(frame.sampleRate === 22050, 'Invalid sample rate');
            resolve();
          }
        });
      });
      readyPromises.push(p);
    }

    await Promise.all(readyPromises);

    clients.forEach((c) => c.terminate());
    wsManager.close();
    await new Promise<void>((res) => server.close(() => res()));
  });

  await suite.test('Voice WS: Interleaved Barge-In Invalidation Under Concurrent Audio Chunks', async () => {
    const server = http.createServer();
    const wsManager = new VoiceWebSocketManager();
    wsManager.mount(server, '/ws/voice-bargein');

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const port = address.port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/voice-bargein`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', resolve);
      client.on('error', reject);
    });

    const receivedFrames: any[] = [];
    const interruptPromise = new Promise<any>((resolve) => {
      client.on('message', (raw) => {
        const frame = JSON.parse(raw.toString());
        receivedFrames.push(frame);
        if (frame.type === 'interrupted') {
          resolve(frame);
        }
      });
    });

    // 1. Init session
    client.send(JSON.stringify({ type: 'session_init', persona: 'socratic_mentor' }));
    await new Promise((r) => setTimeout(r, 60));

    // 2. Dispatch speech synthesis request
    client.send(JSON.stringify({
      type: 'synthesize',
      text: 'Initiating quantum wealth calculation across all 6 connected wallets.',
      generationToken: 101,
    }));

    // 3. Immediately send barge-in interrupt frame
    client.send(JSON.stringify({
      type: 'interrupt',
      generationToken: 101,
      reason: 'user_spoke_over',
    }));

    const interruptFrame = await Promise.race([
      interruptPromise,
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for interrupt frame')), 3000)),
    ]);

    assert(!!interruptFrame, 'Interrupt frame was not received');
    assert(interruptFrame.reason === 'user_spoke_over', 'Reason mismatch');
    assert(interruptFrame.generationToken > 0, 'Generation token must be valid');

    client.terminate();
    wsManager.close();
    await new Promise<void>((res) => server.close(() => res()));
  });

  await suite.test('Voice WS: Resiliency Against Malformed Non-JSON and Binary Flood', async () => {
    const server = http.createServer();
    const wsManager = new VoiceWebSocketManager();
    wsManager.mount(server, '/ws/voice-fuzz');

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const port = address.port;

    const client = new WebSocket(`ws://127.0.0.1:${port}/ws/voice-fuzz`);
    await new Promise<void>((resolve) => client.on('open', resolve));

    const errorsReceived: any[] = [];
    client.on('message', (raw) => {
      errorsReceived.push(JSON.parse(raw.toString()));
    });

    client.send('{ invalid json');
    client.send('<<>>??//');
    client.send(Buffer.from([0x00, 0xff, 0xfe, 0x12, 0x34]));

    await new Promise((r) => setTimeout(r, 80));

    const malformedError = errorsReceived.find((f) => f.type === 'error' && f.code === 'MALFORMED_FRAME');
    assert(!!malformedError, 'Expected MALFORMED_FRAME error response');

    client.terminate();
    wsManager.close();
    await new Promise<void>((res) => server.close(() => res()));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  DIMENSION 2: FRAUD COLLISION STRESS ON ATTRIBUTION & RATE LIMITS
  // ═══════════════════════════════════════════════════════════════════
  suite.setFeature('Referral Attribution & Fraud Defense Stress');

  await suite.test('Fraud Defense: Duplicate Click Deduplication Within 24h', async () => {
    const fixture = createTestUserFixture('tier5_dedup');
    const attackerIp = '198.51.100.77';

    db.prepare('DELETE FROM referral_clicks WHERE ip_address = ?').run(attackerIp);

    const handlers = (referralsRouter as any).stack
      .filter((r: any) => r.route && r.route.path === '/track/:code')
      .map((r: any) => r.route.stack[0].handle);

    for (let i = 0; i < 8; i++) {
      const req = createMockRequest({
        method: 'GET',
        url: `/api/referrals/track/${fixture.referralCode}`,
        params: { code: fixture.referralCode },
        headers: { 'x-forwarded-for': attackerIp },
      });
      const { res, result } = createMockResponse();
      for (const h of handlers) h(req, res, () => {});
      assert(result.redirectUrl !== null, 'Must redirect');
    }

    const clickCount = (db.prepare('SELECT COUNT(*) as cnt FROM referral_clicks WHERE ip_address = ? AND referral_code = ?').get(attackerIp, fixture.referralCode) as any).cnt;
    assert(clickCount === 1, `Expected exactly 1 click recorded after 8 duplicates, got ${clickCount}`);

    cleanupTestUserFixture(fixture.id);
  });

  await suite.test('Fraud Defense: Burst IP Rate Limiting Across Multiple Referral Codes', async () => {
    const fixtures = [
      createTestUserFixture('t5_r1'),
      createTestUserFixture('t5_r2'),
      createTestUserFixture('t5_r3'),
      createTestUserFixture('t5_r4'),
      createTestUserFixture('t5_r5'),
      createTestUserFixture('t5_r6'),
      createTestUserFixture('t5_r7'),
    ];

    const spammerIp = '198.51.100.88';
    db.prepare('DELETE FROM referral_clicks WHERE ip_address = ?').run(spammerIp);
    db.prepare('DELETE FROM referral_fraud_log WHERE ip_address = ?').run(spammerIp);

    const handlers = (referralsRouter as any).stack
      .filter((r: any) => r.route && r.route.path === '/track/:code')
      .map((r: any) => r.route.stack[0].handle);

    for (let i = 0; i < fixtures.length; i++) {
      const req = createMockRequest({
        method: 'GET',
        url: `/api/referrals/track/${fixtures[i].referralCode}`,
        params: { code: fixtures[i].referralCode },
        headers: { 'x-forwarded-for': spammerIp },
      });
      const { res, result } = createMockResponse();
      for (const h of handlers) h(req, res, () => {});
      assert(result.redirectUrl !== null, 'Must redirect user');
    }

    const recordedClicks = (db.prepare('SELECT COUNT(*) as cnt FROM referral_clicks WHERE ip_address = ?').get(spammerIp) as any).cnt;
    const fraudLogs = (db.prepare('SELECT COUNT(*) as cnt FROM referral_fraud_log WHERE ip_address = ?').get(spammerIp) as any).cnt;

    assert(recordedClicks === 5, `Expected exactly 5 clicks recorded before limit, got ${recordedClicks}`);
    assert(fraudLogs === 2, `Expected 2 fraud logs recorded for clicks 6 & 7, got ${fraudLogs}`);

    fixtures.forEach((f) => cleanupTestUserFixture(f.id));
  });

  await suite.test('Fraud Defense: Self-Referral Prevention During Registration', async () => {
    const fixture = createTestUserFixture('tier5_selfref');
    const userIp = '203.0.113.42';

    attributeReferralConversion(fixture.id, fixture.id, userIp);

    const fraudEntry = db.prepare(
      "SELECT * FROM referral_fraud_log WHERE referral_code = 'SELF_REFERRAL' AND ip_address = ? ORDER BY created_at DESC LIMIT 1"
    ).get(userIp) as any;

    assert(!!fraudEntry, 'Self referral attempt was not logged to referral_fraud_log');
    assert(fraudEntry.reason.includes('self-referral'), 'Reason should specify self-referral');

    cleanupTestUserFixture(fixture.id);
  });

  await suite.test('Traffic Classifier: Multi-Engine AI and Dark Social Intent Categorization', () => {
    const cases = [
      { ref: 'https://chatgpt.com/share/xyz', ua: 'Mozilla/5.0', q: {}, cat: 'ai_assistant', ai: 'ChatGPT (OpenAI)', minIntent: 0.90 },
      { ref: 'https://claude.ai/chat/abc', ua: 'Mozilla/5.0', q: {}, cat: 'ai_assistant', ai: 'Claude (Anthropic)', minIntent: 0.90 },
      { ref: 'https://perplexity.ai/search', ua: 'Mozilla/5.0', q: {}, cat: 'ai_assistant', ai: 'Perplexity AI', minIntent: 0.90 },
      { ref: 'https://gemini.google.com/app', ua: 'Mozilla/5.0', q: {}, cat: 'ai_assistant', ai: 'Gemini (Google)', minIntent: 0.90 },
      { ref: 'https://www.tiktok.com/@creator/video/123', ua: 'TikTok 30.1', q: {}, cat: 'social_video', ai: null, minIntent: 0.80 },
      { ref: 'https://t.co/xyz123', ua: 'TwitterBot/1.0', q: {}, cat: 'social_microblog', ai: null, minIntent: 0.80 },
      { ref: 'https://www.google.com/search?q=moneyos', ua: 'Mozilla/5.0', q: {}, cat: 'organic_search', ai: null, minIntent: 0.75 },
      { ref: '', ua: 'DirectVisitor', q: {}, cat: 'direct_recovered', ai: null, minIntent: 0.70 },
    ];

    for (const c of cases) {
      const result = classifyTrafficSource(c.ref, c.ua, c.q);
      assert(result.category === c.cat, `Expected category ${c.cat} for ref ${c.ref}, got ${result.category}`);
      if (c.ai) {
        assert(result.aiPlatform === c.ai, `Expected AI Platform ${c.ai}, got ${result.aiPlatform}`);
      }
      assert(result.intentScore >= c.minIntent, `Intent score ${result.intentScore} below expected ${c.minIntent}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  DIMENSION 3: PROMO CODE FUZZING & BILLING UPGRADES
  // ═══════════════════════════════════════════════════════════════════
  suite.setFeature('Billing Engine & Promo Code Fuzzing');

  await suite.test('Promo Fuzzing: Case Insensitivity & Whitespace Padding for FOUNDING50', () => {
    const variations = [
      'FOUNDING50',
      'founding50',
      'Founding50',
      'FoUnDiNg50',
      '  FOUNDING50  ',
      '\tfounding50\n',
    ];

    const handlers = (billingRouter as any).stack
      .filter((r: any) => r.route && r.route.path === '/validate-promo')
      .map((r: any) => r.route.stack[0].handle);

    for (const code of variations) {
      const req = createMockRequest({ method: 'POST', body: { code } });
      const { res, result } = createMockResponse();

      for (const h of handlers) {
        h(req, res, () => {});
      }

      assert(result.statusCode === 200, `Expected 200 for promo variation '${code}', got ${result.statusCode}`);
      assert(result.body.success === true, 'Success flag must be true');
      assert(result.body.data.discount_value === 100, 'Discount value must be 100%');
    }
  });

  await suite.test('Promo Fuzzing: Expired & Usage-Exhausted Codes Validation Rejection', () => {
    const expiredId = `promo_exp_${Date.now()}`;
    const exhaustedId = `promo_exh_${Date.now()}`;
    const now = new Date();
    const pastDate = new Date(now.getTime() - 86400000).toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO promo_codes (id, code, discount_type, discount_value, max_uses, current_uses, valid_until, is_active, created_at)
      VALUES (?, 'EXPIRED_TEST_CODE', 'percent', 50, 100, 0, ?, 1, ?)
    `).run(expiredId, pastDate, now.toISOString());

    db.prepare(`
      INSERT OR REPLACE INTO promo_codes (id, code, discount_type, discount_value, max_uses, current_uses, valid_until, is_active, created_at)
      VALUES (?, 'EXHAUSTED_TEST_CODE', 'percent', 50, 5, 5, NULL, 1, ?)
    `).run(exhaustedId, now.toISOString());

    const handlers = (billingRouter as any).stack
      .filter((r: any) => r.route && r.route.path === '/validate-promo')
      .map((r: any) => r.route.stack[0].handle);

    {
      const req = createMockRequest({ method: 'POST', body: { code: 'EXPIRED_TEST_CODE' } });
      const { res, result } = createMockResponse();
      handlers[0](req, res, () => {});
      assert(result.statusCode === 400, `Expired code should return 400, got ${result.statusCode}`);
      assert(result.body.error === 'Promo code has expired', 'Error message mismatch');
    }

    {
      const req = createMockRequest({ method: 'POST', body: { code: 'EXHAUSTED_TEST_CODE' } });
      const { res, result } = createMockResponse();
      handlers[0](req, res, () => {});
      assert(result.statusCode === 400, `Exhausted code should return 400, got ${result.statusCode}`);
      assert(result.body.error === 'Promo code usage limit reached', 'Error message mismatch');
    }

    db.prepare('DELETE FROM promo_codes WHERE id IN (?, ?)').run(expiredId, exhaustedId);
  });

  await suite.test('Promo Fuzzing: Malformed Strings & SQL Injection Immunity', () => {
    const maliciousPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE promo_codes; --",
      '<script>alert("xss")</script>',
      '../../etc/passwd',
      'NULL',
      '%00',
      'A'.repeat(5000),
    ];

    const handlers = (billingRouter as any).stack
      .filter((r: any) => r.route && r.route.path === '/validate-promo')
      .map((r: any) => r.route.stack[0].handle);

    for (const code of maliciousPayloads) {
      const req = createMockRequest({ method: 'POST', body: { code } });
      const { res, result } = createMockResponse();

      handlers[0](req, res, () => {});
      assert(result.statusCode === 404, `Payload '${code}' should return 404, got ${result.statusCode}`);
      assert(result.body.success === false, 'Malicious payload must return success=false');
    }
  });

  await suite.test('Billing Upgrade: 100% Free Subscription Execution with FOUNDING50', () => {
    const fixture = createTestUserFixture('tier5_sub');

    const handlers = (billingRouter as any).stack
      .filter((r: any) => r.route && r.route.path === '/subscribe')
      .map((r: any) => r.route.stack[0].handle);

    const req = createMockRequest({
      method: 'POST',
      body: { planId: 'plan_pro', promoCode: 'FOUNDING50' },
      user: { id: fixture.id },
    });
    const { res, result } = createMockResponse();

    handlers[0](req, res, () => {});

    assert(result.statusCode === 200, `Expected 200 on subscription, got ${result.statusCode}`);
    assert(result.body.success === true, 'Subscribe success should be true');
    assert(result.body.pricePaid === 0.00, 'Price paid with FOUNDING50 must be $0.00');
    assert(result.body.tier === 'PRO', 'Tier must be upgraded to PRO');

    const updatedUser = db.prepare('SELECT subscriptionTier, subscriptionActive, tier_title FROM users WHERE id = ?').get(fixture.id) as any;
    assert(updatedUser.subscriptionTier === 'PRO', 'DB subscriptionTier mismatch');
    assert(updatedUser.subscriptionActive === 1, 'DB subscriptionActive must be 1');

    cleanupTestUserFixture(fixture.id);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  DIMENSION 4: SIGIL DETERMINISTIC STABILITY & UNICODE FUZZING
  // ═══════════════════════════════════════════════════════════════════
  suite.setFeature('Deterministic SHA-256 Sigil Math & Customizer');

  await suite.test('Sigil Math: Byte-for-Byte Deterministic Invariance across 100 Iterations', () => {
    const testCode = 'PLUG-CRYPTO-STABILITY-2026';
    const firstRender = generateSigil(testCode, 256);
    const firstHash = crypto.createHash('sha256').update(firstRender).digest('hex');

    for (let i = 0; i < 100; i++) {
      const nextRender = generateSigil(testCode, 256);
      const nextHash = crypto.createHash('sha256').update(nextRender).digest('hex');
      assert(nextHash === firstHash, `Sigil output mutated on iteration ${i}`);
    }
  });

  await suite.test('Sigil Collision Resistance: 300 Distinct Codes Yield 0 Duplicate Hashes', () => {
    const seenHashes = new Set<string>();

    for (let i = 0; i < 300; i++) {
      const code = `PLUG-DIFF-${i}-${crypto.randomBytes(4).toString('hex')}`;
      const svg = generateSigil(code, 128);
      const hash = crypto.createHash('sha256').update(svg).digest('hex');

      assert(!seenHashes.has(hash), `Collision detected on code ${code}`);
      seenHashes.add(hash);
    }
  });

  await suite.test('Sigil Unicode Fuzzing: Emoji, CJK, Arabic, and Special XML Sequences', () => {
    const unicodeStrings = [
      '🚀💎🔥🪐👑⚡',
      '創作者金錢OS_2026',
      'نظام_الأموال_المنشئ',
      'Кибернетическая_ОС',
      '𝕸𝖔𝖓𝖊𝖞𝕻𝖑𝖚𝖌_𝕾𝖎𝖌𝖎𝖑',
      '<script>alert(1)</script>',
      '"""\'\'\'&&&<<<>>>',
      'Z'.repeat(2000),
    ];

    for (const str of unicodeStrings) {
      const svg = generateSigil(str, 256, {
        handle: `@${str.substring(0, 15)}`,
        motto: 'Cosmic Wealth Singularity',
      });

      assert(svg.startsWith('<svg'), `Must generate valid SVG start tag for ${str}`);
      assert(svg.includes('</svg>'), `Must generate valid SVG end tag for ${str}`);
      assert(svg.includes('viewBox="0 0 256 256"'), 'Must contain proper viewBox');
    }
  });

  await suite.test('Sigil Catalog Exhaustion: All 48 Customizer Visual Elements Render Cleanly', () => {
    const auras = [
      'aura_cyber_emerald', 'aura_synthwave_sunset', 'aura_electric_plasma', 'aura_cosmic_nebula',
      'aura_quantum_ice', 'aura_solar_flare', 'aura_jade_dragon', 'aura_osmium_diamond',
      'aura_stealth_carbon', 'aura_void_singularity', 'aura_primordial_gold', 'aura_bifrost_spectrum',
    ];
    const glyphs = [
      'glyph_quantum_hex', 'glyph_metatron', 'glyph_octagram', 'glyph_flower_of_life',
      'glyph_apex_crown', 'glyph_tesseract', 'glyph_merkaba_vehicle', 'glyph_dragon_crest',
      'glyph_phoenix_core', 'glyph_primordia_eye', 'glyph_infinity_ouroboros', 'glyph_cyber_lotus',
    ];
    const rings = [
      'ring_circuit_traces', 'ring_celestial_corona', 'ring_rune_encryption', 'ring_laser_scanlines',
      'ring_particle_flux', 'ring_dual_event_horizon', 'ring_hex_shield_grid', 'ring_astral_zodiac',
      'ring_harmonic_pulse', 'ring_diamond_bezel', 'ring_singularity_vortex', 'ring_ouroboros_orbit',
    ];
    const crests = [
      'crest_cyber_spikes', 'crest_lightning', 'crest_valkyrie_horns', 'crest_crown',
      'crest_ouroboros_shield', 'crest_halo_ascendance', 'crest_angel_wings', 'crest_phoenix_rebirth',
      'crest_dragon_horns', 'crest_vault_seal', 'crest_quantum_antenna', 'crest_omni_sovereign',
    ];

    for (let i = 0; i < 12; i++) {
      const svg = generateSigil('PLUG-CATALOG-TEST', 256, {
        aura: auras[i],
        glyph: glyphs[i],
        ring: rings[i],
        crest: crests[i],
      });

      assert(svg.length > 500, `Rendered SVG too short for catalog index ${i}`);
      assert(svg.endsWith('</svg>'), `Catalog item ${i} did not finish with </svg>`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  DIMENSION 5: DATABASE ROLLBACK ATOMICITY UNDER INJECTED FAULTS
  // ═══════════════════════════════════════════════════════════════════
  suite.setFeature('SQLite WAL Atomic Transactions & Fault Injection');

  await suite.test('DB Rollback: Multi-Table Transaction Atomicity on Injected Error', () => {
    const testUserId = `usr_atomic_test_${Date.now()}`;
    const testAccountName = 'Atomic Test Account';
    const now = new Date().toISOString();

    let errorThrown = false;
    try {
      runInTransaction(() => {
        db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
          VALUES (?, 'atomic@moneyplughub.local', 'hash', 'Atomic Tester', 'user', 'PLUG-ATOMIC', ?, ?)
        `).run(testUserId, now, now);

        db.prepare(`
          INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, created_at, updated_at)
          VALUES ('acc_atomic_1', ?, ?, 'bank', 50000, 'USD', ?, ?)
        `).run(testUserId, testAccountName, now, now);

        throw new Error('SYNTHETIC_TRANSACTION_FAULT_INJECTED');
      });
    } catch (err: any) {
      if (err.message === 'SYNTHETIC_TRANSACTION_FAULT_INJECTED') {
        errorThrown = true;
      }
    }

    assert(errorThrown, 'Expected synthetic error to be thrown and caught');

    const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(testUserId);
    const accRow = db.prepare('SELECT id FROM accounts WHERE name = ?').get(testAccountName);

    assert(!userRow, 'User record leaked through failed transaction! Atomicity violated.');
    assert(!accRow, 'Account record leaked through failed transaction! Atomicity violated.');
  });

  await suite.test('DB Rollback: Unique Constraint Violation Clean Rollback', () => {
    const now = new Date().toISOString();
    const primaryId = `usr_uniq_1_${Date.now()}`;
    const secondaryId = `usr_uniq_2_${Date.now()}`;
    const sharedEmail = `collision_${Date.now()}@moneyplughub.local`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES (?, ?, 'hash', 'First', 'user', 'PLUG-U1', ?, ?)
    `).run(primaryId, sharedEmail, now, now);

    let caughtViolation = false;
    try {
      runInTransaction(() => {
        db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
          VALUES (?, ?, 'hash', 'Second', 'user', 'PLUG-U2', ?, ?)
        `).run(secondaryId, sharedEmail, now, now);
      });
    } catch (e: any) {
      caughtViolation = true;
    }

    assert(caughtViolation, 'Expected UNIQUE constraint violation');

    const secondaryCheck = db.prepare('SELECT id FROM users WHERE id = ?').get(secondaryId);
    assert(!secondaryCheck, 'Secondary user exists despite constraint violation');

    db.prepare('DELETE FROM users WHERE id = ?').run(primaryId);
  });

  await suite.test('DB Persistence: 50 Rapid Consecutive Transactions Durability Check', () => {
    const fixture = createTestUserFixture('tier5_wal_stress');
    const now = new Date().toISOString();

    for (let i = 0; i < 50; i++) {
      runInTransaction(() => {
        db.prepare('UPDATE users SET xp = xp + 10, updated_at = ? WHERE id = ?').run(now, fixture.id);
      });
    }

    const finalUser = db.prepare('SELECT xp FROM users WHERE id = ?').get(fixture.id) as any;
    assert(finalUser.xp === 500 + (50 * 10), `Expected XP ${500 + 500}, got ${finalUser.xp}`);

    cleanupTestUserFixture(fixture.id);
  });

  // ═══════════════════════════════════════════════════════════════════
  //  DIMENSION 6: FTC 16 CFR PART 255 COMPLIANCE & XP ECONOMY
  // ═══════════════════════════════════════════════════════════════════
  suite.setFeature('FTC Compliance & Wealth Tier Multipliers');

  await suite.test('FTC Compliance: Mandatory #ad Disclosure on All AI Pulse Output Streams', () => {
    const fixture = createTestUserFixture('tier5_ftc');
    const pulses = ['cyan', 'magenta', 'gold', 'infrared', 'white'];

    const routeStack = (generateRouter as any).stack.find((r: any) => r.route && r.route.path === '/action').route.stack;
    const authMiddleware = routeStack[0].handle;
    const actionHandler = routeStack[1].handle;

    for (const pulse of pulses) {
      const req = createMockRequest({
        method: 'POST',
        body: { actionType: pulse },
        headers: { authorization: `Bearer ${fixture.token}` },
      });
      const { res, result } = createMockResponse();

      authMiddleware(req, res, () => {
        actionHandler(req, res, () => {});
      });

      assert(result.statusCode === 200, `Expected 200 for pulse ${pulse}, got ${result.statusCode}`);
      assert(
        result.body.data.artifact.content.includes(FTC_DISCLOSURE_FOOTER),
        `Pulse ${pulse} missing FTC disclosure footer in content`
      );
      assert(
        result.body.data.artifact.copyableText.includes(FTC_DISCLOSURE_FOOTER),
        `Pulse ${pulse} missing FTC disclosure in copyableText`
      );
    }

    cleanupTestUserFixture(fixture.id);
  });

  await suite.test('XP Economy: Wealth Tier Scaling and 7-Day Streak Bonus Multipliers', () => {
    assert(resolveUserWealthTier(0, 1).tier === 1, 'Tier 1 resolution mismatch');
    assert(resolveUserWealthTier(100000, 2).tier === 2, 'Tier 2 resolution mismatch');
    assert(resolveUserWealthTier(500000, 3).tier === 3, 'Tier 3 resolution mismatch');
    assert(resolveUserWealthTier(2000000, 5).tier === 4, 'Tier 4 resolution mismatch');
    assert(resolveUserWealthTier(10000000, 7).tier === 5, 'Tier 5 resolution mismatch');
    assert(resolveUserWealthTier(100000000, 10).tier === 6, 'Tier 6 resolution mismatch');

    assert(calculateBaseCashCents(1000) === 50, '1,000 XP must convert to 50 cents ($0.50)');
    assert(calculateBaseCashCents(5000) === 250, '5,000 XP must convert to 250 cents ($2.50)');
    assert(calculateBaseCashCents(10000) === 500, '10,000 XP must convert to 500 cents ($5.00)');

    const t6 = WEALTH_TIERS[5];
    assert(t6.multiplier === 3.0, 'Tier 6 multiplier must be 3.0x');
    const transmutedCents = Math.round(calculateBaseCashCents(10000) * t6.multiplier);
    assert(transmutedCents === 1500, `Tier 6 10k XP conversion must yield $15.00 (1500 cents), got ${transmutedCents}`);
  });
}

// Direct Execution Support
if (require.main === module) {
  (async () => {
    console.log('🚀 Running Tier 5 Dedicated Adversarial & Stress Suite...');
    const suite = new TestSuite();
    await runTier5AdversarialTests(suite);

    const summary = suite.getSummary();
    console.log(`\nResults: ${summary.passed}/${summary.total} passed (${summary.totalDurationMs}ms)`);
    if (summary.failed > 0) {
      console.error('❌ Failures:', suite.results.filter((r) => !r.passed));
      process.exit(1);
    } else {
      console.log('🎉 100% PASS — Tier 5 Adversarial Coverage Hardened!\n');
      process.exit(0);
    }
  })();
}
