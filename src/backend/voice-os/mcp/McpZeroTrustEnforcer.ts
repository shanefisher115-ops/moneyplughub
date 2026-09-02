import { EventEmitter } from "events";

export class McpZeroTrustEnforcer {
  private bus: EventEmitter;

  constructor(bus: EventEmitter) {
    this.bus = bus;
  }

  evaluateRisk(riskScore: number, flags: string[]) {
    if (riskScore >= 90) return "LOCK";
    if (riskScore >= 70) return "FREEZE";
    if (flags.includes("DEEPFAKE")) return "STEP_UP";
    if (flags.includes("PANIC")) return "ISOLATE";
    return "ALLOW";
  }

  enforce(sessionId: string, riskScore: number, flags: string[]) {
    const action = this.evaluateRisk(riskScore, flags);

    const payload = {
      sessionId,
      riskScore,
      flags,
      action,
      casbRemediation: action === "LOCK"
    };

    this.bus.emit("MCP_ZERO_TRUST", payload);
    return payload;
  }
}
