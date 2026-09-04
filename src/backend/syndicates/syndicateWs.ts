import http from 'http';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config';
import { db } from '../db';
import { isWealthTierAccessGranted, getTierRank, ensureDefaultSyndicateChannels } from '../routes/syndicates';
import { SyndicateChannel, SyndicateMessage } from '../../types';

export interface SyndicateWsSession {
  sessionId: string;
  userId: string | null;
  displayName: string | null;
  tierTitle: string;
  level: number;
  syndicateId: string | null;
  joinedChannels: Set<string>;
  isAlive: boolean;
  voiceState: {
    isMuted: boolean;
    isDeafened: boolean;
    isSpeaking: boolean;
  };
}

export type SyndicateClientFrame =
  | { type: 'session_init'; token?: string }
  | { type: 'join_channel'; channel_id: string }
  | { type: 'leave_channel'; channel_id: string }
  | { type: 'send_message'; channel_id: string; encrypted_content: string }
  | { type: 'webrtc_offer'; channel_id: string; target_user_id: string; offer: any }
  | { type: 'webrtc_answer'; channel_id: string; target_user_id: string; answer: any }
  | { type: 'webrtc_candidate'; channel_id: string; target_user_id: string; candidate: any }
  | { type: 'voice_state_update'; channel_id: string; is_muted?: boolean; is_deafened?: boolean; is_speaking?: boolean }
  | { type: 'ping'; clientTimestamp?: number };

export type SyndicateServerFrame =
  | { type: 'session_ready'; sessionId: string; user_id: string; display_name: string; tier_title: string; level: number; syndicate_id: string | null; channels: SyndicateChannel[] }
  | { type: 'channel_joined'; channel_id: string; channel_type: string; required_tier: string; members: Array<{ user_id: string; display_name: string; tier_title: string; level: number; voiceState?: any }> }
  | { type: 'access_denied'; code: string; channel_id: string; required_tier: string; required_level: number; message: string }
  | { type: 'user_joined'; channel_id: string; user_id: string; display_name: string; tier_title: string; level: number }
  | { type: 'user_left'; channel_id: string; user_id: string }
  | { type: 'message'; message: SyndicateMessage }
  | { type: 'webrtc_offer'; channel_id: string; sender_user_id: string; offer: any }
  | { type: 'webrtc_answer'; channel_id: string; sender_user_id: string; answer: any }
  | { type: 'webrtc_candidate'; channel_id: string; sender_user_id: string; candidate: any }
  | { type: 'voice_state_update'; channel_id: string; user_id: string; is_muted: boolean; is_deafened: boolean; is_speaking: boolean }
  | { type: 'pong'; clientTimestamp: number; serverTimestamp: number }
  | { type: 'error'; code: string; message: string };

export class SyndicateWebSocketManager {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<WebSocket, SyndicateWsSession>();
  private channelRooms = new Map<string, Set<WebSocket>>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public mount(server: http.Server, wsPath: string = '/ws/syndicates'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: wsPath });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws: WebSocket) => {
        const session = this.sessions.get(ws);
        if (!session) return;
        if (!session.isAlive) {
          try { ws.terminate(); } catch {}
          this.cleanupSocket(ws);
          return;
        }
        session.isAlive = false;
        try { ws.ping(); } catch {}
      });
    }, 25000);

    return this.wss;
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const sessionId = 'sess_syn_' + crypto.randomBytes(8).toString('hex');
    const session: SyndicateWsSession = {
      sessionId,
      userId: null,
      displayName: null,
      tierTitle: 'Novice Plug',
      level: 1,
      syndicateId: null,
      joinedChannels: new Set<string>(),
      isAlive: true,
      voiceState: {
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
      },
    };

    this.sessions.set(ws, session);

    // Extract token from query params if available
    if (req.url) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        const queryToken = urlObj.searchParams.get('token');
        if (queryToken) {
          this.authenticateSession(ws, session, queryToken);
        }
      } catch {}
    }

    ws.on('pong', () => {
      const s = this.sessions.get(ws);
      if (s) s.isAlive = true;
    });

    ws.on('message', async (data: any) => {
      const s = this.sessions.get(ws);
      if (!s) return;
      s.isAlive = true;

      let frame: SyndicateClientFrame;
      try {
        const raw = typeof data === 'string' ? data : data.toString('utf8');
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
      this.cleanupSocket(ws);
    });

    ws.on('error', (err) => {
      console.warn('[SyndicateWS] Socket error:', err.message);
      this.cleanupSocket(ws);
    });
  }

  private authenticateSession(ws: WebSocket, session: SyndicateWsSession, token: string): boolean {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      if (!decoded || !decoded.userId) return false;

      const userRow = db.prepare('SELECT id, display_name, level, tier_title FROM users WHERE id = ?').get(decoded.userId) as any;
      if (!userRow) return false;

      session.userId = userRow.id;
      session.displayName = userRow.display_name || 'Operative';
      session.level = Number(userRow.level || 1);
      session.tierTitle = userRow.tier_title || 'Novice Plug';

      // Check syndicate membership
      const membership = db.prepare('SELECT syndicate_id FROM syndicate_members WHERE user_id = ?').get(userRow.id) as { syndicate_id: string } | undefined;
      session.syndicateId = membership?.syndicate_id || null;

      return true;
    } catch {
      return false;
    }
  }

  private async handleClientFrame(ws: WebSocket, session: SyndicateWsSession, frame: SyndicateClientFrame): Promise<void> {
    switch (frame.type) {
      case 'session_init': {
        if (frame.token) {
          const ok = this.authenticateSession(ws, session, frame.token);
          if (!ok) {
            this.send(ws, {
              type: 'error',
              code: 'AUTH_FAILED',
              message: 'Invalid or expired JWT token',
            });
            return;
          }
        }

        if (!session.userId) {
          this.send(ws, {
            type: 'error',
            code: 'AUTH_REQUIRED',
            message: 'Session token required for authentication',
          });
          return;
        }

        let channels: SyndicateChannel[] = [];
        if (session.syndicateId) {
          ensureDefaultSyndicateChannels(session.syndicateId);
          const rawChannels = db.prepare('SELECT * FROM syndicate_channels WHERE syndicate_id = ? ORDER BY required_level ASC, created_at ASC').all(session.syndicateId) as unknown as SyndicateChannel[];
          channels = rawChannels.map(c => ({
            ...c,
            unlocked: isWealthTierAccessGranted(session.level, session.tierTitle, c.required_level, c.required_tier),
          }));
        }

        this.send(ws, {
          type: 'session_ready',
          sessionId: session.sessionId,
          user_id: session.userId,
          display_name: session.displayName || 'Operative',
          tier_title: session.tierTitle,
          level: session.level,
          syndicate_id: session.syndicateId,
          channels,
        });
        break;
      }

      case 'join_channel': {
        if (!session.userId) {
          this.send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' });
          return;
        }

        const channelId = frame.channel_id;
        const channel = db.prepare('SELECT * FROM syndicate_channels WHERE id = ?').get(channelId) as SyndicateChannel | undefined;
        if (!channel) {
          this.send(ws, { type: 'error', code: 'CHANNEL_NOT_FOUND', message: 'Syndicate channel not found' });
          return;
        }

        // Verify membership in syndicate
        if (channel.syndicate_id !== session.syndicateId) {
          this.send(ws, { type: 'error', code: 'FORBIDDEN', message: 'You are not a member of this syndicate' });
          return;
        }

        // Server-side Wealth Tier badge access verification
        const hasAccess = isWealthTierAccessGranted(session.level, session.tierTitle, channel.required_level, channel.required_tier);
        if (!hasAccess) {
          this.send(ws, {
            type: 'access_denied',
            code: 'TOKEN_GATED_ACCESS_DENIED',
            channel_id: channelId,
            required_tier: channel.required_tier,
            required_level: channel.required_level,
            message: `Access denied: Channel "${channel.name}" is token-gated by Wealth Tier Badge [${channel.required_tier}] (Level ${channel.required_level}+).`,
          });
          return;
        }

        // Join channel room
        if (!this.channelRooms.has(channelId)) {
          this.channelRooms.set(channelId, new Set<WebSocket>());
        }
        const room = this.channelRooms.get(channelId)!;
        room.add(ws);
        session.joinedChannels.add(channelId);

        // Build member list
        const roomMembers: Array<{ user_id: string; display_name: string; tier_title: string; level: number; voiceState?: any }> = [];
        room.forEach(clientWs => {
          const s = this.sessions.get(clientWs);
          if (s && s.userId) {
            roomMembers.push({
              user_id: s.userId,
              display_name: s.displayName || 'Operative',
              tier_title: s.tierTitle,
              level: s.level,
              voiceState: s.voiceState,
            });
          }
        });

        this.send(ws, {
          type: 'channel_joined',
          channel_id: channelId,
          channel_type: channel.type,
          required_tier: channel.required_tier,
          members: roomMembers,
        });

        // Broadcast user_joined to other members in room
        this.broadcastToRoom(channelId, {
          type: 'user_joined',
          channel_id: channelId,
          user_id: session.userId,
          display_name: session.displayName || 'Operative',
          tier_title: session.tierTitle,
          level: session.level,
        }, ws);

        break;
      }

      case 'leave_channel': {
        const channelId = frame.channel_id;
        this.leaveRoom(ws, session, channelId);
        break;
      }

      case 'send_message': {
        if (!session.userId) {
          this.send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' });
          return;
        }

        const channelId = frame.channel_id;
        if (!session.joinedChannels.has(channelId)) {
          this.send(ws, { type: 'error', code: 'NOT_IN_CHANNEL', message: 'You must join channel before sending messages' });
          return;
        }

        const channel = db.prepare('SELECT * FROM syndicate_channels WHERE id = ?').get(channelId) as SyndicateChannel | undefined;
        if (!channel) {
          this.send(ws, { type: 'error', code: 'CHANNEL_NOT_FOUND', message: 'Channel not found' });
          return;
        }

        // Verify Wealth Tier access again for message submission
        if (!isWealthTierAccessGranted(session.level, session.tierTitle, channel.required_level, channel.required_tier)) {
          this.send(ws, {
            type: 'access_denied',
            code: 'TOKEN_GATED_ACCESS_DENIED',
            channel_id: channelId,
            required_tier: channel.required_tier,
            required_level: channel.required_level,
            message: 'Access denied: Wealth Tier requirement not met.',
          });
          return;
        }

        const msgId = `msg_${channelId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const timestamp = new Date().toISOString();

        db.prepare(`
          INSERT INTO syndicate_messages (
            id, channel_id, syndicate_id, sender_id, encrypted_content, is_encrypted, timestamp
          ) VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(msgId, channelId, channel.syndicate_id, session.userId, frame.encrypted_content, timestamp);

        const outboundMessage: SyndicateMessage = {
          id: msgId,
          channel_id: channelId,
          syndicate_id: channel.syndicate_id,
          sender_id: session.userId,
          sender_name: session.displayName || 'Operative',
          sender_tier: session.tierTitle,
          sender_level: session.level,
          encrypted_content: frame.encrypted_content,
          is_encrypted: true,
          timestamp,
        };

        this.broadcastToRoom(channelId, {
          type: 'message',
          message: outboundMessage,
        });

        break;
      }

      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_candidate': {
        if (!session.userId) return;
        const channelId = frame.channel_id;
        if (!session.joinedChannels.has(channelId)) return;

        // Route WebRTC signaling payload directly to target peer socket
        const targetWs = this.findSocketByUserIdInRoom(channelId, frame.target_user_id);
        if (targetWs) {
          if (frame.type === 'webrtc_offer') {
            this.send(targetWs, {
              type: 'webrtc_offer',
              channel_id: channelId,
              sender_user_id: session.userId,
              offer: frame.offer,
            });
          } else if (frame.type === 'webrtc_answer') {
            this.send(targetWs, {
              type: 'webrtc_answer',
              channel_id: channelId,
              sender_user_id: session.userId,
              answer: frame.answer,
            });
          } else if (frame.type === 'webrtc_candidate') {
            this.send(targetWs, {
              type: 'webrtc_candidate',
              channel_id: channelId,
              sender_user_id: session.userId,
              candidate: frame.candidate,
            });
          }
        }
        break;
      }

      case 'voice_state_update': {
        if (!session.userId) return;
        const channelId = frame.channel_id;
        if (!session.joinedChannels.has(channelId)) return;

        if (typeof frame.is_muted === 'boolean') session.voiceState.isMuted = frame.is_muted;
        if (typeof frame.is_deafened === 'boolean') session.voiceState.isDeafened = frame.is_deafened;
        if (typeof frame.is_speaking === 'boolean') session.voiceState.isSpeaking = frame.is_speaking;

        this.broadcastToRoom(channelId, {
          type: 'voice_state_update',
          channel_id: channelId,
          user_id: session.userId,
          is_muted: session.voiceState.isMuted,
          is_deafened: session.voiceState.isDeafened,
          is_speaking: session.voiceState.isSpeaking,
        });
        break;
      }

      case 'ping': {
        const clientTs = frame.clientTimestamp || Date.now();
        this.send(ws, {
          type: 'pong',
          clientTimestamp: clientTs,
          serverTimestamp: Date.now(),
        });
        break;
      }

      default: {
        this.send(ws, {
          type: 'error',
          code: 'UNKNOWN_FRAME_TYPE',
          message: 'Unrecognized syndicate frame type: ' + (frame as any).type,
        });
      }
    }
  }

  private leaveRoom(ws: WebSocket, session: SyndicateWsSession, channelId: string): void {
    if (session.joinedChannels.has(channelId)) {
      session.joinedChannels.delete(channelId);
      const room = this.channelRooms.get(channelId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          this.channelRooms.delete(channelId);
        } else if (session.userId) {
          this.broadcastToRoom(channelId, {
            type: 'user_left',
            channel_id: channelId,
            user_id: session.userId,
          });
        }
      }
    }
  }

  private findSocketByUserIdInRoom(channelId: string, userId: string): WebSocket | null {
    const room = this.channelRooms.get(channelId);
    if (!room) return null;
    for (const ws of room) {
      const s = this.sessions.get(ws);
      if (s && s.userId === userId) {
        return ws;
      }
    }
    return null;
  }

  private broadcastToRoom(channelId: string, payload: SyndicateServerFrame, excludeWs?: WebSocket): void {
    const room = this.channelRooms.get(channelId);
    if (!room) return;
    const jsonStr = JSON.stringify(payload);
    room.forEach(ws => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        try { ws.send(jsonStr); } catch {}
      }
    });
  }

  private send(ws: WebSocket, payload: SyndicateServerFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch (e) {
        console.warn('[SyndicateWS] Send failed:', e);
      }
    }
  }

  private cleanupSocket(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (session) {
      session.joinedChannels.forEach(channelId => {
        this.leaveRoom(ws, session, channelId);
      });
      this.sessions.delete(ws);
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
    this.channelRooms.clear();
  }
}

export const syndicateWsManager = new SyndicateWebSocketManager();

export function setupSyndicateWebSocket(server: http.Server): WebSocketServer {
  return syndicateWsManager.mount(server);
}
