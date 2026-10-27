# ==========================================
# PrimordiaOS - Autonomous MaxBounty Daemon
# ==========================================

param(
    [int]$IntervalMinutes = 15,
    [double]$MinEpcThreshold = 1.00
)

$BaseUri = "https://api.maxbounty.com/affiliates/api"
$Email = "contact@primordialorigin.com"
$Password = 'Demoniac666$'

function Start-BountyCycle {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$Timestamp] [PrimordiaOS Daemon] Scanning MaxBounty campaigns..." -ForegroundColor Cyan

    try {
        $AuthBody = @{ email = $Email; password = $Password } | ConvertTo-Json
        $Headers = @{ "Accept" = "application/json"; "Content-Type" = "application/json" }
        
        $AuthResponse = Invoke-RestMethod -Uri "$BaseUri/authentication" -Method Post -Body $AuthBody -Headers $Headers -ErrorAction Stop
        if (-not $AuthResponse.success) {
            Write-Warning "[$Timestamp] Authentication rejected."
            return
        }

        $ApiToken = $AuthResponse."mb-api-token"
        $ApiHeaders = @{
            "x-access-token" = $ApiToken
            "Accept"         = "application/json"
            "Content-Type"   = "application/json"
        }

        $CampaignsRes = Invoke-RestMethod -Uri "$BaseUri/campaigns/top?limit=10" -Method Get -Headers $ApiHeaders
        if ($CampaignsRes.success) {
            $FilteredCount = 0
            foreach ($campaign in $CampaignsRes.campaigns) {
                if ($campaign.epc -ge $MinEpcThreshold) {
                    $FilteredCount++
                    Write-Host "-> [MATCHED] ID: $($campaign.campaign_id) | Name: $($campaign.name) | EPC: `$$($campaign.epc)" -ForegroundColor Yellow

                    $LinkBody = @{
                        campaign_id = $campaign.campaign_id
                        sub1        = "primordia_autonomous_daemon"
                        sub2        = "epc_gt_$MinEpcThreshold"
                    } | ConvertTo-Json

                    $LinkRes = Invoke-RestMethod -Uri "$BaseUri/trackinglink" -Method Post -Body $LinkBody -Headers $ApiHeaders
                    if ($LinkRes.success) {
                        Write-Host "   [Tracking Link Deployed] -> $($LinkRes."tracking-link")" -ForegroundColor DarkCyan
                    }
                }
            }
            Write-Host "[$Timestamp] Filter complete. Deployed links for $FilteredCount high-yield campaigns." -ForegroundColor Green
        }

        $EarningsRes = Invoke-RestMethod -Uri "$BaseUri/reports/earnings" -Method Get -Headers $ApiHeaders
        if ($EarningsRes.success) {
            Write-Host "[$Timestamp] Earnings Sync -> Clicks: $($EarningsRes.totals.clicks) | Leads: $($EarningsRes.totals.leads) | Earnings: `$$($EarningsRes.totals.earnings)" -ForegroundColor Green
        }
    }
    catch {
        Write-Error "[$Timestamp] Error in daemon cycle: $_"
    }
}

Write-Host "[PrimordiaOS] Autonomous MaxBounty Daemon active. Running every $IntervalMinutes minutes. Min EPC: `$($MinEpcThreshold)." -ForegroundColor Green

Start-BountyCycle

while ($true) {
    Start-Sleep -Seconds ($IntervalMinutes * 60)
    Start-BountyCycle
}
