/**
 * MoneyOS Voice Engine v3.1 / v4.0 — Client Sovereign Voice Kernel
 * Location: src/frontend/voice/VoiceEngineKernel.ts
 */
export class VoiceEngineKernel {
    config;
    state = 'idle';
    currentGeneration = 0;
    currentAudio = null;
    activeAbortController = null;
    speechRecognition = null;
    // WebSocket duplex stream support
    ws = null;
    wsReconnectAttempts = 0;
    wsHeartbeatInterval = null;
    wsUrl = '';
    onStateChangeCb;
    onTranscriptCb;
    onLatencyCb;
    onSwarmAgentCb;
    constructor(config) {
        this.config = {
            useGoogleSTT: true,
            useElevenLabsTTS: true,
            targetLatencyMs: 250,
            silenceDebounceMs: 400,
            activePersona: 'general_conversation',
            activeTone: 'calm',
            ...config,
        };
        this.initWebSpeech();
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendWsFrame({
                type: 'session_init',
                persona,
                tone,
            });
        }
        return this;
    }
    getConfig() {
        return { ...this.config };
    }
    getState() {
        return this.state;
    }
    // -------------------------------------------------------------
    // Callbacks & Event Binding
    // -------------------------------------------------------------
    onStateChange(cb) {
        this.onStateChangeCb = cb;
        return this;
    }
    onTranscript(cb) {
        this.onTranscriptCb = cb;
        return this;
    }
    onLatency(cb) {
        this.onLatencyCb = cb;
        return this;
    }
    onSwarmAgent(cb) {
        this.onSwarmAgentCb = cb;
        return this;
    }
    setState(newState) {
        this.state = newState;
        if (this.onStateChangeCb)
            this.onStateChangeCb(newState);
    }
    // -------------------------------------------------------------
    // WebSocket Duplex Client (/ws/voice)
    // -------------------------------------------------------------
    connectWebSocket(customUrl) {
        if (typeof window === 'undefined')
            return;
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch { }
            this.ws = null;
        }
        if (customUrl) {
            this.wsUrl = customUrl;
        }
        else {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.wsUrl = `${protocol}//${window.location.host}/ws/voice`;
        }
        try {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.onopen = () => {
                this.wsReconnectAttempts = 0;
                this.sendWsFrame({
                    type: 'session_init',
                    persona: this.config.activePersona,
                    tone: this.config.activeTone,
                    audioFormat: 'mp3_22050_32',
                });
                // Start client heartbeat ping
                if (this.wsHeartbeatInterval)
                    clearInterval(this.wsHeartbeatInterval);
                this.wsHeartbeatInterval = setInterval(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.sendWsFrame({ type: 'ping', clientTimestamp: Date.now() });
                    }
                }, 15000);
            };
            this.ws.onmessage = (event) => {
                try {
                    const frame = JSON.parse(event.data);
                    this.handleServerWsFrame(frame);
                }
                catch { }
            };
            this.ws.onclose = () => {
                if (this.wsHeartbeatInterval) {
                    clearInterval(this.wsHeartbeatInterval);
                    this.wsHeartbeatInterval = null;
                }
                this.scheduleWsReconnect();
            };
            this.ws.onerror = () => {
                if (this.ws) {
                    try {
                        this.ws.close();
                    }
                    catch { }
                }
            };
        }
        catch (err) {
            this.scheduleWsReconnect();
        }
    }
    scheduleWsReconnect() {
        if (this.wsReconnectAttempts >= 5)
            return;
        this.wsReconnectAttempts += 1;
        // Exponential backoff with full jitter: min(10000, 500 * 2^attempt) ± jitter
        const base = Math.min(10000, 500 * Math.pow(2, this.wsReconnectAttempts));
        const jitter = (Math.random() - 0.5) * 200;
        const delay = Math.max(250, base + jitter);
        setTimeout(() => {
            if (this.wsUrl) {
                this.connectWebSocket(this.wsUrl);
            }
        }, delay);
    }
    sendWsFrame(frame) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(frame));
            }
            catch { }
        }
    }
    handleServerWsFrame(frame) {
        switch (frame.type) {
            case 'transcript':
                if (typeof frame.text === 'string' && this.onTranscriptCb) {
                    this.onTranscriptCb(frame.text, Boolean(frame.isFinal));
                }
                break;
            case 'audio_start':
                if (this.onSwarmAgentCb && frame.agentId) {
                    this.onSwarmAgentCb(frame);
                }
                this.setState('speaking');
                break;
            case 'audio_end':
                this.setState('idle');
                break;
            case 'interrupted':
                this.setState('idle');
                break;
        }
    }
    disconnectWebSocket() {
        if (this.wsHeartbeatInterval) {
            clearInterval(this.wsHeartbeatInterval);
            this.wsHeartbeatInterval = null;
        }
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch { }
            this.ws = null;
        }
    }
    // -------------------------------------------------------------
    // Interrupt-Safe Barge-In Logic with AbortController
    // -------------------------------------------------------------
    interruptSpeech() {
        this.currentGeneration += 1;
        const gen = this.currentGeneration;
        // 1. Abort in-flight network streaming requests immediately
        if (this.activeAbortController) {
            try {
                this.activeAbortController.abort();
            }
            catch { }
            this.activeAbortController = null;
        }
        // 2. Notify WebSocket server of barge-in interruption
        this.sendWsFrame({
            type: 'interrupt',
            generationToken: gen,
            reason: 'user_barge_in',
        });
        // 3. Kill active streaming audio immediately
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                this.currentAudio.src = '';
                this.currentAudio.load();
            }
            catch { }
            this.currentAudio = null;
        }
        // 4. Kill browser speech synthesis
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
            }
            catch { }
        }
        // 5. Reset state if it was speaking or thinking
        if (this.state === 'speaking' || this.state === 'thinking') {
            this.setState('idle');
        }
        return gen;
    }
    // -------------------------------------------------------------
    // Speech-to-Text Input (Google Cloud STT + Web Speech Fallback)
    // -------------------------------------------------------------
    initWebSpeech() {
        if (typeof window === 'undefined')
            return;
        const win = window;
        const SpeechRecognition = (win.SpeechRecognition || win.webkitSpeechRecognition);
        if (SpeechRecognition) {
            this.speechRecognition = new SpeechRecognition();
            if (this.speechRecognition) {
                this.speechRecognition.continuous = false;
                this.speechRecognition.interimResults = true;
                this.speechRecognition.lang = 'en-US';
                this.speechRecognition.onresult = (event) => {
                    let interim = '';
                    let final = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            final += event.results[i][0].transcript;
                        }
                        else {
                            interim += event.results[i][0].transcript;
                        }
                    }
                    const text = final || interim;
                    if (text && this.onTranscriptCb) {
                        this.onTranscriptCb(text, !!final);
                    }
                };
            }
            if (this.speechRecognition) {
                this.speechRecognition.onerror = () => {
                    if (this.state === 'listening')
                        this.setState('idle');
                };
                this.speechRecognition.onend = () => {
                    if (this.state === 'listening')
                        this.setState('idle');
                };
            }
        }
    }
    async startListening() {
        this.interruptSpeech();
        this.setState('listening');
        if (this.speechRecognition) {
            try {
                this.speechRecognition.start?.();
            }
            catch { }
        }
    }
    stopListening() {
        if (this.speechRecognition) {
            try {
                this.speechRecognition.stop?.();
            }
            catch { }
        }
        if (this.state === 'listening') {
            this.setState('idle');
        }
    }
    // -------------------------------------------------------------
    // Text-to-Speech Output (ElevenLabs v3.1 / v4 + Audio Bus Routing)
    // -------------------------------------------------------------
    async speakText(text, persona, tone, options) {
        const thisGen = this.interruptSpeech();
        this.setState('thinking');
        const startTtsTime = Date.now();
        const abortController = new AbortController();
        this.activeAbortController = abortController;
        try {
            const res = await fetch('/api/voice/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    persona: persona || this.config.activePersona,
                    tone: tone || this.config.activeTone,
                    swarmAgentId: options?.swarmAgentId,
                    voiceId: options?.voiceId,
                }),
                signal: abortController.signal,
            });
            // Discard if interrupted while fetching
            if (thisGen !== this.currentGeneration || abortController.signal.aborted)
                return;
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('audio/mpeg')) {
                const ttfbMs = Date.now() - startTtsTime;
                const blob = await res.blob();
                if (thisGen !== this.currentGeneration || abortController.signal.aborted)
                    return;
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);
                this.currentAudio = audio;
                if (this.onLatencyCb) {
                    this.onLatencyCb({
                        ttsTtfbMs: ttfbMs,
                        providerSTT: this.config.useGoogleSTT ? 'Google Cloud STT' : 'Web Speech',
                        providerTTS: 'ElevenLabs (eleven_flash_v2_5)',
                    });
                }
                this.setState('speaking');
                audio.onended = () => {
                    if (thisGen === this.currentGeneration) {
                        this.setState('idle');
                        URL.revokeObjectURL(audioUrl);
                        this.currentAudio = null;
                    }
                };
                audio.onerror = () => {
                    if (thisGen === this.currentGeneration && !abortController.signal.aborted) {
                        this.fallbackSpeak(text, thisGen);
                    }
                };
                await audio.play();
            }
            else {
                // Fallback: Browser native SpeechSynthesis
                if (thisGen === this.currentGeneration && !abortController.signal.aborted) {
                    this.fallbackSpeak(text, thisGen);
                }
            }
        }
        catch (err) {
            const isAbort = err instanceof Error && err.name === 'AbortError';
            if (isAbort || abortController.signal.aborted || thisGen !== this.currentGeneration) {
                return;
            }
            if (thisGen === this.currentGeneration) {
                this.fallbackSpeak(text, thisGen);
            }
        }
        finally {
            if (this.activeAbortController === abortController) {
                this.activeAbortController = null;
            }
        }
    }
    fallbackSpeak(text, thisGen) {
        if (thisGen !== this.currentGeneration)
            return;
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            this.setState('idle');
            return;
        }
        try {
            const clean = text
                .replace(/#{1,6}\s+/g, '')
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/[^\w\s.,!?'"$\-%]/g, ' ')
                .substring(0, 500);
            const utterance = new SpeechSynthesisUtterance(clean);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.onstart = () => {
                if (thisGen === this.currentGeneration)
                    this.setState('speaking');
            };
            utterance.onend = () => {
                if (thisGen === this.currentGeneration)
                    this.setState('idle');
            };
            utterance.onerror = () => {
                if (thisGen === this.currentGeneration)
                    this.setState('idle');
            };
            window.speechSynthesis.speak(utterance);
        }
        catch {
            this.setState('idle');
        }
    }
}
export const globalVoiceEngine = new VoiceEngineKernel();
