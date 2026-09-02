import { EventEmitter } from "events";

import { PayoutChallenge } from "./PayoutChallenge";
import { PayoutValidator } from "./PayoutValidator";
import { PayoutExecutor } from "./PayoutExecutor";
import { PayoutEvents, XP_BEHAVIORAL_MATRIX } from "./PayoutEvents";

export class PayoutFlow {
  private bus: EventEmitter;
  private challenge: PayoutChallenge;
  private validator: PayoutValidator;
  private executor: PayoutExecutor;
  private mcp: any;

  constructor(bus: EventEmitter, mcp: any) {
    this.bus = bus;
    this.mcp = mcp;

    this.challenge = new PayoutChallenge();
    this.validator = new PayoutValidator();
    this.executor = new PayoutExecutor();
  }

  async start(intent: any, session: any) {
    const { amount, currency } = intent.entities;
    const userId = session.identity?.userId || "u_unknown";

    // 1. Issue challenge
    const challenge = this.challenge.issue(amount || 0, currency || "USD");
    this.bus.emit(PayoutEvents.CHALLENGE_ISSUED, challenge);

    // 2. Wait for spoken challenge phrase
    const spokenPhrase = await session.awaitPhrase();
    const phraseValid = this.validator.validatePhrase(
      spokenPhrase || "",
      challenge.challengePhrase
    );

    if (!phraseValid) {
      const denied = this.executor.deny(challenge.payoutId, "PHRASE_MISMATCH");
      const xpAward = XP_BEHAVIORAL_MATRIX.PHRASE_MISMATCH;
      
      this.bus.emit(PayoutEvents.XP_AWARDED, {
        userId,
        amount: xpAward.xp,
        dimension: "Cognitive Precision",
        reason: xpAward.reason,
        timestamp: Date.now()
      });

      this.bus.emit(PayoutEvents.PAYOUT_DENIED, { ...denied, xpEarned: xpAward.xp });
      return { ...denied, xpEarned: xpAward.xp, xpReason: xpAward.reason };
    }

    // 3. Validate acoustics
    const acoustic = await session.getAcousticMetrics();
    const acousticCheck = this.validator.validateAcoustics(acoustic);

    if (!acousticCheck.ok) {
      const reason = acousticCheck.reason || "ACOUSTIC_ANOMALY";
      const denied = this.executor.deny(challenge.payoutId, reason);

      let xpAward = XP_BEHAVIORAL_MATRIX.ACOUSTIC_DEFENSE;
      let dimension = "Security Vigilance";

      if (reason === "DEEPFAKE") {
        xpAward = XP_BEHAVIORAL_MATRIX.DEEPFAKE_INTERCEPT;
        dimension = "Security Accuracy";
      } else if (reason === "STRESS_SPIKE") {
        xpAward = XP_BEHAVIORAL_MATRIX.STRESS_SPIKE;
        dimension = "Emotional Safety";
      }

      this.bus.emit(PayoutEvents.XP_AWARDED, {
        userId,
        amount: xpAward.xp,
        dimension,
        reason: xpAward.reason,
        timestamp: Date.now()
      });

      this.bus.emit(PayoutEvents.PAYOUT_DENIED, { ...denied, xpEarned: xpAward.xp });
      return { ...denied, xpEarned: xpAward.xp, xpReason: xpAward.reason };
    }

    // 4. Bind identity via MCP
    const identityPayload = this.mcp.identity.bindIdentity(
      session.id,
      session.identity
    );

    // 5. Zero Trust enforcement
    const zeroTrust = this.mcp.zeroTrust.enforce(
      session.id,
      acoustic.riskScore,
      acoustic.flags
    );

    this.bus.emit(PayoutEvents.ZERO_TRUST_DECISION, zeroTrust);

    if (zeroTrust.action !== "ALLOW") {
      const denied = this.executor.deny(
        challenge.payoutId,
        zeroTrust.action
      );
      this.bus.emit(PayoutEvents.PAYOUT_DENIED, denied);
      return denied;
    }

    // 6. Execute payout
    const result = this.executor.execute(
      challenge.payoutId,
      amount || 0,
      currency || "USD"
    );

    const xpAward = XP_BEHAVIORAL_MATRIX.SUCCESSFUL_PAYOUT;
    this.bus.emit(PayoutEvents.XP_AWARDED, {
      userId,
      amount: xpAward.xp,
      dimension: "Financial Consistency",
      reason: xpAward.reason,
      timestamp: Date.now()
    });

    const executionWithXp = { ...result, xpEarned: xpAward.xp, xpReason: xpAward.reason };
    this.bus.emit(PayoutEvents.PAYOUT_EXECUTED, executionWithXp);

    // 7. Swarm directive
    this.mcp.swarm.emitDirective("ledger", "DIRECTIVE_OSMIUM_PERSIST");

    return executionWithXp;
  }
}
