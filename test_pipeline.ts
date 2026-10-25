import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function testFrontendScaffold() {
  const synthesis = { 
    intent: "Build Prospecting Engine dashboard widget with lead control, scraping trigger, and outreach logs", 
    targetDomain: "ProspectingEngineWidget" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- FRONTEND SCAFFOLD EXECUTION RESULT ---");
  console.dir(result, { depth: null });
}

testFrontendScaffold();
