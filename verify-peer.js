const crypto = require('crypto');
const fs = require('fs');

function verifyPeer(senderId, payload, signatureHex) {
    const pubKeyPath = `keys/${senderId}_public.pem`;
    if (!fs.existsSync(pubKeyPath)) {
        console.error(`[P2P SECURITY] REJECTED: Public key not found for peer [${senderId}]`);
        return false;
    }
    const pubKey = fs.readFileSync(pubKeyPath, 'utf8');
    const pubKeyObj = crypto.createPublicKey(pubKey);
    const data = JSON.stringify(payload);
    return crypto.verify(null, Buffer.from(data), pubKeyObj, Buffer.from(signatureHex, 'hex'));
}

module.exports = { verifyPeer };
