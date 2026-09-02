$Host.UI.RawUI.WindowTitle = "PrimordiaOS CAD/CAM Swarm (Gemini REST + Cloud)"

$apiKey = $env:GEMINI_API_KEY
if (-not $apiKey) {
    Write-Host "GEMINI_API_KEY not set." -ForegroundColor Red
    exit 1
}

$bucket = "gs://primordiaos-innovation"
$outputDir = "./output/cadcam"

if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$swarmPrompt = @"
You are an autonomous multimodal swarm orchestrator for my PrimordiaOS CAD/CAM ecosystem.

Your mission:
1. Design a 10-second CAD/CAM workflow animation (storyboard + keyframes).
2. Scaffold a full product/marketing webpage:
   - index.html
   - styles.css
   - app.js
3. Integrate MoneyPlugHub referral + webhook.
4. Generate UI animation wiring.

Output JSON structure:
{
  "cadcam_workflow_storyboard.json": { ... },
  "index.html": "<!DOCTYPE html>...",
  "styles.css": "body { ... }",
  "app.js": "const storyboard = ...",
  "moneyplughub_integration.md": "...",
  "ui_animation_integration.md": "..."
}
"@

Write-Host "Starting CAD/CAM workflow swarm with Google Cloud upload..."
Write-Host "Press CTRL+C to stop."

$url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=$apiKey"

while ($true) {

    Write-Host "`n[SWARM] Generating new CAD/CAM workflow cycle..."

    $body = @{
        model = "gemini-2.0-flash"
        contents = @(
            @{
                role = "user"
                parts = @(
                    @{
                        text = $swarmPrompt
                    }
                )
            }
        )
        generationConfig = @{
            responseMimeType = "application/json"
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Method Post -Uri $url -Body $body -ContentType "application/json"
    } catch {
        Write-Host "[SWARM] Error calling Gemini API: $($_.Exception.Message)" -ForegroundColor Red
        Start-Sleep -Seconds 15
        continue
    }

    if (-not $response.candidates) {
        Write-Host "[SWARM] No candidates returned." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        continue
    }

    $jsonText = $response.candidates[0].content.parts[0].text

    try {
        $parsed = $jsonText | ConvertFrom-Json
    } catch {
        Write-Host "[SWARM] Failed to parse JSON response." -ForegroundColor Red
        Start-Sleep -Seconds 15
        continue
    }

    foreach ($key in $parsed.PSObject.Properties.Name) {
        $filePath = Join-Path $outputDir $key
        $value = $parsed.$key
        Set-Content -Path $filePath -Value $value -Encoding UTF8
        Write-Host "[SWARM] Wrote $key"
    }

    Write-Host "[SWARM] Uploading files to Google Cloud Storage..."
    $files = Get-ChildItem -Path $outputDir

    foreach ($file in $files) {
        $cloudPath = "$bucket/$($file.Name)"
        Write-Host "Uploading $($file.Name) → $cloudPath"
        gsutil cp $file.FullName $cloudPath | Out-Null
    }

    Write-Host "[SWARM] Cloud upload complete. Waiting 15 seconds..."
    Start-Sleep -Seconds 15
}
