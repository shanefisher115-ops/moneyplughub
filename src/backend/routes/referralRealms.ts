import { Router, Request, Response } from 'express';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { calculateXPWithMultipliers } from './growth';

const router = Router();

export interface RealmDefinition {
  realmIndex: number;
  id: string;
  name: string;
  title: string;
  archetype: string;
  tagline: string;
  accentColor: string;
  glowColor: string;
  gradient: string;
  solfeggioFreq: number;
  yieldMultiplierBoost: number;
  specialPerk: string;
  description: string;
}

export const BASE_REALMS: RealmDefinition[] = [
  {
    realmIndex: 1,
    id: 'realm_sol_oasis',
    name: '🌿 Verdant Oasis of Sol',
    title: 'The Sovereign Seed Realm',
    archetype: 'Biospheric Synthesis',
    tagline: 'First Spark of Autonomous Abundance',
    accentColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    gradient: 'from-emerald-900 via-slate-950 to-emerald-950',
    solfeggioFreq: 432,
    yieldMultiplierBoost: 0.05,
    specialPerk: '🌱 +0.05x Passive Cashflow Multiplier & Verdant Living Theme',
    description: 'Breathes life into your compounding engine with biospheric harmonic frequencies.'
  },
  {
    realmIndex: 2,
    id: 'realm_lightning_bastion',
    name: '⚡ Aetherial Lightning Bastion',
    title: 'High-Frequency Velocity Spire',
    archetype: 'Kinetic Telemetry',
    tagline: 'Instant Commission Conduits',
    accentColor: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    gradient: 'from-cyan-900 via-slate-950 to-blue-950',
    solfeggioFreq: 528,
    yieldMultiplierBoost: 0.10,
    specialPerk: '🎙️ +100 Free Voice Banking Minutes & 241ms Low-Latency Bridge',
    description: 'Channels high-voltage transaction streams directly into liquid reserves.'
  },
  {
    realmIndex: 3,
    id: 'realm_molten_gold_vault',
    name: '💎 24K Molten Gold Vault',
    title: 'Sanctum of Living Bullion',
    archetype: 'Encrypted Wealth Core',
    tagline: 'Perpetual Asset Preservation',
    accentColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    gradient: 'from-amber-900 via-slate-950 to-yellow-950',
    solfeggioFreq: 639,
    yieldMultiplierBoost: 0.15,
    specialPerk: '💰 Auto-Injects $25 Reserve into Living Vault & Gold Shaders',
    description: 'An impenetrable chamber radiating with molten gold asset telemetry.'
  },
  {
    realmIndex: 4,
    id: 'realm_quantum_nebula',
    name: '🌌 Quantum Nebula Sanctum',
    title: 'Entangled Dimensional Forge',
    archetype: 'Multi-Branch Matrix',
    tagline: 'Zero-Point Energy Accumulator',
    accentColor: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    gradient: 'from-purple-900 via-slate-950 to-indigo-950',
    solfeggioFreq: 741,
    yieldMultiplierBoost: 0.20,
    specialPerk: '🔮 3D Holographic Sigil Halo & Procedural Passport Minting',
    description: 'Synthesizes quantum mathematical hashes into persistent cryptographic artifacts.'
  },
  {
    realmIndex: 5,
    id: 'realm_solar_flare_citadel',
    name: '🔥 Solar Flare Citadel',
    title: 'The Viral Sun Engine',
    archetype: 'Supercritical Expansion',
    tagline: 'Global Affiliate Dominion',
    accentColor: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    gradient: 'from-orange-900 via-slate-950 to-rose-950',
    solfeggioFreq: 852,
    yieldMultiplierBoost: 0.25,
    specialPerk: '👑 VIP 30% Recurring Commission Tier & Custom Domain Routing',
    description: 'Ignites exponential viral growth loops across all social distribution channels.'
  },
  {
    realmIndex: 6,
    id: 'realm_osmium_singularity',
    name: '🧬 Osmium Singularity Nexus',
    title: 'The Eternal Memory Lattice',
    archetype: 'Post-Human Intelligence',
    tagline: 'Infinite Graph Neural Context',
    accentColor: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    gradient: 'from-pink-900 via-slate-950 to-fuchsia-950',
    solfeggioFreq: 963,
    yieldMultiplierBoost: 0.30,
    specialPerk: '🎬 DaVinci Resolve 4K Studio Node & Infinite Omni Flash Video Quota',
    description: 'Preserves every transaction and creative impulse permanently in immutable Osmium memory.'
  },
  {
    realmIndex: 7,
    id: 'realm_primordia_throne',
    name: '🪐 Primordia Sovereign Throne',
    title: 'The Godhead Chamber of Cosmogenesis',
    archetype: 'Omniversal Sovereign',
    tagline: 'Mastery of All Seven Dimensions',
    accentColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    gradient: 'from-sky-900 via-purple-950 to-emerald-950',
    solfeggioFreq: 1074,
    yieldMultiplierBoost: 0.35,
    specialPerk: '♾️ Uncapped Sovereign Multiplier & God Mode Dashboard Shaders',
    description: 'The crowning achievement of creator sovereignty. Absolute autonomy over wealth and distribution.'
  }
];

export function getProceduralRealm(index: number, citizenId: string = ''): RealmDefinition {
  const archetypes = ['Hyper-Dimensional Conduit', 'Chrono-Spatial Bastion', 'Dark-Matter Reactor', 'Starlight Citadel', 'Prismatic Void Sanctum'];
  const colors = ['#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#38bdf8', '#8b5cf6'];
  const archetype = archetypes[index % archetypes.length];
  const color = colors[index % colors.length];
  const freq = 432 + ((index * 111) % 800);

  return {
    realmIndex: index,
    id: `realm_multiverse_${index}`,
    name: `🪐 Multiverse Sector ${index}: Alpha ${citizenId.slice(0, 4).toUpperCase() || 'CORE'}`,
    title: `Sovereign Outer Frontier Dimension ${index}`,
    archetype,
    tagline: `Unbounded Expansion Wave ${index}`,
    accentColor: color,
    glowColor: `${color}66`,
    gradient: 'from-slate-900 via-purple-950 to-slate-950',
    solfeggioFreq: freq,
    yieldMultiplierBoost: 0.05 * index,
    specialPerk: `✨ +${(0.05 * index).toFixed(2)}x Multiverse Supercritical Multiplier`,
    description: `A boundless dimensional frontier conquered through creator network expansion.`
  };
}

/**
 * GET /api/referrals/realms - Fetch user's unlocked and next frontier realms
 */
router.get('/realms', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch user and invited citizens
    const user = db.prepare('SELECT id, display_name, referral_code, referral_count, xp, level, tier_title FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const invitedUsers = db.prepare(`
      SELECT id, display_name, email, created_at
      FROM users
      WHERE referrer_user_id = ?
      ORDER BY created_at ASC
    `).all(userId) as any[];

    const referralCount = Math.max(user.referral_count || 0, invitedUsers.length);

    // Build the realm list: Unlocked realms (1 to referralCount) + Next Frontier Realm (referralCount + 1)
    const realms: any[] = [];
    const maxDisplayedRealms = Math.max(7, referralCount + 1);

    for (let i = 1; i <= maxDisplayedRealms; i++) {
      let baseDef = i <= BASE_REALMS.length ? BASE_REALMS[i - 1] : getProceduralRealm(i, invitedUsers[i - 1]?.id || '');
      const isUnlocked = i <= referralCount || user.role === 'admin';
      const citizen = invitedUsers[i - 1] || null;

      // Harvestable daily XP per unlocked realm
      const harvestableXp = isUnlocked ? Math.round(50 + (i * 25)) : 0;

      realms.push({
        ...baseDef,
        unlocked: isUnlocked,
        citizen: citizen ? {
          id: citizen.id,
          displayName: citizen.display_name,
          email: citizen.email ? citizen.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Active Citizen',
          joinedAt: citizen.created_at,
          sigilUrl: `/api/sigil/citizen_${citizen.id.slice(0, 6)}`,
          status: 'Online & Generating Passive Yield'
        } : null,
        harvestableXp
      });
    }

    // Compute total combined realm yield boost
    const totalYieldBoost = realms
      .filter(r => r.unlocked)
      .reduce((acc, r) => acc + r.yieldMultiplierBoost, 0);

    res.json({
      success: true,
      data: {
        referralCount,
        unlockedRealmCount: Math.min(referralCount, realms.filter(r => r.unlocked).length),
        totalYieldBoost: Number(totalYieldBoost.toFixed(2)),
        realms,
        nextChamberIndex: referralCount + 1,
        nextChamberName: realms[referralCount]?.name || 'Next Cosmic Dimension'
      }
    });
  } catch (err: any) {
    console.error('Realms fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/referrals/realms/harvest - Harvest daily sovereign energy/XP from all unlocked realms
 */
router.post('/realms/harvest', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date().toISOString();

    const user = db.prepare('SELECT id, referral_count, xp, level FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const invitedUsers = db.prepare('SELECT id FROM users WHERE referrer_user_id = ?').all(userId) as any[];
    const unlockedCount = Math.max(user.referral_count || 0, invitedUsers.length);

    if (unlockedCount === 0 && req.user!.role !== 'admin') {
      return res.status(400).json({ success: false, error: 'No unlocked realms to harvest yet. Invite your first citizen to unlock Realm 1!' });
    }

    // Base XP = 75 per unlocked realm
    const baseHarvestXP = (unlockedCount || 1) * 75;
    const { totalXP, breakdown } = calculateXPWithMultipliers(baseHarvestXP, userId);
    const multiplier = breakdown.tierBoost * breakdown.eventMulti * breakdown.dailyMulti;

    db.prepare('UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?').run(totalXP, now, userId);

    recordAuditLog(userId, 'REALM_HARVEST', 'users', userId, {
      unlockedCount,
      harvestedXP: totalXP,
      multiplier
    });

    res.json({
      success: true,
      message: `🪐 Harvested ${totalXP} Sovereign XP from ${unlockedCount} unlocked realms (${multiplier.toFixed(2)}x Multiplier)!`,
      data: {
        harvestedXP: totalXP,
        newTotalXP: (user.xp || 0) + totalXP,
        unlockedCount
      }
    });
  } catch (err: any) {
    console.error('Harvest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
