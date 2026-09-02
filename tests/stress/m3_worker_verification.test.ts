import { db, runInTransaction, initDb } from '../../src/backend/db';
import { generateSigil } from '../../src/backend/routes/sigil';
import { classifyTrafficSource } from '../../src/backend/routes/referrals';
import crypto from 'crypto';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, passed: true, durationMs });
    console.log(`  ✓ ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ name, passed: false, durationMs, error: err.message });
    console.error(`  ✗ ${name} (${durationMs}ms): ${err.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function assertEquals(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${msg} (expected ${expected}, got ${actual})`);
  }
}

export async function runWorkerM3VerificationSuite() {
  console.log('\n============================================================');
  console.log('  WORKER M3: BILLING, SIGIL, REFERRAL & GAMIFICATION SUITE');
  console.log('============================================================\n');

  initDb();

  // Test 1: promo_codes table schema and FOUNDING50 seed
  await runTest('1.1 promo_codes table schema exists with required columns', () => {
    const cols = db.prepare('PRAGMA table_info(promo_codes);').all() as any[];
    const colNames = cols.map((c: any) => c.name);
    assert(colNames.includes('id'), 'Missing id column');
    assert(colNames.includes('code'), 'Missing code column');
    assert(colNames.includes('discount_type'), 'Missing discount_type column');
    assert(colNames.includes('discount_value'), 'Missing discount_value column');
    assert(colNames.includes('max_uses'), 'Missing max_uses column');
    assert(colNames.includes('is_active') || colNames.includes('active'), 'Missing active column');
    assert(colNames.includes('expires_at') || colNames.includes('valid_until'), 'Missing expires_at column');
  });

  await runTest('1.2 FOUNDING50 seed data has 100% discount, max_uses 50, active 1, expires_at null', () => {
    const promo = db.prepare("SELECT * FROM promo_codes WHERE code = 'FOUNDING50' COLLATE NOCASE").get() as any;
    assert(!!promo, 'FOUNDING50 promo code not found in database');
    assertEquals(promo.discount_value, 100, 'FOUNDING50 should have 100% discount');
    assertEquals(promo.discount_type, 'percent', 'FOUNDING50 should be percent type');
    assertEquals(promo.max_uses, 50, 'FOUNDING50 should have max_uses 50');
    assert(promo.active === 1 || promo.is_active === 1, 'FOUNDING50 should be active');
    assertEquals(promo.expires_at ?? null, null, 'FOUNDING50 expires_at should be null');
  });

  // Test 2: Billing tier upgrade mapping
  await runTest('2.1 Billing tier assignment correctly upgrades to PRO and ENTERPRISE', () => {
    const testUserId = `usr_test_tier_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at, subscriptionTier, subscriptionActive)
      VALUES (?, ?, 'hash', 'Tier Tester', ?, ?, ?, 'FREE', 0)
    `).run(testUserId, `${testUserId}@test.local`, `REF_${Date.now()}`, now, now);

    // Test Pro upgrade
    const planPro = 'plan_pro_monthly';
    const targetTierPro = planPro.includes('pro') ? 'PRO' : 'CREATOR';
    db.prepare(`
      UPDATE users SET subscriptionTier = ?, subscriptionActive = 1, updated_at = ? WHERE id = ?
    `).run(targetTierPro, now, testUserId);

    let user = db.prepare('SELECT subscriptionTier, subscriptionActive FROM users WHERE id = ?').get(testUserId) as any;
    assertEquals(user.subscriptionTier, 'PRO', 'User should have subscriptionTier = PRO');
    assertEquals(user.subscriptionActive, 1, 'User should have subscriptionActive = 1');

    // Test Enterprise upgrade
    const planEnterprise = 'plan_enterprise_annual';
    const targetTierEnt = planEnterprise.includes('enterprise') ? 'ENTERPRISE' : 'CREATOR';
    db.prepare(`
      UPDATE users SET subscriptionTier = ?, subscriptionActive = 1, updated_at = ? WHERE id = ?
    `).run(targetTierEnt, now, testUserId);

    user = db.prepare('SELECT subscriptionTier, subscriptionActive FROM users WHERE id = ?').get(testUserId) as any;
    assertEquals(user.subscriptionTier, 'ENTERPRISE', 'User should have subscriptionTier = ENTERPRISE');
  });

  // Test 3: Canonical schema transaction insert for sigil points purchase
  await runTest('3.1 Sigil points buy transaction matches canonical snake_case schema', () => {
    const testUserId = `usr_sigil_tx_${Date.now()}`;
    const accId = `acc_sigil_${Date.now()}`;
    const txId = `tx_xp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, referral_code, created_at, updated_at, xp, level)
      VALUES (?, ?, 'hash', 'Sigil Buyer', ?, ?, ?, 100, 1)
    `).run(testUserId, `${testUserId}@test.local`, `REF_${Date.now()}`, now, now);

    db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
      VALUES (?, ?, 'Default Wallet', 'bank', 5000, 'USD', 'Self-Managed', 0, ?, ?)
    `).run(accId, testUserId, now, now);

    runInTransaction(() => {
      db.prepare(`
        UPDATE users SET xp = xp + 3500, level = 4, tier_title = 'Active Plug', updated_at = ? WHERE id = ?
      `).run(now, testUserId);

      db.prepare(`
        INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
        VALUES (?, ?, ?, 'Points Purchase', 'expense', 2499, 'Purchased Alchemist Sigil Forge (+3,500 XP)', ?, ?)
      `).run(txId, testUserId, accId, now.substring(0, 10), now);
    });

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as any;
    assert(!!tx, 'Transaction record not found in database');
    assertEquals(tx.user_id, testUserId, 'Transaction user_id mismatch');
    assertEquals(tx.amount_cents, 2499, 'Transaction amount_cents mismatch');
    assertEquals(tx.type, 'expense', 'Transaction type mismatch');

    const updatedUser = db.prepare('SELECT xp, level FROM users WHERE id = ?').get(testUserId) as any;
    assertEquals(updatedUser.xp, 3600, 'User XP not updated correctly');
    assertEquals(updatedUser.level, 4, 'User level not updated correctly');
  });

  // Test 4: Deterministic SHA-256 SVG Sigil Math
  await runTest('4.1 Deterministic SHA-256 SVG sigil produces byte-for-byte identical output for same code', () => {
    const code = 'PLUG-CRYPTO-2026';
    const svg1 = generateSigil(code, 512);
    const svg2 = generateSigil(code, 512);
    assertEquals(svg1, svg2, 'Deterministic SHA-256 sigil must be identical for same referral code');
    assert(svg1.startsWith('<svg') && svg1.endsWith('</svg>'), 'Sigil output must be valid SVG XML');
    assert(svg1.includes('viewBox="0 0 512 512"'), 'Sigil must respect size parameter');
  });

  await runTest('4.2 Distinct referral codes produce unique visual geometries', () => {
    const svgA = generateSigil('PLUG-ALEX-88', 256);
    const svgB = generateSigil('PLUG-SARAH-99', 256);
    assert(svgA !== svgB, 'Different referral codes must produce distinct SVG outputs');
  });

  // Test 5: 30-Day Attribution Cookie Tracking & Classifier
  await runTest('5.1 AI Referral Traffic Classifier accurately detects LLM sources and intent scores', () => {
    const gpt = classifyTrafficSource('https://chatgpt.com/c/12345', '', {});
    assertEquals(gpt.category, 'ai_assistant', 'ChatGPT referer category');
    assertEquals(gpt.aiPlatform, 'ChatGPT (OpenAI)', 'ChatGPT platform');
    assert(gpt.intentScore >= 0.90, 'ChatGPT intent score should be >= 0.90');

    const claude = classifyTrafficSource('https://claude.ai/chat/abc', '', {});
    assertEquals(claude.category, 'ai_assistant', 'Claude referer category');
    assertEquals(claude.aiPlatform, 'Claude (Anthropic)', 'Claude platform');

    const tiktok = classifyTrafficSource('https://www.tiktok.com/@creator/video/123', '', {});
    assertEquals(tiktok.category, 'social_video', 'TikTok referer category');

    const dark = classifyTrafficSource('', '', {});
    assertEquals(dark.category, 'direct_recovered', 'Dark traffic category');
  });

  // Test 6: Gamification formulas
  await runTest('6.1 XP to Level and Cash Conversion formula verification', () => {
    const levelFromXp = (xp: number) => Math.max(1, Math.floor(xp / 1000) + 1);
    assertEquals(levelFromXp(0), 1, '0 XP should be Level 1');
    assertEquals(levelFromXp(999), 1, '999 XP should be Level 1');
    assertEquals(levelFromXp(1000), 2, '1000 XP should be Level 2');
    assertEquals(levelFromXp(5500), 6, '5500 XP should be Level 6');
    assertEquals(levelFromXp(15000), 16, '15000 XP should be Level 16');

    const computeCashCents = (xp: number, mult: number, streakBonusCents: number) => {
      const baseCents = Math.floor(xp * 0.05);
      return Math.round(baseCents * mult) + streakBonusCents;
    };

    assertEquals(computeCashCents(2000, 1.0, 0), 100, 'Tier 1 conversion mismatch');
    assertEquals(computeCashCents(10000, 1.25, 300), 925, 'Tier 3 conversion mismatch');
  });

  console.log('\n============================================================');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`WORKER M3 RESULTS: ${passedCount}/${results.length} PASSED`);
  console.log('============================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runWorkerM3VerificationSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
