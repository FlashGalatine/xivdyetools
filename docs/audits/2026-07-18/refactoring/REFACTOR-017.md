# [REFACTOR-017]: handlers/presets.ts is a 776-line module mixing routing, validation, caching, retry/backoff, and dead-letter persistence

## Priority
LOW

## Category
Code Smell / Separation of Concerns (oversized handler module)

## Location
- File(s): `apps/presets-api/src/handlers/presets.ts` (776 lines; notification subsystem at 521-775: category cache 521-572, payload types 637-653, retry config/backoff 656-681, `notifyDiscordBot` 690-747, `storeFailedNotification` 754-775)
- Related: `apps/presets-api/src/handlers/moderation.ts:207-251` (reads `failed_notifications` — the other half of the dead-letter feature)
- Scope: module level

## Current State
The routes file contains, besides its six routes: the module-level category cache with promise deduplication (`getValidCategories`), the Discord notification payload types, the retry/exponential-backoff-with-jitter machinery, the service-binding call to the discord-worker, and the dead-letter insert (`storeFailedNotification`). Meanwhile `moderation.ts` separately queries and resolves `failed_notifications` rows, so one feature (notification dead-lettering) is split across two handler files with no shared service.

## Issues
- Retry/backoff and dead-letter logic cannot be unit-tested without standing up the whole router.
- The dead-letter write path and read path live in different files with only the table schema as their contract.
- 776 lines makes this the highest-churn, hardest-to-review file in the worker; unrelated changes collide here.
- Module-level mutable cache state (`cachedCategories`, `categoriesFetchPromise`) sits next to route definitions, obscuring its lifecycle.

## Proposed Refactoring
Pure moves, no behavior change:
1. `services/notification-service.ts` — payload types, retry config, `getBackoffDelay`, `notifyDiscordBot`, `storeFailedNotification`; give `moderation.ts` list/resolve helpers here too.
2. `services/category-service.ts` — `getValidCategories`, `resetCategoryCache`, cache state.
3. `handlers/presets.ts` keeps routes + request parsing + `validateSubmission`/`validateEditRequest` (which may themselves later fold into validation-service).

## Benefits
- Retry/dead-letter logic becomes independently testable (timer mocking, failure injection).
- The dead-letter feature has one owner module for both write and read paths.
- The routes file drops to roughly half its size, reducing review friction.

## Effort Estimate
LOW-MEDIUM

## Risk Assessment
LOW. Pure extraction; existing tests (`tests/handlers/presets.test.ts`) continue to cover the routes, and the moved functions keep their signatures. Watch the module-level cache state during the move — `resetCategoryCache` is exported for tests and must keep pointing at the same state the validator uses.

> Source: evidence/d1-workers-analysis.md (2026-07-18 deep-dive, d1-workers area)

## Status

**DONE 2026-07-19** — Notification subsystem (payload types, retry/backoff, dead-letter write + new list/resolve read helpers) extracted to `services/notification-service.ts`; category cache extracted to `services/category-service.ts` (re-exported from presets.ts for compatibility). moderation.ts consumes the shared dead-letter helpers.
