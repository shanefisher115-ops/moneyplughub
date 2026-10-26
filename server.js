const express = require('express');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

app.post('/webhook/telemetry', (req, res) => {
    try {
        const { payload, signature, algorithm, agent_id } = req.body;
        if (!payload || !signature || algorithm !== 'Ed25519' || !agent_id) {
            return res.status(400).json({ error: 'Malformed swarm payload' });
        }

        const pubKeyPath = `keys/${agent_id}_public.pem`;
        if (!fs.existsSync(pubKeyPath)) {
            console.log(`[SECURITY] REJECTED: Unknown agent ID [${agent_id}]`);
            return res.status(401).json({ error: 'Unauthorized agent identity' });
        }

        const publicKey = fs.readFileSync(pubKeyPath, 'utf8');
        const pubKeyObj = crypto.createPublicKey(publicKey);
        const data = JSON.stringify(payload);
        const signatureBuffer = Buffer.from(signature, 'hex');

        const isValid = crypto.verify(null, Buffer.from(data), pubKeyObj, signatureBuffer);
        if (!isValid) {
            console.log(`[SECURITY] REJECTED: Invalid cryptographic signature for [${agent_id}].`);
            return res.status(401).json({ status: 'rejected', reason: 'Invalid signature' });
        }

        console.log(`[VERIFY] SUCCESS: Validated telemetry from swarm agent [${agent_id}]`);
        fs.appendFileSync('swarm_audit.log', JSON.stringify({ receivedAt: new Date().toISOString(), agent_id, payload }) + '\n');

        return res.status(200).json({ status: 'accepted', verified: true, swarm_node: agent_id });
    } catch (err) {
        console.error('[ERROR] Swarm ingestion failure:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`[SWARM GRID] PrimordiaOS Multi-Agent Ingress active on port ${PORT}`);
});
