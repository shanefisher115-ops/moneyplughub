import { WorldState } from "./worldTypes";

export class WorldModel {

  static load(): WorldState {

    return {
      entities: [
        {
          type: "project",
          name: "PrimordiaOS"
        },
        {
          type: "platform",
          name: "MoneyPlugHub"
        },
        {
          type: "mission",
          name: "Build PrimordiaOS"
        }
      ]
    };

  }

}
