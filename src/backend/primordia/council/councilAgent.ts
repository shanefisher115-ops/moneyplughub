import { CriticAgent } from "./criticAgent";
import { BuilderAgent } from "./builderAgent";
import { HistorianAgent } from "./historianAgent";

export class CouncilAgent {

  static review(plan: string[]) {

    return {
      critic: CriticAgent.evaluate(plan),
      builder: BuilderAgent.evaluate(plan),
      historian: HistorianAgent.evaluate(plan)
    };

  }

}
