export const PayoutEvents = {
  INTENT_DETECTED: "VOICE_INTENT",
  CHALLENGE_ISSUED: "PAYOUT_CHALLENGE",
  CHALLENGE_VALIDATED: "PAYOUT_CHALLENGE_VALIDATED",
  ZERO_TRUST_DECISION: "MCP_ZERO_TRUST",
  PAYOUT_EXECUTED: "VOICE_PAYOUT",
  PAYOUT_DENIED: "VOICE_PAYOUT_DENIED",
  XP_AWARDED: "XP_AWARDED"
};

export const XP_BEHAVIORAL_MATRIX = {
  SUCCESSFUL_PAYOUT: { xp: 95, reason: "Financial + swarm + ledger consistency" },
  PHRASE_MISMATCH: { xp: 20, reason: "Cognitive precision & challenge phrase verification" },
  STRESS_SPIKE: { xp: 15, reason: "Emotional safety & distress pause trigger" },
  DEEPFAKE_INTERCEPT: { xp: 10, reason: "Security accuracy & acoustic synthetic rejection" },
  ACOUSTIC_DEFENSE: { xp: 10, reason: "Acoustic anomaly defense & sentinel vigilance" }
};
