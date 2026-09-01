import { narrate } from "../../../voice/narrator/index.js";

export function dispatchFinanceInsights(insights = [], HUD = null) {
  if (HUD && typeof HUD.addFinanceInsights === "function") {
    HUD.addFinanceInsights(insights);
  }
  console.log(`?? [Finance Intelligence] Broadcasted ${insights.length} financial insights to HUD.`);

  const notable = insights.filter(i => i.type === "anomaly" || i.type === "forecast");
  if (notable.length) {
    narrate({
      pulse: "diff",
      commentary: notable.map(n => n.message)
    });
  }
}

