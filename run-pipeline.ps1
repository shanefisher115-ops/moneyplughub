Write-Host '[PIPELINE] Starting PrimordiaOS Telemetry & Cryptographic Verification Loop...' -ForegroundColor Cyan

# Step 1: Sign the payload
Write-Host '[1/2] Executing Ed25519 Payload Signing...' -ForegroundColor Yellow
node sign-payload.js
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERROR] Signing failed!' -ForegroundColor Red
    exit 1
}

# Step 2: Verify the signature
Write-Host '[2/2] Executing Cryptographic Signature Verification...' -ForegroundColor Yellow
node verify-payload.js
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERROR] Verification failed!' -ForegroundColor Red
    exit 1
}

Write-Host '[SUCCESS] Full cryptographic telemetry pipeline executed successfully!' -ForegroundColor Green
