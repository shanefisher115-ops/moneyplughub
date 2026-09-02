export class PayoutExecutor {
  execute(payoutId: string, amount: number, currency: string) {
    return {
      payoutId,
      amount,
      currency,
      status: "SUCCESS",
      timestamp: Date.now()
    };
  }

  deny(payoutId: string, reason: string) {
    return {
      payoutId,
      status: "DENIED",
      reason,
      timestamp: Date.now()
    };
  }
}
