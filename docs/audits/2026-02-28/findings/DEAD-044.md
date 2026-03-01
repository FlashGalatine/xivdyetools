# DEAD-044: `logger.test.ts` tests deprecated re-exports core doesn't own

## Category
Stale Test Code

## Location
- File(s): `packages/core/src/__tests__/logger.test.ts`
- Line(s): 1–215
- Symbol(s): `NoOpLogger`, `ConsoleLogger` (via `types/logger.ts`)

## Evidence
`logger.test.ts` (215 lines) imports `NoOpLogger` and `ConsoleLogger` from the local `types/logger.ts` — which is itself a deprecated re-export from `@xivdyetools/logger/library` (see DEAD-042).

These tests validate logging behavior (console output, level filtering, structured logging) for code that lives in the `@xivdyetools/logger` package, not in core. The logger package has its own test suite at `packages/logger/`.

Last modified: 2026-02-21.

## Why It Exists
When logger types were part of core, these tests were appropriate. After extraction to `@xivdyetools/logger`, the tests should have been migrated but were left behind.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — tests deprecated code that core doesn't own |
| **Blast Radius** | NONE — no production code affected |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
215 lines testing code that belongs to `@xivdyetools/logger`. Verify logger package already has equivalent tests, then delete.

### If Removing
1. Verify `packages/logger/` has equivalent test coverage for `NoOpLogger` and `ConsoleLogger`
2. Delete `src/__tests__/logger.test.ts`
3. Run `npm test -- --run`
