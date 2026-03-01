# DEAD-028: Test-Only Exports in discord-worker

## Category
Unused Export

## Location

### analytics.ts (4 symbols)
- `trackCommand()` — only imported by `analytics.test.ts`
- `incrementCounter()` — only imported by `analytics.test.ts`
- `getCounter()` — only imported by `analytics.test.ts`
- `trackUniqueUser()` — only imported by `analytics.test.ts`

### middleware.ts (3 symbols)
- `LoggerVariables` type — only imported by `middleware.test.ts`
- `getLogger()` — only imported by `middleware.test.ts`
- `getRequestId()` — only imported by `middleware.test.ts`

### emoji.ts (3 symbols)
- `getDyeEmojiOrFallback()` — only imported by `emoji.test.ts`
- `hasDyeEmoji()` — only imported by `emoji.test.ts`
- `getEmojiCount()` — only imported by `emoji.test.ts`

## Evidence
For each symbol, grep across `src/**/*.ts` (excluding `*.test.ts`) confirms zero production consumers:
- `analytics.ts`: Production code accesses analytics through Hono middleware context variables, not direct function imports.
- `middleware.ts`: The middleware is registered as Hono middleware; its internal helpers are only tested directly.
- `emoji.ts`: Commands use `getDyeEmoji()` (the primary export); the fallback/check/count variants serve test exploration only.

## Why It Exists
These exports follow a common pattern: internal implementation details are exported to enable unit testing. The functions work correctly and are covered by tests, but no production module imports them.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — these exports are intentional for testability |
| **Runtime Impact** | NONE |
| **Build Impact** | Minor cleanup |
| **External Consumers** | None |

## Recommendation
**DO NOT REMOVE** — these are a valid testing pattern. Consider adding a `@internal` JSDoc tag to signal intent. Alternatively, if test files are colocated, the functions could be unexported and tested via module internals.
