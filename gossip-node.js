const crypto = require('crypto');
const fs = require('fs');
const { verifyPeer } = require('./verify-peer');

class GossipNode {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.peers = ['agent-prime', 'agent-omega', 'agent-synth'].filter(id => id !== nodeId);
        this.knownState = new Map();
    }

    signPayload(payload) {
        const privKey = fs.readFileSync(`keys/${this.nodeId}_private.pem`, 'utf8');
        const dataBuffer = Buffer.from(JSON.stringify(payload));
        const signature = crypto.sign(null, dataBuffer, crypto.createPrivateKey(privKey));
        return signature.toString('hex');
    }

    gossipPulse() {
        const payload = {
            sender: this.nodeId,
            timestamp: Date.now(),
            epoch: Math.floor(Date.now() / 1000),
            metrics: { load: Math.random().toFixed(2), memory: process.memoryUsage().heapUsed }
        };
        const signature = this.signPayload(payload);
        return { payload, signature };
    }

    receiveGossip(senderId, packet) {
        const { payload, signature } = packet;
        const isValid = verifyPeer(senderId, payload, signature);
        if (isValid) {
            this.knownState.set(senderId, { payload, verifiedAt: new Date().toISOString() });
            console.log(`[GOSSIP MESH] Node [${this.nodeId}] verified & accepted state pulse from peer [${senderId}]`);
            return true;
        } else {
            console.warn(`[GOSSIP SECURITY] Node [${this.nodeId}] REJECTED invalid pulse from [${senderId}]`);
            return false;
        }
    }
}

const nodes = {
    'agent-prime': new GossipNode('agent-prime'),
    'agent-omega': new GossipNode('agent-omega'),
    'agent-synth': new GossipNode('agent-synth')
};

console.log('[GOSSIP PROTOCOL] Initializing autonomous swarm gossip grid...');
let iterations = 0;
const interval = setInterval(() => {
    if (iterations >= 3) {
        clearInterval(interval);
        console.log('[GOSSIP PROTOCOL] Swarm synchronization stable. Grid consensus locked.');
        process.exit(0);
    }
    const nodeIds = Object.keys(nodes);
    const senderId = nodeIds[iterations % nodeIds.length];
    const senderNode = nodes[senderId];
    const packet = senderNode.gossipPulse();

    console.log(`\n[BROADCAST] Node [${senderId}] broadcasting cryptographic state pulse...`);
    for (const peerId of senderNode.peers) {
        nodes[peerId].receiveGossip(senderId, packet);
    }
    iterations++;
}, 1500);
