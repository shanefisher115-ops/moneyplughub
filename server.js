const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const readHyperMetrics = () => {
    const filePath = path.join(__dirname, 'hyper_arena_metrics.json');
    if (fs.existsSync(filePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.length > 0) {
                return data[data.length - 1]; // Latest generation metrics
            }
        } catch (err) {
            return null;
        }
    }
    return null;
};

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>PrimordiaOS Hyper-Mesh Telemetry</title>
        <style>
            body { font-family: monospace; background: #0d0f12; color: #00ffcc; padding: 2rem; margin: 0; }
            h1 { color: #fff; border-bottom: 1px solid #00ffcc; padding-bottom: 0.5rem; }
            .card { background: #161920; border: 1px solid #222a35; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
            a { color: #00ffcc; text-decoration: none; font-weight: bold; }
            .status { color: #00ffaa; }
        </style>
    </head>
    <body>
        <h1>🌌 PrimordiaOS Hyper-Mesh Core</h1>
        <p>System Status: <span class="status">ONLINE (Triad Mesh Active)</span></p>
        
        <div class="card">
            <h3>Hyper-Mesh Telemetry Endpoints</h3>
            <ul>
                <li><a href="/api/hyper-mesh" target="_blank">GET /api/hyper-mesh</a> — Full Triad Ledger</li>
                <li><strong>POST /api/evaluate-task</strong> — Hyper-Threshold Decision Gating</li>
            </ul>
        </div>
    </body>
    </html>
    `);
});

app.get('/api/hyper-mesh', (req, res) => {
    const filePath = path.join(__dirname, 'hyper_arena_metrics.json');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'hyper_arena_metrics.json not found' });
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
});

app.post('/api/evaluate-task', (req, res) => {
    const { taskName, taskComplexity } = req.body;
    
    if (!taskName || taskComplexity === undefined) {
        return res.status(400).json({ error: 'Missing required fields: taskName, taskComplexity' });
    }

    const latestMetrics = readHyperMetrics();
    const apexThreshold = latestMetrics ? latestMetrics.apex_index : 1.0;

    const adaptationRequired = parseFloat((taskComplexity * 0.75).toFixed(2));
    const isApproved = adaptationRequired <= apexThreshold;

    res.json({
        task: taskName,
        complexity: taskComplexity,
        required_adaptation: adaptationRequired,
        current_hyper_apex_index: apexThreshold,
        triad_breakdown: latestMetrics ? {
            architect: latestMetrics.architect_potency,
            sentinel: latestMetrics.sentinel_potency,
            mutator: latestMetrics.mutator_potency
        } : null,
        status: isApproved ? 'APPROVED_HYPER_EXECUTION' : 'REJECTED_REQUIRES_HYPER_MUTATION',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🌌 [PrimordiaOS Hyper-Mesh Bridge] Active on http://localhost:${PORT}`);
});