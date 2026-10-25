import { OracleAgent } from "./oracle/oracleAgent";
import { ArchitectAgent } from "./architect/architectAgent";
import { CouncilAgent } from "./council/councilAgent";
import { GovernanceAgent } from "./governance/governanceAgent";

export class PrimordiaPipeline {

  static execute() {

    const oracle = OracleAgent.evaluate({
      userId: "usr_admin_001",
      question: "What should happen next?"
    });

    const architect = ArchitectAgent.design({
      goal: "Build PrimordiaOS"
    });

    const council = CouncilAgent.review(
      architect.steps
    );

    const governance = GovernanceAgent.evaluate(
      architect.goal
    );

    return {
      oracle,
      architect,
      council,
      governance
    };
  }

}
