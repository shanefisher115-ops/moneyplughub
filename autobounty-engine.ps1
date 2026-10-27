# ==========================================
# PrimordiaOS - Autonomous MaxBounty Engine
# ==========================================

$BaseUri = "https://api.maxbounty.com/affiliates/api"
$Email = "contact@primordialorigin.com"
$Password = 'Demoniac666$'

Write-Host "[PrimordiaOS] Authenticating with MaxBounty API..." -ForegroundColor Cyan
$AuthBody = @{
    email    = $Email
    password = $Password
} | ConvertTo-Json

try {
    $Headers = @{
        "Accept" = "application/json"
        "Content-Type" = "application/json"
    }

    $AuthResponse = Invoke-RestMethod -Uri "$BaseUri/authentication" -Method Post -Body $AuthBody -Headers $Headers -ErrorAction Stop
    
    if (-not $AuthResponse.success) {
        Write-Error "[PrimordiaOS Fatal] Authentication rejected. Response: $($AuthResponse | ConvertTo-Json -Compress)"
        exit
    }

    $ApiToken = $AuthResponse."mb-api-token"
    Write-Host "[PrimordiaOS] Authentication successful! Token secured: $ApiToken" -ForegroundColor Green

    # Set up headers for subsequent API calls using the secured token
    $ApiHeaders = @{
        "x-access-token" = $ApiToken
        "Accept"         = "application/json"
        "Content-Type"   = "application/json"
    }

    # 1. Fetch Top Campaigns (GET /campaigns/top)
    Write-Host "[PrimordiaOS] Harvesting top-performing campaigns..." -ForegroundColor Cyan
    $CampaignsRes = Invoke-RestMethod -Uri "$BaseUri/campaigns/top?limit=3" -Method Get -Headers $ApiHeaders

    if ($CampaignsRes.success) {
        foreach ($campaign in $CampaignsRes.campaigns) {
            Write-Host "-> Found Campaign ID: $($campaign.campaign_id) | Name: $($campaign.name) | EPC: `$$($campaign.epc)" -ForegroundColor Yellow

            # 2. Generate Tracking Link (POST /trackinglink)
            $LinkBody = @{
                campaign_id = $campaign.campaign_id
                sub1        = "primordia_os_pipeline"
                sub2        = "automated_funnel"
            } | ConvertTo-Json

            $LinkRes = Invoke-RestMethod -Uri "$BaseUri/trackinglink" -Method Post -Body $LinkBody -Headers $ApiHeaders

            if ($LinkRes.success) {
                Write-Host "   [Tracking Link Generated] -> $($LinkRes."tracking-link")" -ForegroundColor DarkCyan
            }
        }
    }

    # 3. Pull Live Earnings Report (GET /reports/earnings)
    Write-Host "[PrimordiaOS] Syncing live earnings and conversion metrics..." -ForegroundColor Cyan
    $EarningsRes = Invoke-RestMethod -Uri "$BaseUri/reports/earnings" -Method Get -Headers $ApiHeaders
    if ($EarningsRes.success) {
        $EarningsRes.totals | Format-Table
    }
}
catch {
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Error "[PrimordiaOS Fatal] API Error Details: $responseBody"
    } else {
        Write-Error "[PrimordiaOS Fatal] Error: $_"
    }
    exit
}
