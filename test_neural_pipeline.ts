import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function scaffoldNeuralWidget() {
  const synthesis = { 
    intent: "Build NeuralRealm dashboard widget for live local LLM tracking and neural telemetry", 
    targetDomain: "NeuralRealmWidget" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- NEURAL WIDGET SCAFFOLD RESULT ---");
  console.dir(result, { depth: null });
}

scaffoldNeuralWidget();
