import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Resolved from Antigravity environment (defaults to local data dir if run standalone)
const DATA_DIR = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'sentinel_state.json');

const API_ENDPOINT = process.env.MONEYPLUG_API_URL || 'https://moneyplughub.com/api/v1';
const API_KEY = process.env.MONEYPLUG_API_KEY || '';
const POLL_INTERVAL = parseInt(process.env.MONEYPLUG_POLL_INTERVAL_MS || '30000', 10);
const VELOCITY_ALERT_THRESHOLD = parseFloat(process.env.VELOCITY_ALERT_THRESHOLD || '0.005');

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastReferralCount: 0, lastVelocity: 0, lastCheck: 0 };
  }
}

async function saveState(state) {
  await ensureDir(DATA_DIR);
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// Dispatches an autonomous triage session into Antigravity via the injected agentapi binary
async function triggerAgent(prompt) {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const candidates = [
      process.platform === 'win32' ? 'agentapi.bat' : 'agentapi',
      'agentapi',
      path.join(home, '.gemini', 'antigravity-cli', 'bin', 'agentapi.bat'),
      path.join(home, '.gemini', 'antigravity', 'bin', 'agentapi.bat')
    ];
    let cmd = process.platform === 'win32' ? 'agentapi.bat' : 'agentapi';
    for (const c of candidates) {
      if (existsSync(c)) {
        cmd = c;
        break;
      }
    }
    const { stdout } = await execFileAsync(cmd, ['new-conversation', prompt], { shell: true });
    console.log(`[Sentinel] Dispatched agentapi conversation: ${stdout.trim()}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`[Sentinel Standalone] agentapi binary not in PATH (Antigravity injects this during daemon runtime).`);
    } else {
      console.error(`[Sentinel] agentapi trigger failed: ${err.message}`);
    }
  }
}

async function fetchMetrics() {
  if (!API_KEY) {
    // Pipeline test metrics
    return {
      activeReferrals: 15,
      velocitySec: 0.0072,
      projectedArr: 2450.00,
      timestamp: Date.now()
    };
  }
  const res = await fetch(`${API_ENDPOINT}/telemetry`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return await res.json();
}

async function generateMilestoneMontage(metrics) {
  try {
    const candidates = [
      process.env.MONEYPLUG_PROJECT_DIR,
      'C:/Users/Shane/Documents/dev/PrimordiaOS/.gemini/antigravity/scratch/moneyplughub',
      'C:/Users/shane/Documents/dev/primordiaos/moneyplughub',
      process.cwd()
    ].filter(Boolean);

    let projectDir = null;
    for (const c of candidates) {
      if (existsSync(path.join(c, 'scripts', 'moneyos_agent.py'))) {
        projectDir = c;
        break;
      }
    }

    if (!projectDir) {
      console.warn('[Sentinel] moneyos_agent.py not found in search paths.');
      return null;
    }

    const scriptPath = path.join(projectDir, 'scripts', 'moneyos_agent.py');
    console.log(`[Sentinel] Spawning Autonomous Milestone Montage Render: ${scriptPath}`);

    const args = [
      scriptPath,
      'surge-render',
      '--velocity', String(metrics.velocitySec),
      '--arr', String(metrics.projectedArr),
      '--refs', String(metrics.activeReferrals),
      '--slug', 'mypoints'
    ];

    const { stdout } = await execFileAsync('python', args, {
      cwd: projectDir,
      shell: true,
      maxBuffer: 10 * 1024 * 1024
    });

    const jsonMatch = stdout.match(/\{[\s\S]*"output_file"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[Sentinel] Milestone Montage Video Mastered: ${parsed.output_file}`);
      return parsed.output_file;
    }
    return null;
  } catch (err) {
    console.error(`[Sentinel] Autonomous Milestone Video Render failed: ${err.message}`);
    return null;
  }
}

async function tick() {
  try {
    const state = await loadState();
    const metrics = await fetchMetrics();

    const referralDelta = metrics.activeReferrals - state.lastReferralCount;
    const velocityDelta = metrics.velocitySec - state.lastVelocity;

    console.log(`[Pulse] Velocity: +${metrics.velocitySec}¢/s | ARR: $${metrics.projectedArr} | Refs: ${metrics.activeReferrals}`);

    const isSurge = process.argv.includes('--force-surge') || (metrics.velocitySec >= VELOCITY_ALERT_THRESHOLD && velocityDelta > 0.001);
    if (isSurge) {
      console.log('[Sentinel] Surge detected! Rendering autonomous milestone video deliverable...');
      const videoPath = await generateMilestoneMontage(metrics);
      const videoUri = videoPath ? `file:///${videoPath.replace(/\\/g, '/')}` : '';
      const videoMsg = videoUri ? `\n🎥 Autonomous Milestone Video Master: ${videoUri}` : '';

      await triggerAgent(`[MoneyPlugHub Sentinel Alert] Surge detected! Velocity spiked to +${metrics.velocitySec}¢/sec (delta: +${velocityDelta.toFixed(4)}). Projected ARR: $${metrics.projectedArr}. Active Referrals: ${metrics.activeReferrals}.${videoMsg}\nTriage acquisition sources and distribute campaign asset.`);
      if (videoPath) {
        state.lastSurgeVideo = videoPath;
      }
    } else if (referralDelta > 0 && state.lastCheck > 0) {
      await triggerAgent(`[MoneyPlugHub Conversion] ${referralDelta} new conversion(s) locked. Current total: ${metrics.activeReferrals}. Update ledger records.`);
    }

    state.lastReferralCount = metrics.activeReferrals;
    state.lastVelocity = metrics.velocitySec;
    state.lastCheck = Date.now();
    await saveState(state);
  } catch (err) {
    console.error(`[Sentinel Error] ${err.message}`);
  }
}

console.log('[Sentinel] MoneyPlugHub sidecar active.');
await tick();
if (!process.argv.includes('--once')) {
  setInterval(tick, POLL_INTERVAL);
}
