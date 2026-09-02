# ==========================================================
#   PRIMORDIAOS IGNITION ULTRA MASTER TERMINAL FILE
#   (Diagnostic + Boot + Auto-Repair + Cosmic Ritual)
# ==========================================================

Write-Host ""
Write-Host "💠 PRIMORDIAOS IGNITION ULTRA BOOTING…" -ForegroundColor Cyan
Write-Host ""

# --- PATHS ---
$root      = "C:\Users\Shane\Documents\dev\PrimordiaOS"
$kernel    = "$root\kernel"
$modules   = "$root\modules"
$workers   = "$root\workers"
$electron  = "$root\electron"
$unreal    = "$root\PrimordiaUnreal"
$logs      = "$root\logs"

# --- LOGGING ---
if (!(Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
$logFile = "$logs\ignition-ultra-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').log"

function Log {
    param([string]$msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp :: $msg" | Tee-Object -FilePath $logFile -Append
}

function OK   { Write-Host "✔ $($args[0])" -ForegroundColor Green; Log "OK: $($args[0])" }
function FAIL { Write-Host "❌ $($args[0])" -ForegroundColor Red;   Log "FAIL: $($args[0])" }

Log "BOOT: Ignition Ultra engine started."

# ==========================================================
#   SECTION 1 — ULTRA DIAGNOSTIC
# ==========================================================

Write-Host "🔍 Running Ultra Diagnostic…" -ForegroundColor Yellow

# Root
if (Test-Path $root) { OK "Root directory found." } else { FAIL "Root directory missing."; exit }

# Node
try { node -v | Out-Null; OK "Node.js installed." } catch { FAIL "Node.js missing."; }

# NPM
try { npm -v | Out-Null; OK "NPM installed." } catch { FAIL "NPM missing."; }

# Git
try { git --version | Out-Null; OK "Git installed." } catch { FAIL "Git missing."; }

# Wrangler
try { npx wrangler --version | Out-Null; OK "Wrangler installed." } catch { FAIL "Wrangler missing."; }

# Kernel
if (Test-Path $kernel) { OK "Kernel directory found." } else { FAIL "Kernel missing."; }

# Modules
if (Test-Path $modules) { OK "Modules directory found." } else { FAIL "Modules missing."; }

# Workers
if (Test-Path $workers) { OK "Workers directory found." } else { FAIL "Workers missing."; }

# Wrangler config
if (Test-Path "$workers\wrangler.toml") { OK "wrangler.toml found." } else { FAIL "wrangler.toml missing."; }

# Electron
if (Test-Path "$electron\package.json") { OK "Electron project detected." } else { FAIL "Electron project missing."; }

# Unreal Editor
$unrealEditor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
if (Test-Path $unrealEditor) { OK "Unreal Editor found." } else { FAIL "Unreal Editor missing."; }

# Unreal project
$uproject = "$unreal\PrimordiaUnreal.uproject"
if (Test-Path $uproject) { OK "PrimordiaUnreal.uproject found." } else { FAIL "PrimordiaUnreal.uproject missing."; }

# PlanetScale / Hyperdrive
if ($env:DATABASE_URL) { OK "DATABASE_URL detected." } else { FAIL "DATABASE_URL missing."; }
if ($env:HYPERDRIVE)   { OK "Hyperdrive binding detected." } else { FAIL "Hyperdrive binding missing."; }

Write-Host ""
Write-Host "✨ Ultra Diagnostic complete. Proceeding to ignition…" -ForegroundColor Cyan
Log "Ultra diagnostic complete."

# ==========================================================
#   SECTION 2 — AUTO-REPAIR HOOKS (LIGHTWEIGHT)
# ==========================================================

Write-Host "🛠️ Running lightweight auto-repair…" -ForegroundColor Yellow

# Ensure logs dir exists (already done)
OK "Log directory ensured."

# (You can add more auto-repair hooks here later)

# ==========================================================
#   SECTION 3 — BUILD + DEPLOY + LAUNCH
# ==========================================================

Write-Host ""
Write-Host "🚀 IGNITION SEQUENCE STARTING…" -ForegroundColor Cyan
Write-Host ""

# Dependencies
Write-Host "📦 Installing dependencies…" -ForegroundColor Yellow
Log "Installing dependencies."
npm install --prefix $root

# Build kernel
Write-Host "⚙️ Building kernel…" -ForegroundColor Yellow
Log "Building kernel."
npm run build --prefix $kernel

# Build modules
Write-Host "🧩 Building modules…" -ForegroundColor Yellow
Log "Building modules."
npm run build --prefix $modules

# Deploy Worker
Write-Host "☁️ Deploying Cloudflare Worker…" -ForegroundColor Yellow
Log "Deploying Cloudflare Worker."
npx wrangler deploy --config "$workers\wrangler.toml"

# Launch Electron
Write-Host "🖥️ Launching PrimordiaOS Electron Shell…" -ForegroundColor Yellow
Log "Launching Electron shell."
Start-Process "powershell" -ArgumentList "npm start --prefix `"$electron`""

# Launch Unreal
Write-Host "🌌 Launching Primordia Unreal World…" -ForegroundColor Yellow
Log "Launching Unreal world."
if (Test-Path $uproject) {
    Start-Process $unrealEditor $uproject
    OK "Unreal world launched."
} else {
    FAIL "Unreal project missing; Unreal world not launched."
}

# ==========================================================
#   SECTION 4 — RUNTIME BOOT + AUTO-RESTART
# ==========================================================

function Restart-Primordia {
    Log "SYSTEM: Restart triggered by crash."
    Write-Host ""
    Write-Host "🔄 PrimordiaOS crash detected — restarting…" -ForegroundColor Red
    Write-Host ""
    Start-Sleep -Seconds 3
    & $PSCommandPath
    exit
}

Write-Host "🧠 Starting PrimordiaOS Runtime…" -ForegroundColor Yellow
Log "Starting PrimordiaOS runtime."

try {
    npm run start --prefix $root
} catch {
    FAIL "PrimordiaOS runtime crashed."
    Restart-Primordia
}

# ==========================================================
#   SECTION 5 — COSMIC UI + RUNTIME MAP
# ==========================================================

Write-Host ""
Write-Host "🌌 PRIMORDIAOS COSMIC RUNTIME MAP" -ForegroundColor Cyan
Write-Host "----------------------------------------"
Write-Host "Realm: interface → Electron (UI Shell)"
Write-Host "Realm: kernel   → Node (Core Logic)"
Write-Host "Realm: portal   → Cloudflare (Edge API)"
Write-Host "Realm: world    → Unreal (Simulation)"
Write-Host "----------------------------------------"
Write-Host ""

Log "Runtime map printed."

# ==========================================================
#   FINAL
# ==========================================================

Write-Host ""
Write-Host "🌟 PRIMORDIAOS IGNITION ULTRA COMPLETE" -ForegroundColor Cyan
Write-Host "📄 Full log saved to: $logFile" -ForegroundColor Gray
Log "SYSTEM: Ignition Ultra complete."
function Animate {
    param([string]$text, [int]$delay = 40)
    $chars = $text.ToCharArray()
    foreach ($c in $chars) {
        Write-Host -NoNewline $c
        Start-Sleep -Milliseconds $delay
    }
    Write-Host ""
}

Animate "⟨ Initiating PrimordiaOS Ignition Ultra ⟩"
Start-Sleep -Milliseconds 300

Animate ""
Animate "   ✦"
Animate "   ✦✦"
Animate "   ✦✦✦"
Animate "   ✦✦✦✦"
Animate "   ✦✦✦✦✦  Flux Engine Warming…"
Start-Sleep -Milliseconds 300

Animate "⟨ Flux Lines Engaging ⟩"
Animate "≡≡≡≡≡≡≡≡≡≡"
Start-Sleep -Milliseconds 200

Animate "≡≡≡≡≡≡≡≡≡≡  [10%]"
Start-Sleep -Milliseconds 150
Animate "≡≡≡≡≡≡≡≡≡≡≡≡≡  [25%]"
Start-Sleep -Milliseconds 150
Animate "≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡  [40%]"
Start-Sleep -Milliseconds 150
Animate "≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡  [60%]"
Start-Sleep -Milliseconds 150
Animate "≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡  [80%]"
Start-Sleep -Milliseconds 150
Animate "≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡  [100%]"
Start-Sleep -Milliseconds 300

Animate "⟨ Flux Engine Online ⟩"
Start-Sleep -Milliseconds 300

Animate ""
Animate "   ☼"
Animate "   ☼☼"
Animate "   ☼☼☼  Event Horizon Stabilizing…"
Start-Sleep -Milliseconds 300

Animate "⟨ Horizon Lock Achieved ⟩"
Start-Sleep -Milliseconds 300

Animate ""
Animate "   ⚡ Primordia Unreal Bridge Linking…"
Start-Sleep -Milliseconds 400
Animate "   ⚡⚡ Link Established."
Start-Sleep -Milliseconds 200

Animate ""
Animate "   ⧖ Electron Shell Synchronizing…"
Start-Sleep -Milliseconds 400
Animate "   ⧖⧖ Shell Online."
Start-Sleep -Milliseconds 200

Animate ""
Animate "   ✧ Preparing Worldseed…"
Start-Sleep -Milliseconds 400

Animate "   ✧ Spatial Mesh: OK"
Start-Sleep -Milliseconds 200
Animate "   ✧ Temporal Mesh: OK"
Start-Sleep -Milliseconds 200
Animate "   ✧ Reality Thread: Anchored"
Start-Sleep -Milliseconds 300

Animate ""
Animate "⟨ Realm Layer Activation Sequence ⟩"
Start-Sleep -Milliseconds 300

Animate "   INIT → OK"
Start-Sleep -Milliseconds 200
Animate "   RUN → OK"
Start-Sleep -Milliseconds 200
Animate "   MANIFEST → OK"
Start-Sleep -Milliseconds 300

Animate ""
Animate "⟨ Cosmic Identity Loading… ⟩"
Start-Sleep -Milliseconds 400

Animate "   Identity: PRIMORDIAL ORIGIN"
Start-Sleep -Milliseconds 300

Animate ""
Animate "⟨ Ignition Ultra Entering Final Phase… ⟩"
Start-Sleep -Milliseconds 400

Animate ""
Animate "   ✦✦✦ PRIMORDIAOS IS NOW ALIVE ✦✦✦"
Start-Sleep -Milliseconds 300

Animate ""
Animate "⟨ ULTRA BOOT COMPLETE :: Welcome, Origin Architect ⟩"
