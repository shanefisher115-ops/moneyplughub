import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWealthPulse,
  getVaultTierFromXP,
  getSigilGlowLevel,
  getAscensionTier,
  computeConstellationEnergy,
  vaultTiers,
  ascensionTiers,
} from '../../src/backend/engine/wealthPulse';

describe('wealthPulse Engine', () => {
  describe('computeWealthPulse', () => {
    it('should correctly calculate wealth pulse with standard positive inputs', () => {
      // (100 * 1.5) + (500 * 0.8) = 150 + 400 = 550
      const pulse = computeWealthPulse({
        arrVelocity: 100,
        streakMultiplier: 1.5,
        xp: 500,
        vaultStability: 0.8,
      });
      assert.strictEqual(pulse, 550);
    });

    it('should round wealth pulse to two decimal places', () => {
      // (12.345 * 1.25) + (100 * 0.3333) = 15.43125 + 33.33 = 48.76125 -> 48.76
      const pulse = computeWealthPulse({
        arrVelocity: 12.345,
        streakMultiplier: 1.25,
        xp: 100,
        vaultStability: 0.3333,
      });
      assert.strictEqual(pulse, 48.76);
    });

    it('should return 0 when all inputs are 0', () => {
      const pulse = computeWealthPulse({
        arrVelocity: 0,
        streakMultiplier: 0,
        xp: 0,
        vaultStability: 0,
      });
      assert.strictEqual(pulse, 0);
    });

    it('should handle negative values correctly if inputs are negative', () => {
      // (-100 * 1.5) + (200 * 0.5) = -150 + 100 = -50
      const pulse = computeWealthPulse({
        arrVelocity: -100,
        streakMultiplier: 1.5,
        xp: 200,
        vaultStability: 0.5,
      });
      assert.strictEqual(pulse, -50);
    });
  });

  describe('getVaultTierFromXP', () => {
    it('should return Novice (tier 1) for 0 XP', () => {
      const tier = getVaultTierFromXP(0);
      assert.strictEqual(tier.tier, 1);
      assert.strictEqual(tier.name, 'Novice');
      assert.strictEqual(tier.shader, 'obsidian_slate');
    });

    it('should return Novice (tier 1) for XP just below Tier 2 threshold (999 XP)', () => {
      const tier = getVaultTierFromXP(999);
      assert.strictEqual(tier.tier, 1);
      assert.strictEqual(tier.name, 'Novice');
    });

    it('should return Active Plug (tier 2) at exact threshold (1000 XP)', () => {
      const tier = getVaultTierFromXP(1000);
      assert.strictEqual(tier.tier, 2);
      assert.strictEqual(tier.name, 'Active Plug');
      assert.strictEqual(tier.shader, 'emerald_grid');
    });

    it('should return Wealth Builder (tier 3) at exact threshold (3000 XP)', () => {
      const tier = getVaultTierFromXP(3000);
      assert.strictEqual(tier.tier, 3);
      assert.strictEqual(tier.name, 'Wealth Builder');
      assert.strictEqual(tier.shader, 'amethyst_nebula');
    });

    it('should return Diamond Stacker (tier 4) at exact threshold (7000 XP)', () => {
      const tier = getVaultTierFromXP(7000);
      assert.strictEqual(tier.tier, 4);
      assert.strictEqual(tier.name, 'Diamond Stacker');
      assert.strictEqual(tier.shader, 'prismatic_core');
    });

    it('should return Cosmic Sovereign (tier 5) at exact threshold (15000 XP)', () => {
      const tier = getVaultTierFromXP(15000);
      assert.strictEqual(tier.tier, 5);
      assert.strictEqual(tier.name, 'Cosmic Sovereign');
      assert.strictEqual(tier.shader, 'supernova_singularity');
    });

    it('should return Cosmic Sovereign (tier 5) for XP far exceeding max threshold', () => {
      const tier = getVaultTierFromXP(1000000);
      assert.strictEqual(tier.tier, 5);
      assert.strictEqual(tier.name, 'Cosmic Sovereign');
    });

    it('should return Novice (tier 1) for negative XP values', () => {
      const tier = getVaultTierFromXP(-500);
      assert.strictEqual(tier.tier, 1);
      assert.strictEqual(tier.name, 'Novice');
    });
  });

  describe('getSigilGlowLevel', () => {
    it('should return "subtle" for pulse < 500', () => {
      assert.strictEqual(getSigilGlowLevel(0), 'subtle');
      assert.strictEqual(getSigilGlowLevel(499.99), 'subtle');
    });

    it('should return "normal" for pulse >= 500 and < 1500', () => {
      assert.strictEqual(getSigilGlowLevel(500), 'normal');
      assert.strictEqual(getSigilGlowLevel(1000), 'normal');
      assert.strictEqual(getSigilGlowLevel(1499.99), 'normal');
    });

    it('should return "supernova" for pulse >= 1500', () => {
      assert.strictEqual(getSigilGlowLevel(1500), 'supernova');
      assert.strictEqual(getSigilGlowLevel(5000), 'supernova');
    });
  });

  describe('getAscensionTier', () => {
    it('should return Novice Plug (level 1) for 0 XP', () => {
      const tier = getAscensionTier(0);
      assert.strictEqual(tier.level, 1);
      assert.strictEqual(tier.name, 'Novice Plug');
    });

    it('should return Novice Plug (level 1) for XP just below Level 2 (999 XP)', () => {
      const tier = getAscensionTier(999);
      assert.strictEqual(tier.level, 1);
    });

    it('should return Active Plug (level 2) for 1000 XP', () => {
      const tier = getAscensionTier(1000);
      assert.strictEqual(tier.level, 2);
      assert.strictEqual(tier.name, 'Active Plug');
    });

    it('should return Wealth Builder (level 3) for 3000 XP', () => {
      const tier = getAscensionTier(3000);
      assert.strictEqual(tier.level, 3);
      assert.strictEqual(tier.name, 'Wealth Builder');
    });

    it('should return Grand Money Plug (level 4) for 7000 XP', () => {
      const tier = getAscensionTier(7000);
      assert.strictEqual(tier.level, 4);
      assert.strictEqual(tier.name, 'Grand Money Plug');
    });

    it('should return Cosmic Sovereign (level 5) for 15000 XP', () => {
      const tier = getAscensionTier(15000);
      assert.strictEqual(tier.level, 5);
      assert.strictEqual(tier.name, 'Cosmic Sovereign');
    });

    it('should handle negative XP gracefully by falling back to level 1', () => {
      const tier = getAscensionTier(-100);
      assert.strictEqual(tier.level, 1);
    });
  });

  describe('computeConstellationEnergy', () => {
    it('should calculate constellation energy correctly for standard positive values', () => {
      // activeStars = 5, arr = 99 -> log10(100) = 2 -> 5 * 2 = 10
      const energy = computeConstellationEnergy({
        activeStars: 5,
        arr: 99,
      });
      assert.strictEqual(energy, 10);
    });

    it('should return 0 when activeStars is 0', () => {
      const energy = computeConstellationEnergy({
        activeStars: 0,
        arr: 1000,
      });
      assert.strictEqual(energy, 0);
    });

    it('should return 0 when arr is 0', () => {
      // log10(0 + 1) = log10(1) = 0 -> 10 * 0 = 0
      const energy = computeConstellationEnergy({
        activeStars: 10,
        arr: 0,
      });
      assert.strictEqual(energy, 0);
    });

    it('should clamp negative ARR values to 0', () => {
      // log10(max(0, -500) + 1) = log10(1) = 0
      const energy = computeConstellationEnergy({
        activeStars: 10,
        arr: -500,
      });
      assert.strictEqual(energy, 0);
    });

    it('should round constellation energy to two decimal places', () => {
      // activeStars = 3, arr = 500 -> log10(501) approx 2.6998 -> 3 * 2.6998377 = 8.0995... -> 8.1
      const energy = computeConstellationEnergy({
        activeStars: 3,
        arr: 500,
      });
      assert.strictEqual(energy, 8.1);
    });
  });
});
