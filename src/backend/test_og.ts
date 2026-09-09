import assert from 'assert';
import http from 'http';
import express from 'express';
import { initDb, db, runInTransaction } from './db';
import ogRoutes, { renderOpenGraphCardSvg, getWealthTierMeta, WEALTH_TIER_MAP } from './routes/og';

async function runOgTests() {
  console.log('🧪 Starting OpenGraph Image Generation Service Tests...\n');

  // 1. Database Init & Test User Setup
  initDb();
  const testCode = 'OG-CREATOR-999';
  const now = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referral_count, xp, level, tier_title, created_at, updated_at
      ) VALUES ('usr_og_test_1', 'og_test@moneyplughub.local', 'hash', 'Aureate Creator', 'user', ?, 12, 18500, 10, 'Diamond Stacker', ?, ?)
    `).run(testCode, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO user_sigil_config (user_id, aura, glyph, ring, crest, motto, handle, updated_at)
      VALUES ('usr_og_test_1', 'aura_primordial_gold', 'glyph_infinity_ouroboros', 'ring_ouroboros_orbit', 'crest_omni_sovereign', 'PERPETUAL WEALTH', 'AUREATE_PLUG', ?)
    `).run(now);
  });

  console.log('✓ Step 1: Database & Creator profile seeded.');

  // 2. Unit Test: Wealth Tier Metadata Resolution
  const defaultTier = getWealthTierMeta();
  assert.strictEqual(defaultTier.name, 'Novice Plug');
  assert.strictEqual(defaultTier.hex, '#94a3b8');

  const diamondTier = getWealthTierMeta('Diamond Stacker');
  assert.strictEqual(diamondTier.name, 'Diamond Stacker');
  assert.strictEqual(diamondTier.hex, '#06b6d4');
  assert.strictEqual(diamondTier.multiplier, '1.30×');

  const cosmicTier = getWealthTierMeta('Cosmic Sovereign');
  assert.strictEqual(cosmicTier.hex, '#ffd700');
  assert.strictEqual(cosmicTier.multiplier, '2.00×');
  console.log('✓ Step 2: Wealth Tier metadata mapping verified.');

  // 3. Unit Test: High-Res Card SVG Rendering
  const user = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(testCode) as any;
  const cfg = db.prepare('SELECT * FROM user_sigil_config WHERE user_id = ?').get(user.id) as any;

  const cardSvg = renderOpenGraphCardSvg(testCode, user, cfg, false);
  assert(cardSvg.includes('<svg'), 'Card output must be valid SVG');
  assert(cardSvg.includes('viewBox="0 0 1200 630"'), 'Default dimension must be 1200x630');

  // Verify Required Visual Components
  assert(cardSvg.includes('href="data:image/svg+xml;base64,'), 'Must render creator deterministic SVG sigil');
  assert(cardSvg.includes('Diamond Stacker'), 'Must render Wealth Tier badge title');
  assert(cardSvg.includes('CODE: OG-CREATOR-999'), 'Must render referral code');
  assert(cardSvg.includes('STORED REWARD XP'), 'Must render Stored XP card');

  // Verify Mandatory FTC 16 CFR Part 255 Disclosure Overlays
  assert(cardSvg.includes('#ad · Paid Referral Link · FTC 16 CFR Part 255'), 'Must contain top FTC watermark badge');
  assert(cardSvg.includes('FTC 16 CFR PART 255 DISCLOSURE'), 'Must contain footer legal disclosure notice');
  console.log('✓ Step 3: High-Res SVG Card rendered with deterministic Sigil, Wealth Tier Badge, Referral Code & mandatory FTC 16 CFR Part 255 overlays.');

  // 4. Unit Test: 2K High-DPI Scaling Mode
  const card2kSvg = renderOpenGraphCardSvg(testCode, user, cfg, true);
  assert(card2kSvg.includes('width="2400" height="1260"'), '2K mode must output 2400x1260 canvas');
  console.log('✓ Step 4: 2K High-DPI scaling mode verified.');

  // 5. Integration Test: HTTP Express Endpoints
  const app = express();
  app.use('/api/og', ogRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;

  // Endpoint 1: SVG image format
  const resSvg = await fetch(`http://127.0.0.1:${port}/api/og/${testCode}?format=svg`);
  assert.strictEqual(resSvg.status, 200);
  assert(resSvg.headers.get('content-type')?.includes('image/svg+xml'));
  const svgBody = await resSvg.text();
  assert(svgBody.includes('FTC 16 CFR PART 255 DISCLOSURE'));
  console.log('✓ Step 5a: HTTP /api/og/:code?format=svg returned image/svg+xml stream.');

  // Endpoint 2: JSON payload format
  const resJson = await fetch(`http://127.0.0.1:${port}/api/og/${testCode}?format=json`);
  assert.strictEqual(resJson.status, 200);
  const jsonBody = (await resJson.json()) as any;
  assert.strictEqual(jsonBody.success, true);
  assert.strictEqual(jsonBody.data.referral_code, testCode);
  assert(jsonBody.data.svg_data_uri.startsWith('data:image/svg+xml;base64,'));
  assert(jsonBody.data.ftc_disclosure.includes('FTC 16 CFR Part 255'));
  console.log('✓ Step 5b: HTTP /api/og/:code?format=json returned structured metadata & base64 URI.');

  // Endpoint 3: HTML OpenGraph preview format (Direct Browser View)
  const resHtml = await fetch(`http://127.0.0.1:${port}/api/og/${testCode}`, {
    headers: { Accept: 'text/html' }
  });
  assert.strictEqual(resHtml.status, 200);
  assert(resHtml.headers.get('content-type')?.includes('text/html'));
  const htmlBody = await resHtml.text();
  assert(htmlBody.includes('<meta property="og:image"'), 'Must include og:image meta tag');
  assert(htmlBody.includes('<meta property="og:title"'), 'Must include og:title meta tag');
  assert(htmlBody.includes('<meta property="og:description"'), 'Must include og:description meta tag');
  assert(htmlBody.includes('FTC 16 CFR Part 255 Disclosure Notice'), 'Must include FTC disclosure notice on HTML preview');
  console.log('✓ Step 5c: HTTP /api/og/:code with Accept: text/html returned complete OpenGraph meta tag preview.');

  server.close(() => {
    db.close();
    console.log('\n🎉 ALL OPENGRAPH IMAGE SERVICE TESTS PASSED 100% SUCCESSFULLY!\n');
    process.exit(0);
  });
}

runOgTests().catch((err) => {
  console.error('❌ OpenGraph test failed:', err);
  process.exit(1);
});
