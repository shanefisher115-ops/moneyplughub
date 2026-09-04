/**
 * Token-Gated Syndicate Chat & Voice Rooms WebSocket Server
 * Path: src/backend/syndicateWs.ts
 */

import http from 'http';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import { db } from './db';
import { resolveUserWealthTier, WEALTH_TIERS, WealthTierConfig } from './routes/xpEconomy';

export interface SyndicateSession {
  sessionId: string;
  isAlive: boolean;
  authenticated: boolean;
  userId: string | null;
  userName: string;
  syndicateId: string | null;
  channelId: string | null;
  tier: WealthTierConfig;
}

export type ClientSyndicateFrame =
  | { type: 'auth'; token: string; syndicateId: string }
  | { type: 'join_channel'; channelId: string }
  | { type: 'leave_channel'; channelId?: string }
  | { type: 'send_message'; channelId: string; encryptedPayload: string; iv: string }
  | { type: 'webrtc_signal'; channelId: string; targetUserId?: string; signalType: 'offer' | 'answer' | 'ice_candidate' | 'voice_state'; signalData: any }
  | { type: 'voice_state'; channelId: string; isMuted: boolean; isSpeaking: boolean }
  | { type: 'ping' };

export type ServerSyndicateFrame =
  | { type: 'auth_success'; userId: string; userName: string; syndicateId: string; tier: WealthTierConfig }
  | { type: 'channel_joined'; channelId: string; channelName: string; channelType: 'text' | 'voice'; minWealthTier: number; activeUsers: Array<{ userId: string; userName: string; tier: WealthTierConfig; isMuted?: boolean; isSpeaking?: boolean }> }
  | { type: 'channel_left'; channelId: string }
  | { type: 'chat_message'; message: { id: string; syndicateId: string; channelId: string; senderId: string; senderName: string; senderTierLevel: number; senderTierName: string; senderTierColor: string; encryptedPayload: string; iv: string; createdAt: string } }
  | { type: 'webrtc_signal'; channelId: string; senderId: string; senderName: string; senderTier: WealthTierConfig; signalType: 'offer' | 'answer' | 'ice_candidate' | 'voice_state'; signalData: any }
  | { type: 'user_joined'; channelId: string; user: { userId: string; userName: string; tier: WealthTierConfig } }
  | { type: 'user_left'; channelId: string; userId: string }
  | { type: 'voice_presence_update'; channelId: string; users: Array<{ userId: string; userName: string; tier: WealthTierConfig; isMuted: boolean; isSpeaking: boolean }> }
  | { type: 'access_denied'; code: string; message: string; requiredTier?: WealthTierConfig; userTier?: WealthTierConfig }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

export class SyndicateWebSocketManager {
  private wss: WebSocketServer | null = null;
  private sessions = new Map<WebSocket, SyndicateSession>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private voiceStates = new Map<string, { isMuted: boolean; isSpeaking: boolean }>(); // key: `${userId}:${channelId}`

  public mount(server: http.Server, wsPath: string = '/ws/syndicate'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: wsPath });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws: WebSocket) => {
        const session = this.sessions.get(ws);
        if (!session) return;
        if (!session.isAlive) {
          try { ws.terminate(); } catch {}
          this.cleanupSession(ws);
          return;
        }
        session.isAlive = false;
        try { ws.ping(); } catch {}
      });
    }, 25000);

    return this.wss;
  }

  private handleConnection(ws: WebSocket): void {
    const session: SyndicateSession = {
      sessionId: 'sess_syn_' + crypto.randomBytes(8).toString('hex'),
      isAlive: true,
      authenticated: false,
      userId: null,
      userName: 'Guest',
      syndicateId: null,
      channelId: null,
      tier: WEALTH_TIERS[0],
    };

    this.sessions.set(ws, session);

    ws.on('pong', () => {
      const s = this.sessions.get(ws);
      if (s) s.isAlive = true;
    });

    ws.on('message', async (data: any) => {
      const s = this.sessions.get(ws);
      if (!s) return;
      s.isAlive = true;

      let frame: ClientSyndicateFrame;
      try {
        const raw = typeof data === 'string' ? data : data.toString('utf8');
        frame = JSON.parse(raw);
      } catch {
        this.send(ws, { type: 'error', code: 'MALFORMED_FRAME', message: 'Payload must be valid JSON' });
        return;
      }

      await this.handleClientFrame(ws, s, frame);
    });

    ws.on('close', () => {
      this.cleanupSession(ws);
    });

    ws.on('error', (err) => {
      console.warn('[SyndicateWS] Socket error:', err.message);
      this.cleanupSession(ws);
    });
  }

  private cleanupSession(ws: WebSocket): void {
    const s = this.sessions.get(ws);
    if (s && s.channelId && s.userId) {
      this.broadcastToChannel(s.channelId, {
        type: 'user_left',
        channelId: s.channelId,
        userId: s.userId,
      }, ws);
      this.voiceStates.delete(`${s.userId}:${s.channelId}`);
      this.broadcastVoicePresence(s.channelId);
    }
    this.sessions.delete(ws);
  }

  private async handleClientFrame(ws: WebSocket, session: SyndicateSession, frame: ClientSyndicateFrame): Promise<void> {
    switch (frame.type) {
      case 'auth': {
        this.handleAuth(ws, session, frame);
        break;
      }

      case 'join_channel': {
        this.handleJoinChannel(ws, session, frame);
        break;
      }

      case 'leave_channel': {
        this.handleLeaveChannel(ws, session, frame);
        break;
      }

      case 'send_message': {
        this.handleSendMessage(ws, session, frame);
        break;
      }

      case 'webrtc_signal': {
        this.handleWebRtcSignal(ws, session, frame);
        break;
      }

      case 'voice_state': {
        this.handleVoiceState(ws, session, frame);
        break;
      }

      case 'ping': {
        this.send(ws, { type: 'pong' });
        break;
      }

      default: {
        this.send(ws, { type: 'error', code: 'UNKNOWN_FRAME_TYPE', message: 'Unrecognized frame type' });
      }
    }
  }

  private handleAuth(ws: WebSocket, session: SyndicateSession, frame: { token: string; syndicateId: string }): void {
    try {
      if (!frame.token) {
        this.send(ws, { type: 'error', code: 'AUTH_REQUIRED', message: 'Authentication token is required' });
        return;
      }

      const decoded = jwt.verify(frame.token, config.jwtSecret) as { userId: string };
      const userId = decoded.userId;

      // Verify user in DB
      const user = db.prepare('SELECT id, display_name, level, xp FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        this.send(ws, { type: 'error', code: 'INVALID_USER', message: 'User record not found' });
        return;
      }

      // Verify membership in syndicate
      const membership = db.prepare('SELECT role FROM syndicate_members WHERE syndicate_id = ? AND user_id = ?').get(frame.syndicateId, userId);
      if (!membership) {
        this.send(ws, { type: 'error', code: 'NOT_A_MEMBER', message: 'You are not a member of this syndicate' });
        return;
      }

      // Resolve Wealth Tier
      const netWorthRow = db.prepare(`
        SELECT SUM(CASE WHEN is_liability = 0 THEN balance_cents ELSE -balance_cents END) as net_worth_cents
        FROM accounts WHERE user_id = ?
      `).get(userId) as any;

      const tier = resolveUserWealthTier(netWorthRow?.net_worth_cents || 0, user.level || 1);

      session.authenticated = true;
      session.userId = user.id;
      session.userName = user.display_name || 'Creator Operative';
      session.syndicateId = frame.syndicateId;
      session.tier = tier;

      this.send(ws, {
        type: 'auth_success',
        userId: session.userId,
        userName: session.userName,
        syndicateId: session.syndicateId,
        tier: session.tier,
      });
    } catch (err: any) {
      this.send(ws, { type: 'error', code: 'AUTH_FAILED', message: err.message || 'Token verification failed' });
    }
  }

  private handleJoinChannel(ws: WebSocket, session: SyndicateSession, frame: { channelId: string }): void {
    if (!session.authenticated || !session.userId || !session.syndicateId) {
      this.send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Must authenticate before joining channels' });
      return;
    }

    const channel = db.prepare('SELECT * FROM syndicate_channels WHERE id = ? AND syndicate_id = ?').get(frame.channelId, session.syndicateId) as any;
    if (!channel) {
      this.send(ws, { type: 'error', code: 'CHANNEL_NOT_FOUND', message: 'Channel not found in this syndicate' });
      return;
    }

    // Token-gated Wealth Tier check
    if (session.tier.tier < channel.min_wealth_tier) {
      const reqTier = WEALTH_TIERS.find((t) => t.tier === channel.min_wealth_tier) || WEALTH_TIERS[0];
      this.send(ws, {
        type: 'access_denied',
        code: 'WEALTH_TIER_LOCKED',
        message: `Token-Gate Locked: ${reqTier.name} badge required to access #${channel.name}.`,
        requiredTier: reqTier,
        userTier: session.tier,
      });
      return;
    }

    // Leave previous channel if any
    if (session.channelId && session.channelId !== frame.channelId) {
      this.broadcastToChannel(session.channelId, {
        type: 'user_left',
        channelId: session.channelId,
        userId: session.userId,
      }, ws);
      this.voiceStates.delete(`${session.userId}:${session.channelId}`);
      this.broadcastVoicePresence(session.channelId);
    }

    session.channelId = frame.channelId;

    // Active users in channel
    const activeUsers: Array<{ userId: string; userName: string; tier: WealthTierConfig; isMuted?: boolean; isSpeaking?: boolean }> = [];
    this.sessions.forEach((s) => {
      if (s.authenticated && s.userId && s.channelId === frame.channelId) {
        const vState = this.voiceStates.get(`${s.userId}:${frame.channelId}`) || { isMuted: false, isSpeaking: false };
        activeUsers.push({
          userId: s.userId,
          userName: s.userName,
          tier: s.tier,
          isMuted: vState.isMuted,
          isSpeaking: vState.isSpeaking,
        });
      }
    });

    this.send(ws, {
      type: 'channel_joined',
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      minWealthTier: channel.min_wealth_tier,
      activeUsers,
    });

    // Notify other users in channel
    this.broadcastToChannel(frame.channelId, {
      type: 'user_joined',
      channelId: frame.channelId,
      user: {
        userId: session.userId,
        userName: session.userName,
        tier: session.tier,
      },
    }, ws);

    if (channel.type === 'voice') {
      this.voiceStates.set(`${session.userId}:${frame.channelId}`, { isMuted: false, isSpeaking: false });
      this.broadcastVoicePresence(frame.channelId);
    }
  }

  private handleLeaveChannel(ws: WebSocket, session: SyndicateSession, frame: { channelId?: string }): void {
    const chId = frame.channelId || session.channelId;
    if (chId && session.userId) {
      this.broadcastToChannel(chId, {
        type: 'user_left',
        channelId: chId,
        userId: session.userId,
      }, ws);
      this.voiceStates.delete(`${session.userId}:${chId}`);
      this.broadcastVoicePresence(chId);
      this.send(ws, { type: 'channel_left', channelId: chId });
    }
    session.channelId = null;
  }

  private handleSendMessage(ws: WebSocket, session: SyndicateSession, frame: { channelId: string; encryptedPayload: string; iv: string }): void {
    if (!session.authenticated || !session.userId || !session.syndicateId) {
      this.send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Authentication required to send messages' });
      return;
    }

    if (session.channelId !== frame.channelId) {
      this.send(ws, { type: 'error', code: 'NOT_IN_CHANNEL', message: 'You must join the channel before sending messages' });
      return;
    }

    const channel = db.prepare('SELECT min_wealth_tier FROM syndicate_channels WHERE id = ?').get(frame.channelId) as any;
    if (!channel || session.tier.tier < channel.min_wealth_tier) {
      this.send(ws, { type: 'error', code: 'TIER_LOCKED', message: 'Wealth Tier lock prevents posting in this channel' });
      return;
    }

    const msgId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = new Date().toISOString();

    // Persist encrypted message in DB
    db.prepare(`
      INSERT INTO syndicate_messages (
        id, syndicate_id, channel_id, sender_id, sender_name,
        sender_tier_level, sender_tier_name, sender_tier_color,
        encrypted_payload, iv, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msgId, session.syndicateId, frame.channelId, session.userId, session.userName,
      session.tier.tier, session.tier.name, session.tier.accentColor,
      frame.encryptedPayload, frame.iv, createdAt
    );

    const messagePayload = {
      id: msgId,
      syndicateId: session.syndicateId,
      channelId: frame.channelId,
      senderId: session.userId,
      senderName: session.userName,
      senderTierLevel: session.tier.tier,
      senderTierName: session.tier.name,
      senderTierColor: session.tier.accentColor,
      encryptedPayload: frame.encryptedPayload,
      iv: frame.iv,
      createdAt,
    };

    // Broadcast to all active sessions in the channel
    this.broadcastToChannel(frame.channelId, {
      type: 'chat_message',
      message: messagePayload,
    });
  }

  private handleWebRtcSignal(ws: WebSocket, session: SyndicateSession, frame: { channelId: string; targetUserId?: string; signalType: 'offer' | 'answer' | 'ice_candidate' | 'voice_state'; signalData: any }): void {
    if (!session.authenticated || !session.userId) {
      this.send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Authentication required for WebRTC signaling' });
      return;
    }

    if (session.channelId !== frame.channelId) {
      this.send(ws, { type: 'error', code: 'NOT_IN_CHANNEL', message: 'Must be in voice channel for signaling' });
      return;
    }

    const outbound: ServerSyndicateFrame = {
      type: 'webrtc_signal',
      channelId: frame.channelId,
      senderId: session.userId,
      senderName: session.userName,
      senderTier: session.tier,
      signalType: frame.signalType,
      signalData: frame.signalData,
    };

    if (frame.targetUserId) {
      // Direct message to specific peer
      this.sendToUserInChannel(frame.channelId, frame.targetUserId, outbound);
    } else {
      // Broadcast to room except sender
      this.broadcastToChannel(frame.channelId, outbound, ws);
    }
  }

  private handleVoiceState(ws: WebSocket, session: SyndicateSession, frame: { channelId: string; isMuted: boolean; isSpeaking: boolean }): void {
    if (!session.authenticated || !session.userId || session.channelId !== frame.channelId) return;

    this.voiceStates.set(`${session.userId}:${frame.channelId}`, {
      isMuted: frame.isMuted,
      isSpeaking: frame.isSpeaking,
    });

    this.broadcastVoicePresence(frame.channelId);
  }

  private broadcastVoicePresence(channelId: string): void {
    const participants: Array<{ userId: string; userName: string; tier: WealthTierConfig; isMuted: boolean; isSpeaking: boolean }> = [];
    this.sessions.forEach((s) => {
      if (s.authenticated && s.userId && s.channelId === channelId) {
        const state = this.voiceStates.get(`${s.userId}:${channelId}`) || { isMuted: false, isSpeaking: false };
        participants.push({
          userId: s.userId,
          userName: s.userName,
          tier: s.tier,
          isMuted: state.isMuted,
          isSpeaking: state.isSpeaking,
        });
      }
    });

    this.broadcastToChannel(channelId, {
      type: 'voice_presence_update',
      channelId,
      users: participants,
    });
  }

  private broadcastToChannel(channelId: string, payload: ServerSyndicateFrame, skipWs?: WebSocket): void {
    const json = JSON.stringify(payload);
    this.sessions.forEach((s, ws) => {
      if (ws !== skipWs && ws.readyState === WebSocket.OPEN && s.channelId === channelId) {
        try { ws.send(json); } catch {}
      }
    });
  }

  private sendToUserInChannel(channelId: string, userId: string, payload: ServerSyndicateFrame): void {
    const json = JSON.stringify(payload);
    this.sessions.forEach((s, ws) => {
      if (ws.readyState === WebSocket.OPEN && s.channelId === channelId && s.userId === userId) {
        try { ws.send(json); } catch {}
      }
    });
  }

  private send(ws: WebSocket, payload: ServerSyndicateFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(payload)); } catch {}
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
    this.voiceStates.clear();
  }
}

export const syndicateWsManager = new SyndicateWebSocketManager();

export function setupSyndicateWebSocket(server: http.Server): WebSocketServer {
  return syndicateWsManager.mount(server);
}
