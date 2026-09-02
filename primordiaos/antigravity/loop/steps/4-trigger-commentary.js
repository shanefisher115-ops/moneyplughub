import { generateCommentary } from "../../../agents/commentary/generateCommentary.js";

export async function step4_triggerCommentary(diffResult) {
  console.log("🧠 [Step 4/6] Activating Commentary Council (Auditor, Classifier, Predictor, Advisor)...");
  return generateCommentary({
    diffContent: diffResult.diffContent,
    hasBreakingChanges: diffResult.hasBreakingChanges
  });
}