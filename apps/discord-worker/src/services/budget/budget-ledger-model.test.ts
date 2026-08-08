/**
 * 13G ledger model tests — the pricing rules that replaced the 4.x
 * value-score pipeline. Real dye data flows through findBudgetLedger with a
 * mocked price fetch, proving:
 * - tier groups carry the single price (A = min(vendor 216, board), B/C =
 *   consolidated board only, board-only = own listing)
 * - the vendor-undercuts flag
 * - gil/ΔE pinned to ΔE2000 whatever the method
 * - blanks (never inventions) when the target has no price
 * - path exclusions remove whole groups but never the target
 * - the already-the-floor sentence case
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CONSOLIDATED_IDS, BAND_VOCABULARY, ColorService } from '@xivdyetools/core';
import { findBudgetLedger, getDyeByName, getAllDyes } from './budget-calculator.js';
import { fetchWithCache } from './price-cache.js';
import { createMockEnv } from '../../test-utils.js';
import type { DyePriceData } from '../../types/budget.js';
import type { Env } from '../../types/env.js';

vi.mock('./price-cache.js', () => ({
  fetchWithCache: vi.fn(),
}));
vi.mock('./universalis-client.js', () => ({
  fetchPricesBatched: vi.fn(),
}));

const mockFetchWithCache = vi.mocked(fetchWithCache);

function price(itemId: number, gil: number): [number, DyePriceData] {
  return [
    itemId,
    {
      currentMinPrice: gil,
      world: 'Cactuar',
      listingCount: 5,
      fetchedAt: '2026-08-08T00:00:00.000Z',
    } as DyePriceData,
  ];
}

function setPrices(entries: Array<[number, DyePriceData]>): void {
  mockFetchWithCache.mockResolvedValue({
    prices: new Map(entries),
    fromCache: entries.length,
    fromApi: 0,
    stale: false,
  });
}

const jetBlack = getDyeByName('Jet Black')!;
const sootBlack = getDyeByName('Soot Black')!;

describe('findBudgetLedger (13G model)', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
    vi.clearAllMocks();
    expect(jetBlack.consolidationType).toBeNull();
    expect(jetBlack.acquisition).toBe('Venture Coffers');
    expect(sootBlack.consolidationType).toBe('A');
  });

  it('groups carry the single price; the A group takes min(vendor, board) with the flag', async () => {
    setPrices([price(jetBlack.itemID, 71400), price(CONSOLIDATED_IDS.A!, 248)]);
    const result = await findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {});

    expect(result.targetPrice).toBe(71400);
    expect(result.targetPriceSource).toBe('board');
    const aGroup = result.groups.find((g) => g.type === 'A');
    expect(aGroup).toBeDefined();
    expect(aGroup!.label).toBe('Standard Spectrum Dye');
    expect(aGroup!.price).toBe(216); // vendor undercuts the 248 board listing
    expect(aGroup!.vendorCheaper).toBe(true);
    // Rows are priceless — only the ratio derives from the group figure
    for (const row of aGroup!.rows) {
      expect(row.perDe).not.toBeNull();
      expect(row.perDe!).toBeGreaterThan(0);
    }
  });

  it('sorts by gil/ΔE descending and caps at five rows', async () => {
    setPrices([price(jetBlack.itemID, 71400), price(CONSOLIDATED_IDS.A!, 248)]);
    const result = await findBudgetLedger(env, jetBlack.itemID, 'Cactuar', { matchLine: 20 });

    const flat = result.groups.flatMap((g) => g.rows);
    expect(flat.length).toBeLessThanOrEqual(5);
    const ratios = flat.map((r) => r.perDe ?? -Infinity);
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i - 1]).toBeGreaterThanOrEqual(ratios[i]);
    }
  });

  it('blanks, never invents: unpriced target → null ratios, tier-then-distance order', async () => {
    // Board offline entirely: the A vendor price is local and stays; the
    // coffer target has no gil figure at all.
    setPrices([]);
    const result = await findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {});

    expect(result.targetPrice).toBeNull();
    expect(result.targetPriceSource).toBeNull();
    expect(result.alreadyFloor).toBe(false);
    const flat = result.groups.flatMap((g) => g.rows);
    expect(flat.length).toBeGreaterThan(0);
    for (const row of flat) expect(row.perDe).toBeNull();
    // Standard-first fallback: the first group is A when any A dye is in the net
    if (result.groups.length > 1) {
      expect(result.groups[0].type).toBe('A');
    }
    // A's vendor price survives offline, without the flag (no board to undercut)
    const aGroup = result.groups.find((g) => g.type === 'A');
    if (aGroup) {
      expect(aGroup.price).toBe(216);
      expect(aGroup.vendorCheaper).toBe(false);
    }
  });

  it('exclusions remove whole groups but the excluded target stays allowed', async () => {
    setPrices([price(jetBlack.itemID, 71400), price(CONSOLIDATED_IDS.A!, 248)]);
    const result = await findBudgetLedger(env, jetBlack.itemID, 'Cactuar', {
      matchLine: 20,
      excludeCoffers: true,
    });

    // Jet Black (a coffer dye) still prices as the target…
    expect(result.targetPrice).toBe(71400);
    // …but no coffer candidate group exists
    for (const g of result.groups) {
      expect(g.acquisition).not.toBe('Venture Coffers');
      for (const r of g.rows) expect(r.dye.acquisition).not.toBe('Venture Coffers');
    }
  });

  it('a type-A target nothing undercuts is the floor — a sentence, not an empty frame', async () => {
    // Every pricing path in the candidate net is priced AT or above the
    // 216 vendor floor, so nothing survives the cheaper-than-target filter.
    // (Unpriced rows would stay — that is the offline degrade, not the floor.)
    const boardOnlyNearby = getAllDyes().filter(
      (d) =>
        d.consolidationType === null &&
        d.itemID !== sootBlack.itemID &&
        ColorService.getDistanceForMethod(sootBlack.hex, d.hex, 'ciede2000') <= 8
    );
    setPrices([
      price(CONSOLIDATED_IDS.A!, 248),
      price(CONSOLIDATED_IDS.B!, 5000),
      price(CONSOLIDATED_IDS.C!, 5000),
      ...boardOnlyNearby.map((d) => price(d.itemID, 999_999)),
    ]);
    const result = await findBudgetLedger(env, sootBlack.itemID, 'Cactuar', {});

    expect(result.targetPrice).toBe(216);
    expect(result.targetPriceSource).toBe('vendor');
    expect(result.alreadyFloor).toBe(true);
    expect(result.groups).toHaveLength(0);
  });

  it('the ratio stays ΔE2000 under another method; the net pins to its MATCH middle cut', async () => {
    setPrices([price(jetBlack.itemID, 71400), price(CONSOLIDATED_IDS.A!, 248)]);
    const result = await findBudgetLedger(env, jetBlack.itemID, 'Cactuar', { method: 'rgb' });

    expect(result.method).toBe('rgb');
    const cut = BAND_VOCABULARY.match.rgb.cuts[1];
    const flat = result.groups.flatMap((g) => g.rows);
    expect(flat.length).toBeGreaterThan(0);
    for (const row of flat) {
      expect(row.de).toBeLessThanOrEqual(cut);
      if (row.perDe !== null) {
        // Pinned: the ratio derives from de2000, not the RGB figure
        const groupPrice = result.groups.find((g) => g.rows.includes(row))!.price!;
        const expected = (71400 - groupPrice) / Math.max(row.de2000, 0.1);
        expect(row.perDe).toBeCloseTo(expected, 6);
      }
    }
  });

  it('B/C groups never convert scrip prices — offline they are unpriced', async () => {
    // Only the target has a listing; Wide Spectrum boards are silent.
    setPrices([price(jetBlack.itemID, 71400)]);
    const result = await findBudgetLedger(env, jetBlack.itemID, 'Cactuar', { matchLine: 20 });

    for (const g of result.groups) {
      if (g.type === 'B' || g.type === 'C') {
        // 100 Skybuilders' Scrips / 600 Cosmocredits must NOT appear as gil
        expect(g.price).toBeNull();
        for (const r of g.rows) expect(r.perDe).toBeNull();
      }
    }
  });
});
