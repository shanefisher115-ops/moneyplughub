const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PrimordiaAdaptivePipeline {
    constructor() {
        this.metricsPath = path.join(__dirname, 'pure_arena_metrics.json');
        this.loadApexWeights();
    }

    loadApexWeights() {
        if (fs.existsSync(this.metricsPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
                if (data.length > 0) {
                    const latest = data[data.length - 1];
                    this.apexThreshold = latest.forager_avg_evasion || 1.0;
                    console.log(`🌌 [PrimordiaOS Pipeline] Synchronized with Apex Telemetry. Evasion Threshold: ${this.apexThreshold}`);
                }
            } catch (err) {
                this.apexThreshold = 1.0;
            }
        } else {
            this.apexThreshold = 1.0;
        }
    }

    evaluateTask(taskName, taskComplexity) {
        const adaptationRequired = taskComplexity * 0.75;
        const isApproved = adaptationRequired <= this.apexThreshold;

        return {
            task: taskName,
            complexity: taskComplexity,
            required_adaptation: parseFloat(adaptationRequired.toFixed(2)),
            current_apex_threshold: this.apexThreshold,
            status: isApproved ? 'APPROVED_AUTONOMOUS_EXECUTION' : 'REJECTED_REQUIRES_MUTATION',
            timestamp: new Date().toISOString()
        };
    }

    triggerEmergencyMutation() {
        console.log("\n🚨 [PrimordiaOS Self-Healing] Task rejected due to insufficient intelligence threshold!");
        console.log("🧬 Initiating emergency mutation cycle to force evolutionary adaptation...");
        try {
            execSync('py experiment_pure_arena.py', { stdio: 'inherit' });
            this.loadApexWeights(); // Reload newly evolved threshold
        } catch (err) {
            console.error("❌ Mutation cycle failed:", err.message);
        }
    }

    runPipeline() {
        console.log("⚡ Executing PrimordiaOS Stress-Test Matrix...");
        
        // Extreme workload that exceeds current 1.98 threshold (Complexity 3.2 -> Required 2.4)
        const extremeTask = { name: "Omni-Cluster Global Neural Core Rewire", complexity: 3.2 };

        let result = this.evaluateTask(extremeTask.name, extremeTask.complexity);
        console.log(`\n[Task]: ${result.task}`);
        console.log(`  -> Status: ${result.status}`);
        console.log(`  -> Metrics: Required (${result.required_adaptation}) vs Apex Threshold (${result.current_apex_threshold})`);

        if (result.status === 'REJECTED_REQUIRES_MUTATION') {
            this.triggerEmergencyMutation();
            
            // Re-evaluate after mutation
            result = this.evaluateTask(extremeTask.name, extremeTask.complexity);
            console.log(`\n[Post-Mutation Re-evaluation]: ${result.task}`);
            console.log(`  -> New Status: ${result.status}`);
            console.log(`  -> Metrics: Required (${result.required_adaptation}) vs New Apex Threshold (${result.current_apex_threshold})`);
        }
    }
}

const pipeline = new PrimordiaAdaptivePipeline();
pipeline.runPipeline();