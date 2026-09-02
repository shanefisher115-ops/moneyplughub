/**
 * MoneyOS Voice Engine — Swarm Voices Registry & Multi-Agent Audio Mesh
 * Location: src/backend/voice/swarmVoices.ts
 */

import { BasePersona, EmotionalTone, PersonaProfile } from './persona';

export type SwarmAgentId = 
  | 'balance_agent' 
  | 'earnings_agent' 
  | 'referral_agent' 
  | 'insight_agent' 
  | 'automation_agent';

export interface SwarmAgentVoiceConfig {
  id: SwarmAgentId;
  name: string;
  title: string;
  role: string;
  avatarIcon: string;
  badge: string;
  themeColor: string;
  glowColor: string;
  voiceId: string;
  fallbackVoiceId: string;
  persona: BasePersona;
  defaultTone: EmotionalTone;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  spatialPan: 'left' | 'center' | 'right';
  spatialPanValue: number;
  soundscape: 'vault_hum' | 'sigil_shimmer' | 'cyber_pulse' | 'harmonic_drone' | 'none';
  keywords: string[];
  signaturePrefix: string;
  systemPromptVoiceFlavor: string;
}

export const SWARM_VOICE_REGISTRY: Record<SwarmAgentId, SwarmAgentVoiceConfig> = {
  balance_agent: {
    id: 'balance_agent',
    name: 'BalanceAgent (Liam)',
    title: 'Strategist & Vault Sovereign',
    role: 'Real-Time Balances & Net Worth Engine',
    avatarIcon: 'Wallet',
    badge: 'Strategist',
    themeColor: '#10b981', // Emerald
    glowColor: 'rgba(16, 185, 129, 0.4)',
    voiceId: 'nPczCjzI2devNBz1zQrb', // Brian - Deep, Resonant, Authoritative Baritone
    fallbackVoiceId: 'm6Q2NTc6q5ldaHnwzSDp',
    persona: 'vault_explanation',
    defaultTone: 'calm',
    stability: 0.65,
    similarity_boost: 0.85,
    style: 0.15,
    speed: 0.90,
    spatialPan: 'left',
    spatialPanValue: -0.75,
    soundscape: 'vault_hum',
    keywords: ['balance', 'net worth', 'account', 'checking', 'savings', 'cash', 'debt', 'assets', 'how much', 'money', 'card balance', 'chase'],
    signaturePrefix: 'Opening the Vault ledger. ',
    systemPromptVoiceFlavor: 'Speak with calm authority, financial grounding, and absolute numerical precision.',
  },
  earnings_agent: {
    id: 'earnings_agent',
    name: 'EarningsAgent (Antoni)',
    title: 'Optimizer & Yield Strategist',
    role: 'Payouts, Daily Compounding & Commission Scaler',
    avatarIcon: 'TrendingUp',
    badge: 'Optimizer',
    themeColor: '#f59e0b', // Amber / Cosmic Gold
    glowColor: 'rgba(245, 158, 11, 0.4)',
    voiceId: 'IKne3meq5aSn9XLyUdCD', // Charlie - Australian, fast, energetic, sharp optimizer
    fallbackVoiceId: 'm6Q2NTc6q5ldaHnwzSDp',
    persona: 'creator_mode',
    defaultTone: 'hype',
    stability: 0.30,
    similarity_boost: 0.85,
    style: 0.55,
    speed: 1.22,
    spatialPan: 'right',
    spatialPanValue: 0.45,
    soundscape: 'cyber_pulse',
    keywords: ['earnings', 'commission', 'payout', 'yield', 'daily compounding', 'mrr', 'revenue', 'monetize', 'income', 'profit', 'cashback'],
    signaturePrefix: 'Optimizing high-velocity cash flow. ',
    systemPromptVoiceFlavor: 'Speak with ultra-fast momentum, sharp confidence, and rapid-fire leverage.',
  },
  referral_agent: {
    id: 'referral_agent',
    name: 'ReferralAgent (Rachel)',
    title: 'Explainer & Growth Guide',
    role: 'Referrals, Sigils & Viral Multipliers',
    avatarIcon: 'Zap',
    badge: 'Explainer',
    themeColor: '#a855f7', // Purple / Cyber Magenta
    glowColor: 'rgba(168, 85, 247, 0.4)',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah - Mature, reassuring, warm, clear female
    fallbackVoiceId: 'm6Q2NTc6q5ldaHnwzSDp',
    persona: 'referral_strategy',
    defaultTone: 'assertive',
    stability: 0.45,
    similarity_boost: 0.88,
    style: 0.40,
    speed: 1.04,
    spatialPan: 'left',
    spatialPanValue: -0.35,
    soundscape: 'sigil_shimmer',
    keywords: ['referral', 'sigil', 'invite', 'share card', 'xp', 'level', 'badge', 'link', 'promo code', 'founding50', 'affiliate', 'constellation'],
    signaturePrefix: 'Making this clear and seamless. ',
    systemPromptVoiceFlavor: 'Speak with warm charisma, emotional safety, and crystal-clear reframing.',
  },
  insight_agent: {
    id: 'insight_agent',
    name: 'InsightAgent (Adam)',
    title: 'Architect & Systems Engineer',
    role: 'Financial Diagnostics & Systems Architecture',
    avatarIcon: 'PieChart',
    badge: 'Architect',
    themeColor: '#06b6d4', // Cyan / Electric Blue
    glowColor: 'rgba(6, 182, 212, 0.4)',
    voiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel - British, steady broadcaster, structured executive
    fallbackVoiceId: 'm6Q2NTc6q5ldaHnwzSDp',
    persona: 'error_neutral',
    defaultTone: 'neutral',
    stability: 0.65,
    similarity_boost: 0.85,
    style: 0.15,
    speed: 0.96,
    spatialPan: 'center',
    spatialPanValue: 0.0,
    soundscape: 'harmonic_drone',
    keywords: ['insight', 'budget', 'spending', 'leak', 'analysis', 'telemetry', 'optimize', 'subscription', 'recurring', 'bills', 'recommend'],
    signaturePrefix: 'Architectural framework active. ',
    systemPromptVoiceFlavor: 'Speak with structured analytical precision, systems thinking, and trade-off clarity.',
  },
  automation_agent: {
    id: 'automation_agent',
    name: 'AutomationAgent (Josh)',
    title: 'Motivator & Command Co-Pilot',
    role: 'Action Execution, Transfers & Rule Triggers',
    avatarIcon: 'Cpu',
    badge: 'Motivator',
    themeColor: '#3b82f6', // Sapphire Blue
    glowColor: 'rgba(59, 130, 246, 0.4)',
    voiceId: 'SOYHLrjzK2X1ezoPC6cr', // Harry - Fierce, bold, high-energy motivator
    fallbackVoiceId: 'm6Q2NTc6q5ldaHnwzSDp',
    persona: 'chamber_unlock',
    defaultTone: 'ascension',
    stability: 0.35,
    similarity_boost: 0.85,
    style: 0.50,
    speed: 1.15,
    spatialPan: 'right',
    spatialPanValue: 0.80,
    soundscape: 'cyber_pulse',
    keywords: ['transfer', 'pay', 'send', 'execute', 'run', 'automate', 'rule', 'trigger', 'daily loop', 'command', 'action', 'pay off'],
    signaturePrefix: 'Energy primed and ready to move. ',
    systemPromptVoiceFlavor: 'Speak with high activation energy, bold motivation, and decisive forward drive.',
  },
};

/**
 * Classifies user text into the best matching Swarm Agent in the mesh
 */
export function classifySwarmVoiceAgent(text: string, manualOverride?: SwarmAgentId): SwarmAgentVoiceConfig {
  if (manualOverride && SWARM_VOICE_REGISTRY[manualOverride]) {
    return SWARM_VOICE_REGISTRY[manualOverride];
  }

  const lower = (text || '').toLowerCase().trim();

  // 1. Check Automation/Command actions first
  if (
    lower.startsWith('pay ') || 
    lower.startsWith('transfer ') || 
    lower.startsWith('send ') || 
    lower.startsWith('move ') ||
    lower.includes('execute') ||
    lower.includes('automate') ||
    lower.includes('daily loop')
  ) {
    return SWARM_VOICE_REGISTRY.automation_agent;
  }

  // 2. Score across keywords
  const scores: Record<SwarmAgentId, number> = {
    balance_agent: 0,
    earnings_agent: 0,
    referral_agent: 0,
    insight_agent: 0,
    automation_agent: 0,
  };

  (Object.keys(SWARM_VOICE_REGISTRY) as SwarmAgentId[]).forEach((agentId) => {
    const config = SWARM_VOICE_REGISTRY[agentId];
    config.keywords.forEach((keyword) => {
      if (lower.includes(keyword)) {
        scores[agentId] += keyword.includes(' ') ? 2.5 : 1.0;
      }
    });
  });

  let bestAgent: SwarmAgentId = 'balance_agent';
  let maxScore = 0;

  (Object.keys(scores) as SwarmAgentId[]).forEach((agentId) => {
    if (scores[agentId] > maxScore) {
      maxScore = scores[agentId];
      bestAgent = agentId;
    }
  });

  // Default to BalanceAgent if no strong match, or if general greeting
  return SWARM_VOICE_REGISTRY[bestAgent];
}
