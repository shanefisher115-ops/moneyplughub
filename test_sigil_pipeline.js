const http = require('http');
const sigilEngine = require('./sigil_engine');
const attachSigilMiddleware = require('./sigil_middleware');

console.log('🔮 [Sigil Test] Starting Cryptographic Referral Sigil Integration Test...\n');

// 1. Generate & Test Sigil Generation Directly
const userHandle = 'AnnMarie_Shane_Core';
const sigil = sigilEngine.generateSigil(userHandle);
console.log(`🔑 Generated Sigil for [${userHandle}]: ${sigil}`);

// 2. Mock a Task Payload and Run Through Middleware
let rawTaskPayload = {
    user: userHandle,
    action: 'WRITE_FILE',
    payload: {
        filename: 'sigil_verification_test.js',
        content: `// Verification test signed by ${sigil}\nconsole.log('Sigil verification executed successfully');`
    }
};

console.log('\n⚙️ Executing Sigil Middleware Injection...');
attachSigilMiddleware({ body: rawTaskPayload }, {}, () => {});

console.log('\n📄 Transformed Task Payload with Injected Sigil Metadata:');
console.log(JSON.stringify(rawTaskPayload, null, 2));

// 3. Dispatch the Signed Task directly to the PrimordiaOS API Queue (Port 3005)
async function dispatchToQueue(task) {
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
                try {
                    resolve(JSON.parse(body));
                } catch(e) {
                    resolve({ raw: body });
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.write(data);
        req.end();
    });
}

(async () => {
    try {
        console.log('\n🚀 Dispatching cryptographically signed task to PrimordiaOS API Queue on port 3005...');
        const response = await dispatchToQueue(rawTaskPayload);
        console.log('✅ API Queue Response:', response);
        console.log('\n✨ Sigil integration test completed successfully!');
    } catch (err) {
        console.error('❌ Failed to connect to API Server. Ensure API Server is running on port 3005:', err.message);
    }
})();
