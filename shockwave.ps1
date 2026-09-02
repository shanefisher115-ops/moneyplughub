# ==============================================================================
# PRIMORDIAOS - OSC SHOCKWAVE TRIGGER FOR UNREAL ENGINE
# ==============================================================================

param(
    [float]$Intensity = 2.5
)

try {
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.Connect("127.0.0.1", 8000)

    $addrBytes = [System.Text.Encoding]::ASCII.GetBytes("/Antigravity/Niagara/BigBang`0`0`0")
    $tagBytes  = [System.Text.Encoding]::ASCII.GetBytes(",f`0`0")
    $valBytes  = [System.BitConverter]::GetBytes([float]$Intensity)
    [Array]::Reverse($valBytes)

    $packet = $addrBytes + $tagBytes + $valBytes
    $udp.Send($packet, $packet.Length) | Out-Null
    $udp.Close()

    Write-Host "★ Massive Big Bang Shockwave sent to Unreal Engine (Intensity: $Intensity)!" -ForegroundColor Yellow
} catch {
    Write-Host "Error sending shockwave: $_" -ForegroundColor Red
}
