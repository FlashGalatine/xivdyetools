/**
 * Tests for Quick Picks Service
 */
import { describe, it, expect } from 'vitest';
import { QUICK_PICKS, getQuickPickById } from './quick-picks.js';
import * as budgetCalc from './budget-calculator.js';

describe('quick-picks.ts', () => {
  describe('QUICK_PICKS', () => {
    it('should have 22 presets', () => {
      expect(QUICK_PICKS.length).toBe(22);
    });

    // 2026-08-29: `jet_black` carried 5763 and `pure_white` 5762 — Ul Brown's
    // and Bone White's item ids — so `/budget quick` built the ledger for the
    // wrong dye and nothing here noticed, because no test ever resolved an id.
    it('every preset id resolves to the dye it is named after', () => {
      const mismatches = QUICK_PICKS.map((preset) => {
        const dye = budgetCalc.resolveTargetDye(preset.targetDyeId);
        return dye?.name === preset.name
          ? null
          : `${preset.id}: ${preset.targetDyeId} → ${dye?.name ?? 'no dye'} (expected ${preset.name})`;
      }).filter((m): m is string => m !== null);
      expect(mismatches).toEqual([]);
    });

    // 2026-08-29: presets are keyed by stainID (the 5.0 value space), not by
    // the legacy item id — the two headline dyes are stain 102 / 101.
    it('keys every preset by stainID (1–254)', () => {
      for (const preset of QUICK_PICKS) {
        expect(preset.targetDyeId).toBeGreaterThanOrEqual(1);
        expect(preset.targetDyeId).toBeLessThanOrEqual(254);
      }
      expect(getQuickPickById('jet_black')?.targetDyeId).toBe(102);
      expect(getQuickPickById('pure_white')?.targetDyeId).toBe(101);
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
      QUICK_PICKS.forEach((pick) => {
        const preset = getQuickPickById(pick.id);
        expect(preset).toBeDefined();
        expect(preset?.id).toBe(pick.id);
      });
    });
  });
});
