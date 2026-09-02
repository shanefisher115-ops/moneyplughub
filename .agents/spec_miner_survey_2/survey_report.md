# Survey Report: Requirement R2 — Voice Engine, WebSocket & Real-Time Audio Pipeline

**Audited Component**: Creator Money OS (MoneyPlugHub) Voice Architecture  
**Author**: Survey Spec Miner 2 (Voice Engine & Real-Time Audio Pipeline)  
**Date**: 2026-08-26  
**Integrity Mode**: Development / Sovereign Production Hardening  
**Target Requirement**: R2 (Voice Engine, WebSocket & Audio Pipeline)

---

## Executive Summary

Creator Money OS (MoneyPlugHub) incorporates a dual-pipeline voice co-pilot architecture designed to deliver sub-250ms time-to-first-byte (TTFB) low-latency speech synthesis, intelligent voice persona modulation, procedural Web Audio soundscapes, and responsive client-side Voice Activity Detection (VAD) with instant barge-in audio interruption.

This specification audit provides a complete enumeration of the voice architecture, real-time streaming protocols, persona taxonomies, emotional modulation overlays, VAD state machines, WebSocket frame protocols, error recovery matrices, and architectural gaps/defects in the current implementation.

---

## System Architecture Overview

```
                                  ┌──────────────────────────────────────────────┐
                                  │           Client (Browser / React)           │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                           ┌─────────────────────────────┴────────────────────────────┐
                           │                                                          │
                 [User Audio Input]                                         [Voice Output / Playback]
                           │                                                          ▲
                           ▼                                                          │
          ┌───────────────────────────────────┐                     ┌───────────────────────────────────┐
          │   Client-Side VAD & Recognition   │                     │      Web Audio DSP & Spatial      │
          │  - Web Speech API (continuous)    │                     │  - StereoPannerNode (-0.35..0.35) │
          │  - 950ms Silence Debounce Timer   │                     │  - Shimmer Delay & Reverb         │
          │  - Generation Token Guard (Lock)  │                     │  - 4 Procedural Synth Soundscapes │
          └────────────────┬──────────────────┘                     └─────────────────▲─────────────────┘
                           │                                                          │
                           │ [Transcribed Prompt]                         [Audio Stream / Chunks]
                           ▼                                                          │
          ┌───────────────────────────────────┐                     ┌─────────────────┴─────────────────┐
          │        MoneyOS Chat Route         │────────────────────►│       Voice Engine / TTS          │
          │     POST /api/moneyos/chat        │                     │   POST /api/tts/speak (v4)        │
          │  (Financial Command Execution)    │                     │   POST /api/voice/tts (v3.1)      │
          └───────────────────────────────────┘                     └─────────────────▲─────────────────┘
                                                                                      │
                                                                   ┌──────────────────┴──────────────────┐
                                                                   │       ElevenLabs Flash v2.5         │
                                                                   │  - optimize_streaming_latency=4     │
                                                                   │  - mp3_22050_32 chunked stream      │
                                                                   └─────────────────────────────────────┘
```

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | TTS Engine | Low-Latency ElevenLabs Stream | Streams synthesized MP3 audio chunks via ElevenLabs `eleven_flash_v2_5` with latency tier 4. | `text`, `persona`, `emotion`, `voice_settings` | `Transfer-Encoding: chunked`, `audio/mpeg` byte stream, metadata headers | Returns HTTP 502/503 with fallback JSON `{ success: false, fallback: 'browser' }` | `src/backend/routes/tts.ts`, `src/backend/voice/elevenlabs-tts.ts` |
| 2 | Persona System | 10 Base Voice Personas | Specialized tonality, stability, similarity, style, speed, and spatial panning for OS roles. | `BasePersona` identifier | Resolved `PersonaMetrics` / `PersonaProfile` | Defaults to `general_conversation` profile | `src/backend/routes/tts.ts:73`, `src/backend/voice/persona.ts:53` |
| 3 | Persona System | 5 Dynamic Persona Fusions | Blends two persona styles and soundscapes based on consecutive conversation context memory drift. | Client conversation history + consecutive persona triggers | Fusion profile metrics (`stability`, `similarity_boost`, `style`, `pace`, `soundscape`) | Falls back to single base persona | `src/backend/routes/tts.ts:207` |
| 4 | Emotion Engine | 8 Emotional Overlays | Modulates stability (-0.10 to +0.22), style (-0.15 to +0.30), and pace (-0.12 to +0.14) based on sentiment/intent. | `EmotionOverlay` (`calm`, `hype`, `ascension`, `whisper`, `analytical`, `ritualistic`, `reverent`, `excited`) | Mutated voice stability/style/pace parameters | Defaults to `calm` (zero offset) | `src/backend/routes/tts.ts:266`, `src/backend/voice/persona.ts:189` |
| 5 | NLP / Intent | Zero-Shot Intent Classifier | Parses prompt keywords to classify 8 intents (`explore`, `ask`, `escalate`, `unlock`, `reflect`, `strategize`, `create`, `troubleshoot`). | Raw spoken text string + client ID | `{ intent, emotion, basePersona, fusionKey }` | Default intent `ask`, persona `general_conversation`, emotion `calm` | `src/backend/routes/tts.ts:303` |
| 6 | Text Prosody | Smart Text Sanitizer & Prosody Injector | Strips emojis, markdown, URLs; expands `$X/mo` and `PLUG-XYZ`; inserts micro-pause punctuation ellipses; enforces 2500-char safe boundary at punctuation. | Raw markdown or text string | Cleaned, prosody-optimized speech string | Truncates at nearest punctuation mark between 1800-2450 chars | `src/backend/routes/tts.ts:364`, `src/backend/voice/persona.ts:248` |
| 7 | Sound Design | 4 Contextual Procedural Soundscapes | Synthesizes subtle Web Audio drone beds (-28dB to -34dB): `vault_hum` (48Hz sub), `sigil_shimmer` (528Hz Solfeggio), `cyber_pulse` (440Hz + 2Hz LFO), `harmonic_drone` (A2-E3-A3 fifths). | `SoundscapeType` enum | Real-time Web Audio oscillator & gain nodes connected to `ctx.destination` | Graceful silent fallback if AudioContext is blocked or suspended | `src/frontend/utils/soundDesignEngine.ts:37` |
| 8 | Spatial Audio | Stereo Panning & Shimmer Reverb | Attaches `StereoPannerNode` (-0.35 left, +0.35 right) and 0.14s delay shimmer reverb for ritualistic/ascension personas. | `HTMLAudioElement`, `panValue`, `addReverb` boolean | Spatialized Web Audio node graph | Falls back to default stereo destination | `src/frontend/utils/soundDesignEngine.ts:173` |
| 9 | Client VAD | Web Speech API Continuous Recognition | Continuous voice recognition with interim vs final transcript resolution and auto-silence dispatching. | Microphone audio stream | `transcript`, `isFinal` boolean | Triggers `onerror` and resets state to `idle` or restarts listening loop | `src/frontend/voice/VoiceEngineKernel.ts:138`, `FloatingMoneyOSWindow.tsx:417` |
| 10 | Cloud STT | Google Cloud STT & Gemini Audio Fallback | Server-side speech-to-text pipeline utilizing Google Cloud Speech-to-Text v1 and Gemini 1.5 Flash Audio transcription. | Base64 audio buffer, MIME type, sample rate | `STTResult` (`transcript`, `confidence`, `provider`, `latencyMs`) | Falls back to `browser-fallback` provider | `src/backend/voice/google-stt.ts:37` |
| 11 | Interruption | Generation Guarded Barge-In | Immediate cancellation of in-flight speech, audio unloading, oscillator teardown, and SpeechSynthesis cancel upon user speech. | User utterance detection or manual interrupt | Monotonically incremented generation token | Discards all stale in-flight audio chunks | `src/frontend/voice/VoiceEngineKernel.ts:105`, `FloatingMoneyOSWindow.tsx:192` |
| 12 | Telemetry | Dual-Pipeline Benchmark Monitor | Tracks rolling latency history (STT latency, TTS TTFB) and operational status. | Execution duration timestamps | `VoiceBenchmarkSummary` JSON payload | Returns fallback baseline (STT 120ms, TTS 235ms) | `src/backend/voice/kernel.ts:134`, `src/backend/voice/router.ts:18` |
| 13 | Quota System | ElevenLabs Live Character Balancer | Live verification of ElevenLabs subscription quota, tier, and remaining character limit. | ElevenLabs API Key | `{ configured, status, tier, characterCount, remainingCharacters, resetDateUnix }` | Returns `status: 'no_key'` or `quota_exhausted` | `src/backend/voice/router.ts:64` |
| 14 | Key Management | Dynamic In-Memory API Key Hot-Swap | REST endpoints to dynamically update and verify ElevenLabs and Google Cloud API keys without server restart. | `POST /api/voice/api-key`, `POST /api/voice/google-key` | Verification status and live quota metadata | Returns HTTP 400 with upstream provider error message | `src/backend/voice/router.ts:129`, `src/backend/voice/router.ts:192` |
| 15 | Audio Synth | Procedural Sigil Forge Audio Engine | 100% mathematical Web Audio synthesizer for UI ticks, 528Hz ascension chords, cosmic rolls, and supernova bass drops. | Trigger events (`playTick`, `playAscensionChord`, `playCosmicRoll`, `playShockwave`) | Real-time procedural audio chimes and chords | Mute flag `isMuted` prevents audio generation | `src/frontend/utils/forgeAudio.ts:6` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Barge-In Interruption | User speaks while ElevenLabs audio stream is actively playing. | `currentSpeechGenerationRef` increments, `audio.pause()` is executed, `audio.src` is emptied, `activeAudioUrlRef` is revoked, `soundDesign.stopSoundscape()` is triggered, and microphone captures new prompt without overlapping audio. |
| 2 | In-Flight Network Race | User speaks and interrupts while backend `/api/tts/speak` HTTP stream is in-flight. | When fetch resolves, `thisGen !== currentSpeechGenerationRef.current` check triggers, causing client to discard the newly arrived blob and abort playback. |
| 3 | Long Prompt Overflow | AI response exceeds 2,500 characters. | `prepareSpeechText` detects length > 2500, searches backwards from index 2450 for the last period, exclamation mark, or question mark (> 1800 chars), and cleanly slices at sentence boundary to avoid jarring mid-word cutoffs. |
| 4 | ElevenLabs Quota Exhausted | API key valid but character balance is 0. | Endpoint returns HTTP 502/fallback signal; frontend detects non-audio response or fallback flag and transparently invokes browser native `SpeechSynthesisUtterance` with zero user disruption. |
| 5 | Self-Audio Loop Prevention | User's speakers output AI voice while microphone is listening. | In `FloatingMoneyOSWindow.tsx`, microphone recognition is aborted before speaking and transcripts during `voiceState === 'speaking'` are dropped, preventing feedback loops. |
| 6 | Uncommitted Speech on Mic Timeout | User speaks but pauses right as `SpeechRecognition` triggers `onend` without marking `isFinal: true`. | `recognition.onend` checks `lastSpokenTextRef.current`; if uncommitted text exists, it is automatically flushed and dispatched to `sendVoiceMessage`. |
| 7 | Missing Audio Context Permission | Browser blocks Web Audio autoplay before user interaction. | `getContext()` handles `suspended` state by calling `ctx.resume().catch(() => {})`, avoiding unhandled Promise rejections. |
| 8 | Currency & Acronym Pronunciation | Prompt contains "PLUG-789" or "$49/mo". | Text sanitizer expands "PLUG-789" to "P L U G - 7 8 9" and "$49/mo" to "49 dollars per month", preventing distorted phonetic pronunciation. |

---

## Specification & Protocol Details

### 1. ElevenLabs Real-Time Voice Streaming Co-Pilot
- **Backend Streaming Endpoint**: `POST /api/tts/speak` and `POST /api/voice/tts`
- **Upstream ElevenLabs Endpoint**:
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32&optimize_streaming_latency=4`
- **Audio Format**: MP3, 22.05kHz, 32kbps mono (`mp3_22050_32`), optimized for ultra-low streaming latency.
- **Latency Optimization**: `optimize_streaming_latency=4` enables maximum chunked streaming latency reduction on ElevenLabs Flash v2.5.
- **Metadata Headers**:
  - `Content-Type: audio/mpeg`
  - `Transfer-Encoding: chunked`
  - `X-MoneyOS-Persona`: active base persona ID
  - `X-MoneyOS-Persona-Name`: display name of persona
  - `X-MoneyOS-Fusion-Mode`: fusion key identifier or `'none'`
  - `X-MoneyOS-Emotion`: applied emotional tone overlay
  - `X-MoneyOS-Intent`: classified intent
  - `X-MoneyOS-Soundscape`: recommended background soundscape
  - `X-MoneyOS-Spatial-Pan`: stereo pan value (`'left' | 'center' | 'right'`)
  - `X-MoneyOS-Pace`: calculated playback pace multiplier
  - `X-MoneyOS-Evolution-Tier`: user progression gate level

### 2. Client-Side Voice Activity Detection (VAD)
- **Engine**: Continuous Web Speech API with interim transcript streaming.
- **Silence Debounce**: 950ms inactivity timer in continuous mode; automatically dispatches message upon silence detection.
- **Confidence Threshold**: Accepts all interim results with text length > 0; prioritizes `isFinal === true` results for instantaneous execution.
- **Self-Audio Suppression**: Input is disabled or ignored while `voiceState === 'speaking'`.

### 3. Barge-In Interruption State Machine
```
   ┌──────────────────────────────────────────────────────────┐
   │                          IDLE                            │
   └───────────────┬──────────────────────────▲───────────────┘
                   │ startListening()         │
                   ▼                          │
   ┌──────────────────────────────────────────┴───────────────┐
   │                       LISTENING                          │
   └───────────────┬──────────────────────────▲───────────────┘
                   │ speechFinalized()        │
                   ▼                          │
   ┌──────────────────────────────────────────┤
   │                  PROCESSING              │
   └───────────────┬──────────────────────────┤
                   │ audioStreamReady()       │
                   ▼                          │ (User speaks: Barge-In!)
   ┌──────────────────────────────────────────┤
   │                        SPEAKING          │
   └───────────────┬──────────────────────────┘
                   │ onended (conversationMode == true)
                   ▼
             [ Auto-Resume LISTENING ]
```

### 4. WebSocket Protocol & Reconnection Specification (Required for R2 Hardening)
To satisfy the Requirement R2 specification and acceptance criteria for a bidirectional real-time Voice WebSocket pipeline, the following protocol contracts are defined:

#### A. WebSocket Frame Schema (`/ws/voice` or `/api/voice/stream`)
1. **Client -> Server Messages**:
   - `session_init`:
     ```json
     {
       "type": "session_init",
       "token": "<jwt_token_optional>",
       "persona": "vault_explanation",
       "tone": "calm",
       "audioFormat": "pcm_16000"
     }
     ```
   - `audio_chunk` (Binary or JSON Base64):
     ```json
     {
       "type": "audio_chunk",
       "data": "<base64_pcm_or_opus>",
       "isFinal": false
     }
     ```
   - `interrupt` (Barge-in):
     ```json
     {
       "type": "interrupt",
       "generationToken": 42
     }
     ```
   - `ping`:
     ```json
     {
       "type": "ping",
       "clientTimestamp": 1724679271000
     }
     ```

2. **Server -> Client Messages**:
   - `session_ready`:
     ```json
     {
       "type": "session_ready",
       "sessionId": "sess_voice_12345",
       "sampleRate": 22050,
       "provider": "elevenlabs"
     }
     ```
   - `transcript`:
     ```json
     {
       "type": "transcript",
       "text": "Send $100 from savings to checking",
       "isFinal": true,
       "confidence": 0.98
     }
     ```
   - `audio_start`:
     ```json
     {
       "type": "audio_start",
       "generationToken": 42,
       "persona": "vault_explanation",
       "soundscape": "vault_hum",
       "spatialPan": 0.0
     }
     ```
   - `audio_chunk`: Binary MP3 / PCM chunk.
   - `audio_end`:
     ```json
     {
       "type": "audio_end",
       "generationToken": 42,
       "durationMs": 3200
     }
     ```
   - `pong`:
     ```json
     {
       "type": "pong",
       "clientTimestamp": 1724679271000,
       "serverTimestamp": 1724679271020
     }
     ```
   - `error`:
     ```json
     {
       "type": "error",
       "code": "QUOTA_EXHAUSTED",
       "message": "ElevenLabs quota exhausted",
       "fallback": "browser"
     }
     ```

#### B. Reconnect & Backoff Policy
- **Exponential Backoff with Full Jitter**:
  $$t_{\text{backoff}} = \min(t_{\text{max}}, t_{\text{base}} \times 2^{\text{attempt}}) \pm \text{jitter}$$
  - $t_{\text{base}} = 500\,\text{ms}$
  - $t_{\text{max}} = 10,000\,\text{ms}$
  - $\text{max\_retries} = 5$
- **Heartbeat Keep-Alive**: Ping sent every 15 seconds; if no Pong within 5 seconds, connection is marked dead and reconnect cycle begins.

---

## Codebase Defects & Gaps Identified in Requirement R2

1. **Defect 1: Missing Backend WebSocket Server Mount in `server.ts`**:
   - `src/backend/server.ts` launches Express with `app.listen(config.port)`. It does not attach a WebSocket Server (`ws` or `http.Server` upgrade listener) for real-time duplex voice streaming, despite requirement R2 and acceptance criteria stating "Voice WebSocket endpoint and REST endpoints return valid responses".
2. **Defect 2: Dual Route Duplication & Inconsistent Endpoint Usage**:
   - `src/backend/routes/tts.ts` provides `POST /api/tts/speak` (v4 with rich persona metadata headers, soundscape tags, and prosody formatting).
   - `src/backend/voice/router.ts` provides `POST /api/voice/tts` (v3.1 with `ElevenLabsTTSPipeline`).
   - `FloatingMoneyOSWindow.tsx` calls `/api/tts/speak`, whereas `src/frontend/voice/VoiceEngineKernel.ts` calls `/api/voice/tts`.
3. **Defect 3: Disconnected VoiceEngineKernel Class**:
   - `src/frontend/voice/VoiceEngineKernel.ts` defines a modular voice kernel, but UI components (`FloatingMoneyOSWindow.tsx`, `MoneyOSPage.tsx`, `DailyWealthBriefingModal.tsx`) duplicate local speech recognition, audio references, and barge-in state logic inline instead of reusing the unified kernel.
4. **Defect 4: Missing Request Abort Signals (Network Waste on Barge-In)**:
   - When barge-in occurs, the frontend increments `currentSpeechGenerationRef`, but does not issue an `AbortController.abort()` to in-flight HTTP requests (`/api/tts/speak` or `/api/moneyos/chat`), resulting in unnecessary bandwidth consumption.
5. **Defect 5: Unvalidated Environment Fallbacks in STT Pipeline**:
   - `src/backend/voice/google-stt.ts` attempts to call Google Cloud Speech v1 and Gemini 1.5 Flash using raw `fetch`. If keys are invalid or absent, it catches the error and logs a warning, but could emit clearer status headers to the client.

---

## Verification & Test Plan

1. **HTTP Audio Stream Verification**:
   - Execute `POST /api/tts/speak` with valid text payload. Confirm status `200 OK`, `Content-Type: audio/mpeg`, and headers `X-MoneyOS-Persona`, `X-MoneyOS-Soundscape`.
   - Execute `POST /api/tts/speak` without API key. Confirm status `503 Service Unavailable` with `fallback: 'browser'`.
2. **Persona & Quota Endpoints**:
   - Execute `GET /api/tts/personas` and `GET /api/voice/personas`. Verify all 10 base personas and 5 fusions return.
   - Execute `GET /api/voice/quota` and `GET /api/voice/benchmark`. Confirm valid JSON metrics structure.
3. **Barge-in Lifecycle & VAD Verification**:
   - Test audio playback interruption in `FloatingMoneyOSWindow.tsx`; confirm active audio is paused and generation token invalidates previous audio chunks.
4. **Build & Typecheck**:
   - Run `npx tsc --noEmit` and `npx tsc -p tsconfig.server.json --noEmit` to verify type safety across all voice pipelines.
