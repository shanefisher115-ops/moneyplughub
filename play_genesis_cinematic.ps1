# ==============================================================================
# PRIMORDIAOS — PLAY GENESIS CINEMATIC SEQUENCE
# ==============================================================================

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "★  PRIMORDIA — 9-ACT GENESIS CINEMATIC SEQUENCE                ★" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "[1/2] Broadcasting Cinematic Genesis Trigger to Unreal Engine..." -ForegroundColor Green

try {
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.Connect("127.0.0.1", 8000)

    $addr = [System.Text.Encoding]::ASCII.GetBytes("/Antigravity/Niagara/CinematicGenesis`0")
    $tag  = [System.Text.Encoding]::ASCII.GetBytes(",f`0`0")
    $val  = [System.BitConverter]::GetBytes([float]1.0)
    [Array]::Reverse($val)

    $packet = $addr + $tag + $val
    $udp.Send($packet, $packet.Length) | Out-Null
    $udp.Close()
    Write-Host "  -> OSC Genesis Cinematic Sync sent to 127.0.0.1:8000" -ForegroundColor DarkGray
} catch {
    Write-Host "  -> OSC stream standby" -ForegroundColor DarkGray
}

Write-Host "[2/2] In-Engine Cinematic Director is Ready!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "To play the 9-Act Genesis Sequence live in the Unreal viewport," -ForegroundColor Cyan
Write-Host "paste this into the Python Console in Unreal Engine:" -ForegroundColor Yellow
Write-Host "import primordia_genesis_cinematic as pgc; pgc.PrimordiaGenesisDirector.play()" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""
