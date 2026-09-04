import { Router, Request, Response } from 'express';
import { db, runInTransaction } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

export interface MilestoneBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Cosmic';
  color: string;
  glowColor: string;
  animation: 'pulse' | 'shimmer' | 'bounce' | 'spin' | 'float';
}

export const MILESTONE_BADGE_REGISTRY: Record<string, MilestoneBadge> = {
  grand_champion: {
    id: 'grand_champion',
    name: '#1 Grand Champion',
    description: 'Crown holder at the absolute apex of the global creator economy.',
    icon: '👑',
    rarity: 'Cosmic',
    color: 'from-amber-400 via-yellow-300 to-amber-500',
    glowColor: 'rgba(251, 191, 36, 0.6)',
    animation: 'shimmer',
  },
  apex_sovereign: {
    id: 'apex_sovereign',
    name: 'Apex Sovereign',
    description: 'Crossed $100,000+ in verified creator revenue and commissions.',
    icon: '🏛️',
    rarity: 'Cosmic',
    color: 'from-purple-500 via-fuchsia-400 to-pink-500',
    glowColor: 'rgba(192, 132, 252, 0.6)',
    animation: 'pulse',
  },
  diamond_titan: {
    id: 'diamond_titan',
    name: 'Diamond Titan',
    description: 'Earned $50,000+ in revenue with high-velocity funnel conversions.',
    icon: '💎',
    rarity: 'Legendary',
    color: 'from-cyan-400 via-sky-300 to-blue-500',
    glowColor: 'rgba(56, 189, 248, 0.6)',
    animation: 'shimmer',
  },
  top10_highroller: {
    id: 'top10_highroller',
    name: 'Top 10 High-Roller',
    description: 'Ranked in the top 10 elite creators globally.',
    icon: '🏆',
    rarity: 'Epic',
    color: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(245, 158, 11, 0.5)',
    animation: 'float',
  },
  referral_army: {
    id: 'referral_army',
    name: '100+ Referral Army',
    description: 'Built a viral network of 100+ active creators.',
    icon: '🚀',
    rarity: 'Legendary',
    color: 'from-emerald-400 to-teal-500',
    glowColor: 'rgba(52, 211, 153, 0.5)',
    animation: 'bounce',
  },
  streak_master: {
    id: 'streak_master',
    name: '30d Streak Master',
    description: 'Maintained a 30+ day unbroken action & revenue streak.',
    icon: '🔥',
    rarity: 'Epic',
    color: 'from-rose-500 to-orange-500',
    glowColor: 'rgba(244, 63, 94, 0.5)',
    animation: 'pulse',
  },
  syndicate_founder: {
    id: 'syndicate_founder',
    name: 'Syndicate Founder',
    description: 'Founded and leads an active Creator Syndicate.',
    icon: '⚔️',
    rarity: 'Epic',
    color: 'from-indigo-400 to-violet-600',
    glowColor: 'rgba(129, 140, 248, 0.5)',
    animation: 'float',
  },
  voice_ai_pioneer: {
    id: 'voice_ai_pioneer',
    name: 'Voice AI Pioneer',
    description: 'Deploys real-time duplex MoneyOS Voice AI agents.',
    icon: '🎙️',
    rarity: 'Rare',
    color: 'from-violet-400 to-purple-500',
    glowColor: 'rgba(167, 139, 250, 0.4)',
    animation: 'spin',
  },
  viral_alchemist: {
    id: 'viral_alchemist',
    name: 'Viral Alchemist',
    description: 'Generated over 500+ referral link clicks across social networks.',
    icon: '🧪',
    rarity: 'Rare',
    color: 'from-lime-400 to-emerald-500',
    glowColor: 'rgba(163, 230, 53, 0.4)',
    animation: 'shimmer',
  },
  vault_sovereign: {
    id: 'vault_sovereign',
    name: 'Vault Sovereign',
    description: 'Reached Level 10+ mastery in the Wealth Vault.',
    icon: '⚡',
    rarity: 'Epic',
    color: 'from-yellow-300 to-amber-500',
    glowColor: 'rgba(253, 224, 71, 0.5)',
    animation: 'float',
  },
};

export function computeEarningsTier(earningsCents: number) {
  if (earningsCents >= 10000000) {
    return {
      tier: 'Apex Sovereign',
      badge: '🏛️ Apex Sovereign',
      color: 'text-purple-300 bg-purple-950/80 border-purple-500/60 shadow-purple-500/20',
      minEarningsCents: 10000000,
      nextTier: null,
      nextTierCents: null,
    };
  }
  if (earningsCents >= 5000000) {
    return {
      tier: 'Diamond Plug',
      badge: '💎 Diamond Plug',
      color: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/60 shadow-cyan-500/20',
      minEarningsCents: 5000000,
      nextTier: 'Apex Sovereign',
      nextTierCents: 10000000,
    };
  }
  if (earningsCents >= 1000000) {
    return {
      tier: 'Platinum Stacker',
      badge: '⚪ Platinum Stacker',
      color: 'text-slate-200 bg-slate-800/80 border-slate-400/60 shadow-slate-400/20',
      minEarningsCents: 1000000,
      nextTier: 'Diamond Plug',
      nextTierCents: 5000000,
    };
  }
  if (earningsCents >= 250000) {
    return {
      tier: 'Gold Architect',
      badge: '🥇 Gold Architect',
      color: 'text-amber-300 bg-amber-950/80 border-amber-500/60 shadow-amber-500/20',
      minEarningsCents: 250000,
      nextTier: 'Platinum Stacker',
      nextTierCents: 1000000,
    };
  }
  if (earningsCents >= 50000) {
    return {
      tier: 'Silver Builder',
      badge: '🥈 Silver Builder',
      color: 'text-slate-300 bg-slate-900/80 border-slate-500/60 shadow-slate-500/20',
      minEarningsCents: 50000,
      nextTier: 'Gold Architect',
      nextTierCents: 250000,
    };
  }
  return {
    tier: 'Bronze Apprentice',
    badge: '🥉 Bronze Apprentice',
    color: 'text-amber-600 bg-amber-950/40 border-amber-800/40 shadow-amber-900/10',
    minEarningsCents: 0,
    nextTier: 'Silver Builder',
    nextTierCents: 50000,
  };
}

/**
 * Seed or guarantee top 100 creators in database with varied realistic creator profiles
 */
export function ensureTop100CreatorsSeeded(): void {
  const currentCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
  if (currentCount >= 100) return;

  const sampleNames = [
    'SovereignAura', 'CryptoPhoenix', 'ViralVelocity', 'QuantumStacker', 'NeonAlchemist',
    'ApexTrader', 'CyberSage', 'GoldStandard', 'VortexKing', 'PulseQueen',
    'MatrixArchitect', 'ZeroFriction', 'ByteMillionaire', 'AetherFlux', 'TitanCashflow',
    'HyperLoop', 'SolanaKnight', 'NexusOperative', 'RadiantGold', 'OsmiumPioneer',
    'StardustReign', 'ElysiumVault', 'OrionBuilder', 'CipherWarlock', 'InfiniteYield',
    'ZenithPlug', 'GalacticMonarch', 'VanguardCapital', 'SpectraGrowth', 'FluxMaster',
    'ShadowQuant', 'SolarisPrime', 'AuraCollector', 'CyberDominion', 'PulseMatrix',
    'AlphaGenesis', 'HyperionRise', 'OmegaProtocol', 'ChronoStacker', 'NebulaMonarch',
    'PrismSovereign', 'KryptonPioneer', 'TitaniumFlow', 'VortexSovereign', 'AstroYield',
    'ApexCatalyst', 'CyberArchitect', 'GoldSyndicate', 'QuantumOverlord', 'NeonTitan',
  ];

  const now = new Date().toISOString();
  const needed = 100 - currentCount;

  runInTransaction(() => {
    for (let i = 0; i < needed; i++) {
      const idx = currentCount + i + 1;
      const userId = `usr_creator_seed_${idx.toString().padStart(3, '0')}`;
      const name = sampleNames[i % sampleNames.length] + (Math.floor(i / sampleNames.length) > 0 ? `_${Math.floor(i / sampleNames.length) + 1}` : '');
      const email = `creator_${idx}@moneyplughub.local`;
      const code = `PLUG-${name.toUpperCase().substring(0, 8)}`;

      // Generate realistic stats distribution
      // Top creators (idx 1-10) have higher earnings
      const isTop10 = idx <= 10;
      const isTop25 = idx <= 25;
      const isTop50 = idx <= 50;

      let xp = 1000 + Math.floor(Math.random() * 2000);
      let level = 2;
      let streak = 1 + Math.floor(Math.random() * 15);
      let referrals = Math.floor(Math.random() * 10);
      let earningsCents = Math.floor(Math.random() * 40000);

      if (isTop10) {
        xp = 12000 + (10 - idx) * 3500 + Math.floor(Math.random() * 2000);
        level = 8 + Math.floor(Math.random() * 3);
        streak = 25 + Math.floor(Math.random() * 40);
        referrals = 80 + Math.floor(Math.random() * 120);
        earningsCents = 10000000 + (10 - idx) * 4500000 + Math.floor(Math.random() * 1000000);
      } else if (isTop25) {
        xp = 6000 + (25 - idx) * 400;
        level = 5 + Math.floor(Math.random() * 3);
        streak = 15 + Math.floor(Math.random() * 20);
        referrals = 30 + Math.floor(Math.random() * 50);
        earningsCents = 2500000 + (25 - idx) * 400000;
      } else if (isTop50) {
        xp = 3000 + (50 - idx) * 120;
        level = 3 + Math.floor(Math.random() * 2);
        streak = 8 + Math.floor(Math.random() * 15);
        referrals = 12 + Math.floor(Math.random() * 25);
        earningsCents = 600000 + (50 - idx) * 70000;
      } else {
        xp = 500 + (100 - idx) * 30;
        level = 1 + Math.floor(Math.random() * 2);
        streak = 1 + Math.floor(Math.random() * 10);
        referrals = Math.floor(Math.random() * 12);
        earningsCents = 30000 + (100 - idx) * 5000;
      }

      const tierTitle = computeEarningsTier(earningsCents).tier;

      db.prepare(`
        INSERT OR IGNORE INTO users (
          id, email, password_hash, display_name, role, referral_code,
          referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
        ) VALUES (?, ?, 'seeded_hash', ?, 'user', ?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        email,
        name,
        code,
        referrals,
        xp,
        level,
        streak,
        tierTitle,
        now,
        now
      );

      // Seed account balance to match earnings for net worth calculations
      db.prepare(`
        INSERT OR IGNORE INTO accounts (
          id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at
        ) VALUES (?, ?, 'Primary Vault Account', 'bank', ?, 'USD', 'MoneyPlugHub Bank', 0, ?, ?)
      `).run(
        `acc_${userId}_primary`,
        userId,
        earningsCents,
        now,
        now
      );

      // Seed earnings snapshot
      db.prepare(`
        INSERT OR IGNORE INTO earnings_snapshots (
          id, user_id, window, start_date, end_date, gross_cents, net_cents, currency, computed_at, created_at
        ) VALUES (?, ?, 'monthly', ?, ?, ?, ?, 'USD', ?, ?)
      `).run(
        `earn_${userId}_monthly`,
        userId,
        now.substring(0, 7) + '-01T00:00:00.000Z',
        now,
        earningsCents,
        earningsCents,
        now,
        now
      );
    }
  });

  // Assign syndicates to seeded creators
  const syndicates = db.prepare('SELECT id, tag, emblem_sigil, name FROM syndicates').all() as any[];
  if (syndicates.length > 0) {
    const creators = db.prepare('SELECT id FROM users WHERE id LIKE "usr_creator_seed_%"').all() as any[];
    for (let i = 0; i < creators.length; i++) {
      const syn = syndicates[i % syndicates.length];
      const cId = creators[i].id;

      db.prepare(`
        INSERT OR IGNORE INTO syndicate_members (
          id, syndicate_id, user_id, role, contributed_xp, joined_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `sm_seed_${cId}`,
        syn.id,
        cId,
        i < 4 ? 'officer' : 'member',
        500 + i * 50,
        now
      );
    }
  }
}

// Ensure database seeded on route load
ensureTop100CreatorsSeeded();

function computeMilestoneBadges(user: {
  rank: number;
  earningsCents: number;
  referrals: number;
  streakDays: number;
  isSyndicateFounder: boolean;
  level: number;
  xp: number;
}): MilestoneBadge[] {
  const badges: MilestoneBadge[] = [];

  if (user.rank === 1) badges.push(MILESTONE_BADGE_REGISTRY.grand_champion);
  if (user.rank <= 10) badges.push(MILESTONE_BADGE_REGISTRY.top10_highroller);
  if (user.earningsCents >= 10000000) badges.push(MILESTONE_BADGE_REGISTRY.apex_sovereign);
  if (user.earningsCents >= 5000000) badges.push(MILESTONE_BADGE_REGISTRY.diamond_titan);
  if (user.referrals >= 100) badges.push(MILESTONE_BADGE_REGISTRY.referral_army);
  if (user.streakDays >= 30) badges.push(MILESTONE_BADGE_REGISTRY.streak_master);
  if (user.isSyndicateFounder) badges.push(MILESTONE_BADGE_REGISTRY.syndicate_founder);
  if (user.level >= 8) badges.push(MILESTONE_BADGE_REGISTRY.vault_sovereign);

  // Always give Voice AI or Viral Alchemist if active creator
  if (user.referrals >= 10 || user.earningsCents >= 500000) {
    badges.push(MILESTONE_BADGE_REGISTRY.viral_alchemist);
  }
  if (user.level >= 2) {
    badges.push(MILESTONE_BADGE_REGISTRY.voice_ai_pioneer);
  }

  return badges;
}

/**
 * GET /api/leaderboard/top100
 * Retrieves top 100 creators with earnings tiers, syndicate affiliations, and animated milestone badges.
 */
router.get('/top100', (req: Request, res: Response) => {
  try {
    ensureTop100CreatorsSeeded();

    const currentUserId = (req as any).user?.id || null;
    const tierFilter = req.query.tier ? String(req.query.tier) : null;
    const syndicateFilter = req.query.syndicate ? String(req.query.syndicate) : null;

    // Fetch top users with total earnings and syndicate details
    const rawUsers = db.prepare(`
      SELECT
        u.id as user_id,
        u.display_name,
        u.email,
        u.xp,
        u.level,
        u.streak_days,
        u.referral_count,
        u.created_at,
        COALESCE(
          (SELECT SUM(es.gross_cents) FROM earnings_snapshots es WHERE es.user_id = u.id),
          (SELECT SUM(a.balance_cents) FROM accounts a WHERE a.user_id = u.id AND a.is_liability = 0),
          0
        ) as total_earnings_cents,
        s.id as syndicate_id,
        s.name as syndicate_name,
        s.tag as syndicate_tag,
        s.emblem_sigil as syndicate_emblem,
        sm.role as syndicate_role
      FROM users u
      LEFT JOIN syndicate_members sm ON sm.user_id = u.id
      LEFT JOIN syndicates s ON s.id = sm.syndicate_id
      GROUP BY u.id
      ORDER BY total_earnings_cents DESC, u.xp DESC
      LIMIT 100
    `).all() as any[];

    let leaderboard = rawUsers.map((item, index) => {
      const rank = index + 1;
      const earningsCents = Number(item.total_earnings_cents || 0);
      const tierInfo = computeEarningsTier(earningsCents);
      const isSyndicateFounder = item.syndicate_role === 'founder';

      const milestoneBadges = computeMilestoneBadges({
        rank,
        earningsCents,
        referrals: Number(item.referral_count || 0),
        streakDays: Number(item.streak_days || 1),
        isSyndicateFounder,
        level: Number(item.level || 1),
        xp: Number(item.xp || 0),
      });

      return {
        rank,
        user_id: item.user_id,
        display_name: item.display_name,
        avatar_sigil: item.syndicate_emblem || 'CYBER-DRAGON',
        xp: Number(item.xp || 0),
        level: Number(item.level || 1),
        streak_days: Number(item.streak_days || 1),
        referral_count: Number(item.referral_count || 0),
        total_earnings_cents: earningsCents,
        earnings_tier: tierInfo,
        syndicate: item.syndicate_id ? {
          id: item.syndicate_id,
          name: item.syndicate_name,
          tag: item.syndicate_tag,
          emblem: item.syndicate_emblem,
          role: item.syndicate_role,
        } : null,
        milestone_badges: milestoneBadges,
        is_current_user: item.user_id === currentUserId,
      };
    });

    if (tierFilter) {
      leaderboard = leaderboard.filter(u => u.earnings_tier.tier.toLowerCase() === tierFilter.toLowerCase());
    }

    if (syndicateFilter) {
      leaderboard = leaderboard.filter(u => u.syndicate && u.syndicate.tag.toLowerCase() === syndicateFilter.toLowerCase());
    }

    // Top Tier Stats Breakdown
    const tierCounts = {
      apex: leaderboard.filter(u => u.earnings_tier.tier === 'Apex Sovereign').length,
      diamond: leaderboard.filter(u => u.earnings_tier.tier === 'Diamond Plug').length,
      platinum: leaderboard.filter(u => u.earnings_tier.tier === 'Platinum Stacker').length,
      gold: leaderboard.filter(u => u.earnings_tier.tier === 'Gold Architect').length,
      silver: leaderboard.filter(u => u.earnings_tier.tier === 'Silver Builder').length,
      bronze: leaderboard.filter(u => u.earnings_tier.tier === 'Bronze Apprentice').length,
    };

    const totalCommunityEarningsCents = rawUsers.reduce((sum, u) => sum + Number(u.total_earnings_cents || 0), 0);

    res.json({
      success: true,
      data: {
        leaderboard,
        total_creators: rawUsers.length,
        total_community_earnings_cents: totalCommunityEarningsCents,
        tier_counts: tierCounts,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error fetching top 100 creators:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve top 100 creator leaderboard.' });
  }
});

/**
 * GET /api/leaderboard/syndicates
 * Returns ranked list of top creator syndicates
 */
router.get('/syndicates', (req: Request, res: Response) => {
  try {
    const rawSyndicates = db.prepare(`
      SELECT s.*,
             u.display_name as creator_name
      FROM syndicates s
      LEFT JOIN users u ON u.id = s.creator_id
      ORDER BY s.weekly_score DESC, s.total_net_worth_cents DESC
    `).all() as any[];

    const rankedSyndicates = rawSyndicates.map((s, idx) => ({
      rank: idx + 1,
      id: s.id,
      name: s.name,
      tag: s.tag,
      emblem_sigil: s.emblem_sigil,
      description: s.description,
      creator_name: s.creator_name || 'Guild Overseer',
      member_count: Number(s.member_count || 1),
      weekly_score: Number(s.weekly_score || 0),
      total_net_worth_cents: Number(s.total_net_worth_cents || 0),
      total_referrals: Number(s.total_referrals || 0),
      streak_days: Number(s.streak_days || 1),
    }));

    res.json({
      success: true,
      data: rankedSyndicates,
    });
  } catch (err: any) {
    console.error('Error fetching syndicate rankings:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve syndicate rankings.' });
  }
});

/**
 * GET /api/leaderboard/badges
 * Returns list of all available milestone badges
 */
router.get('/badges', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(MILESTONE_BADGE_REGISTRY),
  });
});

/**
 * GET /api/leaderboard/stats
 * Aggregated summary statistics for header metrics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    ensureTop100CreatorsSeeded();

    const userStats = db.prepare(`
      SELECT
        COUNT(*) as total_creators,
        SUM(xp) as total_xp,
        MAX(streak_days) as max_streak
      FROM users
    `).get() as any;

    const topCreator = db.prepare(`
      SELECT display_name, xp, level FROM users ORDER BY xp DESC LIMIT 1
    `).get() as any;

    const topSyndicate = db.prepare(`
      SELECT name, tag, weekly_score FROM syndicates ORDER BY weekly_score DESC LIMIT 1
    `).get() as any;

    res.json({
      success: true,
      data: {
        total_creators: Number(userStats?.total_creators || 100),
        total_xp: Number(userStats?.total_xp || 500000),
        max_streak_days: Number(userStats?.max_streak || 60),
        champion: topCreator ? {
          name: topCreator.display_name,
          xp: topCreator.xp,
          level: topCreator.level,
        } : null,
        top_syndicate: topSyndicate ? {
          name: topSyndicate.name,
          tag: topSyndicate.tag,
          score: topSyndicate.weekly_score,
        } : null,
        live_connections: 42,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard stats.' });
  }
});

export default router;
