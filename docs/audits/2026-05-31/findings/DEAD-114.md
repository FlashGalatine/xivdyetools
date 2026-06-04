# DEAD-114: test-utils.integration.ts still present (continuation of DEAD-030)

## Category
Stale Test Code

## Location
- File(s): `apps/discord-worker/src/test-utils.integration.ts`
- Symbol(s): `createFullMockEnv()`, `assertDiscordJsonResponse()` (+ 3 unused imports)

## Evidence
**Continuation of 2026-02-28 DEAD-030**, which recommended REMOVE. The file **still exists** (confirmed by directory
listing) and is still unconsumed: grep across all `*.test.ts` finds zero importers of `createFullMockEnv` or
`assertDiscordJsonResponse` outside the file itself. The integration approach was abandoned in favor of unit tests with
inline mocks (`src/test-utils.ts` is the live helper).

## Why It Exists
Integration-test scaffolding created during V4 development; the integration tests it was built for were never written
(or were rewritten with simpler inline mocks). DEAD-030 flagged it in February; removal was deferred.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero consumers; re-confirmed unchanged since Feb |
| **Blast Radius** | NONE — test-only file, not bundled |
| **Reversibility** | EASY — git revert; recreate fresh if integration tests return |
| **Hidden Consumers** | None — not referenced by `vitest.integration.config.ts` |

## Recommendation
**REMOVE**

### Rationale
- Closes out DEAD-030. Removes stale scaffolding that misleads contributors into thinking an integration harness exists.

### If Removing
1. Delete `src/test-utils.integration.ts`.
2. `pnpm --filter xivdyetools-discord-worker run test` (unit) and `run test:integration` to confirm nothing referenced it.
3. Mark DEAD-030 resolved.
