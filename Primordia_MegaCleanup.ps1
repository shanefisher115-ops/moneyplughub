<# 
PrimordiaOS + Unreal + Dev Machine MEGA CLEANUP
Run in PowerShell as Administrator.
#>

$ErrorActionPreference = "SilentlyContinue"

function Get-DiskUsageGB {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    (Get-ChildItem -Recurse -Force $Path | Measure-Object -Property Length -Sum).Sum / 1GB
}

function Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

function Remove-IfExists {
    param([string]$Path)
    if (Test-Path $Path) {
        $before = Get-DiskUsageGB $Path
        Log "Deleting '$Path' (approx {0:N2} GB)..." -f $before
        Remove-Item -Recurse -Force $Path
        Log "Deleted '$Path'."
        return $before
    } else {
        Log "Skip (not found): $Path"
        return 0
    }
}

$totalFreed = 0.0

Log "=== PRIMORDIA MEGA CLEANUP START ==="

# -------- PRIMORDIAOS / PROJECT ROOTS --------
$primordiaRoot = "C:\Users\Shane\Documents\dev\PrimordiaOS"
$primordiaUnrealRoot = Join-Path $primordiaRoot "PrimordiaUnreal_Project\PrimordiaUnreal"
$primordiaUnrealAlt  = "C:\PrimordiaUnreal"

$pathsProject = @(
    (Join-Path $primordiaUnrealRoot "DerivedDataCache"),
    (Join-Path $primordiaUnrealRoot "Intermediate"),
    (Join-Path $primordiaUnrealRoot "Saved"),
    (Join-Path $primordiaUnrealRoot "Binaries")
)

foreach ($p in $pathsProject) {
    $totalFreed += Remove-IfExists $p
}

# Plugin backups / analysis
Log "Cleaning Unreal plugin backups / analysis..."
Get-ChildItem -Recurse -Directory -Path $primordiaUnrealRoot -Filter "Plugins_*Backup*" | ForEach-Object {
    $totalFreed += Remove-IfExists $_.FullName
}
Get-ChildItem -Recurse -Directory -Path $primordiaUnrealRoot -Filter "PluginAnalysis_*" | ForEach-Object {
    $totalFreed += Remove-IfExists $_.FullName
}

# Old duplicate Unreal project
$totalFreed += Remove-IfExists $primordiaUnrealAlt

# -------- NODE / JS / BUILD ARTIFACTS --------
Log "Cleaning node_modules, dist, build, .cache, logs, tests in PrimordiaOS..."

Get-ChildItem -Recurse -Directory -Path $primordiaRoot -Filter "node_modules" | ForEach-Object {
    $totalFreed += Remove-IfExists $_.FullName
}
Get-ChildItem -Recurse -Directory -Path $primordiaRoot -Filter "dist","build",".cache","logs","tests" | ForEach-Object {
    $totalFreed += Remove-IfExists $_.FullName
}

# -------- GLOBAL UNREAL CACHES --------
Log "Cleaning global Unreal caches..."

$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\UnrealEngine\DerivedDataCache"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\UnrealEngine\Common\DerivedDataCache"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\UnrealEngine\ShaderCache"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\UnrealEngine\VaultCache"

# UE installation extras (adjust version if needed)
$ueInstall = "$env:PROGRAMFILES\Epic Games\UE_5.8"
$totalFreed += Remove-IfExists (Join-Path $ueInstall "FeaturePacks")
$totalFreed += Remove-IfExists (Join-Path $ueInstall "Samples")

# PIE temp worlds
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\Temp\UEDPIE_*"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\Temp\Memory\UEDPIE_*"

# -------- EPIC GAMES LAUNCHER --------
Log "Cleaning Epic Games Launcher cache..."

$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\EpicGamesLauncher\Saved\Logs"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\EpicGamesLauncher\Saved\WebCache"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\EpicGamesLauncher\Saved\WebCache2"

# -------- VISUAL STUDIO / DEV CACHES --------
Log "Cleaning Visual Studio caches and build artifacts..."

Get-ChildItem -Recurse -Directory -Path $primordiaRoot -Filter ".vs" | ForEach-Object {
    $totalFreed += Remove-IfExists $_.FullName
}
Get-ChildItem -Recurse -Directory -Path $primordiaRoot -Filter "bin" | ForEach-Object {
    $totalFreed += Remove-IfExists $_.FullName
}
Get-ChildItem -Recurse -Directory -Path $primordiaRoot -Filter "obj" | ForEach-Object {
    $totalFreed += Remove-IfExists $_.FullName
}

$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\Microsoft\VisualStudio\Packages"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\Microsoft\VisualStudio\Cache"
$totalFreed += Remove-IfExists "$env:USERPROFILE\.nuget\packages"

# -------- SYSTEM TEMP / CRASH / UPDATE --------
Log "Cleaning Windows temp, crash dumps, update leftovers..."

$totalFreed += Remove-IfExists "C:\Windows\Temp"
$totalFreed += Remove-IfExists "$env:TEMP"
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\Temp"

$totalFreed += Remove-IfExists "C:\Windows\Minidump"
$totalFreed += Remove-IfExists "C:\Windows\LiveKernelReports"

$totalFreed += Remove-IfExists "C:\Windows\SoftwareDistribution\Download"

# Prefetch (safe but optional)
$totalFreed += Remove-IfExists "C:\Windows\Prefetch"

# DirectX shader cache
$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\D3DSCache"

# -------- NPM / PIP CACHE --------
Log "Cleaning NPM and pip caches..."

try {
    Log "Running: npm cache clean --force"
    npm cache clean --force | Out-Null
} catch { Log "npm cache clean failed or npm not installed." }

$totalFreed += Remove-IfExists "$env:LOCALAPPDATA\pip\cache"

# -------- SUMMARY --------
Log "=== PRIMORDIA MEGA CLEANUP COMPLETE ==="
Log ("Approximate space freed: {0:N2} GB" -f $totalFreed)
