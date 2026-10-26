Set-Location "C:\Users\Shane\moneyplughub"
Write-Host "👁️ [PrimordiaOS] Auto-Observer process initiated. Monitoring workspace activity..." -ForegroundColor Cyan

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = "C:\Users\Shane\moneyplughub"
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

$actionBlock = {
    param($sender, $eventArgs)
    $name = $eventArgs.Name
    $changeType = $eventArgs.ChangeType
    
    # Ignore internal state and log updates to prevent recursive loops
    if ($name -match "primordia_digital_twin_state\.json|primordia_queue\.json|primordia_habits\.json") {
        return
    }
    
    Write-Host "⚡ [Observer] Workspace event detected (${changeType}: ${name})" -ForegroundColor DarkYellow
    
    $jsTrigger = @"
const PrimordiaHabitTracker = require('./primordia_habit_tracker');
const tracker = new PrimordiaHabitTracker();
tracker.logInteraction("WORKSPACE_ACTIVITY_${changeType}", { file: "${name}" });
"@
    
    $tempFile = [System.IO.Path]::GetTempPath() + "primordia_event_" + [Guid]::NewGuid().ToString("N") + ".js"
    Set-Content -Path $tempFile -Value $jsTrigger -Encoding utf8
    node $tempFile
    Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
}

Register-ObjectEvent $watcher 'Changed' -Action $actionBlock | Out-Null
Register-ObjectEvent $watcher 'Created' -Action $actionBlock | Out-Null

while ($true) {
    Start-Sleep -Seconds 1
}
