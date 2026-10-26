const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'primordia_digital_twin_state.json');
const QUEUE_FILE = path.join(__dirname, 'primordia_queue.json');

class PrimordiaDigitalTwinEngine {
    constructor() {
        this.initializeFiles();
    }

    initializeFiles() {
        if (!fs.existsSync(STATE_FILE)) {
            const defaultState = {
                version: "1.0.0",
                timestamp: new Date().toISOString(),
                apex_index: 50.0,
                sigil: "SIGIL-PRIMORDIA-CORE",
                system_status: "INITIALIZED",
                active_nodes: 0
            };
            fs.writeFileSync(STATE_FILE, JSON.stringify(defaultState, null, 2));
        }

        if (!fs.existsSync(QUEUE_FILE)) {
            fs.writeFileSync(QUEUE_FILE, JSON.stringify([], null, 2));
        }
    }

    getState() {
        try {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error("❌ Error reading digital twin state:", error);
            return null;
        }
    }

    updateState(telemetryPayload) {
        const currentState = this.getState() || {};
        const updatedState = {
            ...currentState,
            ...telemetryPayload,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(updatedState, null, 2));
        console.log(`🔮 [Digital Twin] State updated -> Apex Index: ${updatedState.apex_index} | Sigil: ${updatedState.sigil}`);
        return updatedState;
    }

    enqueueTask(action, payload) {
        try {
            let rawData = fs.readFileSync(QUEUE_FILE, 'utf8');
            let queue = [];
            try {
                queue = JSON.parse(rawData);
            } catch (e) {
                queue = [];
            }

            // Ensure queue is always an array
            if (!Array.isArray(queue)) {
                queue = queue ? [queue] : [];
            }

            const newTask = {
                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                action: action,
                payload: payload,
                timestamp: new Date().toISOString()
            };

            queue.push(newTask);
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
            console.log(`✨ [Queue] Task enqueued -> [${action}] ID: ${newTask.id}`);
            return newTask;
        } catch (error) {
            console.error("❌ Error enqueuing task:", error);
            return null;
        }
    }
}

module.exports = PrimordiaDigitalTwinEngine;
