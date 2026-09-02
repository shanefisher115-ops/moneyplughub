# === PrimordiaOS Antigravity Deploy ===
Write-Host "=== PrimordiaOS Antigravity Deploy ===" -ForegroundColor Cyan

# 1. Clone repo
Write-Host "📦 Cloning repository..."
git clone https://github.com/MoneyPlug/PlugIn-OS.git
Set-Location PlugIn-OS

# 2. Write Terraform variables from Antigravity secrets
Write-Host "🔧 Configuring Terraform variables..."
$tfvars = @"
cloudflare_account_id = "$($env:CLOUDFLARE_ACCOUNT_ID)"
cloudflare_zone_id    = "$($env:CLOUDFLARE_ZONE_ID)"
cloudflare_api_token  = "$($env:CLOUDFLARE_API_TOKEN)"
github_owner          = "MoneyPlug"
github_repo           = "PlugIn-OS"
"@
Set-Content -Path "infra/terraform.tfvars" -Value $tfvars

# 3. Ensure backend worker exists
Write-Host "🛠 Creating backend worker script..."
$null = New-Item -ItemType Directory -Force -Path "infra/workers"
$worker = @"
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/state") {
      return new Response("PrimordiaOS state endpoint");
    }

    if (url.pathname === "/api/agent") {
      return new Response("PrimordiaOS agent endpoint");
    }

    return new Response("PrimordiaOS backend online");
  }
};
"@
Set-Content -Path "infra/workers/backend.js" -Value $worker

# 4. Terraform deploy
Write-Host "🌍 Deploying infrastructure with Terraform..."
Set-Location "infra"
terraform init

$auto = "auto"
$appr = "approve"
terraform apply "-$auto-$appr"

Write-Host "=== PrimordiaOS Deployed ===" -ForegroundColor Green
Write-Host "Cockpit: https://primordialorigin.com" -ForegroundColor Green
Write-Host "API:    https://primordialorigin.com/api/state" -ForegroundColor Green
