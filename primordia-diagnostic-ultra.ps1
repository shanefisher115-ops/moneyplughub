# ==========================================================
#   PRIMORDIAOS ULTRA DIAGNOSTIC MASTER TERMINAL FILE
# ==========================================================

Write-Host ""
Write-Host "🔮 PRIMORDIAOS ULTRA DIAGNOSTIC ENGINE BOOTING…" -ForegroundColor Cyan
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
$logFile = "$logs\ultra-diagnostic-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').log"

function Log {
    param([string]$msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp :: $msg" | Tee-Object -FilePath $logFile -Append
}

function OK { Write-Host "✔ $($args[0])" -ForegroundColor Green; Log "OK: $($args[0])" }
function FAIL { Write-Host "❌ $($args[0])" -ForegroundColor Red; Log "FAIL: $($args[0])" }

Log "BOOT: Ultra diagnostic engine started."

# ==========================================================
#   SECTION 1 — CORE SYSTEM CHECKS
# ==========================================================

Write-Host "📁 Checking PrimordiaOS root…" -ForegroundColor Yellow
if (Test-Path $root) { OK "Root directory found." } else { FAIL "Root directory missing."; exit }

Write-Host "🟦 Checking Node.js…" -ForegroundColor Yellow
try { node -v | Out-Null; OK "Node.js installed." } catch { FAIL "Node.js missing." }

Write-Host "📦 Checking NPM…" -ForegroundColor Yellow
try { npm -v | Out-Null; OK "NPM installed." } catch { FAIL "NPM missing." }

Write-Host "🔧 Checking Git…" -ForegroundColor Yellow
try { git --version | Out-Null; OK "Git installed." } catch { FAIL "Git missing." }

Write-Host "☁️ Checking Wrangler…" -ForegroundColor Yellow
try { npx wrangler --version | Out-Null; OK "Wrangler installed." } catch { FAIL "Wrangler missing." }

# ==========================================================
#   SECTION 2 — PRIMORDIAOS STRUCTURE CHECKS
# ==========================================================

Write-Host "🧠 Checking kernel…" -ForegroundColor Yellow
if (Test-Path $kernel) { OK "Kernel directory found." } else { FAIL "Kernel missing." }

Write-Host "🧩 Checking modules…" -ForegroundColor Yellow
if (Test-Path $modules) { OK "Modules directory found." } else { FAIL "Modules missing." }

Write-Host "⚡ Checking workers…" -ForegroundColor Yellow
if (Test-Path $workers) { OK "Workers directory found." } else { FAIL "Workers missing." }

Write-Host "📜 Checking wrangler.toml…" -ForegroundColor Yellow
if (Test-Path "$workers\wrangler.toml") { OK "wrangler.toml found." } else { FAIL "wrangler.toml missing." }

# ==========================================================
#   SECTION 3 — ELECTRON + UNREAL CHECKS
# ==========================================================

Write-Host "🖥️ Checking Electron shell…" -ForegroundColor Yellow
if (Test-Path "$electron\package.json") { OK "Electron project detected." } else { FAIL "Electron project missing." }

Write-Host "🌌 Checking Unreal Engine…" -ForegroundColor Yellow
$unrealEditor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
if (Test-Path $unrealEditor) { OK "Unreal Editor found." } else { FAIL "Unreal Editor missing." }

Write-Host "🎮 Checking Unreal project…" -ForegroundColor Yellow
$uproject = "$unreal\PrimordiaUnreal.uproject"
if (Test-Path $uproject) { OK "PrimordiaUnreal.uproject found." } else { FAIL "PrimordiaUnreal.uproject missing." }

# ==========================================================
#   SECTION 4 — CLOUD + DATABASE CHECKS
# ==========================================================

Write-Host "🛰️ Checking PlanetScale DATABASE_URL…" -ForegroundColor Yellow
if ($env:DATABASE_URL) { OK "DATABASE_URL detected." } else { FAIL "DATABASE_URL missing." }

Write-Host "🚀 Checking Hyperdrive binding…" -ForegroundColor Yellow
if ($env:HYPERDRIVE) { OK "Hyperdrive binding detected." } else { FAIL "Hyperdrive binding missing." }

# ==========================================================
#   SECTION 5 — WORKER ROUTE VALIDATION
# ==========================================================

Write-Host "🔌 Validating Worker API routes…" -ForegroundColor Yellow

$workerSrc = "$workers\src"
if (!(Test-Path $workerSrc)) {
    FAIL "Worker src directory missing."
} else {
    $routes = Get-ChildItem $workerSrc -Recurse -Filter "*.ts"
    if ($routes.Count -gt 0) {
        OK "Worker routes detected: $($routes.Count)"
    } else {
        FAIL "No Worker routes found."
    }
}

# ==========================================================
#   SECTION 6 — MODULE DEPENDENCY GRAPH
# ==========================================================

Write-Host "🧬 Scanning module dependency graph…" -ForegroundColor Yellow

$moduleFiles = Get-ChildItem $modules -Recurse -Filter "*.ts"
if ($moduleFiles.Count -eq 0) {
    FAIL "No module files found."
} else {
    OK "Modules present: $($moduleFiles.Count)"
}

# ==========================================================
#   SECTION 7 — APPLET REGISTRY VALIDATION
# ==========================================================

Write-Host "🔮 Validating Applet Registry…" -ForegroundColor Yellow

$appletRegistry = "$kernel\applets\registry.json"
if (Test-Path $appletRegistry) {
    OK "Applet registry found."
} else {
    FAIL "Applet registry missing."
}

# ==========================================================
#   SECTION 8 — REALM MAP CONSISTENCY
# ==========================================================

Write-Host "🌐 Checking realm map consistency…" -ForegroundColor Yellow

$realmMap = "$kernel\runtime\realm-map.json"
if (Test-Path $realmMap) {
    OK "Realm map found."
} else {
    FAIL "Realm map missing."
}

# ==========================================================
#   SECTION 9 — WORLD PHASE READINESS
# ==========================================================

Write-Host "🌍 Checking world phase readiness…" -ForegroundColor Yellow

$worldPhase = "$kernel\world\phase.json"
if (Test-Path $worldPhase) {
    OK "World phase file found."
} else {
    FAIL "World phase file missing."
}

# ==========================================================
#   SECTION 10 — PRIMORDIAOS RUNTIME MAP
# ==========================================================

Write-Host ""
Write-Host "🧠 PRIMORDIAOS RUNTIME MAP" -ForegroundColor Cyan
Write-Host "----------------------------------------"
Write-Host "Realm: interface → Electron"
Write-Host "Realm: kernel → Node"
Write-Host "Realm: portal → Cloudflare"
Write-Host "Realm: world → Unreal"
Write-Host "----------------------------------------"
Write-Host ""

Log "Runtime map printed."

# ==========================================================
#   FINAL SUMMARY
# ==========================================================

Write-Host ""
Write-Host "🌟 PRIMORDIAOS ULTRA DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "📄 Full log saved to: $logFile" -ForegroundColor Gray
Log "SYSTEM: Ultra diagnostic complete."
