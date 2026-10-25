import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function scaffoldVoiceWidget() {
  const synthesis = { 
    intent: "Build VoiceRealm dashboard widget for live Kokoro audio synthesis and speech telemetry tracking", 
    targetDomain: "VoiceRealmWidget" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- VOICE WIDGET SCAFFOLD RESULT ---");
  console.dir(result, { depth: null });
}

scaffoldVoiceWidget();
