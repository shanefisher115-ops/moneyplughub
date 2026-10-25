import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function scaffoldIntegrationWidget() {
  const synthesis = { 
    intent: "Build IntegrationRealm dashboard widget for webhook routing and Make.com connector telemetry tracking", 
    targetDomain: "IntegrationRealmWidget" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- INTEGRATION WIDGET SCAFFOLD RESULT ---");
  console.dir(result, { depth: null });
}

scaffoldIntegrationWidget();
