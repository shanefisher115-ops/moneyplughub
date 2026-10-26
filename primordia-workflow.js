const { execSync } = require('child_process');

const workflowSteps = [
    { name: "Global Telemetry Sync", complexity: 4.5 },
    { name: "Distributed Data Ingestion Pipeline", complexity: 11.2 },
    { name: "Multi-Cluster Neural Weight Rewire", complexity: 16.8 },
    { name: "Ultra-Dimensional Quantum Engine Deployment", complexity: 22.5 }
];

console.log(`🌌 [PrimordiaOS Workflow Engine] Initializing Automated Pipeline...\n`);

for (let i = 0; i < workflowSteps.length; i++) {
    const step = workflowSteps[i];
    console.log(`--------------------------------------------------`);
    console.log(`⚙️ [Stage ${i + 1}/${workflowSteps.length}] Executing: "${step.name}"`);
    console.log(`--------------------------------------------------`);

    try {
        // Call the Primordia CLI guardrail for this specific workflow step
        execSync(`node primordia-cli.js "${step.name}" ${step.complexity}`, { stdio: 'inherit' });
        console.log(`✨ [Stage ${i + 1} Cleared Successfully]\n`);
    } catch (err) {
        console.error(`❌ Workflow halted at Stage ${i + 1}: "${step.name}" due to unresolvable capacity constraints.`);
        process.exit(1);
    }
}

console.log(`🌌 [PrimordiaOS Workflow Engine] All workflow stages successfully executed and verified by the Triad Mesh!`);