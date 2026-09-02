# DEAD-020: api-worker `errorResponse` — an 18-line JSON error envelope helper with zero call sites

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/api-worker · **Semver:** NONE (app-internal) · **Category:** Unused Export

## Location
- `apps/api-worker/src/lib/response.ts:59-76` — `export function errorResponse(c, code, message, status, details?)`

## Evidence
- knip *Unused exports* (`evidence/knip-root.txt`).
- `git ls-files apps/api-worker | xargs grep -nw errorResponse` → one line, the declaration itself. The five "other" hits in `evidence/symrefs-api-worker.txt` are **different functions of the same name** in `apps/image-worker/src/validators.ts` and `apps/presets-api/src/utils/api-response.ts` — not importers.
- The live error path is `ApiError` (59 prod references) plus the app-level error handler; the sibling success helpers in the same file (`buildPagination`, the success envelope) are used.

## Fix
**REMOVE** the function. Check whether `AppContext`/`ResponseMeta` lose their last use in the file (they do not — the success helpers use them). api-worker CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker`.

## Status
FIXED 2026-09-01 `2fd2c2a7`.

