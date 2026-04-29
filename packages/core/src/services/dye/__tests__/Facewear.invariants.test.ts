import { describe, it, expect } from 'vitest';
import { DyeService, dyeDatabase } from '../../../index.js';
import type { Dye } from '@xivdyetools/types';

// ARCH-002 (2026-04-28 audit): end-to-end invariants for the Facewear
// synthetic-ID contract. DyeDatabase.test.ts already covers the *generation*
// of synthetic IDs against mock fixtures; this file verifies the live
// post-initialize state of the real `colors_xiv.json` data — the contract
// every market-board caller depends on.
//
// The contract:
//   - Every Facewear dye gets itemID < 0 (raw `itemID: null` is rewritten).
//   - No two synthetic itemIDs collide.
//   - Every non-Facewear dye keeps a positive itemID.
//   - The `dye.itemID > 0` filter (per project memory + CLAUDE.md) is the
//     correct guard for market-board lookups.

describe('Facewear synthetic-ID invariant (ARCH-002)', () => {
  const dyeService = new DyeService(dyeDatabase);
  const allDyes: Dye[] = dyeService.getAllDyes();
  const facewearDyes = allDyes.filter((d) => d.category === 'Facewear');
  const nonFacewearDyes = allDyes.filter((d) => d.category !== 'Facewear');

  it('every Facewear dye has a negative synthetic itemID', () => {
    expect(facewearDyes.length).toBeGreaterThan(0);
    for (const dye of facewearDyes) {
      expect(dye.itemID).toBeLessThan(0);
    }
  });

  it('Facewear dye count matches the documented 11 entries', () => {
    // Project memory + CLAUDE.md document 11 Facewear dyes in colors_xiv.json.
    // If this count changes, update the docs alongside the data so future
    // contributors don't think a regression silently dropped entries.
    expect(facewearDyes.length).toBe(11);
  });

  it('no two synthetic itemIDs collide', () => {
    const ids = facewearDyes.map((d) => d.itemID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every non-Facewear dye has a positive itemID (never zero or negative)', () => {
    for (const dye of nonFacewearDyes) {
      expect(dye.itemID).toBeGreaterThan(0);
    }
  });

  it('the `itemID > 0` filter cleanly partitions market-tradeable from Facewear', () => {
    // The canonical guard for Universalis lookups (per CLAUDE.md and the
    // 2026-02-05 budget bug fix). This test pins the contract: applying
    // the filter must drop exactly the Facewear set, no false positives.
    const tradeable = allDyes.filter((d) => d.itemID > 0);
    const nonTradeable = allDyes.filter((d) => !(d.itemID > 0));
    expect(tradeable.length).toBe(nonFacewearDyes.length);
    expect(nonTradeable.length).toBe(facewearDyes.length);
  });
});
