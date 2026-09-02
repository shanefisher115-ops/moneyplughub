/**
 * MoneyOS Voice Engine v3.1 / v4.0 — ElevenLabs Text-to-Speech Streaming Module
 * Location: src/backend/voice/elevenlabs-tts.ts
 */

import { Response } from 'express';
import { config } from '../config';
import { PERSONA_PROFILES, BasePersona, EmotionalTone, applyEmotionalTone, injectSpeechProsody } from './persona';

export interface TTSStreamOptions {
  persona?: BasePersona;
  tone?: EmotionalTone;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
  outputFormat?: string;
  optimizeLatency?: number; // 0-4 (4 is max low-latency streaming)
  signal?: AbortSignal;
}

export interface TTSBenchmark {
  ttfbMs: number;
  durationMs: number;
  characterCount: number;
  voiceId: string;
  modelId: string;
  provider: 'elevenlabs' | 'browser-fallback';
}

export class ElevenLabsTTSPipeline {
  private get apiKey(): string {
    return process.env.ELEVENLABS_API_KEY || config.elevenLabs.apiKey || '';
  }

  private get defaultVoiceId(): string {
    return process.env.ELEVENLABS_VOICE_ID || config.elevenLabs.voiceId || 'm6Q2NTc6q5ldaHnwzSDp';
  }

  private get defaultModelId(): string {
    return process.env.ELEVENLABS_MODEL_ID || config.elevenLabs.modelId || 'eleven_flash_v2_5';
  }

  constructor() {}

  public get isConfigured(): boolean {
    return this.apiKey.length > 10;
  }

  /**
   * Streams synthesized audio chunks directly via callback for WebSocket or custom consumers
   */
  public async streamSpeechChunks(
    text: string,
    onChunk: (chunk: Buffer) => void,
    options: TTSStreamOptions = {}
  ): Promise<TTSBenchmark> {
    const startTime = Date.now();
    const personaKey = options.persona || 'general_conversation';
    const baseProfile = PERSONA_PROFILES[personaKey] || PERSONA_PROFILES.general_conversation;
    const modulatedProfile = applyEmotionalTone(baseProfile, options.tone);

    const voiceSettings = {
      stability: options.stability ?? modulatedProfile.stability,
      similarity_boost: options.similarity_boost ?? modulatedProfile.similarity_boost,
      style: options.style ?? modulatedProfile.style,
      use_speaker_boost: modulatedProfile.use_speaker_boost,
      speed: options.speed ?? modulatedProfile.speed,
    };

    const cleanText = injectSpeechProsody(text, options.tone);
    const charCount = cleanText.length;

    const targetVoiceId = options.voiceId || this.defaultVoiceId;
    const targetModelId = options.modelId || this.defaultModelId;

    if (!this.apiKey || this.apiKey.length < 10) {
      const durationMs = Date.now() - startTime;
      return {
        ttfbMs: durationMs,
        durationMs,
        characterCount: charCount,
        voiceId: targetVoiceId,
        modelId: targetModelId,
        provider: 'browser-fallback',
      };
    }

    try {
      const latencyTier = options.optimizeLatency ?? 4;
      const outputFormat = options.outputFormat || 'mp3_22050_32';
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}/stream?optimize_streaming_latency=${latencyTier}&output_format=${outputFormat}`;

      const elevenRes = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: targetModelId,
          voice_settings: voiceSettings,
        }),
        signal: options.signal,
      });

      if (!elevenRes.ok) {
        const errorText = await elevenRes.text();
        console.warn(`[ElevenLabsTTS] API ${elevenRes.status}: ${errorText.substring(0, 120)}`);
        const durationMs = Date.now() - startTime;
        return {
          ttfbMs: durationMs,
          durationMs,
          characterCount: charCount,
          voiceId: targetVoiceId,
          modelId: targetModelId,
          provider: 'browser-fallback',
        };
      }

      const ttfbMs = Date.now() - startTime;
      const reader = elevenRes.body?.getReader();
      if (!reader) {
        return {
          ttfbMs,
          durationMs: Date.now() - startTime,
          characterCount: charCount,
          voiceId: targetVoiceId,
          modelId: targetModelId,
          provider: 'browser-fallback',
        };
      }

      while (true) {
        if (options.signal?.aborted) {
          try { await reader.cancel(); } catch {}
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          onChunk(Buffer.from(value));
        }
      }

      return {
        ttfbMs,
        durationMs: Date.now() - startTime,
        characterCount: charCount,
        voiceId: targetVoiceId,
        modelId: targetModelId,
        provider: 'elevenlabs',
      };
    } catch (err: any) {
      const targetVoiceId = options.voiceId || this.defaultVoiceId;
      const targetModelId = options.modelId || this.defaultModelId;
      if (options.signal?.aborted || err.name === 'AbortError') {
        const durationMs = Date.now() - startTime;
        return {
          ttfbMs: durationMs,
          durationMs,
          characterCount: charCount,
          voiceId: targetVoiceId,
          modelId: targetModelId,
          provider: 'browser-fallback',
        };
      }
      console.error('[ElevenLabsTTS] Chunk streaming exception:', err.message);
      const durationMs = Date.now() - startTime;
      return {
        ttfbMs: durationMs,
        durationMs,
        characterCount: charCount,
        voiceId: targetVoiceId,
        modelId: targetModelId,
        provider: 'browser-fallback',
      };
    }
  }

  /**
   * Streams synthesized audio chunks directly to the HTTP response with sub-250ms TTFB
   */
  public async streamSpeech(
    text: string,
    res: Response,
    options: TTSStreamOptions = {}
  ): Promise<TTSBenchmark> {
    const startTime = Date.now();
    const personaKey = options.persona || 'general_conversation';
    const baseProfile = PERSONA_PROFILES[personaKey] || PERSONA_PROFILES.general_conversation;
    const modulatedProfile = applyEmotionalTone(baseProfile, options.tone);

    const voiceSettings = {
      stability: options.stability ?? modulatedProfile.stability,
      similarity_boost: options.similarity_boost ?? modulatedProfile.similarity_boost,
      style: options.style ?? modulatedProfile.style,
      use_speaker_boost: modulatedProfile.use_speaker_boost,
      speed: options.speed ?? modulatedProfile.speed,
    };

    const cleanText = injectSpeechProsody(text, options.tone);
    const charCount = cleanText.length;

    const targetVoiceId = options.voiceId || this.defaultVoiceId;
    const targetModelId = options.modelId || this.defaultModelId;

    // If ElevenLabs is not configured or disabled, return fallback response
    if (!this.apiKey || this.apiKey.length < 10) {
      const durationMs = Date.now() - startTime;
      res.status(200).json({
        success: false,
        fallback: 'browser',
        text: cleanText,
        metrics: {
          ttfbMs: durationMs,
          durationMs,
          characterCount: charCount,
          provider: 'browser-fallback',
        },
      });
      return {
        ttfbMs: durationMs,
        durationMs,
        characterCount: charCount,
        voiceId: targetVoiceId,
        modelId: targetModelId,
        provider: 'browser-fallback',
      };
    }

    const internalAbort = new AbortController();
    const activeSignal = options.signal || internalAbort.signal;

    res.on('close', () => {
      if (!res.writableEnded) {
        internalAbort.abort();
      }
    });

    try {
      const latencyTier = options.optimizeLatency ?? 4;
      const outputFormat = options.outputFormat || 'mp3_22050_32';
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}/stream?optimize_streaming_latency=${latencyTier}&output_format=${outputFormat}`;

      const elevenRes = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: targetModelId,
          voice_settings: voiceSettings,
        }),
        signal: activeSignal,
      });

      if (!elevenRes.ok) {
        const errorText = await elevenRes.text();
        console.warn(`[ElevenLabsTTS] API ${elevenRes.status}: ${errorText.substring(0, 120)}`);
        const durationMs = Date.now() - startTime;
        res.status(200).json({
          success: false,
          fallback: 'browser',
          text: cleanText,
          error: `ElevenLabs ${elevenRes.status}`,
          metrics: { ttfbMs: durationMs, durationMs, characterCount: charCount, provider: 'browser-fallback' },
        });
        return {
          ttfbMs: durationMs,
          durationMs,
          characterCount: charCount,
          voiceId: targetVoiceId,
          modelId: targetModelId,
          provider: 'browser-fallback',
        };
      }

      const ttfbMs = Date.now() - startTime;

      // Stream direct audio chunks to client with metadata headers
      res.set({
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-MoneyOS-Voice-Provider': 'elevenlabs',
        'X-MoneyOS-Persona': personaKey,
        'X-MoneyOS-Persona-Name': modulatedProfile.name,
        'X-MoneyOS-Emotion': options.tone || modulatedProfile.tone,
        'X-MoneyOS-Soundscape': modulatedProfile.soundscape,
        'X-MoneyOS-Spatial-Pan': modulatedProfile.spatialPan,
        'X-MoneyOS-Pace': (options.speed ?? modulatedProfile.speed).toFixed(2),
        'X-MoneyOS-TTFB-Ms': ttfbMs.toString(),
      });

      const reader = elevenRes.body?.getReader();
      if (!reader) {
        res.status(502).json({ success: false, fallback: 'browser', text: cleanText });
        return {
          ttfbMs,
          durationMs: Date.now() - startTime,
          characterCount: charCount,
          voiceId: targetVoiceId,
          modelId: targetModelId,
          provider: 'browser-fallback',
        };
      }

      while (true) {
        if (activeSignal.aborted || res.destroyed) {
          try { await reader.cancel(); } catch {}
          break;
        }
        const { done, value } = await reader.read();
        if (done) {
          if (!res.writableEnded) res.end();
          break;
        }
        if (value && !res.destroyed) {
          res.write(Buffer.from(value));
        }
      }

      const durationMs = Date.now() - startTime;
      return {
        ttfbMs,
        durationMs,
        characterCount: charCount,
        voiceId: targetVoiceId,
        modelId: targetModelId,
        provider: 'elevenlabs',
      };
    } catch (err: any) {
      const targetVoiceId = options.voiceId || this.defaultVoiceId;
      const targetModelId = options.modelId || this.defaultModelId;
      if (activeSignal.aborted || err.name === 'AbortError') {
        const durationMs = Date.now() - startTime;
        return {
          ttfbMs: durationMs,
          durationMs,
          characterCount: charCount,
          voiceId: targetVoiceId,
          modelId: targetModelId,
          provider: 'browser-fallback',
        };
      }
      console.error('[ElevenLabsTTS] Streaming exception:', err.message);
      const durationMs = Date.now() - startTime;
      if (!res.headersSent) {
        res.status(200).json({
          success: false,
          fallback: 'browser',
          text: cleanText,
          metrics: { ttfbMs: durationMs, durationMs, characterCount: charCount, provider: 'browser-fallback' },
        });
      }
      return {
        ttfbMs: durationMs,
        durationMs,
        characterCount: charCount,
        voiceId: targetVoiceId,
        modelId: targetModelId,
        provider: 'browser-fallback',
      };
    }
  }
}

export const elevenLabsTTS = new ElevenLabsTTSPipeline();

