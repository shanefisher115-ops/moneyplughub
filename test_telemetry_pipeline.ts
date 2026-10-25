import { ArchitectRealm } from "./src/backend/realms/ArchitectRealm.ts";
import { PlannerRealm } from "./src/backend/realms/PlannerRealm.ts";
import { BuilderRealm } from "./src/backend/realms/BuilderRealm.ts";

async function scaffoldTelemetryDaemon() {
  const synthesis = { 
    intent: "Build Autonomous Telemetry Daemon for real-time system health checks and metrics logging", 
    targetDomain: "TelemetryDaemon" 
  };

  const architect = new ArchitectRealm();
  const spec = await architect.generateSpec(synthesis as any);

  const planner = new PlannerRealm();
  const plan = await planner.createExecutionPlan(spec);

  const builder = new BuilderRealm();
  const result = await builder.executePlan(plan);

  console.log("\n--- TELEMETRY DAEMON SCAFFOLD RESULT ---");
  console.dir(result, { depth: null });
}

scaffoldTelemetryDaemon();
