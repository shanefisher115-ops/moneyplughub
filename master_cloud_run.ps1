Write-Host "`n=== MASTER CLOUD RUN DEPLOYMENT ===" -ForegroundColor Cyan

# Force login as correct account
Write-Host "`nLogging in as: cashplughub@gmail.com" -ForegroundColor Yellow
gcloud auth login cashplughub@gmail.com

# Check project access
Write-Host "`nChecking access to project 'primordia-os'..." -ForegroundColor Yellow
$projectCheck = gcloud projects describe primordia-os 2>&1

if ($projectCheck -match "PERMISSION_DENIED" -or $projectCheck -match "not have permission" -or $projectCheck -match "NOT_FOUND") {
    Write-Host "`n❌ The account 'cashplughub@gmail.com' does NOT have access to project 'primordia-os'." -ForegroundColor Red
    Write-Host "Fix IAM in Google Cloud Console." -ForegroundColor Red
    exit
}

Write-Host "`n✔ Access confirmed. Proceeding..." -ForegroundColor Green

# Set project
gcloud config set project primordia-os

# Deploy
Write-Host "`nDeploying service..." -ForegroundColor Cyan

gcloud run deploy tesla-energy-swarm `
    --source "C:\Users\Shane\teamwork_projects\tesla_energy_swarm" `
    --region us-central1 `
    --platform managed `
    --allow-unauthenticated `
    --set-env-vars "ENV=production,VERSION=v1.0.0" `
    --cpu 1 `
    --memory 512Mi `
    --min-instances 0 `
    --max-instances 5 `
    --concurrency 80 `
    --timeout 300

# Fetch URL
Write-Host "`nFetching service URL..." -ForegroundColor Cyan
$ServiceURL = gcloud run services describe tesla-energy-swarm --region us-central1 --format="value(status.url)"

Write-Host "`n=== DEPLOYMENT COMPLETE ===" -ForegroundColor Magenta
Write-Host "Service URL: $ServiceURL" -ForegroundColor Green
