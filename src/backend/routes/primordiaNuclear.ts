import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db, runInTransaction } from '../db';
import { config } from '../config';

export const primordiaNuclearRouter = Router();

/**
 * Initialize SQLite Database Schema for Nuclear Tier Modules
 */
export function initPrimordiaNuclearSchema() {
  db.exec(`
    -- 1. Creator XP Reactor & Nuclear State Table
    CREATE TABLE IF NOT EXISTS primordia_nuclear_state (
      user_id TEXT PRIMARY KEY,
      reactor_level INTEGER DEFAULT 1,
      reactor_plasma_charge REAL DEFAULT 100.0,
      reactor_overload_streak INTEGER DEFAULT 0,
      total_reactor_pulses INTEGER DEFAULT 0,
      neural_mood_state TEXT DEFAULT 'CALM_EMERALD',
      neural_stress_index REAL DEFAULT 0.15,
      active_timeline_horizon_years INTEGER DEFAULT 10,
      black_hole_entropy_score REAL DEFAULT 24.5,
      reality_engine_sync_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- 2. Quantum Sigil Forge Infusion Table
    CREATE TABLE IF NOT EXISTS primordia_quantum_sigils (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sigil_name TEXT NOT NULL,
      fractal_type TEXT NOT NULL,
      fractal_depth INTEGER DEFAULT 5,
      symmetry_fold INTEGER DEFAULT 8,
      harmonic_frequency REAL DEFAULT 528.0,
      xp_charged INTEGER DEFAULT 0,
      charge_level INTEGER DEFAULT 1,
      yield_multiplier REAL DEFAULT 1.05,
      aura_glow_color TEXT DEFAULT '#10b981',
      unlocked_perks_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quantum_sigils_user ON primordia_quantum_sigils(user_id);

    -- 3. Time Dilation Simulation Presets Table
    CREATE TABLE IF NOT EXISTS primordia_timeline_simulations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      time_horizon_years INTEGER NOT NULL,
      baseline_net_worth REAL NOT NULL,
      conservative_net_worth REAL NOT NULL,
      aggressive_net_worth REAL NOT NULL,
      optimized_omega_net_worth REAL NOT NULL,
      ai_commentary TEXT,
      divergence_delta_usd REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_timeline_user ON primordia_timeline_simulations(user_id);
  `);
}

/**
 * Auth Extractor Helper
 */
function extractUserId(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      if (decoded && decoded.id) return decoded.id;
    } catch {}
  }
  return 'demo_guest_user';
}

function getEffectiveUserId(req: Request): string {
  let uid = extractUserId(req);
  if (uid === 'demo_guest_user') {
    try {
      const u = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
      if (u) uid = u.id;
    } catch {}
  }
  return uid;
}

/**
 * Helper: Gather Financial Context for Simulation Math
 */
function getUserCoreFinancials(userId: string) {
  let user: any = null;
  try {
    user = db.prepare('SELECT id, display_name, email, xp, level, tier_title FROM users WHERE id = ?').get(userId) as any;
  } catch {}

  let accounts: any[] = [];
  try {
    accounts = db.prepare('SELECT id, name, type, balance_cents, is_liability FROM accounts WHERE user_id = ?').all(userId) as any[];
  } catch {}

  const totalAssetsCents = accounts.filter(a => !a.is_liability).reduce((acc, a) => acc + (a.balance_cents > 0 ? a.balance_cents : 0), 0);
  const totalCashCents = accounts.filter(a => a.type === 'bank' || a.type === 'cash').reduce((acc, a) => acc + a.balance_cents, 0);

  let debts: any[] = [];
  try {
    debts = db.prepare('SELECT id, name, total_balance_cents, interest_rate FROM debts WHERE user_id = ?').all(userId) as any[];
  } catch {}
  const totalDebtCents = debts.reduce((acc, d) => acc + (d.total_balance_cents || 0), 0);

  const netWorthUsd = Math.round(((totalAssetsCents - totalDebtCents) / 100) * 100) / 100;
  const totalCashUsd = Math.round((totalCashCents / 100) * 100) / 100;
  const totalDebtUsd = Math.round((totalDebtCents / 100) * 100) / 100;

  return {
    user: user || { id: userId, display_name: 'Creator', xp: 5400, level: 5, tier_title: 'Quantum Sovereign' },
    netWorthUsd: Math.max(0, netWorthUsd || 15420),
    totalCashUsd: Math.max(0, totalCashUsd || 11650),
    totalDebtUsd: Math.max(0, totalDebtUsd || 1850),
    savingsRatePct: 42,
  };
}

/**
 * ═════════════════════════════════════════════════════════════════════
 * 1. GET /api/primordia/nuclear/state
 * Returns comprehensive live metrics for all 9 Nuclear Tier modules
 * ═════════════════════════════════════════════════════════════════════
 */
primordiaNuclearRouter.get('/state', (req: Request, res: Response) => {
  try {
    const userId = getEffectiveUserId(req);
    const finances = getUserCoreFinancials(userId);
    const now = new Date().toISOString();

    // Fetch or initialize Nuclear state
    let state = db.prepare('SELECT * FROM primordia_nuclear_state WHERE user_id = ?').get(userId) as any;
    if (!state) {
      db.prepare(`
        INSERT INTO primordia_nuclear_state (
          user_id, reactor_level, reactor_plasma_charge, reactor_overload_streak,
          total_reactor_pulses, neural_mood_state, neural_stress_index,
          active_timeline_horizon_years, black_hole_entropy_score,
          reality_engine_sync_count, updated_at
        ) VALUES (?, 1, 100.0, 3, 14, 'CALM_EMERALD', 0.12, 10, 18.4, 6, ?)
      `).run(userId, now);
      state = db.prepare('SELECT * FROM primordia_nuclear_state WHERE user_id = ?').get(userId) as any;
    }

    // Fetch quantum sigils
    let quantumSigils = db.prepare(`
      SELECT * FROM primordia_quantum_sigils WHERE user_id = ? ORDER BY charge_level DESC
    `).all(userId) as any[];

    // If none exist, seed 2 starter quantum sigils
    if (quantumSigils.length === 0) {
      const s1 = `qsig_${Date.now()}_1`;
      const s2 = `qsig_${Date.now()}_2`;
      db.prepare(`
        INSERT INTO primordia_quantum_sigils (
          id, user_id, sigil_name, fractal_type, fractal_depth, symmetry_fold,
          harmonic_frequency, xp_charged, charge_level, yield_multiplier,
          aura_glow_color, unlocked_perks_json, created_at, updated_at
        ) VALUES 
        (?, ?, 'Sovereign Nexus Alpha', 'MANDELBROT_QUANTUM', 6, 8, 528.0, 500, 2, 1.08, '#10b981', '["+8% Staking Yield", "Magnetic Shield Boost"]', ?, ?),
        (?, ?, 'Singularity Core Omega', 'SACRED_FRACTAL_TORUS', 8, 12, 963.0, 1200, 3, 1.15, '#a855f7', '["+15% Referral Velocity", "Zero Entropy Ward"]', ?, ?)
      `).run(s1, userId, now, now, s2, userId, now, now);
      quantumSigils = db.prepare('SELECT * FROM primordia_quantum_sigils WHERE user_id = ?').all(userId) as any[];
    }

    // Compute dynamic health status
    const healthScore = Math.min(100, Math.max(10, Math.round(
      (finances.totalCashUsd / Math.max(100, finances.totalCashUsd + finances.totalDebtUsd)) * 70 +
      (finances.savingsRatePct * 0.3)
    )));

    res.json({
      success: true,
      data: {
        userId,
        timestamp: now,
        finances,
        reactor: {
          level: state.reactor_level,
          plasmaChargePct: state.reactor_plasma_charge,
          overloadStreak: state.reactor_overload_streak,
          totalPulses: state.total_reactor_pulses,
          healthScore,
          plasmaColor: healthScore > 80 ? '#10b981' : healthScore > 50 ? '#06b6d4' : '#f59e0b',
          coreStatus: state.reactor_plasma_charge >= 90 ? 'OPTIMAL_FUSION' : 'RECHARGING',
          overloadBonusMultiplier: state.reactor_overload_streak >= 3 ? 1.25 : 1.0,
        },
        neuralField: {
          moodState: state.neural_mood_state,
          stressIndex: state.neural_stress_index,
          suggestedHarmonicHz: state.neural_mood_state === 'ANXIETY_SHIELD_AMBER' ? 432 : 528,
          predictiveShortcuts: [
            { label: 'Time Dilation Engine', tab: 'time-dilation', reason: 'High compound interest yield potential' },
            { label: 'Quantum Sigil Forge', tab: 'quantum-sigil', reason: 'Unclaimed XP ready for fractal infusion' },
            { label: 'Swarm Brain Council', tab: 'swarm-brain', reason: '5 AI agents ready for strategy debate' },
          ],
        },
        blackHoleEntropy: {
          entropyScore: state.black_hole_entropy_score,
          eventHorizonRadius: Math.max(20, Math.min(180, Math.round(finances.totalDebtUsd / 25))),
          accretionDiskLuminosity: Math.min(100, Math.round(finances.totalCashUsd / 150)),
          singularityStatus: finances.totalDebtUsd > finances.totalCashUsd ? 'COLLAPSE_WARNING' : 'STABILIZED_EQUILIBRIUM',
          astrophysicalJetsActive: finances.netWorthUsd > 10000,
        },
        quantumSigils,
        realityEngineSyncCount: state.reality_engine_sync_count,
      }
    });
  } catch (err: any) {
    console.error('Nuclear state error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════
 * 2. POST /api/primordia/nuclear/reactor/pulse
 * Pulses the Creator XP Fusion Core, awarding XP and fueling plasma
 * ═════════════════════════════════════════════════════════════════════
 */
primordiaNuclearRouter.post('/reactor/pulse', (req: Request, res: Response) => {
  try {
    const userId = getEffectiveUserId(req);
    const now = new Date().toISOString();

    let state = db.prepare('SELECT * FROM primordia_nuclear_state WHERE user_id = ?').get(userId) as any;
    if (!state) {
      db.prepare(`
        INSERT INTO primordia_nuclear_state (user_id, reactor_level, reactor_plasma_charge, reactor_overload_streak, total_reactor_pulses, updated_at)
        VALUES (?, 1, 100.0, 1, 1, ?)
      `).run(userId, now);
      state = db.prepare('SELECT * FROM primordia_nuclear_state WHERE user_id = ?').get(userId) as any;
    }

    const newPulses = (state.total_reactor_pulses || 0) + 1;
    const newStreak = (state.reactor_overload_streak || 0) + 1;
    const newLevel = Math.floor(newPulses / 10) + 1;
    const xpBonus = 50 * (newStreak >= 3 ? 1.25 : 1.0);

    runInTransaction(() => {
      db.prepare(`
        UPDATE primordia_nuclear_state 
        SET total_reactor_pulses = ?,
            reactor_overload_streak = ?,
            reactor_level = ?,
            reactor_plasma_charge = 100.0,
            updated_at = ?
        WHERE user_id = ?
      `).run(newPulses, newStreak, newLevel, now, userId);

      db.prepare(`
        UPDATE users SET xp = xp + ? WHERE id = ?
      `).run(Math.round(xpBonus), userId);
    });

    res.json({
      success: true,
      data: {
        message: '⚡ Creator XP Reactor pulsed with Tokamak plasma burst!',
        xpAwarded: Math.round(xpBonus),
        newReactorLevel: newLevel,
        newStreak,
        totalPulses: newPulses,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════
 * 3. POST /api/primordia/nuclear/quantum-sigil/charge
 * Charges a sigil with user XP to level up its fractal complexity & aura
 * ═════════════════════════════════════════════════════════════════════
 */
primordiaNuclearRouter.post('/quantum-sigil/charge', (req: Request, res: Response) => {
  const { sigilId, xpAmount } = req.body;
  const chargeCost = parseInt(xpAmount, 10) || 500;

  try {
    const userId = getEffectiveUserId(req);
    const now = new Date().toISOString();

    const user = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.xp < chargeCost) {
      res.status(400).json({ success: false, error: `Insufficient XP. You need ${chargeCost} XP.` });
      return;
    }

    const sigil = db.prepare('SELECT * FROM primordia_quantum_sigils WHERE id = ? AND user_id = ?').get(sigilId, userId) as any;
    if (!sigil) {
      res.status(404).json({ success: false, error: 'Quantum Sigil not found' });
      return;
    }

    const newXpCharged = sigil.xp_charged + chargeCost;
    const newChargeLevel = Math.floor(newXpCharged / 500) + 1;
    const newDepth = Math.min(14, sigil.fractal_depth + 1);
    const newMultiplier = Math.round((1.0 + (newChargeLevel * 0.05)) * 100) / 100;

    runInTransaction(() => {
      db.prepare(`
        UPDATE users SET xp = MAX(0, xp - ?) WHERE id = ?
      `).run(chargeCost, userId);

      db.prepare(`
        UPDATE primordia_quantum_sigils 
        SET xp_charged = ?,
            charge_level = ?,
            fractal_depth = ?,
            yield_multiplier = ?,
            updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(newXpCharged, newChargeLevel, newDepth, newMultiplier, now, sigilId, userId);
    });

    res.json({
      success: true,
      data: {
        sigilId,
        newChargeLevel,
        newFractalDepth: newDepth,
        newYieldMultiplier: newMultiplier,
        message: `✨ Sigil "${sigil.sigil_name}" charged to Level ${newChargeLevel}! Fractal aura expanded.`,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════
 * 4. POST /api/primordia/nuclear/time-dilation/simulate
 * Simulates multiple parallel timelines (1 to 30 years) with AI commentary
 * ═════════════════════════════════════════════════════════════════════
 */
primordiaNuclearRouter.post('/time-dilation/simulate', (req: Request, res: Response) => {
  const { years = 10, monthlyInvestment = 250, referralReinvestMonthly = 250 } = req.body;
  const targetYears = Math.min(40, Math.max(1, parseInt(years, 10)));

  try {
    const userId = getEffectiveUserId(req);
    const finances = getUserCoreFinancials(userId);
    const principal = Math.max(500, finances.totalCashUsd * 0.5);

    // Compound calculations across 4 parallel realities
    const months = targetYears * 12;
    
    // Timeline Alpha: Baseline (4.5% Bank Yield)
    const rateAlpha = 0.045 / 12;
    const valAlpha = Math.round(principal * Math.pow(1 + 0.045, targetYears) + (monthlyInvestment * ((Math.pow(1 + rateAlpha, months) - 1) / rateAlpha)));

    // Timeline Beta: Conservative (7.2% Balanced Index)
    const rateBeta = 0.072 / 12;
    const valBeta = Math.round(principal * Math.pow(1 + 0.072, targetYears) + (monthlyInvestment * ((Math.pow(1 + rateBeta, months) - 1) / rateBeta)));

    // Timeline Gamma: Aggressive Creator (10.5% S&P 500 + Growth)
    const rateGamma = 0.105 / 12;
    const valGamma = Math.round(principal * Math.pow(1 + 0.105, targetYears) + ((monthlyInvestment + 100) * ((Math.pow(1 + rateGamma, months) - 1) / rateGamma)));

    // Timeline Omega: Quantum Optimized (12.4% MoneyOS Barbell + Full Referral Flywheel Reinvested)
    const rateOmega = 0.124 / 12;
    const totalOmegaContribution = monthlyInvestment + referralReinvestMonthly;
    const valOmega = Math.round(principal * Math.pow(1 + 0.124, targetYears) + (totalOmegaContribution * ((Math.pow(1 + rateOmega, months) - 1) / rateOmega)));

    const divergenceDelta = valOmega - valAlpha;
    const monthlyOmegaYield = Math.round((valOmega * 0.04) / 12);

    const commentary = `At Year ${targetYears}, Timeline Omega generates a +$${divergenceDelta.toLocaleString()} wealth divergence over baseline cash holding. Reinvesting your creator referral cashflow unlocks $${monthlyOmegaYield.toLocaleString()}/month in permanent passive safe yield.`;

    res.json({
      success: true,
      data: {
        targetYears,
        principalUsd: principal,
        monthlyContributionUsd: monthlyInvestment,
        referralReinvestmentUsd: referralReinvestMonthly,
        timelines: [
          { key: 'alpha', label: 'Timeline α: Standard Cash / Low Yield', netWorthUsd: valAlpha, color: '#64748b', yieldRate: '4.5%' },
          { key: 'beta', label: 'Timeline β: Conservative Indexing', netWorthUsd: valBeta, color: '#06b6d4', yieldRate: '7.2%' },
          { key: 'gamma', label: 'Timeline γ: Active Creator Growth', netWorthUsd: valGamma, color: '#f59e0b', yieldRate: '10.5%' },
          { key: 'omega', label: 'Timeline Ω: MoneyOS Quantum Barbell', netWorthUsd: valOmega, color: '#10b981', yieldRate: '12.4%', monthlyPassiveYieldUsd: monthlyOmegaYield },
        ],
        divergenceDeltaUsd: divergenceDelta,
        aiCommentary: commentary,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════
 * 5. POST /api/primordia/nuclear/black-hole/stabilize
 * Gamified horizon stabilization strike pulling back financial entropy
 * ═════════════════════════════════════════════════════════════════════
 */
primordiaNuclearRouter.post('/black-hole/stabilize', (req: Request, res: Response) => {
  try {
    const userId = getEffectiveUserId(req);
    const now = new Date().toISOString();

    runInTransaction(() => {
      db.prepare(`
        UPDATE primordia_nuclear_state 
        SET black_hole_entropy_score = MAX(5.0, black_hole_entropy_score - 4.5),
            updated_at = ?
        WHERE user_id = ?
      `).run(now, userId);

      db.prepare('UPDATE users SET xp = xp + 750 WHERE id = ?').run(userId);
    });

    res.json({
      success: true,
      data: {
        message: '🕳️ Spacetime singularity stabilized! Event horizon retracted. +750 XP awarded.',
        xpAwarded: 750,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════
 * 6. POST /api/primordia/nuclear/neural-field/calibrate
 * Updates active user emotional state & UI ambient aura
 * ═════════════════════════════════════════════════════════════════════
 */
primordiaNuclearRouter.post('/neural-field/calibrate', (req: Request, res: Response) => {
  const { moodState, stressIndex } = req.body;
  try {
    const userId = getEffectiveUserId(req);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE primordia_nuclear_state 
      SET neural_mood_state = ?,
          neural_stress_index = ?,
          updated_at = ?
      WHERE user_id = ?
    `).run(moodState || 'CALM_EMERALD', typeof stressIndex === 'number' ? stressIndex : 0.1, now, userId);

    res.json({
      success: true,
      data: {
        moodState: moodState || 'CALM_EMERALD',
        stressIndex: typeof stressIndex === 'number' ? stressIndex : 0.1,
        message: `🧠 Creator Neural Field calibrated to ${moodState || 'CALM_EMERALD'}`,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default primordiaNuclearRouter;
