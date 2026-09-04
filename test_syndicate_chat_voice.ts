import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { config } from './src/backend/config';
import { db, runInTransaction } from './src/backend/db';
import {
  initSyndicatesSchema,
  ensureDefaultSyndicateChannels,
  isWealthTierAccessGranted,
  getTierRank,
} from './src/backend/routes/syndicates';
import { setupSyndicateWebSocket, syndicateWsManager } from './src/backend/syndicates/syndicateWs';

async function runSyndicateChatVoiceTests() {
  console.log('⚔️ Starting Token-Gated Syndicate Chat & WebRTC Voice Room Test Suite...\n');

  // 1. Initialize DB & Schema
  initSyndicatesSchema();
  console.log('✓ Step 1: SQLite schema initialized for syndicates, channels, and E2EE messages.');

  // Verify Default Seeded Channels for Vortex Cyber Syndicate
  const syndicateId = 'syn_vortex_cyber';
  ensureDefaultSyndicateChannels(syndicateId);

  const channels = db
    .prepare('SELECT * FROM syndicate_channels WHERE syndicate_id = ? ORDER BY required_level ASC')
    .all(syndicateId) as any[];

  assert(channels.length >= 6, 'Must have at least 6 default seeded channels');
  assert(channels.some((c) => c.name === 'general-chat' && c.required_level === 1), 'Must contain general-chat (Level 1)');
  assert(channels.some((c) => c.name === 'alpha-lounge' && c.required_level === 3), 'Must contain alpha-lounge (Level 3)');
  assert(channels.some((c) => c.name === 'apex-vault' && c.required_level === 5), 'Must contain apex-vault (Level 5)');
  assert(channels.some((c) => c.name === '🔊 General Voice' && c.type === 'voice'), 'Must contain General Voice channel');
  assert(channels.some((c) => c.name === '🔊 Cosmic War Room' && c.type === 'voice' && c.required_level === 7), 'Must contain Cosmic War Room (Level 7)');
  console.log(`✓ Step 2: Verified ${channels.length} token-gated text & voice channels for syndicate [VRTX].`);

  // 2. Test Wealth Tier Badge Logic
  assert.strictEqual(isWealthTierAccessGranted(1, 'Novice Plug', 1, 'Novice Plug'), true);
  assert.strictEqual(isWealthTierAccessGranted(1, 'Novice Plug', 3, 'Crypto Stacker'), false);
  assert.strictEqual(isWealthTierAccessGranted(3, 'Crypto Stacker', 3, 'Crypto Stacker'), true);
  assert.strictEqual(isWealthTierAccessGranted(5, 'Grand Money Plug', 3, 'Crypto Stacker'), true);
  assert.strictEqual(isWealthTierAccessGranted(5, 'Grand Money Plug', 5, 'Grand Money Plug'), true);
  assert.strictEqual(isWealthTierAccessGranted(5, 'Grand Money Plug', 7, 'Cosmic Money Plug'), false);
  assert.strictEqual(isWealthTierAccessGranted(10, 'Cosmic Money Plug', 7, 'Cosmic Money Plug'), true);
  console.log('✓ Step 3: Verified server-side Wealth Tier badge access control evaluation matrix.');

  // 3. Create Test Operatives in DB
  const user1Id = `usr_test_novice_${Date.now()}`;
  const user2Id = `usr_test_apex_${Date.now()}`;
  const now = new Date().toISOString();

  runInTransaction(() => {
    // User 1: Novice Plug (Level 1)
    db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, 'novice@test.local', 'hash', 'Novice Operative', 'user', 'REF-NOV1', 0, 100, 1, 1, 'Novice Plug', ?, ?)
    `).run(user1Id, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO syndicate_members (
        id, syndicate_id, user_id, role, contributed_xp, joined_at
      ) VALUES (?, ?, ?, 'member', 100, ?)
    `).run(`sm_${user1Id}`, syndicateId, user1Id, now);

    // User 2: Grand Money Plug (Level 5)
    db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, password_hash, display_name, role, referral_code,
        referral_count, xp, level, streak_days, tier_title, created_at, updated_at
      ) VALUES (?, 'apex@test.local', 'hash', 'Apex Strategist', 'user', 'REF-APEX2', 0, 3000, 5, 10, 'Grand Money Plug', ?, ?)
    `).run(user2Id, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO syndicate_members (
        id, syndicate_id, user_id, role, contributed_xp, joined_at
      ) VALUES (?, ?, ?, 'officer', 3000, ?)
    `).run(`sm_${user2Id}`, syndicateId, user2Id, now);
  });

  const token1 = jwt.sign({ userId: user1Id }, config.jwtSecret, { expiresIn: '1h' });
  const token2 = jwt.sign({ userId: user2Id }, config.jwtSecret, { expiresIn: '1h' });

  // 4. Start Test Server & Mount WebSocket Engine
  const server = http.createServer();
  setupSyndicateWebSocket(server);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const wsUrl = `ws://localhost:${port}/ws/syndicates`;

  console.log(`✓ Step 4: Started WebSocket server on port ${port}.`);

  // 5. Test WebSocket Connection & Token Gating for User 1 (Level 1)
  const client1 = new WebSocket(`${wsUrl}?token=${token1}`);

  await new Promise<void>((resolve, reject) => {
    client1.on('open', () => {
      client1.send(JSON.stringify({ type: 'session_init', token: token1 }));
    });

    client1.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'session_ready') {
        assert.strictEqual(frame.user_id, user1Id);
        assert.strictEqual(frame.tier_title, 'Novice Plug');
        assert.strictEqual(frame.syndicate_id, syndicateId);
        resolve();
      }
    });

    client1.on('error', reject);
  });

  console.log('✓ Step 5: Verified WebSocket handshake & session init for User 1.');

  // 6. Test Channel Join Gating
  const generalChannel = channels.find((c) => c.name === 'general-chat')!;
  const apexVaultChannel = channels.find((c) => c.name === 'apex-vault')!;

  // 6a: User 1 joins general-chat (Level 1) -> SUCCEEDS
  await new Promise<void>((resolve, reject) => {
    const handleMsg = (data: any) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'channel_joined' && frame.channel_id === generalChannel.id) {
        client1.off('message', handleMsg);
        resolve();
      }
    };
    client1.on('message', handleMsg);
    client1.send(JSON.stringify({ type: 'join_channel', channel_id: generalChannel.id }));
  });

  console.log('✓ Step 6a: User 1 (Novice Plug) joined Level 1 channel #general-chat.');

  // 6b: User 1 attempts joining apex-vault (Level 5 required) -> DENIED WITH TOKEN_GATED_ACCESS_DENIED
  await new Promise<void>((resolve) => {
    const handleMsg = (data: any) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'access_denied') {
        assert.strictEqual(frame.code, 'TOKEN_GATED_ACCESS_DENIED');
        assert.strictEqual(frame.required_tier, 'Grand Money Plug');
        client1.off('message', handleMsg);
        resolve();
      }
    };
    client1.on('message', handleMsg);
    client1.send(JSON.stringify({ type: 'join_channel', channel_id: apexVaultChannel.id }));
  });

  console.log('✓ Step 6b: Access denied correctly enforced for User 1 attempting to join Level 5 channel #apex-vault.');

  // 7. Test E2EE Message Transmission, SQLite Persistence & Room Broadcasting
  const client2 = new WebSocket(`${wsUrl}?token=${token2}`);
  await new Promise<void>((resolve) => {
    client2.on('open', () => {
      client2.send(JSON.stringify({ type: 'session_init', token: token2 }));
    });
    client2.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'session_ready') resolve();
    });
  });

  // Join User 2 to general-chat
  await new Promise<void>((resolve) => {
    const handleMsg = (data: any) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'channel_joined') {
        client2.off('message', handleMsg);
        resolve();
      }
    };
    client2.on('message', handleMsg);
    client2.send(JSON.stringify({ type: 'join_channel', channel_id: generalChannel.id }));
  });

  // User 1 sends E2EE message
  const testCiphertext = JSON.stringify({
    ciphertext: 'SGVsbG8gU3luZGljYXRl',
    iv: 'MTIzNDU2Nzg5MDEy',
    salt: 'c2FsdDFzYWx0',
    alg: 'AES-GCM-256',
    v: 1,
  });

  const broadcastReceivedPromise = new Promise<void>((resolve) => {
    client2.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'message' && frame.message.sender_id === user1Id) {
        assert.strictEqual(frame.message.encrypted_content, testCiphertext);
        assert.strictEqual(frame.message.is_encrypted, true);
        resolve();
      }
    });
  });

  client1.send(
    JSON.stringify({
      type: 'send_message',
      channel_id: generalChannel.id,
      encrypted_content: testCiphertext,
    })
  );

  await broadcastReceivedPromise;

  // Verify SQLite DB persistence
  const savedMsg = db
    .prepare('SELECT * FROM syndicate_messages WHERE channel_id = ? AND sender_id = ?')
    .get(generalChannel.id, user1Id) as any;
  assert(savedMsg !== undefined, 'Message must be saved in DB');
  assert.strictEqual(savedMsg.encrypted_content, testCiphertext);

  console.log('✓ Step 7: E2EE message transmitted, stored in SQLite database, and broadcasted to room.');

  // 8. Test WebRTC Voice Room Signaling & Voice State Updates
  const voiceChannel = channels.find((c) => c.type === 'voice' && c.required_level === 1)!;

  // Both users join voice channel
  client1.send(JSON.stringify({ type: 'join_channel', channel_id: voiceChannel.id }));
  client2.send(JSON.stringify({ type: 'join_channel', channel_id: voiceChannel.id }));

  await new Promise((r) => setTimeout(r, 100));

  // User 1 sends WebRTC Offer to User 2
  const offerPromise = new Promise<void>((resolve) => {
    client2.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'webrtc_offer' && frame.sender_user_id === user1Id) {
        assert.strictEqual(frame.offer.sdp, 'fake_sdp_offer');
        resolve();
      }
    });
  });

  client1.send(
    JSON.stringify({
      type: 'webrtc_offer',
      channel_id: voiceChannel.id,
      target_user_id: user2Id,
      offer: { type: 'offer', sdp: 'fake_sdp_offer' },
    })
  );

  await offerPromise;

  // User 2 sends WebRTC Answer to User 1
  const answerPromise = new Promise<void>((resolve) => {
    client1.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'webrtc_answer' && frame.sender_user_id === user2Id) {
        assert.strictEqual(frame.answer.sdp, 'fake_sdp_answer');
        resolve();
      }
    });
  });

  client2.send(
    JSON.stringify({
      type: 'webrtc_answer',
      channel_id: voiceChannel.id,
      target_user_id: user1Id,
      answer: { type: 'answer', sdp: 'fake_sdp_answer' },
    })
  );

  await answerPromise;

  // Voice State Update
  const voiceStatePromise = new Promise<void>((resolve) => {
    client2.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      if (frame.type === 'voice_state_update' && frame.user_id === user1Id) {
        assert.strictEqual(frame.is_muted, true);
        assert.strictEqual(frame.is_speaking, true);
        resolve();
      }
    });
  });

  client1.send(
    JSON.stringify({
      type: 'voice_state_update',
      channel_id: voiceChannel.id,
      is_muted: true,
      is_deafened: false,
      is_speaking: true,
    })
  );

  await voiceStatePromise;

  console.log('✓ Step 8: WebRTC SDP offers, answers, and voice state updates routed cleanly between voice peers.');

  // Cleanup
  client1.close();
  client2.close();
  syndicateWsManager.close();
  server.close();

  console.log('\n🎉 ALL TOKEN-GATED SYNDICATE CHAT & WEBRTC VOICE ROOM TESTS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
}

runSyndicateChatVoiceTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
