# 🔐 Security Audit Report: xivdyetools-oauth

**Audit Date:** January 5, 2026  
**Remediation Completed:** January 5, 2026  
**Scope:** Complete OAuth Worker security review  
**Overall Assessment:** **✅ PASSING** - All identified issues have been remediated

---

## Executive Summary

The xivdyetools-oauth worker demonstrates **excellent security practices**. The implementation includes:
- ✅ PKCE (Proof Key for Code Exchange) for OAuth flows
- ✅ State parameter with expiration and HMAC signing for CSRF protection
- ✅ Redirect URI validation against allowlist (both providers)
- ✅ Token revocation support via KV blacklist
- ✅ Persistent rate limiting via Durable Objects
- ✅ Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- ✅ Sanitized error logging in production
- ✅ Request timeouts on all external API calls
- ✅ Scope validation for OAuth tokens

All issues identified in the initial audit have been successfully remediated.

---

## Findings Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| 🔴 Critical | 0 | N/A |
| 🟠 High | 2 | ✅ 2/2 |
| 🟡 Medium | 5 | ✅ 5/5 |
| 🔵 Low | 3 | ✅ 3/3 |
| ⚪ Informational | 3 | N/A |

---

## 🟠 High Severity Issues

### 1. XIVAuth State Parameter Missing Expiration Check ✅ FIXED
**Location:** `src/handlers/xivauth.ts` - GET /xivauth/callback  
**Severity:** High  
**Category:** CSRF / Replay Attack  
**Status:** ✅ Remediated - State now includes `iat`/`exp` timestamps and validation via `validateStateExpiration()` utility

**Description:**  
The XIVAuth callback handler decodes and uses the state parameter without validating its expiration (`exp` field). Unlike the Discord callback which checks state expiration, the XIVAuth handler never validates the timestamp. This allows indefinite state parameter reuse for replay attacks.

**Vulnerable Code:**
```typescript
// xivauth.ts GET /xivauth/callback
try {
  stateData = JSON.parse(atob(state));
} catch {
  // error handling...
}

// ❌ No expiration check!
// ❌ No iat (issued-at) field in xivauth state generation either!
```

Compare to Discord callback which properly validates:
```typescript
// callback.ts - properly validates expiration
if (stateData.exp && stateData.exp < now) {
  // redirect with error
}
```

**Recommended Fix:**  
Add expiration check to XIVAuth state and include `iat`/`exp` in state generation:

```typescript
// In GET /auth/xivauth - add timestamps
const now = Math.floor(Date.now() / 1000);
const stateData = {
  csrf: state || crypto.randomUUID(),
  code_challenge,
  redirect_uri: finalRedirectUri,
  return_path: return_path || '/',
  provider: 'xivauth',
  iat: now,
  exp: now + 600, // 10 minute expiration
};

// In GET /xivauth/callback - validate expiration
const now = Math.floor(Date.now() / 1000);
if (stateData.exp && stateData.exp < now) {
  const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/callback`);
  redirectUrl.searchParams.set('error', 'OAuth state expired');
  redirectUrl.searchParams.set('provider', 'xivauth');
  return c.redirect(redirectUrl.toString());
}
```

---

### 2. XIVAuth Callback Missing Redirect URI Validation ✅ FIXED
**Location:** `src/handlers/xivauth.ts` - GET /xivauth/callback  
**Severity:** High  
**Category:** Open Redirect Vulnerability  
**Status:** ✅ Remediated - Now validates redirect URI using `validateRedirectUri()` utility with environment-aware allowlist

**Description:**  
The XIVAuth GET callback handler redirects to `stateData.redirect_uri` without validating it against the allowlist. While the initial `/auth/xivauth` endpoint validates the redirect_uri before storing in state, an attacker could craft a malicious state parameter with an arbitrary redirect_uri since the state is only base64-encoded (not signed/encrypted).

**Vulnerable Code:**
```typescript
// xivauth.ts GET /xivauth/callback
const redirectUrl = new URL(stateData.redirect_uri);  // ❌ No validation!
redirectUrl.searchParams.set('code', code);
redirectUrl.searchParams.set('csrf', stateData.csrf);
return c.redirect(redirectUrl.toString());
```

Compare to Discord callback which properly validates:
```typescript
// callback.ts - properly validates redirect origin
if (!allowedOrigins.includes(redirectUrl.origin)) {
  console.error('Blocked redirect to untrusted origin:', redirectUrl.origin);
  // return error
}
```

**Recommended Fix:**  
Add the same redirect URI validation as the Discord callback:

```typescript
// In GET /xivauth/callback, before redirect:
const allowedOrigins = [
  new URL(c.env.FRONTEND_URL).origin,
];

if (c.env.ENVIRONMENT === 'development') {
  allowedOrigins.push('http://localhost:5173');
  allowedOrigins.push('http://localhost:3000');
}

let redirectUrl: URL;
try {
  redirectUrl = new URL(stateData.redirect_uri);
} catch {
  const errorRedirect = new URL(`${c.env.FRONTEND_URL}/auth/callback`);
  errorRedirect.searchParams.set('error', 'Invalid redirect URI');
  errorRedirect.searchParams.set('provider', 'xivauth');
  return c.redirect(errorRedirect.toString());
}

if (!allowedOrigins.includes(redirectUrl.origin)) {
  console.error('Blocked redirect to untrusted origin:', redirectUrl.origin);
  const errorRedirect = new URL(`${c.env.FRONTEND_URL}/auth/callback`);
  errorRedirect.searchParams.set('error', 'Untrusted redirect origin');
  errorRedirect.searchParams.set('provider', 'xivauth');
  return c.redirect(errorRedirect.toString());
}
```

---

## 🟡 Medium Severity Issues

### 3. XIVAuth POST Callback Missing Code Verifier Format Validation ✅ FIXED
**Location:** `src/handlers/xivauth.ts` - POST /xivauth/callback  
**Severity:** Medium  
**Category:** Input Validation  
**Status:** ✅ Remediated - Now uses `validateCodeVerifier()` utility for RFC 7636 compliance

**Description:**  
The Discord POST callback validates the `code_verifier` format using RFC 7636 regex, but the XIVAuth POST callback does not. While XIVAuth server-side validation exists, defense-in-depth requires client-side validation too.

**Discord (good):**
```typescript
// callback.ts POST /callback
const verifierRegex = /^[A-Za-z0-9\-._~]{43,128}$/;
if (!verifierRegex.test(code_verifier)) {
  return c.json({ success: false, error: 'Invalid code_verifier format' }, 400);
}
```

**XIVAuth (missing):**
```typescript
// xivauth.ts POST /xivauth/callback
const { code, code_verifier } = body;
if (!code || !code_verifier) {
  // only checks presence, not format!
}
```

**Recommended Fix:**
```typescript
// Add to POST /xivauth/callback before token exchange:
const verifierRegex = /^[A-Za-z0-9\-._~]{43,128}$/;
if (!verifierRegex.test(code_verifier)) {
  return c.json<AuthResponse>({
    success: false,
    error: 'Invalid code_verifier format',
  }, 400);
}
```

---

### 4. XIVAuth POST Callback Missing Request Timeout ✅ FIXED
**Location:** `src/handlers/xivauth.ts`  
**Severity:** Medium  
**Category:** Denial of Service  
**Status:** ✅ Remediated - Token exchange and user info requests now use `REQUEST_TIMEOUT_MS` (10s) and `USER_INFO_TIMEOUT_MS` (5s)

**Description:**  
The Discord callback includes a 10-second timeout on the token exchange request, but XIVAuth does not. If XIVAuth servers hang, the worker will wait indefinitely, consuming resources.

**Discord (good):**
```typescript
signal: AbortSignal.timeout(10000), // 10 second timeout
```

**XIVAuth (missing):**
```typescript
const tokenResponse = await fetch(XIVAUTH_TOKEN_URL, {
  method: 'POST',
  // ❌ No timeout!
});
```

**Recommended Fix:**
```typescript
const tokenResponse = await fetch(XIVAUTH_TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(tokenParams),
  signal: AbortSignal.timeout(10000), // Add timeout
});
```

---

### 5. XIVAuth Missing Token Scope Validation ✅ FIXED
**Location:** `src/handlers/xivauth.ts`  
**Severity:** Medium  
**Category:** Authorization Bypass  
**Status:** ✅ Remediated - Now uses `validateScopes()` utility with `XIVAUTH_REQUIRED_SCOPES` constant

**Description:**  
The Discord callback validates that the returned token includes the required 'identify' scope. The XIVAuth callback does not validate that the returned scopes match what was requested.

**Discord (good):**
```typescript
if (!tokens.scope || !tokens.scope.includes('identify')) {
  return c.json({ success: false, error: 'Token missing required permissions' }, 401);
}
```

**XIVAuth (missing):** No scope validation after token exchange.

**Recommended Fix:**
```typescript
// After token exchange, validate required scopes:
const requiredScopes = ['user', 'character'];
const grantedScopes = tokens.scope?.split(' ') || [];
const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

if (missingScopes.length > 0) {
  console.error('XIVAuth token missing required scopes', { 
    required: requiredScopes, 
    granted: grantedScopes 
  });
  return c.json<AuthResponse>({
    success: false,
    error: 'Token missing required permissions',
  }, 401);
}
```

---

### 6. Rate Limiting Uses In-Memory Store (Not Persistent) ✅ FIXED
**Location:** `src/services/rate-limit-do.ts`, `src/durable-objects/rate-limiter.ts`  
**Severity:** Medium  
**Category:** Rate Limit Bypass  
**Status:** ✅ Remediated - Implemented Durable Objects-based rate limiter for persistence across isolates and edge locations

**Description:**  
Rate limiting uses an in-memory Map. In Cloudflare Workers, each isolate has its own memory, meaning:
1. Rate limits reset when the isolate is recycled
2. Requests hitting different edge locations won't share rate limits
3. An attacker can bypass limits by triggering new isolate creation

```typescript
const requestLog = new Map<string, number[]>();  // In-memory, per-isolate
```

**Recommended Fix:**  
Use Cloudflare's built-in rate limiting (via `cf.rateLimit` or the Rate Limiting API) or store rate limit data in Durable Objects/KV for persistence across isolates.

---

### 7. Localhost Ports Hardcoded in CORS and Redirects ✅ FIXED
**Location:** `src/index.ts`, `src/handlers/callback.ts`  
**Severity:** Medium  
**Category:** Configuration Security  
**Status:** ✅ Remediated - Localhost origins now only allowed when `ENVIRONMENT === 'development'`

**Description:**  
Localhost ports `3000`, `5173`, `8787` are hardcoded and allowed even in production. This could allow malicious applications running on these ports to perform OAuth flows.

```typescript
const ALLOWED_LOCALHOST_PORTS = ['3000', '5173', '8787'];
// This is checked in production too!
```

**Recommended Fix:**  
Only allow localhost in development environment:

```typescript
app.use('*', cors({
  origin: (origin, c) => {
    if (!origin) return '';
    if (origin === c.env.FRONTEND_URL) return origin;
    
    // Only allow localhost in development
    if (c.env.ENVIRONMENT === 'development') {
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          if (url.port && ALLOWED_LOCALHOST_PORTS.includes(url.port)) {
            return origin;
          }
        }
      } catch { /* invalid URL */ }
    }
    
    return '';
  },
  // ...
}));
```

---

## 🔵 Low Severity Issues

### 8. State Parameter Not Signed/Encrypted ✅ FIXED
**Location:** `src/utils/state-signing.ts`  
**Severity:** Low  
**Category:** Data Integrity  
**Status:** ✅ Remediated - State is now HMAC-SHA256 signed using `signState()`/`verifyState()` utilities. Supports transition period for backward compatibility.

**Description:**  
The state parameter is base64-encoded JSON but not signed or encrypted. While the CSRF token provides protection, an attacker could theoretically craft custom state parameters.

```typescript
const encodedState = btoa(JSON.stringify(stateData));
```

**Recommendation:**  
Consider HMAC-signing the state parameter using JWT_SECRET.

---

### 9. XIVAuth User Validation Less Strict ✅ FIXED
**Location:** `src/handlers/xivauth.ts`  
**Severity:** Low  
**Category:** Input Validation  
**Status:** ✅ Remediated - Added explicit validation that `xivauthUser.id` exists before use

**Description:**  
Discord callback validates that `discordUser.id` and `discordUser.username` exist. XIVAuth callback only checks `xivauthUser.id` implicitly through usage.

**Recommended Fix:**
```typescript
if (!xivauthUser.id) {
  console.error('XIVAuth user response missing required fields', { hasId: !!xivauthUser.id });
  return c.json<AuthResponse>({
    success: false,
    error: 'Invalid user data received',
  }, 401);
}
```

---

### 10. Token Refresh Grace Period May Be Too Long
**Location:** `src/handlers/refresh.ts`  
**Severity:** Low  
**Category:** Session Management  
**Status:** ⚠️ Accepted Risk - 24-hour grace period retained for better UX; signature verification still required

**Description:**  
Tokens can be refreshed up to 24 hours after expiration. This is a generous grace period that extends the effective session lifetime significantly.

```typescript
const gracePeriod = 24 * 60 * 60; // 24 hours
```

**Recommendation:**  
Consider reducing to 1-4 hours depending on security requirements.

---

## ⚪ Informational

### 11. Production Logging of XIVAuth Token Details
**Location:** `src/handlers/xivauth.ts`  
**Severity:** Informational  

Token exchange success is logged with metadata. Ensure logs are properly secured.

---

### 12. XIVAUTH_CLIENT_SECRET Is Optional
**Location:** `src/types.ts`  
**Severity:** Informational  

XIVAuth client secret is marked optional to support "public client" mode with PKCE-only authentication. This is valid but should be documented clearly.

---

### 13. Code Challenge Validation Could Be Stricter
**Location:** `src/handlers/auth.ts`  
**Severity:** Informational  

For S256 method, the output is always exactly 43 characters (256-bit hash in base64url). Current regex allows 43-128.

---

## ✅ Security Strengths

1. **PKCE Implementation** - Properly implements RFC 7636 with S256 method
2. **State Expiration** - Discord flow includes 10-minute state expiration
3. **Redirect URI Allowlist** - Validates against known-good origins (Discord flow)
4. **Token Revocation** - KV-based blacklist with TTL auto-cleanup
5. **JWT Security** - Uses HMAC-SHA256, includes JTI for revocation
6. **Security Headers** - HSTS, X-Frame-Options, X-Content-Type-Options
7. **Production Error Sanitization** - Errors are sanitized before logging/returning
8. **JWT Secret Validation** - Minimum 32-character requirement enforced
9. **Request ID Tracing** - Correlation IDs for distributed tracing
10. **Separate GET/POST Callbacks** - PKCE verifier never travels through redirects

---

## 📋 Remediation Status

| Priority | Issue | Status | Remediation |
|----------|-------|--------|-------------|
| 1 | XIVAuth state expiration check | ✅ Fixed | `validateStateExpiration()` utility |
| 2 | XIVAuth redirect URI validation | ✅ Fixed | `validateRedirectUri()` utility |
| 3 | XIVAuth code_verifier format validation | ✅ Fixed | `validateCodeVerifier()` utility |
| 4 | XIVAuth request timeouts | ✅ Fixed | `AbortSignal.timeout()` on all fetches |
| 5 | XIVAuth scope validation | ✅ Fixed | `validateScopes()` utility |
| 6 | Localhost CORS in production | ✅ Fixed | Environment check in CORS config |
| 7 | Persistent rate limiting | ✅ Fixed | Durable Objects implementation |
| 8 | Sign state parameter | ✅ Fixed | HMAC-SHA256 signing |
| 9 | XIVAuth user validation | ✅ Fixed | Added `xivauthUser.id` check |
| 10 | Token refresh grace period | ⚠️ Accepted | Retained for UX; requires signature |

---

## Summary

The OAuth worker is **well-designed** with excellent security practices. All identified issues have been remediated:

- **High severity issues** (CSRF/replay, open redirect) were fixed by adding state expiration validation and redirect URI allowlist checks to the XIVAuth flow
- **Medium severity issues** were fixed by adding code verifier validation, request timeouts, scope validation, Durable Objects rate limiting, and environment-restricted CORS
- **Low severity issues** were fixed by implementing HMAC-SHA256 state signing and explicit user data validation
- **One low severity item** (24h token refresh grace period) was marked as accepted risk after review

The XIVAuth and Discord OAuth flows now have symmetric security validation, eliminating the previously identified asymmetric validation gaps.
