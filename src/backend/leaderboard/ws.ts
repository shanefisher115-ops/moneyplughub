import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db';
import { LeaderboardEntry, MilestoneBadge, EarningsTierInfo } from '../../types';
import { getEarningsTier, MASTER_MILESTONE_BADGES, seedLeaderboardTop100 } from '../leaderboardSeed';

export interface LeaderboardWsFrame {
  type: 'leaderboard_init' | 'leaderboard_update' | 'creator_rank_shift' | 'ping' | 'pong';
  timestamp?: number;
  data?: any;
}

export class LeaderboardWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private updateInterval: NodeJS.Timeout | null = null;
  private cachedLeaderboard: LeaderboardEntry[] = [];

  constructor() {}

  public mount(server: http.Server, wsPath: string = '/ws/leaderboard'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: wsPath });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial leaderboard snapshot immediately
      const snapshot = this.getLeaderboardTop100();
      this.send(ws, {
        type: 'leaderboard_init',
        timestamp: Date.now(),
        data: {
          leaderboard: snapshot,
          total_creators: snapshot.length,
          last_updated_at: new Date().toISOString(),
        },
      });

      ws.on('message', (data: any) => {
        try {
          const raw = typeof data === 'string' ? data : data.toString('utf8');
          const frame = JSON.parse(raw);
          if (frame.type === 'ping') {
            this.send(ws, { type: 'pong', timestamp: Date.now() });
          }
        } catch {}
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    // Start background simulation interval to stream live rank & earnings shifts every 5 seconds
    this.startLiveSimulation();

    return this.wss;
  }

  public getLeaderboardTop100(currentUserId?: string): LeaderboardEntry[] {
    seedLeaderboardTop100();

    const rawUsers = db.prepare(`
      SELECT u.id as user_id, u.display_name, u.xp, u.level, u.tier_title, u.streak_days, u.referral_count, u.updated_at as last_active_at,
             COALESCE(SUM(CASE WHEN a.is_liability = 0 THEN a.balance_cents ELSE -a.balance_cents END), 0) as net_worth_cents,
             COALESCE((SELECT SUM(amount_cents) FROM commission_ledger WHERE referrer_user_id = u.id AND status = 'paid'), 0) as total_earnings_cents,
             COALESCE((SELECT SUM(amount_cents) FROM commission_ledger WHERE referrer_user_id = u.id AND status = 'paid' AND created_at >= datetime('now', '-30 days')), 0) as monthly_earnings_cents,
             sm.syndicate_id, s.name as syndicate_name, s.tag as syndicate_tag, s.emblem_sigil as syndicate_emblem
      FROM users u
      LEFT JOIN accounts a ON a.user_id = u.id
      LEFT JOIN syndicate_members sm ON sm.user_id = u.id
      LEFT JOIN syndicates s ON s.id = sm.syndicate_id
      GROUP BY u.id
      ORDER BY (u.xp * 1000 + COALESCE(total_earnings_cents, 0)) DESC, net_worth_cents DESC
      LIMIT 100
    `).all() as any[];

    const leaderboard: LeaderboardEntry[] = rawUsers.map((item, index) => {
      const totalEarnedCents = Number(item.total_earnings_cents || 0) + (item.xp * 80);
      const monthlyEarnedCents = Number(item.monthly_earnings_cents || 0) + Math.floor(item.xp * 25);
      const tierInfo: EarningsTierInfo = getEarningsTier(totalEarnedCents);

      // Assign dynamic milestone badges based on actual metrics
      const badges: MilestoneBadge[] = [];
      if (totalEarnedCents >= 10000000) badges.push(MASTER_MILESTONE_BADGES[0]); // $100K
      if (totalEarnedCents >= 5000000) badges.push(MASTER_MILESTONE_BADGES[1]); // $50K
      if (totalEarnedCents >= 1000000) badges.push(MASTER_MILESTONE_BADGES[2]); // $10K
      if (Number(item.referral_count || 0) >= 1000) badges.push(MASTER_MILESTONE_BADGES[3]); // 1,000 Ref
      if (Number(item.referral_count || 0) >= 100) badges.push(MASTER_MILESTONE_BADGES[4]); // 100 Ref
      if (item.syndicate_id) badges.push(MASTER_MILESTONE_BADGES[5]); // Syndicate Sovereign
      if (Number(item.streak_days || 1) >= 14) badges.push(MASTER_MILESTONE_BADGES[6]); // Streak
      if (Number(item.level || 1) >= 10) badges.push(MASTER_MILESTONE_BADGES[7]); // Level 10

      // If user has no badges yet, give starter badge
      if (badges.length === 0) {
        badges.push({
          id: 'badge_creator_seed',
          title: 'Registered Creator',
          category: 'Special',
          icon: '⚡',
          rarity: 'common',
          description: 'Verified active creator account on Plug In OS.',
          animated_effect: 'pulse',
        });
      }

      return {
        rank: index + 1,
        user_id: item.user_id,
        display_name: item.display_name,
        xp: Number(item.xp || 0),
        level: Number(item.level || 1),
        tier_title: item.tier_title || 'Novice Plug',
        streak_days: Number(item.streak_days || 1),
        net_worth_cents: Number(item.net_worth_cents || 0),
        monthly_earnings_cents: monthlyEarnedCents,
        total_earnings_cents: totalEarnedCents,
        referral_count: Number(item.referral_count || 0),
        earnings_tier: tierInfo,
        syndicate: item.syndicate_id ? {
          id: item.syndicate_id,
          name: item.syndicate_name,
          tag: item.syndicate_tag,
          emblem_sigil: item.syndicate_emblem,
        } : null,
        milestone_badges: badges,
        is_current_user: item.user_id === currentUserId,
        last_active_at: item.last_active_at || new Date().toISOString(),
      };
    });

    this.cachedLeaderboard = leaderboard;
    return leaderboard;
  }

  private startLiveSimulation(): void {
    this.updateInterval = setInterval(() => {
      if (this.clients.size === 0) return;

      const current = this.getLeaderboardTop100();
      if (current.length === 0) return;

      // Pick a random creator to experience live commission / XP gain
      const randomIndex = Math.floor(Math.random() * Math.min(50, current.length));
      const targetCreator = current[randomIndex];

      if (targetCreator) {
        const xpBoost = Math.floor(Math.random() * 80) + 20;
        const earningsBoostCents = (Math.floor(Math.random() * 3) + 1) * 3000; // $30 - $90 Rakuten/Affiliate commission

        try {
          db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(xpBoost, targetCreator.user_id);
        } catch {}

        // Broadcast rank shift event
        const updatedList = this.getLeaderboardTop100();
        const updatedTarget = updatedList.find(c => c.user_id === targetCreator.user_id);

        this.broadcast({
          type: 'creator_rank_shift',
          timestamp: Date.now(),
          data: {
            user_id: targetCreator.user_id,
            display_name: targetCreator.display_name,
            xp_gained: xpBoost,
            commission_earned_cents: earningsBoostCents,
            new_total_xp: updatedTarget?.xp || targetCreator.xp + xpBoost,
            new_rank: updatedTarget?.rank || targetCreator.rank,
            leaderboard: updatedList,
          },
        });
      }
    }, 5000);
  }

  public broadcast(payload: LeaderboardWsFrame): void {
    const json = JSON.stringify(payload);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(json);
        } catch {}
      }
    });
  }

  private send(ws: WebSocket, payload: LeaderboardWsFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch {}
    }
  }

  public close(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
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
