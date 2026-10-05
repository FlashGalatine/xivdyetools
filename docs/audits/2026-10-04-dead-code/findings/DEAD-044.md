# DEAD-044: test-utils './auth' exports-map subpath has zero importers — 4 config lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** packages/test-utils · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `packages/test-utils/package.json:22` — exports ./auth

## Evidence
- No code imports '@xivdyetools/test-utils/auth'; the only hits are docs (README.md:49,95, CLAUDE.md:11,110, docs/projects/test-utils/overview.md:159, CHANGELOG). presets-api tests/test-utils.ts:16-22 gets the auth helpers from the root barrel (src/index.ts:15). The package is private, so @public does not apply.
  - Commands: git grep -n -E "test-utils/(auth|...)" -- . :(exclude)docs/audits -> only .md/CHANGELOG hits for /auth; code imports exist only for /cloudflare and /factories.; sed apps/presets-api/tests/test-utils.ts:15-22 -> createTestJWT/createExpiredJWT/authHeaders from '@xivdyetools/test-utils' (root).
- Origin: git show 8ecb878f:packages/test-utils/package.json has the same './auth' entry. No PR in 8ecb878f..HEAD touches packages/test-utils.

## Fix
**REMOVE WITH CAUTION.** First decide on the documented slice-import convention (CLAUDE.md:11, :156). './constants' also has no code importer, only a JSDoc example at src/constants/pkce.ts:12, so treat both entries the same way. src/auth stays live through the root barrel, so removing the entry only changes how the package is consumed.

Steps: (1) Delete packages/test-utils/package.json lines 22-25 (the "./auth" block). (2) Point README.md:49 at the root import, drop the README.md:95 table row, and reword CLAUDE.md:11 and the CLAUDE.md:110 heading. (3) Update the import at docs/projects/test-utils/overview.md:159. (4) Add a test-utils CHANGELOG entry. (5) Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils, then pnpm dead-code:check and pnpm docs:check-links.

## Status
OPEN
