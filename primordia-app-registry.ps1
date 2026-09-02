$apps = @(
    "frontend",
    "moneyplug-loop-manager",
    "PlugInOS",
    "primordia-cloudrun",
    "primordial-origin",
    "PrimordialOS",
    "public"
)

$registry = foreach ($app in $apps) {
    $path = "C:\Users\Shane\$app"
    if (Test-Path $path) {
        [PSCustomObject]@{
            Name = $app
            Path = $path
        }
    }
}

$registry | Format-Table -AutoSize
