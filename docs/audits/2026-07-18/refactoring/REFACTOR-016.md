# [REFACTOR-016]: Duplicate MemoryRateLimiter singletons and dead public-rate-limit service in presets-api

## Priority
LOW

## Category
Dead Code / Duplicate State (confusing dual-bucket trap)

## Location
- File(s): `apps/presets-api/src/services/rate-limit-service.ts:28-61` (`ipRateLimiter`, `checkPublicRateLimit`, re-exported `getClientIp`) vs `apps/presets-api/src/middleware/rate-limit.ts:17-32` (the singleton actually wired into `publicRateLimitMiddleware`)
- Scope: module level

## Current State
Two independent `MemoryRateLimiter` singletons are constructed with identical config (`maxEntries: 10_000, cleanupInterval: 100`). The middleware's instance is the only one used for IP limiting (`src/index.ts:131` applies `publicRateLimitMiddleware`). `checkPublicRateLimit` and the re-exported `getClientIp` in rate-limit-service.ts have no production callers — grep across `src/` shows only self-references. The file's genuinely-used half is the D1-backed daily submission limit (`checkSubmissionRateLimit`, `getRemainingSubmissions`).

## Issues
- Anyone importing `checkPublicRateLimit` in the future would silently consume a *different* bucket than the middleware, undercounting combined traffic — a trap with no compile-time signal.
- Two identically-configured singletons imply a shared limiter that doesn't exist.
- Dead exports inflate the API surface of the service module.

## Proposed Refactoring
Delete `ipRateLimiter`, `checkPublicRateLimit`, and the `getClientIp` re-export from `rate-limit-service.ts` (keeping the D1 submission-limit half and its `RateLimitResult` usage). If a callable check is ever needed outside middleware, export the middleware module's singleton instead so there is exactly one bucket.

## Benefits
- Removes the dual-bucket trap and ~35 lines of dead code.
- Clarifies that `rate-limit-service.ts` owns *submission* limits and `middleware/rate-limit.ts` owns *IP* limits.

## Effort Estimate
LOW

## Risk Assessment
LOW. Verify first that no test file imports `checkPublicRateLimit` (tests/services/rate-limit-service.test.ts may exercise it — migrate or delete those cases alongside).

> Source: evidence/d1-workers-analysis.md (2026-07-18 deep-dive, d1-workers area)

## Status

**DONE 2026-07-19** — `ipRateLimiter`, `checkPublicRateLimit`, and the `getClientIp` re-export were deleted from rate-limit-service.ts (their tests migrated/removed); the module now owns submission limits only.
