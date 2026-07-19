# [REFACTOR-011]: `fetchPricesForDyes` return-value contract invites mis-keyed lookups

## Priority
MEDIUM

## Category
API contract / error-prone interface

> **Note:** This is the structural fix for **BUG-010** (Budget & Swatch tools reading prices with original dye itemIDs from a map keyed by consolidated market itemIDs).

## Location
- `apps/web-app/src/services/market-board-service.ts:296-390` (doc comment `:296-303` vs. return at `:376`)
- Call sites: `budget-tool.ts:1589`, `swatch-tool.ts:2296`, `v4/preset-detail.ts:524-531`, `harmony-tool.ts:1646`, `extractor-tool.ts:2879`, `gradient-tool.ts:2356`, `mixer-tool.ts:1863`, `comparison-tool.ts:239`

## Current State
The method's doc comment says "`getMarketItemID` collapses consolidated dyes to the 3 shared market IDs **inside** `fetchPricesForDyes`" — implying callers are insulated from Patch 7.5 consolidation. In reality, the internal cache (`this.priceData`) receives the fanned-out per-dye entries, but the **returned** map is the raw `batchResults`, keyed by market itemIDs (52254/52255/52256 for 105 dyes).

Of the seven external call sites:
- Five only read `.size` for logging or ignore the result (`harmony-tool.ts:1646-1652`, `extractor-tool.ts:2879-2880`, `gradient-tool.ts:2356`, `mixer-tool.ts:1863`, `comparison-tool.ts:239`).
- Two consume the keys and are wrong (budget, swatch — BUG-010).
- One is redundantly double-fed (preset-detail copies both the mis-keyed return `:524-531` and the correct `prices-updated` event payload `:455-464`).

## Issues
- The API's shape contradicts its documentation, so correct usage is only achievable by ignoring the return value.
- Any future caller that uses the returned keys will silently reintroduce BUG-010.
- Event payloads (`fetchedCount` in `prices-updated`/`fetch-completed`, `:368-374`) report market-ID counts, not dye counts, which is misleading in logs.

## Proposed Refactoring
Build and return the fanned-out map in the existing loop:

```ts
const result = new Map<number, PriceData>();
for (const [marketId, priceData] of batchResults) {
  const originalIds = marketIdToOriginals.get(marketId) ?? [marketId];
  for (const originalId of originalIds) {
    this.priceData.set(originalId, priceData);
    result.set(originalId, priceData);
  }
}
...
this.emitEvent('prices-updated', { prices: new Map(this.priceData), fetchedCount: result.size });
return result;
```
Then simplify budget/swatch to consume it directly (or drop their local maps entirely per REFACTOR-002), and remove preset-detail's redundant copy. Alternative design: return `Promise<void>` and make `getPriceForDye`/`prices-updated` the only read paths — stronger, but touches more call sites.

## Benefits
- Fixes BUG-010 at the source; the API becomes impossible to misuse.
- Documentation and behavior align; log counts become dye-accurate.

## Effort Estimate
Small: ~15 lines in the service, plus optional cleanup at 3 call sites. Half a day including tests.

## Risk Assessment
Low. No current caller depends on market-ID keys (the only key-consumers are the buggy ones); only log-line semantics change (`prices.size` becomes dye-count, arguably more accurate). Existing market-board-service unit tests need their return-shape expectations updated for consolidated fixtures.

> Source: evidence/web-frontends-analysis.md (2026-07-18 deep-dive, web-frontends area)

## Status

**DONE 2026-07-19** — the return value and the `prices-updated`/`fetch-completed` event counts are built from the fanned-out map; the API can no longer be misused by keying on market itemIDs. Call sites unchanged (their copies are now correct).
