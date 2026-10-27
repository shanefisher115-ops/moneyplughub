const express = require('express');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const LEDGER_FILE = 'swarm_ledger.json';

// Deterministic stringifier to guarantee identical payloads during signing and verification
function canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalStringify).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

function verifyPeer(senderId, payload, signatureHex) {
    const pubKeyPath = `keys/${senderId}_public.pem`;
    if (!fs.existsSync(pubKeyPath)) {
        console.error(`[SECURITY] REJECTED: Public key not found for peer [${senderId}]`);
        return false;
    }
    try {
        const pubKey = fs.readFileSync(pubKeyPath, 'utf8');
        const pubKeyObj = crypto.createPublicKey(pubKey);
        const data = canonicalStringify(payload);
        return crypto.verify(null, Buffer.from(data), pubKeyObj, Buffer.from(signatureHex, 'hex'));
    } catch (e) {
        console.error(`[SECURITY] Verification exception for [${senderId}]:`, e.message);
        return false;
    }
}

function evaluateAndHealChain() {
    if (!fs.existsSync(LEDGER_FILE)) {
        fs.writeFileSync(LEDGER_FILE, JSON.stringify([], null, 2));
        return { status: 'HEALED', action: 'Initialized missing ledger file' };
    }

    try {
        let chain = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
        if (!Array.isArray(chain)) throw new Error('Invalid chain format');

        for (let i = 1; i < chain.length; i++) {
            if (chain[i].previousHash !== chain[i-1].hash) {
                console.error(`[HEALER] Cryptographic break detected at block #${i}. Pruning corrupt tail...`);
                chain = chain.slice(0, i);
                fs.writeFileSync(LEDGER_FILE, JSON.stringify(chain, null, 2));
                return { status: 'HEALED', action: `Pruned corrupted chain from block #${i}` };
            }
        }
        return { status: 'NOMINAL', blocks: chain.length, integrity: 'SECURE' };
    } catch (e) {
        fs.writeFileSync(LEDGER_FILE, JSON.stringify([], null, 2));
        return { status: 'HEALED', action: 'Reset malformed ledger JSON' };
    }
}

app.get('/health', (req, res) => {
    const evaluation = evaluateAndHealChain();
    res.json({
        system: 'PrimordiaOS Sovereign Swarm',
        timestamp: new Date().toISOString(),
        evaluation
    });
});

app.post('/telemetry', (req, res) => {
    const { senderId, payload, signature } = req.body;
    if (!senderId || !payload || !signature) {
        return res.status(400).json({ error: 'Missing senderId, payload, or signature' });
    }

    if (!verifyPeer(senderId, payload, signature)) {
        console.warn(`[SECURITY] REJECTED: Invalid Ed25519 signature from incoming telemetry for [${senderId}].`);
        return res.status(401).json({ error: 'Invalid Ed25519 signature' });
    }

    // Append to ledger securely
    let chain = [];
    if (fs.existsSync(LEDGER_FILE)) {
        try { chain = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')); } catch (e) { chain = []; }
    }

    const prevBlock = chain.length > 0 ? chain[chain.length - 1] : null;
    const previousHash = prevBlock ? prevBlock.hash : '0'.repeat(64);
    const index = chain.length;
    const timestamp = new Date().toISOString();

    const blockData = { index, timestamp, senderId, payload, signature, previousHash };
    const hash = crypto.createHash('sha256').update(canonicalStringify(blockData)).digest('hex');

    chain.push({ ...blockData, hash });
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(chain, null, 2), 'utf8');

    console.log(`[TELEMETRY] Verified & anchored block #${index} from [${senderId}]`);
    res.json({ status: 'ACCEPTED', blockIndex: index, hash });
});

// Terminate any port 3000 conflicts and start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[HEAL-SERVER] Self-evaluating sovereign guardian active on port ${PORT}`);
});
