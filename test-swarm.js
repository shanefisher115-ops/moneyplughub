const fs = require('fs');
const { execSync } = require('child_process');

async function simulateSwarm() {
    const agents = ['agent-prime', 'agent-omega', 'agent-synth'];
    
    for (const agent of agents) {
        console.log(`[SWARM] Generating signature for ${agent}...`);
        execSync(`node sign-multi-agent.js ${agent}`);
        
        const signedPackage = JSON.parse(fs.readFileSync(`signed_telemetry_${agent}.json`, 'utf8'));

        const response = await fetch('http://localhost:3000/webhook/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedPackage)
        });

        const result = await response.json();
        console.log(`[CLIENT] Swarm response for ${agent}:`, result);
    }
}

simulateSwarm();