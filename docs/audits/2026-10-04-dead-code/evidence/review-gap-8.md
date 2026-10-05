# review-gap-8: test-utils integration/ cascade + './auth' subpath

## Commands and results
- `git grep -n integration -- packages/test-utils/{vitest.config.ts,tsconfig.build.json,CLAUDE.md,README.md} knip.jsonc turbo.json`
  -> vitest.config.ts:7 include 'integration/**/*.test.ts'; tsconfig.build.json:6 exclude "integration/**/*";
     knip.jsonc:96,102 (comment justifying "defaults" by reach of integration/** and vitest-plugin test.include);
     turbo.json:30 (comment history naming packages/test-utils/integration/**); CLAUDE.md:7,61 (history prose). README.md: 0.
- `wc -l packages/test-utils/integration/**`: bot-authentication.test.ts 203, jwt-validation.test.ts 378, setup.ts 214 = 795.
- `git grep -n -E "test-utils/(integration|auth)|integration/setup" -- apps packages scripts .github knip.jsonc turbo.json package.json` (no docs/audits, no CHANGELOG)
  -> only knip.jsonc:96, CLAUDE.md:110, README.md:49,95, turbo.json:30, setup.ts:7 (own @module). Zero importers of '@xivdyetools/test-utils/auth'.
- `git grep -w createTestJWT|createExpiredJWT|authHeaders` outside packages/test-utils -> apps/presets-api/tests/test-utils.ts:17-22 re-imports them from the ROOT barrel '@xivdyetools/test-utils' (moderation.test.ts, auth.test.ts, identity-rekey.test.ts consume via that wrapper). Auth helpers are LIVE via barrel (src/index.ts:15 `export * from './auth/index.js'`).
- Gate: dead-code-check.txt line 2 lists `packages/test-utils/integration/setup.ts` as a @testonly exempt entry (a file-level exemption, 1 of 26).
- scripts/check-dead-code.ts has no reference to integration (grep).
- Within integration/: imports only vitest, ../setup.js, ../src/cloudflare/d1.js, ../src/auth/jwt.js (relative). Nothing outside the package imports setup.ts. Test-only mocks of a hand-rolled simulation, per CHANGELOG.md:149 (the contract they assert no longer exists in presets-api).

## Candidates
- cand-gap8-01: delete integration/ (3 files, 795 lines) -> cascade: (a) vitest.config.ts:7 drop the integration include; (b) tsconfig.build.json:6 drop "integration/**/*"; (c) knip.jsonc:96-102 comment names the directory (reword; do not change settings); (d) turbo.json:30 comment is historical, may stay but names a deleted dir (reword optional); (e) dead-code gate: drop the integration/setup.ts @testonly entry (26 -> 25; the exemption comes from a tag in setup.ts, which is deleted with it, verify with `pnpm dead-code:check` count); (f) CLAUDE.md:7,61 and CHANGELOG are history prose, add a Removed entry; also confirm test-utils coverage thresholds (90%, src/**) are unaffected, since integration tests also cover src/auth/jwt.ts and d1.ts (tests/ unit tests exist for both: tests/auth/jwt.test.ts, tests/cloudflare/d1.test.ts).
  Caveat: the suite is the only caller of createExpiredJWT inside the package besides tests/auth/jwt.test.ts; no export becomes dead.
- cand-gap8-02: remove the './auth' exports-map entry in packages/test-utils/package.json (also the './cloudflare', './factories', './constants' entries have the same shape; ./cloudflare etc. NOT verified here, only './auth' was in scope). Zero importers; every consumer uses the root barrel. Requires README.md:49,95 and CLAUDE.md:110 doc edits (README example imports from the subpath, so it would become wrong). Private package, so no npm consumers; no @public cover applies. Low value (config only, ~4 lines).

## Rejected
- Auth helpers (createTestJWT, createExpiredJWT, authHeaders) themselves: live via root barrel through presets-api.
- knip/turbo settings: only comments reference the directory; `$TURBO_DEFAULT$` hashes tracked files so no input glob needs editing.

## Notes
- Round-1 trigger check: none of DEAD-018..021 relate to this gap.
