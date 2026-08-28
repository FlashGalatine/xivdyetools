/**
 * Tests for the facewear colour collection and the frozen legacy-ID map.
 *
 * `LEGACY_FACEWEAR_ITEM_IDS` was computed once, at the schema-v2 split
 * (2026-07-31), from the names as they stood then. It must never be
 * regenerated from live data: a rename would silently orphan every persisted
 * reference (api-worker's negative-ID lookups, localStorage). These tests
 * pin the table literally so a regeneration shows up as a failing diff.
 */

import { describe, it, expect } from 'vitest';
import {
  facewearColors,
  getFacewearColor,
  getFacewearColorByLegacyItemID,
  LEGACY_FACEWEAR_ITEM_IDS,
} from '../facewear.js';

describe('facewearColors', () => {
  it('holds the eleven glasses colours split out of the dye database', () => {
    expect(facewearColors).toHaveLength(11);
  });

  it('gives every entry a slug id, a name and a 6-digit hex', () => {
    for (const colour of facewearColors) {
      expect(colour.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(colour.name).toBeTruthy();
      expect(colour.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('keeps slugs unique — the slug is the lookup key', () => {
    const ids = facewearColors.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries no stainID and no market presence — these are not dyes', () => {
    for (const colour of facewearColors) {
      expect(colour).not.toHaveProperty('stainID');
      expect(colour).not.toHaveProperty('itemID');
    }
  });
});

describe('getFacewearColor', () => {
  it('resolves every shipped slug', () => {
    for (const colour of facewearColors) {
      expect(getFacewearColor(colour.id)).toEqual(colour);
    }
  });

  it.each([
    ['an unknown slug', 'chartreuse'],
    ['an empty string', ''],
    ['a differently-cased slug', 'Silver'],
  ])('returns null for %s', (_label, slug) => {
    expect(getFacewearColor(slug)).toBeNull();
  });
});

describe('LEGACY_FACEWEAR_ITEM_IDS', () => {
  it('is the frozen eleven-entry table from the 2026-07-31 split', () => {
    expect(LEGACY_FACEWEAR_ITEM_IDS).toEqual({
      [-1629]: 'silver',
      [-1390]: 'gold',
      [-1477]: 'black',
      [-1513]: 'white',
      [-1407]: 'grey',
      [-1283]: 'red',
      [-1392]: 'blue',
      [-1497]: 'green',
      [-1507]: 'brass',
      [-1632]: 'purple',
      [-1520]: 'brown',
    });
  });

  it('maps only negative ids — the pre-v2 synthetic space', () => {
    for (const id of Object.keys(LEGACY_FACEWEAR_ITEM_IDS)) {
      expect(Number(id)).toBeLessThan(0);
    }
  });

  it('points every legacy id at a slug that still exists', () => {
    for (const slug of Object.values(LEGACY_FACEWEAR_ITEM_IDS)) {
      expect(getFacewearColor(slug)).not.toBeNull();
    }
  });

  it('covers every shipped colour, so no persisted reference is orphaned', () => {
    const mapped = new Set(Object.values(LEGACY_FACEWEAR_ITEM_IDS));
    for (const colour of facewearColors) {
      expect(mapped.has(colour.id)).toBe(true);
    }
  });
});

describe('getFacewearColorByLegacyItemID', () => {
  it('resolves every frozen legacy id to its colour', () => {
    for (const [id, slug] of Object.entries(LEGACY_FACEWEAR_ITEM_IDS)) {
      expect(getFacewearColorByLegacyItemID(Number(id))?.id).toBe(slug);
    }
  });

  it.each([
    ['an unmapped negative id', -9999],
    ['a positive id', 5729],
    ['zero', 0],
    ['NaN', NaN],
  ])('returns null for %s', (_label, id) => {
    expect(getFacewearColorByLegacyItemID(id)).toBeNull();
  });

  it('resolves only through the frozen table, never a runtime computation', () => {
    // The frozen ids ARE the old -(1000 + Σ charCode(name)) values, so a name
    // that was never in the table has no id — even though the formula would
    // happily produce one for it.
    const wouldBe = -(1000 + [...'Chartreuse'].reduce((n, c) => n + c.charCodeAt(0), 0));

    expect(Object.keys(LEGACY_FACEWEAR_ITEM_IDS)).not.toContain(String(wouldBe));
    expect(getFacewearColorByLegacyItemID(wouldBe)).toBeNull();
  });
});
