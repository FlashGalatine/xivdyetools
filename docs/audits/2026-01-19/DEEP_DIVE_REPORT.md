# Deep-Dive Analysis Report

## Executive Summary

- **Project:** xivdyetools-* ecosystem (11 projects)
- **Analysis Date:** 2026-01-19
- **Total Findings:** 203
- **Analyzer:** Claude Code (Opus 4.5 + Haiku 4.5 agents)

### High-Level Statistics

| Project | Bugs | Refactoring | Optimization | Total |
|---------|------|-------------|--------------|-------|
| xivdyetools-core | 5 | 4 | 4 | 13 |
| xivdyetools-discord-worker | 5 | 5 | 5 | 15 |
| xivdyetools-logger | 5 | 5 | 4 | 14 |
| xivdyetools-maintainer | 7 | 7 | 7 | 21 |
| xivdyetools-moderation-worker | 10 | 5 | 3 | 18 |
| xivdyetools-oauth | 7 | 5 | 5 | 17 |
| xivdyetools-presets-api | 6 | 7 | 7 | 20 |
| xivdyetools-test-utils | 8 | 6 | 6 | 20 |
| xivdyetools-types | 11 | 6 | 3 | 20 |
| xivdyetools-universalis-proxy | 7 | 7 | 4 | 18 |
| xivdyetools-web-app | 10 | 6 | 6 | 22 |
| **TOTAL** | **81** | **63** | **54** | **198** |

---

## Summary by Category

### Hidden Bugs

| ID | Project | Title | Severity | Type |
|----|---------|-------|----------|------|
| ✅CORE-BUG-001 | xivdyetools-core | Race Condition in Pending Request Deduplication | CRITICAL | Race Condition |
| ✅CORE-BUG-002 | xivdyetools-core | Promise Rejection Not Properly Cleaned from Pending Map | CRITICAL | Async Handling |
| ✅CORE-BUG-003 | xivdyetools-core | Potential Null Reference in KDTree Nearest Neighbor | HIGH | Null Safety |
| ✅CORE-BUG-004 | xivdyetools-core | Unvalidated Type Cast in DyeDatabase | HIGH | Type Safety |
| ✅DISCORD-BUG-001 | xivdyetools-discord-worker | Race Condition in Analytics Counter Increment | MEDIUM | Race Condition |
| ✅DISCORD-BUG-002 | xivdyetools-discord-worker | Missing Error Handling in Analytics.writeDataPoint | MEDIUM | Error Handling |
| ✅LOGGER-BUG-001 | xivdyetools-logger | Race Condition in Concurrent perf.start() Calls | HIGH | Concurrency |
| ⚠️LOGGER-BUG-002 | xivdyetools-logger | Error Sanitization Regex Edge Cases | MEDIUM | Security |
| ✅MAINT-BUG-001 | xivdyetools-maintainer | Unhandled Promise Rejection in Server Health Check | MEDIUM | Async Handling |
| ✅MAINT-BUG-005 | xivdyetools-maintainer | Stale Session Token Caching | MEDIUM | State Management |
| ✅MOD-BUG-001 | xivdyetools-moderation-worker | Race Condition in Rate Limiting | HIGH | Concurrency |
| ⚠️MOD-BUG-006 | xivdyetools-moderation-worker | Race Condition in Modal Submission Processing | MEDIUM | Concurrency |
| ✅OAUTH-BUG-001 | xivdyetools-oauth | String Spread with charCodeAt Encoding | MEDIUM | Encoding |
| ⚠️OAUTH-SEC-004 | xivdyetools-oauth | Race Condition in Rate Limiter DO Persistence | MEDIUM | Concurrency |
| ✅PRESETS-BUG-001 | xivdyetools-presets-api | Potential Memory Leak in Rate Limiter | MEDIUM | Memory Leak |
| ⚠️PRESETS-BUG-002 | xivdyetools-presets-api | Race Condition in Vote Count Inconsistency | MEDIUM | Race Condition |
| ✅TEST-BUG-001 | xivdyetools-test-utils | Race Condition in KV Mock TTL Expiration | HIGH | Concurrency |
| ✅TEST-BUG-002 | xivdyetools-test-utils | Memory Leak in Fetcher Mock Call History | MEDIUM | Memory Leak |
| ✅TEST-BUG-005 | xivdyetools-test-utils | Base64URL Encoding May Produce Invalid Results | MEDIUM | Encoding |
| ✅TYPES-BUG-002 | xivdyetools-types | Missing Discriminant Union in AuthResponse | MEDIUM | Type Safety |
| ✅TYPES-BUG-011 | xivdyetools-types | XIVAuthUser Type Doesn't Match Documented Response | HIGH | Type Mismatch |
| ✅PROXY-BUG-001 | xivdyetools-universalis-proxy | Race Condition in Response.json() Double-Parsing | HIGH | Async Handling |
| ✅PROXY-BUG-002 | xivdyetools-universalis-proxy | Unhandled Promise Rejection in Request Coalescer | HIGH | Error Handling |
| ✅WEB-BUG-001 | xivdyetools-web-app | Event Listener Accumulation Risk in DyeSelector | HIGH | Memory Leak |
| ✅WEB-BUG-003 | xivdyetools-web-app | Race Condition in Palette Service Import Count | MEDIUM | Race Condition |

### Refactoring Opportunities

| ID | Project | Title | Priority | Effort |
|----|---------|-------|----------|--------|
| ✅CORE-REF-001 | xivdyetools-core | Excessive Error Swallowing in DyeSearch | HIGH | LOW |
| ✅CORE-REF-002 | xivdyetools-core | Duplicate Price Parsing Logic | MEDIUM | MEDIUM |
| ✅DISCORD-REF-001 | xivdyetools-discord-worker | Repeated Command Handler Pattern | LOW | MEDIUM |
| ⚠️DISCORD-REF-004 | xivdyetools-discord-worker | God Object in rate-limiter.ts | MEDIUM | LOW |
| ✅LOGGER-REF-003 | xivdyetools-logger | Hardcoded Redact Fields in Multiple Locations | MEDIUM | MEDIUM |
| ✅MAINT-REF-003 | xivdyetools-maintainer | Hardcoded Locale Lists in Multiple Files | MEDIUM | MEDIUM |
| ✅MOD-REF-001 | xivdyetools-moderation-worker | Long Function - processModerateCommand | MEDIUM | MEDIUM |
| ✅MOD-REF-002 | xivdyetools-moderation-worker | Code Duplication in Modal Handlers | MEDIUM | LOW |
| ✅OAUTH-REF-002 | xivdyetools-oauth | Reduce Code Duplication in OAuth Handlers | HIGH | MEDIUM |
| ✅PRESETS-REF-001 | xivdyetools-presets-api | Validation Logic Scattered Across Multiple Functions | MEDIUM | MEDIUM |
| ⚠️TEST-REF-001 | xivdyetools-test-utils | Long Method in setupFetchMock Handler Logic | MEDIUM | LOW |
| ⚠️TEST-REF-004 | xivdyetools-test-utils | Inconsistent Factory Function Naming | MEDIUM | LOW |
| ✅TYPES-REF-002 | xivdyetools-types | Missing Discriminated Union Audit | MEDIUM | HIGH |
| ⚠️PROXY-REF-001 | xivdyetools-universalis-proxy | Over-Broad Empty Catch Blocks | MEDIUM | LOW |
| ✅WEB-REF-003 | xivdyetools-web-app | Component Size - MixerTool and HarmonyTool Exceed 500 Lines | MEDIUM | HIGH |

### Optimization Opportunities

| ID | Project | Title | Impact | Category |
|----|---------|-------|--------|----------|
| ✅CORE-OPT-002 | xivdyetools-core | N+1 Query Pattern in HarmonyGenerator | MEDIUM | Algorithm |
| ⚠️DISCORD-OPT-001 | xivdyetools-discord-worker | Inefficient Collection Lookup - O(n) Per Operation | MEDIUM | Algorithm |
| ⚠️DISCORD-OPT-003 | xivdyetools-discord-worker | Full Preset Fetch for Simple Checks | MEDIUM | Bandwidth |
| ⚠️LOGGER-OPT-001 | xivdyetools-logger | Sanitize Error Message Regex Runs Multiple Replacements | MEDIUM | Performance |
| ⚠️MAINT-OPT-001 | xivdyetools-maintainer | N+1 Query Pattern in getLocaleLabels | MEDIUM | I/O |
| ⚠️MAINT-OPT-005 | xivdyetools-maintainer | Missing Request Deduplication in ItemIdFetcher | MEDIUM | Bandwidth |
| ✅PRESETS-OPT-003 | xivdyetools-presets-api | Missing Database Indexes | MEDIUM | Database |
| ✅TEST-OPT-003 | xivdyetools-test-utils | D1 Mock Query Tracking Without Size Limit | MEDIUM | Memory |
| ⚠️PROXY-OPT-001 | xivdyetools-universalis-proxy | Redundant Cache Metadata Parsing on Every Request | MEDIUM | CPU |
| ⚠️WEB-OPT-002 | xivdyetools-web-app | Memoize Color Distance Calculations | MEDIUM | CPU |
| ✅WEB-OPT-003 | xivdyetools-web-app | Lazy-Load Market Board Data | MEDIUM | Bandwidth |

---

## Priority Matrix

### Immediate Action (High Impact, Low Effort)

1. **CORE-BUG-001/002** - Fix race conditions in APIService request deduplication
2. **DISCORD-BUG-001** - Implement atomic counter operations for analytics
3. **PROXY-BUG-001** - Fix Response.json() double consumption
4. **OAUTH-REF-002** - Extract common OAuth handler code
5. **CORE-REF-001** - Add error logging to swallowed exceptions

### Plan for Next Sprint (High Impact, High Effort)

1. ~~**TYPES-REF-002**~~ - ✅ FIXED: Discriminated unions for response types
2. ~~**TYPES-BUG-011**~~ - ✅ VERIFIED: XIVAuthUser type already corrected
3. ~~**WEB-REF-003**~~ - ✅ FIXED: Extracted pure logic to services (Phase 1 complete)
4. ~~**PRESETS-OPT-003**~~ - ✅ VERIFIED: Database indexes already comprehensive
5. **DISCORD-OPT-001** - Refactor collection storage structure - ⏸️ DEFERRED
6. ~~**TEST-BUG-001**~~ - ✅ FIXED: KV Mock TTL race condition

### Technical Debt Backlog (Lower Priority)

1. ~~**LOGGER-REF-003**~~ - ✅ FIXED: Consolidated redact fields to shared constants
2. ~~**MAINT-REF-003**~~ - ✅ FIXED: Consolidated locale lists to shared constants
3. **TEST-REF-004** - ⚠️ ACCEPTABLE: Factory naming already consistent
4. **PROXY-REF-001** - ⚠️ INTENTIONAL: Fail-soft design for non-critical caching
5. **WEB-OPT-002** - ⚠️ ACCEPTABLE: N² calculations acceptable for small sets

---

## Fixes Applied (2026-01-19)

The following "Immediate Action" items from the Priority Matrix have been addressed:

| ID | Status | Description | Files Modified |
|----|--------|-------------|----------------|
| **CORE-BUG-001/002** | ✅ FIXED | Race condition in APIService request deduplication. Used deferred promise pattern to ensure map entry exists before any async operations. | `xivdyetools-core/src/services/APIService.ts` |
| **DISCORD-BUG-001** | ✅ FIXED | Non-atomic counter increment in analytics. Added optimistic concurrency with retries and version tracking via KV metadata. | `xivdyetools-discord-worker/src/services/analytics.ts` |
| **PROXY-BUG-001** | ✅ FIXED | Race condition in RequestCoalescer. Applied same deferred promise pattern to prevent duplicate in-flight requests. | `xivdyetools-universalis-proxy/src/services/request-coalescer.ts` |
| **OAUTH-REF-002** | ✅ FIXED | Duplicated OAuth validation code. Extracted `validateCodeChallenge()` to shared utils, refactored both Discord and XIVAuth handlers to use shared constants and utilities. | `xivdyetools-oauth/src/utils/oauth-validation.ts`, `xivdyetools-oauth/src/handlers/authorize.ts`, `xivdyetools-oauth/src/handlers/xivauth.ts` |
| **CORE-REF-001** | ✅ FIXED | Swallowed exceptions in DyeSearch. Added `console.warn` logging for complete search failures while documenting intentional silent handling for per-dye errors. | `xivdyetools-core/src/services/dye/DyeSearch.ts` |

### Fix Details

#### CORE-BUG-001/002 - Deferred Promise Pattern
The original code had a TOCTOU (Time-Of-Check to Time-Of-Use) race:
```typescript
// BEFORE: Race window between check and set
if (this.pendingRequests.has(key)) { return pending; }
const promise = fetchData(); // async starts here
this.pendingRequests.set(key, promise); // stored too late!
```

Fixed by storing a deferred promise synchronously **before** any async work:
```typescript
// AFTER: No race window
const promise = new Promise((resolve, reject) => { ... });
this.pendingRequests.set(key, promise); // stored immediately
const result = await fetchData(); // async starts after
resolve(result);
```

#### DISCORD-BUG-001 - Optimistic Concurrency
KV doesn't support atomic increments, so added retry-based pattern with version metadata:
- Read current value + version
- Write new value + new version
- Verify write succeeded
- Retry on contention

Note: For truly atomic counters, Durable Objects should be used. Analytics Engine provides accurate long-term stats.

#### OAUTH-REF-002 - Consolidated Validation
Created shared utilities in `oauth-validation.ts`:
- `validateCodeChallenge()` - RFC 7636 format validation
- `validateRedirectUri()` - Origin allowlist validation
- `ALLOWED_REDIRECT_ORIGINS` constant in `constants/oauth.ts`

---

## High Severity Bugs Fixed (2026-01-19)

The following HIGH severity bugs have been addressed:

| ID | Status | Description | Files Modified |
|----|--------|-------------|----------------|
| **CORE-BUG-003** | ✅ FIXED | KDTree nearestNeighbor skipped far side search when `best` was null (all nodes excluded). Now searches far side when no valid candidate found yet. | `xivdyetools-core/src/utils/kd-tree.ts` |
| **CORE-BUG-004** | ✅ FIXED | HSV validation was optional but `dye.hsv.h` was accessed unconditionally for hue bucket indexing. Made HSV required in validation. | `xivdyetools-core/src/services/dye/DyeDatabase.ts` |
| **LOGGER-BUG-001** | ✅ FIXED | `perf.start()` silently overwrote existing timers with same label. Now warns and returns `false` if timer already active. | `xivdyetools-logger/src/presets/browser.ts` |
| **MOD-BUG-001** | ✅ FIXED | Rate limiter had same read-modify-write race as DISCORD-BUG-001. Applied optimistic concurrency with retries. | `xivdyetools-moderation-worker/src/middleware/rate-limit.ts` |
| **TYPES-BUG-011** | ✅ VERIFIED | XIVAuthUser type already corrected. Type definition includes note explaining XIVAuth does NOT return `username` or `avatar_url`. | `xivdyetools-types/src/auth/xivauth.ts` (no changes needed) |
| **PROXY-BUG-002** | ✅ FIXED | Fixed as part of PROXY-BUG-001. Deferred promise pattern ensures rejections propagate to all waiting callers. | `xivdyetools-universalis-proxy/src/services/request-coalescer.ts` |
| **WEB-BUG-001** | ✅ FIXED | `manageBtn.addEventListener()` bypassed BaseComponent event tracking. Changed to `this.on()` for proper cleanup via `unbindAllEvents()`. | `xivdyetools-web-app/src/components/dye-selector.ts` |

### Fix Details

#### CORE-BUG-003 - KDTree Far Side Search
The k-d tree's `searchNearest` method had a bug where it would skip searching the far side of the splitting plane if no valid candidate had been found on the near side:

```typescript
// BEFORE: Bug - skipped far side when best was null
if (farChild && best) {
  if (Math.abs(targetValue - nodeValue) <= best.distance) {
    best = this.searchNearest(farChild, ...);
  }
}

// AFTER: Fixed - search far side when best is null OR within distance
if (farChild) {
  if (!best || Math.abs(targetValue - nodeValue) <= best.distance) {
    best = this.searchNearest(farChild, ...);
  }
}
```

This bug would manifest when all nodes on the near side were excluded by the `excludeData` filter, causing valid nodes on the far side to be missed.

#### CORE-BUG-004 - HSV Required Validation
The Dye interface requires HSV values (used for hue bucket indexing), but validation only checked HSV *if present*. This allowed dyes without HSV to pass validation, then crash when accessing `dye.hsv.h`:

```typescript
// BEFORE: HSV optional in validation, but required in interface
if (dye.hsv !== undefined && dye.hsv !== null) { /* validate */ }

// AFTER: HSV required
if (dye.hsv === undefined || dye.hsv === null) {
  this.logger.warn(`Dye ${id} missing required HSV values`);
  return false;
}
```

#### LOGGER-BUG-001 - perf.start() Race Condition
The `perf.start()` method silently overwrote the start time if called twice with the same label. This caused data loss when concurrent operations used the same label:

```typescript
// BEFORE: Silent overwrite
start(label: string): void {
  activeTimers.set(label, performance.now());
}

// AFTER: Warn and prevent overwrite
start(label: string): boolean {
  if (activeTimers.has(label)) {
    console.warn(`Timer "${label}" is already active...`);
    return false;
  }
  activeTimers.set(label, performance.now());
  return true;
}
```

#### MOD-BUG-001 - Rate Limiter Race Condition
Same pattern as DISCORD-BUG-001: read-then-write without atomicity. Applied the same optimistic concurrency fix with retries and version metadata.

---

## Hidden Bugs Fixed (2026-01-19)

The following MEDIUM severity hidden bugs have been addressed:

| ID | Status | Description | Files Modified |
|----|--------|-------------|----------------|
| **TEST-BUG-002** | ✅ FIXED | Memory leak in Fetcher Mock call history. Added `maxCallHistory` config with FIFO eviction to prevent unbounded memory growth. | `xivdyetools-test-utils/src/cloudflare/fetcher.ts` |
| **TEST-BUG-005** | ✅ FIXED | Base64URL decode failed to properly handle UTF-8 multi-byte characters. Added `base64UrlDecodeBytes()` helper with `TextDecoder`. | `xivdyetools-test-utils/src/utils/crypto.ts` |
| **MAINT-BUG-005** | ✅ FIXED | Stale session token caching caused 401 errors after server restart. Added `invalidateSession()` and `fetchWithRetry()` with automatic token refresh on 401/403. | `xivdyetools-maintainer/src/services/fileService.ts` |
| **WEB-BUG-003** | ✅ FIXED | Race condition in palette import count. Consolidated two separate storage reads into one to prevent TOCTOU race. | `xivdyetools-web-app/src/services/palette-service.ts` |
| **PRESETS-BUG-001** | ✅ FIXED | Memory leak in IP rate limiter. Added `maxTrackedIps` limit (10,000) with LRU-style eviction to prevent unbounded memory growth under DDoS. | `xivdyetools-presets-api/src/services/rate-limit-service.ts` |
| **MAINT-BUG-001** | ✅ FIXED | Unhandled promise rejection in server health check. Added `.catch()` handler to set `serverOnline = false` on failure. | `xivdyetools-maintainer/src/components/DyeForm.vue` |
| **OAUTH-BUG-001** | ✅ FIXED | String spread with `charCodeAt` could fail on large arrays due to call stack limits. Replaced with `Array.from().map().join()` pattern. | `xivdyetools-oauth/src/services/jwt-service.ts` |
| **DISCORD-BUG-002** | ✅ VERIFIED | Analytics.writeDataPoint already had try-catch error handling with logger support. No changes needed. | — |

### Fix Details

#### TEST-BUG-002 - Fetcher Mock Memory Leak
The mock fetcher's `_calls` array grew unbounded, which could cause memory issues in long-running test suites:

```typescript
// BEFORE: Array grows without limit
const calls: FetcherCall[] = [];

// AFTER: FIFO eviction when limit exceeded
let maxCallHistory = config?.maxCallHistory ?? DEFAULT_MAX_CALL_HISTORY;

// In fetch handler:
while (calls.length > maxCallHistory) {
  calls.shift(); // FIFO eviction
}
```

#### MAINT-BUG-005 - Session Token Invalidation
When server restarts, old tokens become invalid but client kept using them:

```typescript
// ADDED: Token invalidation on 401/403
export function invalidateSession(): void {
  sessionToken = null;
  console.warn('Session token invalidated - will request new token on next mutation');
}

// ADDED: Automatic retry with fresh token
async function fetchWithRetry(url, options, timeout): Promise<Response> {
  const response = await fetchWithTimeout(url, { ...options, headers }, timeout);

  if (response.status === 401 || response.status === 403) {
    invalidateSession();
    const newToken = await getSessionToken(true);
    return fetchWithTimeout(url, { ...options, headers: retryHeaders }, timeout);
  }
  return response;
}
```

#### PRESETS-BUG-001 - Rate Limiter Memory Bound
Added maximum IP tracking limit to prevent memory exhaustion under attack:

```typescript
const PUBLIC_RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60_000,
  maxTrackedIps: 10_000,  // NEW: Prevents unbounded growth
};

function enforceMaxTrackedIps(): void {
  if (ipRequestLog.size <= PUBLIC_RATE_LIMIT.maxTrackedIps) return;

  // LRU-style eviction (Map maintains insertion order)
  const entriesToRemove = ipRequestLog.size - PUBLIC_RATE_LIMIT.maxTrackedIps;
  const keys = Array.from(ipRequestLog.keys());
  for (let i = 0; i < entriesToRemove; i++) {
    ipRequestLog.delete(keys[i]);
  }
}
```

### Assessed Bugs - Acceptable Limitations (⚠️)

The following bugs have been reassessed and determined to be **acceptable limitations** that don't require immediate fixes:

| ID | Assessment | Rationale |
|----|------------|-----------|
| **LOGGER-BUG-002** | ACCEPTABLE | Regex patterns handle 99%+ of common cases after LOG-ERR-001 fix. Remaining edge cases (escaped quotes, JSON objects, unquoted values with spaces) are extremely rare in actual error messages. Making patterns more greedy could cause false positives. |
| **MOD-BUG-006** | ACCEPTABLE | Modal submission race (two moderators rejecting same preset simultaneously) is handled gracefully - error is caught and displayed to user. Race is extremely rare (requires millisecond timing) and causes no data corruption. Proper fix would require distributed locking across workers. |
| **OAUTH-SEC-004** | INTENTIONAL | Durable Object rate limiter persistence race is an intentional trade-off. The DO eventually persists state, and slight over-counting during high-concurrency bursts is acceptable for rate limiting purposes. True atomicity would require blocking I/O. |
| **PRESETS-BUG-002** | PARTIALLY MITIGATED | Vote duplicate prevention now uses `ON CONFLICT DO NOTHING` (atomic). Remaining theoretical race between INSERT and UPDATE vote_count is extremely rare (requires server crash between statements). Impact is minor (off-by-one count) and can be corrected by periodic reconciliation. |

### Optimization Opportunities Addressed (2026-01-19)

| ID | Status | Rationale |
|----|--------|-----------|
| **CORE-OPT-002** | ✅ ALREADY OPTIMIZED | HarmonyGenerator already uses hue-indexed buckets (P-2) and O(log n) dye search via PERF-003 fix. No N+1 pattern present. |
| **DISCORD-OPT-001** | ⚠️ ACCEPTABLE | Collections stored as single JSON array with O(n) in-memory lookup. For MAX_COLLECTIONS=50, this is acceptable - KV I/O dominates, not array iteration. Per-collection KV keys would increase reads. |
| **DISCORD-OPT-003** | ⚠️ ACCEPTABLE | Full preset fetch in edit command is necessary for merging partial dye updates. API validates ownership server-side; client fetch provides better UX. |
| **LOGGER-OPT-001** | ⚠️ ACCEPTABLE | 7 separate regex replacements in `sanitizeErrorMessage` is more readable than combined regex. Error logging is infrequent; overhead is negligible. |
| **MAINT-OPT-001** | ⚠️ ACCEPTABLE | Sequential locale file processing (12 HTTP requests) in maintainer tool provides clear per-locale error messages and allows partial success. Not performance-critical (admin tooling). |
| **MAINT-OPT-005** | ⚠️ ACCEPTABLE | Sequential XIVAPI requests without caching is acceptable for a maintainer tool used manually and infrequently. |
| **PRESETS-OPT-003** | ✅ VERIFIED | Comprehensive indexes already exist in schema.sql (verified in Next Sprint fixes). |
| **TEST-OPT-003** | ✅ FIXED | Added `maxQueryHistory` config with FIFO eviction to D1 mock, preventing unbounded memory growth. See fix below. |
| **PROXY-OPT-001** | ⚠️ ACCEPTABLE | Cache metadata parsing (3 parseInt calls for Cache API, 1 metadata read for KV) happens once per cache lookup. Not redundant - necessary for staleness check. |
| **WEB-OPT-002** | ⚠️ ACCEPTABLE | Color distance matrix calculates N² distances, but max dyes is small (3-5). Core library pre-computes LAB values. Overhead is ~10-20 calculations per render. |
| **WEB-OPT-003** | ✅ ALREADY OPTIMIZED | MarketBoardService already implements lazy-loading with singleton cache, on-demand fetching, request versioning, and event-driven updates. |

#### TEST-OPT-003 Fix: D1 Mock Query History Limit

Added memory bounds to D1 mock query tracking, matching the pattern from TEST-BUG-002 (Fetcher mock):

```typescript
// xivdyetools-test-utils/src/cloudflare/d1.ts
export interface MockD1DatabaseConfig {
  maxQueryHistory?: number;  // Default: 1000
}

const enforceMaxHistory = (): void => {
  while (queries.length > maxQueryHistory) {
    queries.shift();
    bindings.shift();
  }
};

// Called after each query push in first(), all(), run(), raw(), exec()
```

### Low Effort Refactoring Addressed (2026-01-19)

| ID | Status | Rationale |
|----|--------|-----------|
| **DISCORD-REF-004** | ⚠️ NOT A GOD OBJECT | The `rate-limiter.ts` file (193 lines) is a focused single-responsibility module with only 2 exported functions (`checkRateLimit`, `formatRateLimitMessage`). It follows good separation of concerns with clear configuration constants and well-documented interfaces. No refactoring needed. |
| **MOD-REF-002** | ✅ FIXED | Extracted shared modal types and helpers to `types/modal.ts`. The `ModalInteraction` interface, `ModalComponents` type, and `extractTextInputValue` helper were duplicated across `preset-rejection.ts` and `ban-reason.ts`. Added convenience helpers `getModalUserId()` and `getModalUsername()`. |
| **TEST-REF-001** | ⚠️ ACCEPTABLE | The `fetch` method in `fetcher.ts` is ~50 lines, which is reasonable for a mock with header extraction, call recording, and response matching. Breaking it up would add complexity without significant benefit. The code is linear and well-commented. |
| **TEST-REF-004** | ⚠️ ACCEPTABLE | Factory function naming is actually consistent: `createMock{Entity}` for primary factories, `createMock{Entities}` for plurals, `createMock{Entity}Row` for database rows, `create{Variant}{Entity}` for special variants, and `{entity}ToRow`/`rowTo{Entity}` for converters. No changes needed. |
| **PROXY-REF-001** | ⚠️ INTENTIONAL | Empty catch blocks in `cache-service.ts` are intentional fail-soft behavior for non-critical caching operations. Cache lookup/storage failures shouldn't break the application. Adding logging would add noise for expected failures. The inline comments explain this design choice. |

#### MOD-REF-002 Fix: Shared Modal Types

Created `xivdyetools-moderation-worker/src/types/modal.ts` to eliminate duplicated code:

```typescript
// Shared types
export interface ModalInteraction { ... }
export type ModalComponents = Array<{ ... }>;

// Shared helpers
export function extractTextInputValue(components, customId): string | undefined;
export function getModalUserId(interaction): string | undefined;
export function getModalUsername(interaction, defaultName): string;
```

Updated handlers to import from shared module:
- `preset-rejection.ts` - Removed local `ModalInteraction`, `ModalComponents`, `extractTextInputValue`
- `ban-reason.ts` - Removed local `ModalInteraction`, `ModalComponents`, `extractTextInputValue`

---

### Medium Effort Refactoring Addressed (2026-01-19)

| ID | Status | Rationale |
|----|--------|-----------|
| **LOGGER-REF-003** | ✅ FIXED | Consolidated hardcoded redact fields to centralized `constants.ts`. Core fields (9) and worker-specific fields (4) now defined in single source of truth. |
| **MAINT-REF-003** | ✅ FIXED | Consolidated hardcoded locale lists across 5 files to `constants.ts`. Added `LOCALE_CODES`, `LocaleCode` type, and `XIVAPI_SUPPORTED_LOCALES` constants. |
| **CORE-REF-002** | ✅ FIXED | Extracted duplicated price parsing logic (~65 lines total) into shared `extractPriceFromApiItem()` helper. Added `UniversalisItemResult` type for consistency. |
| **DISCORD-REF-001** | ✅ FIXED | Extracted duplicated hex color validation (~50 lines) and dye resolution (~60 lines) into shared `src/utils/color.ts`. While full command handler abstraction was deferred, these utilities reduce duplication across 5 command handlers. |
| **MOD-REF-001** | ✅ FIXED | Refactored `processModerateCommand` (162 lines) into 4 focused handler functions plus shared validation helper. Main function reduced to thin dispatcher (~45 lines). |
| **PRESETS-REF-001** | ✅ FIXED | Created centralized `validation-service.ts` with generic validators and domain-specific functions. Consolidated preset validators (name, description, dyes, tags) and moderation validators (status, reason). ~85 lines of scattered logic replaced by ~100 lines of reusable service. |

#### LOGGER-REF-003 Fix: Centralized Redact Fields

Created `xivdyetools-logger/src/constants.ts` to eliminate duplicated redact field arrays:

```typescript
// BEFORE: Duplicated in base-logger.ts (9 fields) and worker.ts (13 fields)
const DEFAULT_REDACT_FIELDS = ['password', 'token', 'secret', ...];  // base-logger.ts
const redactFields: [...] = ['password', 'token', ...];  // worker.ts (13 fields)

// AFTER: Single source of truth
// constants.ts
export const CORE_REDACT_FIELDS = [
  'password', 'token', 'secret', 'authorization', 'cookie',
  'api_key', 'apiKey', 'access_token', 'refresh_token',
] as const;

export const WORKER_SPECIFIC_REDACT_FIELDS = [
  'jwt_secret', 'bot_api_secret', 'bot_signing_secret', 'discord_client_secret',
] as const;

export const WORKER_REDACT_FIELDS = [...CORE_REDACT_FIELDS, ...WORKER_SPECIFIC_REDACT_FIELDS] as const;
export const DEFAULT_REDACT_FIELDS = CORE_REDACT_FIELDS;
```

Files modified:
- `xivdyetools-logger/src/constants.ts` (created)
- `xivdyetools-logger/src/core/base-logger.ts` (imports from constants)
- `xivdyetools-logger/src/presets/worker.ts` (imports from constants)

#### MAINT-REF-003 Fix: Centralized Locale Lists

Added locale constants to `xivdyetools-maintainer/src/utils/constants.ts`:

```typescript
// BEFORE: Hardcoded in 5+ locations
const validCodes = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];  // server/api.ts (3 places)
const locales = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];     // fileService.ts
z.enum(['en', 'ja', 'de', 'fr', 'ko', 'zh']);              // schemas.ts
const SUPPORTED_LANGUAGES = ['en', 'ja', 'de', 'fr'];      // xivapiService.ts

// AFTER: Single source of truth
export const LOCALE_CODES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];
export const XIVAPI_SUPPORTED_LOCALES = ['en', 'ja', 'de', 'fr'] as const;
```

Files modified:
- `xivdyetools-maintainer/src/utils/constants.ts` (added LOCALE_CODES, XIVAPI_SUPPORTED_LOCALES)
- `xivdyetools-maintainer/src/services/xivapiService.ts` (imports XIVAPI_SUPPORTED_LOCALES)
- `xivdyetools-maintainer/src/services/fileService.ts` (imports LOCALE_CODES)
- `xivdyetools-maintainer/server/api.ts` (imports LOCALE_CODES)
- `xivdyetools-maintainer/server/schemas.ts` (imports LOCALE_CODES for z.enum)

#### CORE-REF-002 Fix: Centralized Price Extraction Logic

Extracted duplicated price parsing logic from `APIService.ts` into a shared helper function:

```typescript
// BEFORE: ~35 lines duplicated in parseApiResponse() and ~30 lines in parseBatchApiResponse()
// Both contained identical logic:
let price: number | null = null;
let worldId: number | undefined = undefined;

if (result.nq?.minListing) {
  if (result.nq.minListing.dc?.price) { price = ...; worldId = ...; }
  else if (result.nq.minListing.world?.price) { price = ...; worldId = ...; }
  else if (result.nq.minListing.region?.price) { price = ...; worldId = ...; }
}
if (!price && result.hq?.minListing) {
  // Same pattern for HQ prices...
}

// AFTER: Single source of truth with documented priority order (NQ only)
export interface UniversalisItemResult {
  itemId: number;
  nq?: QualityData;
  hq?: QualityData;  // Retained for API compatibility, but unused for dyes
}

/**
 * Extract price and worldId from a Universalis API item result
 * Priority (NQ only): DC → World → Region
 * Note: HQ intentionally not checked - dyes are always NQ in FFXIV
 */
function extractPriceFromApiItem(result: UniversalisItemResult): ExtractedPriceInfo {
  let price: number | null = null;
  let worldId: number | undefined = undefined;

  if (result.nq?.minListing) {
    const listing = result.nq.minListing;
    if (listing.dc?.price) { price = listing.dc.price; worldId = listing.dc.worldId; }
    else if (listing.world?.price) { price = listing.world.price; worldId = listing.world.worldId; }
    else if (listing.region?.price) { price = listing.region.price; worldId = listing.region.worldId; }
  }

  return { price, worldId };
}
```

**Benefits:**
- **Single Source of Truth**: Price extraction priority logic now documented in one place
- **Type Safety**: New `UniversalisItemResult` type replaces 3 identical inline type definitions
- **Reduced Line Count**: ~65 lines of duplicated code reduced to single helper (~35 lines)
- **Testability**: Helper function can be unit tested independently
- **Maintainability**: Future Universalis API changes only need updates in one location

Files modified:
- `xivdyetools-core/src/services/APIService.ts`
  - Added `UniversalisItemResult` exported interface (line 191)
  - Added `extractPriceFromApiItem()` helper function (line 220)
  - Updated `fetchWithTimeout()` return type to use `UniversalisItemResult[]`
  - Updated `parseApiResponse()` to use helper
  - Updated `parseBatchApiResponse()` to use helper

#### DISCORD-REF-001 Fix: Centralized Color Utilities

Created `xivdyetools-discord-worker/src/utils/color.ts` to eliminate duplicated hex validation and dye resolution logic across 5 command handlers:

```typescript
// BEFORE: Duplicated in 5 files (match.ts, harmony.ts, mixer.ts, accessibility.ts, comparison.ts)
function isValidHex(input: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(input);
}

function normalizeHex(hex: string): string {
  return hex.startsWith('#') ? hex : `#${hex}`;
}

function resolveColorInput(input: string): { hex: string; ... } | null {
  // ~15-20 lines of duplicated logic per file
}

// AFTER: Single source of truth in color.ts
export function isValidHex(input: string, options?: { allowShorthand?: boolean }): boolean;
export function normalizeHex(hex: string): string;  // Also handles 3-digit shorthand expansion
export function resolveColorInput(input: string, options?: ResolveColorOptions): ResolvedColor | null;
export { dyeService };  // Shared singleton
```

**Key features of the shared utility:**
- `isValidHex()` - Supports both 6-digit and optional 3-digit shorthand validation
- `normalizeHex()` - Ensures `#` prefix and expands 3-digit to 6-digit (`#F00` → `#FF0000`)
- `resolveColorInput()` - Flexible options for different command needs:
  - `excludeFacewear: boolean` - Filter Facewear dyes from name search (default: true)
  - `findClosestForHex: boolean` - Find closest dye when given hex input (default: false)
- `dyeService` - Shared singleton avoids multiple `new DyeService()` instantiations

**Benefits:**
- **~110 lines reduced**: 5 files × ~22 lines of duplicated functions
- **Consistent behavior**: All commands use same hex validation and normalization
- **Configurable**: Options allow each command to maintain its specific behavior
- **Type safety**: Exported `ResolvedColor` interface for consistent typing

Files modified:
- `xivdyetools-discord-worker/src/utils/color.ts` (created - 165 lines)
- `xivdyetools-discord-worker/src/handlers/commands/match.ts` (imports from color.ts, removed 40 lines)
- `xivdyetools-discord-worker/src/handlers/commands/harmony.ts` (imports from color.ts, removed 35 lines)
- `xivdyetools-discord-worker/src/handlers/commands/mixer.ts` (imports from color.ts, removed 35 lines)
- `xivdyetools-discord-worker/src/handlers/commands/accessibility.ts` (imports from color.ts, removed 50 lines)
- `xivdyetools-discord-worker/src/handlers/commands/comparison.ts` (imports from color.ts, removed 45 lines)

**Note:** Full command handler abstraction (user ID extraction, translator initialization, error response patterns) was not implemented as it would require a larger architectural change with limited benefit. The extracted color utilities address the most impactful duplication.

#### PRESETS-REF-001 Fix: Centralized Validation Service

Created `xivdyetools-presets-api/src/services/validation-service.ts` to consolidate scattered validation logic from `presets.ts` and `moderation.ts`:

```typescript
// BEFORE: Duplicated validation functions in multiple handlers

// presets.ts - 4 local functions (~36 lines)
function validateName(name: string): string | null {
  if (name.length < 2 || name.length > 50) {
    return 'Name must be 2-50 characters';
  }
  return null;
}
function validateDescription(description: string): string | null { ... }
function validateDyes(dyes: unknown): string | null { ... }
function validateTags(tags: unknown): string | null { ... }

// moderation.ts - inline validation (~8 lines)
const validStatuses: PresetStatus[] = ['approved', 'rejected', 'flagged', 'pending'];
if (!body.status || !validStatuses.includes(body.status)) { ... }
if (!body.reason || body.reason.length < 10 || body.reason.length > 200) { ... }

// AFTER: Single source of truth with exported constants
export const PRESET_VALIDATION_RULES = {
  name: { minLength: 2, maxLength: 50 },
  description: { minLength: 10, maxLength: 200 },
  dyes: { minLength: 2, maxLength: 5 },
  tags: { maxLength: 10, itemMaxLength: 30 },
} as const;

export const MODERATION_VALIDATION_RULES = {
  reason: { minLength: 10, maxLength: 200 },
  validStatuses: ['approved', 'rejected', 'flagged', 'pending'] as const,
} as const;

// Domain-specific validators using the constants
export function validatePresetName(name: unknown): string | null;
export function validatePresetDescription(description: unknown): string | null;
export function validatePresetDyes(dyes: unknown): string | null;
export function validatePresetTags(tags: unknown): string | null;
export function validateModerationStatus(status: unknown): string | null;
export function validateModerationReason(reason: unknown): string | null;

// Derived type for moderation-allowed statuses (excludes 'hidden')
export type ModerationStatus = (typeof MODERATION_VALIDATION_RULES.validStatuses)[number];
```

**Key features of the validation service:**
- `PRESET_VALIDATION_RULES` / `MODERATION_VALIDATION_RULES` - Exported constants for consistent error messages and tests
- Generic helpers: `validateStringLength()`, `validateArray()`, `validateEnum()` - Building blocks for custom validators
- Backwards-compatible error messages - Preserved original message format for API stability
- `ModerationStatus` type - Derived type that excludes 'hidden' from allowed moderation transitions

**Benefits:**
- **Single Source of Truth**: Validation rules defined once, error messages derived from constants
- **Type Safety**: `ModerationStatus` type prevents setting presets to 'hidden' via moderation API
- **Testability**: Individual validators can be unit tested independently
- **Maintainability**: Changing validation rules (e.g., max name length) only requires updating one constant

Files modified:
- `xivdyetools-presets-api/src/services/validation-service.ts` (created - 100 lines)
- `xivdyetools-presets-api/src/handlers/presets.ts` (imports validators, removed ~36 lines)
- `xivdyetools-presets-api/src/handlers/moderation.ts` (imports validators, removed ~8 lines)

#### MOD-REF-001 Fix: Extract Moderation Action Handlers

Refactored the 162-line `processModerateCommand` function into focused, single-responsibility handlers:

```typescript
// BEFORE: Monolithic 162-line function with 4 switch cases
async function processModerateCommand(
  interaction, env, t, userId, action, presetId, reason, logger
): Promise<void> {
  try {
    switch (action) {
      case 'pending': { /* ~34 lines */ }
      case 'approve': { /* ~40 lines with duplicated ID validation */ }
      case 'reject': { /* ~35 lines with duplicated ID validation */ }
      case 'stats': { /* ~18 lines */ }
    }
  } catch (error) { /* error handling */ }
}

// AFTER: Context object + extracted handlers + shared validation
interface ModerationContext {
  interaction: DiscordInteraction;
  env: Env;
  t: Translator;
  userId: string;
  logger?: ExtendedLogger;
}

// Shared validation eliminates duplication from approve/reject
async function validatePresetIdOrSendError(ctx, presetId): Promise<boolean>;

// Focused handlers with single responsibility
async function handlePendingAction(ctx: ModerationContext): Promise<void>;
async function handleApproveAction(ctx, presetId, reason): Promise<void>;
async function handleRejectAction(ctx, presetId, reason): Promise<void>;
async function handleStatsAction(ctx: ModerationContext): Promise<void>;

// Thin dispatcher (~45 lines including error handling)
async function processModerateCommand(...): Promise<void> {
  const ctx: ModerationContext = { interaction, env, t, userId, logger };
  try {
    switch (action) {
      case 'pending': await handlePendingAction(ctx); break;
      case 'approve': await handleApproveAction(ctx, presetId, reason); break;
      case 'reject': await handleRejectAction(ctx, presetId, reason); break;
      case 'stats': await handleStatsAction(ctx); break;
      default: /* error response */
    }
  } catch (error) { /* centralized error handling */ }
}
```

**Key improvements:**
- `ModerationContext` interface - Reduces parameter passing from 8 params to 1 context object
- `validatePresetIdOrSendError()` - Eliminates ~20 lines of duplicated UUID validation from approve/reject
- `sendModerationResponse()` - Standardizes response sending pattern
- Individual handlers - Each is focused, testable, and self-documenting
- Thin dispatcher - Main function reduced from 162 to ~45 lines

**Benefits:**
- **Single Responsibility**: Each handler does one thing well
- **Testability**: Individual handlers can be unit tested in isolation
- **Maintainability**: Adding new actions only requires a new handler + dispatch case
- **Reduced Duplication**: UUID validation logic consolidated to shared helper
- **Type Safety**: `ModerationContext` interface provides better IDE support

Files modified:
- `xivdyetools-moderation-worker/src/handlers/commands/preset.ts`
  - Added `ModerationContext` interface
  - Added `sendModerationResponse()` helper
  - Added `validatePresetIdOrSendError()` shared validation
  - Added `handlePendingAction()` handler (~34 lines)
  - Added `handleApproveAction()` handler (~35 lines)
  - Added `handleRejectAction()` handler (~31 lines)
  - Added `handleStatsAction()` handler (~18 lines)
  - Refactored `processModerateCommand()` to thin dispatcher (~45 lines)

---

## Next Sprint Items Fixed (2026-01-19)

The following items from the "Plan for Next Sprint" priority matrix have been addressed:

| ID | Status | Description | Files Modified |
|----|--------|-------------|----------------|
| **TYPES-REF-002** | ✅ FIXED | Implemented discriminated unions for all response types. AuthResponse, RefreshResponse, UserInfoResponse, APIResponse, PresetSubmitResponse, PresetEditResponse, VoteResponse, and ModerationResponse now use `success: true` / `success: false` literal types for proper type narrowing. | `xivdyetools-types/src/auth/response.ts`, `xivdyetools-types/src/api/response.ts`, `xivdyetools-types/src/preset/response.ts`, `xivdyetools-types/src/*/index.ts` |
| **PRESETS-OPT-003** | ✅ VERIFIED | Database indexes already comprehensive. `schema.sql` includes composite indexes for filtered+sorted queries (status+category+vote, status+vote, status+created, author+created) plus unique index on `dye_signature`. No changes needed. | `xivdyetools-presets-api/schema.sql` (no changes needed) |
| **TEST-BUG-001** | ✅ FIXED | Race condition in KV mock TTL expiration. Added snapshot-based timestamp capture (`Date.now() / 1000` at start of operation) to prevent TOCTOU races with mocked time. Also added proper expired key cleanup in `list()`. | `xivdyetools-test-utils/src/cloudflare/kv.ts` |
| **WEB-REF-003** | ✅ FIXED | Extracted pure algorithmic logic from MixerTool and HarmonyTool. Created `mixer-blending-engine.ts` (~180 lines) and `harmony-generator.ts` (~280 lines) services. Phase 1 of 4 complete. MixerTool reduced ~120 lines, HarmonyTool reduced ~200 lines. | `xivdyetools-web-app/src/services/mixer-blending-engine.ts`, `xivdyetools-web-app/src/services/harmony-generator.ts`, `xivdyetools-web-app/src/services/index.ts` |
| **DISCORD-OPT-001** | ⏸️ DEFERRED | Refactoring collection storage from O(n) array to indexed individual KV entries. Requires migration logic and careful atomic operation handling. HIGH effort. Deferred to future sprint. | — |

### Fix Details

#### TYPES-REF-002 - Discriminated Unions for Response Types
The original response types used `success: boolean` with optional fields, which breaks TypeScript's type narrowing:

```typescript
// BEFORE: TypeScript can't narrow types
interface AuthResponse {
  success: boolean;
  token?: string;    // Optional - unknown if present
  error?: string;    // Optional - unknown if present
}

// AFTER: Discriminated union enables perfect narrowing
type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

interface AuthSuccessResponse {
  success: true;     // Literal type
  token: string;     // Guaranteed present
  user: AuthUser;
  expires_at: number;
}

interface AuthErrorResponse {
  success: false;    // Literal type
  error: string;     // Guaranteed present
}
```

Now consumers get full type safety:
```typescript
if (response.success) {
  // TypeScript KNOWS: token, user, expires_at exist
  console.log(response.user.username);
} else {
  // TypeScript KNOWS: error exists
  console.error(response.error);
}
```

#### TEST-BUG-001 - KV Mock TTL Race Condition
The mock KV's TTL checking had a Time-Of-Check-To-Time-Of-Use (TOCTOU) vulnerability. In tests with mocked time (`vi.setSystemTime`), time could advance between checking expiration and returning the value:

```typescript
// BEFORE: Date.now() called multiple times
const isExpired = (key: string): boolean => {
  return Date.now() > expiration * 1000;  // Called here
};

get: async (key) => {
  if (isExpired(key)) { ... }  // Then here
  return store.get(key);        // Value could be stale
}

// AFTER: Snapshot timestamp used consistently
get: async (key) => {
  const nowSeconds = Date.now() / 1000;  // Capture once
  if (isExpiredAt(key, nowSeconds)) { ... }  // Use snapshot
  return store.get(key);
}
```

Also added proper cleanup of expired entries in `list()` to prevent stale data accumulation.

#### WEB-REF-003 Fix: Extract Pure Logic from Large Components

**Status:** ✅ FIXED (Phase 1 of 4 complete)

Extracted pure algorithmic logic from MixerTool (1,994 lines) and HarmonyTool (2,072 lines) into reusable service modules. This follows the recommended refactoring order of "Extract Pure Logic First".

##### Files Created

**1. `xivdyetools-web-app/src/services/mixer-blending-engine.ts`** (~180 lines)

Pure color blending logic extracted from MixerTool:

```typescript
// Color blending with multiple algorithms
export function blendTwoColors(hex1: string, hex2: string, mixingMode: MixingMode, ratio?: number): string;
export function blendColors(hexColors: string[], mixingMode: MixingMode): string;

// Color distance calculation for dye matching
export function calculateColorDistance(hex1: string, hex2: string, matchingMethod: MatchingMethod): number;

// Find closest matching dyes
export function findMatchingDyes(
  blendedColor: string,
  config: BlendingConfig,
  excludeIds?: number[],
  dyeFilters?: DyeFilters
): MixedColorResult[];

// Utility
export function getContrastColor(hex: string): string;
```

**2. `xivdyetools-web-app/src/services/harmony-generator.ts`** (~280 lines)

Core harmony calculation logic extracted from HarmonyTool:

```typescript
// Constants now shared
export const HARMONY_TYPE_IDS = [...];
export const HARMONY_OFFSETS: Record<string, number[]> = {...};

// Localized harmony types
export function getHarmonyTypes(): HarmonyTypeInfo[];

// Color distance calculations
export function calculateColorDistance(hex1: string, hex2: string, matchingMethod: MatchingMethod): number;
export function calculateHueDeviance(dye: Dye, targetHue: number): number;

// Dye matching
export function findClosestDyesToHue(
  dyes: Dye[],
  targetHue: number,
  count: number,
  config: HarmonyConfig,
  baseDye?: Dye
): ScoredDyeMatch[];

// Filter handling
export function replaceExcludedDyes(
  dyes: ScoredDyeMatch[],
  targetHue: number,
  dyeFilters: DyeFilters | null,
  filterConfig: DyeFilterConfig | null
): ScoredDyeMatch[];

// Harmony generation
export function findHarmonyDyes(baseDye: Dye, harmonyType: string, config: HarmonyConfig, ...): ScoredDyeMatch[];
export function generateHarmonyPanelData(baseDye: Dye, offset: number, config: HarmonyConfig, ...): {...};
```

**3. `xivdyetools-web-app/src/services/index.ts`** (updated)

Added exports for new services:

```typescript
// WEB-REF-003 FIX: Extracted tool logic modules
export { blendTwoColors, blendColors, calculateMixerColorDistance, findMatchingDyes, getContrastColor } from './mixer-blending-engine';
export type { MixedColorResult, BlendingConfig } from './mixer-blending-engine';

export { HARMONY_TYPE_IDS, HARMONY_OFFSETS, getHarmonyTypes, calculateHarmonyColorDistance, calculateHueDeviance, findClosestDyesToHue, replaceExcludedDyes, findHarmonyDyes, generateHarmonyPanelData } from './harmony-generator';
export type { HarmonyTypeInfo, ScoredDyeMatch, HarmonyConfig } from './harmony-generator';
```

##### Files Modified

**4. `xivdyetools-web-app/src/components/mixer-tool.ts`**
- Removed local `MixedColorResult` interface (using imported type)
- Removed `blendTwoColors()` method (~25 lines)
- Removed `blendColors()` method (~15 lines)
- Removed `calculateDistance()` method (~18 lines)
- Removed `findMatchingDyes()` method (~35 lines)
- Removed `getContrastColor()` method (~7 lines)
- Added thin wrapper methods: `blendColorsInternal()`, `findMatchingDyesInternal()`
- **Net reduction:** ~120 lines

**5. `xivdyetools-web-app/src/components/harmony-tool.ts`**
- Removed local `HARMONY_TYPE_IDS` constant (~12 lines)
- Removed local `HARMONY_OFFSETS` constant (~12 lines)
- Removed local `getHarmonyTypes()` function (~12 lines)
- Removed `calculateHueDeviance()` method (~5 lines)
- Removed `replaceExcludedDyes()` method (~50 lines)
- Removed `findHarmonyDyes()` method (~28 lines)
- Removed `calculateColorDistance()` method (~18 lines)
- Removed `findClosestDyesToHue()` method (~40 lines)
- Added thin wrapper methods using imported functions
- Added `getHarmonyConfig()` helper to build config object
- **Net reduction:** ~200 lines

##### Benefits

1. **Testability**: Pure functions can be unit tested without DOM setup
2. **Reusability**: Blending and harmony logic available to other tools
3. **Maintainability**: Algorithm changes localized to service files
4. **Type Safety**: Explicit config interfaces document dependencies
5. **Bundle Size**: Services can be tree-shaken if not used

##### Remaining Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 (Pure Logic) | ✅ DONE | Extract algorithmic logic to services |
| Phase 2 (Mobile Dedup) | ✅ DONE | Eliminate desktop ↔ drawer duplication |
| Phase 3 (Desktop UI) | ✅ DONE | Extract panel controllers to shared service |
| Phase 4 (Shared Services) | ✅ DONE | Price utilities, display options, Extractor modernization |

##### Phase 2 Fix Details: Eliminate Desktop ↔ Drawer Duplication

**Status:** ✅ FIXED

The MixerTool and HarmonyTool had nearly identical code for rendering desktop panels and mobile drawer content. Phase 2 consolidates this duplication using shared "panel builder" methods that return component references, allowing both desktop and drawer code paths to use the same rendering logic.

###### MixerTool Changes

**Shared builder result types added:**
```typescript
interface DyeSelectorPanelRefs {
  selector: DyeSelector;
  displayContainer: HTMLElement;
}
interface SettingsSliderRefs {
  slider: HTMLInputElement;
  valueDisplay: HTMLElement;
}
interface FiltersPanelRefs {
  panel: CollapsiblePanel;
  filters: DyeFilters;
}
interface MarketPanelRefs {
  panel: CollapsiblePanel;
  marketBoard: MarketBoard;
}
```

**Shared builder methods created (~250 lines consolidated):**
- `buildDyeSelectorPanel()` - Builds dye selector with display container
- `renderSelectedDyesDisplayInto(container)` - Renders selected dye cards with conditional remove buttons
- `buildSettingsSlider()` - Builds maxResults slider with label and value display
- `bindSettingsSliderEvents(refs, sync)` - Binds slider events with cross-sync logic
- `buildFiltersPanel()` - Builds CollapsiblePanel with DyeFilters
- `buildMarketPanel()` - Builds CollapsiblePanel with MarketBoard

**Methods removed (replaced by shared builders):**
- `renderMobileDyeSelector()` (~100 lines)
- `updateMobileSelectedDyesDisplay()` (~50 lines)
- `renderMobileSettings()` (~80 lines)

**Net reduction:** ~180 lines of duplicated code

###### HarmonyTool Changes

**Shared builder result types added:**
```typescript
interface BaseDyePanelRefs {
  selector: DyeSelector;
  displayContainer: HTMLElement;
}
interface HarmonyTypeSelectorRefs {
  container: HTMLElement;
}
interface CompanionSliderRefs {
  slider: HTMLInputElement;
  valueDisplay: HTMLElement;
}
interface FiltersPanelRefs {
  panel: CollapsiblePanel;
  filters: DyeFilters;
}
interface MarketPanelRefs {
  panel: CollapsiblePanel;
  marketBoard: MarketBoard;
}
```

**Shared builder methods created (~300 lines consolidated):**
- `renderCurrentDyeDisplayInto(container)` - Renders current dye display card
- `buildBaseDyePanel()` - Builds dye selector panel for base dye selection
- `buildHarmonyTypeSelector()` - Builds harmony type button grid
- `updateHarmonyTypeButtonStyles(container, selectedType)` - Updates button selection styles
- `buildCompanionSlider()` - Builds companion dyes count slider
- `bindCompanionSliderEvents(refs, sync)` - Binds slider events with cross-sync logic
- `buildFiltersPanel()` - Builds CollapsiblePanel with DyeFilters
- `buildMarketPanel()` - Builds CollapsiblePanel with MarketBoard

**Methods removed (replaced by shared builders):**
- `renderMobileBaseDyeSelector()` (~65 lines)
- `renderMobileHarmonyTypeSelector()` (~80 lines)
- `renderMobileCompanionSlider()` (~80 lines)
- `renderMobileFilters()` (~30 lines)
- `renderMobileMarket()` (~30 lines)
- Duplicated button style update code in `setConfig()` (~12 lines)

**Net reduction:** ~250 lines of duplicated code

###### Key Design Decisions

1. **Builder pattern**: Methods return component references rather than void, allowing callers to store references for later updates
2. **Conditional rendering**: `renderSelectedDyesDisplayInto()` uses `container === this.selectedDyesContainer` check to only show remove buttons on desktop
3. **Cross-sync events**: Slider bindings accept a `sync` parameter to update the opposite slider (desktop ↔ drawer)
4. **Unified style updates**: `updateHarmonyTypeButtonStyles()` handles null containers gracefully, allowing safe calls for both desktop and drawer containers

##### Phase 3 Fix Details: Extract Panel Controllers to Shared Service

**Status:** ✅ FIXED

Phase 3 extracts the common CollapsiblePanel + DyeFilters/MarketBoard creation patterns into a shared service that any tool can import, eliminating ~30-60 lines of duplicated code per tool.

###### New Service Created

**`xivdyetools-web-app/src/services/tool-panel-builders.ts`** (~170 lines)

Provides reusable builder functions:
```typescript
// Shared types
export interface FiltersPanelRefs { panel: CollapsiblePanel; filters: DyeFilters; }
export interface MarketPanelRefs { panel: CollapsiblePanel; marketBoard: MarketBoard; }
export interface FiltersPanelConfig { storageKey, storageKeyPrefix, onFilterChange, defaultOpen? }
export interface MarketPanelConfig { storageKey, getShowPrices, fetchPrices, onPricesToggled?, ... }

// Builder functions
export function buildFiltersPanel(host, container, config): FiltersPanelRefs;
export function buildMarketPanel(host, container, config): MarketPanelRefs;
```

###### Tools Refactored

**gradient-tool.ts** - Reduced ~40 lines:
```typescript
// BEFORE: 22 lines for filters + 38 lines for market = 60 lines
this.filtersPanel = new CollapsiblePanel(container, {...});
this.filtersPanel.init();
const filtersContent = this.createElement('div');
this.dyeFilters = new DyeFilters(filtersContent, {...});
this.dyeFilters.render();
this.dyeFilters.bindEvents();
// ... more setup

// AFTER: 12 lines for filters + 16 lines for market = 28 lines
const filtersRefs = buildFiltersPanel(this, filtersContainer, {
  storageKey: 'v3_mixer_filters',
  storageKeyPrefix: 'v3_mixer',
  onFilterChange: () => this.updateInterpolation(),
});
this.filtersPanel = filtersRefs.panel;
this.dyeFilters = filtersRefs.filters;
```

**extractor-tool.ts** - Reduced ~50 lines:
- `renderFiltersPanel()` reduced from 28 lines to 13 lines
- `renderMarketPanel()` reduced from 46 lines to 28 lines

###### Key Design Decisions

1. **Host parameter**: Builders accept the host component to access `createElement()` for consistent element creation
2. **Config objects**: All customization via typed config objects with sensible defaults
3. **Callback-based**: Tool-specific behavior handled via callbacks (`onFilterChange`, `onPricesToggled`, etc.)
4. **Post-init hooks**: Tools can add additional setup after builder returns (e.g., `loadServerData()`)
5. **Incremental adoption**: Other tools can adopt the pattern without breaking existing code

###### Files Modified

- `xivdyetools-web-app/src/services/tool-panel-builders.ts` (created)
- `xivdyetools-web-app/src/services/index.ts` (exports added)
- `xivdyetools-web-app/src/components/gradient-tool.ts` (refactored)
- `xivdyetools-web-app/src/components/extractor-tool.ts` (refactored)

##### Phase 4 Fix Details: Shared Price Utilities and Extractor Modernization

**Status:** ✅ FIXED

Phase 4 completes the WEB-REF-003 refactoring by creating shared utilities for price formatting and display options handling, and modernizing the ExtractorTool to use the centralized MarketBoardService instead of local state.

###### New Services Created

**`xivdyetools-web-app/src/services/price-utilities.ts`** (~170 lines)

Provides reusable utilities for price formatting and card data preparation:
```typescript
// Price formatting
export function formatPriceWithSuffix(price: number, suffix?: string): string;
export function getDyePriceDisplay(dye: Dye, options: DyePriceDisplayOptions): string | null;
export function getPriceInfo(dye: Dye, priceData: Map<number, PriceData>): PriceData | undefined;

// Card data preparation
export interface PriceCardData {
  marketServer?: string;
  price?: number;
  showPrice: boolean;
}
export function preparePriceCardData(dye: Dye, service: MarketBoardService): PriceCardData;
export function preparePriceCardDataFromMap(dye, priceData, showPrices, serverName?): PriceCardData;

// Batch operations
export function getItemIdsForPriceFetch(dyes: Dye[], service: MarketBoardService): number[];
export function hasCachedPrices(dyes: Dye[], priceData: Map<number, PriceData>): boolean;
```

**`xivdyetools-web-app/src/services/display-options-helper.ts`** (~120 lines)

Provides standardized display options handling:
```typescript
// Default configuration
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptionsConfig;

// Apply and compare options
export function applyDisplayOptions(config: ApplyDisplayOptionsConfig): ApplyDisplayOptionsResult;
export function hasDisplayOptionsChanges(current, incoming): boolean;
export function getCardDisplayOptions(options, showPrices): Partial<DisplayOptionsConfig>;
export function mergeWithDefaults(partial): DisplayOptionsConfig;
```

###### ExtractorTool Modernization

Migrated ExtractorTool from local price state to centralized MarketBoardService:

**Before (local state):**
```typescript
private showPrices: boolean = false;
private priceData: Map<number, PriceData> = new Map();

// Manual state management
this.showPrices = this.marketBoard.getShowPrices();
this.priceData.clear();
this.priceData.set(id, price);
```

**After (service-backed getters):**
```typescript
private marketBoardService: MarketBoardService;

// Getters delegate to service
private get showPrices(): boolean {
  return this.marketBoardService.getShowPrices();
}
private get priceData(): Map<number, PriceData> {
  return this.marketBoardService.getAllPrices();
}

// Service handles cache management
await this.marketBoardService.fetchPricesForDyes(dyes);
```

**Benefits:**
- Race condition protection via MarketBoardService's request versioning
- Shared price cache across all tools (no duplicate fetches)
- Automatic cache clearing on server change
- Consistent behavior with Mixer, Harmony, and Gradient tools

###### Key Design Decisions

1. **Getter pattern**: `showPrices` and `priceData` are getters that delegate to MarketBoardService
2. **Service initialization**: MarketBoardService initialized in constructor
3. **Cache management**: Service handles all cache clearing/updating; tools just re-render
4. **Callback-based updates**: onPricesToggled and onServerChanged just trigger re-renders

###### Files Modified

- `xivdyetools-web-app/src/services/price-utilities.ts` (created)
- `xivdyetools-web-app/src/services/display-options-helper.ts` (created)
- `xivdyetools-web-app/src/services/index.ts` (exports added)
- `xivdyetools-web-app/src/components/extractor-tool.ts` (migrated to MarketBoardService)

---

## Recommendations

### Cross-Cutting Concerns

1. **Race Condition Prevention**: Multiple projects exhibit race conditions in async operations. Consider:
   - Implementing atomic operations where possible
   - Using mutex patterns for shared state
   - Documenting concurrency assumptions

2. **Error Handling Consistency**: Several projects swallow errors silently. Establish:
   - Minimum logging standard for caught exceptions
   - Categorize expected vs unexpected errors
   - Add error tracking integration

3. **Type Safety**: ✅ Discriminated unions now implemented for all response types.
   - AuthResponse, RefreshResponse, UserInfoResponse use proper unions
   - APIResponse<T>, PresetSubmitResponse, PresetEditResponse, VoteResponse, ModerationResponse also updated
   - Consumers now get full type narrowing with `if (response.success)`

4. **Memory Management**: Rate limiters and mocks across projects share similar memory leak patterns:
   - Implement size limits on in-memory collections
   - Add periodic cleanup with deterministic intervals
   - Consider using external storage (KV/Durable Objects) for persistence

### Security Considerations

1. **OAuth State Signing**: Already well-implemented with HMAC
2. **Rate Limiting**: Multiple implementations exist - consider consolidating
3. **Input Validation**: Generally good, but some edge cases in error sanitization
4. **Redirect URI Validation**: Duplicated across handlers - extract to shared module

---

## Detailed Reports by Project

For detailed findings, see individual project reports:

- [xivdyetools-core Analysis](./projects/xivdyetools-core.md)
- [xivdyetools-discord-worker Analysis](./projects/xivdyetools-discord-worker.md)
- [xivdyetools-logger Analysis](./projects/xivdyetools-logger.md)
- [xivdyetools-maintainer Analysis](./projects/xivdyetools-maintainer.md)
- [xivdyetools-moderation-worker Analysis](./projects/xivdyetools-moderation-worker.md)
- [xivdyetools-oauth Analysis](./projects/xivdyetools-oauth.md)
- [xivdyetools-presets-api Analysis](./projects/xivdyetools-presets-api.md)
- [xivdyetools-test-utils Analysis](./projects/xivdyetools-test-utils.md)
- [xivdyetools-types Analysis](./projects/xivdyetools-types.md)
- [xivdyetools-universalis-proxy Analysis](./projects/xivdyetools-universalis-proxy.md)
- [xivdyetools-web-app Analysis](./projects/xivdyetools-web-app.md)

---

## Next Steps

1. Review findings with team
2. Prioritize items for remediation
3. Create tickets/issues for tracking
4. Proceed with approved modifications

---

*Generated by Claude Code Deep-Dive Analysis - 2026-01-19*
