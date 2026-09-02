import { db } from '../db';
import crypto from 'crypto';

export type CascadeStage = 'SUBCRITICAL' | 'SUPERCRITICAL' | 'SUPERNOVA';

export interface AGKMetrics {
  userId: string;
  kFactor: number;
  viralVelocity: number;
  liftMultiplier: number;
  activeLoopsCount: number;
  cascadeStage: CascadeStage;
  swarmReactionState: string;
  totalPeerSignals: number;
  recentSwarmAction?: string;
}

export interface PeerPushEvent {
  id: string;
  senderUserId: string;
  senderName: string;
  eventType: 'LIFT_CASCADE' | 'TRUST_ENDORSE' | 'ABILITY_UNLOCK' | 'VIRAL_MILESTONE' | 'SIGIL_MINT' | 'XP_FUSION';
  headline: string;
  body: string;
  trustScore: number;
  influenceCount: number;
  createdAt: string;
}

export class AGKEngine {
  public static ingestSignal(params: {
    userId: string;
    signalType: string;
    targetResource?: string;
    trustWeight?: number;
    influenceDelta?: number;
    payload?: Record<string, any>;
    userName?: string;
  }): { signalId: string; agk: AGKMetrics; pushEvent?: PeerPushEvent } {
    const signalId = `ps_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const trustWeight = params.trustWeight ?? 1.0;
    const influenceDelta = params.influenceDelta ?? 0.5;

    db.prepare(`
      INSERT INTO peer_signals (id, user_id, signal_type, target_resource, trust_weight, influence_delta, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      signalId,
      params.userId,
      params.signalType,
      params.targetResource || 'general',
      trustWeight,
      influenceDelta,
      JSON.stringify(params.payload || {}),
      now
    );

    const agk = this.recalculateMetrics(params.userId);

    let pushEvent: PeerPushEvent | undefined = undefined;
    if (
      params.signalType === 'REFERRAL_SHARE' ||
      params.signalType === 'ABILITY_CAST' ||
      params.signalType === 'MARKET_BUY' ||
      params.signalType === 'VAULT_LOCK' ||
      params.signalType === 'XP_CLAIM'
    ) {
      pushEvent = this.publishPeerPush({
        senderUserId: params.userId,
        senderName: params.userName || 'Verified Sovereign',
        eventType: this.mapSignalToEventType(params.signalType),
        headline: this.generateHeadline(params.signalType, params.userName || 'Sovereign'),
        body: this.generateBody(params.signalType, params.payload),
        trustScore: Math.min(99.4, 90 + agk.kFactor * 5),
      });
    }

    return { signalId, agk, pushEvent };
  }

  public static recalculateMetrics(userId: string): AGKMetrics {
    const now = new Date().toISOString();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const signalCountRow = db.prepare('SELECT COUNT(*) as count FROM peer_signals WHERE user_id = ?').get(userId) as any;
    const referralCount = user?.referral_count || 0;
    const totalSignals = signalCountRow?.count || 1;
    const streakDays = user?.streak_days || 1;

    const conversionCoeff = 0.28;
    const baseK = Math.max(0.75, (referralCount + 1) * conversionCoeff + (totalSignals * 0.01));
    const kFactor = Math.min(2.85, Number(baseK.toFixed(2)));
    const velocity = Math.min(0.99, Number((0.45 + (totalSignals % 20) * 0.025 + (referralCount * 0.05)).toFixed(2)));
    const activeLoops = Math.min(8, 2 + Math.floor(referralCount / 2) + (streakDays > 3 ? 1 : 0));
    const liftMultiplier = Math.min(2.50, Number((1.0 + (activeLoops * 0.12) + (streakDays * 0.02)).toFixed(2)));

    let cascadeStage: CascadeStage = 'SUBCRITICAL';
    if (kFactor >= 1.5) cascadeStage = 'SUPERNOVA';
    else if (kFactor >= 1.0) cascadeStage = 'SUPERCRITICAL';

    let swarmReactionState = 'AUTONOMOUS_COUNCIL_SYNAPSE';
    let recentSwarmAction = 'Liam: Net Worth gravity well stabilized.';
    if (cascadeStage === 'SUPERNOVA') {
      swarmReactionState = 'SUPERNOVA_CREATIVE_BURST';
      recentSwarmAction = 'Josh: Supernova viral loop triggered! +25% XP multiplier active.';
    } else if (cascadeStage === 'SUPERCRITICAL') {
      swarmReactionState = 'SUPERCRITICAL_MOMENTUM';
      recentSwarmAction = 'Antoni: High-velocity referral loop compounding at 1.45x.';
    }

    const existing = db.prepare('SELECT * FROM agk_growth_metrics WHERE user_id = ?').get(userId) as any;
    if (existing) {
      db.prepare(`
        UPDATE agk_growth_metrics 
        SET k_factor = ?, viral_velocity = ?, lift_multiplier = ?, active_loops_count = ?, cascade_stage = ?, swarm_reaction_state = ?, updated_at = ?
        WHERE user_id = ?
      `).run(kFactor, velocity, liftMultiplier, activeLoops, cascadeStage, swarmReactionState, now, userId);
    } else {
      db.prepare(`
        INSERT INTO agk_growth_metrics (id, user_id, k_factor, viral_velocity, lift_multiplier, active_loops_count, cascade_stage, swarm_reaction_state, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`agk_${crypto.randomBytes(8).toString('hex')}`, userId, kFactor, velocity, liftMultiplier, activeLoops, cascadeStage, swarmReactionState, now);
    }

    return {
      userId,
      kFactor,
      viralVelocity: velocity,
      liftMultiplier,
      activeLoopsCount: activeLoops,
      cascadeStage,
      swarmReactionState,
      totalPeerSignals: totalSignals,
      recentSwarmAction,
    };
  }

  public static publishPeerPush(params: {
    senderUserId: string;
    senderName: string;
    eventType: PeerPushEvent['eventType'];
    headline: string;
    body: string;
    trustScore?: number;
  }): PeerPushEvent {
    const id = `push_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const trustScore = params.trustScore ?? 95.0;

    db.prepare(`
      INSERT INTO peer_push_events (id, sender_user_id, sender_name, event_type, headline, body, trust_score, influence_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, params.senderUserId, params.senderName, params.eventType, params.headline, params.body, trustScore, now);

    return {
      id,
      senderUserId: params.senderUserId,
      senderName: params.senderName,
      eventType: params.eventType,
      headline: params.headline,
      body: params.body,
      trustScore,
      influenceCount: 1,
      createdAt: now,
    };
  }

  public static getRecentPushEvents(limit = 12): PeerPushEvent[] {
    const rows = db.prepare(`
      SELECT * FROM peer_push_events 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit) as any[];

    if (rows.length === 0) {
      return [
        {
          id: 'seed_1',
          senderUserId: 'u_genesis_1',
          senderName: 'Founder-Plug',
          eventType: 'LIFT_CASCADE',
          headline: '?? Supernova Lift Cascade Active (+2.40x)',
          body: 'Triggered 5-agent viral compounding loop with 12 network referrals.',
          trustScore: 98.6,
          influenceCount: 24,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'seed_2',
          senderUserId: 'u_genesis_2',
          senderName: 'CosmicTrader',
          eventType: 'ABILITY_UNLOCK',
          headline: '? Plasmatic Fast-Cast Unlocked',
          body: 'Equipped 60 FPS Plasmatic particle click ability in Reality Engine.',
          trustScore: 95.2,
          influenceCount: 18,
          createdAt: new Date(Date.now() - 60000).toISOString(),
        },
        {
          id: 'seed_3',
          senderUserId: 'u_genesis_3',
          senderName: 'VaultMaster',
          eventType: 'SIGIL_MINT',
          headline: '?? Quantum Sigil Infused with 500 XP',
          body: 'Expanded fractal depth to Tier 4 with +0.15x passive yield boost.',
          trustScore: 96.8,
          influenceCount: 31,
          createdAt: new Date(Date.now() - 120000).toISOString(),
        }
      ];
    }

    return rows.map(r => ({
      id: r.id,
      senderUserId: r.sender_user_id,
      senderName: r.sender_name,
      eventType: r.event_type,
      headline: r.headline,
      body: r.body,
      trustScore: r.trust_score,
      influenceCount: r.influence_count,
      createdAt: r.created_at,
    }));
  }

  public static endorseEvent(eventId: string): { success: boolean; influenceCount: number; trustScore: number } {
    const ev = db.prepare('SELECT * FROM peer_push_events WHERE id = ?').get(eventId) as any;
    if (!ev) return { success: false, influenceCount: 0, trustScore: 0 };

    const newInfluence = (ev.influence_count || 1) + 1;
    const newTrust = Math.min(99.9, (ev.trust_score || 94.0) + 0.2);

    db.prepare(`
      UPDATE peer_push_events 
      SET influence_count = ?, trust_score = ? 
      WHERE id = ?
    `).run(newInfluence, newTrust, eventId);

    return { success: true, influenceCount: newInfluence, trustScore: newTrust };
  }

  private static mapSignalToEventType(signalType: string): PeerPushEvent['eventType'] {
    switch (signalType) {
      case 'REFERRAL_SHARE': return 'VIRAL_MILESTONE';
      case 'ABILITY_CAST': return 'ABILITY_UNLOCK';
      case 'MARKET_BUY': return 'SIGIL_MINT';
      case 'VAULT_LOCK': return 'LIFT_CASCADE';
      case 'XP_CLAIM': return 'XP_FUSION';
      default: return 'TRUST_ENDORSE';
    }
  }

  private static generateHeadline(signalType: string, userName: string): string {
    switch (signalType) {
      case 'REFERRAL_SHARE': return `?? ${userName} shared a Sovereign Referral Sigil`;
      case 'ABILITY_CAST': return `? ${userName} triggered Magical Fast-Cast Ability`;
      case 'MARKET_BUY': return `?? ${userName} unlocked Cosmic Pill Theme`;
      case 'VAULT_LOCK': return `?? ${userName} expanded Living Vault Shield`;
      case 'XP_CLAIM': return `? ${userName} ignited Tokamak XP Reactor`;
      default: return `??? ${userName} verified network interaction`;
    }
  }

  private static generateBody(signalType: string, payload?: Record<string, any>): string {
    if (payload?.description) return payload.description;
    switch (signalType) {
      case 'REFERRAL_SHARE': return 'Referral trajectory initialized with 20% compounding split.';
      case 'ABILITY_CAST': return `Cast ${payload?.abilityId || 'magical'} ability in Reality Engine.`;
      case 'MARKET_BUY': return `Equipped ${payload?.itemId || 'custom cosmic dashboard'} theme.`;
      case 'VAULT_LOCK': return 'Allocated strategic capital into asymmetric growth.';
      case 'XP_CLAIM': return 'Earned +50 XP bonus in Daily Mystery Loot Crate.';
      default: return 'Generated verified trust signal across the PeerMesh.';
    }
  }
}
