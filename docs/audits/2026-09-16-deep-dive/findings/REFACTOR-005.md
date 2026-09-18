# REFACTOR-005: bot-logic `dye-info.marketValue()` re-implements core's consolidation gate
**Priority:** P3 · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** bot-logic

## Location
- `packages/bot-logic/src/commands/dye-info.ts:90-97` vs `@xivdyetools/core` `getMarketItemID` / `isConsolidationActive`

## Evidence
- Reviewer row `pkg-svg-bot-logic-02`; dormant today, drifts if a consolidation type ever ships with a null itemID

## Fix
- Call `getMarketItemID(dye)` and test the three consolidated types + one unconsolidated dye

## Status
FIXED (Sprint 3, `0e706f0f`) — `marketValue()` derives the item ID through core's `getMarketItemID`; output byte-identical for all 125 dyes; A/B/C + unconsolidated cases tested.
