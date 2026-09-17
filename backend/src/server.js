const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const root = path.resolve(__dirname, '../../');
const refRoot = path.join(root, 'referral');
const engineFile = path.join(refRoot, 'engine', 'referral-engine.json');
const programsDir = path.join(refRoot, 'programs');
const eventsLog = path.join(refRoot, 'events.log');
const signalsLog = path.join(refRoot, 'signals.log');

function loadEngine() {
  return JSON.parse(fs.readFileSync(engineFile, 'utf8'));
}

let programsCache = { data: null, lastUpdated: 0 };
const CACHE_TTL_MS = 60000;

async function loadPrograms() {
  const now = Date.now();
  if (programsCache.data && (now - programsCache.lastUpdated < CACHE_TTL_MS)) {
    return programsCache.data;
  }

  const files = await fs.promises.readdir(programsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const programsPromises = jsonFiles.map(async f => {
    const data = await fs.promises.readFile(path.join(programsDir, f), 'utf8');
    return JSON.parse(data);
  });

  const programs = await Promise.all(programsPromises);
  programsCache = { data: programs, lastUpdated: now };
  return programs;
}

app.get('/referral/programs', async (req, res) => {
  try {
    const programs = await loadPrograms();
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
  fs.appendFileSync(eventsLog, JSON.stringify(event) + '\\n');
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
  fs.appendFileSync(signalsLog, JSON.stringify(event) + '\\n');
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
