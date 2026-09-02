# Handoff Report: Spec Miner Survey 2 (Voice Engine & Audio Pipeline)

**To**: Parent Orchestrator (`ad0a19e4-7f7d-4936-a87c-6ab2e2fbf087`)  
**From**: Spec Miner Survey 2 (`5fbb8b62-9dc7-4d0f-a228-4bbe24021660`)  
**Date**: 2026-08-26  
**Artifact Path**: `.agents/spec_miner_survey_2/survey_report.md`

---

### 1. Observation
1. **Core Voice Files Examined**:
   - `src/backend/routes/tts.ts` (590 lines): Implements MoneyOS Voice Engine v4 with 10 base personas, 5 fusion modes, 8 emotional overlays, zero-shot intent classifier, and chunked ElevenLabs streaming via `POST /api/tts/speak`.
   - `src/backend/voice/router.ts` (300 lines) & `src/backend/voice/kernel.ts` (172 lines): Implements MoneyOS Voice Engine v3.1 router, quota verification (`/api/voice/quota`), API key hot-swapping, and benchmark telemetry (`/api/voice/benchmark`).
   - `src/backend/voice/elevenlabs-tts.ts` (207 lines): Streams `eleven_flash_v2_5` with `optimize_streaming_latency=4` and `mp3_22050_32` format.
   - `src/backend/voice/google-stt.ts` (138 lines): Implements Google Cloud Speech-to-Text v1 and Gemini 1.5 Flash audio transcription fallback.
   - `src/frontend/voice/VoiceEngineKernel.ts` (309 lines): Defines sovereign client voice kernel class with generation token barge-in interruption.
   - `src/frontend/utils/soundDesignEngine.ts` (281 lines): Real-time procedural Web Audio synthesis for 4 contextual soundscapes (`vault_hum`, `sigil_shimmer`, `cyber_pulse`, `harmonic_drone`), stereo panning (-0.35 to +0.35), and shimmer reverb.
   - `src/frontend/utils/forgeAudio.ts` (161 lines): Procedural synth for Sigil Forge UI chimes, 528Hz Solfeggio ascension chords, and supernova bass drops.
   - `src/frontend/components/FloatingMoneyOSWindow.tsx` (1409 lines) & `src/frontend/pages/MoneyOSPage.tsx` (752 lines): Two-way continuous voice conversation UI with barge-in interruption and auto-silence debouncing.
2. **Defects & Architectural Gaps Observed**:
   - `src/backend/server.ts` does not instantiate or mount a WebSocket server (`ws`), despite Requirement R2 and Acceptance Criteria specifying a Voice WebSocket endpoint.
   - Duplicate TTS endpoints exist (`/api/tts/speak` vs `/api/voice/tts`), causing component fragmentation.
   - Streaming fetch calls in frontend components lack `AbortController` signal cancellation during barge-in interruptions.

---

### 2. Logic Chain
1. **TTS Streaming**: The system streams audio chunk-by-chunk directly from ElevenLabs using HTTP chunked transfer (`Transfer-Encoding: chunked`). The latency optimization tier (`4`) and format (`mp3_22050_32`) achieve minimal TTFB.
2. **Persona & Emotion Modulation**: Base personas provide stable baselines, while sentiment and consecutive conversation turns trigger dynamic fusions and emotional stability/style/pace modifications.
3. **Barge-In Safety**: A monotonic integer generation token (`currentSpeechGenerationRef`) increments on every user speech event or interruption. When responses resolve asynchronously, if `thisGen !== currentSpeechGenerationRef`, the audio payload is discarded.
4. **VAD & Feedback Prevention**: Continuous Web Speech API with a 950ms silence debounce timer automatically flushes user speech. Self-audio is suppressed by aborting mic listening or ignoring interim inputs while the AI is speaking.
5. **WebSocket Protocol Requirement**: Although chunked HTTP streaming currently handles voice output, real-time duplex streaming with low-overhead PCM audio chunks requires a dedicated WebSocket server (`/ws/voice`) with defined JSON frame signaling and reconnect backoff policies.

---

### 3. Caveats
- No changes to source code were made during this audit (strictly read-only discovery per Spec Miner role).
- ElevenLabs API key and Google Cloud Speech keys require valid credentials in `.env` for live upstream synthesis; fallback to browser native `SpeechSynthesis` is verified to operate when keys are absent or quotas are exhausted.

---

### 4. Conclusion
Requirement R2's voice engine, persona fusion system, soundscape DSP, client VAD, and barge-in lifecycle are feature-rich and architecturally mature. The primary implementation tasks required for full hardening are:
1. Provisioning the Voice WebSocket endpoint in `src/backend/server.ts` with heartbeat and reconnect policies.
2. Unifying the backend TTS routes (`/api/tts/speak` and `/api/voice/tts`).
3. Adding `AbortController` cancellation to client-side audio fetch requests during barge-in.

---

### 5. Verification Method
1. **Inspect Survey Report**:
   `view_file` on `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\spec_miner_survey_2\survey_report.md`.
2. **Typecheck Backend & Frontend**:
   ```bash
   npx tsc --noEmit
   npx tsc -p tsconfig.server.json --noEmit
   ```
3. **REST Endpoints Probe**:
   - `GET http://localhost:3000/api/tts/personas`
   - `GET http://localhost:3000/api/voice/quota`
   - `GET http://localhost:3000/api/voice/benchmark`
