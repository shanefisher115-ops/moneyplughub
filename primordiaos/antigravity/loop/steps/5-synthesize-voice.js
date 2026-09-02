import { narrate } from "../../../voice/narrator/index.js";

export async function step5_synthesizeVoice(commentary) {
  console.log("🔊 [Step 5/6] Synthesizing acoustic narrator layers...");
  narrate({ pulse: "diff", commentary });
}