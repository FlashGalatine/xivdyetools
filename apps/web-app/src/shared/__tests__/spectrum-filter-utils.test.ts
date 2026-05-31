/**
 * XIV Dye Tools - Consolidation Spectrum Filter Utilities Tests
 *
 * Tests for pure spectrum helpers: spectrumKeyForDye, filterDyesBySpectra
 *
 * @module shared/__tests__/spectrum-filter-utils.test
 */

import { describe, it, expect } from 'vitest';
import { spectrumKeyForDye, filterDyesBySpectra, ALL_SPECTRA } from '@shared/spectrum-filter-utils';
import type { SpectrumKey } from '@shared/spectrum-filter-utils';
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

// A representative dye in each spectrum bucket.
const dyeA = makeDye({ id: 1, name: 'ARR Dye', consolidationType: 'A' });
const dyeB = makeDye({ id: 2, name: 'Ishgardian Dye', consolidationType: 'B' });
const dyeC = makeDye({ id: 3, name: 'Cosmic Dye', consolidationType: 'C' });
const pureWhite = makeDye({ id: 4, name: 'Pure White', itemID: 13114, consolidationType: null });
const jetBlack = makeDye({ id: 5, name: 'Jet Black', itemID: 13115, consolidationType: null });

const allDyes: Dye[] = [dyeA, dyeB, dyeC, pureWhite, jetBlack];

// ---------------------------------------------------------------------------
// spectrumKeyForDye
// ---------------------------------------------------------------------------

describe('spectrumKeyForDye', () => {
  it('returns the consolidationType for consolidated dyes', () => {
    expect(spectrumKeyForDye(dyeA)).toBe('A');
    expect(spectrumKeyForDye(dyeB)).toBe('B');
    expect(spectrumKeyForDye(dyeC)).toBe('C');
  });

  it('returns "unconsolidated" when consolidationType is null', () => {
    expect(spectrumKeyForDye(pureWhite)).toBe('unconsolidated');
    expect(spectrumKeyForDye(jetBlack)).toBe('unconsolidated');
  });
});

// ---------------------------------------------------------------------------
// filterDyesBySpectra
// ---------------------------------------------------------------------------

describe('filterDyesBySpectra', () => {
  it('returns the input unchanged when all spectra are selected (fast path)', () => {
    const selected = new Set<SpectrumKey>(ALL_SPECTRA);
    const result = filterDyesBySpectra(allDyes, selected);
    expect(result).toBe(allDyes); // identity — no new array allocated
    expect(result).toHaveLength(5);
  });

  it('returns only unconsolidated dyes when only "unconsolidated" is selected', () => {
    const result = filterDyesBySpectra(allDyes, new Set<SpectrumKey>(['unconsolidated']));
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.name)).toEqual(['Pure White', 'Jet Black']);
    // Consolidated dyes are absent
    expect(result.find((d) => d.consolidationType !== null)).toBeUndefined();
  });

  it('returns only Type-A dyes when only "A" is selected', () => {
    const result = filterDyesBySpectra(allDyes, new Set<SpectrumKey>(['A']));
    expect(result).toEqual([dyeA]);
  });

  it('supports selecting multiple spectra at once', () => {
    const result = filterDyesBySpectra(allDyes, new Set<SpectrumKey>(['B', 'C']));
    expect(result.map((d) => d.id)).toEqual([2, 3]);
  });

  it('returns an empty array when an empty set is passed', () => {
    // The component guards against ever passing an empty set, but the pure
    // function's contract is "match nothing" rather than "match everything".
    const result = filterDyesBySpectra(allDyes, new Set<SpectrumKey>());
    expect(result).toHaveLength(0);
  });

  it('preserves the input element type', () => {
    interface DyeWithExtra extends Dye {
      extra: string;
    }
    const extended: DyeWithExtra[] = [
      { ...dyeA, extra: 'keep' },
      { ...dyeB, extra: 'drop' },
    ];
    const result = filterDyesBySpectra(extended, new Set<SpectrumKey>(['A']));
    expect(result).toHaveLength(1);
    expect(result[0].extra).toBe('keep');
  });
});
