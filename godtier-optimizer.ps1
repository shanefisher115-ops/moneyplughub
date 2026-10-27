# ==========================================
# PrimordiaOS God-Tier Optimization Loop
# ==========================================

$IntervalMinutes = 10

# Securely prompt for credentials once on startup
Write-Host "[PrimordiaOS] Enter your MaxBounty API credentials:" -ForegroundColor Cyan
$Email = Read-Host "Email"
$SecurePassword = Read-Host "Password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
$Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

function Start-GodTierCycle {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$Timestamp] [God-Tier Engine] Polling telemetry & evaluating campaign performance..." -ForegroundColor Cyan

    # 1. Authenticate with MaxBounty API
    $AuthBody = @{ email = $Email; password = $Password } | ConvertTo-Json
    try {
        $AuthRes = Invoke-RestMethod -Uri "https://api.maxbounty.com/affiliates/api/authentication" -Method Post -Body $AuthBody -ContentType "application/json"
        if (-not $AuthRes.success) {
            Write-Warning "[$Timestamp] Authentication failed. Retrying next cycle."
            return
        }
        $Headers = @{ "x-access-token" = $AuthRes."mb-api-token" }
    } catch {
        Write-Error "[$Timestamp] Auth error: $_"
        return
    }

    # 2. Pull Real-Time Conversion & Earnings Telemetry
    try {
        $EarningsRes = Invoke-RestMethod -Uri "https://api.maxbounty.com/affiliates/api/reports/earnings" -Method Get -Headers $Headers
        if ($EarningsRes.success) {
            $Totals = $EarningsRes.totals
            Write-Host "[$Timestamp] Telemetry Sync -> Clicks: $($Totals.clicks) | Leads: $($Totals.leads) | Earnings: `$$($Totals.earnings) | EPC: `$$($Totals.epc)" -ForegroundColor Green
        }
    } catch {
        Write-Warning "[$Timestamp] Could not fetch earnings telemetry."
    }

    # 3. Algorithmic Pruning & Optimization Check
    try {
        $SubIdRes = Invoke-RestMethod -Uri "https://api.maxbounty.com/affiliates/api/reports/subid" -Method Get -Headers $Headers
        if ($SubIdRes.success -and $SubIdRes.report) {
            foreach ($row in $SubIdRes.report) {
                $CampaignId = $row.campaign.campaign_id
                $Clicks = [int]$row.clicks
                $Earnings = [decimal]$row.earnings

                if ($Clicks -gt 100 -and $Earnings -eq 0) {
                    Write-Host "[$Timestamp] [PRUNE] Campaign ID $CampaignId underperforming ($Clicks clicks, `$$Earnings). Removing bookmark." -ForegroundColor Yellow
                    Invoke-RestMethod -Uri "https://api.maxbounty.com/affiliates/api/campaign/$CampaignId/removeBookmark" -Method Post -Headers $Headers | Out-Null
                }
            }
        }
    } catch {
        Write-Warning "[$Timestamp] SubID report check skipped."
    }

    Write-Host "[$Timestamp] God-Tier optimization cycle complete. Sleeping for $IntervalMinutes minutes..." -ForegroundColor DarkCyan
}

Write-Host "[PrimordiaOS] God-Tier Optimization Daemon active. Running every $IntervalMinutes minutes. Press Ctrl+C to stop." -ForegroundColor Green

while ($true) {
    Start-GodTierCycle
    Start-Sleep -Seconds ($IntervalMinutes * 60)
}
