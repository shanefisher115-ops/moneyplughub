const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const PrimordiaDigitalTwinEngine = require('./primordia_twin_engine');

const twin = new PrimordiaDigitalTwinEngine();
const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');

console.log("⚙️ [PrimordiaOS Worker] Advanced Autonomous Builder initiated. Ready to construct...");

function processQueue() {
    try {
        if (!fs.existsSync(QUEUE_FILE)) return;
        
        let queueData = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        if (!Array.isArray(queueData) || queueData.length === 0) return;

        const task = queueData.shift();
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueData, null, 2));

        console.log(`⚡ [Worker] Executing Task ID [${task.id}] -> Action: ${task.action}`);
        executeTaskAction(task);

    } catch (error) {
        console.error("❌ [Worker Error] Failed to process queue:", error);
    }
}

function executeTaskAction(task) {
    switch (task.action) {
        case 'WRITE_FILE':
            const targetPath = path.join(__dirname, task.payload.filename);
            fs.writeFileSync(targetPath, task.payload.content, 'utf8');
            console.log(`📝 [Builder] Successfully wrote file: ${task.payload.filename}`);
            twin.updateState({ last_built_file: task.payload.filename, system_status: 'BUILDING' });
            break;

        case 'EXECUTE_SCRIPT':
            console.log(`💻 [Exec] Running command: ${task.payload.command}`);
            exec(task.payload.command, { cwd: __dirname }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ [Exec Error]: ${error.message}`);
                    twin.updateState({ last_execution_status: 'FAILED' });
                    return;
                }
                if (stderr) console.warn(`⚠️ [Exec Stderr]: ${stderr}`);
                console.log(`✨ [Exec Output]:\n${stdout}`);
                twin.updateState({ last_execution_status: 'SUCCESS', system_status: 'SYNCHRONIZED' });
            });
            break;

        case 'SPAWN_AGENT_NODE':
            console.log(`🤖 [Agent Node] Spawning sub-node:`, task.payload);
            twin.updateState({ last_spawned_agent: task.id, system_status: 'AGENT_ACTIVE' });
            break;

        default:
            console.log(`✨ [Custom Action] Executing handler for: ${task.action}`, task.payload);
            twin.updateState({ last_executed_task: task.action });
            break;
    }
    console.log(`✅ [Worker] Task [${task.id}] pipeline step completed.\n`);
}

setInterval(processQueue, 3000);
