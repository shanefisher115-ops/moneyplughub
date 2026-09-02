# ============================================================
# PrimordiaExtractor.ps1
# Extracts valuable components from old PrimordiaOS, Plug-In OS,
# and MoneyPlugHub builds and merges them into v16.
# ============================================================

# --- Require Admin ---
$IsAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent() `
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $IsAdmin) {
    Write-Host "❌ Must run as Administrator." -ForegroundColor Red
    Write-Host "➡️ Right-click → Run with PowerShell (Admin)"
    exit
}

Write-Host "🌌 Primordia Extractor Starting..." -ForegroundColor Cyan

# --- Directories containing old builds ---
$SourceRoots = @(
    "C:\Users\Shane\PrimordialOS",
    "C:\Users\Shane\PlugInOS",
    "C:\Users\Shane\MoneyPlugHub"
)

# --- Active v16 target directory ---
$Target = "C:\Users\Shane\PrimordialOS\v16-simviewport"

# --- Valuable folders to extract ---
$Valuable = @(
    "ui",
    "assets",
    "components",
    "modules",
    "scripts",
    "agents",
    "core",
    "styles",
    "config",
    "prompt"
)

# --- Active folders to skip ---
$SkipNames = @(
    "v16-simviewport",
    "PixelStreamServer",
    "PrimordiaWorld",
    "PrimordiaOS-Core",
    "PlugInOS-Core",
    "MoneyPlugHub-Core"
)

# --- Begin scanning ---
foreach ($Root in $SourceRoots) {

    if (!(Test-Path $Root)) {
        Write-Host "⚠️ Skipping missing directory: $Root" -ForegroundColor DarkYellow
        continue
    }

    Write-Host "🔍 Scanning: $Root" -ForegroundColor Yellow

    $Folders = Get-ChildItem -Path $Root -Directory

    foreach ($Folder in $Folders) {

        # Skip active folders
        if ($SkipNames -contains $Folder.Name) {
            Write-Host "⏭ Skipping active folder: $Folder" -ForegroundColor DarkYellow
            continue
        }

        Write-Host "📁 Checking old build: $Folder" -ForegroundColor Cyan

        # Scan inside old build for valuable folders
        foreach ($Item in $Valuable) {

            $SourcePath = Join-Path $Folder.FullName $Item

            if (Test-Path $SourcePath) {

                $DestPath = Join-Path $Target $Item

                Write-Host "✨ Extracting: $SourcePath → $DestPath" -ForegroundColor Green

                # Create destination folder if missing
                if (!(Test-Path $DestPath)) {
                    New-Item -ItemType Directory -Path $DestPath | Out-Null
                }

                # Copy valuable content
                Copy-Item -Path $SourcePath\* -Destination $DestPath -Recurse -Force
            }
        }
    }
}

Write-Host "🌠 Extraction Complete — All valuable elements merged into v16." -ForegroundColor Magenta
Write-Host "🚀 PrimordiaOS v16 is now upgraded with recovered assets, modules, and UI." -ForegroundColor Cyan
