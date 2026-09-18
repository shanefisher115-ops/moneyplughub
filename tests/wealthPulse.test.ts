import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWealthPulse,
  getVaultTierFromXP,
  vaultTiers,
  getSigilGlowLevel,
  getAscensionTier,
  ascensionTiers,
  computeConstellationEnergy
} from '../src/backend/engine/wealthPulse';

describe('Wealth Pulse Engine - src/backend/engine/wealthPulse.ts', () => {
  describe('computeWealthPulse', () => {
    it('should calculate pulse correctly and round to 2 decimal places', () => {
      // (100 * 1.5) + (500 * 0.8) = 150 + 400 = 550
      const pulse = computeWealthPulse({
        arrVelocity: 100,
        streakMultiplier: 1.5,
        xp: 500,
        vaultStability: 0.8
      });
      assert.equal(pulse, 550);
    });

    it('should handle floating point rounding correctly', () => {
      // (10.333 * 1.333) + (100 * 0.1) = 13.773889 + 10 = 23.773889 -> 23.77
      const pulse = computeWealthPulse({
        arrVelocity: 10.333,
        streakMultiplier: 1.333,
        xp: 100,
        vaultStability: 0.1
      });
      assert.equal(pulse, 23.77);
    });

    it('should handle zero inputs', () => {
      const pulse = computeWealthPulse({
        arrVelocity: 0,
        streakMultiplier: 0,
        xp: 0,
        vaultStability: 0
      });
      assert.equal(pulse, 0);
    });
  });

  describe('getSigilGlowLevel', () => {
    it('should return subtle for pulse < 500', () => {
      assert.equal(getSigilGlowLevel(-10), 'subtle');
      assert.equal(getSigilGlowLevel(0), 'subtle');
      assert.equal(getSigilGlowLevel(499), 'subtle');
      assert.equal(getSigilGlowLevel(499.99), 'subtle');
    });

    it('should return normal for 500 <= pulse < 1500', () => {
      assert.equal(getSigilGlowLevel(500), 'normal');
      assert.equal(getSigilGlowLevel(1000), 'normal');
      assert.equal(getSigilGlowLevel(1499), 'normal');
      assert.equal(getSigilGlowLevel(1499.99), 'normal');
    });

    it('should return supernova for pulse >= 1500', () => {
      assert.equal(getSigilGlowLevel(1500), 'supernova');
      assert.equal(getSigilGlowLevel(5000), 'supernova');
    });
  });

  describe('getVaultTierFromXP', () => {
    it('should return Tier 1 (Novice) for XP below 1000 or negative', () => {
      assert.deepEqual(getVaultTierFromXP(-500), vaultTiers[0]);
      assert.deepEqual(getVaultTierFromXP(0), vaultTiers[0]);
      assert.deepEqual(getVaultTierFromXP(999), vaultTiers[0]);
    });

    it('should return Tier 2 (Active Plug) for XP 1000-2999', () => {
      assert.deepEqual(getVaultTierFromXP(1000), vaultTiers[1]);
      assert.deepEqual(getVaultTierFromXP(2999), vaultTiers[1]);
    });

    it('should return Tier 3 (Wealth Builder) for XP 3000-6999', () => {
      assert.deepEqual(getVaultTierFromXP(3000), vaultTiers[2]);
      assert.deepEqual(getVaultTierFromXP(6999), vaultTiers[2]);
    });

    it('should return Tier 4 (Diamond Stacker) for XP 7000-14999', () => {
      assert.deepEqual(getVaultTierFromXP(7000), vaultTiers[3]);
      assert.deepEqual(getVaultTierFromXP(14999), vaultTiers[3]);
    });

    it('should return Tier 5 (Cosmic Sovereign) for XP >= 15000', () => {
      assert.deepEqual(getVaultTierFromXP(15000), vaultTiers[4]);
      assert.deepEqual(getVaultTierFromXP(100000), vaultTiers[4]);
    });
  });

  describe('getAscensionTier', () => {
    it('should return level 1 for XP < 1000 or negative', () => {
      assert.deepEqual(getAscensionTier(-10), ascensionTiers[0]);
      assert.deepEqual(getAscensionTier(0), ascensionTiers[0]);
      assert.deepEqual(getAscensionTier(999), ascensionTiers[0]);
    });

    it('should return correct ascension tier boundaries', () => {
      assert.deepEqual(getAscensionTier(1000), ascensionTiers[1]);
      assert.deepEqual(getAscensionTier(3000), ascensionTiers[2]);
      assert.deepEqual(getAscensionTier(7000), ascensionTiers[3]);
      assert.deepEqual(getAscensionTier(15000), ascensionTiers[4]);
      assert.deepEqual(getAscensionTier(50000), ascensionTiers[4]);
    });
  });

  describe('computeConstellationEnergy', () => {
    it('should calculate constellation energy correctly and round to 2 decimal places', () => {
      // 5 * log10(99 + 1) = 5 * log10(100) = 5 * 2 = 10
      const energy = computeConstellationEnergy({ activeStars: 5, arr: 99 });
      assert.equal(energy, 10);
    });

    it('should return 0 when activeStars is 0', () => {
      const energy = computeConstellationEnergy({ activeStars: 0, arr: 10000 });
      assert.equal(energy, 0);
    });

    it('should handle negative ARR safely by using Math.max(0, arr)', () => {
      // 10 * log10(0 + 1) = 0
      const energy = computeConstellationEnergy({ activeStars: 10, arr: -500 });
      assert.equal(energy, 0);
    });
  });
});
