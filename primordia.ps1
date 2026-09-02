# ================================
# PRIMORDIAOS TERMINAL v3
# ================================

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# --------------------------------
# GLOBAL STATE ENGINE
# --------------------------------
$Global:PrimordiaState = @{
    shell = "IDLE"
    chamber = "CLOSED"
    modules = @()
    lastCommand = ""
}

# --------------------------------
# PROMPT ENGINE
# --------------------------------
function prompt {
    $fire = "⟐"
    $mode = $Global:PrimordiaState.shell
    return "$fire PRIMORDIAOS [$mode] > "
}

# --------------------------------
# MODULE LOADER
# --------------------------------
function Load-PrimordiaModule {
    param($name)

    if ($Global:PrimordiaState.modules -contains $name) {
        Write-Host "Module '$name' already loaded." -ForegroundColor Yellow
        return
    }

    $Global:PrimordiaState.modules += $name
    Write-Host "Loaded module: $name" -ForegroundColor Green
}

# --------------------------------
# BOOT SEQUENCE
# --------------------------------
function Primordia-Boot {
    Write-Host "`n⟐ PrimordiaOS Boot Sequence" -ForegroundColor Cyan
    Write-Host "Shell: ACTIVATING..."
    Write-Host "Event Stream: INITIALIZING..."
    Write-Host "Unreal Link: STANDBY..."
    Write-Host "Modules: Core, World, Net"

    $Global:PrimordiaState.shell = "ACTIVE"

    Load-PrimordiaModule "PrimordiaCore"
    Load-PrimordiaModule "PrimordiaWorld"
    Load-PrimordiaModule "PrimordiaNet"

    Write-Host "`n⟐ PrimordiaOS Online" -ForegroundColor Green
}

# --------------------------------
# CHAMBER ENGINE
# --------------------------------
function Primordia-Chamber {
    param($target)

    Write-Host "`n⟐ Simulation Chamber" -ForegroundColor Yellow
    Write-Host "Opening chamber: $target"

    $Global:PrimordiaState.chamber = $target
}

# --------------------------------
# DIAGNOSTICS ENGINE
# --------------------------------
function Primordia-Diagnostics {
    Write-Host "`n⟐ PrimordiaOS Diagnostics" -ForegroundColor Magenta
    Write-Host "Shell State: $($Global:PrimordiaState.shell)"
    Write-Host "Chamber: $($Global:PrimordiaState.chamber)"
    Write-Host "Modules Loaded: $($Global:PrimordiaState.modules -join ', ')"
    Write-Host "Last Command: $($Global:PrimordiaState.lastCommand)"
}

# --------------------------------
# COMMAND ROUTER
# --------------------------------
function Invoke-PrimordiaCommand {
    param($cmd, $arg1, $arg2)

    $Global:PrimordiaState.lastCommand = $cmd

    switch ($cmd) {

        "system.boot" {
            Primordia-Boot
        }

        "system.state" {
            Primordia-Diagnostics
        }

        "sim.chamber.open" {
            Primordia-Chamber $arg1
        }

        default {
            Write-Host "PrimordiaOS: Unknown intent '$cmd'" -ForegroundColor Red
        }
    }
}

# --------------------------------
# MAIN ENTRYPOINT
# --------------------------------
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

    $raw = node C:\Users\Shane\primordia-shell-v2.js "$Input"
    $json = ConvertFrom-Json -InputObject $raw

    Invoke-PrimordiaCommand $json.cmd $json.args.target $json.args.profile
}
