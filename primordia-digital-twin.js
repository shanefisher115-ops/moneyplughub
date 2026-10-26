const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');
const LEDGER_FILE = path.join(__dirname, 'primordia_ledger.log');
const REGISTRY_FILE = path.join(__dirname, 'primordia_spellwright_registry.json');
const TWIN_STATE_FILE = path.join(__dirname, 'primordia_digital_twin_state.json');

function generateDigitalTwinState() {
    let queue = fs.existsSync(QUEUE_FILE) ? JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')) : [];
    let registry = fs.existsSync(REGISTRY_FILE) ? JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')) : [];
    
    let ledgerLines = [];
    if (fs.existsSync(LEDGER_FILE)) {
        const rawLog = fs.readFileSync(LEDGER_FILE, 'utf8');
        ledgerLines = rawLog.trim().split('\n').slice(-10); // Get last 10 audit logs
    }

    // Calculate live system telemetry
    const twinState = {
        timestamp: new Date().toISOString(),
        system_status: "ONLINE",
        apex_index: 23.53,
        active_threshold: 17.65,
        metrics: {
            total_sigils_scribed: registry.length,
            pending_compute_tasks: queue.length,
            economic_gateway: "MoneyPlugHub Active",
            motherboard_workspace: "C:\\Users\\Shane\\moneyplughub"
        },
        nodes: registry.map((s, idx) => ({
            id: s.hash,
            name: s.sigil,
            domain: s.domain,
            biome: s.biome,
            lighting: s.lighting,
            density: s.density,
            referral: s.referralUrl,
            status: idx < queue.length ? "QUEUED" : "SYNCHRONIZED"
        })),
        recent_telemetry: ledgerLines
    };

    fs.writeFileSync(TWIN_STATE_FILE, JSON.stringify(twinState, null, 2));
    console.log(`🌐 [Digital Twin] Telemetry synchronized. State exported to ${TWIN_STATE_FILE}`);
}

// Run initial sync
generateDigitalTwinState();

// Optional: Watch for changes and auto-update digital twin state
fs.watch(QUEUE_FILE, (eventType) => {
    if (eventType === 'change') {
        generateDigitalTwinState();
    }
});