const fs = require('fs');
const path = require('path');
const http = require('http');

const WORK_DIRS = [
    __dirname,
    path.join(__dirname, 'roadmaps')
];

// Track files we've already dispatched repairs for to prevent spam loops
const patchedCache = new Set();

console.log('🔮 [Harmonizer Daemon] Initializing System Coherence & File Repair Engine...');

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

function scanWorkspace(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('processed')) {
                results = results.concat(scanWorkspace(filePath));
            }
        } else if (file.endsWith('.js')) {
            results.push(filePath);
        }
    });
    return results;
}

async function analyzeAndHarmonize() {
    console.log('🔍 [Harmonizer Daemon] Scanning workspace for broken dependencies...');
    
    const files = scanWorkspace(__dirname);
    const requireRegex = /require\(['"]\.\/(.*?)['"]\)/g;
    
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        
        while ((match = requireRegex.exec(content)) !== null) {
            let requiredModule = match[1];
            if (!requiredModule.endsWith('.js')) requiredModule += '.js';
            
            const expectedPath = path.join(path.dirname(file), requiredModule);
            
            if (!fs.existsSync(expectedPath) && !patchedCache.has(expectedPath)) {
                console.log(`⚠️ [Harmonizer] Broken dependency detected in ${path.basename(file)} -> Missing: ${requiredModule}`);
                console.log(`🛠️ [Harmonizer] Auto-generating stub module patch for ${requiredModule}...`);
                
                patchedCache.add(expectedPath); // Mark as handled to prevent duplicate loops
                
                const stubContent = `// Auto-generated Harmonizer Stub for ${requiredModule}\nmodule.exports = {\n    _status: 'AUTO_REPAIRED_STUB',\n    timestamp: '${new Date().toISOString()}'\n};\nconsole.log('🔮 [Harmonizer] Auto-repaired module online: ${requiredModule}');\n`;
                
                const patchTask = {
                    action: 'WRITE_FILE',
                    payload: {
                        filename: path.basename(expectedPath),
                        content: stubContent
                    }
                };
                
                try {
                    const res = await enqueueTask(patchTask);
                    console.log(`✅ [Harmonizer Patch Enqueued] Task ID: ${res.task.id}`);
                } catch (err) {
                    console.error(`❌ [Harmonizer Error] Failed to dispatch patch:`, err.message);
                }
            }
        }
    }
}

analyzeAndHarmonize();
setInterval(analyzeAndHarmonize, 15000);
