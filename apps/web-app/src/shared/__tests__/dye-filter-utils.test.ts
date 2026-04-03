/**
 * XIV Dye Tools - Dye Filter Utilities Tests
 *
 * Tests for pure filter functions: isDyeExcluded, filterDyes, hasActiveFilters
 *
 * @module shared/__tests__/dye-filter-utils.test
 */

import { describe, it, expect } from 'vitest';
import { isDyeExcluded, filterDyes, hasActiveFilters } from '@shared/dye-filter-utils';
import { DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import type { DyeFiltersConfig } from '@shared/tool-config-types';
import type { Dye } from '@xivdyetools/types';

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

function filtersWith(overrides: Partial<DyeFiltersConfig>): DyeFiltersConfig {
  return { ...DEFAULT_DYE_FILTERS, ...overrides };
}

// ---------------------------------------------------------------------------
// isDyeExcluded
// ---------------------------------------------------------------------------

describe('isDyeExcluded', () => {
  it('returns false when no filters are active', () => {
    expect(isDyeExcluded(DEFAULT_DYE_FILTERS, makeDye())).toBe(false);
  });

  // Type-based exclusions
  it('excludes metallic dyes when excludeMetallic is true', () => {
    const config = filtersWith({ excludeMetallic: true });
    expect(isDyeExcluded(config, makeDye({ isMetallic: true }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ isMetallic: false }))).toBe(false);
  });

  it('excludes pastel dyes when excludePastel is true', () => {
    const config = filtersWith({ excludePastel: true });
    expect(isDyeExcluded(config, makeDye({ isPastel: true }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ isPastel: false }))).toBe(false);
  });

  it('excludes dark dyes when excludeDark is true', () => {
    const config = filtersWith({ excludeDark: true });
    expect(isDyeExcluded(config, makeDye({ isDark: true }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ isDark: false }))).toBe(false);
  });

  it('excludes cosmic dyes when excludeCosmic is true', () => {
    const config = filtersWith({ excludeCosmic: true });
    expect(isDyeExcluded(config, makeDye({ isCosmic: true }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ isCosmic: false }))).toBe(false);
  });

  it('excludes ishgardian dyes when excludeIshgardian is true', () => {
    const config = filtersWith({ excludeIshgardian: true });
    expect(isDyeExcluded(config, makeDye({ isIshgardian: true }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ isIshgardian: false }))).toBe(false);
  });

  it('excludes expensive dyes (Pure White / Jet Black) when excludeExpensive is true', () => {
    const config = filtersWith({ excludeExpensive: true });
    // Pure White = 13114, Jet Black = 13115
    expect(isDyeExcluded(config, makeDye({ itemID: 13114 }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ itemID: 13115 }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ itemID: 10000 }))).toBe(false);
  });

  // Acquisition-based exclusions
  it('excludes vendor dyes when excludeVendorDyes is true', () => {
    const config = filtersWith({ excludeVendorDyes: true });
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Dye Vendor' }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Crafting' }))).toBe(false);
  });

  it('excludes craft dyes when excludeCraftDyes is true', () => {
    const config = filtersWith({ excludeCraftDyes: true });
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Crafting' }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Treasure Chest' }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Dye Vendor' }))).toBe(false);
  });

  it('excludes allied society dyes when excludeAlliedSocietyDyes is true', () => {
    const config = filtersWith({ excludeAlliedSocietyDyes: true });
    expect(isDyeExcluded(config, makeDye({ acquisition: "Amalj'aa Vendor" }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Ixali Vendor' }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Sahagin Vendor' }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Kobold Vendor' }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Sylphic Vendor' }))).toBe(true);
    expect(isDyeExcluded(config, makeDye({ acquisition: 'Dye Vendor' }))).toBe(false);
  });

  it('applies multiple filters simultaneously', () => {
    const config = filtersWith({ excludeMetallic: true, excludeDark: true });
    // Metallic → excluded
    expect(isDyeExcluded(config, makeDye({ isMetallic: true }))).toBe(true);
    // Dark → excluded
    expect(isDyeExcluded(config, makeDye({ isDark: true }))).toBe(true);
    // Neither → not excluded
    expect(isDyeExcluded(config, makeDye())).toBe(false);
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

  it('returns all dyes when no filters are active', () => {
    expect(filterDyes(DEFAULT_DYE_FILTERS, dyes)).toHaveLength(4);
  });

  it('removes metallic dyes when excludeMetallic is true', () => {
    const result = filterDyes(filtersWith({ excludeMetallic: true }), dyes);
    expect(result).toHaveLength(3);
    expect(result.find((d) => d.id === 1)).toBeUndefined();
  });

  it('removes multiple categories at once', () => {
    const result = filterDyes(filtersWith({ excludeMetallic: true, excludeDark: true }), dyes);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual([2, 3]);
  });

  it('returns empty array when all dyes are filtered out', () => {
    const allExcluded = [
      makeDye({ id: 1, isMetallic: true }),
      makeDye({ id: 2, isMetallic: true }),
    ];
    const result = filterDyes(filtersWith({ excludeMetallic: true }), allExcluded);
    expect(result).toHaveLength(0);
  });

  it('preserves generic type (returns same type as input)', () => {
    interface DyeWithExtra extends Dye {
      extra: string;
    }
    const extended: DyeWithExtra[] = [
      { ...makeDye({ id: 1 }), extra: 'hello' },
      { ...makeDye({ id: 2, isMetallic: true }), extra: 'world' },
    ];
    const result = filterDyes(filtersWith({ excludeMetallic: true }), extended);
    expect(result).toHaveLength(1);
    expect(result[0].extra).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// hasActiveFilters
// ---------------------------------------------------------------------------

describe('hasActiveFilters', () => {
  it('returns false when all filters are off', () => {
    expect(hasActiveFilters(DEFAULT_DYE_FILTERS)).toBe(false);
  });

  it('returns true when any single filter is on', () => {
    expect(hasActiveFilters(filtersWith({ excludeMetallic: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludePastel: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludeDark: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludeCosmic: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludeIshgardian: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludeExpensive: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludeVendorDyes: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludeCraftDyes: true }))).toBe(true);
    expect(hasActiveFilters(filtersWith({ excludeAlliedSocietyDyes: true }))).toBe(true);
  });

  it('returns true when multiple filters are on', () => {
    expect(hasActiveFilters(filtersWith({ excludeMetallic: true, excludeExpensive: true }))).toBe(
      true
    );
  });
});
