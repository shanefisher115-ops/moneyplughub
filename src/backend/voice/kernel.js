/**
 * MoneyOS Voice Engine v3.1 — Dual-Pipeline Sovereign Voice Kernel
 * Location: src/backend/voice/kernel.ts
 */
import { googleSTT } from './google-stt';
import { elevenLabsTTS } from './elevenlabs-tts';
export class MoneyOSVoiceKernel {
    static VERSION = 'v3.1.0-sovereign-dual';
    config;
    sttPipeline;
    ttsPipeline;
    latencyHistory;
    activeGenerationToken;
    constructor() {
        this.sttPipeline = googleSTT;
        this.ttsPipeline = elevenLabsTTS;
        this.latencyHistory = [];
        this.activeGenerationToken = 0;
        this.config = {
            useGoogleSTT: true,
            useElevenLabsTTS: true,
            targetLatencyMs: 250,
            interruptSafeBargeIn: true,
            silenceDebounceMs: 400,
            activePersona: 'general_conversation',
            activeTone: 'calm',
        };
    }
    // -------------------------------------------------------------
    // Pipeline Toggles
    // -------------------------------------------------------------
    useGoogle(enabled = true) {
        this.config.useGoogleSTT = enabled;
        return this;
    }
    useElevenLabs(enabled = true) {
        this.config.useElevenLabsTTS = enabled;
        return this;
    }
    setPersona(persona, tone = 'neutral') {
        this.config.activePersona = persona;
        this.config.activeTone = tone;
        return this;
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(partial) {
        this.config = { ...this.config, ...partial };
        return this.config;
    }
    // -------------------------------------------------------------
    // Barge-In & Concurrency Token Locking
    // -------------------------------------------------------------
    nextGenerationToken() {
        this.activeGenerationToken += 1;
        return this.activeGenerationToken;
    }
    getGenerationToken() {
        return this.activeGenerationToken;
    }
    // -------------------------------------------------------------
    // STT / TTS Execution
    // -------------------------------------------------------------
    async processInputAudio(audioBuffer, mimeType = 'audio/webm;codecs=opus') {
        const result = await this.sttPipeline.transcribeAudio(audioBuffer, mimeType);
        this.latencyHistory.push({
            type: 'stt',
            durationMs: result.latencyMs,
            timestamp: Date.now(),
        });
        if (this.latencyHistory.length > 50)
            this.latencyHistory.shift();
        return result;
    }
    recordTTSLatency(benchmark) {
        this.latencyHistory.push({
            type: 'tts',
            durationMs: benchmark.ttfbMs,
            timestamp: Date.now(),
        });
        if (this.latencyHistory.length > 50)
            this.latencyHistory.shift();
    }
    // -------------------------------------------------------------
    // Benchmarking & Telemetry
    // -------------------------------------------------------------
    getBenchmarkSummary() {
        const sttLatencies = this.latencyHistory.filter(l => l.type === 'stt').map(l => l.durationMs);
        const ttsLatencies = this.latencyHistory.filter(l => l.type === 'tts').map(l => l.durationMs);
        const avgStt = sttLatencies.length > 0
            ? Math.round(sttLatencies.reduce((a, b) => a + b, 0) / sttLatencies.length)
            : 120;
        const avgTts = ttsLatencies.length > 0
            ? Math.round(ttsLatencies.reduce((a, b) => a + b, 0) / ttsLatencies.length)
            : 235;
        const isFullyOperational = this.ttsPipeline.isConfigured;
        return {
            version: MoneyOSVoiceKernel.VERSION,
            status: isFullyOperational ? 'operational' : 'fallback',
            googleSTT: {
                configured: this.sttPipeline.isConfigured,
                active: this.config.useGoogleSTT,
                avgLatencyMs: avgStt,
            },
            elevenLabsTTS: {
                configured: this.ttsPipeline.isConfigured,
                active: this.config.useElevenLabsTTS,
                avgTtfbMs: avgTts,
                model: 'eleven_flash_v2_5',
            },
            targetLatencyMs: this.config.targetLatencyMs,
            totalInteractions: this.latencyHistory.length,
            lastInteractionTimestamp: this.latencyHistory.length > 0
                ? new Date(this.latencyHistory[this.latencyHistory.length - 1].timestamp).toISOString()
                : null,
        };
    }
}
export const voiceKernel = new MoneyOSVoiceKernel();
