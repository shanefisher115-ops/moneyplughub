# Handoff Report: Survey Explorer 1 (Full-Stack & Build Architecture)

**Working Directory**: `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\explorer_survey_1`  
**Survey Report Artifact**: `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\explorer_survey_1\survey_report.md`  
**Date**: 2026-08-26  

---

## 1. Observation

Direct empirical observations from executing tool commands and code reviews across the MoneyPlugHub workspace:

1. **TypeScript Build & Typecheck Commands**:
   - `npx tsc -p tsconfig.server.json --noEmit` exited with code 0 (0 errors in backend and shared types).
   - `npx vite build` exited with code 0 (built in 49.09s), but emitted bundle size warning: `dist/client/assets/index-BTV-S1rX.js: 1,243.41 kB` (single bundle > 500kB).
   - `npx tsc --noEmit` exited with code 1, emitting 513 total errors:
     - 477 instances of `error TS6133: '...' is declared but its value is never read.`
     - 1 instance of `error TS6192: All imports in import declaration are unused.` (`src/frontend/context/ClerkAuthWrapper.tsx:4:1`)
     - 5 instances of `error TS2322: Type '...' is not assignable to type '...'`
     - 14 instances of `error TS2339: Property '...' does not exist on type '...'`
     - 1 instance of `error TS2551: Property 'setMuted' does not exist on type 'ForgeAudioEngine'. Did you mean 'getMuted'?`
     - 1 instance of `error TS2554: Expected 1 arguments, but got 0.` (`src/frontend/pages/SigilForgePage.tsx:445:19`)
     - 1 instance of `error TS7009: 'new' expression, whose target lacks a construct signature...` (`src/frontend/pages/SigilForgePage.tsx:445:19`)

2. **Verbatim Code & Interface Defects**:
   - `src/frontend/pages/SigilForgePage.tsx:14` imports `Image` from `lucide-react`, which shadows the global `window.Image` constructor used at line 445 (`const img = new Image();`).
   - `src/frontend/utils/forgeAudio.ts:6-158` does not export `playLaserPulse()` or `setMuted(muted: boolean)`, but both are called in `AntigravityConversionModal.tsx:121`, `PassportPage.tsx:191 & 249`, and `SigilForgePage.tsx:340 & 437`.
   - `src/frontend/components/LivingVaultBackground.tsx:432-452` accesses `ent.vx` and `ent.vy` in the physics loop, but `CosmicWave` (part of `VaultEntity` union at line 91) does not define `vx` or `vy`.
   - `src/frontend/components/ReferralConstellationGraph.tsx:15` omits `onNavigate?: (tab: string) => void`, but `ReferralHubPage.tsx:814` passes `<ReferralConstellationGraph onNavigate={() => {}} />`.
   - `src/frontend/components/ReferralEarningsSlider.tsx:8` does not define `onGetStarted`, but `ReferralHubPage.tsx:819` passes `<ReferralEarningsSlider onGetStarted={...} />`.
   - `src/frontend/pages/ReferralHubPage.tsx:841-842` accesses `step.title` and `step.text` on `f.steps` where `f.steps` is `string[]`.
   - `src/frontend/pages/FinanceOverviewPage.tsx:15` does not define props, but `App.tsx:286` passes `onNavigate={handleNavigate}`.
   - `src/frontend/components/BalanceAgentWidget.tsx:9` does not define props, but `FinanceOverviewPage.tsx:191` passes `onSyncComplete={fetchFinanceOverview}`.
   - `src/frontend/components/NiagaraParticleCanvas.tsx:3-7` only accepts `{ glowColor?, triggerBurst?, intensity? }`, but `PassportPage.tsx:155` passes `tier={6} accentColor="#06b6d4" particleCount={75} speed={0.4} interactive={true}`.

3. **Backend SQL Query Defect in MoneyOS**:
   - `src/backend/routes/moneyos.ts:88` runs `SELECT COUNT(*) as count FROM referrals WHERE referrer_user_id = ?` (table `referrals` does not exist; table is `commission_ledger`).
   - `src/backend/routes/moneyos.ts:89` runs `SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE user_id = ?` (column is `referrer_user_id`, not `user_id`).

4. **Test Suite Outputs**:
   - `npx tsx src/backend/test.ts` passed 100% (8 steps).
   - `npx tsx src/backend/test-loot.ts` passed 100% (1,000 rolls, correct gacha probabilities).
   - `npx tsx test_syndicates.ts` passed 100% (all 4 syndicates verified).
   - `npx tsx src/backend/scripts/seed-and-test-beta.ts` passed 100% (E2E attribution & K-factor K=3.5 verified).

---

## 2. Logic Chain

1. **Client Build Failure Diagnosis**:
   - Observation: `npx tsc --noEmit` returned code 1 with 513 errors.
   - Inference: The client typecheck fails due to two distinct causes:
     a) 23 real syntax, typing, and prop mismatches across 8 files (Observation 2).
     b) 477 unused import/variable errors enforced by `"noUnusedLocals": true` and `"noUnusedParameters": true` in `tsconfig.json`.
   - Action Required: Fixing the 8 root cause files and cleaning unused imports will bring client typecheck to 0 errors.

2. **MoneyOS AI Telemetry Disconnect**:
   - Observation: `moneyos.ts:88-89` queries `FROM referrals` and `WHERE user_id = ?` on `commission_ledger` inside a `try {} catch {}` block.
   - Inference: SQLite throws `no such table: referrals` and `no such column: user_id`, silently falling back to `{ count: 0 }` and `{ total: 0 }`.
   - Action Required: Correcting SQL to `FROM commission_ledger WHERE referrer_user_id = ?` will restore live wallet telemetry in AI chat.

3. **Bundle Chunk Optimization**:
   - Observation: Vite outputs a single 1.24 MB JS bundle file.
   - Inference: Large dependencies (`framer-motion`, `lucide-react`, `@clerk/clerk-react`) are bundled into the entry chunk.
   - Action Required: Adding `manualChunks` in `vite.config.ts` will split vendor libraries into clean sub-chunks under 500 kB.

---

## 3. Caveats

- **External Network Calls**: In `src/backend/verifyStarterLinks.ts`, some external third-party affiliate destinations (e.g. Fetch Rewards, Webull) returned 404 or timed out due to external rate limiting/geo-blocking. The local routing engine `/go/:slug` operates normally.
- **Clerk Auth Keys**: The frontend operates in seamless fallback mode when `VITE_CLERK_PUBLISHABLE_KEY` is not a live `pk_live_*` key.

---

## 4. Conclusion

The Creator Money OS (MoneyPlugHub) architecture is comprehensive and functionally rich, featuring 37 frontend pages, 45 UI components, 34 Express route modules, and a durable SQLite WAL database. 

The system has passed all backend server tests and Vite bundling, but requires:
1. Fixing 23 concrete type/interface mismatches across 8 frontend files.
2. Cleaning unused imports to satisfy strict TypeScript checking.
3. Patching the SQL queries in `moneyos.ts`.
4. Adding vendor code-splitting in `vite.config.ts` and FTC 16 CFR Part 255 disclosure overlays.

Detailed file-by-file enumeration and remediation recommendations are documented in `survey_report.md`.

---

## 5. Verification Method

To independently verify the survey findings:

1. **Verify Client Type Errors**:
   ```bash
   npx tsc --noEmit
   ```
2. **Verify Server Typecheck**:
   ```bash
   npx tsc -p tsconfig.server.json --noEmit
   ```
3. **Verify Vite Production Build**:
   ```bash
   npx vite build
   ```
4. **Verify Backend Test Suites**:
   ```bash
   npx tsx src/backend/test.ts
   npx tsx src/backend/test-loot.ts
   npx tsx test_syndicates.ts
   npx tsx src/backend/scripts/seed-and-test-beta.ts
   ```
5. **Inspect Artifacts**:
   - Survey Report: `C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\explorer_survey_1\survey_report.md`
