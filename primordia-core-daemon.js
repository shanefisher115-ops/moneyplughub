const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const METRICS_FILE = path.join(__dirname, 'hyper_arena_metrics.json');
const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');
const LEDGER_FILE = path.join(__dirname, 'primordia_ledger.log');

console.log(`\n🌌 [PrimordiaOS Core Daemon] Initializing Autonomous Background Runtime...`);
console.log(`📜 Immutable Ledger attached: ${LEDGER_FILE}`);
console.log(`📡 Monitoring system telemetry and task queue...\n`);

// Initialize queue file if missing
if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify([], null, 2));
}

const getLatestMetrics = () => {
    if (fs.existsSync(METRICS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
            if (data.length > 0) return data[data.length - 1];
        } catch (e) {
            return null;
        }
    }
    return null;
};

const writeLedgerEntry = (task, status, requiredThreshold, metrics) => {
    const timestamp = new Date().toISOString();
    const apex = metrics ? metrics.apex_index : 'N/A';
    const arc = metrics ? metrics.architect_potency : 'N/A';
    const sen = metrics ? metrics.sentinel_potency : 'N/A';
    const mut = metrics ? metrics.mutator_potency : 'N/A';

    const logLine = `[${timestamp}] STATUS: ${status} | TASK: "${task.task}" | COMPLEXITY: ${task.complexity} | REQ_THRESH: ${requiredThreshold} | APEX: ${apex} (ARC: ${arc}, SEN: ${sen}, MUT: ${mut})\n`;
    
    fs.appendFileSync(LEDGER_FILE, logLine, 'utf8');
};

// Main Autonomous Daemon Loop
setInterval(() => {
    try {
        if (!fs.existsSync(QUEUE_FILE)) return;
        const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        
        if (queue.length === 0) return;

        const task = queue.shift();
        const metrics = getLatestMetrics();
        const currentApex = metrics ? metrics.apex_index : 1.0;
        const requiredThreshold = parseFloat((task.complexity * 0.75).toFixed(2));

        console.log(`[Daemon Tick] Evaluating Queued Task: "${task.task}" (Complexity: ${task.complexity})`);
        console.log(`             Required Threshold: ${requiredThreshold} | Current Apex Index: ${currentApex}`);

        if (requiredThreshold <= currentApex) {
            console.log(`✨ [DAEMON] Task "${task.task}" approved and executed instantly.\n`);
            writeLedgerEntry(task, 'EXECUTED_SUCCESS', requiredThreshold, metrics);
        } else {
            console.log(`🚨 [DAEMON] Insufficient capacity. Triggering background mutation arena...`);
            writeLedgerEntry(task, 'MUTATION_MUTATING', requiredThreshold, metrics);
            
            execSync('py experiment_hyper_arena.py', { stdio: 'inherit' });
            
            const updatedMetrics = getLatestMetrics();
            console.log(`🧬 [DAEMON] Mutation complete. Re-queuing task for re-evaluation.\n`);
            queue.unshift(task);
            writeLedgerEntry(task, 'MUTATION_COMPLETE', requiredThreshold, updatedMetrics);
        }

        fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    } catch (err) {
        console.error(`❌ Daemon Error:`, err.message);
    }
}, 8000);