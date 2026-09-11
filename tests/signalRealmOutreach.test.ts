import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calibrateWealthTier, WEALTH_TIERS } from '../src/backend/routes/signalRealmOutreach';

describe('calibrateWealthTier', () => {
  it('should return TIER_6 for revenue "1b" or "billion" or employees > 2000', () => {
    assert.deepStrictEqual(calibrateWealthTier('1b arr', 500), WEALTH_TIERS.TIER_6);
    assert.deepStrictEqual(calibrateWealthTier('1 billion', 50), WEALTH_TIERS.TIER_6);
    assert.deepStrictEqual(calibrateWealthTier('100m', 2001), WEALTH_TIERS.TIER_6);
  });

  it('should return TIER_5 for revenue "250m" or "500m" or employees > 800', () => {
    assert.deepStrictEqual(calibrateWealthTier('250m arr', 500), WEALTH_TIERS.TIER_5);
    assert.deepStrictEqual(calibrateWealthTier('500m', 50), WEALTH_TIERS.TIER_5);
    assert.deepStrictEqual(calibrateWealthTier('100m', 801), WEALTH_TIERS.TIER_5);
  });

  it('should return TIER_4 for revenue "75m" or "100m" or employees > 300', () => {
    assert.deepStrictEqual(calibrateWealthTier('75m arr', 100), WEALTH_TIERS.TIER_4);
    assert.deepStrictEqual(calibrateWealthTier('100m', 50), WEALTH_TIERS.TIER_4);
    assert.deepStrictEqual(calibrateWealthTier('50m', 301), WEALTH_TIERS.TIER_4);
  });

  it('should return TIER_3 for revenue "25m" or "50m" or employees > 100', () => {
    assert.deepStrictEqual(calibrateWealthTier('25m arr', 50), WEALTH_TIERS.TIER_3);
    assert.deepStrictEqual(calibrateWealthTier('50m', 50), WEALTH_TIERS.TIER_3);
    assert.deepStrictEqual(calibrateWealthTier('10m', 101), WEALTH_TIERS.TIER_3);
  });

  it('should return TIER_2 for revenue "5m" or "10m" or employees > 30', () => {
    assert.deepStrictEqual(calibrateWealthTier('5m arr', 10), WEALTH_TIERS.TIER_2);
    assert.deepStrictEqual(calibrateWealthTier('10m', 10), WEALTH_TIERS.TIER_2);
    assert.deepStrictEqual(calibrateWealthTier('1m', 31), WEALTH_TIERS.TIER_2);
  });

  it('should return TIER_1 for all other cases', () => {
    assert.deepStrictEqual(calibrateWealthTier('1m arr', 10), WEALTH_TIERS.TIER_1);
    assert.deepStrictEqual(calibrateWealthTier('2m', 20), WEALTH_TIERS.TIER_1);
    assert.deepStrictEqual(calibrateWealthTier('unknown', 0), WEALTH_TIERS.TIER_1);
  });

  it('should be case-insensitive for revenue strings', () => {
    assert.deepStrictEqual(calibrateWealthTier('1B ARR', 500), WEALTH_TIERS.TIER_6);
    assert.deepStrictEqual(calibrateWealthTier('250M', 500), WEALTH_TIERS.TIER_5);
    assert.deepStrictEqual(calibrateWealthTier('75M', 100), WEALTH_TIERS.TIER_4);
    assert.deepStrictEqual(calibrateWealthTier('25M', 50), WEALTH_TIERS.TIER_3);
    assert.deepStrictEqual(calibrateWealthTier('5M', 10), WEALTH_TIERS.TIER_2);
  });
});
