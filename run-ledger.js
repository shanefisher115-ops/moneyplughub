const crypto = require('crypto');
const fs = require('fs');
const { verifyPeer } = require('./verify-peer');

class SwarmLedger {
    constructor(filename = 'swarm_ledger.json') {
        this.filename = filename;
        this.chain = this.load();
    }

    load() {
        if (fs.existsSync(this.filename)) {
            try { return JSON.parse(fs.readFileSync(this.filename, 'utf8')); } catch (e) { return []; }
        }
        return [];
    }

    append(senderId, payload, signature) {
        const prevBlock = this.chain.length > 0 ? this.chain[this.chain.length - 1] : null;
        const previousHash = prevBlock ? prevBlock.hash : '0'.repeat(64);
        const index = this.chain.length;
        const timestamp = new Date().toISOString();

        const blockData = { index, timestamp, senderId, payload, signature, previousHash };
        const hash = crypto.createHash('sha256').update(JSON.stringify(blockData)).digest('hex');

        const block = { ...blockData, hash };
        this.chain.push(block);
        fs.writeFileSync(this.filename, JSON.stringify(this.chain, null, 2), 'utf8');
        console.log(`[LEDGER] Block #${index} anchored. Hash: ${hash.substring(0, 12)}... (Agent: ${senderId})`);
        return block;
    }

    verify() {
        for (let i = 1; i < this.chain.length; i++) {
            if (this.chain[i].previousHash !== this.chain[i-1].hash) return false;
        }
        return true;
    }
}

const ledger = new SwarmLedger();
const nodes = ['agent-prime', 'agent-omega', 'agent-synth'];

console.log('[LEDGER] Initializing immutable hash-chained swarm ledger...');

nodes.forEach((nodeId, idx) => {
    const privKey = fs.readFileSync(`keys/${nodeId}_private.pem`, 'utf8');
    const payload = { sequence: idx + 1, nodeId, status: 'NOMINAL', entropy: Math.random().toFixed(4) };
    const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload)), crypto.createPrivateKey(privKey)).toString('hex');
    
    if (verifyPeer(nodeId, payload, signature)) {
        ledger.append(nodeId, payload, signature);
    }
});

console.log(`[LEDGER INTEGRITY] Chain status verified: ${ledger.verify() ? 'SECURE' : 'COMPROMISED'} (${ledger.chain.length} blocks anchored).`);
