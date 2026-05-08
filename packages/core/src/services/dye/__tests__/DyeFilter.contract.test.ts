import { describe, it, expect } from 'vitest';
import { VENDOR_ACQUISITIONS, CRAFT_ACQUISITIONS } from '../DyeFilter.js';
import colorsData from '../../../data/colors_xiv.json' with { type: 'json' };

// Detects acquisition-string drift between DyeFilter constants and colors_xiv.json
// (e.g., the 'Crafting' → 'The Firmament' rename in 2026-04). If a future rename
// updates the JSON but not the constants (or vice-versa), this test fails loudly
// instead of silently producing an unmatched filter.
//
// History: An earlier revision of this file also validated a third vendor-tribe
// acquisition constant, which was removed from DyeFilter.ts on 2026-04-29 — those
// vendor names had no corresponding rows in colors_xiv.json after Patch 7.5
// consolidation, and the filter was a no-op. See @xivdyetools/core CHANGELOG entry
// for the removal rationale.

describe('DyeFilter acquisition-string contract', () => {
  const acquisitions = new Set(
    (colorsData as ReadonlyArray<{ acquisition: string | null }>)
      .map((d) => d.acquisition)
      .filter((a): a is string => typeof a === 'string'),
  );

  it.each(VENDOR_ACQUISITIONS)('VENDOR_ACQUISITIONS value %s exists in colors_xiv.json', (value) => {
    expect(acquisitions.has(value)).toBe(true);
  });

  it.each(CRAFT_ACQUISITIONS)('CRAFT_ACQUISITIONS value %s exists in colors_xiv.json', (value) => {
    expect(acquisitions.has(value)).toBe(true);
  });
});
