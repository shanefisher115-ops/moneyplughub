const http = require('http');
const { execSync } = require('child_process');

const API_URL = 'http://localhost:3000/api/evaluate-task';

// Parse arguments from CLI command
const args = process.argv.slice(2);
const taskName = args[0] || 'Default Pipeline Workload';
const taskComplexity = parseFloat(args[1]) || 5.0;

console.log(`🌌 [PrimordiaOS CLI Guardrail] Evaluating workload...`);
console.log(`📋 Task: "${taskName}" | Complexity: ${taskComplexity}`);

const payload = JSON.stringify({ taskName, taskComplexity });

const req = http.request(API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            
            console.log(`\n--------------------------------------------------`);
            console.log(`⚡ Required Adaptation Threshold : ${result.required_adaptation}`);
            console.log(`✨ Current Hyper-Apex Index     : ${result.current_hyper_apex_index}`);
            console.log(`🚦 Status                       : ${result.status}`);
            
            if (result.triad_breakdown) {
                console.log(`🧬 Triad Metrics -> Architect: ${result.triad_breakdown.architect} | Sentinel: ${result.triad_breakdown.sentinel} | Mutator: ${result.triad_breakdown.mutator}`);
            }
            console.log(`--------------------------------------------------\n`);

            if (result.status === 'APPROVED_HYPER_EXECUTION') {
                console.log(`✅ [EXECUTION PERMITTED] PrimordiaOS has verified operational capacity. Executing target process...\n`);
                process.exit(0);
            } else {
                console.log(`🚨 [EXECUTION BLOCKED] System capacity insufficient for complexity level ${taskComplexity}.`);
                console.log(`🧬 Initiating background hyper-mutation arena to evolve capacity...\n`);
                
                try {
                    execSync('py experiment_hyper_arena.py', { stdio: 'inherit' });
                    console.log(`\n✨ Hyper-mutation cycle complete. Re-evaluating task...`);
                    // Retry execution after self-healing mutation cycle
                    execSync(`node primordia-cli.js "${taskName}" ${taskComplexity}`, { stdio: 'inherit' });
                } catch (err) {
                    console.error(`❌ Mutation cycle failed: ${err.message}`);
                    process.exit(1);
                }
            }
        } catch (err) {
            console.error(`❌ Failed to parse response from Telemetry Bridge:`, err.message);
            process.exit(1);
        }
    });
});

req.on('error', (err) => {
    console.error(`❌ Unable to reach PrimordiaOS Telemetry Bridge on http://localhost:3000.`);
    console.error(`   Ensure 'node server.js' is running!`);
    process.exit(1);
});

req.write(payload);
req.end();