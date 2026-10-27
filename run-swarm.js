const crypto = require('crypto');
const fs = require('fs');

if (fs.existsSync('keys')) {
    fs.rmSync('keys', { recursive: true, force: true });
}
fs.mkdirSync('keys');

async function runSwarm() {
    const agents = ['agent-prime', 'agent-omega', 'agent-synth'];
    
    for (const agentId of agents) {
        const privKeyPath = `keys/${agentId}_private.pem`;
        const pubKeyPath = `keys/${agentId}_public.pem`;

        const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
            privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
            publicKeyEncoding: { format: 'pem', type: 'spki' }
        });
        fs.writeFileSync(privKeyPath, privateKey);
        fs.writeFileSync(pubKeyPath, publicKey);

        const payload = {
            agent_id: agentId,
            timestamp: new Date().toISOString(),
            action: 'swarm_state_transition',
            metrics: { cpu_load: Math.random().toFixed(2), memory_allocated: '2GB' }
        };

        const data = JSON.stringify(payload);
        const privKeyObj = crypto.createPrivateKey({ key: privateKey, format: 'pem', type: 'pkcs8' });
        const signature = crypto.sign(null, Buffer.from(data), privKeyObj).toString('hex');
        const signedPackage = { algorithm: 'Ed25519', agent_id: agentId, payload, signature };

        console.log(`[SWARM] Broadcasting signed telemetry for ${agentId}...`);
        try {
            const response = await fetch('http://localhost:3000/webhook/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedPackage)
            });
            const result = await response.json();
            console.log(`[CLIENT] Response for ${agentId}:`, result);
        } catch (err) {
            console.error(`[ERROR] Failed to send telemetry for ${agentId}:`, err.message);
        }
    }
}

runSwarm();
