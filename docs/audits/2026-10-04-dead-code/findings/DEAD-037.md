# DEAD-037: apps/oauth vitest.config.ts coverage.exclude names nonexistent rate-limit-do.ts / durable-objects: 3 config lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/oauth · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/oauth/vitest.config.ts:18` — coverage.exclude 'src/services/rate-limit-do.ts' / 'src/durable-objects/**'

## Evidence
- Neither path exists in the tracked tree, and the only mentions anywhere in apps/oauth are these two lines, so the excludes match nothing. Removing them cannot change coverage.
  - Commands: git ls-files apps/oauth | grep -E 'rate-limit-do|durable' returns nothing; git grep -n -E 'rate-limit-do|durable-objects' -- apps/oauth returns only vitest.config.ts:18,19
- Origin: git show 8ecb878f:apps/oauth/vitest.config.ts shows the same lines (17-19). git diff --stat 8ecb878f HEAD -- apps/oauth/vitest.config.ts is empty.

## Fix
**REMOVE.** Nothing to verify first. These are stale leftovers from the retired Durable Object rate limiter.

Steps: 1) apps/oauth/vitest.config.ts: delete :17-19 (the '// Durable Objects' comment and the two exclude entries); the 'src/__tests__/mocks/**' entry on :16 keeps its trailing comma.
2) Run pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker.

## Status
OPEN
