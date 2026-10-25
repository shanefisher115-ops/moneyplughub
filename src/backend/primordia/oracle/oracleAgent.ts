import { OracleQuestion, OracleResponse } from "./oracleTypes";
import { OracleMemory } from "./oracleMemory";
import { getIdentityProfile } from "../identity/identityProfile";

export class OracleAgent {

  public static evaluate(
    input: OracleQuestion
  ): OracleResponse {

    const memories = OracleMemory.getMemories();

    const profile = getIdentityProfile();

    const topGoal =
      memories.find(m => m.node_type === "goal")?.content
      ?? "No active goal";

    return {
      guidance:
        `As a ${profile.currentSelf}, focus on actions that move you toward ${profile.futureSelf}. Primary goal: ${topGoal}`,

      opportunity:
        `Advance projects aligned with your mission: ${profile.mission}`,

      warning:
        `Avoid activities that do not support becoming ${profile.futureSelf}`,

      nextAction:
        `Execute work that advances: ${topGoal}`
    };
  }
}
