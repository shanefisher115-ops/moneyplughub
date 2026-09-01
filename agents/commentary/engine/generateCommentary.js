import { Auditor } from "../roles/Auditor.js";
import { Classifier } from "../roles/Classifier.js";
import { Predictor } from "../roles/Predictor.js";
import { Advisor } from "../roles/Advisor.js";

export function generateCommentary(diff = "") {
  return [
    ...Auditor(diff),
    ...Classifier(diff),
    ...Predictor(diff),
    ...Advisor(diff)
  ];
}
