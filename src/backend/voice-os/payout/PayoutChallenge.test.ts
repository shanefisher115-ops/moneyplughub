import assert from 'assert';
import { describe, it } from 'node:test';
import { PayoutChallenge } from './PayoutChallenge';

describe('PayoutChallenge', () => {
  it('should return the expected shape and properly formatted values on issue()', () => {
    const challenge = new PayoutChallenge();
    const now = Date.now();
    const result = challenge.issue(150, 'USD');

    // Verify basic shape
    assert.strictEqual(typeof result.payoutId, 'string', 'payoutId should be a string');
    assert.strictEqual(result.payoutId.length, 36, 'payoutId should be a UUID of length 36');
    assert.strictEqual(result.amount, 150, 'amount should match input');
    assert.strictEqual(result.currency, 'USD', 'currency should match input');

    // Verify challenge phrase formatting
    assert.strictEqual(typeof result.challengePhrase, 'string', 'challengePhrase should be a string');
    assert.match(
      result.challengePhrase,
      /^AUTHORIZE-PLUG-\d{3}$/,
      'challengePhrase should match AUTHORIZE-PLUG-XXX'
    );

    // Verify issuedAt timestamp
    assert.strictEqual(typeof result.issuedAt, 'number', 'issuedAt should be a number');
    assert.ok(result.issuedAt >= now, 'issuedAt should be greater than or equal to start time');
    assert.ok(result.issuedAt <= Date.now(), 'issuedAt should be less than or equal to current time');
  });
});
