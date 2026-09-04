import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db';
import { computeEarningsTier } from '../routes/leaderboard';

export interface LeaderboardWsClient {
  ws: WebSocket;
  isAlive: boolean;
  subscribedAt: string;
}

export class LeaderboardWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<LeaderboardWsClient> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;

  /**
   * Mount WebSocket server on path /ws/leaderboard
   */
  public mount(server: http.Server, wsPath: string = '/ws/leaderboard'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: wsPath });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat ping/pong sweep every 25 seconds
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.clients.forEach(client => {
        if (!client.isAlive) {
          try { client.ws.terminate(); } catch {}
          this.clients.delete(client);
          return;
        }
        client.isAlive = false;
        try { client.ws.ping(); } catch {}
      });
      // Broadcast live viewer count
      this.broadcastViewerCount();
    }, 25000);

    // Periodic simulation activity stream tick every 8 seconds to ensure live feeling
    this.simulationInterval = setInterval(() => {
      this.tickSimulationActivity();
    }, 8000);

    return this.wss;
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const client: LeaderboardWsClient = {
      ws,
      isAlive: true,
      subscribedAt: new Date().toISOString(),
    };

    this.clients.add(client);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    // Send initial snapshot
    this.sendInitialSnapshot(ws);

    ws.on('message', (data: any) => {
      client.isAlive = true;
      try {
        const raw = typeof data === 'string' ? data : data.toString('utf8');
        const frame = JSON.parse(raw);

        if (frame.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            clientTimestamp: frame.timestamp || Date.now(),
            serverTimestamp: Date.now(),
          }));
        } else if (frame.type === 'request_refresh') {
          this.sendInitialSnapshot(ws);
        }
      } catch (e) {
        // Ignore malformed ping frames
      }
    });

    ws.on('close', () => {
      this.clients.delete(client);
      this.broadcastViewerCount();
    });

    ws.on('error', (err) => {
      console.warn('[LeaderboardWS] Socket error:', err.message);
      this.clients.delete(client);
      this.broadcastViewerCount();
    });
  }

  /**
   * Fetch current top creators snapshot from SQLite
   */
  private getTopCreatorsSnapshot() {
    try {
      const rawUsers = db.prepare(`
        SELECT
          u.id as user_id,
          u.display_name,
          u.xp,
          u.level,
          u.streak_days,
          u.referral_count,
          COALESCE(
            (SELECT SUM(es.gross_cents) FROM earnings_snapshots es WHERE es.user_id = u.id),
            (SELECT SUM(a.balance_cents) FROM accounts a WHERE a.user_id = u.id AND a.is_liability = 0),
            0
          ) as total_earnings_cents,
          s.id as syndicate_id,
          s.name as syndicate_name,
          s.tag as syndicate_tag,
          s.emblem_sigil as syndicate_emblem
        FROM users u
        LEFT JOIN syndicate_members sm ON sm.user_id = u.id
        LEFT JOIN syndicates s ON s.id = sm.syndicate_id
        GROUP BY u.id
        ORDER BY total_earnings_cents DESC, u.xp DESC
        LIMIT 100
      `).all() as any[];

      return rawUsers.map((u, index) => ({
        rank: index + 1,
        user_id: u.user_id,
        display_name: u.display_name,
        xp: Number(u.xp || 0),
        level: Number(u.level || 1),
        streak_days: Number(u.streak_days || 1),
        referral_count: Number(u.referral_count || 0),
        total_earnings_cents: Number(u.total_earnings_cents || 0),
        tier: computeEarningsTier(Number(u.total_earnings_cents || 0)).tier,
        syndicate_tag: u.syndicate_tag || null,
        syndicate_emblem: u.syndicate_emblem || null,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Send full initial state payload to new client
   */
  private sendInitialSnapshot(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    const top100 = this.getTopCreatorsSnapshot();
    const liveViewerCount = Math.max(1, this.clients.size);

    const payload = {
      type: 'leaderboard_init',
      data: {
        top100,
        liveViewerCount,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch {}
  }

  /**
   * Broadcast viewer count to all clients
   */
  private broadcastViewerCount(): void {
    const liveViewerCount = Math.max(1, this.clients.size);
    const payload = JSON.stringify({
      type: 'viewer_count_update',
      liveViewerCount,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try { client.ws.send(payload); } catch {}
      }
    }
  }

  /**
   * Broadcast real-time event / activity (e.g. commission earned, rank shifted, badge unlocked)
   */
  public broadcastLeaderboardUpdate(event: {
    eventType: 'commission_earned' | 'rank_shift' | 'badge_unlocked' | 'syndicate_score_boost';
    userId?: string;
    displayName?: string;
    amountCents?: number;
    badgeName?: string;
    syndicateTag?: string;
    message: string;
  }): void {
    const payload = JSON.stringify({
      type: 'leaderboard_live_event',
      event,
      top100: this.getTopCreatorsSnapshot(),
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try { client.ws.send(payload); } catch {}
      }
    }
  }

  /**
   * Simulate occasional activity tick to demonstrate real-time updates
   */
  private tickSimulationActivity(): void {
    if (this.clients.size === 0) return;

    const sampleCreators = [
      { name: '@SovereignAura', tag: 'VRTX', badge: 'Diamond Titan' },
      { name: '@CryptoPhoenix', tag: 'APEX', badge: '100+ Referral Army' },
      { name: '@ViralVelocity', tag: 'PLSE', badge: 'Viral Alchemist' },
      { name: '@QuantumStacker', tag: 'QNTM', badge: 'Voice AI Pioneer' },
      { name: '@AlexChampion', tag: 'VRTX', badge: 'Apex Sovereign' },
    ];

    const randomCreator = sampleCreators[Math.floor(Math.random() * sampleCreators.length)];
    const randomCents = [1500, 2500, 5000, 10000, 30000][Math.floor(Math.random() * 5)];

    this.broadcastLeaderboardUpdate({
      eventType: 'commission_earned',
      displayName: randomCreator.name,
      syndicateTag: randomCreator.tag,
      amountCents: randomCents,
      message: `⚡ ${randomCreator.name} [${randomCreator.tag}] earned +$${(randomCents / 100).toFixed(2)} commission!`,
    });
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
  }
}

export const leaderboardWsManager = new LeaderboardWebSocketManager();

export function setupLeaderboardWebSocket(server: http.Server): WebSocketServer {
  return leaderboardWsManager.mount(server);
}
