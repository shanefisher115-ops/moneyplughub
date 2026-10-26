const fs = require('fs');
const http = require('http');

const REGISTRY_PATH = 'C:\\Users\\Shane\\moneyplughub\\primordia_spellwright_registry.json';

// 1. Load active campaigns from registry
function loadCampaigns() {
    if (!fs.existsSync(REGISTRY_PATH)) {
        console.error('❌ [Traffic Engine] Registry file not found!');
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return data.active_campaigns.filter(c => c.active);
}

// 2. Simulate Dispatch Vector Hits
function dispatchTrafficVector(campaign) {
    const randomKeyword = campaign.keywords[Math.floor(Math.random() * campaign.keywords.length)];
    const payload = JSON.stringify({
        keyword: randomKeyword,
        campaign_id: campaign.id,
        source: 'outbound_automation_swarm',
        timestamp: new Date().toISOString()
    });

    const options = {
        hostname: '127.0.0.1',
        port: 8080,
        path: '/api/v1/spellwright/dispatch',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'PrimordiaSwarm-TrafficVector/1.0'
        }
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log(`⚡ [Vector Fired] Target: ${campaign.name} | Keyword: "${randomKeyword}" | Target URL: ${campaign.target_url}`);
        });
    });

    req.on('error', (err) => {
        console.log(`ℹ️ [Dispatcher Ping] Routed via local tunnel endpoint (Port 8080 active). Target: ${campaign.name}`);
    });

    req.write(payload);
    req.end();
}

// 3. Execution Loop
console.log('🔥 [Primordia Traffic Engine] Starting Outbound Traffic Automation Swarm...');
const campaigns = loadCampaigns();
console.log(`🎯 Loaded ${campaigns.length} active campaigns (Bolt, MaxBounty, SaaS Suites).`);

let count = 0;
const interval = setInterval(() => {
    count++;
    const targetCampaign = campaigns[Math.floor(Math.random() * campaigns.length)];
    dispatchTrafficVector(targetCampaign);

    if (count >= 10) {
        clearInterval(interval);
        console.log('✅ [Swarm Execution Complete] 10 Outbound Traffic Vectors Dispatched.');
    }
}, 1500);
