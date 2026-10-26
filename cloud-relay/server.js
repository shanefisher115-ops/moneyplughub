const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Points to your public Cloudflare Tunnel endpoint connected to your local bridge
const BRIDGE_URL = process.env.BRIDGE_URL || 'https://omni.primordiaos.com/api/gcp/event';

app.use(express.json());

// Public endpoint that Google Cloud triggers will hit
app.post('/trigger-event', async (req, res) => {
    const { action, payload } = req.body;
    
    console.log(`☁️ [Cloud Run Relay] Forwarding action '${action || 'SYNC_DIGITAL_TWIN'}' to local PrimordiaOS bridge...`);

    try {
        const response = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: "Google Cloud Run Service",
                action: action || "SYNC_DIGITAL_TWIN",
                payload: payload || { status: "ACTIVE", apex_index: 30.0, sigil: "SIGIL-GCP-CLOUD" }
            })
        });

        const data = await response.json();
        res.status(200).json({ status: "RELAYED_SUCCESS", bridgeResponse: data });
    } catch (error) {
        console.error("❌ Failed to reach local bridge via tunnel:", error.message);
        res.status(500).json({ 
            status: "ERROR", 
            message: "Failed to connect to local PrimordiaOS bridge", 
            error: error.message 
        });
    }
});

app.get('/', (req, res) => {
    res.status(200).send("🔮 PrimordiaOS Cloud Relay Service is online.");
});

app.listen(PORT, () => {
    console.log(`🚀 Primordia Cloud Relay running on port ${PORT}`);
});