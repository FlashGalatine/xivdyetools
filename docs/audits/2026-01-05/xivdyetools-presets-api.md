# 🔒 Security Audit Report: xivdyetools-presets-api

**Audit Date:** January 5, 2026  
**Project:** XIV Dye Tools Community Presets API (Cloudflare Worker + D1)  
**Auditor:** GitHub Copilot

---

## Executive Summary

This audit examined the xivdyetools-presets-api Cloudflare Worker for security vulnerabilities across SQL injection, authentication, authorization, input validation, and other critical areas. The codebase demonstrates **strong security practices overall**, with parameterized queries throughout, proper authorization checks, and defense-in-depth strategies.

**Overall Assessment: ✅ GOOD** with minor improvements recommended.

---

## Findings Summary

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 0 | None found |
| 🟠 High | 0 | None found |
| 🟡 Medium | 3 | In-memory rate limiting, category cache poisoning potential, SSRF via Discord webhook |
| 🔵 Low | 4 | Missing request ID validation, moderator ID parsing, ban check error handling, development debug endpoint |
| ℹ️ Informational | 5 | Best practices and hardening recommendations |

---

## Detailed Findings

### 🟡 Medium Severity

#### M1: In-Memory Rate Limiting Resets on Worker Restart
**File:** `src/services/rate-limit-service.ts`  
**Lines:** 19-35

**Description:** The IP-based rate limiting uses an in-memory Map (`ipRequestLog`) that resets when the Worker isolate is recycled. This is documented but could allow bypass in high-traffic scenarios where Cloudflare spawns new isolates.

**Code:**
```typescript
const ipRequestLog = new Map<string, number[]>();
```

**Risk:** Attackers could potentially bypass rate limits by waiting for isolate recycle or forcing enough traffic to spawn new isolates.

**Recommendation:** For mission-critical rate limiting, consider using Cloudflare's Durable Objects or external storage (KV). The current approach is acceptable for defense-in-depth as the daily submission limit uses the database.

---

#### M2: Category Cache Without Invalidation
**File:** `src/handlers/presets.ts`  
**Lines:** 512-538

**Description:** The category cache has a 60-second TTL but no invalidation mechanism. If a malicious category is somehow inserted into the database, it would be cached and accepted for 60 seconds.

**Code:**
```typescript
let cachedCategories: string[] | null = null;
let categoryCacheTime = 0;
const CATEGORY_CACHE_TTL = 60000; // 1 minute
```

**Risk:** Low. Categories are seeded via schema and there's no admin endpoint to create categories. However, if D1 console access is compromised, malicious categories could be cached.

**Recommendation:** Acceptable risk given the threat model. Document that category management requires schema migrations.

---

#### M3: SSRF Potential in Discord Notifications
**File:** `src/handlers/presets.ts`  
**Lines:** 654-712

**Description:** The `sendDiscordNotification` function sends requests to the Discord service binding with an internal webhook secret. The destination is controlled by the service binding (safe), but the payload includes user-controlled content (`preset.name`, `preset.description`).

**Risk:** The user content flows to the Discord worker which then forwards to Discord's API. If the Discord worker has vulnerabilities or if the Discord embed parsing has issues, malicious content could cause problems. However, this is mitigated by content moderation running before notification.

**Recommendation:** Ensure the Discord worker also validates/sanitizes incoming payload data. The current implementation is acceptable.

---

### 🔵 Low Severity

#### L1: Request ID Not Validated When Received
**File:** `src/middleware/request-id.ts`  
**Lines:** 32-33

**Description:** The incoming `X-Request-ID` header is accepted without validation. While UUIDs are expected, any string is accepted.

**Code:**
```typescript
const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
```

**Risk:** Log injection if request IDs aren't sanitized when logged. An attacker could send `X-Request-ID: malicious\nNew-Header: injected`.

**Recommendation:** Validate the format matches UUID pattern or limit to alphanumeric characters:
```typescript
const headerRequestId = c.req.header('X-Request-ID');
const isValidUUID = headerRequestId && /^[a-f0-9-]{36}$/i.test(headerRequestId);
const requestId = isValidUUID ? headerRequestId : crypto.randomUUID();
```

---

#### L2: Development Debug Endpoint Exposed
**File:** `src/index.ts`  
**Lines:** 158-163

**Description:** The `/__force-error` endpoint exists for testing the global error handler. While it returns 404 in production, its existence is discoverable.

**Code:**
```typescript
app.get('/__force-error', (c) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ success: false, error: ErrorCode.NOT_FOUND, message: 'Not found' }, 404);
  }
  throw new Error('forced error');
});
```

**Risk:** Information disclosure - reveals that this is a Hono app with a custom error handler. The endpoint leaks that there are different behaviors between development and production.

**Recommendation:** Consider removing this endpoint entirely or making it only exist when ENVIRONMENT !== 'production' at route registration time.

---

#### L3: Ban Check Continues on Database Error
**File:** `src/middleware/ban-check.ts`  
**Lines:** 69-73

**Description:** If the ban check query fails, the request is allowed to proceed with an error log.

**Code:**
```typescript
} catch (error) {
  // Log error but don't block the request if the check fails
  console.error('Ban check failed:', error);
}
```

**Risk:** If the `banned_users` table is corrupted or D1 has issues, banned users could bypass the ban.

**Recommendation:** Consider a stricter approach for critical paths, or ensure monitoring alerts on ban check failures. The current fail-open approach may be intentional to prioritize availability.

---

#### L4: Moderator ID Parsing Edge Cases
**File:** `src/middleware/auth.ts`  
**Lines:** 161-169

**Description:** The moderator ID parsing handles various formats but doesn't validate that IDs are valid Discord snowflakes.

**Code:**
```typescript
const ids = moderatorIds
  .split(/[\s,]+/)
  .filter(Boolean);
return ids.includes(userDiscordId);
```

**Risk:** If MODERATOR_IDS is misconfigured (e.g., contains non-numeric values), no moderators would be recognized. While env validation catches this at startup in production, development mode continues.

**Recommendation:** Already mitigated by `validateEnv` which validates Discord snowflake format. Consider logging a warning if env validation fails in development.

---

### ℹ️ Informational

#### I1: Excellent Parameterized Query Usage ✅
**All SQL files reviewed**

All database queries use parameterized queries with `?` placeholders. No SQL injection vulnerabilities were found.

**Good examples:**
- `src/services/preset-service.ts#L247`: `stmt.bind(id)`
- `src/handlers/votes.ts#L40`: `INSERT INTO votes (preset_id, user_discord_id, created_at) VALUES (?, ?, ?)`
- `src/handlers/moderation.ts#L65`: `INSERT INTO moderation_log ... VALUES (?, ?, ?, ?, ?, ?)`

**LIKE Pattern Escaping:** `src/services/preset-service.ts#L17-L20` properly escapes LIKE wildcards:
```typescript
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}
```

---

#### I2: Strong Authorization Model ✅
**Files:** `src/middleware/auth.ts`, `src/handlers/presets.ts`

- **IDOR Prevention:** Users can only access/edit their own presets via `author_discord_id` checks
- **Moderator Checks:** All moderation endpoints use `requireModerator`
- **Ownership Verification:** `src/handlers/presets.ts#L212-L213`:
  ```typescript
  if (preset.author_discord_id !== auth.userDiscordId) {
    return forbiddenResponse(c, 'You can only edit your own presets');
  }
  ```

---

#### I3: Secure CORS Configuration ✅
**File:** `src/index.ts`

- Denies requests without Origin header
- Whitelists specific origins
- Limits localhost to specific ports
- Proper credentials handling

---

#### I4: JWT Algorithm Validation ✅
**File:** `src/middleware/auth.ts`

Prevents JWT algorithm confusion attacks:
```typescript
if (header.alg !== 'HS256') {
  console.warn('JWT verification failed: Invalid algorithm', { alg: header.alg });
  return null;
}
```

---

#### I5: Error Handling Does Not Leak Schema ✅
**File:** `src/index.ts`

Production error responses are sanitized:
```typescript
message: isDev ? err.message : 'An unexpected error occurred',
...(isDev && { stack: err.stack }),
```

---

## Security Checklist Summary

| Category | Status | Notes |
|----------|--------|-------|
| SQL Injection | ✅ SECURE | All queries parameterized, LIKE patterns escaped |
| Authentication | ✅ SECURE | Bot HMAC signing, JWT validation with algorithm check |
| Authorization | ✅ SECURE | Ownership checks, moderator requirements |
| IDOR | ✅ SECURE | User can only access own presets via /mine |
| Input Validation | ✅ SECURE | Length limits, type checks, category validation |
| Rate Limiting | ⚠️ ACCEPTABLE | IP-based in-memory + DB-based submission limit |
| Data Exposure | ✅ SECURE | Hidden presets excluded, sanitized errors |
| CORS | ✅ SECURE | Strict origin whitelisting |
| Error Handling | ✅ SECURE | No schema leaks in production |

---

## Recommended Actions

### Priority 1 (Quick Wins)
1. **Validate X-Request-ID format** - 5 min fix
2. **Remove or conditionally register `/__force-error`** - 2 min fix

### Priority 2 (Consider)
3. **Add monitoring/alerting for ban check failures**
4. **Document rate limit limitations in operations docs**

### Priority 3 (Future Hardening)
5. **Consider Durable Objects for IP rate limiting if abuse detected**
6. **Add request ID to structured logging for ban check failures**

---

## Conclusion

The xivdyetools-presets-api demonstrates excellent security practices for a Cloudflare Worker with D1 database. The development team has implemented:

- ✅ Parameterized queries throughout
- ✅ Defense-in-depth strategies (double checks on hidden presets)
- ✅ HMAC request signing for bot authentication
- ✅ JWT algorithm validation
- ✅ Comprehensive input validation
- ✅ Proper authorization checks preventing IDOR
- ✅ Content moderation with both local and ML-based filtering
- ✅ Rate limiting at multiple levels

No critical or high-severity vulnerabilities were identified. The codebase is production-ready from a security perspective.
