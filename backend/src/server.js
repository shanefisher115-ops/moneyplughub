const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const root = path.join(__dirname, '../../');
const refRoot = path.join(root, 'referral');
const engineFile = path.join(refRoot, 'engine', 'referral-engine.json');
const programsDir = path.join(refRoot, 'programs');
const eventsLog = path.join(refRoot, 'events.log');
const signalsLog = path.join(refRoot, 'signals.log');

let cachedPrograms = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds cache duration

function loadEngine() {
  return JSON.parse(fs.readFileSync(engineFile, 'utf8'));
}

function loadPrograms() {
  const now = Date.now();
  if (cachedPrograms && (now - lastCacheTime < CACHE_TTL)) {
    return cachedPrograms;
  }

  const files = fs.readdirSync(programsDir).filter(f => f.endsWith('.json'));
  cachedPrograms = files.map(f => JSON.parse(fs.readFileSync(path.join(programsDir, f), 'utf8')));
  lastCacheTime = now;
  return cachedPrograms;
}

app.get('/referral/programs', (req, res) => {
  try {
    const programs = loadPrograms();
    res.json(programs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/referral/event', (req, res) => {
  const { programId, eventType, user } = req.body;
  const event = {
    timestamp: new Date().toISOString(),
    program: programId,
    event: eventType,
    user: user || 'unknown'
  };
  fs.appendFileSync(eventsLog, JSON.stringify(event) + '\n');
  res.json({ ok: true });
});

app.post('/referral/signal', (req, res) => {
  const { signal, programId, severity } = req.body;
  const event = {
    timestamp: new Date().toISOString(),
    signal,
    program: programId,
    severity: severity || 'info'
  };
  fs.appendFileSync(signalsLog, JSON.stringify(event) + '\n');
  res.json({ ok: true });
});

app.get('/referral/engine', (req, res) => {
  try {
    const engine = loadEngine();
    res.json(engine);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = 5050;
app.listen(port, () => {
  console.log('MoneyPlugHub backend running on port ' + port);
});
