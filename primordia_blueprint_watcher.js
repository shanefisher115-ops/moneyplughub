const fs = require('fs');
const path = require('path');
const http = require('http');

const ROADMAPS_DIR = path.join(__dirname, 'roadmaps');
const PROCESSED_DIR = path.join(ROADMAPS_DIR, 'processed');

// Ensure processed directory exists
if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

console.log(`👀 [Blueprint Watcher] Monitoring folder for new blueprints: ${ROADMAPS_DIR}`);

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
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', (err) => reject(err));
        req.write(data);
        req.end();
    });
}

async function processBlueprintFile(filePath) {
    const filename = path.basename(filePath);
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const blueprint = JSON.parse(rawData);

        console.log(`\n🚀 [Watcher Detected] New Blueprint: "${blueprint.projectName}" (${filename})`);
        console.log(`📦 Enqueuing ${blueprint.steps.length} build steps...`);

        for (const step of blueprint.steps) {
            const res = await enqueueTask(step);
            console.log(`✅ [Enqueued] ${step.action} -> Task ID: ${res.task.id}`);
            await new Promise(r => setTimeout(r, 400));
        }

        console.log(`✨ [Watcher] Blueprint "${blueprint.projectName}" successfully deployed!\n`);

        // Move processed blueprint to 'processed' subfolder to prevent re-processing
        const targetPath = path.join(PROCESSED_DIR, filename);
        fs.renameSync(filePath, targetPath);
        console.log(`📁 Moved processed blueprint to: roadmaps/processed/${filename}`);

    } catch (error) {
        console.error(`❌ [Watcher Error] Failed to process ${filename}:`, error.message);
    }
}

// Watch the roadmaps directory for new files
fs.watch(ROADMAPS_DIR, (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
        const filePath = path.join(ROADMAPS_DIR, filename);
        // Check if file still exists (prevents double triggers on delete/rename)
        if (fs.existsSync(filePath) && eventType === 'rename') {
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    processBlueprintFile(filePath);
                }
            }, 500);
        }
    }
});
