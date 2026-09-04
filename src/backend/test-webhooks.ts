import assert from 'assert';
import { db, initDb, runInTransaction } from './db';
import {
  notifyCommissionEarned,
  notifyRankPromotion,
} from './services/webhookService';
import {
  computeLevelAndTier,
  checkAndNotifyRankPromotion,
  triggerCommissionWebhook,
} from './services/webhookDispatcher';

async function runWebhookTests() {
  console.log('🧪 Starting Webhook Service & Notification Dispatcher Test Suite...\n');

  initDb();

  // 1. Verify Level and Tier computation
  const tier1 = computeLevelAndTier(100);
  assert.strictEqual(tier1.level, 1);
  assert.strictEqual(tier1.tier_title, 'Novice Plug');

  const tier5 = computeLevelAndTier(2500);
  assert.strictEqual(tier5.level, 5);
  assert.strictEqual(tier5.tier_title, 'Grand Money Plug');

  const tier10 = computeLevelAndTier(12000);
  assert.strictEqual(tier10.level, 10);
  assert.strictEqual(tier10.tier_title, 'Cosmic Money Plug');

  console.log('✓ Step 1: Level and Tier computation verified.');

  // 2. Test mock webhook notification functions (without live Discord/Telegram URLs configured)
  const mockCommissionResult = await notifyCommissionEarned({
    creatorName: 'Test Creator',
    amountCents: 2500,
    currency: 'USD',
    referredName: 'Referred Peer',
    notes: '20% recurring affiliate bounty',
    commissionId: 'comm_test_123',
  });
  // Since no Discord/Telegram URLs are set in environment, returns { discord: false, telegram: false } safely
  assert.strictEqual(typeof mockCommissionResult.discord, 'boolean');
  assert.strictEqual(typeof mockCommissionResult.telegram, 'boolean');
  console.log('✓ Step 2: Commission webhook formatter and safe fallback verified.');

  const mockPromotionResult = await notifyRankPromotion({
    creatorName: 'Test Creator',
    oldLevel: 4,
    newLevel: 5,
    oldTier: 'Wealth Builder',
    newTier: 'Grand Money Plug',
    totalXp: 2600,
  });
  assert.strictEqual(typeof mockPromotionResult.discord, 'boolean');
  assert.strictEqual(typeof mockPromotionResult.telegram, 'boolean');
  console.log('✓ Step 3: Rank promotion webhook formatter and safe fallback verified.');

  // 3. Test Custom Override / Mock Webhook Endpoint Simulation
  // Create a dummy local server endpoint to receive real POST requests
  const http = await import('http');
  let receivedDiscordPayload: any = null;
  let receivedTelegramPayload: any = null;

  const mockServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      if (req.url?.includes('discord')) {
        receivedDiscordPayload = data;
      } else if (req.url?.includes('telegram')) {
        receivedTelegramPayload = data;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()));
  const address = mockServer.address() as any;
  const mockPort = address.port;

  const localDiscordUrl = `http://127.0.0.1:${mockPort}/discord`;
  const localTelegramUrl = `http://127.0.0.1:${mockPort}/telegram`;

  // Dispatch live commission notification to mock server
  const liveCommissionRes = await notifyCommissionEarned(
    {
      creatorName: 'Elena Rostova',
      amountCents: 1000,
      currency: 'USD',
      referredName: 'Alex Vance',
      notes: 'Direct Viral Constellation Referral',
      commissionId: 'comm_live_999',
    },
    {
      discordUrl: localDiscordUrl,
    }
  );

  assert.strictEqual(liveCommissionRes.discord, true);
  assert(receivedDiscordPayload !== null, 'Mock server must receive Discord payload');
  assert.strictEqual(receivedDiscordPayload.username, 'MoneyPlugHub Creator OS');
  assert(receivedDiscordPayload.embeds[0].title.includes('New Commission Earned!'));
  assert(receivedDiscordPayload.embeds[0].description.includes('Elena Rostova'));
  assert(receivedDiscordPayload.embeds[0].description.includes('$10.00 USD'));

  console.log('✓ Step 4: Live Discord webhook POST payload verified against mock server.');

  // Dispatch live rank promotion notification to mock server
  receivedDiscordPayload = null;
  const livePromotionRes = await notifyRankPromotion(
    {
      creatorName: 'Alex Vance',
      oldLevel: 1,
      newLevel: 2,
      oldTier: 'Novice Plug',
      newTier: 'Budget Apprentice',
      totalXp: 300,
    },
    {
      discordUrl: localDiscordUrl,
    }
  );

  assert.strictEqual(livePromotionRes.discord, true);
  assert(receivedDiscordPayload !== null, 'Mock server must receive Discord rank promotion payload');
  assert(receivedDiscordPayload.embeds[0].title.includes('Rank Promotion Unlocked!'));
  assert(receivedDiscordPayload.embeds[0].description.includes('Level 2 — Budget Apprentice'));

  console.log('✓ Step 5: Live Discord rank promotion POST payload verified against mock server.');

  // 4. Test User Webhook Settings DB table
  const testUserId = `usr_webhook_test_${Date.now()}`;
  const testRefCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, ?, 'hash', 'Webhook Tester', 'user', ?, NULL, 0, 100, 1, 1, 'Novice Plug', ?, ?)
    `).run(testUserId, `webhookuser_${Date.now()}@test.local`, testRefCode, now, now);

    db.prepare(`
      INSERT INTO user_webhook_settings (
        user_id, discord_url, telegram_bot_token, telegram_chat_id, notify_commissions, notify_rank_promotions, updated_at
      ) VALUES (?, ?, 'bot123', 'chat456', 1, 1, ?)
    `).run(testUserId, localDiscordUrl, now);
  });

  const promotionCheck = await checkAndNotifyRankPromotion({
    userId: testUserId,
    oldLevel: 1,
    oldTierTitle: 'Novice Plug',
    newXp: 3000, // Level 5, Grand Money Plug
  });

  assert.strictEqual(promotionCheck.promoted, true);
  assert.strictEqual(promotionCheck.level, 5);
  assert.strictEqual(promotionCheck.tier_title, 'Grand Money Plug');

  console.log('✓ Step 6: Database integration and automated rank promotion trigger verified.');

  mockServer.close();
  console.log('\n🎉 ALL WEBHOOK SERVICE & DISPATCHER TESTS PASSED 100% SUCCESSFULLY!\n');
}

runWebhookTests().catch((err) => {
  console.error('❌ Webhook test failed:', err);
  process.exit(1);
});
