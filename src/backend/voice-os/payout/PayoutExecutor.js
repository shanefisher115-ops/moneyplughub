export class PayoutExecutor {
    execute(payoutId, amount, currency) {
        return {
            payoutId,
            amount,
            currency,
            status: "SUCCESS",
            timestamp: Date.now()
        };
    }
    deny(payoutId, reason) {
        return {
            payoutId,
            status: "DENIED",
            reason,
            timestamp: Date.now()
        };
    }
}
