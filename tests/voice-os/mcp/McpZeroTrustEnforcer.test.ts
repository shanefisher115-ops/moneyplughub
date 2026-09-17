import assert from 'assert';
import { describe, it } from 'node:test';
import { EventEmitter } from 'events';
import { McpZeroTrustEnforcer } from '../../../src/backend/voice-os/mcp/McpZeroTrustEnforcer';

describe('McpZeroTrustEnforcer', () => {
  it('should correctly evaluate risk based on score and flags', () => {
    const bus = new EventEmitter();
    const enforcer = new McpZeroTrustEnforcer(bus);

    // LOCK (score >= 90)
    assert.strictEqual(enforcer.evaluateRisk(90, []), 'LOCK');
    assert.strictEqual(enforcer.evaluateRisk(100, []), 'LOCK');

    // FREEZE (score >= 70 and < 90)
    assert.strictEqual(enforcer.evaluateRisk(70, []), 'FREEZE');
    assert.strictEqual(enforcer.evaluateRisk(89, []), 'FREEZE');

    // STEP_UP (flags.includes("DEEPFAKE") and score < 70)
    assert.strictEqual(enforcer.evaluateRisk(50, ['DEEPFAKE']), 'STEP_UP');
    assert.strictEqual(enforcer.evaluateRisk(10, ['DEEPFAKE']), 'STEP_UP');

    // ISOLATE (flags.includes("PANIC") and score < 70 and no DEEPFAKE flag)
    assert.strictEqual(enforcer.evaluateRisk(50, ['PANIC']), 'ISOLATE');
    assert.strictEqual(enforcer.evaluateRisk(0, ['PANIC']), 'ISOLATE');

    // ALLOW (score < 70 and no PANIC/DEEPFAKE flags)
    assert.strictEqual(enforcer.evaluateRisk(50, []), 'ALLOW');
    assert.strictEqual(enforcer.evaluateRisk(69, []), 'ALLOW');

    // Precedence testing
    assert.strictEqual(enforcer.evaluateRisk(95, ['DEEPFAKE']), 'LOCK');
    assert.strictEqual(enforcer.evaluateRisk(75, ['PANIC']), 'FREEZE');
    assert.strictEqual(enforcer.evaluateRisk(50, ['DEEPFAKE', 'PANIC']), 'STEP_UP');
  });

  it('should emit MCP_ZERO_TRUST event and return correct payload on enforce', () => {
    const bus = new EventEmitter();
    const enforcer = new McpZeroTrustEnforcer(bus);
    let emittedPayload: any = null;

    bus.on('MCP_ZERO_TRUST', (payload) => {
      emittedPayload = payload;
    });

    // LOCK payload (casbRemediation: true)
    const resultLock = enforcer.enforce('session1', 95, []);
    assert.deepStrictEqual(resultLock, {
      sessionId: 'session1',
      riskScore: 95,
      flags: [],
      action: 'LOCK',
      casbRemediation: true
    });
    assert.deepStrictEqual(emittedPayload, resultLock);

    // ALLOW payload (casbRemediation: false)
    emittedPayload = null;
    const resultAllow = enforcer.enforce('session2', 20, []);
    assert.deepStrictEqual(resultAllow, {
      sessionId: 'session2',
      riskScore: 20,
      flags: [],
      action: 'ALLOW',
      casbRemediation: false
    });
    assert.deepStrictEqual(emittedPayload, resultAllow);
  });
});
