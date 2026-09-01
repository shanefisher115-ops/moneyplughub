import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

let sseClients = [];

export function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.res.write(payload); } catch(e) {}
  });
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: "OK" }));
  }

  // Normalize URL (strip query strings and trailing slashes)
  const cleanUrl = req.url.split('?')[0].replace(/\/$/, '') || '/';

  // 1. Real-Time SSE Stream
  if (cleanUrl === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "ONLINE", message: "PrimordiaOS Daemon Connected" })}\n\n`);

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c.id !== clientId);
    });
    return;
  }

  // 2. Multi-Agent 8-Step Autopilot Sweep API
  if (cleanUrl === '/api/sweep' && req.method === 'POST') {
    broadcastSSE('sweep_start', { step: 1, name: "Plaid Bank Feeds", status: "RUNNING" });
    
    setTimeout(() => {
      broadcastSSE('sweep_step', { step: 4, name: "50/20/20/10 Cash Splitter", status: "COMPLETED" });
    }, 600);

    setTimeout(() => {
      broadcastSSE('sweep_complete', { 
        timestamp: new Date().toISOString(),
        netWorth: 94200.00,
        unencumberedVault: 42850.00,
        anomalies: 0
      });
    }, 1200);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      status: "SUCCESS", 
      message: "8-Step Sweep Triggered Successfully",
      timestamp: new Date().toISOString()
    }));
  }

  // 3. Webhook Sentinel API
  if (cleanUrl === '/api/webhook' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch(e) {}
      broadcastSSE('alert', { type: "SENTINEL_DISPATCH", payload: parsed });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: "DISPATCHED", data: parsed }));
    });
    return;
  }

  // 4. Fallback for unhandled /api/ routes
  if (cleanUrl.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: "Endpoint not found", url: cleanUrl }));
  }

  // 5. Serve HTML Frontend
  let filePath = path.join(__dirname, 'preview.html');
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error loading preview.html: ${err.message}`);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🌌 PrimordiaOS Backend Daemon Active on http://localhost:${PORT}`);
  console.log(`📡 SSE Stream: http://localhost:${PORT}/api/stream\n`);
});
