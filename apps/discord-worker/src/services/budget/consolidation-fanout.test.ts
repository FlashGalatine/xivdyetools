import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CONSOLIDATED_IDS,
  DyeService,
  dyeDatabase,
  getMarketItemID,
  isConsolidationActive,
} from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { fetchPricesBatched } from './universalis-client.js';
import { createMockEnv } from '../../test-utils.js';
import type { Env } from '../../types/env.js';

// ARCH-002 (2026-04-28 audit): integration tests for the Patch 7.5 dye
// consolidation fan-out through the budget pipeline.
//
// Unit-level coverage of `getMarketItemID` etc. lives in
// packages/core/src/config/__tests__/consolidated-ids.test.ts. This file
// proves the *integration* — that the dedup→fetch→fan-out triangle holds
// when real `colors_xiv.json` data flows through real `getMarketItemID`
// and a real `fetchPricesBatched` call.
//
// Sensitive code paths covered:
//   - 2026-02-05 Bug 1: fetchPrices 100-item cap → must use fetchPricesBatched
//   - 2026-02-05 Bug 3: synthetic negative IDs failing proxy regex `^[\d,]+$`
//                       → must filter `itemID > 0` before fetching
//   - Patch 7.5 fan-out: N original IDs sharing a consolidationType collapse
//                        to 1 market query, attribution propagates to all N

const TYPE_A_PRICE = 999;
const dyeService = new DyeService(dyeDatabase);
const allDyes: Dye[] = dyeService.getAllDyes();

// Pick three real Type-A consolidated dyes for the fan-out test. Using live
// data means a future regression in `consolidationType` tagging would also
// fail this test — desirable.
const typeADyes = allDyes.filter((d) => d.consolidationType === 'A').slice(0, 3);

describe('Patch 7.5 consolidation fan-out (ARCH-002)', () => {
  beforeEach(() => {
    expect(typeADyes.length).toBe(3); // pin sample size; flag if data shape drifts
    expect(isConsolidationActive()).toBe(true);
  });

  describe('with consolidation ACTIVE (live state)', () => {
    it('deduplicates three Type-A original IDs into one market query', async () => {
      const proxyFetch = vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        const url = new URL(request.url);
        // Path: /api/v2/aggregated/<world>/<comma-separated-ids>
        const itemIdSegment = url.pathname.split('/').pop() ?? '';
        const itemIds = itemIdSegment.split(',').map(Number);
        return Response.json({
          results: itemIds.map((id) => ({
            itemId: id,
            nq: {
              minListing: { dc: { price: TYPE_A_PRICE, worldId: 1 } },
              averageSalePrice: { dc: { price: TYPE_A_PRICE + 50 } },
              dailySaleVelocity: { dc: { quantity: 5 } },
              recentPurchase: {
                dc: { price: TYPE_A_PRICE, timestamp: Date.now(), worldId: 1 },
              },
            },
            hq: { minListing: {}, recentPurchase: {}, averageSalePrice: {}, dailySaleVelocity: {} },
            worldUploadTimes: [{ worldId: 1, timestamp: Date.now() }],
          })),
          failedItems: [],
        });
      });
      const env: Env = createMockEnv({
        UNIVERSALIS_PROXY: { fetch: proxyFetch } as unknown as Fetcher,
      });

      // Replicate the budget-calculator pattern: dedupe via Set on marketID
      const marketIds = Array.from(new Set(typeADyes.map((d) => getMarketItemID(d))));
      expect(marketIds).toEqual([CONSOLIDATED_IDS.A!]); // all 3 collapse to itemID 52254

      const prices = await fetchPricesBatched(env, 'Cactuar', marketIds);

      // (1) Single proxy call (the dedup proof)
      expect(proxyFetch).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(
        (proxyFetch.mock.calls[0]![0] as Request).url ??
          (proxyFetch.mock.calls[0]![0] as URL).toString(),
      );
      expect(calledUrl.pathname).toContain(`/${CONSOLIDATED_IDS.A}`);
      expect(calledUrl.pathname).not.toMatch(/\d+,\d+/); // no comma-list

      // (2) Fan-out proof: each original ID gets the same price via getMarketItemID
      for (const dye of typeADyes) {
        const lookupId = getMarketItemID(dye);
        const price = prices.get(lookupId);
        expect(price).toBeDefined();
        expect(price!.currentMinPrice).toBe(TYPE_A_PRICE);
        expect(price!.itemID).toBe(CONSOLIDATED_IDS.A);
      }
    });
  });

  describe('with consolidation INACTIVE (pre-patch state)', () => {
    let originalA: number | null;
    let originalB: number | null;
    let originalC: number | null;

    beforeEach(() => {
      originalA = CONSOLIDATED_IDS.A;
      originalB = CONSOLIDATED_IDS.B;
      originalC = CONSOLIDATED_IDS.C;
      // Simulate pre-patch state: all consolidated IDs unset
      CONSOLIDATED_IDS.A = null;
      CONSOLIDATED_IDS.B = null;
      CONSOLIDATED_IDS.C = null;
      return () => {
        CONSOLIDATED_IDS.A = originalA;
        CONSOLIDATED_IDS.B = originalB;
        CONSOLIDATED_IDS.C = originalC;
      };
    });

    it('uses original itemIDs (no dedup, one query per dye)', async () => {
      expect(isConsolidationActive()).toBe(false);

      const proxyFetch = vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        const url = new URL(request.url);
        const itemIdSegment = url.pathname.split('/').pop() ?? '';
        const itemIds = itemIdSegment.split(',').map(Number);
        return Response.json({
          results: itemIds.map((id) => ({
            itemId: id,
            nq: {
              minListing: { dc: { price: 100 + id, worldId: 1 } },
              averageSalePrice: { dc: { price: 200 + id } },
              dailySaleVelocity: { dc: { quantity: 1 } },
              recentPurchase: {
                dc: { price: 100 + id, timestamp: Date.now(), worldId: 1 },
              },
            },
            hq: { minListing: {}, recentPurchase: {}, averageSalePrice: {}, dailySaleVelocity: {} },
            worldUploadTimes: [{ worldId: 1, timestamp: Date.now() }],
          })),
          failedItems: [],
        });
      });
      const env: Env = createMockEnv({
        UNIVERSALIS_PROXY: { fetch: proxyFetch } as unknown as Fetcher,
      });

      // Same pattern as the active branch — getMarketItemID now returns the
      // raw itemID for each Type-A dye because consolidation is off.
      const marketIds = Array.from(new Set(typeADyes.map((d) => getMarketItemID(d))));
      expect(marketIds.length).toBe(3); // no dedup; each original ID survives
      expect(marketIds).toEqual(typeADyes.map((d) => d.itemID));

      const prices = await fetchPricesBatched(env, 'Cactuar', marketIds);

      // Each original ID gets its own price, attributed by its own itemID
      for (const dye of typeADyes) {
        const lookupId = getMarketItemID(dye);
        const price = prices.get(lookupId);
        expect(price).toBeDefined();
        expect(price!.itemID).toBe(dye.itemID);
        expect(lookupId).toBe(dye.itemID); // pre-patch identity
      }
    });
  });

  describe('Facewear filter (regression for 2026-02-05 Bug 3)', () => {
    it('filtering itemID > 0 strips Facewear before fetch (proxy regex `^[\\d,]+$` would reject negatives)', () => {
      const facewear = allDyes.filter((d) => d.category === 'Facewear');
      expect(facewear.length).toBeGreaterThan(0);

      // The canonical filter from CLAUDE.md / project memory.
      const tradeable = allDyes.filter((d) => d.itemID > 0);
      const stripped = allDyes.filter((d) => !(d.itemID > 0));

      expect(stripped).toEqual(facewear);
      // None of the surviving IDs would be rejected by the proxy regex.
      for (const dye of tradeable) {
        expect(String(dye.itemID)).toMatch(/^\d+$/);
      }
    });
  });
});

