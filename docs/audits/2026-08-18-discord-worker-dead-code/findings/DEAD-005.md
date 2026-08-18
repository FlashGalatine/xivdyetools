# [DEAD-005]: `src/test-utils.ts` — 4 dead factories, and the file duplicates `@xivdyetools/test-utils`

## Category
Stale Test Code / Duplicate

## Location
- `apps/discord-worker/src/test-utils.ts` (144 lines): `createMockExecutionContext` (76-85), `createMockDye` (87-114), `createMockDyes` (116-123), `createMockPreset` (125-144) — DEAD (~70 lines); `createMockKV/D1/Analytics` — live only as helpers of `createMockEnv`
- 9 test files (about, stats, analytics, bot-i18n, component-context, i18n, preferences, preset-favorites, rate-limiter) each define a *local* `createMockKV`

## Evidence
The file's only importers are 3 test files, all importing `createMockEnv`. `grep -rnw createMockExecutionContext|createMockDyes|createMockPreset apps/discord-worker` → 0 hits outside the definition. `@xivdyetools/test-utils` (already a devDependency) exports `createMockKV`, `createMockD1Database`, `createMockAnalyticsEngine`, `createMockDye/Dyes`, `createMockPreset`, `createMockFetcher`. The one thing it lacks is a discord-worker-`Env`-typed `createMockEnv`.

## Why It Exists
Written before `@xivdyetools/test-utils` existed (or before discord-worker adopted it); the shared package was never back-ported into these tests.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for the 4 dead factories; MEDIUM for the consolidation (behavioural differences between local and shared mocks need a test run) |
| **Blast Radius** | LOW — test code only |
| **Reversibility** | EASY |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** the 4 dead factories now; **REFACTOR FIRST** for the rest — keep a thin `createMockEnv` that composes the shared mocks, and delete the 9 local `createMockKV` copies.

### If Removing
1. Delete lines 76-144 (4 factories). Run tests.
2. (Optional wave) Rewrite `createMockEnv` on top of `@xivdyetools/test-utils/cloudflare`; replace the 9 local `createMockKV`s. Note DEAD-007 removes `Env.DB`, so `createMockD1` goes with it.
