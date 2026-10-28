export class ArchivistRealm {
    realm = 'ARCHIVIST';
    id = 'realm_archivist_memory';
    status = 'IDLE';
    metrics = { invocations: 0, avgLatencyMs: 0, errorRate: 0, lastActive: Date.now() };
    bus;
    userMemoryDb = new Map();
    constructor(bus) {
        this.bus = bus;
    }
    async activate() {
        this.status = 'ACTIVE';
        this.bus.on('VOICE_TRANSCRIPT', async (payload) => {
            this.recordTranscript(payload);
        });
        this.bus.on('VOICE_INTENT', async (payload) => {
            this.recordIntent(payload);
        });
        this.bus.on('VOICE_FRAUD', async (payload) => {
            this.recordFraudTelemetry(payload);
        });
        console.log('[ArchivistRealm] 📜 Memory Graph & Osmium Ledger Archivist Online.');
    }
    async deactivate() {
        this.status = 'STANDBY';
        console.log('[ArchivistRealm] Standby state activated.');
    }
    recordTranscript(transcript) {
        const memory = this.getOrCreateMemory(transcript.userId);
        memory.knownDialects.add(transcript.language);
        memory.totalConversations++;
        this.broadcastMemoryState(transcript.userId, transcript.sessionId);
    }
    recordIntent(intent) {
        const memory = this.getOrCreateMemory(intent.userId);
        memory.recentIntents.push(intent.intent);
        if (memory.recentIntents.length > 20)
            memory.recentIntents.shift();
        if (intent.entities.targetLanguage) {
            memory.preferredLanguage = intent.entities.targetLanguage;
        }
    }
    recordFraudTelemetry(fraud) {
        const memory = this.getOrCreateMemory(fraud.userId);
        memory.fraudHistoryScores.push(fraud.riskScore);
        if (memory.fraudHistoryScores.length > 30)
            memory.fraudHistoryScores.shift();
    }
    getOrCreateMemory(userId) {
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
    broadcastMemoryState(userId, sessionId) {
        const mem = this.getOrCreateMemory(userId);
        const avgScore = mem.fraudHistoryScores.reduce((a, b) => a + b, 0) / mem.fraudHistoryScores.length;
        const payload = {
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
    getUserMemory(userId) {
        return this.getOrCreateMemory(userId);
    }
}
