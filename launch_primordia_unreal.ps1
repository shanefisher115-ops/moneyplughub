# ==============================================================================
# 🎮 PRIMORDIAOS UNREAL ENGINE 5.4+ REALITY ENGINE & PIXEL STREAMING LAUNCHER
# ==============================================================================
# Boots the Unreal Engine project, Pixel Streaming WebRTC Signaling Server, 
# and MoneyPlugHub IPC Telemetry WebSocket Bridge.
# ==============================================================================

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   🌌 PRIMORDIAOS UNREAL REALITY ENGINE — PRODUCTION LAUNCHER   " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

$WorkspaceRoot = Resolve-Path "$PSScriptRoot\.."
$UnrealProjectPath = "$WorkspaceRoot\PrimordiaUnreal\PrimordiaUnreal.uproject"
$UnrealEngineVersion = "5.4"

# 1. Check if Unreal project file exists
if (Test-Path $UnrealProjectPath) {
    Write-Host "[OK] Found PrimordiaUnreal Project: $UnrealProjectPath" -ForegroundColor Green
} else {
    Write-Host "[WARNING] PrimordiaUnreal.uproject not found at standard path. Scanning workspace..." -ForegroundColor Yellow
}

# 2. Check MoneyPlugHub Server Telemetry Status
try {
    $Status = Invoke-RestMethod -Uri "http://localhost:3001/api/unreal/status" -TimeoutSec 2
    Write-Host "[OK] MoneyPlugHub Unreal Bridge Online: $($Status.data.renderMode)" -ForegroundColor Green
} catch {
    Write-Host "[INFO] MoneyPlugHub API server starting or on port 3000..." -ForegroundColor Gray
}

# 3. Launch Options
Write-Host ""
Write-Host "Select Execution Mode:" -ForegroundColor White
Write-Host "  [1] Launch Unreal Engine Editor (DirectX 12 + Niagara VFX)" -ForegroundColor Cyan
Write-Host "  [2] Launch Unreal Headless Standalone + Pixel Streaming (Port 8888)" -ForegroundColor Green
Write-Host "  [3] Run Antigravity Reality Verification Build" -ForegroundColor Magenta
Write-Host "  [4] Exit" -ForegroundColor Red
Write-Host ""

$Choice = Read-Host "Enter option (1-4, default is 1)"
if (-not $Choice) { $Choice = "1" }

switch ($Choice) {
    "1" {
        Write-Host "Starting PrimordiaUnreal Editor..." -ForegroundColor Cyan
        Start-Process $UnrealProjectPath
    }
    "2" {
        Write-Host "Starting Headless Pixel Streaming Node..." -ForegroundColor Green
        # Launch standalone with pixel streaming arguments
        Write-Host "Arguments: -PixelStreamingIP=localhost -PixelStreamingPort=8888 -RenderOffScreen" -ForegroundColor Gray
        Start-Process $UnrealProjectPath -ArgumentList "-PixelStreamingIP=localhost -PixelStreamingPort=8888 -RenderOffScreen -log"
    }
    "3" {
        Write-Host "Running Primordial Antigravity Build..." -ForegroundColor Magenta
        & "$WorkspaceRoot\PrimordiaUnreal\Primordial-Antigravity-Build.ps1"
    }
    Default {
        Write-Host "Exiting Launcher." -ForegroundColor Yellow
    }
}
