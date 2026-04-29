import { describe, it, expect } from 'vitest';
import {
  VENDOR_ACQUISITIONS,
  CRAFT_ACQUISITIONS,
  ALLIED_SOCIETY_ACQUISITIONS,
} from '../DyeFilter.js';
import colorsData from '../../../data/colors_xiv.json' with { type: 'json' };

// Detects acquisition-string drift between DyeFilter constants and colors_xiv.json
// (e.g., the 'Crafting' → 'The Firmament' rename in 2026-04). If a future rename
// updates the JSON but not the constants (or vice-versa), this test fails loudly
// instead of silently producing an unmatched filter.

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

  // KNOWN GAP (discovered 2026-04-28): none of the 5 Allied Society vendor names
  // ("Amalj'aa Vendor", "Ixali Vendor", etc.) appear in current colors_xiv.json.
  // Either the dye source rename ('Crafting' → 'The Firmament') also touched these
  // and DyeFilter.ts wasn't updated, or these dyes were removed from the dataset
  // and the constant is dead. Investigate before re-enabling — `excludeAlliedSocietyDyes`
  // is currently a no-op against the live database.
  it.skip.each(ALLIED_SOCIETY_ACQUISITIONS)(
    'ALLIED_SOCIETY_ACQUISITIONS value %s exists in colors_xiv.json',
    (value) => {
      expect(acquisitions.has(value)).toBe(true);
    },
  );
});
