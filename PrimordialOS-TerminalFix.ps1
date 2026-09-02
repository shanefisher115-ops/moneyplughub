# ======================================================================
# PRIMORDIAL OS — NOTE MASTER TERMINAL FIX
# Automatically restores the diagnostic closure + primordial router
# ======================================================================

$ModulePath = "$HOME\Documents\PowerShell\Modules\PrimordialOS\PrimordialOS.psm1"

# Read the existing module
$Content = Get-Content $ModulePath -Raw

# Remove everything from the broken bottom section
$Cleaned = $Content -replace '(?s)function Invoke-PrimordialDiagnostic.*', ''

# Append the correct, working ending
$FixBlock = @'
function Invoke-PrimordialDiagnostic {
    $results = @()

    $results += "Realm: $($PrimordialOS.Realm)"
    $results += "Pattern: $($PrimordialOS.Pattern)"
    $results += "Activated: $($PrimordialOS.Activated)"
    $results += "Last Prophecy: $($PrimordialOS.LastProphecy)"
    $results += "HUD Momentum: $($PrimordialOS.HUD.Momentum)"
    $results += "HUD Realm: $($PrimordialOS.HUD.ActiveRealm)"
    $results += "Spectre Count: $($PrimordialOS.Memory.Spectre.Count)"

    return $results -join "`n"
}   # closes Invoke-PrimordialDiagnostic


function primordial {
    param([string]$cmd,[string]$arg,[string]$extra)

    switch ($cmd) {

        "activate" {
            $PrimordialOS.Activated = $true
            Write-Output "PRIMORDIAL OS ACTIVATED"
            return
        }

        "realm" {
            $PrimordialOS.Realm = $arg
            Write-Output ("Realm switched to " + $arg)
            return
        }

        "pattern" {
            $PrimordialOS.Pattern = $arg
            Write-Output ("Pattern switched to " + $arg)
            return
        }

        "prophecy" {
            $realm = $arg
            if (-not $realm) { $realm = $PrimordialOS.Realm }
            $type = $extra
            if (-not $type) { $type = "origin-clarity" }
            $p = "[$realm::$type] Prophecy issued."
            $PrimordialOS.LastProphecy = $p
            $PrimordialOS.Memory.Lore += $p
            Write-Output $p
            return
        }

        "agent" {
            $agentName = $arg
            if (-not $agentName) { $agentName = "origin-agent" }
            Write-Output ("Agent " + $agentName + " invoked.")
            return
        }

        "loop" {
            $loopName = $arg
            if (-not $loopName) { $loopName = "origin-loop" }
            Write-Output ("Loop " + $loopName + " executed.")
            return
        }

        "hud" {
            Write-Output ("HUD :: Realm=" + $PrimordialOS.HUD.ActiveRealm +
                          " | Momentum=" + $PrimordialOS.HUD.Momentum +
                          " | LastEvent=" + $PrimordialOS.HUD.LastEvent)
            return
        }

        "memory" {
            Write-Output "=== SHORT TERM ==="
            $PrimordialOS.Memory.ShortTerm | ForEach-Object { Write-Output $_ }

            Write-Output "=== LORE ==="
            $PrimordialOS.Memory.Lore | ForEach-Object { Write-Output $_ }

            Write-Output "=== SPECTRE ==="
            $PrimordialOS.Memory.Spectre | ForEach-Object { Write-Output $_ }

            return
        }

        "diag" {
            Write-Output (Invoke-PrimordialDiagnostic)
            return
        }

        "antigrav" {
            $script = Join-Path -Path $PSScriptRoot -ChildPath "antigrav.js"
            if (-not $arg) {
                Write-Output "Error: Please specify a file path or text content to analyze."
                Write-Output "Usage: primordial antigrav [filepath_or_text] [fix]"
                return
            }

            # Harvest environmental context
            $branch = "unknown"
            try {
                $branch = (git branch --show-current 2>$null).Trim()
            } catch {}

            $lastError = ""
            if ($Error.Count -gt 0) {
                $lastError = $Error[0].ToString()
            }

            $recentCommand = ""
            try {
                $recentCommand = (Get-History -Count 1).CommandLine
                if (-not $recentCommand) {
                    if (Get-Command Get-PSReadLineOption -ErrorAction SilentlyContinue) {
                        $historyPath = (Get-PSReadLineOption).HistorySavePath
                        if (Test-Path $historyPath) {
                            $recentCommand = (Get-Content $historyPath -Tail 1).Trim()
                        }
                    }
                }
            } catch {}

            # Construct JSON metadata
            $metadata = @{
                branch = $branch
                lastError = $lastError
                recentCommand = $recentCommand
                host = $env:COMPUTERNAME
            } | ConvertTo-Json -Compress

            $fixFlag = ""
            if ($extra -eq "fix" -or $extra -eq "--fix" -or $extra -eq "-fix") {
                $fixFlag = "--fix"
            }

            if (Test-Path $arg -PathType Leaf) {
                $res = node $script --file $arg --metadata $metadata $fixFlag
            } else {
                $res = node $script --content $arg --metadata $metadata $fixFlag
            }
            Write-Output $res
            return
        }

        "enforce" {
            $script = Join-Path -Path $PSScriptRoot -ChildPath "primordial\sovereignty\enforcer.js"
            if (-not $arg) {
                Write-Output "Error: Please specify the action to enforce."
                Write-Output "Usage: primordial enforce [action] [agent] [report]"
                return
            }
            $agent = "unknown"
            $report = ""
            if ($extra) {
                $parts = $extra -split " "
                if ($parts.Count -gt 0) { $agent = $parts[0] }
                if ($parts.Count -gt 1) { $report = $parts[1] }
            }
            
            if ($report) {
                $res = node $script --action $arg --agent $agent --report $report
            } else {
                $res = node $script --action $arg --agent $agent
            }
            Write-Output $res
            return
        }

        default {
            Write-Output "Unknown command."
            return
        }
    }   # closes switch ($cmd)
}       # closes function primordial
'@

# Write the repaired module back to disk
Set-Content -Path $ModulePath -Value ($Cleaned + "`n`n" + $FixBlock)

Write-Output "PrimordialOS terminal fix applied. Reloading module..."
Import-Module PrimordialOS -Force

Write-Output "PrimordialOS restored."
