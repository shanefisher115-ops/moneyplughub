const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Helper to safely read metrics ledgers
const readMetrics = (filename) => {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            return null;
        }
    }
    return null;
};

// Main Dashboard View
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>PrimordiaOS Telemetry Bridge</title>
        <style>
            body { font-family: monospace; background: #0d0f12; color: #00ffcc; padding: 2rem; margin: 0; }
            h1 { color: #fff; border-bottom: 1px solid #00ffcc; padding-bottom: 0.5rem; }
            .card { background: #161920; border: 1px solid #222a35; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
            a { color: #00ffcc; text-decoration: none; font-weight: bold; }
            a:hover { text-decoration: underline; }
            .status { color: #00ffaa; }
        </style>
    </head>
    <body>
        <h1>✨ PrimordiaOS Telemetry Bridge</h1>
        <p>System Status: <span class="status">ONLINE</span></p>
        
        <div class="card">
            <h3>Available Telemetry Endpoints</h3>
            <ul>
                <li><a href="/api/pure-arena" target="_blank">GET /api/pure-arena</a> — Pure Skill Combat Arena</li>
                <li><a href="/api/health" target="_blank">GET /api/health</a> — System Health Check</li>
                <li><strong>POST /api/evaluate-task</strong> — Evolutionary Decision Gating</li>
            </ul>
        </div>
    </body>
    </html>
    `);
});

// Telemetry GET Endpoints
app.get('/api/pure-arena', (req, res) => {
    const data = readMetrics('pure_arena_metrics.json');
    if (!data) return res.status(404).json({ error: 'pure_arena_metrics.json not found' });
    res.json(data);
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        system: 'PrimordiaOS Telemetry Bridge', 
        timestamp: new Date().toISOString() 
    });
});

// Core Decision Gating POST Endpoint for External Clients
app.post('/api/evaluate-task', (req, res) => {
    const { taskName, taskComplexity } = req.body;
    
    if (!taskName || taskComplexity === undefined) {
        return res.status(400).json({ error: 'Missing required fields: taskName, taskComplexity' });
    }

    const data = readMetrics('pure_arena_metrics.json');
    let apexThreshold = 1.0;
    
    if (data && data.length > 0) {
        apexThreshold = data[data.length - 1].forager_avg_evasion || 1.0;
    }

    const adaptationRequired = parseFloat((taskComplexity * 0.75).toFixed(2));
    const isApproved = adaptationRequired <= apexThreshold;

    const decision = {
        task: taskName,
        complexity: taskComplexity,
        required_adaptation: adaptationRequired,
        current_apex_threshold: apexThreshold,
        status: isApproved ? 'APPROVED_AUTONOMOUS_EXECUTION' : 'REJECTED_REQUIRES_MUTATION',
        timestamp: new Date().toISOString()
    };

    res.json(decision);
});

app.listen(PORT, () => {
    console.log(`✨ [PrimordiaOS Telemetry Bridge] Active on http://localhost:${PORT}`);
});