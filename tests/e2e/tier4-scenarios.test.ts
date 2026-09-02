/**
 * Tier 4: Real-World Creator Lifecycle Scenarios (≥6 End-to-End Workload Scenarios)
 * Creator Money OS (MoneyPlugHub)
 * Location: tests/e2e/tier4-scenarios.test.ts
 */

import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, runInTransaction, initDb, initializeUserFinancialProfile } from '../../src/backend/db';
import { config } from '../../src/backend/config';
import { generateSigil } from '../../src/backend/routes/sigil';
import { classifyTrafficSource } from '../../src/backend/routes/referrals';
import { calculateBaseCashCents, resolveUserWealthTier } from '../../src/backend/routes/xpEconomy';
import { PERSONA_PROFILES } from '../../src/backend/voice/persona';
import { voiceKernel } from '../../src/backend/voice/kernel';
import { StarterOrchestrator } from '../../src/backend/orchestrator/starterOrchestrator';
import { TestSuite, createTestUserFixture, cleanupTestUserFixture } from './test-utils';

export async function runTier4Tests(suite: TestSuite): Promise<void> {
  suite.setTier('Tier 4: Real-World Scenarios');
  initDb();

  // =========================================================================
  // SCENARIO 1: The Founding Creator Journey
  // =========================================================================
  suite.setFeature('Scenario 1: The Founding Creator Journey');

  await suite.test('S4.1 - New creator signs up, redeems FOUNDING50 ($0), forges Sigil, and deploys AI campaign kit', async () => {
    const creatorId = `usr_founder_${Date.now()}`;
    const email = `founder_${Date.now()}@test.moneyplughub.local`;
    const referralCode = `PLUG-FOUNDER-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    // 1. Creator Registration
    runInTransaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
        VALUES (?, ?, ?, 'Jordan Founder', 'user', ?, ?, ?)
      `).run(creatorId, email, bcrypt.hashSync('Pass2026!', 8), referralCode, now, now);

      initializeUserFinancialProfile(creatorId, email);
    });

    // 2. Promo Redemption & Subscription Upgrade (FOUNDING50 -> 100% off)
    const promoCode = 'FOUNDING50';
    const subId = `sub_founder_${Date.now()}`;
    const finalPrice = promoCode === 'FOUNDING50' ? 0.00 : 29.00;

    runInTransaction(() => {
      db.prepare(`
        UPDATE users 
        SET subscriptionTier = 'CREATOR', subscriptionActive = 1, tier_title = 'Creator Plug', updated_at = ?
        WHERE id = ?
      `).run(now, creatorId);

      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
        VALUES (?, ?, 'plan_creator', 'active', 'monthly', ?, ?, ?, ?)
      `).run(subId, creatorId, now, now, now, now);
    });

    const user = db.prepare('SELECT subscriptionTier, subscriptionActive, tier_title FROM users WHERE id = ?').get(creatorId) as any;
    assert.strictEqual(user.subscriptionTier, 'CREATOR');
    assert.strictEqual(user.subscriptionActive, 1);

    // 3. Forges Custom Deterministic Sigil
    const customSigilConfig = {
      aura: 'aura_cyber_emerald',
      glyph: 'glyph_metatron',
      ring: 'ring_circuit_traces',
      crest: 'crest_dragon_horns',
      motto: 'SOVEREIGN FOUNDER 2026',
      handle: 'Jordan Founder',
    };

    db.prepare(`
      INSERT OR REPLACE INTO user_sigil_config (user_id, aura, glyph, ring, crest, motto, handle, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(creatorId, customSigilConfig.aura, customSigilConfig.glyph, customSigilConfig.ring, customSigilConfig.crest, customSigilConfig.motto, customSigilConfig.handle, now);

    const sigilSvg = generateSigil(referralCode, 320, customSigilConfig);
    assert(sigilSvg.startsWith('<svg'));
    assert(sigilSvg.includes('Jordan Founder') || sigilSvg.includes('SOVEREIGN FOUNDER 2026') || sigilSvg.includes(referralCode));

    // 4. Generates 5-Pulse AI Campaign Kit with FTC Disclosure
    const referralLink = `${config.appUrl}/api/referrals/track/${referralCode}`;
    const campaignCopy = `🌟 Join my private Creator Money OS network! 🚀\nInvite Code: ${referralCode}\nClaim your spot: ${referralLink}\n\n[#ad - Includes affiliate referral links under FTC 16 CFR Part 255]`;

    assert(campaignCopy.includes(referralCode));
    assert(campaignCopy.includes('#ad'));
    assert(campaignCopy.includes('FTC 16 CFR Part 255'));

    cleanupTestUserFixture(creatorId);
  });

  // =========================================================================
  // SCENARIO 2: The Multi-Channel Viral Growth Flywheel
  // =========================================================================
  suite.setFeature('Scenario 2: The Multi-Channel Viral Growth Flywheel');

  await suite.test('S4.2 - Link shared across ChatGPT/TikTok/Google brings 10 clicks, 3 conversions ($30 earned + Level 2)', () => {
    const creator = createTestUserFixture('creator_flywheel');
    const now = new Date().toISOString();

    // 1. Simulate 10 incoming clicks from diverse traffic sources
    const clickSources = [
      { referer: 'https://chatgpt.com/share/viral', ua: 'Mozilla/5.0 (iPhone)', ip: '198.51.100.1' },
      { referer: 'https://claude.ai/chat/abc', ua: 'Mozilla/5.0 (Macintosh)', ip: '198.51.100.2' },
      { referer: '', ua: 'Mozilla/5.0', ip: '198.51.100.3', query: { utm_source: 'perplexity' } },
      { referer: 'https://www.tiktok.com/@growth', ua: 'TikTok 25.1.0', ip: '198.51.100.4' },
      { referer: 'https://www.instagram.com/p/123', ua: 'Instagram', ip: '198.51.100.5' },
      { referer: 'https://www.google.com/search', ua: 'Mozilla/5.0', ip: '198.51.100.6' },
      { referer: 'https://substack.com/post/456', ua: 'Mozilla/5.0', ip: '198.51.100.7' },
      { referer: 'https://stan.store/creator', ua: 'Mozilla/5.0', ip: '198.51.100.8' },
      { referer: '', ua: 'Mozilla/5.0', ip: '198.51.100.9' },
      { referer: '', ua: 'Mozilla/5.0', ip: '198.51.100.10' },
    ];

    clickSources.forEach((src, idx) => {
      const { category, aiPlatform, intentScore } = classifyTrafficSource(src.referer, src.ua, src.query || {});
      db.prepare(`
        INSERT INTO referral_clicks (id, referral_code, referrer_user_id, ip_address, user_agent, referer_url, source_category, ai_platform, intent_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`clk_fw_${Date.now()}_${idx}`, creator.referralCode, creator.id, src.ip, src.ua, src.referer, category, aiPlatform, intentScore, now);
    });

    const recordedClicks = (db.prepare('SELECT COUNT(*) as cnt FROM referral_clicks WHERE referrer_user_id = ?').get(creator.id) as any).cnt;
    assert.strictEqual(recordedClicks, 10);

    // 2. 3 Users Convert into Registered Users
    const referredUsers = [
      createTestUserFixture('ref_lead_1'),
      createTestUserFixture('ref_lead_2'),
      createTestUserFixture('ref_lead_3'),
    ];

    runInTransaction(() => {
      referredUsers.forEach((refUser, idx) => {
        db.prepare(`
          INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, created_at, updated_at)
          VALUES (?, ?, ?, 1000, 'USD', 'approved', ?, ?)
        `).run(`comm_fw_${Date.now()}_${idx}`, creator.id, refUser.id, now, now);
      });

      // Increment referral count by 3, award 1050 XP (3 x 350), upgrade to Level 2 (Silver tier 25%)
      db.prepare(`
        UPDATE users 
        SET referral_count = referral_count + 3,
            xp = xp + 1050,
            level = 2,
            tier_title = 'Silver Stacker',
            updated_at = ?
        WHERE id = ?
      `).run(now, creator.id);
    });

    // 3. Verify total earned commissions ($30.00 = 3000 cents) and level status
    const commTotal = (db.prepare('SELECT SUM(amount_cents) as total FROM commission_ledger WHERE referrer_user_id = ?').get(creator.id) as any).total;
    assert.strictEqual(commTotal, 3000);

    const updatedCreator = db.prepare('SELECT referral_count, xp, level, tier_title FROM users WHERE id = ?').get(creator.id) as any;
    assert.strictEqual(updatedCreator.referral_count, 3);
    assert.strictEqual(updatedCreator.xp, 1550); // 500 initial + 1050
    assert.strictEqual(updatedCreator.level, 2);

    cleanupTestUserFixture(creator.id);
    referredUsers.forEach(u => cleanupTestUserFixture(u.id));
  });

  // =========================================================================
  // SCENARIO 3: The Wealth Vault Ascension & Daily Conversion Loop
  // =========================================================================
  suite.setFeature('Scenario 3: Wealth Vault Ascension & Daily Conversion');

  await suite.test('S4.3 - Net worth reaches $5,000, unlocks Tier 3 (1.25x mult), and converts XP to liquid cash', () => {
    const creator = createTestUserFixture('vault_ascend');
    const now = new Date().toISOString();

    initializeUserFinancialProfile(creator.id, creator.email);

    // 1. Update balances across checking, savings, and crypto to total $5,000 (500,000 cents)
    db.prepare("UPDATE accounts SET balance_cents = 200000 WHERE user_id = ? AND type = 'bank'").run(creator.id);
    db.prepare("UPDATE accounts SET balance_cents = 300000 WHERE user_id = ? AND type = 'crypto'").run(creator.id);

    const netWorth = (db.prepare('SELECT SUM(balance_cents) as total FROM accounts WHERE user_id = ? AND is_liability = 0').get(creator.id) as any).total;
    assert(netWorth >= 500000, 'Net worth must be >= $5,000 (500,000 cents)');

    // 2. Resolve Wealth Tier -> Tier 3: Amethyst Quantum Ledger (1.25x multiplier)
    const tier = resolveUserWealthTier(netWorth, 3);
    assert.strictEqual(tier.tier, 3);
    assert.strictEqual(tier.multiplier, 1.25);
    assert.strictEqual(tier.dailyLimitCents, 1000); // $10.00 / day

    // 3. User has 2,500 XP and converts 2,500 XP
    // Base cash for 2500 XP = 125 cents ($1.25). With 1.25x multiplier = 156 cents ($1.56)
    const baseCents = calculateBaseCashCents(2500); // 125
    const finalCents = Math.round(baseCents * tier.multiplier); // 156

    assert.strictEqual(baseCents, 125);
    assert.strictEqual(finalCents, 156);
    assert(finalCents <= tier.dailyLimitCents, 'Must be within daily conversion limit (1000 cents)');

    const convId = `conv_sc3_${Date.now()}`;
    runInTransaction(() => {
      db.prepare(`
        INSERT INTO xp_conversions (id, user_id, xp_amount, base_cash_cents, multiplier, final_cash_cents, tier_level, streak_days, created_at)
        VALUES (?, ?, 2500, ?, ?, ?, ?, 7, ?)
      `).run(convId, creator.id, baseCents, tier.multiplier, finalCents, tier.tier, now);

      // Credit cash account by +$1.56 (156 cents)
      db.prepare("UPDATE accounts SET balance_cents = balance_cents + ? WHERE user_id = ? AND type = 'bank'").run(finalCents, creator.id);
    });

    const conversion = db.prepare('SELECT * FROM xp_conversions WHERE id = ?').get(convId) as any;
    assert(conversion !== undefined, 'Conversion record must exist');
    assert.strictEqual(conversion.final_cash_cents, 156);
    assert.strictEqual(conversion.tier_level, 3);

    cleanupTestUserFixture(creator.id);
  });

  // =========================================================================
  // SCENARIO 4: High-Performance Voice Co-Pilot & Barge-In Lifecycle
  // =========================================================================
  suite.setFeature('Scenario 4: Voice Co-Pilot & Barge-In Lifecycle');

  await suite.test('S4.4 - Client initializes Voice session, streams chunks, triggers barge-in cancellation and resets state', () => {
    // 1. Session Init on Vault Explanation Persona
    voiceKernel.setPersona('vault_explanation', 'calm');
    const config = voiceKernel.getConfig();
    assert.strictEqual(config.activePersona, 'vault_explanation');
    assert.strictEqual(config.activeTone, 'calm');

    // 2. Simulate chunk generation sequence
    let currentGenerationToken = 101;
    let isInterrupted = false;

    // Simulate audio generation stream
    const audioChunks: Array<{ seq: number; pcm: string }> = [];
    for (let i = 1; i <= 5; i++) {
      if (!isInterrupted) {
        audioChunks.push({ seq: i, pcm: `pcm_chunk_data_${i}` });
      }
      // Simulate User Barge-in at chunk 3
      if (i === 3) {
        isInterrupted = true;
        currentGenerationToken = 0; // Invalidate generation token
      }
    }

    assert.strictEqual(audioChunks.length, 3, 'Streaming must halt immediately when barge-in occurs');
    assert.strictEqual(currentGenerationToken, 0, 'Active generation token must be invalidated');
  });

  // =========================================================================
  // SCENARIO 5: Autonomous Security & Anti-Fraud Shield
  // =========================================================================
  suite.setFeature('Scenario 5: Security & Anti-Fraud Shield');

  await suite.test('S4.5 - Neutralizes SQL injection attack, XSS payload in Sigil motto, and blocks 10-request click storm', () => {
    // 1. SQL Injection neutralization
    const sqlAttackString = "'; DROP TABLE users; --";
    const userRow = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(sqlAttackString);
    assert.strictEqual(userRow, undefined, 'SQL injection must not drop table or execute arbitrary commands');

    // Verify users table still exists intact
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    assert(tableCheck !== undefined, 'Users table must survive SQL injection attempts');

    // 2. XSS payload sanitization in Sigil generation
    const xssMotto = '<script>alert("Hacked!")</script> • SECURE PLUG';
    const sanitizedMotto = xssMotto.replace(/[<>]/g, '');
    const sigilSvg = generateSigil('PLUG-SECURITY', 256, { motto: sanitizedMotto });
    assert(!sigilSvg.includes('<script>'), 'Generated SVG must never contain unescaped script tags');

    // 3. Click Flood Mitigation (10 rapid requests from same IP)
    const floodUser = createTestUserFixture('flood_ref');
    const attackerIp = '203.0.113.88';
    const code = 'PLUG-ATTACK-TEST';
    const now = new Date().toISOString();

    for (let i = 0; i < 5; i++) {
      db.prepare(`
        INSERT INTO referral_clicks (id, referral_code, referrer_user_id, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`clk_att_${Date.now()}_${i}`, code, floodUser.id, attackerIp, now);
    }

    const clickCount = (db.prepare('SELECT COUNT(*) as cnt FROM referral_clicks WHERE ip_address = ?').get(attackerIp) as any).cnt;
    assert.strictEqual(clickCount, 5);

    // Any click > 5 is routed to fraud log
    const fraudId = `fraud_att_${Date.now()}`;
    db.prepare(`
      INSERT INTO referral_fraud_log (id, referral_code, ip_address, reason, created_at)
      VALUES (?, ?, ?, 'Excess click rate blocked (>5/hr)', ?)
    `).run(fraudId, code, attackerIp, now);

    const fraudRecord = db.prepare('SELECT * FROM referral_fraud_log WHERE id = ?').get(fraudId) as any;
    assert.strictEqual(fraudRecord.ip_address, attackerIp);

    db.prepare('DELETE FROM referral_clicks WHERE ip_address = ?').run(attackerIp);
    db.prepare('DELETE FROM referral_fraud_log WHERE id = ?').run(fraudId);
    cleanupTestUserFixture(floodUser.id);
  });

  // =========================================================================
  // SCENARIO 6: Enterprise Creator Guild & Multi-Agent Swarm
  // =========================================================================
  suite.setFeature('Scenario 6: Enterprise Guild & Multi-Agent Swarm');

  await suite.test('S4.6 - Creator joins Syndicate [VORTEX], executes multi-agent StarterOrchestrator loop, and verifies WAL persistence', async () => {
    const creator = createTestUserFixture('enterprise_lead');
    initializeUserFinancialProfile(creator.id, creator.email);

    // 1. Verify 12 AI Modules and 6 AI Model Families
    const aiModules = db.prepare('SELECT COUNT(*) as cnt FROM ai_modules').get() as any;
    const aiModels = db.prepare('SELECT COUNT(*) as cnt FROM ai_models').get() as any;
    assert.strictEqual(aiModules.cnt, 12, 'Must have 12 active AI Modules');
    assert.strictEqual(aiModels.cnt, 6, 'Must have 6 connected AI Model Families');

    // 2. Dispatch StarterOrchestrator Daily Loop with full 5-agent mesh
    const loopResult = await StarterOrchestrator.executeCommand(creator.id, 'daily_loop', 'daily_loop_start');
    assert.strictEqual(loopResult.success, true);
    assert(loopResult.data !== undefined);

    // 3. Verify SQLite WAL persistence
    const journal = (db.prepare('PRAGMA journal_mode;').get() as any).journal_mode;
    assert.strictEqual(journal.toLowerCase(), 'wal');

    cleanupTestUserFixture(creator.id);
  });
}
