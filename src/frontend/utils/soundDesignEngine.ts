/**
 * MoneyOS Sound Design & Spatial Audio Engine v4
 * 
 * Includes:
 * 1. 4 Contextual Soundscapes (Vault Hum, Sigil Shimmer, Cyber Pulse, Harmonic Drone)
 * 2. Spatial Stereo Panning (-0.35 to +0.35)
 * 3. Mythic Realm Shimmer Reverb & Harmonic Saturator
 * 4. Procedural Chimes, Supernovas, and Voice Ritual Sequences
 * 5. Real-Time Web Audio Analyser & Frequency Metrics for WebGL Shaders
 */

export type SoundscapeType = 'vault_hum' | 'sigil_shimmer' | 'cyber_pulse' | 'harmonic_drone' | 'none';

export interface AudioMetrics {
  bass: number;     // Normalized 0.0 - 1.0 (sub-bass and bass)
  mid: number;      // Normalized 0.0 - 1.0 (mids)
  treble: number;   // Normalized 0.0 - 1.0 (highs)
  average: number;  // Overall average volume 0.0 - 1.0
}

class SoundDesignEngine {
  private ctx: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private activeSoundscapeType: SoundscapeType = 'none';
  private soundscapeNodes: { oscs: OscillatorNode[]; gains: GainNode[]; intervals?: any[] } = { oscs: [], gains: [] };
  private masterSoundscapeGain: GainNode | null = null;
  private freqDataBuffer: Uint8Array = new Uint8Array(64);

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.analyserNode = this.ctx.createAnalyser();
        this.analyserNode.fftSize = 128;
        this.analyserNode.smoothingTimeConstant = 0.8;
        this.analyserNode.connect(this.ctx.destination);
        this.freqDataBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Returns destination node for connecting oscillators/sources directly to the analyser & master output.
   */
  public getDestination(): AudioNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    return this.analyserNode || ctx.destination;
  }

  /**
   * Returns real-time Web Audio AnalyserNode instance
   */
  public getAnalyser(): AnalyserNode | null {
    this.getContext();
    return this.analyserNode;
  }

  /**
   * Retrieves raw Web Audio frequency data byte array
   */
  public getFrequencyData(): Uint8Array {
    if (this.analyserNode) {
      if (this.freqDataBuffer.length !== this.analyserNode.frequencyBinCount) {
        this.freqDataBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);
      }
      this.analyserNode.getByteFrequencyData(this.freqDataBuffer as any);
    }
    return this.freqDataBuffer;
  }

  /**
   * Calculates normalized bass, mid, treble, and average volume for Three.js shaders & physics
   */
  public getAudioMetrics(): AudioMetrics {
    const data = this.getFrequencyData();
    if (!data || data.length === 0) {
      return { bass: 0, mid: 0, treble: 0, average: 0 };
    }

    const binCount = data.length;
    const bassBins = Math.floor(binCount * 0.25);
    const midBins = Math.floor(binCount * 0.65);

    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let totalSum = 0;

    for (let i = 0; i < binCount; i++) {
      const val = data[i] / 255.0;
      totalSum += val;
      if (i < bassBins) {
        bassSum += val;
      } else if (i < midBins) {
        midSum += val;
      } else {
        trebleSum += val;
      }
    }

    return {
      bass: bassBins > 0 ? bassSum / bassBins : 0,
      mid: (midBins - bassBins) > 0 ? midSum / (midBins - bassBins) : 0,
      treble: (binCount - midBins) > 0 ? trebleSum / (binCount - midBins) : 0,
      average: totalSum / binCount,
    };
  }

  /**
   * Set & Cross-Fade Contextual Soundscape
   * Volume level is kept subtle (-28dB to -34dB, gain 0.02 - 0.04) so voice stays crystal clear.
   */
  public setSoundscape(type: SoundscapeType, targetGain = 0.035) {
    if (this.activeSoundscapeType === type) return;
    this.stopSoundscape();

    if (type === 'none') return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const dest = this.getDestination() || ctx.destination;
      this.masterSoundscapeGain = ctx.createGain();
      this.masterSoundscapeGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.masterSoundscapeGain.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 1.2);
      this.masterSoundscapeGain.connect(dest);

      if (type === 'vault_hum') {
        // 48Hz Sub-Bass + Low-pass Clockwork
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const oscGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(48, ctx.currentTime);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(80, ctx.currentTime);

        oscGain.gain.setValueAtTime(0.9, ctx.currentTime);
        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(this.masterSoundscapeGain);
        osc.start();

        this.soundscapeNodes.oscs.push(osc);
        this.soundscapeNodes.gains.push(oscGain);

      } else if (type === 'sigil_shimmer') {
        // 528Hz Solfeggio Resonant Shimmer
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(528, ctx.currentTime);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1056, ctx.currentTime);

        gain1.gain.setValueAtTime(0.4, ctx.currentTime);
        osc1.connect(gain1);
        osc2.connect(gain1);
        gain1.connect(this.masterSoundscapeGain);

        osc1.start();
        osc2.start();
        this.soundscapeNodes.oscs.push(osc1, osc2);
        this.soundscapeNodes.gains.push(gain1);

      } else if (type === 'cyber_pulse') {
        // Subtle rhythmic cyber telemetry pulse
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const oscGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);

        lfo.frequency.setValueAtTime(2, ctx.currentTime); // 2Hz pulse
        lfoGain.gain.setValueAtTime(200, ctx.currentTime);
        lfo.connect(osc.frequency);

        oscGain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(this.masterSoundscapeGain);

        lfo.start();
        osc.start();
        this.soundscapeNodes.oscs.push(osc, lfo);
        this.soundscapeNodes.gains.push(oscGain, lfoGain);

      } else if (type === 'harmonic_drone') {
        // A2 - E3 - A3 Fifths Cosmic Swell Drone
        const freqs = [110, 164.81, 220];
        freqs.forEach((f) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, ctx.currentTime);

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(320, ctx.currentTime);

          g.gain.setValueAtTime(0.25, ctx.currentTime);
          osc.connect(filter);
          filter.connect(g);
          g.connect(this.masterSoundscapeGain!);

          osc.start();
          this.soundscapeNodes.oscs.push(osc);
          this.soundscapeNodes.gains.push(g);
        });
      }

      this.activeSoundscapeType = type;
    } catch (e) {
      console.warn('Soundscape initiation error:', e);
    }
  }

  public stopSoundscape() {
    if (this.activeSoundscapeType === 'none' || !this.ctx) return;
    try {
      if (this.masterSoundscapeGain) {
        this.masterSoundscapeGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
      }
      setTimeout(() => {
        this.soundscapeNodes.oscs.forEach(o => {
          try { o.stop(); o.disconnect(); } catch {}
        });
        this.soundscapeNodes.gains.forEach(g => {
          try { g.disconnect(); } catch {}
        });
        this.soundscapeNodes = { oscs: [], gains: [] };
        if (this.masterSoundscapeGain) {
          try { this.masterSoundscapeGain.disconnect(); } catch {}
          this.masterSoundscapeGain = null;
        }
        this.activeSoundscapeType = 'none';
      }, 900);
    } catch {
      this.activeSoundscapeType = 'none';
    }
  }

  /**
   * Spatial Audio Node Router for HTMLAudioElement
   */
  public attachSpatialPan(audioEl: HTMLAudioElement, panValue: number = 0.0, addReverb = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const dest = this.getDestination() || ctx.destination;
      const source = ctx.createMediaElementSource(audioEl);
      const panner = (ctx.createStereoPanner ? ctx.createStereoPanner() : null);
      
      if (panner) {
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panValue)), ctx.currentTime);
      }

      if (addReverb) {
        const delay = ctx.createDelay();
        const feedback = ctx.createGain();
        const wetGain = ctx.createGain();

        delay.delayTime.setValueAtTime(0.14, ctx.currentTime);
        feedback.gain.setValueAtTime(0.32, ctx.currentTime);
        wetGain.gain.setValueAtTime(0.40, ctx.currentTime);

        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wetGain);

        source.connect(delay);
        wetGain.connect(dest);
      }

      if (panner) {
        source.connect(panner);
        panner.connect(dest);
      } else {
        source.connect(dest);
      }
    } catch (e) {
      // already attached
    }
  }

  /**
   * Procedural Sound Effects
   */
  public playEffect(type: 'chime' | 'ascension' | 'laser' | 'click' | 'supernova' | 'sigil_glow' | 'chamber_reveal') {
    const ctx = this.getContext();
    if (!ctx) return;

    const dest = this.getDestination() || ctx.destination;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'sigil_glow') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1056, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } else if (type === 'chamber_reveal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.9);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 1.4);
    } else if (type === 'ascension') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } else if (type === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'supernova') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 1.2);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    }
  }
}

export const soundDesign = new SoundDesignEngine();
export default soundDesign;
