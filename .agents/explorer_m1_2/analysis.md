# Milestone 1: Web Audio & Visual Engine Investigation & Fix Plan

## Executive Summary
This investigation analyzes three critical frontend defects in Creator Money OS (`moneyplughub`):
1. Missing Web Audio DSP methods `playLaserPulse()` and `setMuted(muted: boolean)` on `ForgeAudioEngine` in `src/frontend/utils/forgeAudio.ts`, along with unused class field `ambientGain` causing `TS6133`.
2. Physics update loop type mismatch in `src/frontend/components/LivingVaultBackground.tsx`, where `CosmicWave` lacked `vx`/`vy` velocity vectors when included in `VaultEntity` union, causing TypeScript errors `TS2339`, alongside unused imports and hooks.
3. Incomplete props interface in `src/frontend/components/NiagaraParticleCanvas.tsx`, which rejected `tier`, `accentColor`, `particleCount`, `speed`, and `interactive` properties passed by `PassportPage.tsx` (`TS2322`).

---

## 1. Web Audio Synthesizer Analysis (`src/frontend/utils/forgeAudio.ts`)

### Observation
- `src/frontend/pages/PassportPage.tsx:191` invokes `forgeAudio.setMuted(nextMuted)`.
- `src/frontend/pages/PassportPage.tsx:249`, `src/frontend/pages/SigilForgePage.tsx:340, 437`, and `src/frontend/components/AntigravityConversionModal.tsx:121` invoke `forgeAudio.playLaserPulse()`.
- Currently, `ForgeAudioEngine` only defines `toggleMute()` and `getMuted()`. It lacks `setMuted(muted: boolean)` and `playLaserPulse()`.
- `private ambientGain: GainNode | null = null;` on line 9 is declared but never read, triggering `error TS6133: 'ambientGain' is declared but its value is never read`.

### Logic & Sound Design Solution
- **`setMuted(muted: boolean)`**: Explicitly set `this.isMuted = muted;` so components toggling mute via state or props can synchronize with the procedural audio engine.
- **`playLaserPulse(startFreq = 1800, duration = 0.22)`**: Synthesizes a downward exponential frequency sweep (1800 Hz down to 120 Hz) using a `sawtooth` oscillator through an exponential gain decay (0.12 down to 0.0001) over 220ms. This produces a cybernetic laser pulse ideal for sigil transmutation and hologram inspection.
- **Unused Property Removal**: Remove `ambientGain` to satisfy strict `noUnusedLocals` compiler rules.

### Proposed Code Diff (`src/frontend/utils/forgeAudio.ts`)
```typescript
<<<<
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private ambientGain: GainNode | null = null;

  private getContext(): AudioContext | null {
====
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
>>>>
```

```typescript
<<<<
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
====
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
>>>>
```

```typescript
<<<<
  /**
   * Supernova Shockwave Blast (low bass drop)
   */
  public playShockwave() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.6);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch {}
  }
}
====
  /**
   * Supernova Shockwave Blast (low bass drop)
   */
  public playShockwave() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.6);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch {}
  }

  /**
   * High-energy Cybernetic Laser Pulse Sweep
   */
  public playLaserPulse(startFreq: number = 1800, duration: number = 0.22) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + duration);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }
}
>>>>
```

---

## 2. Living Vault Background Physics Safety (`src/frontend/components/LivingVaultBackground.tsx`)

### Observation
- `type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark | CosmicWave;`
- In `LivingVaultBackground.tsx:423-458`, the physics update loop iterates over `entities.forEach((ent) => { ... })` and modifies `ent.vx`, `ent.vy`, `ent.x`, `ent.y`.
- Because `CosmicWave` does not declare `vx` and `vy`, TypeScript produces 8 compilation errors:
  - `src/frontend/components/LivingVaultBackground.tsx(432,15): error TS2339: Property 'vx' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(433,15): error TS2339: Property 'vy' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(443,15): error TS2339: Property 'vx' does not exist on type 'LivingBill | LivingCoin | LivingBullion | LivingDiamond | CosmicWave'.`
  - `src/frontend/components/LivingVaultBackground.tsx(444,15): error TS2339: Property 'vy' does not exist on type 'LivingBill | LivingCoin | LivingBullion | LivingDiamond | CosmicWave'.`
  - `src/frontend/components/LivingVaultBackground.tsx(448,13): error TS2339: Property 'vx' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(449,13): error TS2339: Property 'vy' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(451,22): error TS2339: Property 'vx' does not exist on type 'VaultEntity'.`
  - `src/frontend/components/LivingVaultBackground.tsx(452,22): error TS2339: Property 'vy' does not exist on type 'VaultEntity'.`
- In addition:
  - `WealthVaultTier` is imported but never used (`TS6133`).
  - `netWorthUsd` and `totalEarningsUsd` are destructured from `useLivingVault()` but never used (`TS6133`).
  - `primaryAccent` is destructured from `useGenerativeDesign()` but never used (`TS6133`), and `useGenerativeDesign` is otherwise unneeded in this file.

### Logic Chain
1. `CosmicWave` objects represent expanding radial shockwaves and are stored and animated exclusively in `shockwavesRef.current: CosmicWave[]` (lines 97, 103, 149, 395-420).
2. The `entities` array initialized in `initEntities()` contains exclusively physical currency/gem entities (`LivingBill`, `LivingCoin`, `LivingBullion`, `LivingDiamond`, `LivingSpark`), each having `x, y, vx, vy, alpha`.
3. Defining `type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark;` accurately mirrors runtime architecture, eliminating all `TS2339` type errors without altering runtime physics behavior.
4. Cleaning unused imports and destructured variables ensures clean compilation under `noUnusedLocals`.

### Proposed Code Diff (`src/frontend/components/LivingVaultBackground.tsx`)
```typescript
<<<<
import React, { useEffect, useRef } from 'react';
import { useLivingVault, WealthVaultTier } from '../context/LivingVaultContext';
import { useGenerativeDesign } from '../context/GenerativeDesignContext';
====
import React, { useEffect, useRef } from 'react';
import { useLivingVault } from '../context/LivingVaultContext';
>>>>
```

```typescript
<<<<
type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark | CosmicWave;

export const LivingVaultBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { tier, tierConfig, netWorthUsd, totalEarningsUsd, shockwaveCount } = useLivingVault();
  const { primaryAccent } = useGenerativeDesign();
  const shockwavesRef = useRef<CosmicWave[]>([]);
====
type VaultEntity = LivingBill | LivingCoin | LivingBullion | LivingDiamond | LivingSpark;

export const LivingVaultBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { tier, tierConfig, shockwaveCount } = useLivingVault();
  const shockwavesRef = useRef<CosmicWave[]>([]);
>>>>
```

```typescript
<<<<
      // Blast nearby entities
      entities.forEach((ent) => {
        if (ent.type !== 'wave') {
          const dx = ent.x - clickX;
          const dy = ent.y - clickY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 280) {
            const force = (280 - dist) / 280;
            ent.vx += (dx / dist) * force * 14;
            ent.vy += (dy / dist) * force * 14;
          }
        }
      });
====
      // Blast nearby entities
      entities.forEach((ent) => {
        const dx = ent.x - clickX;
        const dy = ent.y - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 280) {
          const force = (280 - dist) / 280;
          ent.vx += (dx / dist) * force * 14;
          ent.vy += (dy / dist) * force * 14;
        }
      });
>>>>
```

---

## 3. Niagara Particle Canvas Props Extension (`src/frontend/components/NiagaraParticleCanvas.tsx`)

### Observation
- `src/frontend/pages/PassportPage.tsx:154-160` instantiates `NiagaraParticleCanvas` with:
  ```tsx
  <NiagaraParticleCanvas
    tier={6}
    accentColor="#06b6d4"
    particleCount={75}
    speed={0.4}
    interactive={true}
  />
  ```
- `src/frontend/pages/SigilForgePage.tsx:732-736` instantiates `NiagaraParticleCanvas` with:
  ```tsx
  <NiagaraParticleCanvas
    glowColor={activeGlowColor}
    triggerBurst={particleBurst}
    intensity={glowMode}
  />
  ```
- Current interface in `NiagaraParticleCanvas.tsx:3-7` only allows `glowColor`, `triggerBurst`, and `intensity`. This produces `error TS2322: Type '{ tier: number; accentColor: string; particleCount: number; speed: number; interactive: boolean; }' is not assignable to type 'IntrinsicAttributes & NiagaraParticleCanvasProps'`.

### Logic Chain
1. Extend `NiagaraParticleCanvasProps` to support all consumed properties:
   - `glowColor?: string;`
   - `accentColor?: string;` (alias/color override used in Passport and theme contexts)
   - `triggerBurst?: boolean;`
   - `intensity?: 'subtle' | 'normal' | 'supernova';`
   - `tier?: number;` (tier-based density/size scaling)
   - `particleCount?: number;` (explicit particle density override)
   - `speed?: number;` (velocity and orbital angular velocity scaling factor)
   - `interactive?: boolean;` (enables or disables mouse gravity tracking and click shockwaves)
2. Derive runtime constants cleanly:
   - `const effectiveColor = accentColor || glowColor || '#3b82f6';`
   - `const speedFactor = speed !== undefined ? speed : 1.0;`
   - Calculate effective particle count hierarchically: `particleCount ?? (tier ? (tier === 6 ? 120 : tier >= 4 ? 90 : tier >= 2 ? 65 : 45) : (intensity === 'supernova' ? 120 : intensity === 'normal' ? 80 : 50))`.
3. Support `interactive` flag by conditionally attaching event listeners and applying mouse gravity in the animation frame loop.

### Proposed Code Diff (`src/frontend/components/NiagaraParticleCanvas.tsx`)
```typescript
<<<<
interface NiagaraParticleCanvasProps {
  glowColor?: string;
  triggerBurst?: boolean;
  intensity?: 'subtle' | 'normal' | 'supernova';
}
====
export interface NiagaraParticleCanvasProps {
  glowColor?: string;
  accentColor?: string;
  triggerBurst?: boolean;
  intensity?: 'subtle' | 'normal' | 'supernova';
  tier?: number;
  particleCount?: number;
  speed?: number;
  interactive?: boolean;
}
>>>>
```

```typescript
<<<<
export const NiagaraParticleCanvas: React.FC<NiagaraParticleCanvasProps> = ({
  glowColor = '#3b82f6',
  triggerBurst = false,
  intensity = 'normal',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const animFrameIdRef = useRef<number>(0);

  // Trigger shockwave burst when triggerBurst changes to true
  useEffect(() => {
    if (triggerBurst && canvasRef.current) {
      const canvas = canvasRef.current;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      shockwavesRef.current.push({
        x: centerX,
        y: centerY,
        radius: 10,
        maxRadius: Math.max(canvas.width, canvas.height) * 0.7,
        alpha: 1,
        color: glowColor,
      });

      // Scatter nearby particles
      particlesRef.current.forEach((p) => {
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 18 / dist;
        p.vx += (dx / dist) * force * 8;
        p.vy += (dy / dist) * force * 8;
      });
    }
  }, [triggerBurst, glowColor]);
====
export const NiagaraParticleCanvas: React.FC<NiagaraParticleCanvasProps> = ({
  glowColor = '#3b82f6',
  accentColor,
  triggerBurst = false,
  intensity = 'normal',
  tier,
  particleCount: customParticleCount,
  speed = 1.0,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const animFrameIdRef = useRef<number>(0);

  const effectiveColor = accentColor || glowColor || '#3b82f6';
  const speedFactor = speed !== undefined ? speed : 1.0;

  // Trigger shockwave burst when triggerBurst changes to true
  useEffect(() => {
    if (triggerBurst && canvasRef.current) {
      const canvas = canvasRef.current;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      shockwavesRef.current.push({
        x: centerX,
        y: centerY,
        radius: 10,
        maxRadius: Math.max(canvas.width, canvas.height) * 0.7,
        alpha: 1,
        color: effectiveColor,
      });

      // Scatter nearby particles
      particlesRef.current.forEach((p) => {
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 18 / dist;
        p.vx += (dx / dist) * force * 8 * speedFactor;
        p.vy += (dy / dist) * force * 8 * speedFactor;
      });
    }
  }, [triggerBurst, effectiveColor, speedFactor]);
>>>>
```

```typescript
<<<<
    const particleCount = intensity === 'supernova' ? 120 : intensity === 'normal' ? 80 : 50;

    const initParticles = () => {
      const pArr: Particle[] = [];
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < particleCount; i++) {
        const dist = 40 + Math.random() * (Math.min(width, height) * 0.45);
        const angle = Math.random() * Math.PI * 2;
        pArr.push({
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: 1 + Math.random() * 2.5,
          baseAlpha: 0.2 + Math.random() * 0.6,
          alpha: 0.2 + Math.random() * 0.6,
          color: glowColor,
          angle,
          speed: 0.002 + Math.random() * 0.005,
          distance: dist,
          orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.004 + Math.random() * 0.008),
        });
      }
      particlesRef.current = pArr;
    };
====
    const effectiveParticleCount =
      customParticleCount !== undefined
        ? customParticleCount
        : tier !== undefined
        ? tier === 6
          ? 120
          : tier >= 4
          ? 90
          : tier >= 2
          ? 65
          : 45
        : intensity === 'supernova'
        ? 120
        : intensity === 'normal'
        ? 80
        : 50;

    const initParticles = () => {
      const pArr: Particle[] = [];
      const centerX = width / 2;
      const centerY = height / 2;

      for (let i = 0; i < effectiveParticleCount; i++) {
        const dist = 40 + Math.random() * (Math.min(width, height) * 0.45);
        const angle = Math.random() * Math.PI * 2;
        pArr.push({
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.4 * speedFactor,
          vy: (Math.random() - 0.5) * 0.4 * speedFactor,
          size: 1 + Math.random() * (tier && tier >= 5 ? 3.2 : 2.5),
          baseAlpha: 0.2 + Math.random() * 0.6,
          alpha: 0.2 + Math.random() * 0.6,
          color: effectiveColor,
          angle,
          speed: (0.002 + Math.random() * 0.005) * speedFactor,
          distance: dist,
          orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.004 + Math.random() * 0.008) * speedFactor,
        });
      }
      particlesRef.current = pArr;
    };
>>>>
```

```typescript
<<<<
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      shockwavesRef.current.push({
        x: clickX,
        y: clickY,
        radius: 5,
        maxRadius: 180,
        alpha: 0.9,
        color: glowColor,
      });

      // Scatter particles from click
      particlesRef.current.forEach((p) => {
        const dx = p.x - clickX;
        const dy = p.y - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 180) {
          const force = (180 - dist) / 180;
          p.vx += (dx / dist) * force * 5;
          p.vy += (dy / dist) * force * 5;
        }
      });
    };

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleMouseLeave);
      parent.addEventListener('click', handleCanvasClick);
    }
====
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      shockwavesRef.current.push({
        x: clickX,
        y: clickY,
        radius: 5,
        maxRadius: 180,
        alpha: 0.9,
        color: effectiveColor,
      });

      // Scatter particles from click
      particlesRef.current.forEach((p) => {
        const dx = p.x - clickX;
        const dy = p.y - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 180) {
          const force = (180 - dist) / 180;
          p.vx += (dx / dist) * force * 5 * speedFactor;
          p.vy += (dy / dist) * force * 5 * speedFactor;
        }
      });
    };

    const parent = canvas.parentElement;
    if (parent && interactive) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleMouseLeave);
      parent.addEventListener('click', handleCanvasClick);
    }
>>>>
```

```typescript
<<<<
        // Mouse attraction if active
        if (mouseRef.current.active) {
          const mdx = mouseRef.current.x - p.x;
          const mdy = mouseRef.current.y - p.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
          if (mdist < 140) {
            const pull = (140 - mdist) / 140;
            p.vx += (mdx / mdist) * pull * 0.6;
            p.vy += (mdy / mdist) * pull * 0.6;
          }
        }

        // Shimmer alpha
        p.alpha = p.baseAlpha + Math.sin(time * 3 + p.distance) * 0.25;

        // Draw particle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, p.alpha));
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.fill();
====
        // Mouse attraction if active & interactive
        if (interactive && mouseRef.current.active) {
          const mdx = mouseRef.current.x - p.x;
          const mdy = mouseRef.current.y - p.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
          if (mdist < 140) {
            const pull = (140 - mdist) / 140;
            p.vx += (mdx / mdist) * pull * 0.6 * speedFactor;
            p.vy += (mdy / mdist) * pull * 0.6 * speedFactor;
          }
        }

        // Shimmer alpha
        p.alpha = p.baseAlpha + Math.sin(time * 3 + p.distance) * 0.25;

        // Draw particle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = effectiveColor;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, p.alpha));
        ctx.shadowColor = effectiveColor;
        ctx.shadowBlur = 8;
        ctx.fill();
>>>>
```

```typescript
<<<<
      // 3. Subtle connecting constellation lines between nearby particles
      ctx.save();
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 0.5;
====
      // 3. Subtle connecting constellation lines between nearby particles
      ctx.save();
      ctx.strokeStyle = effectiveColor;
      ctx.lineWidth = 0.5;
>>>>
```

```typescript
<<<<
    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
        parent.removeEventListener('click', handleCanvasClick);
      }
    };
  }, [glowColor, intensity]);
====
    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      if (parent && interactive) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
        parent.removeEventListener('click', handleCanvasClick);
      }
    };
  }, [effectiveColor, intensity, customParticleCount, speedFactor, interactive, tier]);
>>>>
```

---

## 4. Verification Plan
1. **Typechecking**: Running `npx tsc --noEmit` will verify zero errors across `forgeAudio.ts`, `LivingVaultBackground.tsx`, and `NiagaraParticleCanvas.tsx`.
2. **Audio Invocation Verification**: Verify that `PassportPage.tsx`, `SigilForgePage.tsx`, and `AntigravityConversionModal.tsx` invoke `playLaserPulse()` and `setMuted(muted)` without runtime exceptions.
3. **LivingVault Animation Verification**: Confirm entity physics simulation runs at 60 FPS with proper mouse repulsion/singularity gravity and no undefined `vx`/`vy` access.
4. **Niagara Particle Canvas Multi-tier Rendering**: Confirm Passport and Sigil Forge canvases render with the requested theme colors (`accentColor`), speed adjustments, and interaction handlers.
