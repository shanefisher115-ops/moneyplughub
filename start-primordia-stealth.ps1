Write-Host "🔮 Launching PrimordiaOS Stealth Infrastructure..." -ForegroundColor Cyan

# 1. Start Node.js Core Daemon & Digital Twin Generator
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node C:\Users\Shane\moneyplughub\primordia-digital-twin.js"

# 2. Start Signaling WebServer
$signalingPath = "C:\Program Files\Epic Games\UE_5.4\Engine\Source\Programs\PixelStreaming\WebServers\SignalingWebServer"
if (Test-Path $signalingPath) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$signalingPath'; node platform_scripts/cmd/run.js"
} else {
    Write-Host "⚠️ Signaling WebServer path not found. Ensure Pixel Streaming plugin is installed." -ForegroundColor Yellow
}

# 3. Start Headless Rendering Engine
$uePath = "C:\Program Files\Epic Games\UE_5.4\Engine\Binaries\Win64\UnrealEditor.exe"
$projectPath = "C:\Users\Shane\moneyplughub\PrimordiaOS.uproject"

if (Test-Path $uePath) {
    Start-Process $uePath -ArgumentList "`"$projectPath`" -game -PixelStreamingIP=127.0.0.1 -PixelStreamingPort=8888 -LOG -RenderOffscreen"
    Write-Host "✨ PrimordiaOS Omni-Engine deployed in stealth offscreen mode." -ForegroundColor Green
} else {
    Write-Host "⚠️ Unreal Engine binary not found at specified path." -ForegroundColor Red
}

Write-Host "🌌 WebGL Client available at http://localhost:80" -ForegroundColor BrightGreen