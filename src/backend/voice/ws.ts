/**
 * MoneyOS Voice Engine v3.1 / v4.0 — WebSocket Server & Real-Time Duplex Frame Protocol
 * Location: src/backend/voice/ws.ts
 */

import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { elevenLabsTTS } from './elevenlabs-tts';
import { googleSTT } from './google-stt';
import { PERSONA_PROFILES, BasePersona, EmotionalTone } from './persona';
import { BASE_PERSONAS, PERSONA_FUSION_MAP, EMOTIONAL_OVERLAYS, classifyVoiceIntentAndEmotion } from '../routes/tts';
import { SWARM_VOICE_REGISTRY, classifySwarmVoiceAgent, SwarmAgentId } from './swarmVoices';

export interface VoiceWsSession {
  sessionId: string;
  isAlive: boolean;
  persona: BasePersona;
  emotion: EmotionalTone;
  swarmAgentId?: SwarmAgentId;
  audioFormat: string;
  generationToken: number;
  activeAbortController: AbortController | null;
  audioChunksBuffer: Array<{ seq: number; data: string }>;
}

export type ClientFrame = 
  | { type: 'session_init'; token?: string; persona?: string; emotion?: string; tone?: string; audioFormat?: string; swarmAgentId?: SwarmAgentId }
  | { type: 'audio_chunk'; data?: string; chunk?: string; seq: number; isFinal?: boolean; format?: string }
  | { type: 'synthesize' | 'speak'; text: string; persona?: string; emotion?: string; tone?: string; generationToken?: number; swarmAgentId?: SwarmAgentId; voiceId?: string }
  | { type: 'interrupt'; generationToken?: number; reason?: string }
  | { type: 'ping'; clientTimestamp?: number; timestamp?: number };

export type ServerFrame =
  | { type: 'session_ready'; sessionId: string; sampleRate: number; provider: string; swarmAgents?: typeof SWARM_VOICE_REGISTRY }
  | { type: 'transcript'; text: string; isFinal: boolean; confidence: number }
  | { type: 'audio_start'; generationToken: number; persona: string; soundscape: string; spatialPan: number; agentId?: string; agentName?: string; agentTitle?: string; agentBadge?: string; themeColor?: string; glowColor?: string; voiceId?: string }
  | { type: 'audio_chunk'; generationToken: number; chunk: string; seq: number }
  | { type: 'audio_end'; generationToken: number; durationMs: number }
  | { type: 'interrupted'; generationToken: number; reason?: string }
  | { type: 'pong'; clientTimestamp: number; serverTimestamp: number }
  | { type: 'error'; code: string; message: string; fallback?: string };

export class VoiceWebSocketManager {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<WebSocket, VoiceWsSession>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Initializes and mounts the WebSocket server on /ws/voice
   */
  public mount(server: http.Server, wsPath: string = '/ws/voice'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: wsPath });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start 25s heartbeat keepalive sweep
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws: WebSocket) => {
        const session = this.sessions.get(ws);
        if (!session) return;
        if (!session.isAlive) {
          try { ws.terminate(); } catch {}
          this.sessions.delete(ws);
          return;
        }
        session.isAlive = false;
        try { ws.ping(); } catch {}
      });
    }, 25000);

    return this.wss;
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const sessionId = 'sess_voice_' + crypto.randomBytes(8).toString('hex');
    const session: VoiceWsSession = {
      sessionId,
      isAlive: true,
      persona: 'general_conversation',
      emotion: 'calm',
      audioFormat: 'mp3_22050_32',
      generationToken: 0,
      activeAbortController: null,
      audioChunksBuffer: [],
    };

    this.sessions.set(ws, session);

    // Native ping/pong listeners for network liveness
    ws.on('pong', () => {
      const s = this.sessions.get(ws);
      if (s) s.isAlive = true;
    });

    ws.on('message', async (data: unknown, isBinary: boolean) => {
      const s = this.sessions.get(ws);
      if (!s) return;
      s.isAlive = true;

      // If binary audio frame
      if (isBinary && Buffer.isBuffer(data)) {
        this.handleBinaryAudioChunk(ws, s, data);
        return;
      }

      // JSON text frame
      let frame: ClientFrame;
      try {
        const raw = typeof data === 'string' ? data : (data as Buffer).toString('utf8');
        frame = JSON.parse(raw);
      } catch {
        this.send(ws, {
          type: 'error',
          code: 'MALFORMED_FRAME',
          message: 'WebSocket payload must be valid JSON',
        });
        return;
      }

      await this.handleClientFrame(ws, s, frame);
    });

    ws.on('close', () => {
      const s = this.sessions.get(ws);
      if (s && s.activeAbortController) {
        try { s.activeAbortController.abort(); } catch {}
      }
      this.sessions.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[VoiceWS] Client socket error:', err.message);
      const s = this.sessions.get(ws);
      if (s && s.activeAbortController) {
        try { s.activeAbortController.abort(); } catch {}
      }
      this.sessions.delete(ws);
    });
  }

  private async handleClientFrame(ws: WebSocket, session: VoiceWsSession, frame: ClientFrame): Promise<void> {
    switch (frame.type) {
      case 'session_init': {
        const personaKey = (frame.persona && PERSONA_PROFILES[frame.persona as BasePersona]) 
          ? (frame.persona as BasePersona) 
          : 'general_conversation';
        const emotionKey = (frame.emotion || frame.tone || 'calm') as EmotionalTone;

        session.persona = personaKey;
        session.emotion = emotionKey;
        if (frame.swarmAgentId) session.swarmAgentId = frame.swarmAgentId;
        if (frame.audioFormat) session.audioFormat = frame.audioFormat;

        this.send(ws, {
          type: 'session_ready',
          sessionId: session.sessionId,
          sampleRate: 22050,
          provider: elevenLabsTTS.isConfigured ? 'elevenlabs' : 'browser-fallback',
          swarmAgents: SWARM_VOICE_REGISTRY,
        });
        break;
      }

      case 'audio_chunk': {
        const chunkData = frame.data || frame.chunk || '';
        if (chunkData) {
          session.audioChunksBuffer.push({ seq: frame.seq, data: chunkData });
          session.audioChunksBuffer.sort((a, b) => a.seq - b.seq);
        }

        if (frame.isFinal) {
          // If chunks exist and Google STT is configured, perform STT
          if (session.audioChunksBuffer.length > 0 && googleSTT.isConfigured) {
            try {
              const combinedBase64 = session.audioChunksBuffer.map(c => c.data).join('');
              const sttResult = await googleSTT.transcribeAudio(combinedBase64, frame.format || 'audio/webm;codecs=opus');
              this.send(ws, {
                type: 'transcript',
                text: sttResult.transcript,
                isFinal: true,
                confidence: sttResult.confidence,
              });
            } catch (err: any) {
              this.send(ws, {
                type: 'transcript',
                text: '',
                isFinal: true,
                confidence: 0,
              });
            }
          }
          session.audioChunksBuffer = [];
        }
        break;
      }

      case 'synthesize':
      case 'speak': {
        await this.handleSynthesize(ws, session, frame);
        break;
      }

      case 'interrupt': {
        this.handleInterrupt(ws, session, frame);
        break;
      }

      case 'ping': {
        const clientTs = frame.clientTimestamp || ('timestamp' in frame ? (frame.timestamp as number) : undefined) || Date.now();
        this.send(ws, {
          type: 'pong',
          clientTimestamp: clientTs,
          serverTimestamp: Date.now(),
        });
        break;
      }

      default: {
        const unknownType = (frame as { type?: string }).type || 'unknown';
        this.send(ws, {
          type: 'error',
          code: 'UNKNOWN_FRAME_TYPE',
          message: 'Unrecognized frame type: ' + unknownType,
        });
      }
    }
  }

  private handleInterrupt(ws: WebSocket, session: VoiceWsSession, frame: { type: 'interrupt'; generationToken?: number; reason?: string }): void {
    // Invalidate generation token
    session.generationToken += 1;

    // Abort active TTS streaming pipeline immediately
    if (session.activeAbortController) {
      try {
        session.activeAbortController.abort();
      } catch {}
      session.activeAbortController = null;
    }

    // Acknowledge interrupt frame
    this.send(ws, {
      type: 'interrupted',
      generationToken: session.generationToken,
      reason: frame.reason || 'user_barge_in',
    });
  }

  private async handleSynthesize(
    ws: WebSocket, 
    session: VoiceWsSession, 
    frame: { text: string; persona?: string; emotion?: string; tone?: string; generationToken?: number; swarmAgentId?: SwarmAgentId; voiceId?: string }
  ): Promise<void> {
    if (!frame.text || !frame.text.trim()) {
      this.send(ws, {
        type: 'error',
        code: 'EMPTY_TEXT',
        message: 'Text payload is required for speech synthesis',
      });
      return;
    }

    // Cancel any previous synthesis
    if (session.activeAbortController) {
      try { session.activeAbortController.abort(); } catch {}
    }

    const abortController = new AbortController();
    session.activeAbortController = abortController;

    const token = typeof frame.generationToken === 'number' && frame.generationToken >= 0
      ? frame.generationToken
      : ++session.generationToken;
    session.generationToken = token;

    // Swarm Agent Classification & Voice Parameter Extraction
    const requestedSwarmAgent = frame.swarmAgentId || session.swarmAgentId;
    const swarmConfig = classifySwarmVoiceAgent(frame.text, requestedSwarmAgent);
    const analysis = classifyVoiceIntentAndEmotion(frame.text);
    const personaKey = (frame.persona as BasePersona) || swarmConfig.persona || analysis.basePersona || session.persona;
    const emotionKey = (frame.emotion || frame.tone || swarmConfig.defaultTone || analysis.emotion || session.emotion) as EmotionalTone;
    const targetVoiceId = frame.voiceId || swarmConfig.voiceId;

    const profile = PERSONA_PROFILES[personaKey] || PERSONA_PROFILES.general_conversation;
    const spatialPanVal = typeof swarmConfig.spatialPanValue === 'number'
      ? swarmConfig.spatialPanValue
      : (profile.spatialPan === 'left' ? -0.35 : (profile.spatialPan === 'right' ? 0.35 : 0.0));

    // Send audio_start frame with full Swarm Agent metadata
    this.send(ws, {
      type: 'audio_start',
      generationToken: token,
      persona: profile.name,
      soundscape: swarmConfig.soundscape || profile.soundscape,
      spatialPan: spatialPanVal,
      agentId: swarmConfig.id,
      agentName: swarmConfig.name,
      agentTitle: swarmConfig.title,
      agentBadge: swarmConfig.badge,
      themeColor: swarmConfig.themeColor,
      glowColor: swarmConfig.glowColor,
      voiceId: targetVoiceId,
    });

    const startTime = Date.now();

    // If ElevenLabs is configured, stream real audio chunks
    if (elevenLabsTTS.isConfigured) {
      try {
        let seq = 0;
        await elevenLabsTTS.streamSpeechChunks(
          frame.text,
          (chunk: Buffer) => {
            if (abortController.signal.aborted || session.generationToken !== token) return;
            this.send(ws, {
              type: 'audio_chunk',
              generationToken: token,
              chunk: chunk.toString('base64'),
              seq: ++seq,
            });
          },
          {
            persona: personaKey,
            tone: emotionKey,
            voiceId: targetVoiceId,
            speed: swarmConfig.speed,
            stability: swarmConfig.stability,
            similarity_boost: swarmConfig.similarity_boost,
            style: swarmConfig.style,
            signal: abortController.signal,
          }
        );

        if (!abortController.signal.aborted && session.generationToken === token) {
          this.send(ws, {
            type: 'audio_end',
            generationToken: token,
            durationMs: Date.now() - startTime,
          });
        }
      } catch (err: any) {
        if (!abortController.signal.aborted && session.generationToken === token) {
          this.send(ws, {
            type: 'error',
            code: 'TTS_FAILED',
            message: err.message || 'TTS streaming failure',
            fallback: 'browser',
          });
        }
      }
    } else {
      // Fallback: Notify client to speak locally or end stream
      this.send(ws, {
        type: 'audio_end',
        generationToken: token,
        durationMs: Date.now() - startTime,
      });
    }

    if (session.activeAbortController === abortController) {
      session.activeAbortController = null;
    }
  }

  private handleBinaryAudioChunk(ws: WebSocket, session: VoiceWsSession, buffer: Buffer): void {
    const base64 = buffer.toString('base64');
    session.audioChunksBuffer.push({
      seq: session.audioChunksBuffer.length + 1,
      data: base64,
    });
  }

  private send(ws: WebSocket, payload: ServerFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch (e) {
        console.warn('[VoiceWS] Send failed:', e);
      }
    }
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.sessions.clear();
  }
}

export const voiceWsManager = new VoiceWebSocketManager();

export function setupVoiceWebSocket(server: http.Server): WebSocketServer {
  return voiceWsManager.mount(server);
}
