# DEAD-054: `isAbortError` — untested, unused export

## Category
Dead Code Paths

## Location
- File(s): `packages/core/src/utils/index.ts`
- Line(s): 760–799 (approximately)
- Symbol(s): `isAbortError`

## Evidence
`isAbortError` is an exported utility function that checks if an error is an `AbortError` (from `AbortController`).

**Usage analysis:**
- Internal service usage: **None** — not used by any file in `src/services/`
- External consumer usage: **None** — not imported by any monorepo project
- Test coverage: **None** — not tested in `utils.test.ts`, `core.test.ts`, or any other test file

This is the only exported function in the entire `@xivdyetools/core` package with **zero test coverage**.

Cross-reference with `APIService.ts` (which uses `AbortController` for request timeouts): `APIService` catches abort errors inline with `error.name === 'AbortError'` checks rather than using this utility.

## Why It Exists
Likely created as a companion utility for the `AbortController` pattern used in `APIService`, but the service implements its own inline check instead of using this utility.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero usage, zero tests |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | Possible external npm consumers |

## Recommendation
**REMOVE WITH CAUTION (v2.0.0)** or **add tests and internal usage now**

### Rationale
Either:
1. Remove the export from `src/index.ts` in v2.0.0 (with `@deprecated` marker now)
2. Or adopt it: update `APIService.ts` to use `isAbortError()` instead of inline `error.name === 'AbortError'` checks, and add test coverage

### If Removing
1. Remove `isAbortError` from `src/index.ts` exports
2. Remove the function from `src/utils/index.ts` (or keep it but don't export)
3. Run `npm run type-check` and tests
