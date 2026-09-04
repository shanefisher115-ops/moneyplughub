import { db, runInTransaction } from './db';
import { MilestoneBadge, EarningsTierInfo } from '../types';

export const EARNINGS_TIERS: EarningsTierInfo[] = [
  {
    tier_number: 6,
    name: 'Sovereign Diamond',
    title: 'Sovereign Diamond Creator',
    badge: '💎',
    color: '#38bdf8',
    min_earnings_cents: 10000000, // $100,000+
  },
  {
    tier_number: 5,
    name: 'Imperial Gold',
    title: 'Imperial Gold Creator',
    badge: '👑',
    color: '#fbbf24',
    min_earnings_cents: 2500000, // $25,000+
  },
  {
    tier_number: 4,
    name: 'Amethyst Vault',
    title: 'Amethyst Vault Stacker',
    badge: '🔮',
    color: '#c084fc',
    min_earnings_cents: 500000, // $5,000+
  },
  {
    tier_number: 3,
    name: 'Cyan River',
    title: 'Cyan River Builder',
    badge: '🌊',
    color: '#22d3ee',
    min_earnings_cents: 100000, // $1,000+
  },
  {
    tier_number: 2,
    name: 'Neo Seed',
    title: 'Neo Seed Plug',
    badge: '🌱',
    color: '#10b981',
    min_earnings_cents: 10000, // $100+
  },
  {
    tier_number: 1,
    name: 'Novice Creator',
    title: 'Novice Creator',
    badge: '⚡',
    color: '#94a3b8',
    min_earnings_cents: 0,
  },
];

export const MASTER_MILESTONE_BADGES: MilestoneBadge[] = [
  {
    id: 'badge_100k_club',
    title: '$100K Sovereign Earner',
    category: 'Earnings',
    icon: '💎',
    rarity: 'cosmic',
    description: 'Generated over $100,000 in verified creator commissions.',
    animated_effect: 'sparkle',
  },
  {
    id: 'badge_50k_earner',
    title: '$50K Diamond Stacker',
    category: 'Earnings',
    icon: '👑',
    rarity: 'legendary',
    description: 'Surpassed $50,000 in lifetime referral revenue.',
    animated_effect: 'glow',
  },
  {
    id: 'badge_10k_earner',
    title: '$10K Imperial Velocity',
    category: 'Earnings',
    icon: '🏆',
    rarity: 'epic',
    description: 'Broke the $10,000 threshold in digital earnings.',
    animated_effect: 'shimmer',
  },
  {
    id: 'badge_1k_referrals',
    title: '1,000 Network Invites',
    category: 'Referrals',
    icon: '⚡',
    rarity: 'cosmic',
    description: 'Built an active network of 1,000+ referred creators.',
    animated_effect: 'flame',
  },
  {
    id: 'badge_100_referrals',
    title: 'Viral Magnet',
    category: 'Referrals',
    icon: '🚀',
    rarity: 'legendary',
    description: 'Attracted over 100 creator sign-ups.',
    animated_effect: 'pulse',
  },
  {
    id: 'badge_syndicate_leader',
    title: 'Guild Sovereign',
    category: 'Syndicate',
    icon: '🏛️',
    rarity: 'cosmic',
    description: 'Founding leader of a top-ranked Creator Syndicate.',
    animated_effect: 'orbit',
  },
  {
    id: 'badge_30d_streak',
    title: '30-Day Unstoppable Streak',
    category: 'Streak',
    icon: '🔥',
    rarity: 'epic',
    description: 'Maintained a 30-day active daily execution streak.',
    animated_effect: 'flame',
  },
  {
    id: 'badge_level_10',
    title: 'Level 10 Cosmic Plug',
    category: 'XP',
    icon: '🌟',
    rarity: 'legendary',
    description: 'Achieved Level 10 Maximum XP Rank.',
    animated_effect: 'sparkle',
  },
];

export function getEarningsTier(totalEarningsCents: number): EarningsTierInfo {
  for (const tier of EARNINGS_TIERS) {
    if (totalEarningsCents >= tier.min_earnings_cents) {
      return tier;
    }
  }
  return EARNINGS_TIERS[EARNINGS_TIERS.length - 1];
}

export function seedLeaderboardTop100(): void {
  const currentCountRes = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const currentCount = currentCountRes?.count || 0;

  if (currentCount >= 100) {
    return;
  }

  const creatorsToGenerate = 100 - currentCount;

  const sampleNames = [
    'AuraMaster', 'CyberVortex', 'SovereignSam', 'QuantumLeap', 'CryptoQueen',
    'ViralArchitect', 'SolanaKing', 'PlugSovereign', 'AlchemistPro', 'MatrixWhale',
    'NexusPrime', 'EtherealVault', 'VelocityX', 'HyperDrive', 'ApexOperator',
    'StardustTitan', 'GoldBullion', 'OsmiumAlchemist', 'DiamondDev', 'SignalChaser',
    'PulseCommander', 'ZenithRider', 'EclipseAlpha', 'NovaSovereign', 'AstroYield',
    'ByteSurfer', 'KinetixPro', 'AetherStaker', 'InfiniteFlux', 'OmniCreator'
  ];

  const syndicates = db.prepare('SELECT id FROM syndicates').all() as { id: string }[];
  const syndicateIds = syndicates.map(s => s.id);

  const now = new Date().toISOString();

  runInTransaction(() => {
    for (let i = 1; i <= creatorsToGenerate; i++) {
      const idx = currentCount + i;
      const baseName = sampleNames[(idx - 1) % sampleNames.length];
      const displayName = `@${baseName}_${idx}`;
      const userId = `usr_top100_creator_${idx}`;
      const email = `creator_${idx}@moneyplughub.com`;
      const referralCode = `PLUG${idx.toString().padStart(3, '0')}`;

      // Calculate realistic power curve for Top 100 creators
      // Rank 1-10: $50,000 to $150,000 earnings
      // Rank 11-30: $15,000 to $50,000 earnings
      // Rank 31-70: $3,000 to $15,000 earnings
      // Rank 71-100: $200 to $3,000 earnings
      let totalEarnedCents = 0;
      let xp = 0;
      let level = 1;
      let streakDays = Math.floor(Math.random() * 30) + 1;
      let referralCount = 0;

      if (idx <= 10) {
        totalEarnedCents = Math.floor(15000000 - (idx * 900000) + (Math.random() * 200000));
        xp = Math.floor(15000 - (idx * 500) + (Math.random() * 300));
        level = 10;
        referralCount = Math.floor(1500 - (idx * 100) + (Math.random() * 50));
      } else if (idx <= 30) {
        totalEarnedCents = Math.floor(5000000 - ((idx - 10) * 180000) + (Math.random() * 100000));
        xp = Math.floor(8000 - ((idx - 10) * 200) + (Math.random() * 150));
        level = 7 + Math.floor(Math.random() * 3);
        referralCount = Math.floor(500 - ((idx - 10) * 18) + (Math.random() * 20));
      } else if (idx <= 70) {
        totalEarnedCents = Math.floor(1500000 - ((idx - 30) * 28000) + (Math.random() * 20000));
        xp = Math.floor(3500 - ((idx - 30) * 50) + (Math.random() * 80));
        level = 4 + Math.floor(Math.random() * 3);
        referralCount = Math.floor(150 - ((idx - 30) * 3) + (Math.random() * 10));
      } else {
        totalEarnedCents = Math.floor(300000 - ((idx - 70) * 9000) + (Math.random() * 5000));
        xp = Math.floor(1200 - ((idx - 70) * 20) + (Math.random() * 30));
        level = 2 + Math.floor(Math.random() * 2);
        referralCount = Math.floor(30 - ((idx - 70) * 0.8) + (Math.random() * 5));
      }

      let tierTitle = 'Novice Plug';
      if (xp >= 10000) tierTitle = 'Cosmic Money Plug';
      else if (xp >= 5000) tierTitle = 'Diamond Stacker';
      else if (xp >= 2500) tierTitle = 'Grand Money Plug';
      else if (xp >= 1200) tierTitle = 'Wealth Builder';
      else if (xp >= 600) tierTitle = 'Crypto Stacker';

      // Insert user
      db.prepare(`
        INSERT OR IGNORE INTO users (
          id, email, password_hash, display_name, role, referral_code,
          referral_count, xp, level, streak_days, tier_title, created_at, updated_at
        ) VALUES (?, ?, 'hash_seeded', ?, 'user', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, email, displayName, referralCode,
        referralCount, xp, level, streakDays, tierTitle, now, now
      );

      // Insert account for net worth
      const netWorthCents = Math.floor(totalEarnedCents * 1.8);
      db.prepare(`
        INSERT OR IGNORE INTO accounts (
          id, user_id, name, type, balance_cents, currency, institution, is_liability, created_at, updated_at
        ) VALUES (?, ?, 'Primary Sovereign Vault', 'bank', ?, 'USD', 'MoneyPlug Vault', 0, ?, ?)
      `).run(`acc_${userId}_primary`, userId, netWorthCents, now, now);

      // Assign syndicate if available
      if (syndicateIds.length > 0 && Math.random() > 0.15) {
        const synId = syndicateIds[Math.floor(Math.random() * syndicateIds.length)];
        db.prepare(`
          INSERT OR IGNORE INTO syndicate_members (
            id, syndicate_id, user_id, role, contributed_xp, joined_at
          ) VALUES (?, ?, ?, 'member', ?, ?)
        `).run(`sm_${userId}`, synId, userId, Math.floor(xp * 0.8), now);
      }
    }
  });
}
