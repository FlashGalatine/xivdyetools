# DEAD-031: successResponse + ApiSuccessResponse in presets-api api-response.ts are test-only: 31 src lines + 31 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/presets-api · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/presets-api/src/utils/api-response.ts:108` — successResponse + ApiSuccessResponse

## Evidence
- successResponse/ApiSuccessResponse have no production caller in presets-api; only tests/utils/api-response.test.ts calls it. The gate misses it because api-worker's unrelated successResponse matches its raw-text, cross-workspace name scan.
  - Commands: git grep -n -w -e successResponse -e ApiSuccessResponse -- . ':!docs/audits/**' -> presets-api hits only api-response.ts:66,105,106,108,114 and tests/utils/api-response.test.ts:11,50,52,62,75; other hits are all api-worker's own lib/response.ts helper; git grep same @8ecb878f -> identical presets-api hits
- Origin: git grep -n -w successResponse 8ecb878f -- apps/presets-api -> same def at api-response.ts:108 and the same 5 test refs; the preview branch does not change api-response.ts

## Fix
**REMOVE.** Keep the module header lines 14-18. They describe the {success:true,...} wire shape that handlers still emit inline with c.json.

Steps: 1) apps/presets-api/src/utils/api-response.ts: delete lines 63-69 (ApiSuccessResponse docblock + interface, plus its trailing blank) and lines 101-124 (successResponse docblock + function, plus its trailing blank). 2) apps/presets-api/tests/utils/api-response.test.ts: delete import line 11 and the describe('successResponse') block at lines 50-79. 3) pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api && pnpm dead-code:check

## Status
OPEN
