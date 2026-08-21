/**
 * Data-invariant tests for the schema-v2 data files (dyes.json +
 * facewear_colors.json) against the closed vocabularies.
 *
 * These assertions replace the validation role of the retired
 * `apps/maintainer` tool and extend it with the checks the tool never had:
 * stainID uniqueness (Glamourer/Mare interop depends on it), closed-vocabulary
 * membership, and the frozen legacy Facewear ID mapping.
 */
import { describe, it, expect } from 'vitest';
import rawDyes from '../../data/dyes.json';
import rawFacewear from '../../data/facewear_colors.json';
import enLocale from '../../data/locales/en.json';
import { CONSOLIDATED_DYES } from '../consolidated-ids.js';
import {
  DYE_CATEGORIES,
  DYE_ACQUISITIONS,
  ACQUISITION_META,
  METALLIC_STAIN_IDS,
  type DyeAcquisition,
  type DyeCategory,
} from '../dye-vocabulary.js';
import { LEGACY_FACEWEAR_ITEM_IDS } from '../facewear.js';

interface RawDyeV2 {
  stainID: number;
  name: string;
  hex: string;
  category: string;
  acquisition: string;
  consolidationType: string | null;
  legacyItemID: number | null;
}

interface RawFacewear {
  id: string;
  name: string;
  hex: string;
}

const dyes = rawDyes as RawDyeV2[];
const facewear = rawFacewear as RawFacewear[];

describe('dyes.json data invariants (schema v2)', () => {
  it('contains 125 standard dyes and nothing else', () => {
    expect(dyes).toHaveLength(125);
  });

  it('carries exactly the 7 schema-v2 fields per entry', () => {
    const expected = [
      'stainID',
      'name',
      'hex',
      'category',
      'acquisition',
      'consolidationType',
      'legacyItemID',
    ].sort();
    for (const dye of dyes) {
      expect(Object.keys(dye).sort(), dye.name).toEqual(expected);
    }
  });

  it('has unique stainIDs in the Stain-sheet byte range, sorted ascending', () => {
    const ids = dyes.map((d) => d.stainID);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(254);
    }
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('has unique non-null legacyItemIDs', () => {
    const ids = dyes.map((d) => d.legacyItemID).filter((id): id is number => id !== null);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only known categories and acquisitions', () => {
    for (const dye of dyes) {
      expect(DYE_CATEGORIES).toContain(dye.category as DyeCategory);
      expect(DYE_ACQUISITIONS).toContain(dye.acquisition as DyeAcquisition);
      expect(ACQUISITION_META[dye.acquisition as DyeAcquisition]).toBeDefined();
    }
  });

  it('uses lowercase 6-digit hex colors (schema-v2 mandate)', () => {
    for (const dye of dyes) {
      expect(dye.hex, dye.name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('uses only known consolidation types with the expected group sizes', () => {
    for (const dye of dyes) {
      expect([null, 'A', 'B', 'C']).toContain(dye.consolidationType);
    }
    expect(dyes.filter((d) => d.consolidationType === 'A')).toHaveLength(85);
    expect(dyes.filter((d) => d.consolidationType === 'B')).toHaveLength(9);
    expect(dyes.filter((d) => d.consolidationType === 'C')).toHaveLength(11);
    expect(dyes.filter((d) => d.consolidationType === null)).toHaveLength(20);
  });

  it('has unique names', () => {
    const names = dyes.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('METALLIC_STAIN_IDS all exist in the database', () => {
    const stainIds = new Set(dyes.map((d) => d.stainID));
    for (const id of METALLIC_STAIN_IDS) {
      expect(stainIds.has(id), `metallic stain ${id}`).toBe(true);
    }
    expect(METALLIC_STAIN_IDS.size).toBe(16);
  });
});

describe('facewear_colors.json data invariants', () => {
  it('contains the 11 facewear colors with unique slug ids', () => {
    expect(facewear).toHaveLength(11);
    const ids = facewear.map((f) => f.id);
    expect(new Set(ids).size).toBe(11);
    for (const f of facewear) {
      expect(f.id).toMatch(/^[a-z-]+$/);
      expect(f.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('LEGACY_FACEWEAR_ITEM_IDS matches the frozen pre-v2 hash for every entry', () => {
    // The pre-v2 synthetic ID was -(1000 + Σ charCode(name)). The map is
    // frozen, but every entry must agree with the hash of the CURRENT names —
    // if a facewear color is ever renamed, this test forces a conscious
    // decision instead of a silent orphaning of persisted IDs.
    expect(Object.keys(LEGACY_FACEWEAR_ITEM_IDS)).toHaveLength(11);
    for (const f of facewear) {
      const hash = -(1000 + [...f.name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
      expect(LEGACY_FACEWEAR_ITEM_IDS[hash], `${f.name} (${hash})`).toBe(f.id);
    }
  });
});

/**
 * 2026-08-20 i18n audit, F-07: every currency string the runtime derives for
 * a Dye (ACQUISITION_META) or a consolidated market item (CONSOLIDATED_DYES)
 * must be a key of the locale `currencies` table, or
 * `TranslationProvider.getCurrency()` misses and every locale prints the raw
 * English string. "Skybuilders' Scrips" (apostrophe) vs the locale key
 * "Skybuilders Scrips" did exactly that for the 9 Firmament dyes.
 */
describe('currency strings resolve through the locale currencies table', () => {
  const currencyKeys = new Set(Object.keys(enLocale.currencies));

  it('ACQUISITION_META currencies are locale currency keys', () => {
    for (const [acq, meta] of Object.entries(ACQUISITION_META)) {
      expect(currencyKeys.has(meta.currency), `${acq} → ${meta.currency}`).toBe(true);
    }
  });

  it('CONSOLIDATED_DYES currencies are locale currency keys', () => {
    for (const [type, entry] of Object.entries(CONSOLIDATED_DYES)) {
      expect(currencyKeys.has(entry.currency), `${type} → ${entry.currency}`).toBe(true);
    }
  });
});
