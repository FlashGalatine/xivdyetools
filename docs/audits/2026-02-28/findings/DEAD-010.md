# DEAD-010: Deprecated Methods in MarketBoard Component

## Category
Dead Code Path

## Location
- File(s): `src/components/market-board.ts`
- Line(s): ~484 (`fetchPrice()`), ~701 (`getWorldName()`)
- Symbol(s): `fetchPrice()`, `getWorldName()`

## Evidence
Both methods are marked `@deprecated` in their JSDoc:
- `fetchPrice()` — `@deprecated Use fetchPricesForDyes for batch fetching`
- `getWorldName()` — `@deprecated Use MarketBoardService.getWorldNameForPrice()`

Manual search confirms zero callers outside the MarketBoard class itself (and even within, both are uncalled). All consumers use the recommended replacement APIs.

## Why It Exists
Original single-dye price fetch API, superseded by batch fetch. Original world name resolver, superseded by MarketBoardService method.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero callers, explicitly deprecated |
| **Blast Radius** | NONE — internal to market-board.ts |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- Removes ~50-80 lines of dead methods
- Explicit deprecation confirms intention to remove

### If Removing
1. Delete `fetchPrice()` method from `src/components/market-board.ts`
2. Delete `getWorldName()` method from `src/components/market-board.ts`
3. Run build + tests to verify
