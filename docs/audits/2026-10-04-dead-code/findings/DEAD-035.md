# DEAD-035: createMockKV re-export in api-worker tests/test-utils.ts has no importer — 1 line
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/api-worker · **Semver:** NONE · **Category:** Redundant Re-export · **Origin:** MAIN

## Location
- `apps/api-worker/tests/test-utils.ts:21` — createMockKV (re-export)

## Evidence
- No file imports createMockKV from tests/test-utils. All 10 importers of that helper take only createMockEnv, and router.test.ts / rate-limiter.test.ts import createMockKV directly from @xivdyetools/test-utils.
  - Commands: git grep test-utils in apps/api-worker (excluding @xivdyetools/test-utils): 10 imports, all `{ createMockEnv }`. git grep -w createMockKV: the only other uses import from @xivdyetools/test-utils. No cross-workspace importer; check-dead-code.test.ts:1769 only names the path in isTestFile.
- Origin: git show 8ecb878f:apps/api-worker/tests/test-utils.ts ends with `export { createMockKV };`. The line was added in 5d1b709d (Phase 1), and no PR in 8ecb878f..HEAD touches the file.

## Fix
**REMOVE.** Test-only helper file in an app, so no published API. Keep the line-6 import, because line 11 uses it inside createMockEnv.

Steps: Delete line 21 `export { createMockKV };` (and blank line 20) from apps/api-worker/tests/test-utils.ts; keep the line-6 import. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker && pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `6818070b` (branch `fix/remediation-2026-10-04-sprint18`, api-worker 0.17.0; PR #273, open).
