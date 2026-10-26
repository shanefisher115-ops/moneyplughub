const express = require('express');
const PrimordiaDigitalTwinEngine = require('./primordia_twin_engine');
const PrimordiaHabitTracker = require('./primordia_habit_tracker');

const app = express();
const PORT = process.env.PORT || 3000;

const twin = new PrimordiaDigitalTwinEngine();
const tracker = new PrimordiaHabitTracker();

app.use(express.json());

// Get current Digital Twin state
app.get('/api/twin/state', (req, res) => {
    const state = twin.getState();
    res.json({ success: true, state });
});

// Post state update / telemetry payload
app.post('/api/twin/state', (req, res) => {
    const updatedState = twin.updateState(req.body);
    res.json({ success: true, state: updatedState });
});

// Enqueue task
app.post('/api/twin/task', (req, res) => {
    const { action, payload } = req.body;
    if (!action) {
        return res.status(400).json({ success: false, error: "Action is required" });
    }
    const task = twin.enqueueTask(action, payload || {});
    res.json({ success: true, task });
});

// Log habit/interaction via HTTP
app.post('/api/twin/habit', (req, res) => {
    const { action, context } = req.body;
    if (!action) {
        return res.status(400).json({ success: false, error: "Action is required" });
    }
    tracker.logInteraction(action, context || {});
    res.json({ success: true, message: "Habit logged successfully" });
});

app.listen(PORT, () => {
    console.log(`🚀 [PrimordiaOS API] Digital Twin HTTP interface listening on port ${PORT}`);
});
