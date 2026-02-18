# XIV Dye Tools - Cloudflare Workers Audit Report

**Date:** December 24, 2025
**Auditor:** Claude Code (Opus 4.5)
**Scope:** All 4 Cloudflare Worker projects

---

## 🔄 Remediation Status (Updated: December 24, 2025)

### ✅ Resolved Issues

| ID | Issue | Resolution |
|----|-------|------------|
| OAUTH-CRITICAL-001 | State param base64/JSON parsing | Separated into distinct try-catch blocks with specific error messages |
| OAUTH-CRITICAL-002 | Open redirect vulnerability | Added `allowedOrigins` validation before redirect |
| OAUTH-HIGH-001 | Missing Discord API timeouts | Added `AbortSignal.timeout(10000)` and `AbortSignal.timeout(5000)` |
| OAUTH-MED-001 | JWT_SECRET length validation | Added 32-char minimum check in env-validation.ts |
| DISCORD-CRITICAL-001 | Analytics always success=true | Moved analytics to `finally` block with actual `success` value |
| DISCORD-CRITICAL-003 | Timing-safe comparison bypass | Separated config check from timing-safe comparison |
| DISCORD-HIGH-001 | Missing body size validation | Added 10KB Content-Length check |
| DISCORD-HIGH-002 | No timeout on Discord messages | Added `AbortSignal.timeout(5000)` |
| DISCORD-HIGH-003 | Null userId bypass | Added early return guard for missing userId |
| PROXY-CRITICAL-001 | Memory leak in coalescer | Added `InFlightEntry` with timestamp + periodic cleanup |
| PROXY-CRITICAL-002 | CORS middleware structure | Refactored to set headers directly |
| PROXY-CRITICAL-003 | Unlimited item IDs | Added count (1-100) and range (1-1M) validation |
| PRESETS-CRITICAL-001 | Duplicate preset race condition | Added UNIQUE constraint on dye_signature + application handler |
| PRESETS-CRITICAL-004 | Audit trail cleared on edit | Changed to append-only (no longer clears previous_values) |
| PRESETS-HIGH-001 | No Perspective API timeout | Added `AbortSignal.timeout(5000)` |
| PRESETS-HIGH-002 | Whitespace author names | Added `.trim()` to author name handling |

### ⏳ Remaining Issues

| ID | Issue | Priority |
|----|-------|----------|
| DISCORD-CRITICAL-002 | Collections race condition | Documented as acceptable for UX |
| PRESETS-CRITICAL-002 | Hardcoded category list | Medium (acceptable trade-off) |
| PRESETS-CRITICAL-003 | Discord notify fire-and-forget | Low (intentional design) |

### ✅ Additional Resolved Issues (December 24, 2025)

| ID | Issue | Resolution |
|----|-------|------------|
| OAUTH-HIGH-002 | User creation race condition | UNIQUE indexes on discord_id/xivauth_id + try-catch retry pattern |
| OAUTH-MED-002 | No rate limiting on refresh | Rate limiting middleware already covers `/auth/*` including `/auth/refresh` |
| OAUTH-MED-003 | Grace period boundary | Boundary behavior is correct (`<` allows refresh at exactly 24h); tests exist |
| PRESETS-HIGH-003 | UTF-8 truncation in embeds | Added `truncateUnicodeSafe()` function using `Array.from()` |
| PROXY-HIGH-001 | Cache timestamp validation | Current behavior correctly treats missing headers as cache miss |
| PROXY-HIGH-002 | No response size limit | Added `MAX_RESPONSE_SIZE_BYTES` (5MB) check + `ResponseTooLargeError` |
| DISCORD-MED-001 | KV error silent failure | `kvError` flag added to RateLimitResult, documented in JSDoc with example |
| DISCORD-MED-002 | Hardcoded command limits | Documented in code comments: "Commands not listed use default limit" |
| DISCORD-MED-003 | No KV key versioning | Added `KV_SCHEMA_VERSION = 'v1'` prefix to all KV keys |
| PRESETS-MED-001 | Cascade delete verification | Added 3 integration tests verifying vote cascade delete behavior |
| PRESETS-MED-002 | Inconsistent error format | Created `api-response.ts` with standardized `ErrorCode` constants and helpers |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [xivdyetools-oauth](#1-xivdyetools-oauth)
3. [xivdyetools-discord-worker](#2-xivdyetools-discord-worker)
4. [xivdyetools-universalis-proxy](#3-xivdyetools-universalis-proxy)
5. [xivdyetools-presets-api](#4-xivdyetools-presets-api)
6. [Cross-Cutting Concerns](#5-cross-cutting-concerns)
7. [Remediation Priority](#6-remediation-priority)

---

## Executive Summary

| Worker | Critical | High | Medium | Total |
|--------|----------|------|--------|-------|
| xivdyetools-oauth (v2.1.0) | 2 | 2 | 3 | 7 |
| xivdyetools-discord-worker (v2.2.0) | 3 | 3 | 3 | 9 |
| xivdyetools-universalis-proxy (v1.0.0) | 3 | 2 | 1 | 6 |
| xivdyetools-presets-api (v1.3.0) | 4 | 3 | 2 | 9 |
| **Total** | **12** | **10** | **9** | **31** |

Plus 6 cross-cutting concerns affecting multiple workers.

---

## 1. XIVDYETOOLS-OAUTH

Discord OAuth handler and JWT token issuer.

### Critical Issues

#### OAUTH-CRITICAL-001: Missing Input Validation on OAuth State Parameter

**Severity:** Critical
**File:** `xivdyetools-oauth/src/handlers/callback.ts`
**Lines:** 59-64

**Problem:**
State parameter is base64-decoded without checking if it's valid JSON before parsing:

```typescript
try {
  stateData = JSON.parse(atob(state));
} catch {
  // Error handling doesn't distinguish base64 vs JSON parse errors
}
```

**Impact:** Malformed state silently fails, potentially masking other issues. Error context is lost.

**Recommendation:**
```typescript
let decoded: string;
try {
  decoded = atob(state);
} catch {
  return c.json({ error: 'Invalid state encoding' }, 400);
}

try {
  stateData = JSON.parse(decoded);
} catch {
  return c.json({ error: 'Invalid state format' }, 400);
}
```

---

#### OAUTH-CRITICAL-002: Unvalidated Redirect URI Construction

**Severity:** Critical (Security)
**File:** `xivdyetools-oauth/src/handlers/callback.ts`
**Line:** 76

**Problem:**
`stateData.redirect_uri` is used without validating it's a trusted origin:

```typescript
const redirectUrl = new URL(stateData.redirect_uri);
redirectUrl.searchParams.set('code', code);
return c.redirect(redirectUrl.toString());
```

**Impact:** Open redirect vulnerability - attacker could set `redirect_uri` in state to any URL they control, stealing authorization codes.

**Recommendation:**
```typescript
const ALLOWED_REDIRECT_ORIGINS = [
  'https://xivdyetools.projectgalatine.com',
  'http://localhost:5173', // Development only
];

const redirectUrl = new URL(stateData.redirect_uri);
if (!ALLOWED_REDIRECT_ORIGINS.some(origin => redirectUrl.origin === origin)) {
  return c.json({ error: 'Invalid redirect URI' }, 400);
}
```

---

### High-Severity Issues

#### OAUTH-HIGH-001: Missing Timeout on External Discord API Calls

**Severity:** High
**File:** `xivdyetools-oauth/src/handlers/callback.ts`
**Lines:** 156-169, 205-209

**Problem:**
No timeout configured on fetch calls to Discord OAuth and user info endpoints:

```typescript
const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ ... }),
  // Missing: signal: AbortSignal.timeout(5000)
});
```

**Impact:** If Discord API hangs, Worker consumes CPU indefinitely, affecting other requests.

**Recommendation:**
```typescript
const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ ... }),
  signal: AbortSignal.timeout(10000), // 10 second timeout
});
```

---

#### OAUTH-HIGH-002: Race Condition in User Lookup/Create

**Severity:** High
**File:** `xivdyetools-oauth/src/handlers/callback.ts`
**Lines:** 240-246

**Problem:**
`findOrCreateUser` is called without atomicity - two simultaneous OAuth requests for the same Discord user could both pass the "not found" check:

```typescript
const user = await findOrCreateUser(c.env.DB, {
  discord_id: discordUser.id,
  // ... other fields
});
```

**Impact:** Duplicate user records in database on concurrent first-time logins.

**Recommendation:**
Add UNIQUE constraint on `discord_id` column and use UPSERT:
```sql
INSERT INTO users (discord_id, ...) VALUES (?, ...)
ON CONFLICT(discord_id) DO UPDATE SET last_login = CURRENT_TIMESTAMP
RETURNING *;
```

---

### Medium-Severity Issues

#### OAUTH-MED-001: JWT Secret Validation Missing

**Severity:** Medium
**File:** `xivdyetools-oauth/src/index.ts`
**Lines:** 41-59

**Problem:**
Environment validation doesn't check that `JWT_SECRET` is set or has sufficient length.

**Impact:** If JWT_SECRET is missing or too short, signing fails with confusing error.

**Recommendation:**
```typescript
if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

---

#### OAUTH-MED-002: No Rate Limiting on Refresh Endpoint

**Severity:** Medium
**File:** `xivdyetools-oauth/src/index.ts`
**Line:** 121

**Problem:**
Rate limiting only applied to `/auth/*` path pattern, but refresh and revoke endpoints could be brute-forced.

**Impact:** Attacker could spam token refresh to enumerate valid JWTs.

**Recommendation:** Apply per-endpoint rate limits with stricter limits on sensitive operations.

---

#### OAUTH-MED-003: Grace Period Boundary Condition

**Severity:** Medium
**File:** `xivdyetools-oauth/src/handlers/refresh.ts`
**Lines:** 80-91

**Problem:**
Grace period comparison uses `<` which creates ambiguity at exactly 24 hours:

```typescript
if (decoded.exp + gracePeriod < now) {
  // Error: expired beyond grace period
}
```

**Impact:** Edge case at exactly 24 hours may behave unexpectedly.

**Recommendation:** Add explicit test case for boundary condition and document expected behavior.

---

## 2. XIVDYETOOLS-DISCORD-WORKER

Discord bot for slash commands via HTTP interactions.

### Critical Issues

#### DISCORD-CRITICAL-001: Analytics Success Flag Always True

**Severity:** Critical
**File:** `xivdyetools-discord-worker/src/index.ts`
**Lines:** 321-334

**Problem:**
Analytics tracking fires before command execution, hardcoding `success: true`:

```typescript
ctx.waitUntil(
  trackCommandWithKV(env, {
    commandName,
    userId,
    guildId: interaction.guild_id,
    success: true, // Never updated on command failure
  }).catch((error) => {
    logger.error('Analytics tracking failed', error);
  })
);
```

**Impact:** Analytics show 100% success rate even when commands fail.

**Recommendation:**
Track analytics after command execution with actual result:
```typescript
let success = true;
try {
  const result = await executeCommand(...);
  return result;
} catch (error) {
  success = false;
  throw error;
} finally {
  ctx.waitUntil(trackCommandWithKV(env, { ...data, success }));
}
```

---

#### DISCORD-CRITICAL-002: Unhandled Race Condition in User Collections

**Severity:** Critical
**File:** `xivdyetools-discord-worker/src/index.ts`
**Lines:** 495-516

**Problem:**
`getCollections()` is called without locking mechanism - concurrent add/delete operations can cause stale data in autocomplete:

```typescript
const collections = await getCollections(env.KV, userId);
// ... filtering logic
return filtered.slice(0, 25).map((c) => ({
  name: `${c.name} (${c.dyes.length} dyes)`, // Count could be stale
  value: c.name,
}));
```

**Impact:** User sees incorrect dye counts if modifying collection while autocomplete runs.

**Recommendation:** Add version/etag to collection metadata for optimistic concurrency.

---

#### DISCORD-CRITICAL-003: Timing-Safe Comparison Short-Circuit

**Severity:** Critical (Security)
**File:** `xivdyetools-discord-worker/src/index.ts`
**Lines:** 140-149

**Problem:**
The short-circuit `||` operator bypasses timing-safe comparison when secret is missing:

```typescript
if (!env.INTERNAL_WEBHOOK_SECRET || !(await timingSafeEqual(authHeader, expectedAuth))) {
  logger.error('Webhook authentication failed');
  return c.json({ error: 'Unauthorized' }, 401);
}
```

**Impact:** Timing attack can detect whether secret is configured vs. auth mismatch.

**Recommendation:**
```typescript
if (!env.INTERNAL_WEBHOOK_SECRET) {
  logger.error('Webhook secret not configured');
  return c.json({ error: 'Unauthorized' }, 401);
}
if (!(await timingSafeEqual(authHeader, expectedAuth))) {
  logger.error('Webhook authentication failed');
  return c.json({ error: 'Unauthorized' }, 401);
}
```

---

### High-Severity Issues

#### DISCORD-HIGH-001: Missing Request Body Size Validation

**Severity:** High
**File:** `xivdyetools-discord-worker/src/index.ts`
**Lines:** 137-157

**Problem:**
No check on request body size before JSON parsing:

```typescript
let payload: PresetNotificationPayload;
try {
  payload = await c.req.json();
} catch {
  return c.json({ error: 'Invalid JSON body' }, 400);
}
```

**Impact:** Attacker could send megabyte-sized payloads, causing OOM.

**Recommendation:**
```typescript
const contentLength = parseInt(c.req.header('content-length') || '0', 10);
if (contentLength > 10240) { // 10KB limit
  return c.json({ error: 'Payload too large' }, 413);
}
```

---

#### DISCORD-HIGH-002: No Timeout on Discord Message Sending

**Severity:** High
**File:** `xivdyetools-discord-worker/src/index.ts`
**Lines:** 169-207

**Problem:**
`sendMessage()` calls have no timeout configured.

**Impact:** Blocking indefinitely if Discord API hangs.

**Recommendation:** Add AbortSignal.timeout(5000) to all Discord API calls.

---

#### DISCORD-HIGH-003: Potential Null User ID

**Severity:** High
**File:** `xivdyetools-discord-worker/src/index.ts`
**Lines:** 309-319

**Problem:**
`userId` extraction doesn't guard against both sources being null:

```typescript
const userId = interaction.member?.user?.id ?? interaction.user?.id;
// userId could still be undefined
if (userId && commandName && !['about', 'manual', 'stats'].includes(commandName)) {
  const rateLimitResult = await checkRateLimit(env.KV, userId, commandName);
}
```

**Impact:** Rate limiting is skipped if userId is missing, allowing abuse.

**Recommendation:**
```typescript
const userId = interaction.member?.user?.id ?? interaction.user?.id;
if (!userId) {
  return c.json({ error: 'Unable to identify user' }, 400);
}
```

---

### Medium-Severity Issues

#### DISCORD-MED-001: KV Error Silent Failure

**Severity:** Medium
**File:** `xivdyetools-discord-worker/src/services/rate-limiter.ts`
**Lines:** 169-181

**Problem:**
When KV fails, request is allowed and flagged with `kvError: true`, but callers don't check this flag:

```typescript
catch (error) {
  logger.error('Rate limit check failed', error);
  return {
    allowed: true, // Allows request on KV failure
    remaining: limit,
    resetAt: now + windowMs,
    kvError: true, // Never checked by caller
  };
}
```

**Impact:** KV outages silently disable rate limiting entirely.

**Recommendation:** Check `kvError` in caller and emit metric/alert.

---

#### DISCORD-MED-002: Hardcoded Command Rate Limits

**Severity:** Medium
**File:** `xivdyetools-discord-worker/src/services/rate-limiter.ts`
**Lines:** 32-48

**Problem:**
Command limits are hardcoded - new commands won't have custom limits:

```typescript
const COMMAND_LIMITS: Record<string, number> = {
  match_image: 5,
  accessibility: 10,
  harmony: 15,
  // New commands not listed here
};
```

**Impact:** New commands silently use DEFAULT_LIMIT.

**Recommendation:** Document this explicitly or load from config.

---

#### DISCORD-MED-003: No Version Prefix on KV Keys

**Severity:** Medium
**File:** `xivdyetools-discord-worker/src/index.ts`
**Lines:** 496-516

**Problem:**
User collections stored with simple `userId` key without version.

**Impact:** Schema changes could break existing collections.

**Recommendation:** Use versioned keys: `xivdye:collections:v1:${userId}`

---

## 3. XIVDYETOOLS-UNIVERSALIS-PROXY

CORS proxy for Universalis market board API.

### Critical Issues

#### PROXY-CRITICAL-001: Memory Leak in Request Coalescer

**Severity:** Critical
**File:** `xivdyetools-universalis-proxy/src/services/request-coalescer.ts`
**Lines:** 44-88

**Problem:**
In-flight requests map uses module-level state that can grow indefinitely:

```typescript
const inFlightRequests = new Map<string, Promise<unknown>>();

// Cleanup relies on promise resolution + setTimeout
this.ctx.waitUntil(
  promise.finally(() => {
    setTimeout(() => {
      inFlightRequests.delete(key);
    }, 100);
  })
);
```

**Impact:** If promises hang or take > 30 seconds, module-level state accumulates across Worker isolate lifetime.

**Recommendation:**
Use timestamp-based cleanup with periodic sweep:
```typescript
interface InFlightEntry {
  promise: Promise<unknown>;
  createdAt: number;
}
const inFlightRequests = new Map<string, InFlightEntry>();

// Periodic cleanup in middleware
const now = Date.now();
for (const [key, entry] of inFlightRequests) {
  if (now - entry.createdAt > 60000) {
    inFlightRequests.delete(key);
  }
}
```

---

#### PROXY-CRITICAL-002: CORS Middleware Applied Incorrectly

**Severity:** Critical
**File:** `xivdyetools-universalis-proxy/src/index.ts`
**Lines:** 30-49

**Problem:**
CORS middleware is returned from inside a route handler, breaking the middleware chain:

```typescript
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  // ...validation logic...
  return cors({
    origin: isAllowed ? origin : allowedOrigins[0],
    // ...
  })(c, next); // Calling middleware as function
});
```

**Impact:** CORS headers may not apply correctly to all responses.

**Recommendation:**
Restructure as proper middleware:
```typescript
app.use('*', async (c, next) => {
  // Set CORS headers directly
  const origin = c.req.header('Origin') || '';
  c.header('Access-Control-Allow-Origin', validateOrigin(origin));
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  await next();
});
```

---

#### PROXY-CRITICAL-003: Input Validation Regex Insufficient

**Severity:** Critical
**File:** `xivdyetools-universalis-proxy/src/index.ts`
**Lines:** 99-106

**Problem:**
ItemIds validation only checks format, not count or range:

```typescript
if (!/^[\d,]+$/.test(itemIds)) {
  return c.json({ error: 'Invalid itemIds parameter' }, 400);
}
```

**Impact:** Attacker could send thousands of IDs, causing DoS on Universalis API.

**Recommendation:**
```typescript
const ids = itemIds.split(',').map(Number);
if (ids.length === 0 || ids.length > 100) {
  return c.json({ error: 'Item count must be 1-100' }, 400);
}
if (ids.some(id => !Number.isInteger(id) || id < 1 || id > 1000000)) {
  return c.json({ error: 'Invalid item ID' }, 400);
}
```

---

### High-Severity Issues

#### PROXY-HIGH-001: Cache Metadata Timestamp Never Validated

**Severity:** High
**File:** `xivdyetools-universalis-proxy/src/services/cache-service.ts`
**Lines:** 75-109

**Problem:**
Cache headers parsed without validation - missing headers default to epoch:

```typescript
const cachedAt = parseInt(cached.headers.get('X-Cached-At') || '0', 10);
// If header is missing, defaults to Jan 1, 1970
```

**Impact:** Cache appears ancient if headers missing, causing unnecessary refreshes.

**Recommendation:**
```typescript
const cachedAt = parseInt(cached.headers.get('X-Cached-At') || '', 10);
if (!cachedAt || isNaN(cachedAt) || cachedAt > Date.now() || cachedAt < Date.now() - 86400000) {
  // Invalid or too old - treat as cache miss
  return null;
}
```

---

#### PROXY-HIGH-002: No Response Size Limit

**Severity:** High
**File:** `xivdyetools-universalis-proxy/src/services/cached-fetch.ts`
**Lines:** 94-102

**Problem:**
Upstream response is parsed as JSON without checking size:

```typescript
const data = await coalescer.coalesce<T>(cacheKey, async () => {
  const response = await fetchFromUpstream(upstreamUrl);
  return response.json() as Promise<T>; // Could parse huge response
});
```

**Impact:** Multi-megabyte responses could cause OOM.

**Recommendation:** Check Content-Length before parsing, reject if > 5MB.

---

### Medium-Severity Issues

#### PROXY-MED-001: Environment Check Not Null-Safe

**Severity:** Medium
**File:** `xivdyetools-universalis-proxy/src/index.ts`
**Lines:** 36-39

**Problem:**
Development check uses `===` without null guard:

```typescript
const isAllowed =
  c.env.ENVIRONMENT === 'development'  // Could be undefined
    ? origin.startsWith('http://localhost:')
    : allowedOrigins.includes(origin);
```

**Impact:** If ENVIRONMENT undefined, falls through to production check.

**Recommendation:** Use explicit check: `c.env.ENVIRONMENT === 'development'` is safe as `undefined === 'development'` is false.

---

## 4. XIVDYETOOLS-PRESETS-API

Community dye presets API with moderation.

### Critical Issues

#### PRESETS-CRITICAL-001: Race Condition in Duplicate Detection

**Severity:** Critical
**File:** `xivdyetools-presets-api/src/handlers/presets.ts`
**Lines:** 403-419

**Problem:**
The code explicitly acknowledges this as a known bug:

```typescript
// PRESETS-BUG-001: Check for duplicate dye combinations
// Note: This check-then-create pattern has a theoretical race condition...
const duplicate = await findDuplicatePreset(c.env.DB, body.dyes);
if (duplicate) {
  // ... handle duplicate
}

// Create preset
const preset = await createPreset(...);
```

**Impact:** Two users submitting identical presets simultaneously both create records.

**Recommendation:**
Add UNIQUE constraint on `dye_signature` column:
```sql
ALTER TABLE presets ADD UNIQUE(dye_signature);
```
Then handle constraint violation:
```typescript
try {
  const preset = await createPreset(...);
} catch (error) {
  if (error.message.includes('UNIQUE constraint failed')) {
    // Retry as vote on existing preset
  }
}
```

---

#### PRESETS-CRITICAL-002: Category Validation Hardcoded

**Severity:** Critical
**File:** `xivdyetools-presets-api/src/handlers/presets.ts`
**Lines:** 534-536

**Problem:**
Valid categories hardcoded instead of queried from database:

```typescript
const VALID_CATEGORIES = ['jobs', 'grand-companies', 'seasons', 'events', 'aesthetics', 'community'];

if (!body.category_id || !VALID_CATEGORIES.includes(body.category_id)) {
  return c.json({ error: 'Invalid category' }, 400);
}
```

**Impact:** Adding new categories requires code deployment.

**Recommendation:**
Query categories table or cache category list at startup.

---

#### PRESETS-CRITICAL-003: Discord Notification Fire-and-Forget

**Severity:** Critical
**File:** `xivdyetools-presets-api/src/handlers/presets.ts`
**Lines:** 446-461

**Problem:**
Discord notification failure has no retry mechanism:

```typescript
c.executionCtx.waitUntil(
  notifyDiscordBot(c.env, {
    type: 'submission',
    preset: { ... },
  }).catch((err) => {
    console.error('Discord notification failed', err);
  })
);
```

**Impact:** Moderators miss pending presets if Discord service binding fails.

**Recommendation:**
Add retry with exponential backoff or store failed notifications in KV for manual review.

---

#### PRESETS-CRITICAL-004: Edit Clears Moderation Audit Trail

**Severity:** Critical
**File:** `xivdyetools-presets-api/src/handlers/presets.ts`
**Lines:** 264-306

**Problem:**
When edited preset passes moderation, `previousValues` is cleared:

```typescript
if (!moderationResult.passed) {
  previousValues = { ... };
  moderationStatus = 'pending';
} else {
  previousValues = null; // Clears flagged content history
}
```

**Impact:** Audit trail of previously-flagged content is lost on re-edit.

**Recommendation:** Keep `previousValues` as append-only audit log.

---

### High-Severity Issues

#### PRESETS-HIGH-001: No Timeout on Perspective API Calls

**Severity:** High
**File:** `xivdyetools-presets-api/src/services/moderation-service.ts`
**Lines:** 176-193

**Problem:**
External API call has no timeout:

```typescript
const response = await fetch(
  `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${env.PERSPECTIVE_API_KEY}`,
  {
    method: 'POST',
    // Missing: signal: AbortSignal.timeout(5000)
  }
);
```

**Impact:** Preset submissions block indefinitely if Perspective API hangs.

**Recommendation:** Add 5-second timeout, return clean result if API fails.

---

#### PRESETS-HIGH-002: Empty Author Name Not Caught

**Severity:** High
**File:** `xivdyetools-presets-api/src/handlers/presets.ts`
**Lines:** 321, 451

**Problem:**
Empty string passes `||` check:

```typescript
author_name: auth.userName || 'Unknown User',
// "" || 'Unknown User' === 'Unknown User' - this is correct
// But auth.userName could be whitespace-only
```

**Impact:** Whitespace-only usernames slip through.

**Recommendation:**
```typescript
author_name: auth.userName?.trim() || 'Unknown User'
```

---

#### PRESETS-HIGH-003: UTF-8 Truncation in Discord Embeds

**Severity:** High
**File:** `xivdyetools-presets-api/src/services/moderation-service.ts`
**Line:** 302

**Problem:**
Description truncated without UTF-8 boundary awareness:

```typescript
{ name: 'Description', value: alert.description.substring(0, 200), inline: false }
```

**Impact:** Could truncate mid-emoji, causing Discord embed parse errors.

**Recommendation:**
Use a UTF-8 safe truncation function or limit to safe character boundary.

---

### Medium-Severity Issues

#### PRESETS-MED-001: Cascade Delete Not Verified

**Severity:** Medium
**File:** `xivdyetools-presets-api/src/handlers/presets.ts`
**Lines:** 182-189

**Problem:**
Batch delete assumes cascade is defined:

```typescript
await c.env.DB.batch([
  c.env.DB.prepare('DELETE FROM votes WHERE preset_id = ?').bind(id),
  c.env.DB.prepare('DELETE FROM presets WHERE id = ?').bind(id),
]);
```

**Impact:** If cascade not defined, orphaned votes remain.

**Recommendation:** Add integration test verifying cascade behavior.

---

#### PRESETS-MED-002: Inconsistent Error Response Format

**Severity:** Medium
**File:** `xivdyetools-presets-api/src/handlers/presets.ts`
**Multiple locations**

**Problem:**
Some errors use `error` + `message`, others use only `message`:

```typescript
// Line 133
{ error: 'Bad Request', message: 'User ID required' }

// Line 251
{ success: false, error: 'duplicate_dyes', message: '...' }
```

**Impact:** Inconsistent client error handling.

**Recommendation:** Define and enforce error response schema.

---

## 5. Cross-Cutting Concerns

### Security Issues

#### GLOBAL-SEC-001: Timing Attack Patterns

**Affected:** xivdyetools-discord-worker, xivdyetools-presets-api
**Issue:** Secret comparisons use short-circuit operators before timing-safe comparison.
**Recommendation:** All secret/token comparisons should use dedicated timing-safe functions.

---

#### GLOBAL-SEC-002: HSTS Header Only in Production

**Files:** oauth/index.ts, presets-api/index.ts, discord-worker/index.ts
**Issue:** HSTS header only set in production, localhost could use HTTP.
**Recommendation:** Always set HSTS or reject non-HTTPS requests.

---

### Performance Issues

#### GLOBAL-PERF-001: No Request Timeout Standards

**Affected:** All workers with external API calls
**Issue:** Inconsistent or missing timeouts on Discord, Google Perspective, Universalis APIs.
**Recommendation:** Establish timeout standards:
- Discord OAuth: 10s
- Discord API: 5s
- Google Perspective: 5s
- Universalis: 10s

---

#### GLOBAL-PERF-002: Sequential KV Operations

**Affected:** All workers using KV
**Issue:** Multiple KV operations executed sequentially.
**Recommendation:** Batch KV operations with `Promise.all()` where possible.

---

### Observability Issues

#### GLOBAL-OBS-001: Inconsistent Error Logging

**Issue:** Some errors logged with full stack, others with just message.
**Recommendation:** Standardize error logging format across all workers.

---

#### GLOBAL-OBS-002: Missing Request Tracing

**Issue:** Request IDs not consistently propagated to child operations.
**Recommendation:** Add request ID to all log statements and external API calls.

---

## 6. Remediation Priority

### Phase 1: Immediate (Security & Data Integrity)

| ID | Issue | Worker | Impact |
|----|-------|--------|--------|
| OAUTH-CRITICAL-002 | Open redirect vulnerability | oauth | Security breach |
| PRESETS-CRITICAL-001 | Duplicate preset race condition | presets-api | Data integrity |
| DISCORD-CRITICAL-003 | Timing-safe comparison bypass | discord-worker | Security |
| PROXY-CRITICAL-003 | Unlimited item IDs | universalis-proxy | DoS vector |

### Phase 2: High Priority (Reliability)

| ID | Issue | Worker | Impact |
|----|-------|--------|--------|
| OAUTH-HIGH-001 | Missing API timeouts | oauth | Worker hangs |
| DISCORD-HIGH-002 | Missing message timeouts | discord-worker | Worker hangs |
| PRESETS-HIGH-001 | Missing Perspective timeout | presets-api | Submission hangs |
| PROXY-CRITICAL-001 | Memory leak in coalescer | universalis-proxy | Memory exhaustion |
| PROXY-CRITICAL-002 | CORS middleware structure | universalis-proxy | CORS failures |

### Phase 3: Medium Priority (Quality)

| ID | Issue | Worker | Impact |
|----|-------|--------|--------|
| DISCORD-CRITICAL-001 | Analytics always success | discord-worker | Wrong metrics |
| OAUTH-HIGH-002 | User creation race | oauth | Duplicate users |
| PRESETS-CRITICAL-004 | Audit trail cleared | presets-api | Compliance gap |
| DISCORD-MED-001 | KV error silent failure | discord-worker | Disabled rate limiting |

### Phase 4: Low Priority (Technical Debt)

- Standardize error response formats
- Add version prefixes to KV keys
- Document rate limit configuration requirements
- Add comprehensive request tracing

---

*Generated by Claude Code audit on December 24, 2025*
