import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db';
import {
  LeaderboardEntry,
  SyndicateLeaderboardEntry,
  EarningsTierInfo,
  MilestoneBadge,
  LeaderboardWsClientFrame,
  LeaderboardWsServerFrame,
  EarningsTierId,
} from '../../types';

export function getEarningsTier(totalEarningsCents: number, netWorthCents: number, xp: number): EarningsTierInfo {
  const val = Math.max(totalEarningsCents, netWorthCents, xp * 100);

  if (val >= 10000000) { // $100k+
    return {
      id: 'cosmic',
      name: 'Cosmic Apex Plug',
      min_earnings_cents: 10000000,
      color: '#A855F7', // Purple-500
      badge_icon: '🌌',
      mrr_bonus_pct: 50,
      description: 'Sovereign high-roller commanding cross-network referral matrix.',
    };
  }
  if (val >= 2500000) { // $25k+
    return {
      id: 'diamond',
      name: 'Diamond Stacker',
      min_earnings_cents: 2500000,
      color: '#38BDF8', // Sky-400
      badge_icon: '💎',
      mrr_bonus_pct: 35,
      description: 'Top-tier creator generating passive multi-channel affiliate dividends.',
    };
  }
  if (val >= 1000000) { // $10k+
    return {
      id: 'platinum',
      name: 'Platinum Sovereign',
      min_earnings_cents: 1000000,
      color: '#E2E8F0', // Slate-200
      badge_icon: '🛡️',
      mrr_bonus_pct: 25,
      description: 'Established guild operator with recurring viral distribution loops.',
    };
  }
  if (val >= 250000) { // $2.5k+
    return {
      id: 'gold',
      name: 'Gold Syndicate',
      min_earnings_cents: 250000,
      color: '#F59E0B', // Amber-500
      badge_icon: '👑',
      mrr_bonus_pct: 15,
      description: 'High-growth creator accelerating referral volume and yield.',
    };
  }
  if (val >= 50000) { // $500+
    return {
      id: 'silver',
      name: 'Silver Velocity',
      min_earnings_cents: 50000,
      color: '#94A3B8', // Slate-400
      badge_icon: '⚡',
      mrr_bonus_pct: 10,
      description: 'Active affiliate stacker scaling initial commission streams.',
    };
  }
  return {
    id: 'bronze',
    name: 'Bronze Apprentice',
    min_earnings_cents: 0,
    color: '#CD7F32', // Bronze
    badge_icon: '🌱',
    mrr_bonus_pct: 5,
    description: 'Onboarding plug building foundation for wealth ascension.',
  };
}

export function computeMilestoneBadges(user: {
  xp: number;
  referral_count: number;
  net_worth_cents: number;
  streak_days: number;
  monthly_mrr_cents: number;
  syndicate_id?: string | null;
  syndicate_role?: string | null;
}): MilestoneBadge[] {
  const badges: MilestoneBadge[] = [];

  if (user.referral_count >= 10) {
    badges.push({
      key: 'referral_master',
      label: 'Network Titan',
      icon: '🔥',
      description: 'Referred 10+ active creators to MoneyPlugHub',
      rarity: 'mythic',
      animation_effect: 'sparkle',
    });
  } else if (user.referral_count >= 3) {
    badges.push({
      key: 'referral_pioneer',
      label: 'Growth Pioneer',
      icon: '🚀',
      description: 'Referred 3+ active creators',
      rarity: 'rare',
      animation_effect: 'pulse',
    });
  }

  if (user.net_worth_cents >= 5000000) { // $50k
    badges.push({
      key: 'vault_sovereign',
      label: 'Vault Sovereign',
      icon: '🏛️',
      description: 'Built $50,000+ total net worth across linked vaults',
      rarity: 'legendary',
      animation_effect: 'glow',
    });
  } else if (user.net_worth_cents >= 1000000) { // $10k
    badges.push({
      key: 'wealth_builder',
      label: 'Wealth Builder',
      icon: '💰',
      description: 'Reached $10,000+ net worth',
      rarity: 'epic',
      animation_effect: 'shimmer',
    });
  }

  if (user.streak_days >= 7) {
    badges.push({
      key: 'streak_champion',
      label: '7D Unstoppable',
      icon: '⚡',
      description: 'Maintained a 7+ day active streak in MoneyOS',
      rarity: 'epic',
      animation_effect: 'pulse',
    });
  }

  if (user.xp >= 5000) {
    badges.push({
      key: 'xp_titan',
      label: 'Cosmic XP Overlord',
      icon: '🔮',
      description: 'Accumulated over 5,000 total XP',
      rarity: 'legendary',
      animation_effect: 'bounce',
    });
  }

  if (user.monthly_mrr_cents >= 100000) { // $1k/mo
    badges.push({
      key: 'mrr_powerhouse',
      label: '$1k MRR Club',
      icon: '📈',
      description: 'Generates over $1,000 monthly recurring revenue',
      rarity: 'mythic',
      animation_effect: 'glow',
    });
  }

  if (user.syndicate_id) {
    badges.push({
      key: 'syndicate_operator',
      label: user.syndicate_role === 'founder' ? 'Guild Commander' : 'Syndicate Member',
      icon: '🛡️',
      description: `Active operative in a creator syndicate`,
      rarity: user.syndicate_role === 'founder' ? 'legendary' : 'rare',
      animation_effect: 'shimmer',
    });
  }

  return badges;
}

export function fetchTop100Creators(currentUserId?: string | null): LeaderboardEntry[] {
  try {
    const rawUsers = db.prepare(`
      SELECT
        u.id as user_id,
        u.display_name,
        u.xp,
        u.level,
        u.tier_title,
        u.streak_days,
        u.referral_count,
        u.created_at,
        COALESCE(SUM(CASE WHEN a.is_liability = 0 THEN a.balance_cents ELSE -a.balance_cents END), 0) as net_worth_cents,
        COALESCE((
          SELECT SUM(c.amount_cents)
          FROM commissions c
          WHERE c.referrer_user_id = u.id AND c.status IN ('approved', 'paid')
        ), 0) as total_earnings_cents,
        COALESCE((
          SELECT SUM(c2.amount_cents)
          FROM commissions c2
          WHERE c2.referrer_user_id = u.id AND c2.status IN ('approved', 'paid')
            AND c2.created_at >= date('now', '-30 days')
        ), 0) + (u.referral_count * 2500) as monthly_mrr_cents,
        sm.syndicate_id,
        sm.role as syndicate_role,
        s.tag as syndicate_tag,
        s.name as syndicate_name,
        s.emblem_sigil as syndicate_emblem
      FROM users u
      LEFT JOIN accounts a ON a.user_id = u.id
      LEFT JOIN syndicate_members sm ON sm.user_id = u.id
      LEFT JOIN syndicates s ON s.id = sm.syndicate_id
      GROUP BY u.id
      ORDER BY (total_earnings_cents + u.xp * 10 + net_worth_cents / 100) DESC, u.xp DESC
      LIMIT 100
    `).all() as any[];

    return rawUsers.map((item, index) => {
      const totalEarnings = Number(item.total_earnings_cents || 0);
      const netWorth = Number(item.net_worth_cents || 0);
      const xp = Number(item.xp || 0);
      const monthlyMrr = Number(item.monthly_mrr_cents || 0);
      const earningsTier = getEarningsTier(totalEarnings, netWorth, xp);

      const badges = computeMilestoneBadges({
        xp,
        referral_count: Number(item.referral_count || 0),
        net_worth_cents: netWorth,
        streak_days: Number(item.streak_days || 1),
        monthly_mrr_cents: monthlyMrr,
        syndicate_id: item.syndicate_id,
        syndicate_role: item.syndicate_role,
      });

      return {
        rank: index + 1,
        previous_rank: index + 1,
        rank_change: 'same',
        user_id: item.user_id,
        display_name: item.display_name || 'Anonymous Plug',
        xp,
        level: Number(item.level || 1),
        tier_title: item.tier_title || 'Novice Plug',
        earnings_tier: earningsTier,
        total_earnings_cents: totalEarnings,
        monthly_mrr_cents: monthlyMrr,
        net_worth_cents: netWorth,
        streak_days: Number(item.streak_days || 1),
        referral_count: Number(item.referral_count || 0),
        syndicate_id: item.syndicate_id || null,
        syndicate_tag: item.syndicate_tag || null,
        syndicate_name: item.syndicate_name || null,
        syndicate_emblem: item.syndicate_emblem || null,
        badges,
        is_current_user: Boolean(currentUserId && item.user_id === currentUserId),
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(item.user_id)}`,
      };
    });
  } catch (err) {
    console.error('Error fetching top 100 creators:', err);
    return [];
  }
}

export function fetchTopSyndicates(currentUserId?: string | null): SyndicateLeaderboardEntry[] {
  try {
    const rows = db.prepare(`
      SELECT
        s.*,
        u.display_name as top_creator_name
      FROM syndicates s
      LEFT JOIN users u ON u.id = s.creator_id
      ORDER BY s.weekly_score DESC, s.total_net_worth_cents DESC
      LIMIT 20
    `).all() as any[];

    let userSyndicateId: string | null = null;
    if (currentUserId) {
      const mem = db.prepare('SELECT syndicate_id FROM syndicate_members WHERE user_id = ?').get(currentUserId) as any;
      if (mem) userSyndicateId = mem.syndicate_id;
    }

    return rows.map((s, index) => ({
      rank: index + 1,
      id: s.id,
      name: s.name,
      tag: s.tag,
      emblem_sigil: s.emblem_sigil,
      weekly_score: Number(s.weekly_score || 0),
      total_net_worth_cents: Number(s.total_net_worth_cents || 0),
      total_referrals: Number(s.total_referrals || 0),
      member_count: Number(s.member_count || 1),
      streak_days: Number(s.streak_days || 1),
      top_creator_name: s.top_creator_name || 'Guild Overseer',
      is_user_syndicate: s.id === userSyndicateId,
    }));
  } catch (err) {
    console.error('Error fetching top syndicates:', err);
    return [];
  }
}

export class LeaderboardWebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;

  public mount(server: http.Server, wsPath: string = '/ws/leaderboard'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: wsPath });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // 25s ping-pong keepalive
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.ping(); } catch {}
        }
      });
    }, 25000);

    // 10s live leaderboard broadcast sweep
    this.broadcastInterval = setInterval(() => {
      this.broadcastSnapshot();
    }, 10000);

    return this.wss;
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);

    // Send initial snapshot on connection
    const creators = fetchTop100Creators();
    const syndicates = fetchTopSyndicates();
    const frame: LeaderboardWsServerFrame = {
      type: 'snapshot',
      timestamp: new Date().toISOString(),
      creators,
      syndicates,
      totalCreators: creators.length,
    };

    this.send(ws, frame);

    ws.on('message', (message: any) => {
      try {
        const raw = typeof message === 'string' ? message : message.toString('utf8');
        const data: LeaderboardWsClientFrame = JSON.parse(raw);

        if (data.type === 'ping') {
          this.send(ws, {
            type: 'pong',
            clientTimestamp: data.clientTimestamp || Date.now(),
            serverTimestamp: Date.now(),
          });
        } else if (data.type === 'subscribe') {
          // Re-send snapshot upon explicit subscription request
          this.send(ws, {
            type: 'snapshot',
            timestamp: new Date().toISOString(),
            creators: fetchTop100Creators(),
            syndicates: fetchTopSyndicates(),
            totalCreators: creators.length,
          });
        }
      } catch (e) {
        // Ignore malformed client frames
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });
  }

  public broadcastSnapshot(): void {
    if (this.clients.size === 0) return;

    const creators = fetchTop100Creators();
    const syndicates = fetchTopSyndicates();
    const frame: LeaderboardWsServerFrame = {
      type: 'leaderboard_update',
      timestamp: new Date().toISOString(),
      updatedCreators: creators,
      topWinner: creators[0],
    };

    const syndFrame: LeaderboardWsServerFrame = {
      type: 'syndicate_update',
      timestamp: new Date().toISOString(),
      updatedSyndicates: syndicates,
    };

    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.send(ws, frame);
        this.send(ws, syndFrame);
      }
    });
  }

  private send(ws: WebSocket, payload: LeaderboardWsServerFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch (e) {
        console.warn('[LeaderboardWS] Send error:', e);
      }
    }
  }

  public close(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    if (this.wss) this.wss.close();
    this.clients.clear();
  }
}

export const leaderboardWsManager = new LeaderboardWebSocketManager();
