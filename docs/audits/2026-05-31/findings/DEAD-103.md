# DEAD-103: shared/error-handler.ts — unused validators/result helpers

## Category
Unused Export

## Location
- File(s): `src/shared/error-handler.ts` (+ `src/shared/__tests__/` error-handler tests)
- Symbol(s): `validateRange`, `validateNotNull`, `validateNotEmpty`, `validateCondition`, `handleError`,
  `handleAsyncError`, `createResult`, `createAsyncResult`, `withErrorHandling`, `withAsyncErrorHandling`

## Evidence
These helpers are tested but have **no production call-site** (grep finds them only in their tests + the barrel re-export).
The live surface of this module is the `ErrorHandler` object — `main.ts` uses `ErrorHandler.log()` and
`ErrorHandler.createUserMessage()` — which **stays**. The free-function validator/result API alongside it is unused.

⚠️ Heuristic — confirm with `tsc --noEmit` after removal.

## Why It Exists
A Result/validation utility layer added alongside `ErrorHandler`; the app consistently uses `ErrorHandler.*` instead, leaving
the free functions unused.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — zero prod refs; `ErrorHandler.*` is the live path and must be preserved |
| **Blast Radius** | LOW — internal only |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Confirm none of the validators are used via the barrel before removing |

## Recommendation
**REMOVE** (the free functions only) — after tsc confirmation; **KEEP `ErrorHandler`**

### Rationale
- Trims an unused parallel API; reduces confusion between `ErrorHandler.log()` and `handleError()`.

### If Removing
1. Delete the listed free-function exports + their tests; keep the `ErrorHandler` class/object.
2. Remove any now-unused re-exports from `services/index.ts` / `shared` barrel.
3. `pnpm --filter xivdyetools-web-app run type-check && run test`.
