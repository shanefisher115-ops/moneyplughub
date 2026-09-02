/**
 * Creator Money OS — Voice Engine v3.1 / v4.0 & WebSocket Protocol Hardening Test Suite
 * Location: tests/voice-engine.test.ts
 */

import assert from 'assert';
import http from 'http';
import { WebSocket } from 'ws';
import { VoiceWebSocketManager, setupVoiceWebSocket } from '../src/backend/voice/ws';
import { BASE_PERSONAS, PERSONA_FUSION_MAP, EMOTIONAL_OVERLAYS, classifyVoiceIntentAndEmotion } from '../src/backend/routes/tts';
import { PERSONA_PROFILES, applyEmotionalTone, injectSpeechProsody } from '../src/backend/voice/persona';
import { VoiceEngineKernel } from '../src/frontend/voice/VoiceEngineKernel';

async function runVoiceEngineTests(): Promise<void> {
  console.log('🎤 Running Voice Engine & WebSocket Duplex Hardening Tests...\n');

  // Test 1: Persona Registry & Fusion Mapping
  console.log('Test 1: Persona Registry & Fusion Mapping...');
  assert.strictEqual(Object.keys(BASE_PERSONAS).length, 10, 'Must have exactly 10 base personas');
  assert.strictEqual(Object.keys(PERSONA_FUSION_MAP).length, 5, 'Must have exactly 5 persona fusion modes');
  assert.strictEqual(Object.keys(EMOTIONAL_OVERLAYS).length, 8, 'Must have exactly 8 emotional overlays');
  assert.strictEqual(Object.keys(PERSONA_PROFILES).length, 10, 'PERSONA_PROFILES must have 10 master personas');
  console.log('✓ Test 1 Passed: All 10 base personas, 5 fusions, and 8 overlays verified.');

  // Test 2: Intent & Emotion Classification
  console.log('Test 2: Dynamic Intent & Emotion Classification...');
  const unlockAnalysis = classifyVoiceIntentAndEmotion('Unlock the living vault chamber for ascension level 5!');
  assert.strictEqual(unlockAnalysis.intent, 'unlock');
  assert.strictEqual(unlockAnalysis.emotion, 'ascension');
  assert.strictEqual(unlockAnalysis.basePersona, 'chamber_unlock');

  const stratAnalysis = classifyVoiceIntentAndEmotion('Scale affiliate MRR and referral commission conversions.');
  assert.strictEqual(stratAnalysis.intent, 'strategize');
  assert.strictEqual(stratAnalysis.basePersona, 'creator_mode');

  const sigilAnalysis = classifyVoiceIntentAndEmotion('Forge the mystic cryptographic sigil on the canvas.');
  assert.strictEqual(sigilAnalysis.intent, 'create');
  assert.strictEqual(sigilAnalysis.emotion, 'ritualistic');
  assert.strictEqual(sigilAnalysis.basePersona, 'sigil_forge');
  console.log('✓ Test 2 Passed: Intent, emotion, and persona classification verified.');

  // Test 3: Emotional Modulation & Prosody Injection
  console.log('Test 3: Emotional Modulation & Prosody Injection...');
  const baseProfile = PERSONA_PROFILES.vault_explanation;
  const modulatedProfile = applyEmotionalTone(baseProfile, 'hype');
  assert.strictEqual(modulatedProfile.tone, 'hype');
  assert.strictEqual(modulatedProfile.stability, 0.25);
  assert.strictEqual(modulatedProfile.style, 0.60);
  assert.strictEqual(modulatedProfile.speed, 1.12);

  const cleanText = injectSpeechProsody('### Title\n**Bold** `code` [link](url) Special! $100', 'assertive');
  assert(!cleanText.includes('#'), 'Headers must be stripped');
  assert(!cleanText.includes('**'), 'Bold asterisks must be stripped');
  assert(!cleanText.includes('`'), 'Backticks must be stripped');
  assert(!cleanText.includes('[link]'), 'Markdown links must be stripped');
  console.log('✓ Test 3 Passed: Emotional modulation & prosody cleaning verified.');

  // Test 4: Live WebSocket Server Mounting, Connection, and Frame Exchange
  console.log('Test 4: Live WebSocket Server Mounting & Duplex Frame Exchange...');
  const server = http.createServer();
  const wsManager = new VoiceWebSocketManager();
  wsManager.mount(server, '/ws/voice');

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  const wsUrl = `ws://127.0.0.1:${port}/ws/voice`;

  const ws = new WebSocket(wsUrl);

  const receivedFrames: any[] = [];
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      // 1. Send session_init frame
      ws.send(JSON.stringify({
        type: 'session_init',
        persona: 'vault_explanation',
        emotion: 'calm',
        audioFormat: 'mp3_22050_32',
      }));
    });

    ws.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      receivedFrames.push(frame);

      if (frame.type === 'session_ready') {
        // 2. Send ping frame
        ws.send(JSON.stringify({
          type: 'ping',
          clientTimestamp: Date.now(),
        }));
      } else if (frame.type === 'pong') {
        // 3. Send speak frame
        ws.send(JSON.stringify({
          type: 'speak',
          text: 'Welcome to Creator Money OS.',
          persona: 'vault_explanation',
          generationToken: 101,
        }));
      } else if (frame.type === 'audio_start') {
        // 4. Send interrupt frame immediately (barge-in simulation)
        ws.send(JSON.stringify({
          type: 'interrupt',
          generationToken: 101,
          reason: 'user_barge_in',
        }));
      } else if (frame.type === 'interrupted') {
        resolve();
      }
    });

    ws.on('error', reject);
  });

  assert(receivedFrames.some(f => f.type === 'session_ready'), 'Must receive session_ready');
  assert(receivedFrames.some(f => f.type === 'pong'), 'Must receive pong');
  assert(receivedFrames.some(f => f.type === 'audio_start'), 'Must receive audio_start');
  assert(receivedFrames.some(f => f.type === 'interrupted'), 'Must receive interrupted frame');

  ws.close();
  wsManager.close();
  server.close();
  console.log('✓ Test 4 Passed: WebSocket duplex session, keepalive, and barge-in interrupted frame verified.');

  // Test 5: Frontend VoiceEngineKernel AbortController & State Management
  console.log('Test 5: Frontend VoiceEngineKernel Barge-in & Generation Invalidation...');
  const kernel = new VoiceEngineKernel();
  assert.strictEqual(kernel.getState(), 'idle');

  const gen1 = kernel.interruptSpeech();
  const gen2 = kernel.interruptSpeech();
  assert.strictEqual(gen2, gen1 + 1, 'Generation token must increment on every interrupt');
  console.log('✓ Test 5 Passed: VoiceEngineKernel generation invalidation verified.');

  console.log('\n🎉 ALL VOICE ENGINE & WEBSOCKET PROTOCOL TESTS PASSED WITH 100% SUCCESS!\n');
}

runVoiceEngineTests().catch((err) => {
  console.error('❌ Voice Engine Test failed:', err);
  process.exit(1);
});
