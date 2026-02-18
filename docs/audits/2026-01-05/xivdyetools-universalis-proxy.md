# 🔒 Security Audit Report: xivdyetools-universalis-proxy

**Project:** Cloudflare Worker - Universalis API Proxy  
**Audit Date:** January 5, 2026  
**Auditor:** GitHub Copilot

---

## Executive Summary

The xivdyetools-universalis-proxy is a well-designed Cloudflare Worker with several security measures already in place. The codebase demonstrates good security awareness with input validation, CORS controls, and response size limits. However, there are several issues ranging from informational to medium severity that should be addressed.

**Overall Risk:** ✅ **Good** (Low-Medium)

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🔵 Low | 4 |
| ⚪ Informational | 5 |

---

## Detailed Findings

### 1. SSRF Vulnerabilities

#### ✅ FINDING: SSRF Properly Mitigated
**Severity:** Informational (Positive Finding)  
**Location:** `src/config/api.ts`

The proxy has **good SSRF protection**:
- The `UNIVERSALIS_BASE_URL` is hardcoded in constants and not user-controllable
- The datacenter parameter is validated with regex
- Item IDs are validated to be numeric only
- No URL manipulation is possible from user input

```typescript
// Validate datacenter (alphanumeric only)
if (!/^[a-zA-Z0-9]+$/.test(datacenter)) {
  return c.json({ error: 'Invalid datacenter parameter' }, 400);
}
```

**No action required** - SSRF protections are adequate.

---

### 2. Cache Poisoning

#### ⚠️ FINDING: Cache Key Doesn't Include All Relevant Request Context
**Severity:** Low  
**Location:** `src/services/cache.ts`

The cache key is constructed from normalized request parameters but doesn't include the `Accept-Language` or other headers that might affect the upstream response.

```typescript
const normalizedIds = normalizeItemIds(itemIds);
const cacheKey = `aggregated:${datacenter.toLowerCase()}:${normalizedIds}`;
```

**Impact:** If Universalis ever returns locale-specific data based on headers, different users could receive cached data for the wrong locale.

**Recommended Fix:** For this specific API (market data), this is likely not an issue since Universalis returns numeric data. However, document this assumption and monitor for changes.

---

#### ⚠️ FINDING: No Cache Key Versioning
**Severity:** Low  
**Location:** `src/config/cache.ts`

Cache keys don't include a version prefix. If the response schema changes, stale cached data could cause issues.

**Recommended Fix:** Add a version prefix to cache keys:
```typescript
const CACHE_VERSION = 'v1';
const cacheKey = `${CACHE_VERSION}:aggregated:${datacenter.toLowerCase()}:${normalizedIds}`;
```

---

### 3. Input Validation

#### ⚠️ FINDING: Datacenter Validation Too Permissive
**Severity:** Medium  
**Location:** `src/handlers/aggregated.ts`

The datacenter validation allows any alphanumeric string, but valid FFXIV datacenters are a known finite set.

```typescript
// Current validation - too broad
if (!/^[a-zA-Z0-9]+$/.test(datacenter)) {
```

**Impact:** 
- Allows requests to upstream with arbitrary datacenter values
- Could be used to probe the upstream API or generate cache entries for non-existent datacenters (cache pollution)
- Increases attack surface

**Recommended Fix:** Whitelist valid datacenters:
```typescript
const VALID_DATACENTERS = new Set([
  'elemental', 'gaia', 'mana', 'meteor',  // Japan
  'aether', 'crystal', 'dynamis', 'primal', // NA
  'chaos', 'light',  // EU
  'materia',  // Oceania
  // Add world names if querying by world is supported
]);

const dcLower = datacenter.toLowerCase();
if (!VALID_DATACENTERS.has(dcLower)) {
  return c.json({ error: 'Invalid datacenter parameter' }, 400);
}
```

---

#### ✅ FINDING: Item ID Validation is Good
**Severity:** Informational (Positive Finding)  
**Location:** `src/utils/validation.ts`

Excellent validation:
- Regex validation for numeric-only input
- Count limit (1-100 items)
- Range validation (1-1,000,000)
- Prevents DoS through excessive requests

---

### 4. Rate Limiting

#### ⚠️ FINDING: Rate Limiting Not Implemented
**Severity:** Medium  
**Location:** `src/types/env.ts`, `wrangler.toml`

Rate limit configuration exists in environment variables but is **not enforced**:

```toml
# wrangler.toml
RATE_LIMIT_REQUESTS = "60"
RATE_LIMIT_WINDOW_SECONDS = "60"
```

The `Env` interface defines these variables, but no code uses them.

**Impact:** 
- Proxy can be abused to amplify attacks against Universalis
- No protection against clients exhausting your Cloudflare resources
- Could result in your proxy being rate-limited by Universalis, affecting all users

**Recommended Fix:** Implement rate limiting using Cloudflare Rate Limiting or a KV-based solution.

---

### 5. Response Handling

#### ✅ FINDING: Response Size Limit Implemented
**Severity:** Informational (Positive Finding)  
**Location:** `src/services/upstream.ts`, `src/config/api.ts`

Good protection against OOM attacks:
```typescript
const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024;

// Check Content-Length to prevent OOM from huge responses
const contentLength = response.headers.get('Content-Length');
if (contentLength) {
  const size = parseInt(contentLength, 10);
  if (!isNaN(size) && size > MAX_RESPONSE_SIZE_BYTES) {
    throw new ResponseTooLargeError(size);
  }
}
```

---

#### ⚠️ FINDING: Content-Length Bypass Possible
**Severity:** Low  
**Location:** `src/services/upstream.ts`

The size check only works if `Content-Length` header is present. Chunked transfer encoding (no Content-Length) bypasses this check.

**Impact:** A malicious or compromised upstream could send unlimited data.

**Recommended Fix:** Also track bytes while streaming the response or add streaming size limiter.

---

#### ⚠️ FINDING: No Response Content Validation
**Severity:** Low  
**Location:** `src/services/upstream.ts`

The proxy blindly passes through JSON from upstream without validation:
```typescript
return response.json() as Promise<T>;
```

**Impact:** If Universalis is compromised or returns malformed data, it's passed directly to clients.

**Recommended Fix:** Since this is a JSON API returning market data, the frontend should be treating all data as untrusted anyway. Consider adding optional schema validation.

---

### 6. Error Handling

#### ⚠️ FINDING: Error Message Information Disclosure
**Severity:** Medium  
**Location:** `src/index.ts`

In development mode, error messages are exposed directly:
```typescript
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : 'An unexpected error occurred',
    },
    500
  );
});
```

**Concern:** The `ENVIRONMENT` check is good, but ensure this is actually set to `production` in production deployment.

**Recommended Fix:** Add explicit check:
```typescript
const isDev = c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'test';
```

---

### 7. CORS Configuration

#### ✅ FINDING: CORS Origin Validation
**Severity:** Informational (Positive Finding)  
**Location:** `src/middleware/cors.ts`

Good CORS implementation:
- Explicit origin whitelist
- Development mode allows localhost variants
- Production restricts to specific domain

```typescript
const isAllowed =
  c.env.ENVIRONMENT === 'development'
    ? origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
    : allowedOrigins.includes(origin);
```

---

### 8. Additional Security Observations

#### ⚠️ FINDING: No Request Logging for Security Monitoring
**Severity:** Informational  
**Location:** Entire codebase

There's no structured logging of requests that could help identify abuse patterns or security incidents.

**Recommended Fix:** Add basic request logging or use Cloudflare Workers Analytics.

---

#### ✅ FINDING: User-Agent Identification
**Severity:** Informational (Positive Finding)  
**Location:** `src/config/api.ts`

Good practice - identifying your proxy to Universalis:
```typescript
const USER_AGENT = 'XIVDyeTools/1.0 (https://xivdyetools.projectgalatine.com)';
```

---

#### ✅ FINDING: Request Coalescer Memory Considerations
**Severity:** Informational  
**Location:** `src/services/coalescer.ts`

The request coalescer uses module-level state that persists across requests in the same isolate. Well-implemented with:
- 60-second maximum lifetime for entries
- 10-second cleanup interval
- Entries removed after completion

---

## Summary of Recommended Actions

### Priority 1 (Should Fix)
| Finding | Severity | Effort |
|---------|----------|--------|
| Implement rate limiting | Medium | Medium |
| Whitelist valid datacenters | Medium | Low |
| Verify production ENVIRONMENT setting | Medium | Low |

### Priority 2 (Consider Fixing)
| Finding | Severity | Effort |
|---------|----------|--------|
| Add cache key versioning | Low | Low |
| Handle chunked transfer size limits | Low | Medium |
| Add response schema validation | Low | Medium |
| Add structured security logging | Informational | Low |

---

## Positive Security Observations

The codebase demonstrates several security best practices:

1. ✅ **SSRF Protection**: Upstream URL is not user-controllable
2. ✅ **Input Validation**: Item IDs validated for format, count, and range
3. ✅ **Response Size Limits**: Protection against OOM attacks
4. ✅ **CORS on All Responses**: Including error responses
5. ✅ **Request Coalescing Cleanup**: Prevents memory leaks
6. ✅ **Proper Error Handling**: Environment-aware error messages
7. ✅ **User-Agent Identification**: Good neighbor to upstream API
8. ✅ **TypeScript**: Type safety reduces certain vulnerability classes

---

## Conclusion

The xivdyetools-universalis-proxy is a well-designed proxy with solid security fundamentals. The main gaps are:

1. **Rate limiting** is configured but not enforced - this is the most significant issue
2. **Datacenter validation** could be tightened with a whitelist
3. Minor improvements in response validation and logging

No critical or high-severity vulnerabilities were found. The proxy is suitable for production use after addressing the rate limiting concern.
