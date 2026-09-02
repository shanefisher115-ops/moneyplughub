# ============================================
#   PRIMORDIAOS DIAGNOSTIC MASTER TERMINAL FILE
# ============================================

Write-Host ""
Write-Host "🔍 PRIMORDIAOS DIAGNOSTIC ENGINE INITIALIZING…" -ForegroundColor Cyan
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
$logFile = "$logs\diagnostic-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').log"

function Log {
    param([string]$msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp :: $msg" | Tee-Object -FilePath $logFile -Append
}

function OK { Write-Host "✔ $($args[0])" -ForegroundColor Green; Log "OK: $($args[0])" }
function FAIL { Write-Host "❌ $($args[0])" -ForegroundColor Red; Log "FAIL: $($args[0])" }

Log "BOOT: Diagnostic engine started."

# --- CHECK ROOT ---
Write-Host "📁 Checking PrimordiaOS root directory…" -ForegroundColor Yellow
if (Test-Path $root) { OK "Root directory found." } else { FAIL "Root directory missing."; exit }

# --- CHECK NODE ---
Write-Host "🟦 Checking Node.js…" -ForegroundColor Yellow
try {
    node -v | Out-Null
    OK "Node.js installed."
} catch {
    FAIL "Node.js NOT installed."
}

# --- CHECK NPM ---
Write-Host "📦 Checking NPM…" -ForegroundColor Yellow
try {
    npm -v | Out-Null
    OK "NPM installed."
} catch {
    FAIL "NPM NOT installed."
}

# --- CHECK WRANGLER ---
Write-Host "☁️ Checking Cloudflare Wrangler…" -ForegroundColor Yellow
try {
    npx wrangler --version | Out-Null
    OK "Wrangler installed."
} catch {
    FAIL "Wrangler NOT installed."
}

# --- CHECK GIT ---
Write-Host "🔧 Checking Git…" -ForegroundColor Yellow
try {
    git --version | Out-Null
    OK "Git installed."
} catch {
    FAIL "Git NOT installed."
}

# --- CHECK ELECTRON ---
Write-Host "🖥️ Checking Electron shell…" -ForegroundColor Yellow
if (Test-Path "$electron\package.json") {
    OK "Electron project detected."
} else {
    FAIL "Electron project missing."
}

# --- CHECK UNREAL ---
Write-Host "🌌 Checking Unreal Engine…" -ForegroundColor Yellow
$unrealEditor = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
if (Test-Path $unrealEditor) {
    OK "Unreal Editor found."
} else {
    FAIL "Unreal Editor NOT found."
}

# --- CHECK UNREAL PROJECT ---
Write-Host "🎮 Checking Primordia Unreal project…" -ForegroundColor Yellow
$uproject = "$unreal\PrimordiaUnreal.uproject"
if (Test-Path $uproject) {
    OK "PrimordiaUnreal.uproject found."
} else {
    FAIL "PrimordiaUnreal.uproject missing."
}

# --- CHECK WORKERS ---
Write-Host "⚡ Checking Cloudflare Worker directory…" -ForegroundColor Yellow
if (Test-Path $workers) {
    OK "Workers directory found."
} else {
    FAIL "Workers directory missing."
}

# --- CHECK WRANGLER CONFIG ---
Write-Host "📜 Checking wrangler.toml…" -ForegroundColor Yellow
if (Test-Path "$workers\wrangler.toml") {
    OK "wrangler.toml found."
} else {
    FAIL "wrangler.toml missing."
}

# --- CHECK KERNEL ---
Write-Host "🧠 Checking PrimordiaOS kernel…" -ForegroundColor Yellow
if (Test-Path $kernel) {
    OK "Kernel directory found."
} else {
    FAIL "Kernel directory missing."
}

# --- CHECK MODULES ---
Write-Host "🧩 Checking PrimordiaOS modules…" -ForegroundColor Yellow
if (Test-Path $modules) {
    OK "Modules directory found."
} else {
    FAIL "Modules directory missing."
}

# --- CHECK PLANETSCALE ENV ---
Write-Host "🛰️ Checking PlanetScale environment variables…" -ForegroundColor Yellow
if ($env:DATABASE_URL) {
    OK "DATABASE_URL detected."
} else {
    FAIL "DATABASE_URL missing."
}

# --- CHECK HYPERDRIVE ---
Write-Host "🚀 Checking Hyperdrive binding…" -ForegroundColor Yellow
if ($env:HYPERDRIVE) {
    OK "Hyperdrive binding detected."
} else {
    FAIL "Hyperdrive binding missing."
}

# --- FINAL SUMMARY ---
Write-Host ""
Write-Host "🌟 PRIMORDIAOS DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "📄 Full log saved to: $logFile" -ForegroundColor Gray
Log "SYSTEM: Diagnostic complete."
