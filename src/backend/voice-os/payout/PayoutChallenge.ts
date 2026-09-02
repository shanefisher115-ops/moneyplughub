import { randomUUID as uuid } from "crypto";

export class PayoutChallenge {
  issue(amount: number, currency: string) {
    const payoutId = uuid();

    const challengePhrase = `AUTHORIZE-PLUG-${Math.floor(
      Math.random() * 900 + 100
    )}`;

    return {
      payoutId,
      amount,
      currency,
      challengePhrase,
      issuedAt: Date.now()
    };
  }
}
