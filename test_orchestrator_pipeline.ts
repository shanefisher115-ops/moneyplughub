import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function scaffoldOrchestratorWidget() {
  const synthesis = { 
    intent: "Build OrchestratorRealm dashboard widget for live task queue and agent workflow monitoring", 
    targetDomain: "OrchestratorRealmWidget" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- ORCHESTRATOR WIDGET SCAFFOLD RESULT ---");
  console.dir(result, { depth: null });
}

scaffoldOrchestratorWidget();
