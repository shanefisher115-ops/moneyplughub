$ROOT = "primordiaos-core-workspace"

Write-Host "⚡ Activating MaxBounty Engine #9 inside PrimordiaOS..."

Add-Content "$ROOT/src/cognitive/agents/agentRegistry.js" @"
/* --- MaxBounty Engine #9 Registration --- */
export const engine_maxbounty = {
  id: "engine_maxbounty",
  realm: "affiliate",
  description: "MaxBounty CPA Engine",
  enabled: true
};
"@

Add-Content "$ROOT/loops/make_scenarios.js" @"
// --- MaxBounty Engine #9 Loop ---
import { runMaxBountyLoop } from "../engines/maxbounty/automation/maxbountyLoop.js";
await runMaxBountyLoop();
"@

Add-Content "$ROOT/livestreamAgent.mjs" @"
// --- MaxBounty Offer Rotation ---
import { MaxBountyRegistry } from "./engines/maxbounty/registry.js";
const mbOffers = MaxBountyRegistry.list();
rotationPool.push(...mbOffers);
"@

Add-Content "$ROOT/ledger.mjs" @"
// --- MaxBounty Ledger Stream ---
export function logMaxBountyEvent(payload) {
  logEvent("maxbounty_conversion", payload);
}
"@

Add-Content "$ROOT/frontend/primordialorigin.com/page.tsx" @"
{/* --- MaxBounty Dashboard Widget --- */}
<DashboardWidget
  title="MaxBounty CPA Engine"
  table="maxbounty_events"
  description="Tracks clicks, conversions, EPC, CR, and payout totals."
/>
"@

Write-Host "🔥 Reloading PrimordiaOS runtime..."
npm run dev

Write-Host "🚀 MaxBounty Engine #9 fully activated."
