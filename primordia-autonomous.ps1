# ------------------------------------------
# AUTOPOSTER MODULE (AUTO-GENERATE CONTENT)
# ------------------------------------------

function Primordia-AutoPoster {
    param(
        $channel = "MoneyPlugHub",
        $content = $Global:PrimordiaState.lastContent
    )

    # If no content exists, auto-generate new content
    if (-not $content -or $content -eq "") {
        Write-Host "`n⟐ AutoPoster Engine" -ForegroundColor Blue
        Write-Host "No content found. Auto-generating new content..." -ForegroundColor Yellow

        Primordia-ContentGenerate -profile "default"
        $content = $Global:PrimordiaState.lastContent
    }

    $postInfo = "AutoPoster pushed content '$content' to '$channel' at $(Get-Date -Format 'HH:mm:ss')"

    Write-Host "`n⟐ AutoPoster Engine" -ForegroundColor Blue
    Write-Host "Auto-posting: $postInfo"

    Log-Primordia "AUTOPOST: $postInfo"
    Save-PrimordiaState
}

[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding           = [System.Text.Encoding]::UTF8

# ------------------------------------------
# GLOBAL PATHS / AUTO-SAVE
# ------------------------------------------
$Global:PrimordiaRoot      = "C:\Users\Shane"
$Global:PrimordiaStateFile = Join-Path $Global:PrimordiaRoot "primordia-state.json"
$Global:PrimordiaLogFile   = Join-Path $Global:PrimordiaRoot "primordia-log.txt"

# ------------------------------------------
# GLOBAL STATE
# ------------------------------------------
$Global:PrimordiaState = @{
    shell        = "IDLE"
    loop         = "STOPPED"
    lastCommand  = ""
    lastContent  = ""
    lastRender   = ""
    lastPackage  = ""
    lastPost     = ""
    iterations   = 0
}

function Save-PrimordiaState {
    try {
        $json = $Global:PrimordiaState | ConvertTo-Json -Depth 5
        Set-Content -Path $Global:PrimordiaStateFile -Value $json -Encoding UTF8
    } catch {
        Write-Host "PrimordiaOS: Failed to save state." -ForegroundColor Red
    }
}

function Log-Primordia {
    param($message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $message"
    Add-Content -Path $Global:PrimordiaLogFile -Value $line -Encoding UTF8
}

# ------------------------------------------
# PROMPT ENGINE
# ------------------------------------------
function prompt {
    $fire = "⟐"
    $mode = $Global:PrimordiaState.shell
    $loop = $Global:PrimordiaState.loop
    return "$fire PRIMORDIAOS [$mode/$loop] `> "
}

# ------------------------------------------
# CORE ENGINE MODULES
# ------------------------------------------

function Primordia-ContentGenerate {
    param($profile = "default")

    $idea = "Auto-script for profile '$profile' at $(Get-Date -Format 'HH:mm:ss')"
    $Global:PrimordiaState.lastContent = $idea

    Write-Host "`n⟐ Content Engine" -ForegroundColor Cyan
    Write-Host "Generated script idea: $idea"

    Log-Primordia "CONTENT: $idea"
    Save-PrimordiaState
}

function Primordia-ContentRender {
    param($target = "video.mp4")

    $renderInfo = "Render task for '$target' at $(Get-Date -Format 'HH:mm:ss')"
    $Global:PrimordiaState.lastRender = $renderInfo

    Write-Host "`n⟐ Render Engine" -ForegroundColor Yellow
    Write-Host "Queued render: $renderInfo"

    Log-Primordia "RENDER: $renderInfo"
    Save-PrimordiaState
}

function Primordia-ContentPackage {
    param($packName = "Primordia_VFX_Pack")

    $packageInfo = "Package '$packName' at $(Get-Date -Format 'HH:mm:ss')"
    $Global:PrimordiaState.lastPackage = $packageInfo

    Write-Host "`n⟐ Packaging Engine" -ForegroundColor Green
    Write-Host "Packaging: $packageInfo"

    Log-Primordia "PACKAGE: $packageInfo"
    Save-PrimordiaState
}

function Primordia-ContentPost {
    param($channel = "MoneyPlugHub")

    $postInfo = "Post to '$channel' at $(Get-Date -Format 'HH:mm:ss')"
    $Global:PrimordiaState.lastPost = $postInfo

    Write-Host "`n⟐ Posting Engine" -ForegroundColor Magenta
    Write-Host "Posting: $postInfo"

    Log-Primordia "POST: $postInfo"
    Save-PrimordiaState
}
function Primordia-AutoPoster {
    param(
        $channel = "MoneyPlugHub",
        $content = $Global:PrimordiaState.lastContent
    )

    if (-not $content -or $content -eq "") {
        Write-Host "`n⟐ AutoPoster Engine" -ForegroundColor Blue
        Write-Host "No content found. Auto-generating new content..." -ForegroundColor Yellow

        Primordia-ContentGenerate -profile "default"
        $content = $Global:PrimordiaState.lastContent
    }

    $postInfo = "AutoPoster pushed content '$content' to '$channel' at $(Get-Date -Format 'HH:mm:ss')"

    Write-Host "`n⟐ AutoPoster Engine" -ForegroundColor Blue
    Write-Host "Auto-posting: $postInfo"

    Log-Primordia "AUTOPOST: $postInfo"

    # ⭐ NEW LINE — updates diagnostics
    $Global:PrimordiaState.lastPost = $postInfo

    Save-PrimordiaState
}

# ------------------------------------------
# AUTONOMOUS LOOP ENGINE
# ------------------------------------------

$Global:PrimordiaLoopToken = $null

function Primordia-LoopStart {
    param(
        $profile = "default",
        $channel = "MoneyPlugHub",
        [int]$delaySeconds = 10
    )

    if ($Global:PrimordiaState.loop -eq "RUNNING") {
        Write-Host "PrimordiaOS: Loop already running." -ForegroundColor Yellow
        return
    }

    Write-Host "`n⟐ Autonomous Content Engine" -ForegroundColor Cyan
    Write-Host "Starting loop: profile='$profile', channel='$channel', delay=${delaySeconds}s"

    $Global:PrimordiaState.loop = "RUNNING"
    Save-PrimordiaState
    Log-Primordia "LOOP START: profile=$profile channel=$channel delay=$delaySeconds"

    $Global:PrimordiaLoopToken = [System.Guid]::NewGuid().ToString()

    Start-Job -Name "PrimordiaLoop-$($Global:PrimordiaLoopToken)" -ScriptBlock {
        param($profile, $channel, $delaySeconds, $stateFile, $logFile)

        while ($true) {
    try {
        $state = Get-Content -Path $stateFile -Encoding UTF8 | ConvertFrom-Json
        if ($state.loop -ne "RUNNING") {
            break
        }

        # Increment iterations
        $state.iterations++
        Set-Content -Path $stateFile -Value ($state | ConvertTo-Json -Depth 5)

        # Global rotation tables
        $channels = @("MoneyPlugHub","TikTok","YouTube","Instagram","X","Reddit","Facebook")
        $profiles = @("default","then","cosmic","moneyplug","primordial","creatorOS","loop")

        # Compute rotation index
        $i = $state.iterations

        # Rotate channel + profile
        $nextChannel = $channels[$i % $channels.Count]
        $nextProfile = $profiles[$i % $profiles.Count]

        # Log loop step
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $line = "[$timestamp] LOOP STEP: profile=$nextProfile channel=$nextChannel iteration=$i"
        Add-Content -Path $logFile -Value $line -Encoding UTF8

        # Run AutoPoster Agent each cycle
        Primordia-AutoPoster -channel $nextChannel -profile $nextProfile

        Start-Sleep -Seconds $delaySeconds
    } catch {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $line = "[$timestamp] LOOP ERROR: $($_.Exception.Message)"
        Add-Content -Path $logFile -Value $line -Encoding UTF8
        break
    }
}

$Global:PrimordiaChannels = @(
    "MoneyPlugHub",
    "TikTok",
    "YouTube",
    "Instagram",
    "X",
    "Reddit",
    "Facebook"
)

                  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                  $line = "[$timestamp] LOOP STEP: profile=$profile channel=$channel"
                  Add-Content -Path $logFile -Value $line -Encoding UTF8

                                               # Run AutoPoster Agent each loop cycle
                  Primordia-AutoPoster -channel $channel -profile $profile

                Start-Sleep -Seconds $delaySeconds
            } catch {
                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                $line = "[$timestamp] LOOP ERROR: $($_.Exception.Message)"
                Add-Content -Path $logFile -Value $line -Encoding UTF8
                break
            }
        }
    } -ArgumentList $profile, $channel, $delaySeconds, $Global:PrimordiaStateFile, $Global:PrimordiaLogFile
}

function Primordia-LoopStop {
    Write-Host "`n⟐ Autonomous Content Engine" -ForegroundColor Red
    Write-Host "Stopping loop."

    $Global:PrimordiaState.loop = "STOPPED"
    Save-PrimordiaState
    Log-Primordia "LOOP STOP"

    Get-Job | Where-Object { $_.Name -like "PrimordiaLoop-*" } | Remove-Job -Force
}

# ------------------------------------------
# DIAGNOSTICS
# ------------------------------------------
function Primordia-Diagnostics {
    Write-Host "`n⟐ PrimordiaOS Production Diagnostics" -ForegroundColor Cyan
    Write-Host "Shell State : $($Global:PrimordiaState.shell)"
    Write-Host "Loop State  : $($Global:PrimordiaState.loop)"
    Write-Host "Iterations  : $($Global:PrimordiaState.iterations)"
    Write-Host "Last Script : $($Global:PrimordiaState.lastContent)"
    Write-Host "Last Render : $($Global:PrimordiaState.lastRender)"
    Write-Host "Last Package: $($Global:PrimordiaState.lastPackage)"
    Write-Host "Last Post   : $($Global:PrimordiaState.lastPost)"
}

# ------------------------------------------
# COMMAND ROUTER (FINAL, CORRECTED)
# ------------------------------------------
function Invoke-PrimordiaCommand {
    param($cmd, $arg1, $arg2)

    $Global:PrimordiaState.lastCommand = $cmd
    Save-PrimordiaState

    if (-not $arg1) { $arg1 = "default" }
    if (-not $arg2) { $arg2 = "MoneyPlugHub" }

    switch ($cmd) {

        "engine.loop.start" {
            Primordia-LoopStart -profile $arg1 -channel $arg2
        }

        "engine.loop.stop" {
            Primordia-LoopStop
        }

        "content.generate" {
            Primordia-ContentGenerate -profile $arg1
        }
        "autopost" {
                       Primordia-AutoPoster -channel $arg1
                      }

        "content.render" {
            Primordia-ContentRender -target $arg1
        }

        "content.package" {
            Primordia-ContentPackage -packName $arg1
        }

        "content.post" {
            Primordia-ContentPost -channel $arg1
        }

        "system.state" {
            Primordia-Diagnostics
        }

        default {
            Write-Host "PrimordiaOS: Unknown intent '$cmd'" -ForegroundColor Red
        }
    }
}

# ------------------------------------------
# MAIN ENTRYPOINT
# ------------------------------------------
function Invoke-Primordia {
    param(
        [Parameter(ValueFromPipeline=$true, ValueFromRemainingArguments=$true)]
        $Input
    )

    if (-not $Input -and $PSBoundParameters.ContainsKey('Input')) {
        $Input = $PSBoundParameters['Input']
    }
    if (-not $Input -and $args) {
        $Input = $args
    }

    $Input = ($Input | Out-String).Trim()
    Write-Host "UG: Input='$Input'"

    $parts = $Input -split "\s+"
    $cmd   = $parts[0]
    $arg1  = $null
    $arg2  = $null

    if ($parts.Count -ge 2) { $arg1 = $parts[1] }
    if ($parts.Count -ge 3) { $arg2 = $parts[2] }

    $Global:PrimordiaState.shell = "ACTIVE"
    Save-PrimordiaState

    Invoke-PrimordiaCommand $cmd $arg1 $arg2
}
