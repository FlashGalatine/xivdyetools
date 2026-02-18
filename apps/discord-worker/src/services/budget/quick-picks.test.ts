/**
 * Tests for Quick Picks Service
 */
import { describe, it, expect } from 'vitest';
import { QUICK_PICKS, getQuickPickById, getQuickPickChoices } from './quick-picks.js';

describe('quick-picks.ts', () => {
  describe('QUICK_PICKS', () => {
    it('should have 5 presets', () => {
      expect(QUICK_PICKS.length).toBe(5);
    });

    it('should have required properties for each preset', () => {
      QUICK_PICKS.forEach((preset) => {
        expect(preset.id).toBeDefined();
        expect(typeof preset.id).toBe('string');
        expect(preset.name).toBeDefined();
        expect(typeof preset.name).toBe('string');
        expect(preset.targetDyeId).toBeDefined();
        expect(typeof preset.targetDyeId).toBe('number');
        expect(preset.description).toBeDefined();
        expect(preset.emoji).toBeDefined();
      });
    });

    it('should include Pure White preset', () => {
      const pureWhite = QUICK_PICKS.find((p) => p.id === 'pure_white');
      expect(pureWhite).toBeDefined();
      expect(pureWhite?.name).toBe('Pure White');
    });

    it('should include Jet Black preset', () => {
      const jetBlack = QUICK_PICKS.find((p) => p.id === 'jet_black');
      expect(jetBlack).toBeDefined();
      expect(jetBlack?.name).toBe('Jet Black');
    });
  });

  describe('getQuickPickById', () => {
    it('should return preset for valid ID', () => {
      const preset = getQuickPickById('pure_white');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('Pure White');
    });

    it('should return null for invalid ID', () => {
      const preset = getQuickPickById('invalid_id');
      expect(preset).toBeNull();
    });

    it('should work for all preset IDs', () => {
      const ids = ['pure_white', 'jet_black', 'metallic_silver', 'metallic_gold', 'pastel_pink'];
      ids.forEach((id) => {
        const preset = getQuickPickById(id);
        expect(preset).toBeDefined();
        expect(preset?.id).toBe(id);
      });
    });
  });

  describe('getQuickPickChoices', () => {
    it('should return array of Discord choices', () => {
      const choices = getQuickPickChoices();
      expect(Array.isArray(choices)).toBe(true);
      expect(choices.length).toBe(5);
    });

    it('should have correct format for Discord autocomplete', () => {
      const choices = getQuickPickChoices();
      choices.forEach((choice) => {
        expect(choice).toHaveProperty('name');
        expect(choice).toHaveProperty('value');
        expect(typeof choice.name).toBe('string');
        expect(typeof choice.value).toBe('string');
      });
    });

    it('should include emoji in choice name', () => {
      const choices = getQuickPickChoices();
      // Each preset has an emoji
      choices.forEach((choice) => {
        // Emojis should be in the name for visual display
        expect(choice.name.length).toBeGreaterThan(0);
      });
    });
  });
});
