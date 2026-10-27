const crypto = require('crypto');
const fs = require('fs');
const { verifyPeer } = require('./verify-peer');

const senderId = 'agent-omega';
const receiverId = 'agent-prime';

// Omega signs state locally using its private Ed25519 key
const privKeyPath = `keys/${senderId}_private.pem`;
const privKey = fs.readFileSync(privKeyPath, 'utf8');
const payload = { emitter: senderId, target: receiverId, type: 'HEARTBEAT_SYNC', vector: [0.98, 1.02, 0.0] };

const dataBuffer = Buffer.from(JSON.stringify(payload));
const signature = crypto.sign(null, dataBuffer, crypto.createPrivateKey(privKey));
const sigHex = signature.toString('hex');

console.log(`[P2P MESH] Broadcasting direct packet from [${senderId}] to [${receiverId}]...`);

// Prime receives and cryptographically validates Omega's signature locally
const verified = verifyPeer(senderId, payload, sigHex);
if (verified) {
    console.log(`[P2P ACCEPTED] [${receiverId}] verified sovereign signature from [${senderId}]. Zero-trust P2P handshake successful.`);
} else {
    console.error(`[P2P REJECTED] Cryptographic failure between peers.`);
}
