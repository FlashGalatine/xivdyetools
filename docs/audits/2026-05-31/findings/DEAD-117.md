# DEAD-117: price-cache.ts test-only exports (getCachedPriceWithStale, invalidateCachedPrice)

## Category
Unused Export

## Location
- File(s): `apps/discord-worker/src/services/budget/price-cache.ts`, re-exported via `src/services/budget/index.ts`
- Symbol(s): `getCachedPriceWithStale` (price-cache.ts:101), `invalidateCachedPrice` (price-cache.ts:285)

## Evidence
New finding. Both functions are re-exported from the budget barrel (`budget/index.ts:26,31`) but have **no production
consumer** — grep shows references only in the barrel re-export and `src/services/budget/price-cache.test.ts`:
```
price-cache.ts:101 getCachedPriceWithStale → budget/index.ts:26 (re-export) + price-cache.test.ts:10,116-132
price-cache.ts:285 invalidateCachedPrice   → budget/index.ts:31 (re-export) + price-cache.test.ts:11,198-202
```
The only in-source mention of `getCachedPriceWithStale` outside its definition is a **comment** at price-cache.ts:81
("caller should use getCachedPriceWithStale for fallback") — i.e. a documented caller that was never written.

⚠️ **Sibling caution:** `getCachedPrices` (also re-exported, L130-ish) is **NOT** dead — it has one internal caller
(`fetchWithCache`). Keep it. Only the two symbols above are unused.

## Why It Exists
Stale-while-revalidate and cache-invalidation helpers added to the budget price cache for a richer caching strategy that
the `/budget` command never adopted (it uses `getCachedPrice` / `fetchWithCache`).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MED-HIGH — zero production callers, but `getCachedPrices` proximity warrants a careful diff |
| **Blast Radius** | LOW — two functions + their barrel re-exports |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None found; verify no dynamic `budget/index` re-consumer before deleting |

## Recommendation
**REMOVE WITH CAUTION**

### Rationale
- Trims the budget cache surface to what `/budget` actually calls. Removes ~50 lines + test blocks.

### If Removing
1. Delete `getCachedPriceWithStale` and `invalidateCachedPrice` from `price-cache.ts`; drop the stale L81 comment.
2. Remove their entries from `budget/index.ts` re-export and their `describe` blocks from `price-cache.test.ts`.
3. **Keep** `getCachedPrices` (internal caller). `pnpm --filter xivdyetools-discord-worker run type-check && run test`.
