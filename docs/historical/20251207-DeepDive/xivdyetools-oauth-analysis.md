# xivdyetools-oauth Deep-Dive Analysis

**Date:** December 7, 2025
**Project:** xivdyetools-oauth (Cloudflare Worker)
**Version:** 1.1.0
**Analyst:** Claude Opus 4.5

---

## Executive Summary

The xivdyetools-oauth worker is a well-structured Cloudflare Worker handling Discord OAuth authentication and JWT issuance. The codebase is clean, uses modern patterns (Hono framework, Web Crypto API), and has comprehensive test coverage.

However, the security audit identified **one critical vulnerability** and several medium-severity issues that should be addressed before wider deployment. The most significant finding is that the PKCE implementation partially defeats its own security purpose by transmitting the code_verifier in the OAuth state.

### Quick Stats

| Metric | Value |
|--------|-------|
| Source Files | 6 (excluding tests) |
| Test Files | 6 |
| Lines of Code | ~750 (source), ~900 (tests) |
| Dependencies | 1 (hono) |
| Dev Dependencies | 8 |

### Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 1 | PKCE code_verifier exposure |
| **HIGH** | 1 | Token refresh without signature verification |
| **MEDIUM** | 3 | Token in URL, no revocation, CORS |
| **LOW** | 4 | Algorithm validation, logging, rate limiting |

---

## 1. Security Issues

### 1.1 CRITICAL: PKCE Code Verifier Exposed in State Parameter

**Location:** [authorize.ts:91](xivdyetools-oauth/src/handlers/authorize.ts#L91)

**Issue:** The PKCE `code_verifier` is stored in the OAuth state parameter and transmitted through Discord's redirect:

```typescript
const stateData = {
  csrf: state || crypto.randomUUID(),
  code_challenge,      // OK to transmit
  code_verifier,       // CRITICAL: Should NOT be transmitted!
  redirect_uri: finalRedirectUri,
  return_path: return_path || '/',
};

const encodedState = btoa(JSON.stringify(stateData));
```

**Why This Is Critical:**
PKCE (Proof Key for Code Exchange) is designed to prevent authorization code interception attacks. The security model requires:
1. Client generates `code_verifier` (secret) and `code_challenge` (hash of secret)
2. Only `code_challenge` is sent to the authorization server
3. `code_verifier` is stored **locally** on the client
4. During token exchange, client proves it initiated the request by presenting the original `code_verifier`

By transmitting the `code_verifier` in the state parameter (which travels through URL query strings), this implementation:
- Exposes the secret in browser history
- Exposes the secret in server access logs (Discord's and yours)
- Exposes the secret to any man-in-the-middle observers
- Allows an attacker who intercepts the callback URL to complete the OAuth flow

**Impact:** An attacker observing network traffic or with access to logs can complete OAuth flows for other users, effectively defeating PKCE entirely.

**Recommended Fix:**
1. The frontend should store `code_verifier` in sessionStorage or memory
2. Remove `code_verifier` from the state parameter
3. Use the POST `/auth/callback` endpoint where frontend sends `code_verifier` directly
4. OR implement a short-lived KV-backed state store keyed by CSRF token

---

### 1.2 HIGH: Token Refresh Accepts Forged Payloads

**Location:** [refresh.ts:51-81](xivdyetools-oauth/src/handlers/refresh.ts#L51-L81)

**Issue:** When a token is expired, the refresh endpoint falls back to `decodeJWT()` which **does not verify the signature**:

```typescript
try {
  payload = await verifyJWT(token, c.env.JWT_SECRET);
} catch (err) {
  // If expired, decode without verification and check grace period
  const decoded = decodeJWT(token);  // <-- No signature verification!

  if (!decoded) {
    return c.json<RefreshResponse>({ success: false, error: 'Invalid token format' }, 401);
  }

  // ... grace period check ...

  // Comment says "Verify signature manually" but DOESN'T!
  payload = decoded;  // <-- Uses unverified payload
}
```

**Why This Is High Severity:**
An attacker can craft a JWT with:
1. A valid-looking structure (three base64 parts)
2. A payload containing any Discord user ID they choose
3. An expiration time within the 24-hour grace period
4. Any random signature

The refresh endpoint will accept this and issue a **valid** JWT for the forged user ID.

**Impact:** User impersonation within the 24-hour grace period window.

**Recommended Fix:**
Add signature verification for expired tokens before accepting the refresh:

```typescript
// Verify signature even for expired tokens
async function verifyJWTSignature(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const isValid = await verify(signatureInput, signature, secret);

  if (!isValid) return null;

  return JSON.parse(base64UrlDecode(encodedPayload));
}
```

---

### 1.3 MEDIUM: JWT Token Transmitted in URL Query Parameters

**Location:** [callback.ts:110-112](xivdyetools-oauth/src/handlers/callback.ts#L110-L112)

**Issue:** The JWT is passed to the frontend via URL query string:

```typescript
const redirectUrl = new URL(stateData.redirect_uri);
redirectUrl.searchParams.set('token', token);
redirectUrl.searchParams.set('expires_at', expires_at.toString());
```

**Risks:**
- Token appears in browser history
- Token logged in server access logs
- Token leaked via Referrer header if user navigates away
- Token visible in shared screenshots/screen recordings

**Recommended Fix:**
Option A: Use URL fragment (not sent to server):
```typescript
redirectUrl.hash = `token=${token}&expires_at=${expires_at}`;
```

Option B: POST back to frontend with token in body (requires frontend handler).

---

### 1.4 MEDIUM: Stateless Token Revocation Is a No-Op

**Location:** [refresh.ts:173-181](xivdyetools-oauth/src/handlers/refresh.ts#L173-L181)

**Issue:** The `/auth/revoke` endpoint does nothing server-side:

```typescript
tokenRouter.post('/revoke', async (c) => {
  // For stateless JWTs, we can't truly revoke
  return c.json({
    success: true,
    message: 'Token revoked. Please clear client-side storage.',
  });
});
```

**Impact:** Compromised tokens remain valid until natural expiration (1 hour + 24h grace period = up to 25 hours).

**Recommended Fix:**
Implement a KV-backed token blacklist:
```typescript
// Store token JTI (JWT ID) in KV with TTL matching token expiry
await env.TOKEN_BLACKLIST.put(
  payload.jti,
  'revoked',
  { expirationTtl: payload.exp - Math.floor(Date.now() / 1000) + 1 }
);
```

Also requires adding `jti` claim to JWTs and checking blacklist during verification.

---

### 1.5 MEDIUM: CORS Too Permissive for Production

**Location:** [index.ts:36-38](xivdyetools-oauth/src/index.ts#L36-L38)

**Issue:** Any localhost origin is accepted:

```typescript
if (origin?.startsWith('http://localhost:')) {
  return origin;
}
```

**Impact:** Any local process (malicious extensions, local malware) can make authenticated requests if the user has a valid token.

**Recommended Fix:**
Restrict localhost CORS to development environment only:
```typescript
if (c.env.ENVIRONMENT === 'development' && origin?.startsWith('http://localhost:')) {
  return origin;
}
```

---

### 1.6 LOW: JWT Algorithm Not Validated

**Location:** [jwt-service.ts:147-155](xivdyetools-oauth/src/services/jwt-service.ts#L147-L155)

**Issue:** The JWT header's `alg` field is not verified:

```typescript
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const [encodedHeader, encodedPayload, signature] = parts;
  // Header is never decoded and checked!
}
```

**Risk:** Algorithm confusion attacks (e.g., `alg: "none"` bypass).

**Recommended Fix:**
```typescript
const header = JSON.parse(base64UrlDecode(encodedHeader));
if (header.alg !== 'HS256' || header.typ !== 'JWT') {
  throw new Error('Invalid JWT header');
}
```

---

### 1.7 LOW: No Rate Limiting on Auth Endpoints

**Issue:** No rate limiting on any endpoints.

**Risks:**
- Brute force attacks on token refresh
- DoS via excessive requests
- Discord API abuse through repeated auth attempts

**Recommended Fix:**
Implement per-IP rate limiting using KV:
```typescript
const rateLimiter = new RateLimiter(env.RATE_LIMIT_KV, {
  windowMs: 60000,
  maxRequests: 10,
});
```

---

### 1.8 LOW: Potential Information Leakage in Logs

**Location:** [callback.ts:78-79, 96-97](xivdyetools-oauth/src/handlers/callback.ts#L78-L97)

**Issue:** Discord API error responses are logged:

```typescript
const errorText = await tokenResponse.text();
console.error('Token exchange failed:', errorText);
```

**Risk:** If logs are accessible, sensitive error details from Discord may be exposed.

**Recommended Fix:**
Sanitize logged content or only log in development:
```typescript
if (env.ENVIRONMENT === 'development') {
  console.error('Token exchange failed:', errorText);
}
```

---

## 2. Optimization Opportunities

### 2.1 Duplicate JWT Signing Code

**Location:** [refresh.ts:187-224](xivdyetools-oauth/src/handlers/refresh.ts#L187-L224)

**Issue:** The `createJWTFromPayload` function duplicates `base64UrlEncode` and `sign` functions from jwt-service.ts.

**Impact:** Increased bundle size, maintenance burden, potential for implementations to drift.

**Fix:** Export a flexible `createJWTFromPayload` from jwt-service.ts that accepts either a `DiscordUser` or `JWTPayload`.

---

### 2.2 CryptoKey Import on Every Operation

**Location:** [jwt-service.ts:57-68](xivdyetools-oauth/src/services/jwt-service.ts#L57-L68)

**Issue:** The JWT secret is imported as a CryptoKey on every sign/verify call:

```typescript
async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(/* ... */);
}
```

**Impact:** Minor performance overhead (~0.1-0.5ms per operation).

**Fix:** Cache the CryptoKey at module level or use a WeakMap keyed by secret string for multi-secret scenarios.

---

### 2.3 Redundant URL Parsing

**Location:** [authorize.ts:72-75](xivdyetools-oauth/src/handlers/authorize.ts#L72-L75)

**Issue:** URL is parsed multiple times in the allowed redirect check:

```typescript
const redirectOrigin = new URL(finalRedirectUri).origin;
const isAllowed = allowedRedirects.some(
  (allowed) => new URL(allowed).origin === redirectOrigin
);
```

**Impact:** Multiple URL constructor calls (~0.1ms each).

**Fix:** Pre-compute allowed origins as a Set at startup or cache them.

---

## 3. Refactoring Recommendations

### 3.1 Extract and Export State Type

**Issue:** The OAuth state structure is defined inline in multiple places:
- [authorize.ts:88-95](xivdyetools-oauth/src/handlers/authorize.ts#L88-L95)
- [callback.ts:44-50](xivdyetools-oauth/src/handlers/callback.ts#L44-L50)

**Recommendation:** Add to types.ts:
```typescript
export interface OAuthStateData {
  csrf: string;
  code_challenge: string;
  code_verifier: string;  // Remove when fixing PKCE issue
  redirect_uri: string;
  return_path: string;
}
```

---

### 3.2 Standardize Error Response Format

**Issue:** Inconsistent error response formats:
- Health endpoints: `{ error: string, message: string }`
- Auth endpoints: `{ success: false, error: string }`

**Recommendation:** Standardize all endpoints to use:
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;  // Machine-readable error code
}
```

---

### 3.3 Add Environment Validation

**Issue:** No validation that required secrets are configured.

**Recommendation:** Add startup validation:
```typescript
function validateEnv(env: Env): void {
  const required = ['DISCORD_CLIENT_SECRET', 'JWT_SECRET'];
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required secret: ${key}`);
    }
  }
  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}
```

---

### 3.4 Consolidate JWT Creation Functions

**Issue:** Two separate functions for creating JWTs:
- `createJWT(user: DiscordUser, env: Env)` in jwt-service.ts
- `createJWTFromPayload(payload: JWTPayload, env: Env)` in refresh.ts

**Recommendation:** Refactor jwt-service.ts to expose:
```typescript
export async function signJWT(payload: JWTPayload, secret: string): Promise<string>;
export async function createJWT(user: DiscordUser, env: Env): Promise<JWTResult>;
export async function refreshJWT(payload: JWTPayload, env: Env): Promise<JWTResult>;
```

---

## 4. Test Coverage Analysis

### 4.1 Strong Coverage Areas

- JWT creation and verification: **Excellent**
- Handler happy paths: **Excellent**
- Error handling: **Good**
- Edge cases (null avatar, expired tokens): **Good**
- CORS middleware: **Good**

### 4.2 Coverage Gaps

| Area | Gap | Recommendation |
|------|-----|----------------|
| Signature verification for expired tokens | Not tested | Add test for forged expired tokens |
| Malicious state tampering | Not tested | Add test for manipulated base64 state |
| PKCE flow validation | Minimal | Add end-to-end PKCE verification tests |
| Rate limiting | No rate limiting exists | Add after implementing |
| Algorithm confusion | Not tested | Add test for `alg: "none"` attack |
| Grace period boundary | Tested | - |

### 4.3 Test Infrastructure

The test setup uses a clean mock pattern with Vitest and fake timers. The `cloudflare-test.ts` mock provides a good SELF helper for integration-style tests.

**Improvement Suggestion:** Consider adding property-based testing for JWT parsing edge cases using a library like `fast-check`.

---

## 5. Architecture Notes

### 5.1 Strengths

1. **Clean separation of concerns:** Handlers, services, and types are well-organized
2. **Modern framework:** Hono provides excellent DX and performance
3. **Web Crypto API:** Proper use of platform crypto for HMAC-SHA256
4. **TypeScript strictness:** Enabled, catching type errors at compile time
5. **Minimal dependencies:** Only Hono as runtime dependency

### 5.2 Architectural Concerns

1. **No KV bindings:** Would benefit from KV for token blacklist and rate limiting
2. **No logging service:** console.log/error only; consider structured logging
3. **No monitoring hooks:** No integration points for observability (though Cloudflare provides built-in)

---

## 6. Prioritized Action Items

### Immediate (Before Production)

| Priority | Issue | Effort | File |
|----------|-------|--------|------|
| P0 | Fix PKCE code_verifier exposure | Medium | authorize.ts, callback.ts |
| P0 | Add signature verification for expired token refresh | Low | refresh.ts, jwt-service.ts |
| P1 | Move JWT to URL fragment instead of query param | Low | callback.ts |

### Short-Term (Next Sprint)

| Priority | Issue | Effort | File |
|----------|-------|--------|------|
| P2 | Add JWT algorithm validation | Low | jwt-service.ts |
| P2 | Restrict localhost CORS to development | Low | index.ts |
| P2 | Consolidate JWT creation functions | Medium | jwt-service.ts, refresh.ts |

### Medium-Term (Technical Debt)

| Priority | Issue | Effort | File |
|----------|-------|--------|------|
| P3 | Implement token blacklist with KV | Medium | New: token-blacklist.ts |
| P3 | Add rate limiting | Medium | New: rate-limiter.ts |
| P3 | Add environment validation | Low | index.ts |
| P3 | Standardize error response format | Low | All handlers |
| P3 | Cache CryptoKey for performance | Low | jwt-service.ts |

---

## Appendix A: File-by-File Summary

| File | LOC | Purpose | Issues Found |
|------|-----|---------|--------------|
| index.ts | 108 | Hono app, middleware, routing | CORS too permissive |
| types.ts | 113 | TypeScript interfaces | Missing OAuthStateData type |
| authorize.ts | 112 | OAuth flow initiation | CRITICAL: code_verifier exposure |
| callback.ts | 241 | Token exchange, JWT issuance | Token in URL query params |
| refresh.ts | 224 | Token refresh, user info, revoke | HIGH: Missing signature verification |
| jwt-service.ts | 217 | JWT creation/verification | Algorithm not validated |

---

## Appendix B: Dependency Analysis

### Runtime Dependencies (1)

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| hono | ^4.6.0 | Web framework | Low - well-maintained, Cloudflare-native |

### Dev Dependencies (8)

All development dependencies are appropriate for the project and pose no security concerns.

---

*End of Analysis*
