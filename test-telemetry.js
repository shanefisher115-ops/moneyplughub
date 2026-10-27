const crypto = require('crypto');
const fs = require('fs');

function canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

async function sendTest() {
    const senderId = 'agent-prime';
    const privKeyPath = `keys/${senderId}_private.pem`;
    if (!fs.existsSync(privKeyPath)) {
        console.error(`Private key not found for ${senderId}`);
        return;
    }

    const privKey = fs.readFileSync(privKeyPath, 'utf8');
    const payload = {
        nodeId: senderId,
        metric: 'SYSTEM_STABILITY',
        value: 1.0,
        timestamp: Date.now()
    };

    const dataBuffer = Buffer.from(canonicalStringify(payload));
    const signature = crypto.sign(null, dataBuffer, crypto.createPrivateKey(privKey)).toString('hex');

    const body = JSON.stringify({ senderId, payload, signature });

    try {
        const response = await fetch('http://localhost:3000/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        const result = await response.json();
        console.log('[TEST RESULT]', result);
    } catch (err) {
        console.error('[TEST ERROR]', err.message);
    }
}

sendTest();
