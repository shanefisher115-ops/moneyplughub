/**
 * Procedural Web Audio Synthesizer for Sigil Forge
 * Zero external audio files — 100% mathematical Web Audio oscillator synthesis.
 */

class ForgeAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

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

  /**
   * Subtle high-tech tick on item select or hover
   */
  public playTick(freq: number = 880) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  /**
   * Harmonic Solfeggio 528Hz Transformation / Ascension Chord on Forge
   */
  public playAscensionChord() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Solfeggio 528Hz (Transformation/Miracles), 264Hz (Sub-octave), 792Hz (Fifth), 1056Hz (Octave)
      const freqs = [264, 528, 792, 1056, 1584];
      const now = ctx.currentTime;

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 1.02, now + 1.2);

        const initialVol = 0.08 / (idx + 1);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(initialVol, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

        if (panner) {
          panner.pan.setValueAtTime((idx - 2) * 0.35, now);
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(ctx.destination);
        } else {
          osc.connect(gain);
          gain.connect(ctx.destination);
        }

        osc.start(now + idx * 0.03);
        osc.stop(now + 1.6);
      });
    } catch {}
  }

  /**
   * Fast cybernetic ascending arpeggio on Cosmic Roll
   */
  public playCosmicRoll() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 830.61, 987.77, 1318.51, 1661.22];
      const now = ctx.currentTime;

      notes.forEach((note, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, now + idx * 0.04);

        gain.gain.setValueAtTime(0.05, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.15);
      });
    } catch {}
  }

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

  /**
   * Play Pure Solfeggio Harmonic Frequency (432Hz, 528Hz, 639Hz, 963Hz)
   */
  public playSolfeggioTone(freq: number = 528, duration: number = 2.5) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      // Sub-harmonic shimmer
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 0.5, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch {}
  }

  // ── Continuous Solfeggio Drone State ──────────────────────────────
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneHz: number | null = null;

  public startHarmonicDrone(freq: number = 528) {
    if (this.isMuted) return;
    this.stopHarmonicDrone();

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 0.5, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 1.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      this.droneOsc1 = osc1;
      this.droneOsc2 = osc2;
      this.droneGain = gain;
      this.droneHz = freq;
    } catch {}
  }

  public stopHarmonicDrone() {
    if (!this.droneGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.droneGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      setTimeout(() => {
        try {
          this.droneOsc1?.stop();
          this.droneOsc2?.stop();
          this.droneOsc1?.disconnect();
          this.droneOsc2?.disconnect();
          this.droneGain?.disconnect();
        } catch {}
        this.droneOsc1 = null;
        this.droneOsc2 = null;
        this.droneGain = null;
        this.droneHz = null;
      }, 900);
    } catch {
      this.droneOsc1 = null;
      this.droneOsc2 = null;
      this.droneGain = null;
      this.droneHz = null;
    }
  }

  public isDroneActive(): boolean {
    return this.droneHz !== null;
  }

  public getDroneHz(): number | null {
    return this.droneHz;
  }

  /**
   * Cinematic Forge Ignition & Ascension Ritual Audio
   * Sub-bass seismic drop (38Hz), high-frequency plasma surge, and Solfeggio shimmer.
   */
  public playIgnitionSequence() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Deep Sub-Bass Pulse (38Hz - 24Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(75, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 1.2);
      subGain.gain.setValueAtTime(0.25, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 1.6);

      // 2. Rising Plasma Laser Sweep
      const sweepOsc = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      sweepOsc.type = 'sawtooth';
      sweepOsc.frequency.setValueAtTime(220, now + 0.1);
      sweepOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.9);
      sweepGain.gain.setValueAtTime(0.001, now + 0.1);
      sweepGain.gain.linearRampToValueAtTime(0.08, now + 0.4);
      sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      sweepOsc.connect(sweepGain);
      sweepGain.connect(ctx.destination);
      sweepOsc.start(now + 0.1);
      sweepOsc.stop(now + 1.1);

      // 3. Multi-Harmonic Angelic Bell Shimmer
      const harmonics = [528, 792, 1056, 1584, 2112];
      harmonics.forEach((h, i) => {
        const hOsc = ctx.createOscillator();
        const hGain = ctx.createGain();
        hOsc.type = 'sine';
        hOsc.frequency.setValueAtTime(h, now + 0.35 + i * 0.05);

        hGain.gain.setValueAtTime(0.0001, now + 0.35 + i * 0.05);
        hGain.gain.linearRampToValueAtTime(0.06 / (i + 1), now + 0.5 + i * 0.05);
        hGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        hOsc.connect(hGain);
        hGain.connect(ctx.destination);
        hOsc.start(now + 0.35 + i * 0.05);
        hOsc.stop(now + 2.6);
      });
    } catch {}
  }

  /**
   * Precision Magnetic Snap for 0° Right-Side-Up Lock
   */
  public playOrientSnap() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Double click tick
      [0, 0.045].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now + offset);
        osc.frequency.exponentialRampToValueAtTime(800, now + offset + 0.03);
        gain.gain.setValueAtTime(0.08, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.04);
      });
    } catch {}
  }
}

export const forgeAudio = new ForgeAudioEngine();
