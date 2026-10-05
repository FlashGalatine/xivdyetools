# DEAD-041: test-utils integration/ suite only tests local re-implementations of presets-api auth: setup.ts 214 lines + 581 test lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** packages/test-utils · **Semver:** NONE · **Category:** Stale Test · **Origin:** MAIN

## Location
- `packages/test-utils/integration/setup.ts:1` — integration/ suite (setup.ts + 2 tests)

## Evidence
- Both suites define and test local copies (processBotAuth at bot-authentication.test.ts:59; verifyJWT/processAuth at jwt-validation.test.ts:66,127) and never import presets-api code. setup.ts's only importers are those two files. presets-api/tests/middleware/auth.test.ts covers the real behaviour.
  - Commands: grep imports in integration/*/*.test.ts: only vitest, ../setup.js, ../../src/auth/jwt.js; dead-code-check.txt lists integration/setup.ts as @testonly exempt; apps/presets-api/tests/middleware/auth.test.ts:105-147 covers valid/invalid BOT_API_SECRET, bad Authorization and moderator recognition, and imports createExpiredJWT; createTestJWT, createExpiredJWT and createMockD1Database keep many consumers outside integration/
- Re-verified independently in the completeness re-sweep, which also traced the config and doc mentions of the directory that the steps now list.
- Origin: git diff --stat 8ecb878f HEAD -- packages/ touches no test-utils file; app-side diff grep for integration/setup empty; pr-delta.txt has no test-utils entry

## Fix
**REMOVE WITH CAUTION.** Check two things first.
- Run pnpm --filter @xivdyetools/test-utils run test:coverage and confirm the 90% src/** thresholds still hold without the integration run (tests/auth/jwt.test.ts and tests/cloudflare/d1.test.ts should carry jwt.ts and d1.ts).
- Confirm presets-api auth.test.ts/auth-v2.test.ts still cover the expired/invalid JWT and moderator-from-JWT cases.
Optionally, port one case to createBotSignatureV2 against the real presets-api instead.

Steps: 1. Delete packages/test-utils/integration/ (setup.ts, discord-presets/bot-authentication.test.ts, oauth-presets/jwt-validation.test.ts).
2. Drop 'integration/**/*.test.ts' from packages/test-utils/vitest.config.ts test.include, and 'integration/**/*' from tsconfig.build.json exclude.
3. Update the comments at knip.jsonc:96 and turbo.json:30, plus packages/test-utils/CLAUDE.md and the .agents/skills mentions (traps/knip-and-dead-verdicts.md:37, dead-code-finder/SKILL.md:86).
4. Add a CHANGELOG entry.
5. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils, then pnpm dead-code:check (expect '25 test-only exempt', down from 26).

Correction from the final adversarial check: jwt-validation.test.ts is the only test inside test-utils that checks createTestJWT produces a valid HS256 signature (tests/auth/jwt.test.ts only decodes header and payload). After the deletion that check lives in presets-api tests/middleware/auth.test.ts:225 and :289, which the --filter=...@xivdyetools/test-utils gate still runs.

## Status
OPEN
