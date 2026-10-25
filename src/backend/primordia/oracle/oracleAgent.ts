import { OracleQuestion, OracleResponse } from "./oracleTypes";
import { OracleMemory } from "./oracleMemory";

export class OracleAgent {

  public static evaluate(
    input: OracleQuestion
  ): OracleResponse {

    const memories = OracleMemory.getMemories();

    const topGoal =
      memories.find(m => m.node_type === "goal")?.content
      ?? "No active goal";

    return {
      guidance:
        `Your primary objective remains: ${topGoal}`,

      opportunity:
        "Advance the system that creates the most leverage.",

      warning:
        "Avoid activities unrelated to the primary goal.",

      nextAction:
        "Continue building foundational PrimordiaOS architecture."
    };
  }
}

