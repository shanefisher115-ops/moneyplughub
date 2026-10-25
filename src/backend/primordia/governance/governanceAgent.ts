import { GovernanceRules } from "./governanceRules";

export class GovernanceAgent {

  static evaluate(action: string) {

    return {
      action,
      approved: true,
      rules: GovernanceRules
    };

  }

}
