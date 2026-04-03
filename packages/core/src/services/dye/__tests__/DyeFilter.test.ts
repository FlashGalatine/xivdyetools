import { describe, it, expect } from 'vitest';
import {
  isDyeExcluded,
  filterDyes,
  hasActiveFilters,
  EXPENSIVE_DYE_IDS,
  VENDOR_ACQUISITIONS,
  CRAFT_ACQUISITIONS,
  ALLIED_SOCIETY_ACQUISITIONS,
} from '../DyeFilter.js';
import type { Dye, DyeTypeFilters } from '@xivdyetools/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDye(overrides: Partial<Dye> = {}): Dye {
  return {
    id: 1,
    itemID: 10000,
    stainID: 1,
    name: 'Test Dye',
    hex: '#FF0000',
    rgb: { r: 255, g: 0, b: 0 },
    hsv: { h: 0, s: 100, v: 100 },
    category: 'Red',
    acquisition: 'Dye Vendor',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
    isIshgardian: false,
    consolidationType: null,
    ...overrides,
  };
}

const NO_FILTERS: DyeTypeFilters = {};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('DyeFilter constants', () => {
  it('EXPENSIVE_DYE_IDS contains Pure White and Jet Black', () => {
    expect(EXPENSIVE_DYE_IDS).toContain(13114);
    expect(EXPENSIVE_DYE_IDS).toContain(13115);
    expect(EXPENSIVE_DYE_IDS).toHaveLength(2);
  });

  it('VENDOR_ACQUISITIONS contains Dye Vendor', () => {
    expect(VENDOR_ACQUISITIONS).toContain('Dye Vendor');
  });

  it('CRAFT_ACQUISITIONS contains Crafting and Treasure Chest', () => {
    expect(CRAFT_ACQUISITIONS).toContain('Crafting');
    expect(CRAFT_ACQUISITIONS).toContain('Treasure Chest');
  });

  it('ALLIED_SOCIETY_ACQUISITIONS contains all 5 vendors', () => {
    expect(ALLIED_SOCIETY_ACQUISITIONS).toHaveLength(5);
    expect(ALLIED_SOCIETY_ACQUISITIONS).toContain("Amalj'aa Vendor");
    expect(ALLIED_SOCIETY_ACQUISITIONS).toContain('Ixali Vendor');
    expect(ALLIED_SOCIETY_ACQUISITIONS).toContain('Sahagin Vendor');
    expect(ALLIED_SOCIETY_ACQUISITIONS).toContain('Kobold Vendor');
    expect(ALLIED_SOCIETY_ACQUISITIONS).toContain('Sylphic Vendor');
  });
});

// ---------------------------------------------------------------------------
// isDyeExcluded
// ---------------------------------------------------------------------------

describe('isDyeExcluded', () => {
  it('returns false when no filters are set', () => {
    expect(isDyeExcluded(NO_FILTERS, makeDye())).toBe(false);
  });

  it('returns false when all filters are explicitly false', () => {
    const filters: DyeTypeFilters = {
      excludeMetallic: false,
      excludePastel: false,
      excludeDark: false,
      excludeCosmic: false,
      excludeIshgardian: false,
      excludeExpensive: false,
      excludeVendorDyes: false,
      excludeCraftDyes: false,
      excludeAlliedSocietyDyes: false,
    };
    expect(isDyeExcluded(filters, makeDye())).toBe(false);
  });

  // Type-based exclusions
  it('excludes metallic dyes', () => {
    const filters: DyeTypeFilters = { excludeMetallic: true };
    expect(isDyeExcluded(filters, makeDye({ isMetallic: true }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ isMetallic: false }))).toBe(false);
  });

  it('excludes pastel dyes', () => {
    const filters: DyeTypeFilters = { excludePastel: true };
    expect(isDyeExcluded(filters, makeDye({ isPastel: true }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ isPastel: false }))).toBe(false);
  });

  it('excludes dark dyes', () => {
    const filters: DyeTypeFilters = { excludeDark: true };
    expect(isDyeExcluded(filters, makeDye({ isDark: true }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ isDark: false }))).toBe(false);
  });

  it('excludes cosmic dyes', () => {
    const filters: DyeTypeFilters = { excludeCosmic: true };
    expect(isDyeExcluded(filters, makeDye({ isCosmic: true }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ isCosmic: false }))).toBe(false);
  });

  it('excludes ishgardian dyes', () => {
    const filters: DyeTypeFilters = { excludeIshgardian: true };
    expect(isDyeExcluded(filters, makeDye({ isIshgardian: true }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ isIshgardian: false }))).toBe(false);
  });

  it('excludes expensive dyes (Pure White / Jet Black)', () => {
    const filters: DyeTypeFilters = { excludeExpensive: true };
    expect(isDyeExcluded(filters, makeDye({ itemID: 13114 }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ itemID: 13115 }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ itemID: 10000 }))).toBe(false);
  });

  // Acquisition-based exclusions
  it('excludes vendor dyes', () => {
    const filters: DyeTypeFilters = { excludeVendorDyes: true };
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Dye Vendor' }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Crafting' }))).toBe(false);
  });

  it('excludes craft dyes', () => {
    const filters: DyeTypeFilters = { excludeCraftDyes: true };
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Crafting' }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Treasure Chest' }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Dye Vendor' }))).toBe(false);
  });

  it('excludes allied society dyes', () => {
    const filters: DyeTypeFilters = { excludeAlliedSocietyDyes: true };
    expect(isDyeExcluded(filters, makeDye({ acquisition: "Amalj'aa Vendor" }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Ixali Vendor' }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Sahagin Vendor' }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Kobold Vendor' }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Sylphic Vendor' }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ acquisition: 'Dye Vendor' }))).toBe(false);
  });

  it('applies multiple filters simultaneously', () => {
    const filters: DyeTypeFilters = { excludeMetallic: true, excludeDark: true };
    expect(isDyeExcluded(filters, makeDye({ isMetallic: true }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye({ isDark: true }))).toBe(true);
    expect(isDyeExcluded(filters, makeDye())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterDyes
// ---------------------------------------------------------------------------

describe('filterDyes', () => {
  const dyes = [
    makeDye({ id: 1, isMetallic: true, name: 'Metallic Red' }),
    makeDye({ id: 2, isPastel: true, name: 'Pastel Pink' }),
    makeDye({ id: 3, name: 'Rose Red' }),
    makeDye({ id: 4, isDark: true, name: 'Dark Red' }),
  ];

  it('returns all dyes when no filters are set', () => {
    expect(filterDyes(NO_FILTERS, dyes)).toHaveLength(4);
  });

  it('removes metallic dyes', () => {
    const result = filterDyes({ excludeMetallic: true }, dyes);
    expect(result).toHaveLength(3);
    expect(result.find((d) => d.id === 1)).toBeUndefined();
  });

  it('removes multiple categories at once', () => {
    const result = filterDyes({ excludeMetallic: true, excludeDark: true }, dyes);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual([2, 3]);
  });

  it('returns empty array when all dyes are filtered out', () => {
    const metallicDyes = [
      makeDye({ id: 1, isMetallic: true }),
      makeDye({ id: 2, isMetallic: true }),
    ];
    expect(filterDyes({ excludeMetallic: true }, metallicDyes)).toHaveLength(0);
  });

  it('preserves generic type', () => {
    interface DyeWithExtra extends Dye {
      extra: string;
    }
    const extended: DyeWithExtra[] = [
      { ...makeDye({ id: 1 }), extra: 'hello' },
      { ...makeDye({ id: 2, isMetallic: true }), extra: 'world' },
    ];
    const result = filterDyes({ excludeMetallic: true }, extended);
    expect(result).toHaveLength(1);
    expect(result[0].extra).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// hasActiveFilters
// ---------------------------------------------------------------------------

describe('hasActiveFilters', () => {
  it('returns false when empty object', () => {
    expect(hasActiveFilters({})).toBe(false);
  });

  it('returns false when all filters are false', () => {
    expect(hasActiveFilters({
      excludeMetallic: false,
      excludePastel: false,
      excludeDark: false,
    })).toBe(false);
  });

  it('returns true for each individual filter', () => {
    expect(hasActiveFilters({ excludeMetallic: true })).toBe(true);
    expect(hasActiveFilters({ excludePastel: true })).toBe(true);
    expect(hasActiveFilters({ excludeDark: true })).toBe(true);
    expect(hasActiveFilters({ excludeCosmic: true })).toBe(true);
    expect(hasActiveFilters({ excludeIshgardian: true })).toBe(true);
    expect(hasActiveFilters({ excludeExpensive: true })).toBe(true);
    expect(hasActiveFilters({ excludeVendorDyes: true })).toBe(true);
    expect(hasActiveFilters({ excludeCraftDyes: true })).toBe(true);
    expect(hasActiveFilters({ excludeAlliedSocietyDyes: true })).toBe(true);
  });

  it('returns true when mix of true and false', () => {
    expect(hasActiveFilters({ excludeMetallic: false, excludeCosmic: true })).toBe(true);
  });
});
