export type RealmType = 
  | 'LISTENER'
  | 'INTERPRETER'
  | 'TRANSLATOR'
  | 'SENTINEL'
  | 'LEDGER'
  | 'HERALD'
  | 'ARCHIVIST'
  | 'VISUAL';

export type RealmStatus = 'IDLE' | 'ACTIVE' | 'BURST' | 'STANDBY' | 'THROTTLED' | 'ERROR';

export type VoiceEventType = 
  | 'VOICE_INPUT'
  | 'VOICE_TRANSCRIPT'
  | 'VOICE_INTENT'
  | 'VOICE_FRAUD'
  | 'VOICE_PAYOUT'
  | 'VOICE_TRANSLATION'
  | 'VOICE_OUTPUT'
  | 'VOICE_MEMORY'
  | 'MCP_IDENTITY'
  | 'MCP_ZERO_TRUST'
  | 'MCP_TUNNEL'
  | 'MCP_SWARM';

export interface EmotionMetrics {
  primary: 'neutral' | 'calm' | 'excited' | 'stressed' | 'urgency' | 'suspicious' | 'confident';
  valence: number;
  arousal: number;
  stressLevel: number;
  pitchJitter: number;
}

export interface VoiceInputPayload {
  sessionId: string;
  userId: string;
  audioChunkBase64: string;
  sampleRate: number;
  channels: number;
  isFinal: boolean;
  rmsVolume: number;
  timestamp: number;
}

export interface VoiceTranscriptPayload {
  sessionId: string;
  userId: string;
  text: string;
  language: string;
  confidence: number;
  isFinal: boolean;
  silenceDetected: boolean;
  emotion: EmotionMetrics;
  timestamp: number;
}

export type IntentCategory = 
  | 'CHECK_BALANCE'
  | 'REQUEST_PAYOUT'
  | 'CONFIRM_PAYOUT'
  | 'CANCEL_PAYOUT'
  | 'REFERRAL_INQUIRY'
  | 'COMMISSION_BOOST'
  | 'ACCOUNT_RECOVERY'
  | 'KYC_ASSISTANCE'
  | 'FRAUD_DISPUTE'
  | 'MARKET_OVERVIEW'
  | 'TRANSLATION_BURST'
  | 'GENERAL_CONVERSATION';

export interface VoiceIntentPayload {
  sessionId: string;
  userId: string;
  rawQuery: string;
  normalizedQuery: string;
  intent: IntentCategory;
  confidence: number;
  entities: {
    amount?: number;
    currency?: string;
    payoutMethod?: 'STRIPE' | 'CRYPTO' | 'BANK_WIRE' | 'XP_CREDIT';
    referralCode?: string;
    targetLanguage?: string;
    riskEscalation?: boolean;
  };
  requiresLedger: boolean;
  requiresSentinel: boolean;
  requiresTranslation: boolean;
  escalateToHuman: boolean;
  timestamp: number;
}

export interface FraudRiskFactor {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  scoreImpact: number;
}

export interface VoiceFraudPayload {
  sessionId: string;
  userId: string;
  riskScore: number; // 0 to 100
  isAnomaly: boolean;
  syntheticVoiceProbability: number;
  voiceStressDetected: boolean;
  flags: FraudRiskFactor[];
  accountTakeoverRisk: 'NONE' | 'POSSIBLE' | 'PROBABLE' | 'DEFINITIVE';
  action: 'ALLOW' | 'STEP_UP_2FA' | 'FREEZE_PAYOUT' | 'LOCK_SESSION';
  timestamp: number;
}

export interface VoicePayoutPayload {
  sessionId: string;
  userId: string;
  payoutId: string;
  amount: number;
  currency: string;
  destination: string;
  status: 'PENDING_VOICE_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'ESCROW_LOCKED' | 'EXECUTING';
  biometricVoiceToken: string;
  confirmationPhrase: string;
  riskScore: number;
  mcpVerified?: boolean;
  timestamp: number;
}

export interface VoiceTranslationPayload {
  sessionId: string;
  userId: string;
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  burstSessionActive: boolean;
  autoCloseRemainingSeconds: number;
  timestamp: number;
}

export interface VoiceOutputPayload {
  sessionId: string;
  userId: string;
  text: string;
  language: string;
  audioBase64?: string;
  audioUrl?: string;
  persona: string;
  targetTone: 'AUTHORITATIVE' | 'OPTIMISTIC' | 'CALM' | 'VIGILANT' | 'MYTHIC';
  streamingChunkIndex?: number;
  isFinalChunk?: boolean;
  durationSeconds?: number;
  timestamp: number;
}

export interface VoiceMemoryPayload {
  userId: string;
  sessionId: string;
  preferredLanguage: string;
  totalConversations: number;
  lastPayoutAmount?: number;
  lastPayoutTimestamp?: number;
  historicalRiskAvg: number;
  knownDialects: string[];
  episodicContextSummary: string;
  activeEscrowLocks: number;
  timestamp: number;
}

// ─── MCP INTEGRATION LAYER EVENT PAYLOADS ───────────────────────────────────

export interface DevicePostureCheck {
  isCompliant: boolean;
  diskEncrypted: boolean;
  osVersion: string;
  firewallActive: boolean;
  warpConnected: boolean;
  trustScore: number; // 0 to 100
}

export interface McpIdentityPayload {
  userId: string;
  sessionId: string;
  serviceToken: string;
  identityConfidence: number; // 0.0 to 1.0
  devicePosture: DevicePostureCheck;
  boundRealms: RealmType[];
  tokenExpiresAt: number;
  personaConstraints?: string[];
  timestamp: number;
}

export interface McpZeroTrustPayload {
  sessionId: string;
  userId: string;
  riskScore: number;
  flags: FraudRiskFactor[];
  action: 'ALLOW' | 'STEP_UP' | 'FREEZE' | 'LOCK' | 'ISOLATE';
  enforcementTarget: 'SESSION' | 'PAYOUT_FLOW' | 'SERVICE_TOKEN' | 'BROWSER_ISOLATION';
  casbRemediationTriggered: boolean;
  timestamp: number;
}

export interface McpTunnelPayload {
  tunnelId: string;
  sessionId: string;
  audioChunkBase64: string;
  persona: string;
  language: string;
  encryptionKey: string;
  encrypted: boolean;
  timestamp: number;
}

export interface McpSwarmPayload {
  nodeId: string;
  realm: RealmType;
  status: RealmStatus;
  metrics: {
    invocations: number;
    avgLatencyMs: number;
    errorRate: number;
    lastActive: number;
  };
  directives: string[];
  timestamp: number;
}

export type VoiceEventMap = {
  VOICE_INPUT: VoiceInputPayload;
  VOICE_TRANSCRIPT: VoiceTranscriptPayload;
  VOICE_INTENT: VoiceIntentPayload;
  VOICE_FRAUD: VoiceFraudPayload;
  VOICE_PAYOUT: VoicePayoutPayload;
  VOICE_TRANSLATION: VoiceTranslationPayload;
  VOICE_OUTPUT: VoiceOutputPayload;
  VOICE_MEMORY: VoiceMemoryPayload;
  MCP_IDENTITY: McpIdentityPayload;
  MCP_ZERO_TRUST: McpZeroTrustPayload;
  MCP_TUNNEL: McpTunnelPayload;
  MCP_SWARM: McpSwarmPayload;
};

export interface SwarmNode {
  realm: RealmType;
  id: string;
  status: RealmStatus;
  metrics: {
    invocations: number;
    avgLatencyMs: number;
    errorRate: number;
    lastActive: number;
  };
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  mcpBindIdentity?(identity: McpIdentityPayload): Promise<void>;
  mcpEmitDirective?(directive: string): Promise<void>;
}
