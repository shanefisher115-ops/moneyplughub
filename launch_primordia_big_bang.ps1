# ==============================================================================
# PRIMORDIAOS - UNREAL BIG BANG GENESIS LAUNCHER
# ==============================================================================

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "*  PRIMORDIAOS - UNREAL ENGINE BIG BANG GENESIS PIPELINE       *" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "[1/3] Calibrating PrimordiaOS Telemetry and Niagara OSC..." -ForegroundColor Green

# 1. Send initial OSC Big Bang trigger packet over UDP port 8000
try {
    $udpClient = New-Object System.Net.Sockets.UdpClient
    $udpClient.Connect("127.0.0.1", 8000)

    # OSC Packet helper for /Antigravity/Niagara/BigBang -> 2.5
    $oscAddress = [System.Text.Encoding]::ASCII.GetBytes("/Antigravity/Niagara/BigBang`0`0`0")
    $oscTypeTag = [System.Text.Encoding]::ASCII.GetBytes(",f`0`0")
    $floatVal = [System.BitConverter]::GetBytes([float]2.5)
    [Array]::Reverse($floatVal)

    $packet = $oscAddress + $oscTypeTag + $floatVal
    $udpClient.Send($packet, $packet.Length) | Out-Null
    $udpClient.Close()
    Write-Host "  -> OSC Big Bang Shockwave transmitted to 127.0.0.1:8000" -ForegroundColor DarkGray
} catch {
    Write-Host "  -> OSC stream standby" -ForegroundColor DarkGray
}

# 2. Path verification
$projectPath = "C:\Users\Shane\Documents\dev\PrimordiaOS\PrimordiaUnreal.uproject"
$enginePath = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"

if (-not (Test-Path $enginePath)) {
    Write-Host "[ERROR] Unreal Engine 5.8 executable not found at: $enginePath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $projectPath)) {
    Write-Host "[ERROR] PrimordiaUnreal.uproject not found at: $projectPath" -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Verified Unreal Engine 5.8 and Primordia Genesis Project." -ForegroundColor Green
Write-Host "[3/3] Launching Unreal Engine 5.8 Viewport..." -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "* DETONATING THE BIG BANG OF PRIMORDIA...                       *" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# 3. Start Unreal Editor with auto-execution of the cosmos setup script
$processArgs = "`"$projectPath`" -ExecCmds=`"py init_unreal.py`""
Start-Process -FilePath $enginePath -ArgumentList $processArgs

Write-Host "Unreal Engine 5.8 is opening. When the viewport appears, hit Play (Alt + P) to activate full agent autonomy!" -ForegroundColor Cyan
