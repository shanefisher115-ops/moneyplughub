const express = require('express');
const fs = require('fs');
const path = require('path');
const sigilEngine = require('./sigil_engine');
const sigilKernelGuard = require('./sigil_kernel_guard');
const agentXPEngine = require('./agent_xp_engine');

const app = express();
const PORT = 3010;
const STATE_FILE = path.join(__dirname, 'primordia_digital_twin_state.json');

app.use(express.json());

function readState() {
    if (!fs.existsSync(STATE_FILE)) {
        return { pendingTasks: [], completedTasks: [] };
    }
    try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const data = JSON.parse(raw);
        return {
            pendingTasks: Array.isArray(data.pendingTasks) ? data.pendingTasks : [],
            completedTasks: Array.isArray(data.completedTasks) ? data.completedTasks : []
        };
    } catch (e) {
        return { pendingTasks: [], completedTasks: [] };
    }
}

function writeState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Automatic Sigil Signing Middleware
app.use((req, res, next) => {
    if (req.body && req.body.user && !req.body.metadata?.referralSigil) {
        req.body = sigilEngine.injectReferralPayload(req.body, req.body.user);
    }
    next();
});

// Kernel Status Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'HEALTHY', system: 'PrimordiaOS Kernel', port: PORT, timestamp: new Date().toISOString() });
});

// Query Agent XP & Stats by Sigil (Placed early to ensure routing)
app.get('/api/twin/agent/:sigil', (req, res) => {
    const sigilStats = agentXPEngine.getAgentStats(req.params.sigil);
    res.json({ success: true, sigil: req.params.sigil, stats: sigilStats });
});

// Enqueue Task (Protected by Sigil Kernel Guard)
app.post('/api/twin/task', (req, res) => {
    const validation = sigilKernelGuard.validateTask(req.body);
    
    if (!validation.valid) {
        console.warn(`🚨 [Kernel Guard] Task blocked: ${validation.reason}`);
        return res.status(403).json({
            success: false,
            error: 'Access Denied by PrimordiaOS Kernel Guard',
            reason: validation.reason
        });
    }

    const state = readState();
    const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...req.body,
        verifiedSigil: validation.sigil,
        timestamp: new Date().toISOString()
    };

    state.pendingTasks.push(task);
    writeState(state);

    console.log(`🛡️ [Kernel Guard Approved] Task ${task.id} queued for ${validation.user} [${validation.sigil}]`);
    res.json({ success: true, task });
});

// Fetch Next Task for Worker
app.get('/api/twin/next-task', (req, res) => {
    const state = readState();
    if (state.pendingTasks.length === 0) {
        return res.json({ task: null });
    }
    const task = state.pendingTasks.shift();
    writeState(state);
    res.json({ task });
});

// Complete Task Logging & Award Agent XP
app.post('/api/twin/complete-task', (req, res) => {
    const { taskId, result, verifiedSigil, action } = req.body;
    const state = readState();
    
    state.completedTasks.push({ taskId, result, completedAt: new Date().toISOString() });
    writeState(state);

    let xpData = null;
    if (verifiedSigil) {
        xpData = agentXPEngine.awardXP(verifiedSigil, action || 'WRITE_FILE');
    }

    console.log(`✅ [Task Completed] ID: ${taskId}`);
    res.json({ success: true, xpUpdate: xpData });
});

app.listen(PORT, () => {
    console.log(`🚀 [PrimordiaOS Kernel API] Secured on http://localhost:${PORT}`);
});
