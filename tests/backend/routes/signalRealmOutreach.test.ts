import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveSpintax } from '../../../src/backend/routes/signalRealmOutreach';

describe('resolveSpintax', () => {
  it('should return the original string if no spintax is present', () => {
    const input = 'Hello World';
    const result = resolveSpintax(input);
    assert.strictEqual(result, 'Hello World');
  });

  it('should handle a single choice in spintax', () => {
    const input = '{Hello}';
    const result = resolveSpintax(input);
    assert.strictEqual(result, 'Hello');
  });

  it('should randomly select from multiple choices', () => {
    const input = '{Hello|Hi|Greetings}';
    // We should test multiple times or just assert it's one of the options
    const result = resolveSpintax(input);
    assert.ok(['Hello', 'Hi', 'Greetings'].includes(result));
  });

  it('should handle multiple spintax blocks in a single string', () => {
    const input = '{Hello|Hi} {World|Universe}';
    const result = resolveSpintax(input);
    const parts = result.split(' ');
    assert.strictEqual(parts.length, 2);
    assert.ok(['Hello', 'Hi'].includes(parts[0]));
    assert.ok(['World', 'Universe'].includes(parts[1]));
  });

  it('should handle empty choices', () => {
    const input = '{||}';
    const result = resolveSpintax(input);
    assert.strictEqual(result, '');
  });

  it('should handle an empty string', () => {
    const input = '';
    const result = resolveSpintax(input);
    assert.strictEqual(result, '');
  });

  it('should return the bracketed choice for string with brackets but no pipe separator', () => {
    const input = '{JustOneChoice}';
    const result = resolveSpintax(input);
    assert.strictEqual(result, 'JustOneChoice');
  });

  it('should correctly process adjacent spintax blocks', () => {
    const input = '{A|B}{C|D}';
    const result = resolveSpintax(input);
    assert.strictEqual(result.length, 2);
    assert.ok(['A', 'B'].includes(result[0]));
    assert.ok(['C', 'D'].includes(result[1]));
  });
});
