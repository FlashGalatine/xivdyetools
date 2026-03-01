# DEAD-030: Stale Test Utilities (test-utils.integration.ts)

## Category
Stale Test Code

## Location
- `apps/discord-worker/src/test-utils.integration.ts`

### Unused Imports (3)
- `createMockKV` from `@xivdyetools/test-utils`
- `createMockD1` from `@xivdyetools/test-utils`
- `createMockAnalytics` from `@xivdyetools/test-utils`

### Unused Exports (2)
- `createFullMockEnv()` — constructs a complete mock Env for integration tests
- `assertDiscordJsonResponse()` — validates response shape matches Discord API

## Evidence
- TSC `--noUnusedLocals` flags the 3 imports.
- Grep for `createFullMockEnv` across all test files finds zero consumers outside its definition.
- Grep for `assertDiscordJsonResponse` finds zero consumers.
- The integration test approach was abandoned in favor of unit tests with targeted mocks.

## Why It Exists
Integration test scaffolding created during V4 development. Individual integration tests were either never written or were refactored to use simpler inline mocks.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero consumers |
| **Runtime Impact** | NONE (test-only) |
| **Build Impact** | None (test files aren't bundled) |
| **External Consumers** | None |

## Recommendation
**REMOVE** `test-utils.integration.ts` entirely. If integration tests are added later, recreate with fresh patterns.
