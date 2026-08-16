# [DEAD-009]: `src/services/price-utilities.ts` — whole module (191 lines) with no production caller, kept alive by a 418-line test

## Category
Orphaned File (production-dead module; test-only)

## Location
- `apps/web-app/src/services/price-utilities.ts` (191 lines) — exports `formatPriceWithSuffix`, `getDyePriceDisplay`, `getPriceInfo`, `preparePriceCardData`, `preparePriceCardDataFromMap`, `getItemIdsForPriceFetch`, `hasCachedPrices`, types `PriceCardData`, `DyePriceDisplayOptions`
- `apps/web-app/src/services/__tests__/price-utilities.test.ts` (418 lines)
- `apps/web-app/src/services/index.ts:104-112` — barrel re-export block

## Evidence
- Importers of the module (non-test, non-barrel): `grep -rln "price-utilities'" src` → **none**.
- Every exported name grepped across `src` excluding the defining file, the barrel and tests → **0 hits** for all seven functions (see `evidence/barrel-classification.txt`, rows `formatPriceWithSuffix` … `hasCachedPrices`, all `SYMBOL-DEAD-OUTSIDE-DEF-FILE`).
- knip (default): all seven flagged unused on the barrel; knip `--production`: all seven flagged unused on the module itself (`evidence/knip-production-report.txt`).
- Header comment: *"WEB-REF-003 Phase 4: Shared price utilities"* — a refactor-era extraction whose consumers were subsequently replaced by the 5.0 `v4-result-card` price rendering.

## Why It Exists
Extracted during WEB-REF-003 to de-duplicate price formatting across the v4 tools. The 5.0 result-card rewrite moved price display into `v4/result-card.ts`, leaving the helper without callers.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — one module + its test + one barrel block |
| **Reversibility** | EASY |
| **Hidden Consumers** | None. `market-board-service.ts` is imported *by* this module, not the reverse. Coverage ratchet: fully-covered module leaves → small overall-% drop; measure. |

## Recommendation
**REMOVE**

### If Removing
1. `git rm src/services/price-utilities.ts src/services/__tests__/price-utilities.test.ts`
2. Delete the `export { … } from './price-utilities'` block in `src/services/index.ts` (lines 104-112)
3. `pnpm --filter xivdyetools-web-app run type-check test`
