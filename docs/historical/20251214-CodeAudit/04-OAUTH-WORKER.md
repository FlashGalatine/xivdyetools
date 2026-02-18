# Code Audit: xivdyetools-oauth

**Version:** 2.0.1-beta
**Date:** 2025-12-14
**Total Findings:** 12 (1 CRITICAL, 5 HIGH, 5 MEDIUM, 1 LOW)

---

## Summary Table

| ID | Title | Severity | Category | File |
|----|-------|----------|----------|------|
| OAUTH-SEC-001 | CORS Localhost Overly Permissive | CRITICAL | Security | index.ts |
| OAUTH-SEC-002 | Missing PKCE Verification | HIGH | Security | callback.ts |
| OAUTH-BUG-001 | JWT Grace Period Replay Attack | HIGH | Security | refresh.ts |
| OAUTH-BUG-002 | Missing Rate Limit Headers on Error | HIGH | Bug | index.ts |
| OAUTH-SEC-003 | State Parameter Missing Expiration | HIGH | Security | authorize.ts |
| OAUTH-SEC-004 | Redirect URI Dev Bypass | HIGH | Security | callback.ts |
| OAUTH-PERF-001 | In-Memory Rate Limiter Unbounded | MEDIUM | Performance | rate-limit.ts |
| OAUTH-SEC-005 | Missing Scope Validation | MEDIUM | Security | callback.ts |
| OAUTH-BUG-003 | User Service Race Condition | MEDIUM | Bug | user-service.ts |
| OAUTH-SEC-006 | Error Information Leakage | MEDIUM | Security | callback.ts |
| OAUTH-REF-001 | Handler Organization | MEDIUM | Refactoring | Multiple |
| OAUTH-REF-002 | Duplicate JWT Logic | LOW | Duplication | jwt-service.ts, refresh.ts |

---

## CRITICAL Findings

### OAUTH-SEC-001: CORS Localhost Overly Permissive

**Severity:** CRITICAL
**Category:** Security

**Location:**
- **File:** `src/index.ts`
- **Lines:** 41-44
- **Pattern:** CORS origin regex

**Description:**
CORS configuration allows ANY localhost port via regex pattern. Any application running on localhost (including malicious browser extensions or compromised local apps) can make authenticated requests.

**Evidence:**
```typescript
// Lines 41-44: Overly permissive regex
const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Allows:
// - http://localhost:3000 (intended)
// - http://localhost:9999 (unintended)
// - http://127.0.0.1:65535 (any port!)
```

**Impact:**
- Malicious localhost application can impersonate OAuth worker
- Browser extension on localhost can steal tokens
- Cross-origin requests from any local port allowed

**Recommendation:**
```typescript
// Whitelist specific development ports
const ALLOWED_LOCALHOST_PORTS = ['3000', '5173', '8787'];

function isAllowedOrigin(origin: string): boolean {
  const url = new URL(origin);

  // Production domains
  if (PRODUCTION_DOMAINS.includes(url.hostname)) {
    return true;
  }

  // Development: specific ports only
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return ALLOWED_LOCALHOST_PORTS.includes(url.port);
  }

  return false;
}
```

**Effort:** Low (15 minutes)

---

## HIGH Findings

### OAUTH-SEC-002: Missing PKCE Verification

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/handlers/callback.ts`
- **Lines:** 113-145
- **Function:** OAuth callback handling

**Description:**
PKCE parameters (`code_challenge`, `code_verifier`) are sent to Discord but never verified on return. The system doesn't confirm that `SHA256(code_verifier) === code_challenge`, making PKCE purely decorative.

**Evidence:**
```typescript
// authorize.ts: PKCE challenge sent
const codeChallenge = await generateCodeChallenge(codeVerifier);
// State includes codeChallenge...

// callback.ts: PKCE never verified!
const { code, state } = parseCallbackParams(request);
// state.codeChallenge exists but never compared to SHA256(code_verifier)

const tokenResponse = await exchangeToken(code, env);
// Code exchanged without PKCE validation
```

**Impact:**
- PKCE provides no actual protection
- Authorization code interception attacks possible
- OAuth flow is effectively pre-PKCE security level

**Recommendation:**
```typescript
// In callback handler, verify PKCE:
async function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const computed = base64UrlEncode(new Uint8Array(digest));
  return computed === codeChallenge;
}

// Before token exchange:
if (!await verifyPKCE(state.codeVerifier, state.codeChallenge)) {
  return jsonResponse({ error: 'PKCE verification failed' }, 400);
}
```

**Effort:** Medium (1 hour)

---

### OAUTH-BUG-001: JWT Grace Period Replay Attack

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/handlers/refresh.ts`
- **Lines:** 76-88
- **Function:** Token refresh handling

**Description:**
The 24-hour grace period allows expired tokens to be refreshed, but there's no mechanism to detect or prevent duplicate refresh-token reuse. An attacker who intercepts a refresh request can replay it.

**Evidence:**
```typescript
// Grace period check
if (decoded.exp + GRACE_PERIOD_SECONDS < now) {
  return jsonResponse({ error: 'Token expired beyond grace period' }, 401);
}

// No tracking of:
// - Which tokens have been refreshed
// - Token generation/version number
// - One-time-use refresh tokens
```

**Impact:**
- Token replay attack within 24h grace period
- Multiple sessions from single token
- Difficult to detect compromised tokens

**Recommendation:**
```typescript
// Option 1: Track refresh token usage in KV
const refreshKey = `refresh:${decoded.jti}`;
const used = await env.KV.get(refreshKey);
if (used) {
  // Token already refreshed - potential attack
  await revokeAllUserTokens(decoded.sub);
  return jsonResponse({ error: 'Token reuse detected' }, 401);
}
await env.KV.put(refreshKey, 'used', { expirationTtl: GRACE_PERIOD_SECONDS });

// Option 2: Add token version to JWT
// Increment version on each refresh, reject old versions
```

**Effort:** Medium (2 hours)

---

### OAUTH-BUG-002: Missing Rate Limit Headers on Error Response

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/index.ts`
- **Lines:** 60-85
- **Pattern:** Response header ordering

**Description:**
When rate limit is exceeded, the response is returned early WITHOUT setting rate limit headers. Clients never learn the limit/reset time.

**Evidence:**
```typescript
// Lines 66-68: Headers set here
response.headers.set('X-RateLimit-Limit', String(limit));
response.headers.set('X-RateLimit-Remaining', String(remaining));
response.headers.set('X-RateLimit-Reset', String(resetAt));

// Lines 70-82: But rate limit error returned BEFORE above code
if (!rateLimitResult.allowed) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' }  // No rate limit headers!
  });
}
```

**Impact:**
- Clients can't implement smart retry logic
- No visibility into when rate limit resets
- Poor developer experience

**Recommendation:**
```typescript
if (!rateLimitResult.allowed) {
  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(rateLimitResult.resetAt),
      'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
    }
  });
}
```

**Effort:** Low (15 minutes)

---

### OAUTH-SEC-003: State Parameter Missing Expiration

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/handlers/authorize.ts`
- **Lines:** 80-90
- **Function:** OAuth state generation

**Description:**
State parameter is base64-encoded JSON with CSRF token, but no expiration timestamp. Old states remain valid indefinitely.

**Evidence:**
```typescript
// State structure (line 80-90)
const state = {
  csrf: generateCSRFToken(),
  codeChallenge: codeChallenge,
  redirectUri: redirectUri,
  // Missing: iat (issued at), exp (expiration)
};
```

**Impact:**
- Attackers can replay old states
- If state logged/exposed, usable indefinitely
- CSRF protection weakened

**Recommendation:**
```typescript
const state = {
  csrf: generateCSRFToken(),
  codeChallenge: codeChallenge,
  redirectUri: redirectUri,
  iat: Math.floor(Date.now() / 1000),  // Issued at
  exp: Math.floor(Date.now() / 1000) + 600  // 10 minute expiration
};

// In callback.ts:
if (state.exp < Math.floor(Date.now() / 1000)) {
  return jsonResponse({ error: 'State expired' }, 400);
}
```

**Effort:** Low (30 minutes)

---

### OAUTH-SEC-004: Redirect URI Validation Dev Bypass

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/handlers/callback.ts`
- **Lines:** 114-129
- **Pattern:** Development mode bypass

**Description:**
Redirect URI validation is bypassed when `ENVIRONMENT` is set to "development". If this variable is accidentally set in production, validation is disabled.

**Evidence:**
```typescript
// Lines 120-128
if (redirectUri !== expectedUri) {
  if (env.ENVIRONMENT === 'development') {
    console.warn('Redirect URI mismatch in development mode');
    // Warning only, continues processing!
  } else {
    return jsonResponse({ error: 'Redirect URI mismatch' }, 400);
  }
}
```

**Impact:**
- Production misconfiguration disables security
- Open redirect vulnerability if bypassed
- Token theft via malicious redirect

**Recommendation:**
```typescript
// ALWAYS validate redirect URI
if (redirectUri !== expectedUri) {
  console.error(`Redirect URI mismatch: ${redirectUri} vs ${expectedUri}`);
  return jsonResponse({ error: 'Redirect URI mismatch' }, 400);
}

// Remove development bypass entirely
// Or use strict allowlist even in development
```

**Effort:** Low (10 minutes)

---

## MEDIUM Findings

### OAUTH-PERF-001: In-Memory Rate Limiter Unbounded

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/services/rate-limit.ts`
- **Lines:** 36, 116-128
- **Pattern:** Memory management

**Description:**
The `requestLog` Map grows indefinitely on each worker instance. Cleanup runs probabilistically at 1% rate, insufficient for high traffic.

**Evidence:**
```typescript
private static requestLog = new Map<string, RequestEntry[]>();

// Line 106: Probabilistic cleanup
if (Math.random() < 0.01) {  // Only 1% chance
  this.cleanup();
}
```

**Impact:**
- Worker memory grows over time
- Could cause OOM on long-lived workers
- Inconsistent cleanup across instances

**Recommendation:**
```typescript
// Use LRU cache with fixed size
private static requestLog = new LRUCache<string, RequestEntry[]>(10000);

// Or deterministic cleanup
private static requestCount = 0;
static checkRateLimit(...) {
  if (++this.requestCount % 100 === 0) {
    this.cleanup();
  }
  // ...
}
```

**Effort:** Medium (1 hour)

---

### OAUTH-SEC-005: Missing Scope Validation

**Severity:** MEDIUM
**Category:** Security

**Location:**
- **File:** `src/handlers/callback.ts`
- **Lines:** 165-183
- **Function:** User info processing

**Description:**
After fetching user info from Discord, no validation that the token actually has `identify` scope. If Discord API changes or response is manipulated, unvalidated user data is used.

**Evidence:**
```typescript
const userInfo = await fetchUserInfo(tokenData.access_token);
// No validation of:
// - tokenData.scope includes 'identify'
// - userInfo has required fields
```

**Impact:**
- Could accept tokens without proper permissions
- User spoofing if response manipulated

**Recommendation:**
```typescript
// Validate scope from token response
if (!tokenData.scope?.includes('identify')) {
  return jsonResponse({ error: 'Missing required scope' }, 400);
}

// Validate user info structure
if (!userInfo.id || !userInfo.username) {
  return jsonResponse({ error: 'Invalid user data' }, 400);
}
```

**Effort:** Low (20 minutes)

---

### OAUTH-BUG-003: User Service Race Condition

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/services/user-service.ts`
- **Pattern:** Find or create pattern

**Description:**
If multiple concurrent requests arrive for same user, both might call `findOrCreateUser` simultaneously, both do INSERT, causing race condition or duplicate records.

**Impact:**
- Duplicate user records possible
- 500 error on constraint violation
- Inconsistent user state

**Recommendation:**
```typescript
// Use UPSERT or handle constraint violation
async function findOrCreateUser(discordId: string, userData: UserData) {
  try {
    return await db.insert(users).values({
      discord_id: discordId,
      ...userData
    }).onConflictDoUpdate({
      target: users.discord_id,
      set: { ...userData, updated_at: new Date() }
    });
  } catch (error) {
    if (error.code === 'UNIQUE_VIOLATION') {
      return await db.select().from(users).where(eq(users.discord_id, discordId));
    }
    throw error;
  }
}
```

**Effort:** Medium (1 hour)

---

### OAUTH-SEC-006: Error Information Leakage

**Severity:** MEDIUM
**Category:** Security

**Location:**
- **File:** `src/handlers/callback.ts`
- **Lines:** 150-153
- **Pattern:** Error logging

**Description:**
In development mode, full Discord error data is logged. If logs are exposed, could leak sensitive information.

**Evidence:**
```typescript
if (env.ENVIRONMENT === 'development') {
  console.log('Discord error response:', errorData);  // Full error data
}
```

**Impact:**
- Potential information disclosure
- API keys/secrets in error responses could leak

**Recommendation:**
```typescript
if (env.ENVIRONMENT === 'development') {
  console.log('Discord error:', {
    status: errorData.error,
    description: errorData.error_description
    // Don't log full response
  });
}
```

**Effort:** Low (10 minutes)

---

### OAUTH-REF-001: Handler Organization

**Severity:** MEDIUM
**Category:** Refactoring

**Location:**
- **Files:** Multiple handler files
- **Pattern:** Route mounting

**Description:**
Three routers mounted on same `/auth` path creates complexity. Route organization could be clearer.

**Impact:**
- Harder to trace request flow
- Potential route conflicts

**Recommendation:**
Consolidate routes or document structure clearly.

**Effort:** Medium (1 hour)

---

### OAUTH-REF-002: Duplicate JWT Logic

**Severity:** LOW
**Category:** Duplication

**Location:**
- **Files:**
  - `src/services/jwt-service.ts`
  - `src/handlers/refresh.ts:280-316`

**Description:**
`createJWTFromPayload()` in refresh.ts duplicates base64UrlEncode and sign logic from jwt-service.ts.

**Impact:**
- Maintenance burden
- Potential drift between implementations

**Recommendation:**
Extract shared JWT utility functions.

**Effort:** Low (30 minutes)

---

## Recommendations Summary

### Immediate (Day 1)
1. Fix CORS localhost whitelist (OAUTH-SEC-001)
2. Remove redirect URI dev bypass (OAUTH-SEC-004)

### This Sprint
3. Implement PKCE verification (OAUTH-SEC-002)
4. Add state expiration (OAUTH-SEC-003)
5. Fix rate limit headers (OAUTH-BUG-002)
6. Add scope validation (OAUTH-SEC-005)

### Next Sprint
7. Implement token replay protection (OAUTH-BUG-001)
8. Fix rate limiter memory growth (OAUTH-PERF-001)
9. Handle user service race condition (OAUTH-BUG-003)

### Backlog
10. Reduce error information leakage (OAUTH-SEC-006)
11. Consolidate JWT logic (OAUTH-REF-002)
12. Improve route organization (OAUTH-REF-001)
