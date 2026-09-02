# ============================================================
# PrimordiaVisual.ps1
# Launches Unreal Engine 5.8 VISUALLY with your project + map
# ============================================================

# --- Require Admin ---
$IsAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent() `
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
    Write-Host "❌ This launcher must be run as Administrator." -ForegroundColor Red
    Write-Host "➡️  Right-click the file and select 'Run with PowerShell' (Admin)."
    exit
}

Write-Host "=== Primordia Visual Unreal Launcher ===" -ForegroundColor Cyan

# --- Paths ---
$UnrealPath   = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$ProjectPath  = "C:\Users\Shane\PrimordiaWorld\PrimordiaWorld.uproject"
$MapName      = "One"

# --- Validate Unreal ---
if (!(Test-Path $UnrealPath)) {
    Write-Host "❌ UnrealEditor.exe not found at:" -ForegroundColor Red
    Write-Host "   $UnrealPath"
    exit
}

# --- Validate Project ---
if (!(Test-Path $ProjectPath)) {
    Write-Host "❌ .uproject file not found at:" -ForegroundColor Red
    Write-Host "   $ProjectPath"
    exit
}

# --- Launch Unreal VISUALLY ---
Write-Host "🚀 Opening Unreal Engine 5.8 visually..." -ForegroundColor Green
Write-Host "📂 Project: $ProjectPath" -ForegroundColor Yellow

Start-Process -FilePath $UnrealPath -ArgumentList "`"$ProjectPath`""

Write-Host "✨ Unreal Engine is launching now. Watch the window appear." -ForegroundColor Magenta
