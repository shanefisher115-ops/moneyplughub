const crypto = require('crypto');
const fs = require('fs');

let privateKey;
if (!fs.existsSync('private_key.pem')) {
    const keys = crypto.generateKeyPairSync('ed25519', {
        privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
        publicKeyEncoding: { format: 'pem', type: 'spki' }
    });
    fs.writeFileSync('private_key.pem', keys.privateKey);
    fs.writeFileSync('public_key.pem', keys.publicKey);
    console.log('[CRYPTO] Generated new Ed25519 key pair.');
    privateKey = keys.privateKey;
} else {
    privateKey = fs.readFileSync('private_key.pem', 'utf8');
}

const payload = {
    agent_id: "primordia-core-agent",
    timestamp: Math.floor(Date.now() / 1000),
    action: "deploy_telemetry_verifiable_proof",
    metrics: { status: "success", trust_tier: "signed" }
};

const data = JSON.stringify(payload);
fs.writeFileSync('telemetry_payload.json', data, 'utf8');

const privKeyObj = crypto.createPrivateKey(privateKey);
const signature = crypto.sign(null, Buffer.from(data), privKeyObj);

const signedPackage = {
    payload: payload,
    signature: signature.toString('hex'),
    algorithm: 'Ed25519'
};

fs.writeFileSync('signed_telemetry.json', JSON.stringify(signedPackage, null, 2), 'utf8');
console.log('[CRYPTO] Payload signed successfully with Ed25519! Output: signed_telemetry.json');