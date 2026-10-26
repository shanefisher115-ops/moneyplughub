function Send-FusionEvent($type, $payload) {
    return [PSCustomObject]@{
        timestamp = (Get-Date)
        type      = $type
        payload   = $payload
    }
}
