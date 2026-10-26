const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3006;

const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');
const TWIN_STATE_FILE = path.join(__dirname, 'primordia_digital_twin_state.json');

app.use(express.json());

app.post('/api/gcp/event', (req, res) => {
    const { source, action, payload } = req.body;
    console.log(`\n☁️ [GCP Bridge] Received event from ${source || 'Google Cloud'}:`);
    console.log(`🔹 Action: ${action}`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

    let queue = [];
    if (fs.existsSync(QUEUE_FILE)) {
        try {
            queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        } catch (e) { queue = []; }
    }

    const newTask = {
        id: "gcp_" + Date.now(),
        action: action,
        payload: payload,
        timestamp: new Date().toISOString()
    };
    queue.push(newTask);
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    console.log(`📥 [Queue] Cloud task appended to ${QUEUE_FILE}`);

    if (fs.existsSync(TWIN_STATE_FILE)) {
        try {
            let twinState = JSON.parse(fs.readFileSync(TWIN_STATE_FILE, 'utf8'));
            twinState.apex_index = payload.apex_index || twinState.apex_index;
            twinState.last_cloud_sync = new Date().toISOString();
            fs.writeFileSync(TWIN_STATE_FILE, JSON.stringify(twinState, null, 2));
            console.log(`🌐 [Digital Twin] State synchronized with cloud telemetry.`);
        } catch (e) {
            console.error(`⚠️ Failed to update digital twin state:`, e.message);
        }
    }

    res.status(200).json({
        status: "SUCCESS",
        taskId: newTask.id,
        message: "Payload processed and propagated to PrimordiaOS Digital Twin."
    });
});

app.listen(PORT, () => {
    console.log(`\n🔮 [Primordia GCP Bridge] Listening live on port ${PORT}...`);
});