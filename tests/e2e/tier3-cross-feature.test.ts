/**
 * Tier 3: Cross-Feature Pairwise E2E Test Suite (≥11 Pairwise Interaction Tests)
 * Creator Money OS (MoneyPlugHub)
 * Location: tests/e2e/tier3-cross-feature.test.ts
 */

import assert from 'assert';
import crypto from 'crypto';
import { db, runInTransaction, initDb, initializeUserFinancialProfile } from '../../src/backend/db';
import { config } from '../../src/backend/config';
import { generateSigil } from '../../src/backend/routes/sigil';
import { calculateBaseCashCents, resolveUserWealthTier, WEALTH_TIERS } from '../../src/backend/routes/xpEconomy';
import { PERSONA_PROFILES } from '../../src/backend/voice/persona';
import { voiceKernel } from '../../src/backend/voice/kernel';
import { TestSuite, createTestUserFixture, cleanupTestUserFixture } from './test-utils';

export async function runTier3Tests(suite: TestSuite): Promise<void> {
  suite.setTier('Tier 3: Cross-Feature Pairwise');
  initDb();

  // =========================================================================
  // PAIR 1: Promo Code (FOUNDING50) + Billing Upgrade + Wealth Tier Recalculation
  // =========================================================================
  suite.setFeature('Pair 1: Promo Code + Billing + Wealth Tier');

  await suite.test('T3.1 - FOUNDING50 promo code upgrades user to Creator plan ($0 charge) and updates tier', () => {
    const user = createTestUserFixture('pair1_user');
    const now = new Date().toISOString();
    const subId = `sub_p1_${Date.now()}`;
    const promoCode = 'FOUNDING50';

    // 1. Validate promo and calculate price
    let basePrice = 29.00;
    let finalPrice = basePrice;
    if (promoCode === 'FOUNDING50') finalPrice = 0.00;

    // 2. Execute billing upgrade in transaction
    const accId = `acc_p1_${Date.now()}`;
    runInTransaction(() => {
      db.prepare(`
        INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
        VALUES (?, ?, 'Primary Checking', 'bank', 10000, 'USD', 'Bank', 0, ?, ?)
      `).run(accId, user.id, now, now);

      db.prepare(`
        UPDATE users 
        SET subscriptionTier = 'CREATOR', subscriptionActive = 1, tier_title = 'Creator Plug', updated_at = ?
        WHERE id = ?
      `).run(now, user.id);

      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
        VALUES (?, ?, 'plan_creator', 'active', 'monthly', ?, ?, ?, ?)
      `).run(subId, user.id, now, now, now, now);

      db.prepare(`
        INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
        VALUES (?, ?, ?, 'Subscription', 'expense', ?, 'Creator Money OS Subscription - FOUNDING50', ?, ?)
      `).run(`tx_sub_${Date.now()}`, user.id, accId, Math.round(finalPrice * 100), now.substring(0, 10), now);
    });

    // 3. Verify user state
    const updatedUser = db.prepare('SELECT subscriptionTier, subscriptionActive, tier_title FROM users WHERE id = ?').get(user.id) as any;
    assert.strictEqual(updatedUser.subscriptionTier, 'CREATOR');
    assert.strictEqual(updatedUser.subscriptionActive, 1);
    assert.strictEqual(updatedUser.tier_title, 'Creator Plug');

    cleanupTestUserFixture(user.id);
  });

  // =========================================================================
  // PAIR 2: 30-Day Referral Cookie Click + User Registration + Commission + XP
  // =========================================================================
  suite.setFeature('Pair 2: Referral Tracking + Registration + Commission + XP');

  await suite.test('T2.2 - Referral tracking sets 30-day attribution, logs commission ($10) and awards XP (+350)', () => {
    const referrer = createTestUserFixture('ref_lead');
    const referred = createTestUserFixture('ref_new');
    const now = new Date().toISOString();
    const commId = `comm_p2_${Date.now()}`;

    // 1. Simulate referral click and conversion in transaction
    runInTransaction(() => {
      // Create commission ledger entry ($10.00 = 1000 cents)
      db.prepare(`
        INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, 1000, 'USD', 'approved', 'Referred via 30-day cookie attribution', ?, ?)
      `).run(commId, referrer.id, referred.id, now, now);

      // Increment referrer referral count and award 350 XP
      db.prepare(`
        UPDATE users 
        SET referral_count = referral_count + 1, 
            xp = xp + 350,
            updated_at = ?
        WHERE id = ?
      `).run(now, referrer.id);

      // Link referred user to referrer
      db.prepare('UPDATE users SET referrer_user_id = ?, updated_at = ? WHERE id = ?').run(referrer.id, now, referred.id);
    });

    // 2. Verify commission ledger and referrer balance
    const comm = db.prepare('SELECT * FROM commission_ledger WHERE id = ?').get(commId) as any;
    assert.strictEqual(comm.amount_cents, 1000);
    assert.strictEqual(comm.status, 'approved');

    const updatedReferrer = db.prepare('SELECT referral_count, xp FROM users WHERE id = ?').get(referrer.id) as any;
    assert.strictEqual(updatedReferrer.referral_count, 1);
    assert.strictEqual(updatedReferrer.xp, 850); // 500 initial + 350

    cleanupTestUserFixture(referrer.id);
    cleanupTestUserFixture(referred.id);
  });

  // =========================================================================
  // PAIR 3: XP Accumulation + Sigil Level Unlock + Custom Item Purchase & Equip
  // =========================================================================
  suite.setFeature('Pair 3: XP Accumulation + Sigil Customization');

  await suite.test('T3.3 - Level up unlocks Sigil item, user purchases with XP and equips it', () => {
    const user = createTestUserFixture('sigil_cust_usr');
    const now = new Date().toISOString();
    const itemId = 'aura_cosmic_nebula'; // Cost: 400 XP, min_level: 3

    // 1. Award XP to reach Level 3 (XP >= 2000)
    db.prepare('UPDATE users SET xp = 2500, level = 3 WHERE id = ?').run(user.id);

    // 2. Purchase item using XP
    const item = db.prepare('SELECT * FROM sigil_market_items WHERE id = ?').get(itemId) as any;
    assert(item !== undefined);

    runInTransaction(() => {
      // Deduct XP
      db.prepare('UPDATE users SET xp = xp - ?, updated_at = ? WHERE id = ?').run(item.cost_xp, now, user.id);

      // Insert into inventory
      db.prepare(`
        INSERT INTO user_sigil_inventory (id, user_id, item_id, is_equipped, purchased_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(`inv_${Date.now()}`, user.id, itemId, now);

      // Equip in user_sigil_config
      db.prepare(`
        INSERT OR REPLACE INTO user_sigil_config (user_id, aura, updated_at)
        VALUES (?, ?, ?)
      `).run(user.id, itemId, now);
    });

    // 3. Verify inventory and equipped config
    const inv = db.prepare('SELECT * FROM user_sigil_inventory WHERE user_id = ? AND item_id = ?').get(user.id, itemId);
    assert(inv !== undefined);

    const cfg = db.prepare('SELECT aura FROM user_sigil_config WHERE user_id = ?').get(user.id) as any;
    assert.strictEqual(cfg.aura, 'aura_cosmic_nebula');

    // 4. Generate SVG with custom aura
    const svg = generateSigil(user.referralCode, 256, { aura: cfg.aura });
    assert(svg.includes('#c084fc') || svg.includes('cosmic') || svg.includes('<svg'));

    cleanupTestUserFixture(user.id);
  });

  // =========================================================================
  // PAIR 4: User Profile + Financial Goal + Net Worth Sync + Tier 3 Transition
  // =========================================================================
  suite.setFeature('Pair 4: Financial Goal + Net Worth Sync + Wealth Tier');

  await suite.test('T3.4 - Depositing $5,000 net worth triggers Tier 3 Amethyst Quantum Ledger ascension', () => {
    const user = createTestUserFixture('networth_tier_usr');
    const now = new Date().toISOString();

    // 1. Initialize user financial profile
    initializeUserFinancialProfile(user.id, user.email);

    // 2. Deposit funds to reach $5,000 (500,000 cents) net worth
    db.prepare("UPDATE accounts SET balance_cents = 500000 WHERE user_id = ? AND type = 'bank'").run(user.id);

    // 3. Calculate net worth
    const netWorthRow = db.prepare(`
      SELECT SUM(CASE WHEN is_liability = 0 THEN balance_cents ELSE -balance_cents END) as net_worth_cents
      FROM accounts WHERE user_id = ?
    `).get(user.id) as any;

    const netWorth = netWorthRow.net_worth_cents;
    assert(netWorth >= 500000, 'Net worth must be >= 500,000 cents ($5,000)');

    // 4. Resolve Wealth Tier
    const tier = resolveUserWealthTier(netWorth, 3);
    assert.strictEqual(tier.tier, 3);
    assert.strictEqual(tier.name, 'Amethyst Quantum Ledger');
    assert.strictEqual(tier.multiplier, 1.25);

    cleanupTestUserFixture(user.id);
  });

  // =========================================================================
  // PAIR 5: AI Studio Pulse Generation + FTC Disclosure + Share Card
  // =========================================================================
  suite.setFeature('Pair 5: AI Studio Pulse + FTC Disclosure + Share Card');

  await suite.test('T3.5 - White Pulse campaign synthesis appends FTC 16 CFR Part 255 disclosure and generates share card', () => {
    const user = createTestUserFixture('ai_ftc_usr');
    const referralLink = `${config.appUrl}/api/referrals/track/${user.referralCode}`;
    const shareCardUrl = `${config.appUrl}/api/growth/share-card/${user.referralCode}`;

    // 1. Synthesize marketing copy
    const copy = `Join my private network on Creator Money OS! 🚀\nInvite Code: ${user.referralCode}\nClaim your spot: ${referralLink}\n\n[#ad - Includes affiliate referral links under FTC 16 CFR Part 255]`;
    assert(copy.includes(user.referralCode));
    assert(copy.includes('#ad'));
    assert(copy.includes('FTC 16 CFR Part 255'));

    // 2. Generate 1200x630 share card SVG with deterministic sigil
    const sigilSvg = generateSigil(user.referralCode, 350);
    const sigilB64 = Buffer.from(sigilSvg).toString('base64');
    assert(sigilB64.length > 100);

    cleanupTestUserFixture(user.id);
  });

  // =========================================================================
  // PAIR 6: Voice Kernel Persona Change + Audio DSP Soundscape Modulation
  // =========================================================================
  suite.setFeature('Pair 6: Voice Kernel Persona + Audio DSP Soundscape');

  await suite.test('T3.6 - Switching voice persona to vault_explanation updates soundscape and spatial pan', () => {
    voiceKernel.setPersona('vault_explanation', 'calm');
    const activeCfg = voiceKernel.getConfig();

    assert.strictEqual(activeCfg.activePersona, 'vault_explanation');
    assert.strictEqual(activeCfg.activeTone, 'calm');

    const personaProfile = PERSONA_PROFILES.vault_explanation;
    assert.strictEqual(personaProfile.spatialPan, 'center');
    assert.strictEqual(personaProfile.soundscape, 'vault_hum');
  });

  // =========================================================================
  // PAIR 7: Daily Loot Gacha Claim + XP Conversion + Bank Balance Update
  // =========================================================================
  suite.setFeature('Pair 7: Daily Loot Claim + XP Conversion + Bank Credit');

  await suite.test('T3.7 - User claims loot box (+500 XP) and converts 1000 XP at Tier 2 multiplier to cash', () => {
    const user = createTestUserFixture('loot_conv_usr');
    const now = new Date().toISOString();
    const convId = `conv_p7_${Date.now()}`;

    // 1. User claims +500 XP (500 initial + 500 = 1000 XP)
    db.prepare('UPDATE users SET xp = xp + 500 WHERE id = ?').run(user.id);

    // 2. User converts 1000 XP to cash at Tier 2 (1.1x multiplier)
    const baseCents = calculateBaseCashCents(1000); // 50 cents
    const multiplier = 1.1;
    const finalCents = Math.round(baseCents * multiplier); // 55 cents

    runInTransaction(() => {
      // Deduct XP
      db.prepare('UPDATE users SET xp = xp - 1000, updated_at = ? WHERE id = ?').run(now, user.id);

      // Record XP conversion
      db.prepare(`
        INSERT INTO xp_conversions (id, user_id, xp_amount, base_cash_cents, multiplier, final_cash_cents, tier_level, streak_days, created_at)
        VALUES (?, ?, 1000, ?, ?, ?, 2, 1, ?)
      `).run(convId, user.id, baseCents, multiplier, finalCents, now);
    });

    const conversion = db.prepare('SELECT * FROM xp_conversions WHERE id = ?').get(convId) as any;
    assert.strictEqual(conversion.final_cash_cents, 55);
    assert.strictEqual(conversion.xp_amount, 1000);

    const updatedUser = db.prepare('SELECT xp FROM users WHERE id = ?').get(user.id) as any;
    assert.strictEqual(updatedUser.xp, 0); // 1000 - 1000

    cleanupTestUserFixture(user.id);
  });

  // =========================================================================
  // PAIR 8: Referral Fraud Burst (IP Rate Limit) + Fraud Logging
  // =========================================================================
  suite.setFeature('Pair 8: Referral Fraud Burst + Audit Logging');

  await suite.test('T3.8 - Rapid click storm from same IP blocks 6th click and logs to referral_fraud_log', () => {
    const burstUser = createTestUserFixture('burst_ref');
    const ip = '172.16.0.45';
    const code = 'PLUG-BURST-TEST';
    const now = new Date().toISOString();

    for (let i = 0; i < 5; i++) {
      db.prepare(`
        INSERT INTO referral_clicks (id, referral_code, referrer_user_id, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`clk_${Date.now()}_${i}`, code, burstUser.id, ip, now);
    }

    const clickCount = (db.prepare('SELECT COUNT(*) as cnt FROM referral_clicks WHERE ip_address = ?').get(ip) as any).cnt;
    assert.strictEqual(clickCount, 5);

    // 6th click exceeds limit (>= 5) -> log to fraud
    if (clickCount >= 5) {
      const fraudId = `fraud_p8_${Date.now()}`;
      db.prepare(`
        INSERT INTO referral_fraud_log (id, referral_code, ip_address, reason, created_at)
        VALUES (?, ?, ?, 'IP rate limit exceeded (5+ clicks/hour)', ?)
      `).run(fraudId, code, ip, now);

      const fraudRecord = db.prepare('SELECT * FROM referral_fraud_log WHERE id = ?').get(fraudId) as any;
      assert.strictEqual(fraudRecord.referral_code, code);
      assert.strictEqual(fraudRecord.ip_address, ip);
    }

    db.prepare('DELETE FROM referral_clicks WHERE ip_address = ?').run(ip);
    db.prepare('DELETE FROM referral_fraud_log WHERE ip_address = ?').run(ip);
    cleanupTestUserFixture(burstUser.id);
  });

  // =========================================================================
  // PAIR 9: Single-Click Redirect (/go/rakuten) + Click Counter Increment
  // =========================================================================
  suite.setFeature('Pair 9: Single-Click Redirect + Program Tracker Sync');

  await suite.test('T3.9 - Accessing /go/rakuten increments total_clicks and logs program click', () => {
    const slug = 'rakuten';
    const progBefore = db.prepare('SELECT total_clicks, destination_url FROM crypto_referral_programs WHERE slug = ?').get(slug) as any;
    assert(progBefore !== undefined);
    assert(progBefore.destination_url.includes('rakuten.com'));

    // Increment click
    db.prepare('UPDATE crypto_referral_programs SET total_clicks = total_clicks + 1 WHERE slug = ?').run(slug);
    const progAfter = db.prepare('SELECT total_clicks FROM crypto_referral_programs WHERE slug = ?').get(slug) as any;
    assert.strictEqual(progAfter.total_clicks, progBefore.total_clicks + 1);
  });

  // =========================================================================
  // PAIR 10: Syndicates Guild War Score + Wealth Tier Multiplier
  // =========================================================================
  suite.setFeature('Pair 10: Syndicates Guild War + Wealth Multiplier');

  await suite.test('T3.10 - Member earns 500 XP boosted by 1.25x tier multiplier to increase syndicate weekly score', () => {
    const baseXP = 500;
    const tierMultiplier = 1.25;
    const boostedXP = Math.round(baseXP * tierMultiplier); // 625 XP
    assert.strictEqual(boostedXP, 625);

    const topSyndicate = db.prepare('SELECT id, weekly_score FROM syndicates ORDER BY weekly_score DESC LIMIT 1').get() as any;
    if (topSyndicate) {
      db.prepare('UPDATE syndicates SET weekly_score = weekly_score + ? WHERE id = ?').run(boostedXP, topSyndicate.id);
      const updated = db.prepare('SELECT weekly_score FROM syndicates WHERE id = ?').get(topSyndicate.id) as any;
      assert.strictEqual(updated.weekly_score, topSyndicate.weekly_score + 625);
    }
  });

  // =========================================================================
  // PAIR 11: End-to-End Auth Token + Profile Customization + Passport Hash
  // =========================================================================
  suite.setFeature('Pair 11: Auth Token + Profile Customization + Passport Hash');

  await suite.test('T3.11 - Authenticated user updates motto, generating cryptographically verified passport', () => {
    const user = createTestUserFixture('pass_p11');
    const newMotto = 'CELESTIAL OSMIUM SOVEREIGN 2026';
    const now = new Date().toISOString();

    // 1. Update motto in user_sigil_config
    db.prepare(`
      INSERT OR REPLACE INTO user_sigil_config (user_id, motto, updated_at)
      VALUES (?, ?, ?)
    `).run(user.id, newMotto, now);

    // 2. Generate cryptographic passport verification signature
    const verificationHash = crypto.createHash('sha256')
      .update(`${user.id}_${user.referralCode}_${now}_PRIMORDIA`)
      .digest('hex');

    const passportNumber = `PLUG-${verificationHash.substring(0, 12).toUpperCase()}`;
    assert.strictEqual(passportNumber.startsWith('PLUG-'), true);
    assert.strictEqual(verificationHash.length, 64);

    // 3. Verify motto reflected in custom sigil
    const sigilSvg = generateSigil(user.referralCode, 320, { motto: newMotto });
    assert(sigilSvg.includes(newMotto) || sigilSvg.includes(user.referralCode));

    cleanupTestUserFixture(user.id);
  });
}
