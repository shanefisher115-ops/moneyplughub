const crypto = require('crypto');
const fs = require('fs');

if (!fs.existsSync('signed_telemetry.json') || !fs.existsSync('public_key.pem')) {
    console.error('[ERROR] Missing signed_telemetry.json or public_key.pem');
    process.exit(1);
}

const raw = fs.readFileSync('signed_telemetry.json', 'utf8');
const signedPackage = JSON.parse(raw);

const publicKey = fs.readFileSync('public_key.pem', 'utf8');
const pubKeyObj = crypto.createPublicKey(publicKey);

const data = JSON.stringify(signedPackage.payload);
const signatureBuffer = Buffer.from(signedPackage.signature, 'hex');

const isValid = crypto.verify(null, Buffer.from(data), pubKeyObj, signatureBuffer);

if (isValid) {
    console.log('[VERIFY] SUCCESS: Ed25519 signature is valid and authentic!');
} else {
    console.error('[VERIFY] FAILURE: Signature verification failed!');
    process.exit(1);
}