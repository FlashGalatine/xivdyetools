# DEAD-036: Internal-Only Function Exports in bot-logic

## Category
Unused Export

## Location
- `packages/bot-logic/src/css-colors.ts`:
  - `resolveCssColorName()` — exported as named export
- `packages/bot-logic/src/color-utils.ts`:
  - `getColorDistance()` — exported as named export
  - `getMatchQualityInfo()` — exported as named export
  - `MatchQualityInfo` type — exported as named type

## Evidence
Monorepo-wide search for imports:
- `resolveCssColorName`: Only imported internally within bot-logic (by `resolve-color.ts`). Zero imports from discord-worker, web-app, or any other consumer.
- `getColorDistance`: Only imported internally within bot-logic (by `execute-match.ts`). Zero external imports.
- `getMatchQualityInfo`: Only imported internally within bot-logic. Zero external imports.
- `MatchQualityInfo`: Only used internally within bot-logic. Zero external imports.

All 4 symbols are re-exported via bot-logic's `index.ts` barrel file.

## Why It Exists
bot-logic exports its full internal API surface for maximum flexibility. These functions are implementation details used by the `execute*` command functions but have no external consumers.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for monorepo consumers; MEDIUM for npm consumers |
| **Runtime Impact** | NONE |
| **Build Impact** | Reduces public API surface |
| **External Consumers** | Published npm package — breaking change if removed from exports |

## Recommendation
**KEEP** exports but remove from `index.ts` barrel re-export if no external npm consumers exist. Add `@internal` JSDoc tags. These are valid internal functions that don't need to be part of the public API.
