import { describe, it, expect } from 'vitest';
import { serializeDye, serializeDyeWithDistance } from '../../src/lib/dye-serializer.js';
import { createMockDye } from '@xivdyetools/test-utils';
import { dyeDatabase, DyeService } from '@xivdyetools/core';

describe('serializeDye', () => {
  it('includes all public Dye fields', () => {
    const dye = createMockDye({ itemID: 5729, name: 'Snow White' });
    const result = serializeDye(dye);

    expect(result.itemID).toBe(5729);
    expect(result.name).toBe('Snow White');
    expect(result.hex).toBeDefined();
    expect(result.rgb).toBeDefined();
    expect(result.hsv).toBeDefined();
    expect(result.category).toBeDefined();
    expect(result.acquisition).toBeDefined();
    expect(result.cost).toBeDefined();
  });

  it('includes marketItemID', () => {
    const dye = createMockDye({ itemID: 5729, consolidationType: null });
    const result = serializeDye(dye);
    // Pre-consolidation, marketItemID equals itemID
    expect(result.marketItemID).toBe(5729);
  });

  it('strips internal fields', () => {
    const dye = createMockDye() as unknown as Record<string, unknown>;
    // Manually add internal fields that DyeDatabase would have
    dye.nameLower = 'snow white';
    dye.categoryLower = 'neutral';
    dye.lab = { l: 50, a: 0, b: 0 };

    const result = serializeDye(dye as any) as unknown as Record<string, unknown>;
    expect(result.nameLower).toBeUndefined();
    expect(result.categoryLower).toBeUndefined();
    expect(result.lab).toBeUndefined();
  });

  it('includes localizedName when provided', () => {
    const dye = createMockDye();
    const result = serializeDye(dye, 'スノウホワイト');
    expect(result.localizedName).toBe('スノウホワイト');
  });

  it('omits localizedName when not provided', () => {
    const dye = createMockDye();
    const result = serializeDye(dye);
    expect(result.localizedName).toBeUndefined();
  });

  it('handles Facewear dyes with negative IDs', () => {
    const dye = createMockDye({ itemID: -1, category: 'Facewear', consolidationType: null });
    const result = serializeDye(dye);
    expect(result.itemID).toBe(-1);
    expect(result.marketItemID).toBe(-1);
  });
});

/**
 * BUG-036: the boolean/enum fields above (isMetallic, isPastel, isDark,
 * isCosmic, isIshgardian, consolidationType) were only ever asserted with
 * `.toBeDefined()`, which passes no matter which value — including the wrong
 * one — they hold. A field swap (e.g. isPastel and isDark transposed) or a
 * mislabeled consolidationType would not fail any existing test.
 *
 * These three literal-object snapshots use real dyes from
 * `packages/core/src/data/dyes.json`, loaded through the same
 * `DyeService(dyeDatabase)` real callers use (not `createMockDye`, whose
 * flags are whatever the test passes in and so cannot catch a serializer
 * regression), one per case the brief calls out: a metallic dye, a pastel
 * dye, and a Patch 7.5 consolidation Type-C dye. Every field `serializeDye`
 * emits is spelled out — `toStrictEqual` rather than `toEqual` because the
 * dye carries no `localizedName` argument here, so that key is genuinely
 * absent from the result (not present with value `undefined`) and
 * `toStrictEqual` is the assertion that would also catch it coming back as
 * an explicit `undefined`.
 */
describe('serializeDye — literal snapshots (BUG-036)', () => {
  const allDyes = new DyeService(dyeDatabase).getAllDyes();

  function realDye(name: string) {
    const dye = allDyes.find((d) => d.name === name);
    if (!dye) throw new Error(`Fixture dye "${name}" not found in dyes.json`);
    return dye;
  }

  it('serializes a metallic dye (Metallic Silver, stainID 112)', () => {
    const result = serializeDye(realDye('Metallic Silver'));

    expect(result).toStrictEqual({
      itemID: 13116,
      stainID: 112,
      id: 13116,
      name: 'Metallic Silver',
      hex: '#a7a7a7',
      rgb: { r: 167, g: 167, b: 167 },
      hsv: { h: 0, s: 0, v: 65.49 },
      category: 'Special',
      acquisition: 'Venture Coffers',
      cost: 1,
      currency: 'Venture Coffer',
      isMetallic: true,
      isPastel: false,
      isDark: false,
      isCosmic: false,
      isIshgardian: false,
      consolidationType: null,
      marketItemID: 13116,
    });
  });

  it('serializes a pastel dye (Pastel Pink, stainID 103)', () => {
    const result = serializeDye(realDye('Pastel Pink'));

    expect(result).toStrictEqual({
      itemID: 13708,
      stainID: 103,
      id: 13708,
      name: 'Pastel Pink',
      hex: '#fdc8c6',
      rgb: { r: 253, g: 200, b: 198 },
      hsv: { h: 2.18, s: 21.74, v: 99.22 },
      category: 'Special',
      acquisition: 'Venture Coffers',
      cost: 1,
      currency: 'Venture Coffer',
      isMetallic: false,
      isPastel: true,
      isDark: false,
      isCosmic: false,
      isIshgardian: false,
      consolidationType: null,
      marketItemID: 13708,
    });
  });

  it('serializes a consolidation Type-C dye (Carmine Red, stainID 95)', () => {
    const result = serializeDye(realDye('Carmine Red'));

    expect(result).toStrictEqual({
      itemID: 48227,
      stainID: 95,
      id: 48227,
      name: 'Carmine Red',
      hex: '#e50b18',
      rgb: { r: 229, g: 11, b: 24 },
      hsv: { h: 356.42, s: 95.2, v: 89.8 },
      category: 'Reds',
      acquisition: 'Cosmic Exploration',
      cost: 600,
      currency: 'Cosmocredits',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: true,
      isIshgardian: false,
      consolidationType: 'C',
      // Patch 7.5: Type-C dyes' market itemID is the consolidated
      // Wide Spectrum #2 Dye (52256, CONSOLIDATED_IDS.C), not the dye's own
      // legacyItemID (48227) — the field a mislabeled Type would corrupt.
      marketItemID: 52256,
    });
  });
});

describe('serializeDyeWithDistance', () => {
  it('includes dye and distance', () => {
    const dye = createMockDye();
    const result = serializeDyeWithDistance(dye, 12.3456789);
    expect(result.dye).toBeDefined();
    expect(result.distance).toBe(12.3457); // Rounded to 4 decimal places
  });
});
