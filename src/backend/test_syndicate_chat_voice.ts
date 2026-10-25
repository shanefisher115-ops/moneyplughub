import assert from 'assert';
import http from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { db, initDb } from './db';
import { config } from './config';
import { initSyndicatesSchema } from './routes/syndicates';
import { setupSyndicateWebSocket, syndicateWsManager } from './syndicateWs';

async function testSyndicateChatVoice() {
  console.log('⚔️ Testing Token-Gated Syndicate Chat & WebRTC Voice Rooms Engine...\n');

  // 1. Initialize schema
  initDb();
  initSyndicatesSchema();

  // Create test user with low net worth (Tier 1)
  const tier1UserId = `test_usr_tier1_${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO users (
      id, email, password_hash, display_name, role, referral_code,
      referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
    ) VALUES (?, 'tier1@test.local', 'hash', 'Tier 1 Operative', 'user', 'PLUG-T1', NULL, 0, 500, 1, 1, 'Emerald Seed', ?, ?)
  `).run(tier1UserId, now, now);

  db.prepare(`
    INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
    VALUES (?, ?, 'Cash Vault', 'cash', 50000, 'USD', 'Vault', 0, ?, ?)
  `).run(`acct_t1_${Date.now()}`, tier1UserId, now, now); // $500 = Tier 1 (Emerald)

  // Create test user with high net worth (Tier 5)
  const tier5UserId = `test_usr_tier5_${Date.now()}`;
  db.prepare(`
    INSERT OR REPLACE INTO users (
      id, email, password_hash, display_name, role, referral_code,
      referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
    ) VALUES (?, 'tier5@test.local', 'hash', 'Tier 5 Whale', 'user', 'PLUG-T5', NULL, 0, 50000, 8, 14, 'Diamond Vault', ?, ?)
  `).run(tier5UserId, now, now);

  db.prepare(`
    INSERT INTO accounts (id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at)
    VALUES (?, ?, 'Diamond Vault', 'cash', 150000000, 'USD', 'Vault', 0, ?, ?)
  `).run(`acct_t5_${Date.now()}`, tier5UserId, now, now); // $1,500,000 = Tier 6 / Tier 5

  // Add users as members of vortex syndicate
  const synId = 'syn_vortex_cyber';
  db.prepare(`
    INSERT OR IGNORE INTO syndicate_members (id, syndicate_id, user_id, role, contributed_xp, joined_at)
    VALUES (?, ?, ?, 'member', 500, ?)
  `).run(`sm_t1_${Date.now()}`, synId, tier1UserId, now);

  db.prepare(`
    INSERT OR IGNORE INTO syndicate_members (id, syndicate_id, user_id, role, contributed_xp, joined_at)
    VALUES (?, ?, ?, 'officer', 50000, ?)
  `).run(`sm_t5_${Date.now()}`, synId, tier5UserId, now);

  console.log('✓ Step 1: Database initialized & test users registered in syndicate [VRTX].');

  // 2. Start Test HTTP & WebSocket Server
  const server = http.createServer();
  setupSyndicateWebSocket(server);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const wsUrl = `ws://localhost:${port}/ws/syndicate`;

  console.log(`✓ Step 2: Syndicate WebSocket Server listening on port ${port}.`);

  // Generate tokens
  const tokenTier1 = jwt.sign({ userId: tier1UserId }, config.jwtSecret);
  const tokenTier5 = jwt.sign({ userId: tier5UserId }, config.jwtSecret);

  // 3. Connect Tier 1 Client via WebSocket
  const ws1 = new WebSocket(wsUrl);

  await new Promise<void>((resolve, reject) => {
    ws1.on('open', () => {
      ws1.send(JSON.stringify({ type: 'auth', token: tokenTier1, syndicateId: synId }));
    });

    ws1.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'auth_success') {
        assert.strictEqual(msg.userId, tier1UserId);
        assert.strictEqual(msg.tier.tier, 1, 'User should be resolved as Tier 1');
        console.log(`✓ Step 3: Tier 1 Client authenticated cleanly. Resolved Tier: ${msg.tier.name} (T1).`);
        resolve();
      } else if (msg.type === 'error') {
        reject(new Error(msg.message));
      }
    });
  });

  // 4. Test Token-Gated Wealth Tier Access Lock
  const tier4ChanId = `chan_bullion_${synId}`; // min_wealth_tier = 4
  const tier1ChanId = `chan_gen_${synId}`;     // min_wealth_tier = 1

  await new Promise<void>((resolve) => {
    ws1.send(JSON.stringify({ type: 'join_channel', channelId: tier4ChanId }));

    ws1.on('message', function handler(raw) {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'access_denied') {
        assert.strictEqual(msg.code, 'WEALTH_TIER_LOCKED');
        console.log(`✓ Step 4: Wealth Tier Lock verified! Tier 1 user rejected from Tier 4 channel (${msg.message}).`);
        ws1.removeListener('message', handler);
        resolve();
      }
    });
  });

  // 5. Join Unlocked Tier 1 Channel
  await new Promise<void>((resolve) => {
    ws1.send(JSON.stringify({ type: 'join_channel', channelId: tier1ChanId }));

    ws1.on('message', function handler(raw) {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'channel_joined') {
        assert.strictEqual(msg.channelId, tier1ChanId);
        console.log(`✓ Step 5: Tier 1 Client successfully joined #${msg.channelName}.`);
        ws1.removeListener('message', handler);
        resolve();
      }
    });
  });

  // 6. Connect Tier 5 Client and Join Same Channel
  const ws5 = new WebSocket(wsUrl);

  await new Promise<void>((resolve) => {
    ws5.on('open', () => {
      ws5.send(JSON.stringify({ type: 'auth', token: tokenTier5, syndicateId: synId }));
    });

    ws5.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'auth_success') {
        assert(msg.tier.tier >= 5, 'User should be resolved as Tier 5 or Tier 6');
        ws5.send(JSON.stringify({ type: 'join_channel', channelId: tier1ChanId }));
      } else if (msg.type === 'channel_joined') {
        console.log(`✓ Step 6: Tier 5 High-Net-Worth Client joined #${msg.channelName}.`);
        resolve();
      }
    });
  });

  // 7. Test E2EE Encrypted Message Transmutation & Relay
  const testEncryptedPayload = 'BASE64_CIPHERTEXT_MOCK_XYZ123';
  const testIv = 'BASE64_IV_MOCK_456';

  await new Promise<void>((resolve) => {
    ws1.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'chat_message') {
        assert.strictEqual(msg.message.senderId, tier5UserId);
        assert.strictEqual(msg.message.encryptedPayload, testEncryptedPayload);
        assert.strictEqual(msg.message.senderTierName, 'Celestial Osmium Singularity');
        console.log(`✓ Step 7: E2EE Message Relay verified! Message received from [${msg.message.senderTierName}] sender.`);
        resolve();
      }
    });

    ws5.send(JSON.stringify({
      type: 'send_message',
      channelId: tier1ChanId,
      encryptedPayload: testEncryptedPayload,
      iv: testIv,
    }));
  });

  // 8. Test WebRTC Voice Room Signaling Relay & Mute State
  const voiceChanId = `chan_voice_main_${synId}`;
  ws1.send(JSON.stringify({ type: 'join_channel', channelId: voiceChanId }));
  ws5.send(JSON.stringify({ type: 'join_channel', channelId: voiceChanId }));

  await new Promise<void>((resolve) => {
    ws1.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'webrtc_signal') {
        assert.strictEqual(msg.senderId, tier5UserId);
        assert.strictEqual(msg.signalType, 'offer');
        console.log('✓ Step 8: WebRTC Audio Signaling Frame relayed seamlessly between voice peers.');
        resolve();
      }
    });

    ws5.send(JSON.stringify({
      type: 'webrtc_signal',
      channelId: voiceChanId,
      targetUserId: tier1UserId,
      signalType: 'offer',
      signalData: { sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1...' },
    }));
  });

  // Cleanup
  ws1.close();
  ws5.close();
  syndicateWsManager.close();
  server.close();

  console.log('\n🎉 Token-Gated Syndicate Chat & WebRTC Voice Rooms verification complete! 100% Passed.\n');
  process.exit(0);
}

testSyndicateChatVoice().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
