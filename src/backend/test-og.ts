import assert from 'assert';
import bcrypt from 'bcryptjs';
import { db, initDb, runInTransaction } from './db';
import { seed } from './seed';
import { renderOpenGraphCardSvg, getTierMetaData } from './routes/og';
import { generateSigil } from './routes/sigil';

async function runOpenGraphTests() {
  console.log('🧪 Testing OpenGraph Image Generation Service (FTC 16 CFR Part 255 & Sigil Cards)...\n');

  initDb();
  seed();

  // 1. Create test creator user
  const userId = `test_usr_og_${Date.now()}`;
  const now = new Date().toISOString();
  const testRefCode = `OG-CREATOR-${Date.now().toString(36).toUpperCase()}`;

  runInTransaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, 'og_creator@test.moneyplughub.local', ?, 'Sovereign Creator', 'user', ?, NULL, 12, 12500, 7, 14, 'Diamond Stacker', ?, ?)
    `).run(userId, bcrypt.hashSync('Password123!', 8), testRefCode, now, now);
  });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  assert(user !== undefined, 'User must exist in DB');
  assert.strictEqual(user.referral_code, testRefCode);

  // 2. Test Wealth Tier Metadata lookup
  const tierMeta = getTierMetaData('Diamond Stacker');
  assert.strictEqual(tierMeta.name, 'Diamond Stacker');
  assert.strictEqual(tierMeta.hex, '#06b6d4');
  assert.strictEqual(tierMeta.booster, 1.40);
  console.log('✓ Step 1: Verified Wealth Tier metadata & multiplier calculations.');

  // 3. Test Deterministic SVG Sigil Generation
  const sigilSvg = generateSigil(testRefCode, 350);
  assert(sigilSvg.includes('<svg'), 'Sigil must generate valid SVG markup');
  assert(sigilSvg.includes(testRefCode.toUpperCase()), 'Sigil must include inscribed referral code path');
  console.log('✓ Step 2: Verified creator deterministic SVG sigil generation.');

  // 4. Test Core High-Res OpenGraph Card SVG Rendering
  const cardSvg = renderOpenGraphCardSvg(user);
  assert(cardSvg.includes('<svg'), 'Card output must be valid SVG');
  assert(cardSvg.includes('width="1200" height="630"'), 'Card must be high-res 1200x630 resolution');

  // Mandatory FTC 16 CFR Part 255 Overlays Verification
  assert(
    cardSvg.includes('#ad · Paid Referral Link · FTC 16 CFR Part 255'),
    'Card MUST render top-right FTC disclosure overlay badge'
  );
  assert(
    cardSvg.includes('FTC 16 CFR PART 255 DISCLOSURE: Material connection exists.'),
    'Card MUST render mandatory FTC 16 CFR Part 255 disclosure text overlay'
  );
  console.log('✓ Step 3: Verified mandatory FTC 16 CFR Part 255 disclosure overlays on card.');

  // Wealth Tier Badge Verification
  assert(cardSvg.includes(user.display_name), 'Card must render creator display name');
  assert(cardSvg.includes('Diamond Stacker'), 'Card must render current Wealth Tier badge');
  assert(cardSvg.includes('1.40×'), 'Card must render tier status multiplier');
  assert(cardSvg.includes(`CODE: ${testRefCode}`), 'Card must render referral code');
  assert(cardSvg.includes('href="data:image/svg+xml;base64,'), 'Card must embed SVG sigil base64 data URI');
  console.log('✓ Step 4: Verified Wealth Tier badge, status multiplier, and embedded SVG sigil.');

  console.log('\n🎉 ALL OPENGRAPH IMAGE GENERATION SERVICE TESTS PASSED 100%!\n');
  process.exit(0);
}

runOpenGraphTests().catch((err) => {
  console.error('❌ OpenGraph Test Failed:', err);
  process.exit(1);
});
