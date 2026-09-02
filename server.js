import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: "OK" }));
  }

  const cleanUrl = req.url.split('?')[0].replace(/\/$/, '') || '/';

  // Handle all /api/* requests with 200 JSON
  if (cleanUrl.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });

    if (cleanUrl.includes('peersignal')) {
      return res.end(JSON.stringify({ success: true, emitted: true, peerId: "peer_admin" }));
    }
    if (cleanUrl.includes('track-action')) {
      return res.end(JSON.stringify({ success: true, logged: true, xpEarned: 250 }));
    }
    if (cleanUrl.includes('rag/search')) {
      return res.end(JSON.stringify({ success: true, results: [] }));
    }
    if (cleanUrl.includes('unreal/camera')) {
      return res.end(JSON.stringify({ success: true, camera: { x: 0, y: 0, z: 1 } }));
    }
    if (cleanUrl.includes('boardroom')) {
      return res.end(JSON.stringify({ success: true, messages: [] }));
    }

    return res.end(JSON.stringify({ success: true, status: "OK", endpoint: cleanUrl }));
  }

  // Serve Frontend HTML
  let filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error: ${err.message}`);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌌 Daemon active on http://localhost:${PORT}`);
});
