const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3006;

app.get('/', (req, res) => {
    let twinState = {};
    const statePath = path.join(__dirname, 'primordia_digital_twin_state.json');
    if (fs.existsSync(statePath)) {
        twinState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>PrimordiaOS Telemetry Dashboard</title>
        <style>
            body { background: #0d0f12; color: #00ffcc; font-family: monospace; padding: 20px; }
            h1 { color: #fff; text-shadow: 0 0 10px #00ffcc; }
            .card { background: #161b22; border: 1px solid #30363d; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
            pre { color: #a5d6ff; }
        </style>
    </head>
    <body>
        <h1>🔮 PrimordiaOS Telemetry Cockpit</h1>
        <div class="card">
            <h3>Digital Twin Metrics</h3>
            <pre>${JSON.stringify(twinState, null, 2)}</pre>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`🚀 [Primordia Dashboard] Live at http://localhost:${PORT}`);
});
