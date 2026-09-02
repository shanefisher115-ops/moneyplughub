# Handoff Report: Explorer 2 (Milestone 1 — Web Audio & Visual Engine Fixes)

## 1. Observation

### Observation 1.1: Web Audio Missing Methods & Unused Property in `forgeAudio.ts`
- **File**: `src/frontend/utils/forgeAudio.ts`
- **Callers**:
  - `src/frontend/pages/PassportPage.tsx:191`: `forgeAudio.setMuted(nextMuted);`
  - `src/frontend/pages/PassportPage.tsx:249`: `forgeAudio.playLaserPulse();`
  - `src/frontend/pages/SigilForgePage.tsx:340`: `forgeAudio.playLaserPulse();`
  - `src/frontend/pages/SigilForgePage.tsx:437`: `forgeAudio.playLaserPulse();`
  - `src/frontend/components/AntigravityConversionModal.tsx:121`: `forgeAudio.playLaserPulse();`
- **Verbatim Compiler Errors** (from `npx tsc --noEmit`):
  - `src/frontend/pages/PassportPage.tsx(191,26): error TS2551: Property 'setMuted' does not exist on type 'ForgeAudioEngine'. Did you mean 'getMuted'?`
  - `src/frontend/pages/PassportPage.tsx(249,36): error TS2339: Property 'playLaserPulse' does not exist on type 'ForgeAudioEngine'.`
  - `src/frontend/pages/SigilForgePage.tsx(340,16): error TS2339: Property 'playLaserPulse' does not exist on type 'ForgeAudioEngine'.`
  - `src/frontend/pages/SigilForgePage.tsx(437,16): error TS2339: Property 'playLaserPulse' does not exist on type 'ForgeAudioEngine'.`
  - `src/frontend/components/AntigravityConversionModal.tsx(121,16): error TS2339: Property 'playLaserPulse' does not exist on type 'ForgeAudioEngine'.`
  - `src/frontend/utils/forgeAudio.ts(9,11): error TS6133: 'ambientGain' is declared but its value is never read.`

### Observation 1.2: Physics Update Loop Type Error in `LivingVaultBackground.tsx`
- **File**: `src/frontend/components/LivingVaultBackground.tsx`
- **Current Type Definition**:
  - Lines 81-91: `type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark | CosmicWave;`
- **Physics Loop Usage**:
  - Lines 423-458: Accesses `ent.vx` and `ent.vy` in `entities.forEach((ent) => { ... })`.
- **Verbatim Compiler Errors** (from `npx tsc --noEmit`):
  - `src/frontend/components/LivingVaultBackground.tsx(432,15): error TS2339: Property 'vx' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(433,15): error TS2339: Property 'vy' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(443,15): error TS2339: Property 'vx' does not exist on type 'LivingBill | LivingCoin | LivingBullion | LivingDiamond | CosmicWave'.`
  - `src/frontend/components/LivingVaultBackground.tsx(444,15): error TS2339: Property 'vy' does not exist on type 'LivingBill | LivingCoin | LivingBullion | LivingDiamond | CosmicWave'.`
  - `src/frontend/components/LivingVaultBackground.tsx(448,13): error TS2339: Property 'vx' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(449,13): error TS2339: Property 'vy' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(451,22): error TS2339: Property 'vx' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(452,22): error TS2339: Property 'vy' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(2,26): error TS6133: 'WealthVaultTier' is declared but its value is never read.`
  - `src/frontend/components/LivingVaultBackground.tsx(95,29): error TS6133: 'netWorthUsd' is declared but its value is never read.`
  - `src/frontend/components/LivingVaultBackground.tsx(95,42): error TS6133: 'totalEarningsUsd' is declared but its value is never read.`
  - `src/frontend/components/LivingVaultBackground.tsx(96,9): error TS6133: 'primaryAccent' is declared but its value is never read.`

### Observation 1.3: Property Mismatch in `NiagaraParticleCanvas.tsx`
- **File**: `src/frontend/components/NiagaraParticleCanvas.tsx`
- **Caller**: `src/frontend/pages/PassportPage.tsx:154-160`:
  ```tsx
  <NiagaraParticleCanvas
    tier={6}
    accentColor="#06b6d4"
    particleCount={75}
    speed={0.4}
    interactive={true}
  />
  ```
- **Verbatim Compiler Errors** (from `npx tsc --noEmit`):
  - `src/frontend/pages/PassportPage.tsx(155,9): error TS2322: Type '{ tier: number; accentColor: string; particleCount: number; speed: number; interactive: boolean; }' is not assignable to type 'IntrinsicAttributes & NiagaraParticleCanvasProps'.`
  - `Property 'tier' does not exist on type 'IntrinsicAttributes & NiagaraParticleCanvasProps'.`

---

## 2. Logic Chain

1. **Audio Synthesis Architecture**:
   - Referring to Observation 1.1, `PassportPage.tsx` directly manipulates mute state via `setMuted(boolean)` and triggers audio feedback on sigil inspection via `playLaserPulse()`.
   - Adding `setMuted(muted: boolean): void` updates `this.isMuted`.
   - Adding `playLaserPulse(startFreq = 1800, duration = 0.22)` instantiates a cybernetic sawtooth sweep (1800 Hz down to 120 Hz) with an exponential gain decay (0.12 to 0.0001) over 220ms.
   - Removing the unused private property `ambientGain` resolves `TS6133`.

2. **LivingVault Entity Lifecycle & Particle Physics**:
   - Referring to Observation 1.2, `shockwavesRef.current` independently manages all `CosmicWave` instances with a dedicated expansion and fading loop (lines 395-420).
   - In contrast, the `entities` array is populated exclusively in `initEntities()` with physical particles (`LivingBill`, `LivingCoin`, `LivingBullion`, `LivingDiamond`, `LivingSpark`).
   - Every physical entity contains `x, y, vx, vy, alpha`. Redefining `type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark;` accurately aligns TypeScript types with the runtime data model and resolves all 8 `TS2339` errors.
   - Cleaning up unused imports (`WealthVaultTier`, `useGenerativeDesign`) and unused destructured variables (`netWorthUsd`, `totalEarningsUsd`, `primaryAccent`) clears all `TS6133` errors.

3. **Niagara Particle Props Interoperability**:
   - Referring to Observation 1.3, `NiagaraParticleCanvas` is used in multiple contexts (`PassportPage.tsx`, `SigilForgePage.tsx`).
   - `PassportPage.tsx` supplies `tier`, `accentColor`, `particleCount`, `speed`, and `interactive`.
   - Updating `NiagaraParticleCanvasProps` to include these optional fields and wiring them into `NiagaraParticleCanvas` (calculating `effectiveColor = accentColor || glowColor`, `speedFactor = speed ?? 1.0`, `effectiveParticleCount = particleCount ?? tierScaling ?? intensityCount`, and honoring `interactive` for mouse listeners) resolves `TS2322` and enables custom speed, density, and interactivity.

---

## 3. Caveats

1. **Scope Boundary**: This investigation focuses strictly on the Web Audio and visual/canvas defects assigned to Explorer 2 for Milestone 1. Other unused imports in other pages (e.g. `ReferralHubPage.tsx`, `SyndicatesPage.tsx`, `SystemStatusPage.tsx`) are being addressed in parallel by Explorer 1.
2. **Web Audio Context Autoplay Policy**: Browsers require user interaction before the Web Audio `AudioContext` can produce sound. `ForgeAudioEngine.getContext()` already checks `if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();`, which handles user activation cleanly.
3. **Canvas Performance**: Particle counts are capped gracefully (max 120 particles) to maintain 60 FPS across mobile and low-powered GPU hardware.

---

## 4. Conclusion

All three visual and audio defects have been investigated and diagnosed to their root causes. Exact code diffs and implementation plans have been formulated and documented in:
`C:\Users\Shane\.gemini\antigravity\scratch\moneyplughub\.agents\explorer_m1_2\analysis.md`

Applying these proposed diffs will:
- Eliminate `TS2551`, `TS2339`, `TS6133` on `src/frontend/utils/forgeAudio.ts` and its callers.
- Eliminate all 8 `TS2339` errors and 4 `TS6133` errors on `src/frontend/components/LivingVaultBackground.tsx`.
- Eliminate `TS2322` on `src/frontend/components/NiagaraParticleCanvas.tsx` and enable full multi-tier interactive particle rendering in `PassportPage.tsx`.

---

## 5. Verification Method

1. **TypeScript Typecheck Command**:
   ```bash
   npx tsc --noEmit
   ```
   **Expected Result**: Zero type errors reported against `forgeAudio.ts`, `LivingVaultBackground.tsx`, `NiagaraParticleCanvas.tsx`, and `PassportPage.tsx`.

2. **Inspection Targets**:
   - `src/frontend/utils/forgeAudio.ts`: Confirm `setMuted()` and `playLaserPulse()` exist on `ForgeAudioEngine`.
   - `src/frontend/components/LivingVaultBackground.tsx`: Confirm `VaultEntity` does not include `CosmicWave` and physics update loop compiles cleanly.
   - `src/frontend/components/NiagaraParticleCanvas.tsx`: Confirm `NiagaraParticleCanvasProps` includes `tier`, `accentColor`, `particleCount`, `speed`, `interactive`.

3. **Runtime Invalidation Condition**:
   If `PassportPage.tsx` or `SigilForgePage.tsx` throw runtime exceptions on `forgeAudio.playLaserPulse()` or `forgeAudio.setMuted()`, or if the Niagara canvas fails to render particles at the specified speed/accent color, the fix is invalid.
