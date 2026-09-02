# ==============================================================================
# PRIMORDIAOS - OPEN DASHBOARD IN BROWSER
# ==============================================================================

$dashboardPath = "C:\Users\Shane\Documents\dev\PrimordiaOS\dashboard.html"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (Test-Path $edgePath) {
    Write-Host "Opening PrimordiaOS Dashboard in Microsoft Edge..." -ForegroundColor Cyan
    Start-Process -FilePath $edgePath -ArgumentList "`"$dashboardPath`""
} elseif (Test-Path $chromePath) {
    Write-Host "Opening PrimordiaOS Dashboard in Google Chrome..." -ForegroundColor Cyan
    Start-Process -FilePath $chromePath -ArgumentList "`"$dashboardPath`""
} else {
    Write-Host "Opening PrimordiaOS Dashboard..." -ForegroundColor Cyan
    Start-Process msedge.exe "`"$dashboardPath`""
}
