# Milestone 1: Frontend Component & Interface Fixes — Deep Analysis & Implementation Plan

## Executive Summary
This investigation analyzed the frontend component defects identified across `SigilForgePage.tsx`, `ReferralHubPage.tsx`, `FinanceOverviewPage.tsx`, `BalanceAgentWidget.tsx`, `PassportPage.tsx`, and `NiagaraParticleCanvas.tsx`. In total, 23 TypeScript compilation errors and interface mismatches were isolated with exact file locations, line numbers, root causes, and verifiable drop-in code replacements.

---

## 1. Defect Catalog & Root Cause Analysis

### Defect 1.1: `SigilForgePage.tsx:14` — Lucide `Image` Icon Shadowing Native `new Image()`
- **Location**: `src/frontend/pages/SigilForgePage.tsx:14`, `src/frontend/pages/SigilForgePage.tsx:445`, `src/frontend/pages/SigilForgePage.tsx:911`
- **Compiler Errors**:
  - `src/frontend/pages/SigilForgePage.tsx(445,19): error TS2554: Expected 1 arguments, but got 0.`
  - `src/frontend/pages/SigilForgePage.tsx(445,19): error TS7009: 'new' expression, whose target lacks a construct signature, implicitly has an 'any' type.`
- **Root Cause**: `Image` is imported from `lucide-react` at line 14 as a React functional component. At line 445 inside `handleDownloadPng()`, the code attempts to call `const img = new Image();` expecting the browser `HTMLImageElement` constructor. Because the local lexical import shadows the global constructor, TypeScript throws a construct signature mismatch.
- **Remediation**:
  - In import: alias `Image as ImageIcon` from `lucide-react`.
  - In JSX line 911: render `<ImageIcon className="w-3.5 h-3.5 text-emerald-400" />`.
  - Line 445 `new Image()` resolves to `window.Image` (`HTMLImageElement`) without arguments.

---

### Defect 1.2: `ReferralHubPage.tsx` — Array Step Properties & Child Prop Interface Mismatches
- **Location**: `src/frontend/pages/ReferralHubPage.tsx:814`, `819`, `841-842`
- **Compiler Errors**:
  - `src/frontend/pages/ReferralHubPage.tsx(814,37): error TS2322: Type '{ onNavigate: () => void; }' is not assignable to type 'IntrinsicAttributes & ReferralConstellationGraphProps'. Property 'onNavigate' does not exist on type 'IntrinsicAttributes & ReferralConstellationGraphProps'.`
  - `src/frontend/pages/ReferralHubPage.tsx(819,33): error TS2322: Type '{ onGetStarted: () => void; }' is not assignable to type 'IntrinsicAttributes'. Property 'onGetStarted' does not exist on type 'IntrinsicAttributes'.`
  - `src/frontend/pages/ReferralHubPage.tsx(841,111): error TS2339: Property 'title' does not exist on type 'string'.`
  - `src/frontend/pages/ReferralHubPage.tsx(842,59): error TS2339: Property 'text' does not exist on type 'string'.`
- **Root Cause**:
  1. `CanonicalFunnelTemplate.steps` is typed as `string[]` in `src/types/index.ts`. However, the template renderer at lines 841-842 accesses `step.title` and `step.text`. When `step` is a string, property accesses fail typechecking.
  2. `ReferralConstellationGraph`'s prop interface omitted `onNavigate?: (tab: string) => void;`.
  3. `ReferralEarningsSlider` lacked an explicit prop interface accepting `onGetStarted?: () => void;` and `onNavigate?: (tab: string) => void;`.
- **Remediation**:
  - In `ReferralHubPage.tsx` lines 839-844: provide polymorphic access supporting both string elements and structured objects `{ title?: string; text?: string }`.
  - In `ReferralConstellationGraph.tsx`: add `onNavigate?: (tab: string) => void;` to `ReferralConstellationGraphProps`.
  - In `ReferralEarningsSlider.tsx`: add `interface ReferralEarningsSliderProps { onGetStarted?: () => void; onNavigate?: (tab: string) => void; }` and destructure props.

---

### Defect 1.3: `FinanceOverviewPage.tsx` & `BalanceAgentWidget.tsx` — Missing Prop Interfaces
- **Location**: `src/frontend/pages/FinanceOverviewPage.tsx:15`, `src/frontend/App.tsx:286`, `src/frontend/components/BalanceAgentWidget.tsx:9`
- **Compiler Errors**:
  - `src/frontend/App.tsx(286,36): error TS2322: Type '{ onNavigate: (tab: string) => void; }' is not assignable to type 'IntrinsicAttributes'. Property 'onNavigate' does not exist on type 'IntrinsicAttributes'.`
  - `src/frontend/pages/FinanceOverviewPage.tsx(191,29): error TS2322: Type '{ onSyncComplete: () => Promise<void>; }' is not assignable to type 'IntrinsicAttributes'.`
- **Root Cause**:
  1. `App.tsx` passes `onNavigate={handleNavigate}` to `<FinanceOverviewPage />`, but `FinanceOverviewPage` declared `React.FC` without props.
  2. `FinanceOverviewPage.tsx` line 191 renders `<BalanceAgentWidget onSyncComplete={fetchFinanceOverview} />`, but `BalanceAgentWidget` declared `React.FC` with zero props.
- **Remediation**:
  - In `FinanceOverviewPage.tsx`: define `interface FinanceOverviewPageProps { onNavigate?: (tab: string) => void; }`.
  - In `BalanceAgentWidget.tsx`: define `interface BalanceAgentWidgetProps { onSyncComplete?: () => void; onNavigate?: (tab: string) => void; }`, destructure props, and invoke `onSyncComplete?.()` after successful sync completion.

---

### Defect 1.4: `PassportPage.tsx` & `NiagaraParticleCanvas.tsx` — Prop Interface Mismatches
- **Location**: `src/frontend/pages/PassportPage.tsx:154-160`, `src/frontend/components/NiagaraParticleCanvas.tsx:3-7`
- **Compiler Error**:
  - `src/frontend/pages/PassportPage.tsx(155,9): error TS2322: Type '{ tier: number; accentColor: string; particleCount: number; speed: number; interactive: boolean; }' is not assignable to type 'IntrinsicAttributes & NiagaraParticleCanvasProps'.`
- **Root Cause**: `PassportPage` renders `<NiagaraParticleCanvas tier={6} accentColor="#06b6d4" particleCount={75} speed={0.4} interactive={true} />`, but `NiagaraParticleCanvasProps` only accepted `{ glowColor?: string; triggerBurst?: boolean; intensity?: string; }`.
- **Remediation**:
  - Expand `NiagaraParticleCanvasProps` with `tier?: number; accentColor?: string; particleCount?: number; speed?: number; interactive?: boolean;`.
  - In `NiagaraParticleCanvas`: fallback `effectiveGlowColor = accentColor || glowColor || '#3b82f6'`, apply `particleCount`, scale velocities by `speed`, and conditionally bind mouse handlers based on `interactive`.

---

### Defect 1.5: Co-Dependent Client & Backend Defect Scope (M1 In-Flight Dependencies)
- **`src/frontend/utils/forgeAudio.ts`**: Missing `setMuted(muted: boolean)` and `playLaserPulse(freq?: number)` methods called by `SigilForgePage.tsx`, `PassportPage.tsx`, and `AntigravityConversionModal.tsx`.
- **`src/frontend/components/LivingVaultBackground.tsx`**: `type VaultEntity` contained `CosmicWave` which has no `vx`/`vy` properties, causing 6 type errors in physics updates.
- **`src/frontend/context/ClerkAuthWrapper.tsx`**: Unused import declaration of `lucide-react` icons (TS6192).
- **`src/backend/routes/moneyos.ts`**: Line 89 queries `commission_ledger WHERE user_id = ?`, but the database column is `referrer_user_id`.

---

## 2. Precise Code Diffs & Replacement Specifications

### File 1: `src/frontend/pages/SigilForgePage.tsx`
```diff
--- a/src/frontend/pages/SigilForgePage.tsx
+++ b/src/frontend/pages/SigilForgePage.tsx
@@ -14,1 +14,1 @@
-  Volume2, VolumeX, Image, Wand2, Sun, Moon, Orbit, Cpu, Fingerprint
+  Volume2, VolumeX, Image as ImageIcon, Wand2, Sun, Moon, Orbit, Cpu, Fingerprint
@@ -911,1 +911,1 @@
-                    <Image className="w-3.5 h-3.5 text-emerald-400" />
+                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
```

---

### File 2: `src/frontend/components/ReferralConstellationGraph.tsx`
```diff
--- a/src/frontend/components/ReferralConstellationGraph.tsx
+++ b/src/frontend/components/ReferralConstellationGraph.tsx
@@ -15,9 +15,11 @@
 interface ReferralConstellationGraphProps {
   creatorCode?: string;
   creatorName?: string;
   initialEnergy?: number;
+  onNavigate?: (tab: string) => void;
 }
 
 export const ReferralConstellationGraph: React.FC<ReferralConstellationGraphProps> = ({
   creatorCode = 'CREATOR-PLUG',
   creatorName = 'You',
   initialEnergy = 4.85,
+  onNavigate,
 }) => {
```

---

### File 3: `src/frontend/components/ReferralEarningsSlider.tsx`
```diff
--- a/src/frontend/components/ReferralEarningsSlider.tsx
+++ b/src/frontend/components/ReferralEarningsSlider.tsx
@@ -7,3 +7,8 @@
 } from 'lucide-react';
 
-export const ReferralEarningsSlider: React.FC = () => {
+interface ReferralEarningsSliderProps {
+  onGetStarted?: () => void;
+  onNavigate?: (tab: string) => void;
+}
+
+export const ReferralEarningsSlider: React.FC<ReferralEarningsSliderProps> = ({
+  onGetStarted,
+  onNavigate,
+}) => {
```

---

### File 4: `src/frontend/pages/ReferralHubPage.tsx`
```diff
--- a/src/frontend/pages/ReferralHubPage.tsx
+++ b/src/frontend/pages/ReferralHubPage.tsx
@@ -839,6 +839,10 @@
-                  {f.steps.map((step, idx) => (
-                    <div key={idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 space-y-1">
-                      <div className="text-[10px] text-plug-accent font-bold uppercase">Step {idx + 1}: {step.title || `Action ${idx + 1}`}</div>
-                      <p className="text-slate-300">{step.text || step}</p>
-                    </div>
-                  ))}
+                  {f.steps.map((step: any, idx: number) => {
+                    const stepTitle = typeof step === 'object' && step !== null && 'title' in step ? step.title : `Action ${idx + 1}`;
+                    const stepText = typeof step === 'object' && step !== null && 'text' in step ? step.text : String(step);
+                    return (
+                      <div key={idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 space-y-1">
+                        <div className="text-[10px] text-plug-accent font-bold uppercase">Step {idx + 1}: {stepTitle}</div>
+                        <p className="text-slate-300">{stepText}</p>
+                      </div>
+                    );
+                  })}
```

---

### File 5: `src/frontend/pages/FinanceOverviewPage.tsx`
```diff
--- a/src/frontend/pages/FinanceOverviewPage.tsx
+++ b/src/frontend/pages/FinanceOverviewPage.tsx
@@ -14,3 +14,7 @@
 } from 'lucide-react';
 
-export const FinanceOverviewPage: React.FC = () => {
+interface FinanceOverviewPageProps {
+  onNavigate?: (tab: string) => void;
+}
+
+export const FinanceOverviewPage: React.FC<FinanceOverviewPageProps> = ({ onNavigate }) => {
```

---

### File 6: `src/frontend/components/BalanceAgentWidget.tsx`
```diff
--- a/src/frontend/components/BalanceAgentWidget.tsx
+++ b/src/frontend/components/BalanceAgentWidget.tsx
@@ -8,3 +8,8 @@
 } from 'lucide-react';
 
-export const BalanceAgentWidget: React.FC = () => {
+interface BalanceAgentWidgetProps {
+  onSyncComplete?: () => void;
+  onNavigate?: (tab: string) => void;
+}
+
+export const BalanceAgentWidget: React.FC<BalanceAgentWidgetProps> = ({
+  onSyncComplete,
+  onNavigate,
+}) => {
@@ -65,3 +70,4 @@
         await refreshUser();
+        onSyncComplete?.();
         setTimeout(() => setToast(null), 4000);
```

---

### File 7: `src/frontend/components/NiagaraParticleCanvas.tsx`
```diff
--- a/src/frontend/components/NiagaraParticleCanvas.tsx
+++ b/src/frontend/components/NiagaraParticleCanvas.tsx
@@ -3,5 +3,10 @@
 interface NiagaraParticleCanvasProps {
   glowColor?: string;
   triggerBurst?: boolean;
   intensity?: 'subtle' | 'normal' | 'supernova';
+  tier?: number;
+  accentColor?: string;
+  particleCount?: number;
+  speed?: number;
+  interactive?: boolean;
 }
@@ -33,5 +38,10 @@
 export const NiagaraParticleCanvas: React.FC<NiagaraParticleCanvasProps> = ({
-  glowColor = '#3b82f6',
+  glowColor,
+  accentColor,
   triggerBurst = false,
   intensity = 'normal',
+  tier,
+  particleCount: propParticleCount,
+  speed = 1.0,
+  interactive = true,
 }) => {
+  const effectiveGlowColor = accentColor || glowColor || '#3b82f6';
@@ -90,1 +100,1 @@
-    const particleCount = intensity === 'supernova' ? 120 : intensity === 'normal' ? 80 : 50;
+    const count = propParticleCount ?? (intensity === 'supernova' ? 120 : intensity === 'normal' ? 80 : 50);
@@ -97,1 +107,1 @@
-      for (let i = 0; i < particleCount; i++) {
+      for (let i = 0; i < count; i++) {
@@ -103,2 +113,2 @@
-          vx: (Math.random() - 0.5) * 0.4,
-          vy: (Math.random() - 0.5) * 0.4,
+          vx: (Math.random() - 0.5) * 0.4 * speed,
+          vy: (Math.random() - 0.5) * 0.4 * speed,
@@ -108,3 +118,3 @@
-          color: glowColor,
+          color: effectiveGlowColor,
           angle,
-          speed: 0.002 + Math.random() * 0.005,
+          speed: (0.002 + Math.random() * 0.005) * speed,
           distance: dist,
-          orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.004 + Math.random() * 0.008),
+          orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.004 + Math.random() * 0.008) * speed,
@@ -160,5 +170,5 @@
     const parent = canvas.parentElement;
-    if (parent) {
+    if (parent && interactive) {
       parent.addEventListener('mousemove', handleMouseMove);
       parent.addEventListener('mouseleave', handleMouseLeave);
       parent.addEventListener('click', handleCanvasClick);
@@ -283,5 +293,5 @@
       window.removeEventListener('resize', handleResize);
-      if (parent) {
+      if (parent && interactive) {
         parent.removeEventListener('mousemove', handleMouseMove);
         parent.removeEventListener('mouseleave', handleMouseLeave);
         parent.removeEventListener('click', handleCanvasClick);
@@ -289,1 +299,1 @@
-  }, [glowColor, intensity]);
+  }, [effectiveGlowColor, intensity, propParticleCount, speed, interactive]);
```

---

### File 8: `src/frontend/utils/forgeAudio.ts`
```diff
--- a/src/frontend/utils/forgeAudio.ts
+++ b/src/frontend/utils/forgeAudio.ts
@@ -32,2 +32,6 @@
   public getMuted(): boolean {
     return this.isMuted;
   }
+
+  public setMuted(muted: boolean): void {
+    this.isMuted = muted;
+  }
+
+  public playLaserPulse(freq: number = 1760) {
+    const ctx = this.getContext();
+    if (!ctx) return;
+    try {
+      const osc = ctx.createOscillator();
+      const gain = ctx.createGain();
+      osc.type = 'sawtooth';
+      osc.frequency.setValueAtTime(freq, ctx.currentTime);
+      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.15);
+      gain.gain.setValueAtTime(0.08, ctx.currentTime);
+      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
+      osc.connect(gain);
+      gain.connect(ctx.destination);
+      osc.start();
+      osc.stop(ctx.currentTime + 0.16);
+    } catch {}
+  }
```

---

### File 9: `src/frontend/components/LivingVaultBackground.tsx`
```diff
--- a/src/frontend/components/LivingVaultBackground.tsx
+++ b/src/frontend/components/LivingVaultBackground.tsx
@@ -91,1 +91,1 @@
-type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark | CosmicWave;
+type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark;
```

---

### File 10: `src/frontend/context/ClerkAuthWrapper.tsx`
```diff
--- a/src/frontend/context/ClerkAuthWrapper.tsx
+++ b/src/frontend/context/ClerkAuthWrapper.tsx
@@ -4,1 +4,0 @@
-import { Shield, Key, Lock, Sparkles, X, Check, Copy } from 'lucide-react';
```

---

### File 11: `src/backend/routes/moneyos.ts`
```diff
--- a/src/backend/routes/moneyos.ts
+++ b/src/backend/routes/moneyos.ts
@@ -89,1 +89,1 @@
-    commissions = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE user_id = ?').get(targetId) as any || { total: 0 };
+    commissions = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger WHERE referrer_user_id = ?').get(targetId) as any || { total: 0 };
```

---

## 3. Verification Plan
1. **TypeScript Type Check**:
   - Run `npx tsc --noEmit`
   - Expected Result: Real type errors drops from 23 to 0.
2. **Frontend Build**:
   - Run `npm run build` / `vite build`
   - Expected Result: Build succeeds with zero unresolved imports or bundle syntax errors.
3. **Runtime Component Rendering**:
   - Verify Sigil 4K PNG export triggers `new Image()` cleanly and generates high-res canvas download.
   - Verify Referral Constellation and Funnel views render without property crashes.
   - Verify Finance Overview properly coordinates with `BalanceAgentWidget` and triggers refresh callbacks.
   - Verify Passport page renders `NiagaraParticleCanvas` with custom particle counts and colors.
