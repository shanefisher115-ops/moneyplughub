param(
    [string]$NodePath = "node",
    [string]$BootScript = (Join-Path -Path $PSScriptRoot -ChildPath "primordial_boot_cinematic.js"),
    [string]$WebBootUrl = "http://localhost:3000"
)

# Enforce active human agency by displaying boot diagnostics and requiring confirmation
Write-Host ">> PrimordialOS: Auric Core Boot Sequence Initiating" -ForegroundColor Magenta

# Start web boot UI (React dev server assumed running)
Write-Host ">> Directing web terminal to $WebBootUrl" -ForegroundColor Cyan
Start-Process $WebBootUrl

# Run Node cinematic boot
Write-Host ">> Loading CLI Core boot cinematic..." -ForegroundColor Cyan
& $NodePath $BootScript

Write-Host "`n>> PrimordialOS Online // AntiGravity Protocols Engaged" -ForegroundColor Yellow
