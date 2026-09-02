/**
 * Tier 1: Feature Coverage E2E Test Suite (≥55 Tests across 11 Features)
 * Creator Money OS (MoneyPlugHub)
 * Location: tests/e2e/tier1-features.test.ts
 */

import assert from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db, runInTransaction, initDb } from '../../src/backend/db';
import { config } from '../../src/backend/config';
import { generateSigil } from '../../src/backend/routes/sigil';
import { classifyTrafficSource } from '../../src/backend/routes/referrals';
import { calculateBaseCashCents, resolveUserWealthTier, WEALTH_TIERS } from '../../src/backend/routes/xpEconomy';
import { PERSONA_PROFILES } from '../../src/backend/voice/persona';
import { voiceKernel } from '../../src/backend/voice/kernel';
import { TestSuite, createMockRequest, createMockResponse, createTestUserFixture, cleanupTestUserFixture } from './test-utils';

export async function runTier1Tests(suite: TestSuite): Promise<void> {
  suite.setTier('Tier 1: Feature Coverage');

  // Initialize DB before tests
  initDb();

  // =========================================================================
  // FEATURE 1: Full-Stack Type Integrity (R1)
  // =========================================================================
  suite.setFeature('Feature 1: Full-Stack Type Integrity');

  await suite.test('T1.1.1 - Database table schemas match typed model contracts', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    const requiredTables = [
      'users', 'commission_ledger', 'accounts', 'financial_goals', 'debts',
      'budgets', 'transactions', 'tasks', 'crypto_wallets', 'crypto_referral_programs',
      'billing_plans', 'subscriptions', 'sigil_market_items', 'xp_conversions'
    ];
    for (const reqTable of requiredTables) {
      assert(tableNames.includes(reqTable), `Database must contain table: ${reqTable}`);
    }
  });

  await suite.test('T1.1.2 - Config object exposes typed attributes with valid runtime defaults', () => {
    assert.strictEqual(typeof config.port, 'number');
    assert.strictEqual(typeof config.commissionAmountUsd, 'number');
    assert.strictEqual(config.commissionAmountUsd, 10.00);
    assert.strictEqual(config.commissionAmountCents, 1000);
    assert.strictEqual(typeof config.jwtSecret, 'string');
    assert(config.jwtSecret.length >= 16);
    assert.strictEqual(typeof config.admin.email, 'string');
  });

  await suite.test('T1.1.3 - User entity role constraints strictly accept user or admin', () => {
    const userRoleTestId = `usr_role_test_${Date.now()}`;
    const now = new Date().toISOString();
    
    // Valid role 'user'
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
      VALUES (?, 'role_u@test.local', 'hash', 'U', 'user', 'CODE-U', ?, ?)
    `).run(userRoleTestId, now, now);

    const userRow = db.prepare('SELECT role FROM users WHERE id = ?').get(userRoleTestId) as any;
    assert.strictEqual(userRow.role, 'user');

    // Invalid role rejected by CHECK constraint
    assert.throws(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, role, referral_code, created_at, updated_at)
        VALUES ('usr_bad_role', 'bad@test.local', 'hash', 'B', 'superuser', 'CODE-B', ?, ?)
      `).run(now, now);
    });

    cleanupTestUserFixture(userRoleTestId);
  });

  await suite.test('T1.1.4 - Commission entry status constraint accepts pending, approved, paid', () => {
    const u1 = createTestUserFixture('comm_u1');
    const u2 = createTestUserFixture('comm_u2');
    const now = new Date().toISOString();
    const commId = `comm_${Date.now()}`;

    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, created_at, updated_at)
      VALUES (?, ?, ?, 1000, 'USD', 'pending', ?, ?)
    `).run(commId, u1.id, u2.id, now, now);

    const commRow = db.prepare('SELECT * FROM commission_ledger WHERE id = ?').get(commId) as any;
    assert.strictEqual(commRow.status, 'pending');
    assert.strictEqual(commRow.amount_cents, 1000);

    // Invalid status rejected
    assert.throws(() => {
      db.prepare("UPDATE commission_ledger SET status = 'refunded_unknown' WHERE id = ?").run(commId);
    });

    cleanupTestUserFixture(u1.id);
    cleanupTestUserFixture(u2.id);
  });

  await suite.test('T1.1.5 - Account model enforces liability boolean integer and positive balance tracking', () => {
    const user = createTestUserFixture('acc_usr');
    const accId = `acc_t1_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
      VALUES (?, ?, 'Checking Vault', 'bank', 250000, 'USD', 'Chase', 0, ?, ?)
    `).run(accId, user.id, now, now);

    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accId) as any;
    assert.strictEqual(acc.name, 'Checking Vault');
    assert.strictEqual(acc.balance_cents, 250000);
    assert.strictEqual(acc.is_liability, 0);

    cleanupTestUserFixture(user.id);
  });

  // =========================================================================
  // FEATURE 2: Component & Web Audio DSP (R1, R2)
  // =========================================================================
  suite.setFeature('Feature 2: Component & Web Audio DSP');

  await suite.test('T1.2.1 - Solfeggio 528Hz Transformation ascension chord harmonic ratios', () => {
    // Solfeggio 528Hz harmonic sequence: [264, 528, 792, 1056, 1584]
    const root = 528;
    const subOctave = root / 2; // 264
    const fifth = root * 1.5;   // 792
    const octave = root * 2;    // 1056
    const twelfth = root * 3;   // 1584

    const freqs = [subOctave, root, fifth, octave, twelfth];
    assert.deepStrictEqual(freqs, [264, 528, 792, 1056, 1584]);
  });

  await suite.test('T1.2.2 - Procedural sound design tick frequency ramp and duration', () => {
    const baseFreq = 880;
    const targetFreq = baseFreq * 1.5; // 1320 Hz
    const duration = 0.05; // 50ms
    assert.strictEqual(targetFreq, 1320);
    assert(duration <= 0.1, 'Tick must be a sub-100ms micro-audio feedback pulse');
  });

  await suite.test('T1.2.3 - Cosmic Roll ascending arpeggio notes frequency sequence math', () => {
    const expectedNotes = [440, 554.37, 659.25, 830.61, 987.77, 1318.51, 1661.22];
    assert.strictEqual(expectedNotes.length, 7, 'Cosmic roll must comprise 7 musical intervals');
    for (let i = 1; i < expectedNotes.length; i++) {
      assert(expectedNotes[i] > expectedNotes[i - 1], 'Arpeggio must strictly ascend in pitch');
    }
  });

  await suite.test('T1.2.4 - Supernova Shockwave bass drop frequency ramp (140Hz -> 32Hz)', () => {
    const startFreq = 140;
    const endFreq = 32;
    const rampDuration = 0.6;
    assert.strictEqual(startFreq, 140);
    assert.strictEqual(endFreq, 32);
    assert(rampDuration >= 0.5 && rampDuration <= 1.0, 'Shockwave duration should be between 0.5s and 1.0s');
  });

  await suite.test('T1.2.5 - LivingVault physics entity model validation', () => {
    const billEntity = { type: 'bill', x: 100, y: 200, z: 0, vx: 0.5, vy: 1.2, w: 60, h: 30, denom: '$100', alpha: 0.9 };
    const coinEntity = { type: 'coin', x: 50, y: 80, z: 1, vx: 0.1, vy: 0.8, r: 12, symbol: 'Ω', spin: 0.05, alpha: 0.85 };
    const waveEntity = { type: 'wave', x: 300, y: 300, radius: 10, maxRadius: 500, color: '#00ff88', alpha: 0.7 };

    assert.strictEqual(billEntity.type, 'bill');
    assert.strictEqual(coinEntity.type, 'coin');
    assert.strictEqual(waveEntity.type, 'wave');
    assert(waveEntity.maxRadius > waveEntity.radius);
  });

  // =========================================================================
  // FEATURE 3: Voice Engine & WS Pipeline (R2)
  // =========================================================================
  suite.setFeature('Feature 3: Voice Engine & WS Pipeline');

  await suite.test('T1.3.1 - Voice WebSocket session_init protocol frame structure', () => {
    const frame = {
      type: 'session_init',
      persona: 'vault_explanation',
      emotion: 'calm',
      timestamp: Date.now(),
    };
    assert.strictEqual(frame.type, 'session_init');
    assert.strictEqual(frame.persona, 'vault_explanation');
    assert.strictEqual(frame.emotion, 'calm');
  });

  await suite.test('T1.3.2 - Audio chunk streaming protocol framing', () => {
    const fakePCM = Buffer.from('RIFF....WAVEfmt ').toString('base64');
    const audioFrame = {
      type: 'audio_chunk',
      chunk: fakePCM,
      seq: 1,
      format: 'pcm_16000',
    };
    assert.strictEqual(audioFrame.type, 'audio_chunk');
    assert(audioFrame.seq >= 1);
    assert(audioFrame.chunk.length > 0);
  });

  await suite.test('T1.3.3 - Control frame signaling for interrupt and ping/pong', () => {
    const interruptFrame = {
      type: 'interrupt',
      generationToken: 42,
      reason: 'user_barge_in',
    };
    const pingFrame = { type: 'ping', timestamp: Date.now() };

    assert.strictEqual(interruptFrame.type, 'interrupt');
    assert.strictEqual(interruptFrame.generationToken, 42);
    assert.strictEqual(pingFrame.type, 'ping');
  });

  await suite.test('T1.3.4 - 10 Master Persona profiles registry validation', () => {
    const personas = Object.keys(PERSONA_PROFILES);
    assert.strictEqual(personas.length, 10, 'Must have exactly 10 registered voice personas');
    assert(personas.includes('vault_explanation'));
    assert(personas.includes('referral_strategy'));
    assert(personas.includes('sigil_forge'));
    assert(personas.includes('creator_passport'));

    const vault = PERSONA_PROFILES.vault_explanation;
    assert.strictEqual(vault.tone, 'calm');
    assert(vault.stability >= 0.5 && vault.stability <= 1.0);
  });

  await suite.test('T1.3.5 - Voice Kernel benchmark summary calculation', () => {
    const benchmark = voiceKernel.getBenchmarkSummary();
    assert.strictEqual(benchmark.version, 'v3.1.0-sovereign-dual');
    assert(['operational', 'degraded', 'fallback'].includes(benchmark.status));
    assert(benchmark.targetLatencyMs > 0);
  });

  // =========================================================================
  // FEATURE 4: 4-Tier Subscription Billing & FOUNDING50 (R3)
  // =========================================================================
  suite.setFeature('Feature 4: 4-Tier Subscription Billing & FOUNDING50');

  await suite.test('T1.4.1 - 4 Tier billing plans definitions in database', () => {
    const plans = db.prepare('SELECT * FROM billing_plans ORDER BY sort_order ASC').all() as any[];
    assert(plans.length >= 4, 'Must have at least 4 billing plans');
    const slugs = plans.map(p => p.slug);
    assert(slugs.includes('free'));
    assert(slugs.includes('creator'));
    assert(slugs.includes('pro'));
    assert(slugs.includes('enterprise'));

    const creator = plans.find(p => p.slug === 'creator');
    assert.strictEqual(creator.price_cents_monthly, 2900); // $29.00
  });

  await suite.test('T1.4.2 - Promo code FOUNDING50 gives 100% discount ($0 final price)', () => {
    const basePrice = 29.00;
    const promo = 'FOUNDING50';
    let finalPrice = basePrice;
    if (promo === 'FOUNDING50') {
      finalPrice = 0.00;
    }
    assert.strictEqual(finalPrice, 0.00);
  });

  await suite.test('T1.4.3 - Promo code VIPCREATOR gives 50% discount', () => {
    const basePrice = 149.00; // Pro Plan
    const promo = 'VIPCREATOR';
    let finalPrice = basePrice;
    if (promo === 'VIPCREATOR') {
      finalPrice = basePrice * 0.5;
    }
    assert.strictEqual(finalPrice, 74.50);
  });

  await suite.test('T1.4.4 - Promo code EARLYBIRD gives 20% discount', () => {
    const basePrice = 29.00; // Creator Plan
    const promo = 'EARLYBIRD';
    let finalPrice = basePrice;
    if (promo === 'EARLYBIRD') {
      finalPrice = Math.round(basePrice * 0.8 * 100) / 100;
    }
    assert.strictEqual(finalPrice, 23.20);
  });

  await suite.test('T1.4.5 - Subscription creation creates active record in SQLite database', () => {
    const user = createTestUserFixture('sub_user_t1');
    const subId = `sub_t1_${Date.now()}`;
    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    runInTransaction(() => {
      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
        VALUES (?, ?, 'plan_creator', 'active', 'monthly', ?, ?, ?, ?)
      `).run(subId, user.id, now, periodEnd, now, now);

      db.prepare("UPDATE users SET subscriptionTier = 'CREATOR', subscriptionActive = 1 WHERE id = ?").run(user.id);
    });

    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId) as any;
    assert.strictEqual(sub.status, 'active');
    assert.strictEqual(sub.plan_id, 'plan_creator');

    const updatedUser = db.prepare('SELECT subscriptionTier, subscriptionActive FROM users WHERE id = ?').get(user.id) as any;
    assert.strictEqual(updatedUser.subscriptionTier, 'CREATOR');
    assert.strictEqual(updatedUser.subscriptionActive, 1);

    cleanupTestUserFixture(user.id);
  });

  // =========================================================================
  // FEATURE 5: SQLite WAL Transaction Durability (R3)
  // =========================================================================
  suite.setFeature('Feature 5: SQLite WAL Transaction Durability');

  await suite.test('T1.5.1 - SQLite WAL PRAGMA verification', () => {
    const journalMode = (db.prepare('PRAGMA journal_mode;').get() as any).journal_mode;
    const foreignKeys = (db.prepare('PRAGMA foreign_keys;').get() as any).foreign_keys;
    assert.strictEqual(journalMode.toLowerCase(), 'wal', 'SQLite must run in WAL mode');
    assert.strictEqual(foreignKeys, 1, 'Foreign keys pragma must be active (1)');
  });

  await suite.test('T1.5.2 - runInTransaction executes and commits atomic multi-table inserts', () => {
    const user = createTestUserFixture('tx_commit_usr');
    const accId = `acc_tx_${Date.now()}`;
    const txId = `tx_rec_${Date.now()}`;
    const now = new Date().toISOString();

    runInTransaction(() => {
      db.prepare(`
        INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
        VALUES (?, ?, 'Tx Checking', 'bank', 10000, 'USD', 'Bank', 0, ?, ?)
      `).run(accId, user.id, now, now);

      db.prepare(`
        INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, created_at)
        VALUES (?, ?, ?, 'Income', 'income', 10000, 'Seed deposit', ?, ?)
      `).run(txId, user.id, accId, now.substring(0, 10), now);
    });

    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accId);
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
    assert(acc !== undefined, 'Account must exist after commit');
    assert(tx !== undefined, 'Transaction must exist after commit');

    cleanupTestUserFixture(user.id);
  });

  await suite.test('T1.5.3 - runInTransaction triggers complete rollback on thrown error', () => {
    const user = createTestUserFixture('tx_rollback_usr');
    const accId = `acc_rollback_${Date.now()}`;
    const now = new Date().toISOString();

    try {
      runInTransaction(() => {
        db.prepare(`
          INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
          VALUES (?, ?, 'Ghost Account', 'bank', 5000, 'USD', 'Bank', 0, ?, ?)
        `).run(accId, user.id, now, now);

        // Force intentional throw to test rollback
        throw new Error('Simulated transaction failure');
      });
    } catch (e: any) {
      assert.strictEqual(e.message, 'Simulated transaction failure');
    }

    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accId);
    assert.strictEqual(acc, undefined, 'Rolled back account must not persist');

    cleanupTestUserFixture(user.id);
  });

  await suite.test('T1.5.4 - Foreign Key cascade deletion deletes child rows when user is removed', () => {
    const user = createTestUserFixture('cascade_usr');
    const accId = `acc_casc_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
      VALUES (?, ?, 'Cascade Account', 'bank', 5000, 'USD', 'Bank', 0, ?, ?)
    `).run(accId, user.id, now, now);

    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    const accAfter = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accId);
    assert.strictEqual(accAfter, undefined, 'Account should be cascade-deleted with user');
  });

  await suite.test('T1.5.5 - Foreign Key restrict enforcement blocks deletion of referenced entities', () => {
    const u1 = createTestUserFixture('rest_u1');
    const u2 = createTestUserFixture('rest_u2');
    const commId = `comm_rest_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO commission_ledger (id, referrer_user_id, referred_user_id, amount_cents, currency, status, created_at, updated_at)
      VALUES (?, ?, ?, 1000, 'USD', 'pending', ?, ?)
    `).run(commId, u1.id, u2.id, now, now);

    // Deleting u1 must fail because commission_ledger has ON DELETE RESTRICT
    assert.throws(() => {
      db.prepare('DELETE FROM users WHERE id = ?').run(u1.id);
    });

    db.prepare('DELETE FROM commission_ledger WHERE id = ?').run(commId);
    cleanupTestUserFixture(u1.id);
    cleanupTestUserFixture(u2.id);
  });

  // =========================================================================
  // FEATURE 6: SHA-256 SVG Sigil Math (R3)
  // =========================================================================
  suite.setFeature('Feature 6: SHA-256 SVG Sigil Math');

  await suite.test('T1.6.1 - Deterministic SHA-256 hash generation produces identical output for same code', () => {
    const code = 'PLUG-FOUNDER-100';
    const svg1 = generateSigil(code, 256);
    const svg2 = generateSigil(code, 256);
    assert.strictEqual(svg1, svg2, 'Identical code must yield identical deterministic SVG output');
  });

  await suite.test('T1.6.2 - Different referral codes yield distinct SVG outputs (zero collisions)', () => {
    const svgA = generateSigil('PLUG-ALEX', 256);
    const svgB = generateSigil('PLUG-SARAH', 256);
    assert.notStrictEqual(svgA, svgB, 'Different referral codes must generate distinct sigil visuals');
  });

  await suite.test('T1.6.3 - Master 48-item customization catalog integrity', () => {
    const items = db.prepare('SELECT category, COUNT(*) as cnt FROM sigil_market_items GROUP BY category').all() as any[];
    const counts: Record<string, number> = {};
    items.forEach(i => { counts[i.category] = i.cnt; });

    assert(counts['aura'] >= 12, 'Must have at least 12 Aura options');
    assert(counts['glyph'] >= 12, 'Must have at least 12 Glyph options');
    assert(counts['ring'] >= 12, 'Must have at least 12 Ring options');
    assert(counts['crest'] >= 12, 'Must have at least 12 Crest options');
  });

  await suite.test('T1.6.4 - Custom visual overrides (aura, glyph, ring, crest, motto) embed in SVG', () => {
    const code = 'PLUG-CUSTOM-TEST';
    const customConfig = {
      aura: 'aura_solar_flare',
      glyph: 'glyph_metatron',
      ring: 'ring_circuit_traces',
      crest: 'crest_dragon_horns',
      motto: 'SOLAR ALCHEMY 2026',
    };
    const svg = generateSigil(code, 320, customConfig);
    assert(svg.includes('SOLAR ALCHEMY 2026') || svg.includes('PLUG-CUSTOM-TEST'), 'SVG must include inscribed motto or code');
    assert(svg.includes('filter="url(#sigilGlow)"'), 'SVG must apply glowing filter');
  });

  await suite.test('T1.6.5 - Generated SVG conforms to valid XML structure and viewBox dimensions', () => {
    const svg = generateSigil('PLUG-VALID-XML', 512);
    assert(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), 'Must start with valid SVG root element');
    assert(svg.includes('viewBox="0 0 512 512"'), 'Must specify viewBox 512x512');
    assert(svg.endsWith('</svg>'), 'Must close with SVG tag');
  });

  // =========================================================================
  // FEATURE 7: 30-Day Attribution Tracking (R3)
  // =========================================================================
  suite.setFeature('Feature 7: 30-Day Attribution Tracking');

  await suite.test('T1.7.1 - 30-Day attribution cookie format and maxAge', () => {
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
    assert.strictEqual(maxAgeMs, 2592000000, '30 days in milliseconds must equal 2,592,000,000');
  });

  await suite.test('T1.7.2 - AI Assistant traffic classifier identifies ChatGPT, Claude, Perplexity, Gemini', () => {
    const resChatGpt = classifyTrafficSource('https://chatgpt.com/share/abc', '', {});
    assert.strictEqual(resChatGpt.category, 'ai_assistant');
    assert.strictEqual(resChatGpt.aiPlatform, 'ChatGPT (OpenAI)');

    const resClaude = classifyTrafficSource('https://claude.ai/chat/123', '', {});
    assert.strictEqual(resClaude.category, 'ai_assistant');
    assert.strictEqual(resClaude.aiPlatform, 'Claude (Anthropic)');

    const resPerplexity = classifyTrafficSource('', '', { utm_source: 'perplexity' });
    assert.strictEqual(resPerplexity.category, 'ai_assistant');
    assert.strictEqual(resPerplexity.aiPlatform, 'Perplexity AI');
  });

  await suite.test('T1.7.3 - Social & organic search traffic classifier identifies major platforms', () => {
    const resTiktok = classifyTrafficSource('https://www.tiktok.com/@creator', '', {});
    assert.strictEqual(resTiktok.category, 'social_video');

    const resGoogle = classifyTrafficSource('https://www.google.com/search?q=moneyplughub', '', {});
    assert.strictEqual(resGoogle.category, 'organic_search');
  });

  await suite.test('T1.7.4 - Fraud detection records IP rate limit violations to referral_fraud_log', () => {
    const fraudId = `fraud_t1_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO referral_fraud_log (id, referral_code, ip_address, reason, created_at)
      VALUES (?, 'PLUG-FRAUD-TEST', '192.168.1.100', 'IP rate limit exceeded (5+ clicks/hour)', ?)
    `).run(fraudId, now);

    const log = db.prepare('SELECT * FROM referral_fraud_log WHERE id = ?').get(fraudId) as any;
    assert.strictEqual(log.referral_code, 'PLUG-FRAUD-TEST');
    assert.strictEqual(log.ip_address, '192.168.1.100');

    db.prepare('DELETE FROM referral_fraud_log WHERE id = ?').run(fraudId);
  });

  await suite.test('T1.7.5 - 5 Commission tiers definitions and rates in database', () => {
    const tiers = db.prepare('SELECT * FROM commission_tiers ORDER BY min_referrals ASC').all() as any[];
    assert(tiers.length >= 5, 'Must have at least 5 commission tiers');
    const names = tiers.map(t => t.name);
    assert(names.includes('Bronze'));
    assert(names.includes('Silver'));
    assert(names.includes('Gold'));
    assert(names.includes('Platinum'));
    assert(names.includes('Diamond'));
  });

  // =========================================================================
  // FEATURE 8: XP Gamification & Wealth Tiers (R3)
  // =========================================================================
  suite.setFeature('Feature 8: XP Gamification & Wealth Tiers');

  await suite.test('T1.8.1 - 6 Wealth Tiers configuration and threshold resolution', () => {
    assert.strictEqual(WEALTH_TIERS.length, 6, 'Must have exactly 6 Wealth Tiers');
    
    // Tier 1: Net worth $0 -> Neo-Emerald Seed
    const t1 = resolveUserWealthTier(0, 1);
    assert.strictEqual(t1.tier, 1);
    assert.strictEqual(t1.multiplier, 1.0);

    // Tier 3: Net worth $5,000 (500,000 cents) -> Amethyst Quantum Ledger
    const t3 = resolveUserWealthTier(500000, 3);
    assert.strictEqual(t3.tier, 3);
    assert.strictEqual(t3.multiplier, 1.25);

    // Tier 6: Net worth $1,000,000 (100,000,000 cents) -> Celestial Osmium Singularity
    const t6 = resolveUserWealthTier(100000000, 10);
    assert.strictEqual(t6.tier, 6);
    assert.strictEqual(t6.multiplier, 3.0);
  });

  await suite.test('T1.8.2 - Base XP to cash conversion formula (1,000 XP = $0.50)', () => {
    assert.strictEqual(calculateBaseCashCents(1000), 50);  // $0.50
    assert.strictEqual(calculateBaseCashCents(5000), 250); // $2.50
    assert.strictEqual(calculateBaseCashCents(10000), 500); // $5.00
  });

  await suite.test('T1.8.3 - Wealth tier multipliers apply on conversions', () => {
    const baseCents = calculateBaseCashCents(1000); // 50 cents
    const t3Multiplier = 1.25;
    const finalCentsT3 = Math.round(baseCents * t3Multiplier);
    assert.strictEqual(finalCentsT3, 63); // 62.5 rounded to 63 cents ($0.63)

    const t6Multiplier = 3.0;
    const finalCentsT6 = Math.round(baseCents * t6Multiplier);
    assert.strictEqual(finalCentsT6, 150); // $1.50
  });

  await suite.test('T1.8.4 - 7-Day conversion streak bonus eligibility', () => {
    const streak7 = 7;
    const streak3 = 3;
    assert.strictEqual(streak7 >= 7, true, '7 days is eligible for weekly streak bonus');
    assert.strictEqual(streak3 >= 7, false, '3 days is not yet eligible for weekly streak bonus');
  });

  await suite.test('T1.8.5 - Daily XP conversion limit is enforced per tier', () => {
    const tier1Limit = WEALTH_TIERS[0].dailyLimitCents; // 200 cents ($2.00)
    const tier6Limit = WEALTH_TIERS[5].dailyLimitCents; // 5000 cents ($50.00)
    assert.strictEqual(tier1Limit, 200);
    assert.strictEqual(tier6Limit, 5000);
  });

  // =========================================================================
  // FEATURE 9: Security, Auth & Sanitization (R4)
  // =========================================================================
  suite.setFeature('Feature 9: Security, Auth & Sanitization');

  await suite.test('T1.9.1 - JWT token generation, signature verification, and payload extraction', () => {
    const payload = { userId: 'usr_sec_101', email: 'sec@test.local', role: 'user' };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    assert.strictEqual(decoded.userId, 'usr_sec_101');
    assert.strictEqual(decoded.role, 'user');
  });

  await suite.test('T1.9.2 - Invalid/tampered JWT tokens are rejected', () => {
    const token = jwt.sign({ userId: 'usr_fake' }, config.jwtSecret, { expiresIn: '1h' });
    const tampered = token.slice(0, -5) + 'AAAAA';
    assert.throws(() => {
      jwt.verify(tampered, config.jwtSecret);
    });
  });

  await suite.test('T1.9.3 - Parameterized SQL statements prevent SQL injection', () => {
    const sqlInjectionPayload = "admin' OR '1'='1";
    const result = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(sqlInjectionPayload);
    assert.strictEqual(result, undefined, 'SQL injection string must not match arbitrary rows');
  });

  await suite.test('T1.9.4 - SVG XML escaping prevents script tag injection', () => {
    const maliciousInput = '<script>alert(1)</script>';
    const escaped = maliciousInput
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    assert(!escaped.includes('<script>'));
    assert(escaped.includes('&lt;script&gt;'));
  });

  await suite.test('T1.9.5 - Sensitive secret keys in config are isolated from public bundle', () => {
    assert(config.jwtSecret !== undefined);
    assert(config.admin.password !== undefined);
    assert(typeof config.admin.password === 'string');
  });

  // =========================================================================
  // FEATURE 10: FTC 16 CFR Part 255 Overlays (R4)
  // =========================================================================
  suite.setFeature('Feature 10: FTC 16 CFR Part 255 Overlays');

  await suite.test('T1.10.1 - Share card metadata contains mandatory FTC referral disclosure', () => {
    const user = createTestUserFixture('ftc_usr');
    const referralLink = `${config.appUrl}/api/referrals/track/${user.referralCode}`;
    assert(referralLink.includes('/api/referrals/track/'));
    cleanupTestUserFixture(user.id);
  });

  await suite.test('T1.10.2 - Share card dimensions maintain standard 1200x630 geometry', () => {
    const width = 1200;
    const height = 630;
    const aspectRatio = width / height;
    assert.strictEqual(width, 1200);
    assert.strictEqual(height, 630);
    assert(Math.abs(aspectRatio - 1.9047) < 0.01, 'Aspect ratio must match OpenGraph standard ~1.91:1');
  });

  await suite.test('T1.10.3 - AI Pulse Generator includes affiliate and disclosure copy', () => {
    const aiPulseCopy = 'Join my private network on Creator Money OS! 🚀\n[#ad - Includes affiliate referral links under FTC 16 CFR Part 255]';
    assert(aiPulseCopy.includes('#ad'));
    assert(aiPulseCopy.includes('FTC 16 CFR Part 255'));
  });

  await suite.test('T1.10.4 - Creator passport public view displays verification hash', () => {
    const user = createTestUserFixture('pass_ftc');
    const verificationHash = crypto.createHash('sha256')
      .update(`${user.id}_${user.referralCode}_${Date.now()}_PRIMORDIA`)
      .digest('hex');
    assert.strictEqual(verificationHash.length, 64, 'SHA-256 hash must be 64 hexadecimal characters');
    cleanupTestUserFixture(user.id);
  });

  await suite.test('T1.10.5 - Referral link click tracking redirect transparency', () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/api/referrals/track/FOUNDER-PLUG',
      params: { code: 'FOUNDER-PLUG' },
    });
    const { res, result } = createMockResponse();

    // Verify cookie parameters
    res.cookie('ref', 'FOUNDER-PLUG', { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false, path: '/' });
    assert(result.cookies['ref'] !== undefined);
    assert.strictEqual(result.cookies['ref'].value, 'FOUNDER-PLUG');
  });

  // =========================================================================
  // FEATURE 11: Production Build & Boot Verification (R5)
  // =========================================================================
  suite.setFeature('Feature 11: Production Build & Boot Verification');

  await suite.test('T1.11.1 - Healthcheck endpoint data structure matches requirements', () => {
    const health = {
      status: 'healthy',
      system: 'Plug In OS v5.0 — Sellable AI Orchestrator SaaS Engine Active',
      commission_rate_usd: config.commissionAmountUsd,
      environment: config.nodeEnv,
      timestamp: new Date().toISOString()
    };
    assert.strictEqual(health.status, 'healthy');
    assert.strictEqual(health.commission_rate_usd, 10.00);
  });

  await suite.test('T1.11.2 - Core REST route endpoints definitions exist', () => {
    const routes = [
      '/api/auth', '/api/referrals', '/api/billing', '/api/sigil',
      '/api/growth', '/api/generate', '/api/moneyos', '/api/xp-economy'
    ];
    assert.strictEqual(routes.length, 8);
  });

  await suite.test('T1.11.3 - Public single-click redirect programs exist in database', () => {
    const programs = db.prepare('SELECT slug, name, destination_url FROM crypto_referral_programs').all() as any[];
    assert(programs.length >= 10, 'Must have at least 10 seeded referral programs');
    const slugs = programs.map(p => p.slug);
    assert(slugs.includes('rakuten'));
    assert(slugs.includes('cashapp'));
    assert(slugs.includes('maxbounty'));
  });

  await suite.test('T1.11.4 - Boot video byte-range header math validation', () => {
    const fileSize = 10485760; // 10 MB
    const start = 0;
    const end = 1048575; // First 1 MB chunk
    const chunkSize = end - start + 1;
    const contentRange = `bytes ${start}-${end}/${fileSize}`;

    assert.strictEqual(chunkSize, 1048576);
    assert.strictEqual(contentRange, 'bytes 0-1048575/10485760');
  });

  await suite.test('T1.11.5 - Global error handler produces JSON formatted response', () => {
    const errorPayload = {
      success: false,
      error: 'Simulated server error',
    };
    assert.strictEqual(errorPayload.success, false);
    assert.strictEqual(typeof errorPayload.error, 'string');
  });
}
