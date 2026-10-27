const fs = require('fs');
const crypto = require('crypto');

function canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

class SwarmSupervisorClient {
    constructor() {
        this.nodes = ['agent-prime', 'agent-omega', 'agent-synth'];
        this.isRunning = true;

        process.on('SIGINT', () => {
            console.log('\n[SUPERVISOR] Shutting down PrimordiaOS swarm supervisor gracefully...');
            this.isRunning = false;
            process.exit(0);
        });
    }

    async pulse() {
        const activeNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
        const privKeyPath = `keys/${activeNode}_private.pem`;
        
        if (!fs.existsSync(privKeyPath)) return;

        const privKey = fs.readFileSync(privKeyPath, 'utf8');
        const payload = {
            timestamp: Date.now(),
            nodeId: activeNode,
            status: 'ACTIVE_SUPERVISION',
            entropy: Math.random().toFixed(4)
        };

        const dataBuffer = Buffer.from(canonicalStringify(payload));
        const signature = crypto.sign(null, dataBuffer, crypto.createPrivateKey(privKey)).toString('hex');

        try {
            const response = await fetch('http://localhost:3000/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: activeNode, payload, signature })
            });
            const result = await response.json();
            if (response.ok) {
                console.log(`[SUPERVISOR] Pulse verified & anchored -> Block #${result.blockIndex} [${activeNode}] Hash: ${result.hash.substring(0, 10)}...`);
            } else {
                console.error(`[SUPERVISOR REJECTED] [${activeNode}]`, result);
            }
        } catch (err) {
            console.error(`[SUPERVISOR ERROR] Guardian connection failed:`, err.message);
        }
    }

    async start(intervalMs = 5000) {
        console.log('[SUPERVISOR] PrimordiaOS Autonomous Swarm Watchdog active (HTTP Mode). Press Ctrl+C to stop.');
        while (this.isRunning) {
            await this.pulse();
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }
}

const supervisor = new SwarmSupervisorClient();
supervisor.start();
