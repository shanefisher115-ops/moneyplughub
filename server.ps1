# ==============================================================================
# PRIMORDIAOS - EVENT SERVER LAUNCHER
# ==============================================================================

$devDir = "C:\Users\Shane\Documents\dev\PrimordiaOS"
Set-Location $devDir

# Set NODE_PATH to include global / nexus node_modules if needed
$env:NODE_PATH = "C:\Users\Shane\primordia-nexus\node_modules;C:\Users\Shane\PrimordiaOS\node_modules;$devDir\node_modules"

Write-Host "Starting PrimordiaOS Event Server on ws://localhost:17800..." -ForegroundColor Cyan
node primordia_event_server.mjs
