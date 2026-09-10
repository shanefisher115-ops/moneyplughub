import assert from 'assert';
import { PayoutValidator } from './voice-os/payout/PayoutValidator';

async function runPayoutValidatorTests() {
  console.log('🧪 Running PayoutValidator Tests...\n');

  const validator = new PayoutValidator();

  // Test 1: validateAcoustics - Valid acoustics
  console.log('Test 1: validateAcoustics - Valid acoustics');
  const validAcoustics = validator.validateAcoustics({
    jitter: 0.1,
    tremor: 0.1,
    stress: 0.1,
    deepfakeProbability: 0.1,
  });
  assert.strictEqual(validAcoustics.ok, true, 'Valid acoustics should return ok: true');

  // Test 2: validateAcoustics - Deepfake detection
  console.log('Test 2: validateAcoustics - Deepfake detection');
  const deepfakeAcoustics = validator.validateAcoustics({
    deepfakeProbability: 0.5,
  });
  assert.strictEqual(deepfakeAcoustics.ok, false, 'High deepfake probability should return ok: false');
  assert.strictEqual((deepfakeAcoustics as any).reason, 'DEEPFAKE', 'Reason should be DEEPFAKE');

  // Test 3: validateAcoustics - Stress spike detection
  console.log('Test 3: validateAcoustics - Stress spike detection');
  const stressAcoustics = validator.validateAcoustics({
    stress: 0.9,
  });
  assert.strictEqual(stressAcoustics.ok, false, 'High stress should return ok: false');
  assert.strictEqual((stressAcoustics as any).reason, 'STRESS_SPIKE', 'Reason should be STRESS_SPIKE');

  // Test 4: validateAcoustics - Jitter high detection
  console.log('Test 4: validateAcoustics - Jitter high detection');
  const jitterAcoustics = validator.validateAcoustics({
    jitter: 0.8,
  });
  assert.strictEqual(jitterAcoustics.ok, false, 'High jitter should return ok: false');
  assert.strictEqual((jitterAcoustics as any).reason, 'JITTER_HIGH', 'Reason should be JITTER_HIGH');

  // Test 5: validateAcoustics - Empty / Default values
  console.log('Test 5: validateAcoustics - Empty / Default values');
  const emptyAcoustics = validator.validateAcoustics({});
  assert.strictEqual(emptyAcoustics.ok, true, 'Empty acoustics should default to valid values and return ok: true');

  // Test 6: validatePhrase - Exact match
  console.log('Test 6: validatePhrase - Exact match');
  assert.strictEqual(validator.validatePhrase('hello world', 'hello world'), true, 'Exact match should return true');

  // Test 7: validatePhrase - Case insensitive match
  console.log('Test 7: validatePhrase - Case insensitive match');
  assert.strictEqual(validator.validatePhrase('Hello World', 'hello world'), true, 'Case insensitive match should return true');

  // Test 8: validatePhrase - Whitespace insensitive match
  console.log('Test 8: validatePhrase - Whitespace insensitive match');
  assert.strictEqual(validator.validatePhrase('  hello world  ', 'hello world'), true, 'Whitespace insensitive match should return true');

  // Test 9: validatePhrase - Mismatch
  console.log('Test 9: validatePhrase - Mismatch');
  assert.strictEqual(validator.validatePhrase('hello world', 'goodbye world'), false, 'Mismatch should return false');

  console.log('\n🎉 ALL PAYOUT VALIDATOR TESTS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
}

runPayoutValidatorTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
