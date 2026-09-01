# DEAD-022: api-worker has two `createMockEnv` helpers — the one in `src/` is dead, and it ships inside the Worker's source tree

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/api-worker · **Semver:** NONE · **Category:** Unused Export (duplicate test helper)

## Location
- `apps/api-worker/src/universalis/test-setup.ts:110-128` — dead `createMockEnv`
- `apps/api-worker/tests/test-utils.ts` — the live `createMockEnv`, imported by six test files

## Evidence
- knip *Unused exports* (`evidence/knip-root.txt`).
- The giveaway is in one file: `src/chara/router.test.ts:8` imports `createMockEnv` from `'../../tests/test-utils'` while line 9 imports `resetAllMocks, createMockExecutionContext` from `'../universalis/test-setup'` — the same test reaches past the local helper for this one function.
- `test-setup.ts`'s other exports are live (`MockCache`, `MockCacheStorage`, `createMockExecutionContext`, `resetAllMocks`), so the file stays.

## Fix
**REMOVE** the function from `src/universalis/test-setup.ts`. Then the structural point worth a follow-up rather than a silent fix: `test-setup.ts` is test-only code living under `src/`, so it is inside the Worker's bundle glob and inside the coverage `include`. Moving it to `tests/` alongside `test-utils.ts` — or folding both into `@xivdyetools/test-utils`, which the 2026-08-18 audit found ~87 % unconsumed — is the real cleanup; either is a separate task.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker`.

## Status
OPEN
