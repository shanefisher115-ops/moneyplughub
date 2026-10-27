$statePath = "C:\Users\Shane\OS_Core\state.json"
if (!(Test-Path $statePath)) {
    $statePath = Join-Path (Get-Location) "..\OS_Core\state.json"
}

$supabaseKey = "sb_publishable_0RClGSyrsm8TqNu3wR_TPA_2uR1MOhJ"
$supabaseUrl = "https://jccxdlvzeckyaqprkmba.supabase.co/rest/v1/telemetry_logs"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " PrimordiaOS Telemetry Daemon Active     " -ForegroundColor Cyan
Write-Host " Watching: $statePath                    " -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan

$lastWriteTime = (Get-Item $statePath).LastWriteTime

while ($true) {
    Start-Sleep -Seconds 2
    $currentFile = Get-Item $statePath
    
    if ($currentFile.LastWriteTime -ne $lastWriteTime) {
        $lastWriteTime = $currentFile.LastWriteTime
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] State mutation detected! Dispatching telemetry..." -ForegroundColor Magenta

        try {
            $current = Get-Content $statePath -Raw | ConvertFrom-Json
            $timestamp = (Get-Date).ToString("o")
            $activeTier = $current.activity_classes.high

            $headers = @{
                "apikey"        = $supabaseKey
                "Authorization" = "Bearer $supabaseKey"
                "Content-Type"  = "application/json"
                "Prefer"        = "return=minimal"
            }

            $payload = [PSCustomObject]@{
                timestamp   = $timestamp
                drift_mode  = $current.identity.drift_mode
                intensity   = if ($activeTier) { $activeTier.intensity } else { 1.0 }
                mood        = if ($activeTier) { $activeTier.mood } else { "deep_intense" }
                metadata    = $current
            }

            Invoke-RestMethod -Uri $supabaseUrl -Method Post -Headers $headers -Body ($payload | ConvertTo-Json -Depth 10)
            Write-Host "-> Telemetry pulse successfully synchronized." -ForegroundColor Green
        }
        catch {
            Write-Host "-> Telemetry sync failed: $_" -ForegroundColor Red
        }
    }
}
