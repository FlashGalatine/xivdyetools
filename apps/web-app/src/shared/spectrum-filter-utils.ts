/**
 * XIV Dye Tools - Consolidation Spectrum Filter Utilities
 *
 * Pure helpers for filtering dyes by their Patch 7.5 consolidation spectrum.
 *
 * After Patch 7.5, 105 of the 125 standard dyes were consolidated onto three
 * shared market itemIDs (A = "Standard Spectrum", B = "Wide Spectrum #1",
 * C = "Wide Spectrum #2"). The remaining premium dyes (Pure White, Jet Black,
 * etc.) stay unconsolidated and keep their own itemIDs. Every `Dye` carries a
 * `consolidationType: 'A' | 'B' | 'C' | null` field, so the spectrum a dye
 * belongs to is a direct lookup with no extra data needed.
 *
 * This is a *browsing/input* filter (what dyes a user can pick in the selector),
 * distinct from the `DyeFiltersConfig` exclude-filters which trim tool *output*.
 *
 * @module shared/spectrum-filter-utils
 */

import type { Dye } from '@xivdyetools/types';

/**
 * Identifier for a consolidation spectrum group.
 * `'A' | 'B' | 'C'` mirror `Dye.consolidationType`; `'unconsolidated'`
 * represents dyes with `consolidationType === null` (premium specials).
 */
export type SpectrumKey = 'A' | 'B' | 'C' | 'unconsolidated';

/** All spectrum keys, in display order. */
export const ALL_SPECTRA: readonly SpectrumKey[] = ['A', 'B', 'C', 'unconsolidated'];

/**
 * Map a dye to its spectrum key.
 *
 * A non-Facewear dye with `consolidationType === null` is "unconsolidated".
 * (Facewear dyes are also `null`, but the selector removes them upstream via
 * its `excludeFacewear` option before this predicate runs.)
 */
export function spectrumKeyForDye(dye: Dye): SpectrumKey {
  return dye.consolidationType ?? 'unconsolidated';
}

/**
 * Filter dyes down to the selected spectra.
 *
 * When every spectrum is selected (the common case for most tools) the input
 * array is returned untouched — a zero-cost fast path that guarantees no
 * behavior change for callers that don't restrict spectra.
 */
export function filterDyesBySpectra<T extends Dye>(dyes: T[], selected: Set<SpectrumKey>): T[] {
  if (selected.size >= ALL_SPECTRA.length) return dyes;
  return dyes.filter((d) => selected.has(spectrumKeyForDye(d)));
}
