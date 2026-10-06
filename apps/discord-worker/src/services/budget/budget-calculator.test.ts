/**
 * Tests for Budget Calculator Service
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONSOLIDATED_IDS } from '@xivdyetools/core';
import { dyeService, initializeLocale } from '@xivdyetools/bot-logic';
import { getDyeById, getDyeByName, getDyeAutocomplete } from './budget-calculator.js';
import * as budgetCalc from './budget-calculator.js';
import { createMockEnv } from '../../test-utils.js';
import type { BudgetLedgerFindResult, DyePriceData } from '../../types/budget.js';

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

// REFACTOR-003 (2026-10-04 deep dive): the pixel cap spends the card's own
// geometry, read from @xivdyetools/svg, instead of a literal copy of it. A copy
// drifts silently — raise the ledger's row height and the calculator would
// still pack 40 px rows, the card would pass 350, and cardShell would clamp the
// footer and the mark off the canvas.
describe('ledger pixel budget follows the svg card geometry (REFACTOR-003)', () => {
  // Proves the refactor changed no packing. When the card's geometry moves on
  // purpose, update these numbers; the doMock tests below are the guard.
  it('is value-identical today to the literals it replaced (350 − 43 − 27, 24/40, 32/47)', () => {
    // One key line (ΔE2000's) and two (the method note under it), as before
    expect(budgetCalc.ledgerRowBudget(1)).toBe(350 - 43 - 27 - 32);
    expect(budgetCalc.ledgerRowBudget(2)).toBe(350 - 43 - 27 - 47);
    expect(budgetCalc.ledgerRowCost(true)).toBe(24 + 40);
    expect(budgetCalc.ledgerRowCost(false)).toBe(40);
  });

  it('sizes the footer as the card does: by its key lines, two at most, never by method', () => {
    // generateBudgetLedger draws a two-line footer for any keyLines.length > 1
    expect(budgetCalc.ledgerRowBudget(3)).toBe(budgetCalc.ledgerRowBudget(2));
    // Told nothing, it leaves room for the tallest footer the card draws
    expect(budgetCalc.ledgerRowBudget()).toBe(budgetCalc.ledgerRowBudget(2));
  });

  describe('when a constant moves in @xivdyetools/svg', () => {
    const jetBlack = getDyeByName('Jet Black')!;

    function price(itemId: number, gil: number): [number, DyePriceData] {
      return [
        itemId,
        {
          currentMinPrice: gil,
          world: 'Cactuar',
          listingCount: 5,
          fetchedAt: '2026-08-08T00:00:00.000Z',
        } as DyePriceData,
      ];
    }

    /**
     * A fresh calculator whose `@xivdyetools/svg` carries `geometry` over the
     * real exports, with the price fetch stubbed (Jet Black on the board, the
     * Standard Spectrum item above the vendor's 216).
     */
    async function loadCalculator(
      geometry: Record<string, number> = {},
    ): Promise<typeof budgetCalc> {
      vi.resetModules();
      vi.doMock('@xivdyetools/svg', async (importOriginal) => ({
        ...(await importOriginal<typeof import('@xivdyetools/svg')>()),
        ...geometry,
      }));
      vi.doMock('./price-cache.js', () => ({
        fetchWithCache: vi.fn(async () => ({
          prices: new Map([price(jetBlack.itemID, 71400), price(CONSOLIDATED_IDS.A!, 248)]),
          fromCache: 2,
          fromApi: 0,
          stale: false,
        })),
      }));
      return import('./budget-calculator.js');
    }

    const rowCount = (r: BudgetLedgerFindResult): number =>
      r.groups.reduce((n, g) => n + g.rows.length, 0);

    afterEach(() => {
      vi.doUnmock('@xivdyetools/svg');
      vi.doUnmock('./price-cache.js');
      vi.resetModules();
    });

    it('the budget and the row cost move with it', async () => {
      const calc = await loadCalculator({
        CARD_MAX_HEIGHT: 400,
        LEDGER_HEADER_H: 50,
        LEDGER_COLHEAD_H: 30,
        LEDGER_FOOTER_H: 20,
        LEDGER_FOOTER_2LINE_H: 60,
        LEDGER_GROUP_H: 30,
        LEDGER_ROW_H: 50,
      });

      expect(calc.ledgerRowBudget(1)).toBe(400 - 50 - 30 - 20);
      expect(calc.ledgerRowBudget(2)).toBe(400 - 50 - 30 - 60);
      expect(calc.ledgerRowCost(true)).toBe(30 + 50);
      expect(calc.ledgerRowCost(false)).toBe(50);
    });

    it('a taller ledger row packs fewer rows; the rest are omitted, not clipped', async () => {
      const env = createMockEnv();
      const real = await loadCalculator();
      const before = await real.findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {
        matchLine: 20,
        keyLineCount: 1,
      });
      const tall = await loadCalculator({ LEDGER_ROW_H: 200 });
      const after = await tall.findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {
        matchLine: 20,
        keyLineCount: 1,
      });

      expect(rowCount(before)).toBeGreaterThan(1);
      // 350 − 43 − 27 − 32 = 248: the first row pays 24 + 200, no second fits
      expect(rowCount(after)).toBe(1);
      expect(after.omitted).toHaveLength(before.omitted.length + rowCount(before) - 1);
    });

    it('the row cap is the frame R1 cap', async () => {
      const env = createMockEnv();
      const capped = await loadCalculator({ ROW_CAP: 2 });
      const result = await capped.findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {
        matchLine: 20,
      });

      expect(rowCount(result)).toBe(2);
    });

    // The footer is the key lines the /budget handler hands the card, so the
    // packer is told their count rather than guessing it from the method.
    describe('the footer it packs above is the key-line count it is handed', () => {
      // A two-line footer leaving room for one row: 350 − 43 − 27 − 200 = 80
      const TALL_NOTE = { LEDGER_FOOTER_2LINE_H: 200 };

      it.each(['ciede2000', 'rgb'] as const)('%s: one key line or two', async (method) => {
        const env = createMockEnv();
        const calc = await loadCalculator(TALL_NOTE);
        const rows = async (keyLineCount: number): Promise<number> =>
          rowCount(
            await calc.findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {
              method,
              matchLine: 20,
              keyLineCount,
            }),
          );

        expect(await rows(1)).toBeGreaterThan(1);
        expect(await rows(2)).toBe(1);
      });

      it('told nothing, leaves room for the tallest footer the card draws', async () => {
        const env = createMockEnv();
        const calc = await loadCalculator(TALL_NOTE);
        const result = await calc.findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {
          matchLine: 20,
        });

        expect(rowCount(result)).toBe(1);
      });
    });
  });
});
