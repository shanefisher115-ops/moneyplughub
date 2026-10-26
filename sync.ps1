
param(
    [string]$Message = "Auto-sync update from PrimordiaOS session: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")"
)

Write-Host "?? [PrimordiaOS] Staging changes..." -ForegroundColor Cyan
git add .

Write-Host "?? [PrimordiaOS] Committing: $Message" -ForegroundColor Yellow
git commit -m "$Message"

Write-Host "?? [PrimordiaOS] Pushing to GitHub (primordia-spellwright)..." -ForegroundColor Green
git push origin primordia-spellwright

Write-Host "? [PrimordiaOS] Sync complete!" -ForegroundColor Cyan

