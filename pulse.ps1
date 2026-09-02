# ==============================================================================
# PRIMORDIAOS - OSC PULSE TRIGGER FOR UNREAL ENGINE
# ==============================================================================

param(
    [float]$Intensity = 1.0
)

try {
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.Connect("127.0.0.1", 8000)

    $addrBytes = [System.Text.Encoding]::ASCII.GetBytes("/Antigravity/Niagara/Pulsewave`0`0`0")
    $tagBytes  = [System.Text.Encoding]::ASCII.GetBytes(",f`0`0")
    $valBytes  = [System.BitConverter]::GetBytes([float]$Intensity)
    [Array]::Reverse($valBytes)

    $packet = $addrBytes + $tagBytes + $valBytes
    $udp.Send($packet, $packet.Length) | Out-Null
    $udp.Close()

    Write-Host "★ Pulsewave shockwave sent to Unreal Engine (Intensity: $Intensity)!" -ForegroundColor Cyan
} catch {
    Write-Host "Error sending pulse: $_" -ForegroundColor Red
}
