# DEAD-120: Unused component-context.ts UI builders still present (continuation of DEAD-025)

> **STATUS: RESOLVED** (verified 2026-06-15) — all 7 flagged builders removed in `106e94f` (2026-06-04); `component-context.ts` retained for its live core (`createContext`/`buildCustomId`). Merged via `fbc065f`.

## Category
Unused Export

## Location
- File(s): `apps/discord-worker/src/services/component-context.ts`
- Symbol(s): `deleteContext()`, `isAuthorized()`, `SelectMenuOption` type, `buildBlendingModeSelect()`,
  `buildMatchingMethodSelect()`, `buildMarketToggleButton()`, `buildRefreshButton()`

## Evidence
**Continuation of 2026-02-28 DEAD-025** (recommended REMOVE; not executed). Re-verifying, the seven builder/helper
exports are referenced **only** by the test + CHANGELOG:
```
grep buildBlendingModeSelect|buildMatchingMethodSelect|buildMarketToggleButton|buildRefreshButton|deleteContext|SelectMenuOption
  → component-context.ts (defs), component-context.test.ts (tests), CHANGELOG.md (doc only)
```
No command handler imports them. The module's **live** core — `createContext` / `getContext` / `refreshContext` — is used
by the button-handler system and stays. (`stats.ts` keeps its own local `isAuthorized`, so the shared one is redundant.)

## Why It Exists
V4 interactive-component infrastructure (select menus, toggle/refresh buttons) that no handler adopted. `deleteContext`
existed for pagination cleanup, but pagination itself was removed (Feb DEAD-020).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production importers (def + test + changelog only) |
| **Blast Radius** | LOW — ~125 lines; the live context functions are untouched |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — private app |

## Recommendation
**REMOVE** (verify with `tsc` first)

### Rationale
- Closes DEAD-025. Shrinks `component-context.ts` to the context-encoding functions actually used by the button system.

### If Removing
1. Delete the 7 symbols; keep `createContext`/`getContext`/`refreshContext`.
2. Update `component-context.test.ts` accordingly.
3. `pnpm --filter xivdyetools-discord-worker run type-check && run test`.
