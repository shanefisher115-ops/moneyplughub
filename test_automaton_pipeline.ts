import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function scaffoldAutomatonWidget() {
  const synthesis = { 
    intent: "Build AutomatonRealm dashboard widget for live daemon and workflow automation tracking", 
    targetDomain: "AutomatonRealmWidget" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- AUTOMATON WIDGET SCAFFOLD RESULT ---");
  console.dir(result, { depth: null });
}

scaffoldAutomatonWidget();
