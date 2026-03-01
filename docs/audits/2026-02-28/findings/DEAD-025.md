# DEAD-025: Unused component-context.ts UI Builders

## Category
Unused Export

## Location
- `apps/discord-worker/src/services/component-context.ts`:
  - `deleteContext()` (~15 lines)
  - `isAuthorized()` (~10 lines)
  - `SelectMenuOption` type
  - `buildBlendingModeSelect()` (~30 lines)
  - `buildMatchingMethodSelect()` (~30 lines)
  - `buildMarketToggleButton()` (~20 lines)
  - `buildRefreshButton()` (~20 lines)

## Evidence
- All 7 symbols are only imported by `component-context.test.ts`.
- `stats.ts` has its own local `isAuthorized` function rather than importing the shared one.
- The select menu and button builders were designed for interactive message components (V4 rich UX) but no command handler adopted them.
- `deleteContext` exists for pagination cleanup but pagination itself is unused (DEAD-020).

## Why It Exists
Part of the V4 interactive component infrastructure. The component-context module's core functions (`createContext`, `getContext`, `refreshContext`) are used by the button handler system, but these specific UI builder exports never got wired into command handlers.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production imports |
| **Runtime Impact** | NONE |
| **Build Impact** | Removes ~125 lines |
| **External Consumers** | None |

## Recommendation
**REMOVE** all 7 symbols. The rest of `component-context.ts` (createContext, getContext, etc.) remains in use.
