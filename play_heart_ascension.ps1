# ==============================================================================
# PRIMORDIAOS — PLAY HEART ASCENSION SEQUENCE
# ==============================================================================

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "★  PRIMORDIA — 8-MOVEMENT HEART ASCENSION SEQUENCE             ★" -ForegroundColor Magenta
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "[1/2] Broadcasting Heart Ascension Signal to Unreal Engine..." -ForegroundColor Green

try {
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.Connect("127.0.0.1", 8000)

    $addr = [System.Text.Encoding]::ASCII.GetBytes("/Antigravity/Niagara/HeartAscension`0")
    $tag  = [System.Text.Encoding]::ASCII.GetBytes(",f`0`0")
    $val  = [System.BitConverter]::GetBytes([float]1.0)
    [Array]::Reverse($val)

    $packet = $addr + $tag + $val
    $udp.Send($packet, $packet.Length) | Out-Null
    $udp.Close()
    Write-Host "  -> OSC Heart Ascension wave sent to 127.0.0.1:8000" -ForegroundColor DarkGray
} catch {
    Write-Host "  -> OSC stream standby" -ForegroundColor DarkGray
}

Write-Host "[2/2] Heart Ascension Director Ready!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "To play the Heart Ascension Sequence in the live Unreal viewport," -ForegroundColor Cyan
Write-Host "paste this into the Python Console in Unreal Engine:" -ForegroundColor Yellow
Write-Host "import primordia_heart_ascension as pha; pha.HeartAscensionDirector.play()" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""
