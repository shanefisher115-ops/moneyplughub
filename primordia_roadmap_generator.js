const http = require('http');

const roadmapTasks = [
    {
        action: "WRITE_FILE",
        payload: {
            filename: "apex_core_utils.js",
            content: "module.exports = { getApexSigil: () => 'SIGIL-GOTHIC-VALLEY-V2' };"
        }
    },
    {
        action: "WRITE_FILE",
        payload: {
            filename: "apex_test.js",
            content: "const utils = require('./apex_core_utils');\nconsole.log('🔮 [Apex Test] Verified Sigil:', utils.getApexSigil());"
        }
    },
    {
        action: "EXECUTE_SCRIPT",
        payload: {
            command: "node apex_test.js"
        }
    }
];

async function enqueueTask(task) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(task);
        const req = http.request({
            hostname: 'localhost',
            port: 3005,
            path: '/api/twin/task',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`✅ [Roadmap] Enqueued task -> Action: ${task.action} | Response: ${body}`);
                resolve();
            });
        });
        req.on('error', (err) => {
            console.error(`❌ [Roadmap Error] Failed to enqueue ${task.action}:`, err.message);
            reject(err);
        });
        req.write(data);
        req.end();
    });
}

async function runRoadmap() {
    console.log("🚀 [Primordia Roadmap] Deploying multi-step build sequence into queue...");
    for (const task of roadmapTasks) {
        await enqueueTask(task);
        await new Promise(r => setTimeout(r, 500)); // Stagger enqueues slightly
    }
    console.log("✨ [Primordia Roadmap] All roadmap tasks successfully sequenced!");
}

runRoadmap();
