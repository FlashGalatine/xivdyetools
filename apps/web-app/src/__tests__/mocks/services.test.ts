/**
 * Contract guard for the shared `mockDyes` fixture.
 *
 * BUG-016 (2026-09-02 deep-dive): this fixture used to set `id === stainID`,
 * which inverts the contract `@xivdyetools/types` documents for `Dye.id`
 * ("always equal to `itemID` after DyeDatabase.initialize() normalisation …
 * an FFXIV item ID such as 5729 or 13115, not a small sequential index").
 *
 * Thirteen suites import this fixture, so while the two ids were equal any
 * call site that reached for the wrong one passed its tests and failed in the
 * browser — four separately-filed defects shipped that way. These assertions
 * exist so the fixture cannot drift back to that state silently.
 *
 * @module __tests__/mocks/services.test
 */

import { describe, it, expect } from 'vitest';
import { mockDyes } from './services';

/** Lowest real dye item ID; stainIDs (1–254) are disjoint from this range. */
const LEGACY_ITEM_ID_FLOOR = 5729;

/** Highest stainID the game's stain table defines. */
const MAX_STAIN_ID = 254;

describe('mockDyes id contract', () => {
  it('is not empty (an empty fixture would satisfy every other case vacuously)', () => {
    expect(mockDyes.length).toBeGreaterThan(0);
  });

  it('gives every dye `id === itemID`, as Dye.id documents', () => {
    for (const dye of mockDyes) {
      expect(dye.id, `dye "${dye.name}" must carry its itemID as id`).toBe(dye.itemID);
    }
  });

  it('keeps itemID in the real item range, disjoint from stainIDs', () => {
    for (const dye of mockDyes) {
      expect(dye.itemID, `dye "${dye.name}" itemID`).toBeGreaterThanOrEqual(LEGACY_ITEM_ID_FLOOR);
    }
  });

  it('keeps stainID in the stain-table range', () => {
    for (const dye of mockDyes) {
      expect(dye.stainID, `dye "${dye.name}" stainID`).not.toBeNull();
      expect(dye.stainID!, `dye "${dye.name}" stainID`).toBeGreaterThanOrEqual(1);
      expect(dye.stainID!, `dye "${dye.name}" stainID`).toBeLessThanOrEqual(MAX_STAIN_ID);
    }
  });

  it('never lets a stainID collide with an id, so a mixed-up call site fails loudly', () => {
    const ids = new Set(mockDyes.map((d) => d.id));
    for (const dye of mockDyes) {
      expect(ids.has(dye.stainID!), `stainID ${dye.stainID} must not also be a valid id`).toBe(
        false
      );
    }
  });

  it('uses distinct ids and distinct stainIDs', () => {
    expect(new Set(mockDyes.map((d) => d.id)).size).toBe(mockDyes.length);
    expect(new Set(mockDyes.map((d) => d.stainID)).size).toBe(mockDyes.length);
  });
});
