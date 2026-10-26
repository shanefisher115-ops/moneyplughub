const fs = require('fs');
const path = require('path');
const http = require('http');

const ROADMAPS_DIR = path.join(__dirname, 'roadmaps');

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
                resolve(JSON.parse(body));
            });
        });
        req.on('error', (err) => reject(err));
        req.write(data);
        req.end();
    });
}

async function loadBlueprint(blueprintFilename) {
    const filePath = path.join(ROADMAPS_DIR, blueprintFilename);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ [Blueprint Loader] File not found: ${filePath}`);
        return;
    }

    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const blueprint = JSON.parse(rawData);

        console.log(`\n🔮 [Blueprint Loader] Ingesting Project Blueprint: "${blueprint.projectName}" (v${blueprint.version})`);
        console.log(`📦 Blueprint contains ${blueprint.steps.length} build steps. Enqueuing...\n`);

        for (const step of blueprint.steps) {
            const res = await enqueueTask(step);
            console.log(`✅ [Enqueued] ${step.action} -> Task ID: ${res.task.id}`);
            await new Promise(r => setTimeout(r, 400));
        }

        console.log(`\n✨ [Blueprint Loader] Blueprint "${blueprint.projectName}" successfully deployed to queue!\n`);

    } catch (error) {
        console.error(`❌ [Blueprint Loader Error] Failed to ingest blueprint:`, error.message);
    }
}

// Target specified file or default to sample
const targetBlueprint = process.argv[2] || 'money_plug_analytics.json';
loadBlueprint(targetBlueprint);
