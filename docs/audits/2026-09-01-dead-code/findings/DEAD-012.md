# DEAD-012: presets-api — four permanently-skipped tests (~145 lines), one of them superseded by the very next test in the file; the whole "Discord Bot Notifications" describe block is skipped

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/presets-api · **Semver:** NONE · **Category:** Stale Test

## Location
`apps/presets-api/tests/handlers/presets.test.ts`
- `:493-533` `it.skip('should create preset with valid data (requires Cloudflare Workers)')` — **`:534` is `it('should create preset successfully with mock executionCtx')`**, i.e. the same case, already solved
- `:3220-3324` `describe('Discord Bot Notifications')` — all three of its tests are `it.skip`, so the notification path shows three tests and runs none

## Evidence
- `evidence/skipped-tests.txt`: these four are the only `it.skip`/`todo` in the whole monorepo (the two other matches are prose in `e2e/ui-interactions.spec.ts` and `locale-switch.test.ts`).
- Reason given in each: "requires Cloudflare Workers ExecutionContext (for waitUntil)". That is solvable in this repo today — `apps/api-worker/src/universalis/test-setup.ts:96` `createMockExecutionContext` and `@xivdyetools/test-utils` both provide one, and the un-skipped sibling at `:534` proves it.
- `apps/presets-api/vitest.config.ts` runs `environment: 'node'` with no workers pool, so nothing will ever un-skip these by itself.

## Fix
**REFACTOR FIRST, then REMOVE the remainder.** (1) Delete `:493-533` outright — `:534` covers it. (2) For the three notification tests, pass a mock `ExecutionContext` and un-skip; if the notification path is being removed anyway (see DEAD-009 — `notifyModerators` is dead, but these test `DISCORD_WORKER`-binding notification, which is live), keep them and make them run. (3) If any cannot be made to run, delete it rather than leave a skip: a skipped test is coverage theatre.
Gate: `pnpm turbo run test --filter=xivdyetools-presets-api` — expect the count to rise by 3, not fall.

## Status
FIXED 2026-09-01 `15a7cea6` (+ `00a33fae`) — two skips deleted as duplicates, two un-skipped with assertions that can fail. Zero `it.skip` left in the monorepo.

