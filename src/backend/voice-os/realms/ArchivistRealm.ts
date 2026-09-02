import { SwarmNode, RealmStatus, VoiceTranscriptPayload, VoiceIntentPayload, VoiceFraudPayload, VoiceMemoryPayload } from '../types';
import { VoiceOSEventBus } from '../eventBus';

interface UserMemoryState {
  userId: string;
  preferredLanguage: string;
  totalConversations: number;
  lastPayoutAmount?: number;
  lastPayoutTimestamp?: number;
  fraudHistoryScores: number[];
  knownDialects: Set<string>;
  recentIntents: string[];
}

export class ArchivistRealm implements SwarmNode {
  public realm = 'ARCHIVIST' as const;
  public id = 'realm_archivist_memory';
  public status: RealmStatus = 'IDLE';
  public metrics = { invocations: 0, avgLatencyMs: 0, errorRate: 0, lastActive: Date.now() };

  private bus: VoiceOSEventBus;
  private userMemoryDb = new Map<string, UserMemoryState>();

  constructor(bus: VoiceOSEventBus) {
    this.bus = bus;
  }

  public async activate(): Promise<void> {
    this.status = 'ACTIVE';

    this.bus.on('VOICE_TRANSCRIPT', async (payload: VoiceTranscriptPayload) => {
      this.recordTranscript(payload);
    });

    this.bus.on('VOICE_INTENT', async (payload: VoiceIntentPayload) => {
      this.recordIntent(payload);
    });

    this.bus.on('VOICE_FRAUD', async (payload: VoiceFraudPayload) => {
      this.recordFraudTelemetry(payload);
    });

    console.log('[ArchivistRealm] 📜 Memory Graph & Osmium Ledger Archivist Online.');
  }

  public async deactivate(): Promise<void> {
    this.status = 'STANDBY';
    console.log('[ArchivistRealm] Standby state activated.');
  }

  private recordTranscript(transcript: VoiceTranscriptPayload): void {
    const memory = this.getOrCreateMemory(transcript.userId);
    memory.knownDialects.add(transcript.language);
    memory.totalConversations++;
    this.broadcastMemoryState(transcript.userId, transcript.sessionId);
  }

  private recordIntent(intent: VoiceIntentPayload): void {
    const memory = this.getOrCreateMemory(intent.userId);
    memory.recentIntents.push(intent.intent);
    if (memory.recentIntents.length > 20) memory.recentIntents.shift();

    if (intent.entities.targetLanguage) {
      memory.preferredLanguage = intent.entities.targetLanguage;
    }
  }

  private recordFraudTelemetry(fraud: VoiceFraudPayload): void {
    const memory = this.getOrCreateMemory(fraud.userId);
    memory.fraudHistoryScores.push(fraud.riskScore);
    if (memory.fraudHistoryScores.length > 30) memory.fraudHistoryScores.shift();
  }

  private getOrCreateMemory(userId: string): UserMemoryState {
    let mem = this.userMemoryDb.get(userId);
    if (!mem) {
      mem = {
        userId,
        preferredLanguage: 'en',
        totalConversations: 0,
        fraudHistoryScores: [5],
        knownDialects: new Set(['en']),
        recentIntents: []
      };
      this.userMemoryDb.set(userId, mem);
    }
    return mem;
  }

  private broadcastMemoryState(userId: string, sessionId: string): void {
    const mem = this.getOrCreateMemory(userId);
    const avgScore = mem.fraudHistoryScores.reduce((a, b) => a + b, 0) / mem.fraudHistoryScores.length;

    const payload: VoiceMemoryPayload = {
      userId,
      sessionId,
      preferredLanguage: mem.preferredLanguage,
      totalConversations: mem.totalConversations,
      lastPayoutAmount: mem.lastPayoutAmount,
      lastPayoutTimestamp: mem.lastPayoutTimestamp,
      historicalRiskAvg: Math.round(avgScore),
      knownDialects: Array.from(mem.knownDialects),
      episodicContextSummary: `User engaged in ${mem.totalConversations} voice sessions. Preferred language: ${mem.preferredLanguage}. Recent intent sequence: [${mem.recentIntents.slice(-3).join(' -> ')}]`,
      activeEscrowLocks: 1,
      timestamp: Date.now()
    };

    this.bus.emit('VOICE_MEMORY', payload);
  }

  public getUserMemory(userId: string): UserMemoryState {
    return this.getOrCreateMemory(userId);
  }
}
