export class PayoutValidator {
  validateAcoustics(acoustic: { jitter?: number; tremor?: number; stress?: number; deepfakeProbability?: number }) {
    const { jitter = 0, tremor = 0, stress = 0, deepfakeProbability = 0 } = acoustic || {};

    if (deepfakeProbability > 0.4) return { ok: false, reason: "DEEPFAKE" };
    if (stress > 0.85) return { ok: false, reason: "STRESS_SPIKE" };
    if (jitter > 0.7) return { ok: false, reason: "JITTER_HIGH" };

    return { ok: true };
  }

  validatePhrase(spoken: string, expected: string) {
    return spoken.trim().toLowerCase() === expected.trim().toLowerCase();
  }
}
