# Project: Creator Money OS (MoneyPlugHub)

## Architecture
Creator Money OS (MoneyPlugHub) is a full-stack high-performance financial command platform with AI assistant voice integration, 4-tier subscription billing, deterministic cryptographic sigil generation, referral growth engines, and gamification economy.

- **Frontend**: React 18, Vite 5, TailwindCSS, Framer Motion, Lucide Icons, Web Audio API DSP synthesis, Niagara particle engine.
- **Backend**: Node.js, Express, TypeScript (`tsx`), `node:sqlite` (SQLite in WAL mode), WebSocket server (`ws`), ElevenLabs TTS Flash v2.5 streaming, Google STT / Gemini Flash audio fallbacks.
- **Database**: SQLite with `PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`, atomic transaction management via `runInTransaction()`.
- **Security & Compliance**: Isolated environment configurations (`config.ts`), parameterized queries, JWT/Clerk session handling, automated FTC 16 CFR Part 255 disclosure overlays.

## Code Layout
- `src/frontend/`: React components, pages, context, and Web Audio engines
  - `src/frontend/components/`: UI components (LivingVaultBackground, FloatingMoneyOSWindow, NiagaraParticleCanvas, etc.)
  - `src/frontend/pages/`: 37 application pages (MoneyOSPage, SigilForgePage, ReferralHubPage, FinanceOverviewPage, PassportPage, etc.)
  - `src/frontend/utils/`: Audio DSP engines (`soundDesignEngine.ts`, `forgeAudio.ts`), API clients
  - `src/frontend/voice/`: Client voice kernel (`VoiceEngineKernel.ts`)
- `src/backend/`: Server, database, routes, voice services
  - `src/backend/server.ts`: Express application entry point & WebSocket server
  - `src/backend/db.ts`: SQLite database connection, schema DDL, seed data, and transaction runner
  - `src/backend/config.ts`: Environment variable isolation and defaults
  - `src/backend/routes/`: 34 REST route modules (billing, sigil, referrals, xpEconomy, gamification, loot, growth, generate, moneyos, tts, etc.)
  - `src/backend/voice/`: Voice kernel, ElevenLabs streaming client, Google STT, persona configs
- `src/types/`: Shared TypeScript interfaces and type definitions
- `tests/e2e/`: E2E test suites (Tiers 1-4) and test runner
- `tests/stress/`: Tier 5 Adversarial and stress test suites

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| 1 | Client Type Integrity & Fixes | Resolve 23 type errors across 8 files and clean unused imports | M1 | survey_1 | DONE |
| 2 | Web Audio Synth Methods | Implement missing `playLaserPulse()` & `setMuted()` in `forgeAudio.ts` | M1 | survey_1 | DONE |
| 3 | LivingVault Physics Safety | Fix `CosmicWave` entity type handling in `LivingVaultBackground.tsx` | M1 | survey_1 | DONE |
| 4 | MoneyOS Telemetry Queries | Fix `commission_ledger` SQL query in `moneyos.ts` | M1 | survey_1 | DONE |
| 5 | Voice WebSocket Server | Mount `/ws/voice` WebSocket server with frame protocols in `server.ts` | M2 | survey_2 | DONE |
| 6 | ElevenLabs TTS Streaming | Low-latency Flash v2.5 chunked streaming with 10 personas & 5 fusions | M2 | survey_2 | DONE |
| 7 | Barge-In & VAD Lifecycle | Generation token locking, 950ms silence debounce, AbortController cancel | M2 | survey_2 | DONE |
| 8 | Soundscape DSP Synthesis | 4 procedural soundscapes, stereo panning, shimmer reverb in Web Audio | M2 | survey_2 | DONE |
| 9 | 4-Tier Subscription Billing | Free, Creator ($29), Pro ($149), Enterprise ($499) plan processing | M3 | survey_3 | DONE |
| 10 | Promo Code Engine | `FOUNDING50` (100% off), `VIPCREATOR` (50%), `EARLYBIRD` (20%) validation | M3 | survey_3 | DONE |
| 11 | SQLite WAL Transaction Engine | Atomic ACID transaction handling with `runInTransaction()` | M3 | survey_3 | DONE |
| 12 | Deterministic SVG Sigil Forge | SHA-256 vector math across 48 visual components (Aura, Glyph, Ring, Crest) | M3 | survey_3 | DONE |
| 13 | 30-Day Attribution Tracking | Cookie attribution, AI traffic classifier, 5 commission tiers, fraud check | M3 | survey_3 | DONE |
| 14 | XP Economy & Gamification | 6 Wealth Tiers, 1000 XP = $0.50 conversion, loot gacha, quest verification | M3 | survey_3 | DONE |
| 15 | Security & Auth Isolation | Isolated env config, parameterized SQL, JWT/Clerk fallback sessions | M4 | survey_3 | DONE |
| 16 | FTC 16 CFR Part 255 Overlays | Automated `#ad` & affiliate disclosure overlays on share cards & AI copy | M4 | survey_3 | DONE |
| 17 | Vite Bundle Code-Splitting | Vendor chunk optimization in `vite.config.ts` (chunks < 500 kB) | M5 | survey_1 | DONE |
| 18 | Production Build & Boot Verification | Full `tsc` and `vite build` with clean service boot & endpoint checks | M5 | survey_1 | DONE |
| 19 | 4-Tier E2E Test Suite | Opaque-box requirement-driven test suite with test runner (127 tests) | E2E_TRACK | survey_1-3 | DONE |
| 20 | Tier 5 Adversarial Hardening | 20 dedicated chaos/stress tests + Forensic Integrity Audit (CLEAN) | FINAL_M | survey_1-3 | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| E2E | E2E Testing Track | Design 4-tier opaque-box test suite & runner, publish TEST_READY.md | none | DONE |
| M1 | Full-Stack Component Audit & Defect Fixes | Fix 23 type errors, unused imports, forgeAudio methods, LivingVault, moneyos SQL | none | DONE |
| M2 | Voice Engine & WebSocket Hardening | Provision /ws/voice WS endpoint, frame signaling, unify TTS routes, AbortController | M1 | DONE |
| M3 | Billing, Sigils, Referrals & Gamification | Seed FOUNDING50, fix tier assignment, fix sigil transaction columns, verify math | M1 | DONE |
| M4 | Security Hardening & FTC Compliance | Env isolation, sanitization, rate limits, FTC 16 CFR Part 255 share card/AI overlays | M1 | DONE |
| M5 | Production Build & Bundle Optimization | Configure Vite manualChunks, verify full tsc & vite build, container boot | M1, M2, M3, M4 | DONE |
| FINAL | E2E Verification & Adversarial Hardening | Phase 1: 100% E2E tests pass; Phase 2: Tier 5 adversarial hardening + CLEAN audit | M5, E2E | DONE |
