import { globalVoiceBus } from './eventBus';
import { ListenerRealm } from './realms/ListenerRealm';
import { InterpreterRealm } from './realms/InterpreterRealm';
import { TranslatorRealm } from './realms/TranslatorRealm';
import { SentinelRealm } from './realms/SentinelRealm';
import { LedgerRealm } from './realms/LedgerRealm';
import { HeraldRealm } from './realms/HeraldRealm';
import { ArchivistRealm } from './realms/ArchivistRealm';
import { mcp, bus as mcpBus } from './mcp';
export class MoneyPlugHubVoiceOS {
    bus;
    nodes = new Map();
    isRunning = false;
    listener;
    interpreter;
    translator;
    sentinel;
    ledger;
    herald;
    archivist;
    constructor(bus = globalVoiceBus) {
        this.bus = bus;
        this.listener = new ListenerRealm(this.bus);
        this.interpreter = new InterpreterRealm(this.bus);
        this.translator = new TranslatorRealm(this.bus);
        this.sentinel = new SentinelRealm(this.bus);
        this.ledger = new LedgerRealm(this.bus);
        this.herald = new HeraldRealm(this.bus);
        this.archivist = new ArchivistRealm(this.bus);
        this.nodes.set('LISTENER', this.listener);
        this.nodes.set('INTERPRETER', this.interpreter);
        this.nodes.set('TRANSLATOR', this.translator);
        this.nodes.set('SENTINEL', this.sentinel);
        this.nodes.set('LEDGER', this.ledger);
        this.nodes.set('HERALD', this.herald);
        this.nodes.set('ARCHIVIST', this.archivist);
        // Bridge MCP events to Unified Voice Event Bus
        mcpBus.on('MCP_IDENTITY', (data) => this.bus.emit('MCP_IDENTITY', data));
        mcpBus.on('MCP_ZERO_TRUST', (data) => this.bus.emit('MCP_ZERO_TRUST', data));
        mcpBus.on('MCP_TUNNEL', (data) => this.bus.emit('MCP_TUNNEL', data));
        mcpBus.on('MCP_SWARM', (data) => this.bus.emit('MCP_SWARM', data));
    }
    async boot() {
        if (this.isRunning)
            return;
        console.log('[VoiceOS] Booting MoneyPlugHub 8-Realm Voice Intelligence & MCP Zero Trust Mesh...');
        for (const [realm, node] of this.nodes.entries()) {
            await node.activate();
            mcp.swarm.activate(node.id, realm);
        }
        this.isRunning = true;
        console.log('[VoiceOS] All 8 Voice OS Realms & MCP Modules Synchronized.');
    }
    async shutdown() {
        for (const [realm, node] of this.nodes.entries()) {
            await node.deactivate();
            mcp.swarm.deactivate(node.id, realm);
        }
        this.isRunning = false;
    }
    getSwarmStatus() {
        return Array.from(this.nodes.entries()).map(([realm, node]) => ({
            realm,
            id: node.id,
            status: node.status,
            metrics: node.metrics
        }));
    }
    async simulateUserVoiceQuery(userId, query, rms = 0.5) {
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const base64Audio = Buffer.from(query).toString('base64');
        // Issue MCP Service Token & Session Identity Binding
        const tokenData = mcp.identity.issueServiceToken(userId);
        mcp.identity.bindIdentity(sessionId, {
            userId,
            devicePosture: {
                warpConnected: true,
                diskEncrypted: true,
                firewallEnabled: true,
                trustScore: 98
            },
            serviceToken: tokenData.token,
            confidence: 0.99
        });
        // Zero Trust Check
        const isATOAttempt = /bypass|emergency|urgent/i.test(query);
        if (isATOAttempt) {
            mcp.zeroTrust.enforce(sessionId, 75, ['SE_URGENCY_STRESS', 'PANIC']);
        }
        this.bus.emit('VOICE_INPUT', {
            sessionId,
            userId,
            audioChunkBase64: base64Audio,
            sampleRate: 16000,
            channels: 1,
            isFinal: true,
            rmsVolume: rms,
            timestamp: Date.now()
        });
        return { sessionId, dispatched: true, serviceToken: tokenData.token };
    }
}
export const voiceOS = new MoneyPlugHubVoiceOS();
