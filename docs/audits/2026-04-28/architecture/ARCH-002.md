# ARCH-002: No end-to-end tests for Patch 7.5 consolidation flow or Facewear synthetic-ID invariant

- **Severity:** MEDIUM
- **Category:** Test Coverage
- **Files (subjects of testing — not files to modify):**
  - [`packages/core/src/config/consolidated-ids.ts`](../../../../packages/core/src/config/consolidated-ids.ts) — `getMarketItemID`, `getConsolidatedDyeName`, `isConsolidationActive`
  - [`packages/core/src/services/dye/DyeDatabase.ts`](../../../../packages/core/src/services/dye/DyeDatabase.ts) — synthetic negative-ID assignment for Facewear dyes
  - [`apps/discord-worker/src/services/budget/`](../../../../apps/discord-worker/src/services/budget/) — `fetchPricesBatched` integration with `getMarketItemID`

## Description

Two critical invariants of the dye database have unit-level tests but no end-to-end coverage:

### 1. Patch 7.5 consolidation: `getMarketItemID` → `fetchPricesBatched` fan-out

[`consolidated-ids.test.ts`](../../../../packages/core/src/config/__tests__/consolidated-ids.test.ts) covers the helper functions in isolation. Missing: an integration test that proves the **fan-out** through the budget pipeline works correctly. Specifically:

- A request to fetch market prices for the original itemIDs `[5729, 5740, 5771]` (all Type-A consolidated) should:
  - Deduplicate via `getMarketItemID` → single market query for itemID 52254.
  - Fan out the returned 52254 price back to each of `[5729, 5740, 5771]` so the budget tool can attribute it correctly.
- A pre-patch request (`isConsolidationActive() === false`) should bypass consolidation and use original itemIDs.

The 2026-02-05 budget bugs ([Bug 1: `fetchPrices` 100-item cap → `fetchPricesBatched`](../../../../docs/audits/2026-02-06/), [Bug 3: synthetic negative IDs failing proxy regex `^[\d,]+$`](../../../../docs/audits/2026-02-06/)) demonstrate that this pipeline is sensitive to ID handling. Without an integration test, a future regression in the fan-out logic would go undetected until reported by users.

### 2. Facewear synthetic-ID invariant

Per project memory and CLAUDE.md, all 11 Facewear dyes get assigned synthetic negative IDs (`-1`, `-2`, …) at runtime by [`DyeDatabase.ts`](../../../../packages/core/src/services/dye/DyeDatabase.ts) because their source `itemID` is `null`. The contract is:

- **Every** Facewear dye in the iterable database must have `itemID < 0`.
- No two synthetic IDs may collide.
- All market-board filters must use `dye.itemID > 0` (never `dye.itemID != null`).

There is no test asserting these three invariants directly. A regression — e.g., a future contributor switching `null`-handling logic — would silently allow positive itemIDs to reach Universalis lookups for Facewear dyes, producing 404s or worse, fetching the wrong item.

## Impact

- **Today:** Both behaviors appear correct in production (per 2026-02-05 fix history).
- **Risk:** Both areas have a documented history of subtle bugs. End-to-end tests are the cheap insurance against repeat regressions.

## Recommendation

Add two test files:

### Test 1: `packages/core/src/services/dye/__tests__/Facewear.invariants.test.ts`

```typescript
import { dyeDatabase } from '../../..';

describe('Facewear synthetic-ID invariant', () => {
  beforeAll(async () => { await dyeDatabase.initialize(); });

  test('every Facewear dye has itemID < 0', () => {
    const facewearDyes = dyeDatabase.allDyes().filter(d => d.category === 'Facewear');
    expect(facewearDyes).toHaveLength(11);
    for (const dye of facewearDyes) {
      expect(dye.itemID).toBeLessThan(0);
    }
  });

  test('no two synthetic IDs collide', () => {
    const facewearIds = dyeDatabase.allDyes()
      .filter(d => d.category === 'Facewear')
      .map(d => d.itemID);
    expect(new Set(facewearIds).size).toBe(facewearIds.length);
  });

  test('all positive itemIDs are real (never negative or zero)', () => {
    const nonFacewear = dyeDatabase.allDyes().filter(d => d.category !== 'Facewear');
    for (const dye of nonFacewear) {
      expect(dye.itemID).toBeGreaterThan(0);
    }
  });
});
```

### Test 2: `apps/discord-worker/src/services/budget/__tests__/consolidation-fanout.test.ts`

Mock the Universalis proxy to return a known price for itemID 52254, then call the budget pipeline with three Type-A original itemIDs and assert that:

- The proxy was called once (with `52254`), not three times.
- The returned price is attributed to all three original IDs in the budget breakdown.

## Effort

LOW (Test 1: ~25 lines) + MEDIUM (Test 2: requires proxy mock, ~80 lines including setup).

## Resolution

**Status:** OPEN
