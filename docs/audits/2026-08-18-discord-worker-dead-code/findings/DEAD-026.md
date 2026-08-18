# [DEAD-026]: test-utils — eight whole files (1,565 src + 2,752 test lines) with zero external consumers; only 14 of ~134 exports are imported anywhere

## Category
Orphaned Module (workspace-private package)

## Location
`packages/test-utils/src/`:

| File(s) | src lines | Notes |
|---|---|---|
| `dom/*` (canvas, fetch, localStorage, matchMedia, resizeObserver, index) — the `/dom` subpath | 760 (+~1,000 own tests) | web-app (the only browser test suite) has its own `matchMedia` stub in `src/__tests__/setup.ts` and does not depend on test-utils at all → no possible consumer today |
| `assertions/response.ts` (+index) — the `/assertions` subpath | 184 (+~250) | `assertJsonResponse` reaches only the presets-api shim (below); the other 6 asserts have zero references |
| `cloudflare/analytics.ts` (`createMockAnalyticsEngine`, `MockAnalyticsEngine`, `AnalyticsDataPoint`) | 74 | discord-worker's `src/test-utils.ts:50` has its own 4-line `createMockAnalytics` (DEAD-005) |
| `factories/user.ts` (`createMockUser`, `createMockUsers`, `createDiscordUser`, `createXIVAuthUser`, `userToRow`, `createMockUserRow`, `UserRow`) | 157 | zero external importers |
| `factories/vote.ts` (`createMockVoteRow` + alias `createMockVote` — knip "duplicate export", `createMockVotes`, `createVotesForPreset`, `createVotesFromUser`) | 97 | shim-only |
| `constants/secrets.ts` (13 `TEST_*` constants) | 86 | `TEST_SIGNING_SECRET` shim-only; other 12 zero references |
| `auth/context.ts` (`createAuthContext`, `createModeratorContext`, `createBotAuthContext`, `createWebAuthContext`, `createUnauthenticatedContext`, `AuthSource`) | 104 | shim-only |
| `auth/signature.ts` (`createBotSignature`, `createTimestampedSignature`, `verifyBotSignature` re-export) | 103 | shim-only |

"Shim-only" = re-exported by `apps/presets-api/tests/test-utils.ts` and then imported by **no** presets-api test (chain-dead: `createBotSignature`, `authHeadersWithSignature`, `createAuthContext`, `createModeratorContext`, `createUnauthenticatedContext`, `createMockPreset`, `createMockVoteRow`, `assertJsonResponse`, `TEST_SIGNING_SECRET`).

The 14 exports that ARE consumed: `createMockKV`, `createMockD1Database`, `createMockR2Bucket`, `MockR2Bucket`, `createMockFetcher`, `createMockDye`, `VALID_CODE_VERIFIER`, `VALID_CODE_CHALLENGE`, `createTestJWT`, `createExpiredJWT`, `authHeaders`, `createMockPresetRow`, `createMockSubmission`, `createMockCategoryRow`.

## Evidence
Named-import tally of `@xivdyetools/test-utils[/subpath]` across all workspaces (perl scan, `evidence/track-D-infra-packages.md` §5) + per-symbol grep. Consumers: api-worker (2 files), discord-worker (1), moderation-worker (7), oauth (1), presets-api (4), svg (3).

## Why It Exists
test-utils was built as a comprehensive kit (README documents every module) ahead of adoption; the apps kept their local mocks (DEAD-005) and only reached for the Cloudflare mocks and a few factories.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — the package is workspace-private (not published), so "unused in the monorepo" is definitive |
| **Blast Radius** | LOW — deleting files + their subpath entries in `package.json#exports` + README sections; presets-api's `tests/test-utils.ts` shim loses 9 unused lines |
| **Reversibility** | EASY |
| **Hidden Consumers** | None possible outside the workspace |

## Recommendation
**REMOVE** the eight files (+ tests, exports entries, README sections, `AuthSource` re-export). If `/dom` is wanted for the web-app later, it can come back from history when the web-app actually adopts test-utils.
