import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function scaffoldShaderWidget() {
  const synthesis = { 
    intent: "Build ShaderRealm dashboard widget for 3D WebGL particle physics and visual telemetry tracking", 
    targetDomain: "ShaderRealmWidget" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- SHADER WIDGET SCAFFOLD RESULT ---");
  console.dir(result, { depth: null });
}

scaffoldShaderWidget();
