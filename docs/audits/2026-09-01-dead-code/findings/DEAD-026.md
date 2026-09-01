# DEAD-026: oauth `user-service.ts` — three exported lookup wrappers with no production caller; only `findOrCreateUser` is used — 18 lines

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/oauth · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only)

## Location
- `apps/oauth/src/services/user-service.ts:233-238` `findUserById`, `:240-245` `findUserByDiscordId`, `:247-252` `findUserByXIVAuthId` — each a 6-line single-query wrapper

## Evidence
- `evidence/symrefs-oauth.txt`: each `prod=1` (its own declaration) with 4–5 test references.
- The module's only production importers take one name: `handlers/callback.ts:9` and `handlers/xivauth.ts:17`, both `import { findOrCreateUser }`. `src/__tests__/user-service.test.ts` is the only other importer.
- The lookups these wrap already happen inside `findOrCreateUser` / `attachIdentities`, which are the paths the handlers exercise.

## Fix
**REMOVE** the three functions and the test blocks that only exercise them; keep the tests that go through `findOrCreateUser` (they cover the same SQL). Re-grep each name first. oauth CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-oauth-worker`. Same production-deploy caveat as DEAD-025.

## Status
OPEN
