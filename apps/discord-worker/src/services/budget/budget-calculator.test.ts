/**
 * Tests for Budget Calculator Service
 */
import { describe, it, expect } from 'vitest';
import { dyeService, initializeLocale } from '@xivdyetools/bot-logic';
import { getDyeById, getDyeByName, getDyeAutocomplete } from './budget-calculator.js';
import * as budgetCalc from './budget-calculator.js';

describe('budget-calculator.ts', () => {
  describe('getDyeById', () => {
    it('should return dye for valid ID', () => {
      // Get any dye first to test with a known valid ID
      const allDyes = dyeService.getAllDyes();
      expect(allDyes.length).toBeGreaterThan(0);

      const testDye = allDyes[0];
      const dye = getDyeById(testDye.itemID);
      expect(dye).toBeDefined();
      expect(dye?.itemID).toBe(testDye.itemID);
    });

    it('should return null for invalid ID', () => {
      const dye = getDyeById(999999);
      expect(dye).toBeNull();
    });
  });

  describe('getDyeByName', () => {
    it('should return dye for exact name match', () => {
      // Get any dye to test with a known name
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const dye = getDyeByName(testDye.name);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe(testDye.name);
    });

    it('should be case-insensitive', () => {
      const allDyes = dyeService.getAllDyes();
      const testDye = allDyes[0];

      const dye = getDyeByName(testDye.name.toLowerCase());
      expect(dye).toBeDefined();
      expect(dye?.name).toBe(testDye.name);
    });

    // BUG-032 (2026-07-18 audit) → schema v2 (2026-07-31): Facewear entries
    // no longer exist in the dye database at all (they moved to core's
    // facewearColors), so the negative-itemID hazard for Universalis price
    // batches is gone by construction.
    it('has no Facewear entries / negative itemIDs in the database (schema v2)', () => {
      expect(dyeService.getAllDyes().every((d) => d.itemID > 0)).toBe(true);

      const dye = getDyeByName('Silver'); // a Facewear color name
      expect(dye).toBeNull();
    });

    it('should return null for non-existent dye', () => {
      const dye = getDyeByName('Fake Dye Color That Does Not Exist 12345');
      expect(dye).toBeNull();
    });
  });

  describe('getDyeAutocomplete', () => {
    it('should return choices formatted for Discord', () => {
      const choices = getDyeAutocomplete('black');
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.length).toBeLessThanOrEqual(25); // Discord limit

      // Each choice should have name and value
      choices.forEach((choice) => {
        expect(choice).toHaveProperty('name');
        expect(choice).toHaveProperty('value');
        expect(typeof choice.name).toBe('string');
        expect(typeof choice.value).toBe('string');
      });
    });

    it('should return up to 25 choices', () => {
      const choices = getDyeAutocomplete(''); // Empty query returns all
      expect(choices.length).toBeLessThanOrEqual(25);
    });

    it('should match search query in results', () => {
      const choices = getDyeAutocomplete('red');
      expect(choices.length).toBeGreaterThan(0);
      // Each choice name should contain 'red' (case-insensitive)
      choices.forEach((choice) => {
        expect(choice.name.toLowerCase()).toContain('red');
      });
    });

    // 2026-08-29: 5.0 is stainID-first everywhere a user can see an id. The
    // option value used to be the legacy item id (Pure White showed up as
    // `target_dye: 13114` in the command echo); it is the stainID now.
    it('offers stainIDs as choice values, never legacy item ids', () => {
      const pureWhite = getDyeAutocomplete('pure white').find((c) => c.name.startsWith('Pure White'));
      expect(pureWhite?.value).toBe('101');
      for (const choice of getDyeAutocomplete('')) {
        const value = Number(choice.value);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(254);
      }
    });
  });

  // 2026-08-29: a typed or autocompleted number may be a stainID (1–254, the
  // 5.0 value space) or a legacy item id (≥ 5729, what 4.x clients and old
  // habits still send). The two ranges are disjoint, so both resolve.
  describe('resolveTargetDye', () => {
    it('resolves a stainID', () => {
      expect(budgetCalc.resolveTargetDye(101)?.name).toBe('Pure White');
    });

    it('still resolves a legacy item id', () => {
      expect(budgetCalc.resolveTargetDye(13114)?.name).toBe('Pure White');
      expect(budgetCalc.resolveTargetDye(5763)?.name).toBe('Ul Brown');
    });

    it('returns null for the gap between the two ranges and for unknown ids', () => {
      expect(budgetCalc.resolveTargetDye(999)).toBeNull();
      expect(budgetCalc.resolveTargetDye(0)).toBeNull();
      expect(budgetCalc.resolveTargetDye(-5)).toBeNull();
    });

    // 2026-08-20 i18n audit, F-02
    it('matches and labels in the user locale', async () => {
      await initializeLocale('ja');
      const choices = getDyeAutocomplete('スノウ', 25, 'ja');
      expect(choices.length).toBeGreaterThan(0);
      expect(choices[0].name).toMatch(/^スノウホワイト \(/); // localized name + localized category
      expect(choices[0].value).toMatch(/^\d+$/); // value stays the itemID
    });
  });

  describe('getDyeByName (localized)', () => {
    it('resolves an exact Japanese name when the locale is passed', async () => {
      await initializeLocale('ja');
      expect(getDyeByName('スノウホワイト', 'ja')?.name).toBe('Snow White');
      expect(getDyeByName('スノウホワイト')).toBeNull();
    });
  });
});
