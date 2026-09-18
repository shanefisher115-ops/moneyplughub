import assert from 'assert';
import test, { describe, it } from 'node:test';
import { PayoutExecutor } from '../src/backend/voice-os/payout/PayoutExecutor';

describe('PayoutExecutor Tests', () => {
  const executor = new PayoutExecutor();

  it('Successful payout execution', () => {
    const successResult = executor.execute('payout_123', 100, 'USD');
    assert.strictEqual(successResult.payoutId, 'payout_123');
    assert.strictEqual(successResult.amount, 100);
    assert.strictEqual(successResult.currency, 'USD');
    assert.strictEqual(successResult.status, 'SUCCESS');
    assert.ok(successResult.timestamp > 0);
  });

  it('Denied payout execution', () => {
    const deniedResult = executor.deny('payout_456', 'Insufficient funds');
    assert.strictEqual(deniedResult.payoutId, 'payout_456');
    assert.strictEqual(deniedResult.status, 'DENIED');
    assert.strictEqual(deniedResult.reason, 'Insufficient funds');
    assert.ok(deniedResult.timestamp > 0);
  });
});
