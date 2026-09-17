import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, runInTransaction, recordAuditLog } from '../db';
import { config } from '../config';
import { User } from '../../types';

const router = Router();

// ═══════════════════════════════════════════════════════════════════
//  DAILY MYSTERY LOOT CRATE & GACHA ENGINE — Creator Money OS
// ═══════════════════════════════════════════════════════════════════

// ── Database Schema Initialization ────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_loot_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      reward_value TEXT NOT NULL,
      reward_description TEXT NOT NULL,
      streak_days INTEGER NOT NULL DEFAULT 1,
      claimed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_daily_loot_user ON daily_loot_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_loot_claimed_at ON daily_loot_claims(claimed_at);
  `);
} catch (e: any) {
  console.error('Daily Loot Table Init Warning:', e.message);
}

/**
 * Level & Tier computation helper
 */
function computeLevelAndTier(xp: number): { level: number; tier_title: string } {
  if (xp >= 10000) return { level: 10, tier_title: 'Cosmic Money Plug' };
  if (xp >= 5000) return { level: 6, tier_title: 'Diamond Stacker' };
  if (xp >= 2500) return { level: 5, tier_title: 'Grand Money Plug' };
  if (xp >= 1200) return { level: 4, tier_title: 'Wealth Builder' };
  if (xp >= 600) return { level: 3, tier_title: 'Crypto Stacker' };
  if (xp >= 250) return { level: 2, tier_title: 'Budget Apprentice' };
  return { level: 1, tier_title: 'Novice Plug' };
}

/**
 * Resolve authenticated user or guest identifier
 */
function resolveUserOrGuest(req: Request): {
  userId: string;
  isAuthenticated: boolean;
  user?: User;
} {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null)
    || req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      const user = db.prepare(`
        SELECT id, email, display_name, role, referral_code, referrer_user_id, referral_count, xp, level, streak_days, tier_title, created_at, updated_at
        FROM users
        WHERE id = ?
      `).get(decoded.userId) as unknown as User | undefined;

      if (user) {
        return {
          userId: user.id,
          isAuthenticated: true,
          user,
        };
      }
    } catch {
      // invalid token, fallback to guest
    }
  }

  // Fallback to guest ID from header, query, cookie or client IP
  const explicitGuestId = (req.headers['x-guest-id'] as string)
    || (req.query.guest_id as string)
    || (req.body?.guest_id as string)
    || req.cookies?.guest_id;

  if (explicitGuestId && typeof explicitGuestId === 'string' && explicitGuestId.trim().length > 0) {
    return {
      userId: explicitGuestId.trim(),
      isAuthenticated: false,
    };
  }

  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const ipHash = crypto.createHash('md5').update(clientIp).digest('hex').substring(0, 12);
  return {
    userId: `guest_${ipHash}`,
    isAuthenticated: false,
  };
}

/**
 * Helper to compute eligibility & streak state
 */
function computeEligibility(userId: string): {
  eligible: boolean;
  secondsRemaining: number;
  streakDays: number;
  nextBonusMultiplier: number;
  lastClaimedAt: string | null;
} {
  const lastClaim = db.prepare(`
    SELECT * FROM daily_loot_claims 
    WHERE user_id = ? 
    ORDER BY claimed_at DESC 
    LIMIT 1
  `).get(userId) as any;

  if (!lastClaim || !lastClaim.claimed_at) {
    return {
      eligible: true,
      secondsRemaining: 0,
      streakDays: 1,
      nextBonusMultiplier: 1.0,
      lastClaimedAt: null,
    };
  }

  const lastClaimTime = new Date(lastClaim.claimed_at).getTime();
  const now = Date.now();
  const msElapsed = now - lastClaimTime;
  const cooldownMs = 24 * 60 * 60 * 1000; // 24 Hours cooldown
  const gracePeriodMs = 48 * 60 * 60 * 1000; // 48 Hours streak preservation window

  if (msElapsed < cooldownMs) {
    const secondsRemaining = Math.ceil((cooldownMs - msElapsed) / 1000);
    const currentStreak = Number(lastClaim.streak_days || 1);
    const nextBonusMultiplier = Number((1.0 + (currentStreak - 1) * 0.05).toFixed(2));

    return {
      eligible: false,
      secondsRemaining,
      streakDays: currentStreak,
      nextBonusMultiplier,
      lastClaimedAt: lastClaim.claimed_at,
    };
  }

  // Cooldown passed — eligible to open
  let nextStreak = 1;
  if (msElapsed <= gracePeriodMs) {
    nextStreak = Number(lastClaim.streak_days || 1) + 1;
  } else {
    nextStreak = 1; // Streak broken if > 48h
  }

  const nextBonusMultiplier = Number((1.0 + (nextStreak - 1) * 0.05).toFixed(2));

  return {
    eligible: true,
    secondsRemaining: 0,
    streakDays: nextStreak,
    nextBonusMultiplier,
    lastClaimedAt: lastClaim.claimed_at,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/loot/daily/status
 * Checks if user/guest is eligible for daily crate (cooldown 24h from last claim, or instant for first-time visitors).
 * Returns { eligible: boolean, secondsRemaining: number, streakDays: number, nextBonusMultiplier: number, lastClaimedAt: string | null }
 */
router.get('/daily/status', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const status = computeEligibility(userId);

    res.json({
      success: true,
      data: {
        ...status,
        userId,
        isAuthenticated,
        userLevel: user?.level || 1,
        userTier: user?.tier_title || 'Novice Plug',
      },
    });
  } catch (err: any) {
    console.error('Error fetching loot crate status:', err);
    res.status(500).json({ success: false, error: 'Failed to check loot crate eligibility.' });
  }
});

/**
 * POST /api/loot/daily/open
 * Opens the daily loot crate with weighted drop table:
 *  * 40% Common: +150 to +350 XP + $0.50 cash credit
 *  * 30% Rare: +500 XP + $2.00 cash credit + 2x Golden Hour XP multiplier (active 1 hour)
 *  * 20% Epic: +1,000 XP + $5.00 cash credit + Exclusive Rare Sigil Component
 *  * 10% Legendary Mythic: +2,500 XP + $10.00 cash credit + 3x Golden Hour Multiplier + Mythic Gold Bullion Aura
 * Updates user's balance and XP in database, records claim, returns full drop metadata.
 */
router.post('/daily/open', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const eligibility = computeEligibility(userId);

    if (!eligibility.eligible) {
      const hoursLeft = (eligibility.secondsRemaining / 3600).toFixed(1);
      res.status(429).json({
        success: false,
        error: `Daily Loot Crate on cooldown: ${hoursLeft}h remaining (${eligibility.secondsRemaining}s). Come back tomorrow!`,
        data: {
          eligible: false,
          secondsRemaining: eligibility.secondsRemaining,
          streakDays: eligibility.streakDays,
          nextBonusMultiplier: eligibility.nextBonusMultiplier,
          lastClaimedAt: eligibility.lastClaimedAt,
        },
      });
      return;
    }

    const streakDays = eligibility.streakDays;
    const streakMultiplier = eligibility.nextBonusMultiplier;

    // Support selectable Crate Tiers: 'daily_standard' | 'golden_stacker' | 'osmium_vault' | 'primordia_jackpot'
    const crateType = (req.body?.crateType || 'daily_standard') as 'daily_standard' | 'golden_stacker' | 'osmium_vault' | 'primordia_jackpot';
    let crateMultiplier = 1.0;
    let minRarity = 'Common';
    if (crateType === 'golden_stacker') {
      crateMultiplier = 2.0;
      minRarity = 'Rare';
    } else if (crateType === 'osmium_vault') {
      crateMultiplier = 4.0;
      minRarity = 'Epic';
    } else if (crateType === 'primordia_jackpot') {
      crateMultiplier = 8.0;
      minRarity = 'Legendary';
    }

    // ── Weighted Drop Table Roll (0.0 to 100.0) ──
    const roll = Math.random() * 100;
    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = nowIso.substring(0, 10);
    const claimId = `claim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    let rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Cosmic' = 'Common';
    let baseXp = 250;
    let cashCreditCents = 50; // $0.50
    let multiplierAwarded: number | null = null;
    let multiplierDurationHours: number | null = null;
    let sigilUnlocked: string | null = null;
    let sigilName: string | null = null;
    let rewardType = crateType;
    let rewardValue = '';
    let rewardDescription = '';
    let perks: string[] = [];
    let badgeAccent = '#38ef7d';

    if (crateType === 'primordia_jackpot' || roll >= 95) {
      // 5% or Primordia Omni-Chest: Cosmic Sovereign Jackpot
      rarity = 'Cosmic';
      baseXp = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
      cashCreditCents = Math.floor(Math.random() * (5000 - 2500 + 1)) + 2500; // $25.00 - $50.00
      multiplierAwarded = 10.0;
      multiplierDurationHours = 2;
      sigilUnlocked = 'aura_primordial_gold';
      sigilName = 'Primordia 24K Molten Gold Bullion Aura';
      badgeAccent = '#ffd700';
      perks = [
        `+${baseXp.toLocaleString()} Cosmic XP (${streakMultiplier}× Streak applied)`,
        `$${(cashCreditCents / 100).toFixed(2)} Sovereign Bank Jackpot`,
        '⚡ 10× Golden Hour XP Frenzy (2 Hours Active)',
        '👑 Mythic 24K Primordial Molten Gold Aura Shader',
        '💎 VIP Stacker Commission Multiplier (+25%)',
      ];
    } else if (crateType === 'osmium_vault' || roll >= 80) {
      // 15% or Osmium Vault: Legendary Drop
      rarity = 'Legendary';
      baseXp = Math.floor(Math.random() * (3500 - 2000 + 1)) + 2000;
      cashCreditCents = Math.floor(Math.random() * (1500 - 800 + 1)) + 800; // $8.00 - $15.00
      multiplierAwarded = 5.0;
      multiplierDurationHours = 2;
      sigilUnlocked = 'aura_osmium_diamond';
      sigilName = 'Osmium Prismatic Diamond Crystal Aura';
      badgeAccent = '#38bdf8';
      perks = [
        `+${baseXp.toLocaleString()} Sovereign XP (${streakMultiplier}× Streak applied)`,
        `$${(cashCreditCents / 100).toFixed(2)} Instant Cash Credit`,
        '⚡ 5× Golden Hour XP Multiplier (2 Hours Active)',
        '🔮 Osmium Prismatic Diamond Crystal Sigil',
      ];
    } else if (crateType === 'golden_stacker' || roll >= 50) {
      // 30% or Golden Stacker: Epic Drop
      rarity = 'Epic';
      baseXp = Math.floor(Math.random() * (1500 - 800 + 1)) + 800;
      cashCreditCents = Math.floor(Math.random() * (600 - 300 + 1)) + 300; // $3.00 - $6.00
      multiplierAwarded = 3.0;
      multiplierDurationHours = 1;
      const epicSigils = [
        { id: 'glyph_tesseract', name: '4D Tesseract Sacred Hypercube' },
        { id: 'glyph_merkaba_vehicle', name: 'Merkaba Light Vehicle Star' },
        { id: 'glyph_octagram', name: 'Celestial Octagram Core' },
        { id: 'glyph_flower_of_life', name: 'Flower of Life Sacred Matrix' },
        { id: 'ring_singularity_vortex', name: 'Singularity Vortex Warping Ring' },
        { id: 'ring_particle_flux', name: 'Particle Flux Stream Orbital' },
        { id: 'aura_quantum_ice', name: 'Glacial Quantum Frost Aura' },
        { id: 'crest_halo_ascendance', name: 'Ascendant Tri-Halo Crest' },
      ];
      const pickedSigil = epicSigils[Math.floor(Math.random() * epicSigils.length)];
      sigilUnlocked = pickedSigil.id;
      sigilName = pickedSigil.name;
      badgeAccent = '#c084fc';
      perks = [
        `+${baseXp.toLocaleString()} Stacker XP (${streakMultiplier}× Streak applied)`,
        `$${(cashCreditCents / 100).toFixed(2)} Direct Cash Credit`,
        '⚡ 3× Golden Hour XP Multiplier (1 Hour Active)',
        `🔮 Exclusive Sigil Artifact: ${pickedSigil.name}`,
      ];
    } else if (roll >= 20) {
      // 30% Rare: +500 to +800 XP + $2.00 cash credit + 2x Golden Hour
      rarity = 'Rare';
      baseXp = Math.floor(Math.random() * (800 - 500 + 1)) + 500;
      cashCreditCents = 200; // $2.00
      multiplierAwarded = 2.0;
      multiplierDurationHours = 1;
      badgeAccent = '#38bdf8';
      perks = [
        `+${baseXp} High-Velocity XP (${streakMultiplier}× Streak applied)`,
        '$2.00 Instant Cash Credit',
        '⚡ 2× Golden Hour XP Multiplier (1 Hour Active)',
      ];
    } else {
      // 20% Common: +250 to +450 XP + $1.00 cash credit
      rarity = 'Common';
      baseXp = Math.floor(Math.random() * (450 - 250 + 1)) + 250;
      cashCreditCents = 100; // $1.00
      badgeAccent = '#38ef7d';
      perks = [
        `+${baseXp} Base XP (${streakMultiplier}× Streak applied)`,
        '$1.00 Direct Bank Credit',
        'Standard Daily Creator Energy',
      ];
    }

    const totalXpEarned = Math.round(baseXp * streakMultiplier * crateMultiplier);
    const finalCashCreditCents = Math.round(cashCreditCents * (crateType === 'daily_standard' ? 1.0 : 1.25));

    rewardValue = `+${totalXpEarned} XP, $${(finalCashCreditCents / 100).toFixed(2)} USD${multiplierAwarded ? `, ${multiplierAwarded}x Boost` : ''}${sigilUnlocked ? `, Sigil: ${sigilUnlocked}` : ''}`;
    rewardDescription = `${rarity} ${crateType.replace('_', ' ').toUpperCase()}: +${totalXpEarned.toLocaleString()} XP + $${(finalCashCreditCents / 100).toFixed(2)} Cash${multiplierAwarded ? ` + ${multiplierAwarded}x Golden Hour Boost` : ''}${sigilName ? ` + ${sigilName}` : ''}`;

    let newTotalXp = totalXpEarned;
    let newLevel = 1;
    let newTier = 'Novice Plug';

    runInTransaction(() => {
      // 1. Record Claim in daily_loot_claims
      db.prepare(`
        INSERT INTO daily_loot_claims (id, user_id, reward_type, reward_value, reward_description, streak_days, claimed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(claimId, userId, rewardType, rewardValue, rewardDescription, streakDays, nowIso);

      // 2. If authenticated user, update balance, XP, level, transactions, surge events, and sigil inventory
      if (isAuthenticated && user) {
        // Fetch latest XP from DB
        const currentUser = db.prepare('SELECT xp, level, tier_title FROM users WHERE id = ?').get(userId) as any;
        newTotalXp = (Number(currentUser?.xp) || 0) + totalXpEarned;
        const levelData = computeLevelAndTier(newTotalXp);
        newLevel = levelData.level;
        newTier = levelData.tier_title;

        // Update user XP, level, tier_title, and streak_days
        db.prepare(`
          UPDATE users 
          SET xp = ?, level = ?, tier_title = ?, streak_days = ?, updated_at = ?
          WHERE id = ?
        `).run(newTotalXp, newLevel, newTier, streakDays, nowIso, userId);

        // Credit cash reward to bank/checking account
        if (finalCashCreditCents > 0) {
          const bankAccount = db.prepare(`
            SELECT id FROM accounts WHERE user_id = ? AND type = 'bank' LIMIT 1
          `).get(userId) as any;

          const targetAccountId = bankAccount?.id || `acc_${userId}_checking`;

          // If account exists in accounts table, update balance
          db.prepare(`
            UPDATE accounts 
            SET balance_cents = balance_cents + ?, updated_at = ?
            WHERE user_id = ? AND id = ?
          `).run(finalCashCreditCents, nowIso, userId, targetAccountId);

          // Record reward transaction
          const txId = `tx_loot_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          try {
            db.prepare(`
              INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at)
              VALUES (?, ?, ?, 'Daily Loot Reward', 'reward', ?, ?, ?, 0, ?)
            `).run(txId, userId, targetAccountId, finalCashCreditCents, `Daily Mystery Crate: ${rarity} Drop ($${(finalCashCreditCents / 100).toFixed(2)})`, todayStr, nowIso);
          } catch {}
        }

        // Apply Golden Hour Surge Multiplier (if awarded)
        if (multiplierAwarded && multiplierDurationHours) {
          const surgeId = `surge_loot_${Date.now()}`;
          const expiresAt = new Date(now.getTime() + multiplierDurationHours * 60 * 60 * 1000).toISOString();
          try {
            db.prepare(`
              INSERT INTO viral_surge_events (id, user_id, surge_type, multiplier, started_at, expires_at, is_active, created_at)
              VALUES (?, ?, 'velocity_spike', ?, ?, ?, 1, ?)
            `).run(surgeId, userId, multiplierAwarded, nowIso, expiresAt, nowIso);
          } catch {}
        }

        // Grant Rare/Mythic Sigil Component to Inventory (if awarded)
        if (sigilUnlocked) {
          try {
            const invId = `inv_${userId}_${sigilUnlocked}`;
            db.prepare(`
              INSERT OR IGNORE INTO user_sigil_inventory (id, user_id, item_id, is_equipped, purchased_at)
              VALUES (?, ?, ?, 0, ?)
            `).run(invId, userId, sigilUnlocked, nowIso);
          } catch {}
        }

        // Audit Log
        recordAuditLog(userId, 'DAILY_MYSTERY_LOOT_OPENED', 'daily_loot_claims', claimId, {
          rarity,
          baseXp,
          totalXpEarned,
          cashCreditCents: finalCashCreditCents,
          streakDays,
          multiplierAwarded,
          sigilUnlocked,
          crateType,
        });
      }
    });

    res.json({
      success: true,
      message: `🎉 ${rarity.toUpperCase()} ${crateType.replace('_', ' ').toUpperCase()} Unlocked! +${totalXpEarned.toLocaleString()} XP & $${(finalCashCreditCents / 100).toFixed(2)} added to your balance!`,
      data: {
        claimId,
        rarity,
        crateType,
        badgeAccent,
        baseXp,
        xpEarned: totalXpEarned,
        cashCredit: finalCashCreditCents / 100,
        cashCreditCents: finalCashCreditCents,
        cashCreditFormatted: `$${(finalCashCreditCents / 100).toFixed(2)}`,
        rewardType,
        rewardDescription,
        perks,
        sigilUnlocked,
        sigilName,
        multiplierAwarded,
        multiplierDurationHours,
        streakDays,
        nextBonusMultiplier: Number((1.0 + streakDays * 0.05).toFixed(2)),
        totalXp: newTotalXp,
        newLevel,
        newTier,
        claimedAt: nowIso,
        isGuest: !isAuthenticated,
        canOvercharge: true,
      },
    });
  } catch (err: any) {
    console.error('Error opening daily loot crate:', err);
    res.status(500).json({ success: false, error: 'Failed to open daily loot crate.' });
  }
});

/**
 * POST /api/loot/daily/overcharge
 * Quantum Flux Gambler — 1-Tap Double or Nothing on unboxed reward!
 */
router.post('/daily/overcharge', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const { claimId, xpEarned = 250, cashCreditCents = 50 } = req.body;

    const winRoll = Math.random() * 100;
    // 70% win chance for high streaks/levels, 60% standard
    const winThreshold = (user && (user.level ?? 1) >= 5) ? 30 : 40;
    const isWin = winRoll >= winThreshold;

    const now = new Date().toISOString();
    const doubledXp = isWin ? Number(xpEarned) * 2 : Number(xpEarned);
    const doubledCashCents = isWin ? Number(cashCreditCents) * 2 : Number(cashCreditCents);
    const bonusXp = isWin ? Number(xpEarned) : 100; // Even on shield, award +100 XP safeguard bonus

    if (isAuthenticated && user) {
      runInTransaction(() => {
        if (isWin) {
          // Add extra cash credit to user account
          const bankAccount = db.prepare(`SELECT id FROM accounts WHERE user_id = ? AND type = 'bank' LIMIT 1`).get(userId) as any;
          const targetAccountId = bankAccount?.id || `acc_${userId}_checking`;
          db.prepare(`UPDATE accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE user_id = ? AND id = ?`)
            .run(Number(cashCreditCents), now, userId, targetAccountId);

          // Add transaction
          const txId = `tx_overcharge_${Date.now()}`;
          try {
            db.prepare(`
              INSERT INTO transactions (id, user_id, account_id, category, type, amount_cents, description, date, is_recurring, created_at)
              VALUES (?, ?, ?, 'Quantum Overcharge Double', 'reward', ?, ?, ?, 0, ?)
            `).run(txId, userId, targetAccountId, Number(cashCreditCents), `Quantum Overcharge Doubler Win: +$${(Number(cashCreditCents) / 100).toFixed(2)}`, now.substring(0, 10), now);
          } catch {}
        }

        // Add bonus XP
        db.prepare('UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?').run(bonusXp, now, userId);
      });
    }

    res.json({
      success: true,
      data: {
        isWin,
        originalXp: Number(xpEarned),
        finalXp: doubledXp,
        originalCash: Number(cashCreditCents) / 100,
        finalCash: doubledCashCents / 100,
        finalCashFormatted: `$${(doubledCashCents / 100).toFixed(2)}`,
        message: isWin 
          ? `⚡ QUANTUM OVERCHARGE CRITICAL HIT! Your rewards have DOUBLED to +${doubledXp.toLocaleString()} XP and $${(doubledCashCents / 100).toFixed(2)} Cash!`
          : `🛡️ QUANTUM SHIELD TRIGGERED! Base rewards preserved + awarded +100 Overcharge Stardust XP!`,
      }
    });
  } catch (err: any) {
    console.error('Error in overcharge:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/loot/feed
 * Live real-time ticker stream of recent unboxings & jackpots
 */
router.get('/feed', (req: Request, res: Response) => {
  try {
    const liveDrops = db.prepare(`
      SELECT 
        a.id, 
        COALESCE(u.display_name, '@' || SUBSTR(u.email, 1, INSTR(u.email, '@') - 1), '@Founder') as user,
        a.action as reward,
        CASE 
          WHEN a.action LIKE '%Cosmic%' OR a.action LIKE '%Jackpot%' THEN 'Cosmic'
          WHEN a.action LIKE '%Legendary%' OR a.action LIKE '%Surge%' THEN 'Legendary'
          WHEN a.action LIKE '%Epic%' THEN 'Epic'
          ELSE 'Rare'
        END as rarity,
        a.created_at as time,
        CASE 
          WHEN a.action LIKE '%Cosmic%' OR a.action LIKE '%Jackpot%' THEN '#ffd700'
          WHEN a.action LIKE '%Legendary%' THEN '#38bdf8'
          WHEN a.action LIKE '%Epic%' THEN '#c084fc'
          ELSE '#10b981'
        END as accent
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 12
    `).all() as any[];

    if (liveDrops && liveDrops.length > 0) {
      return res.json({ success: true, data: liveDrops });
    }

    const liveInitialFeed = [
      { id: 'f1', user: '@QuantumSovereign', reward: '$50.00 Sovereign Jackpot', rarity: 'Cosmic', time: 'Just now', accent: '#ffd700' },
      { id: 'f2', user: '@CyberStakingQueen', reward: 'Osmium Diamond Aura + 5x Surge', rarity: 'Legendary', time: '2m ago', accent: '#38bdf8' },
      { id: 'f3', user: '@CryptoPlug99', reward: '$15.00 Cash + 4D Tesseract Core', rarity: 'Legendary', time: '5m ago', accent: '#38bdf8' },
      { id: 'f4', user: '@ApexCreator', reward: '3x Golden Hour + 1,500 XP', rarity: 'Epic', time: '8m ago', accent: '#c084fc' },
    ];
    res.json({ success: true, data: liveInitialFeed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/loot/drop-rates
 * Returns weighted drop rates and reward specs
 */
router.get('/drop-rates', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        rarity: 'Common',
        chancePct: 20,
        color: '#38ef7d',
        rewards: '+250 to +450 XP + $1.00 Direct Bank Credit',
        perks: ['Standard Daily Energy Cache', '$1.00 Instant Cash Credit', 'Daily Streak Multiplier Eligible'],
      },
      {
        rarity: 'Rare',
        chancePct: 30,
        color: '#38bdf8',
        rewards: '+500 to +800 XP + $2.00 Cash Credit + 2× Golden Hour Multiplier',
        perks: ['+500 - +800 High-Velocity XP', '$2.00 Instant Cash Credit', '⚡ 2× Golden Hour XP Multiplier (1h Active)'],
      },
      {
        rarity: 'Epic',
        chancePct: 30,
        color: '#c084fc',
        rewards: '+800 to +1,500 XP + $3.00 - $6.00 Cash Credit + Exclusive Rare Sigil Component',
        perks: ['+800 - +1,500 Epic Stacker XP', '$3.00 - $6.00 Instant Cash Credit', '⚡ 3× Golden Hour Surge', '🔮 Exclusive Rare Sigil Component Unlocked'],
      },
      {
        rarity: 'Legendary',
        chancePct: 15,
        color: '#38bdf8',
        rewards: '+2,000 to +3,500 XP + $8.00 - $15.00 Cash + 5× Golden Hour + Osmium Diamond Aura',
        perks: ['+2,000 - +3,500 Sovereign XP', '$8.00 - $15.00 Instant Cash Credit', '⚡ 5× Golden Hour Multiplier (2h Active)', '💎 Osmium Diamond Crystal Aura Shader'],
      },
      {
        rarity: 'Cosmic',
        chancePct: 5,
        color: '#ffd700',
        rewards: '+5,000 to +10,000 XP + $25.00 - $50.00 Jackpot + 10× Golden Hour + 24K Primordial Gold Aura',
        perks: ['+5,000 - +10,000 Cosmic XP', '$25.00 - $50.00 Bank Balance Jackpot', '⚡ 10× Golden Hour Frenzy (2h Active)', '👑 Mythic 24K Molten Gold Bullion Aura Shader', '💎 VIP Stacker RevShare Boost (+25%)'],
      },
    ],
  });
});

/**
 * GET /api/loot/history
 * Returns user's recent loot crate claim logs
 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const { userId } = resolveUserOrGuest(req);
    const claims = db.prepare(`
      SELECT * FROM daily_loot_claims 
      WHERE user_id = ? 
      ORDER BY claimed_at DESC 
      LIMIT 20
    `).all(userId) as any[];

    res.json({
      success: true,
      data: claims,
    });
  } catch (err: any) {
    console.error('Error fetching loot history:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch loot history.' });
  }
});

export default router;
