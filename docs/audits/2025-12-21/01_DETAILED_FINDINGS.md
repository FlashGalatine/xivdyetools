# Security Audit: Detailed Findings

**Project:** xivdyetools-* Monorepo
**Date:** December 21, 2025
**Framework:** OWASP Top 10 (2021)

---

## OWASP Top 10 Assessment

This document maps all security findings to the OWASP Top 10 2021 categories for standardized risk assessment.

---

## A01:2021 - Broken Access Control

### Finding: PASS - Access Control Properly Implemented

**Status:** Excellent

All previous access control issues have been resolved:

#### Maintainer Service (SEC-001 - Resolved)

**File:** `xivdyetools-maintainer/server/api.ts`

The maintainer service now implements:
- Production environment guard (exits if `NODE_ENV=production`)
- API key authentication via `MAINTAINER_API_KEY`
- Proper 401/503 error responses
- Logging of unauthorized attempts

#### OAuth Worker Access Control

**File:** `xivdyetools-oauth/src/handlers/callback.ts`

- PKCE verification prevents authorization code interception
- State parameter validated to prevent CSRF
- Redirect URL validation prevents open redirect
- Proper token lifecycle management

#### Presets API Authorization

**File:** `xivdyetools-presets-api/src/middleware/auth.ts`

- JWT validation with algorithm verification
- User ID extracted from token for row-level access
- Moderator role validation for admin endpoints
- Ban status enforcement

---

## A02:2021 - Cryptographic Failures

### Finding: PASS - Proper Cryptographic Implementation

**Status:** Excellent

No cryptographic issues identified:

#### JWT Implementation
- HMAC-SHA256 (HS256) with explicit algorithm check
- Prevents "alg: none" attacks
- Proper base64url encoding
- Expiration validation

#### PKCE Implementation
- Uses `crypto.getRandomValues()` for entropy
- SHA-256 for code challenge
- Proper verifier generation (64 bytes)

#### Timing-Safe Comparisons
- Constant-time secret validation
- Prevents timing side-channel attacks

---

## A03:2021 - Injection

### Finding: PASS - Injection Prevention

**Status:** Excellent

All injection vectors properly mitigated:

#### SQL Injection Prevention
**File:** `xivdyetools-presets-api/src/services/preset-service.ts`

All D1 database queries use parameterized statements:
```typescript
db.prepare('SELECT * FROM presets WHERE id = ?').bind(presetId).first()
```

LIKE pattern escaping implemented:
```typescript
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&');
}
```

#### Command Injection Prevention

No evidence of:
- `eval()` usage
- `Function()` constructor
- `child_process.exec()` with user input
- Dynamic code execution

---

## A04:2021 - Insecure Design

### Finding: PASS - Secure Architecture

**Status:** Excellent

The ecosystem demonstrates defense in depth:

1. **Request Verification** - Discord Ed25519 signatures
2. **Authentication** - JWT tokens with validation
3. **Authorization** - Role-based access control
4. **Rate Limiting** - Multi-tier limits
5. **Input Validation** - At all API boundaries

#### Principle of Least Privilege
- Service bindings for worker-to-worker communication
- Isolated KV namespaces by purpose
- D1 database access limited to presets-api

---

## A05:2021 - Security Misconfiguration

### Finding SEC-010: Vitest Version Split - INTENTIONAL

**Severity:** INFORMATIONAL (downgraded from MEDIUM)
**Status:** Accepted - By Design

#### Description

Two Cloudflare Worker projects use Vitest v3 while others use v4:

| Project | Version | Status |
|---------|---------|--------|
| xivdyetools-core | ^4.0.13 | Current |
| xivdyetools-web-app | ^4.0.15 | Current |
| xivdyetools-discord-worker | ^4.0.15 | Current |
| xivdyetools-oauth | ^3.2.4 | Required by @cloudflare/vitest-pool-workers |
| xivdyetools-presets-api | ^3.2.4 | Required by @cloudflare/vitest-pool-workers |
| xivdyetools-logger | ^4.0.15 | Current |
| xivdyetools-types | ^4.0.15 | Current |
| xivdyetools-test-utils | ^4.0.15 | Current |

#### Root Cause

Both `xivdyetools-oauth` and `xivdyetools-presets-api` use `@cloudflare/vitest-pool-workers@^0.10.14` for testing Cloudflare Workers. This package [currently only supports Vitest 2.0.x - 3.2.x](https://github.com/cloudflare/workers-sdk/issues/11064).

Vitest v4 support is actively being developed (PR #11632) but has not yet been released.

#### Impact
- None - this is intentional and required for Cloudflare Workers testing
- Projects without @cloudflare/vitest-pool-workers correctly use v4

#### Recommendation
- **No action required now**
- Monitor the [cloudflare/workers-sdk repository](https://github.com/cloudflare/workers-sdk/issues/11064) for v4 support release
- Upgrade to Vitest v4 once @cloudflare/vitest-pool-workers supports it

---

### Finding: PASS - Security Headers

**Status:** Excellent (SEC-008 Resolved)

The web app now has comprehensive HTTP security headers:

**File:** `xivdyetools-web-app/public/_headers`

```
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

### Finding SEC-007: Subresource Integrity - NOT APPLICABLE

**Severity:** N/A (Closed)
**Status:** Closed - Not Applicable

#### Description
Originally flagged for missing SRI hashes on external resources.

#### Investigation Results (December 21, 2025)

**SRI is not applicable for this project because:**

1. **No External JavaScript CDNs**
   - `script-src 'self'` in CSP blocks ALL external scripts
   - No jQuery, Bootstrap, or other CDN-hosted libraries
   - This is actually stronger protection than SRI

2. **Google Fonts Doesn't Support SRI**
   - Google Fonts CSS is dynamically generated per browser/device
   - URLs like `fonts.googleapis.com/css2?family=...` return different content
   - No stable hash can be generated

3. **Other External Resources Don't Need SRI**
   - `cdn.discordapp.com` - User avatars (images can't execute code)
   - `universalis.app` - API connections (not script loading)

#### Conclusion
SEC-007 is **closed as Not Applicable**. The CSP `script-src 'self'` policy provides complete protection against malicious external scripts - better than SRI would.

---

## A06:2021 - Vulnerable and Outdated Components

### Finding: PASS - No Known Vulnerabilities

**Status:** Excellent

**npm audit results (December 21, 2025):**

All 10 projects report: `found 0 vulnerabilities`

#### Dependency Analysis

| Category | Status |
|----------|--------|
| Critical CVEs | None |
| High CVEs | None |
| Moderate CVEs | None |
| Low CVEs | None |

#### Version Currency

| Dependency | Ecosystem Version | Status |
|------------|-------------------|--------|
| TypeScript | ^5.9.3 | Current (all projects) |
| Vite | ^6.0.5 - ^7.2.7 | Current |
| Hono | ^4.6.0 - ^4.10.7 | Current |
| Wrangler | ^4.53.0 | Current |

---

## A07:2021 - Identification and Authentication Failures

### Finding: PASS - Strong Authentication

**Status:** Excellent

#### OAuth 2.0 + PKCE
- Prevents authorization code interception
- State parameter prevents CSRF
- Secure token exchange

#### JWT Tokens
- Algorithm explicitly verified
- Proper expiration handling
- Revocation support via KV blacklist

#### Discord Verification
- Ed25519 signature verification
- Timestamp anti-replay
- Constant-time comparison

#### Bot Authentication
- HMAC request signing
- 2-minute time window
- User context headers

---

## A08:2021 - Software and Data Integrity Failures

### Finding: PASS - Proper Data Integrity

**Status:** Excellent

#### Request Signing
- HMAC-SHA256 signatures for bot requests
- Timestamp validation prevents replay
- Timing-safe verification

#### Package Integrity
- `package-lock.json` in all projects
- Exact version locking
- No evidence of compromised dependencies

---

## A09:2021 - Security Logging and Monitoring

### Finding: PASS - Centralized Logging (SEC-009 Resolved)

**Status:** Excellent

#### @xivdyetools/logger Features
- Environment-aware logging
- Structured JSON format
- Request ID correlation
- Error tracking in production

#### Secret Rotation Documentation
- Comprehensive procedures created
- Quarterly rotation schedule
- Emergency response procedures

---

## A10:2021 - Server-Side Request Forgery (SSRF)

### Finding: PASS - Limited SSRF Surface

**Status:** Excellent

#### Analysis
The ecosystem has limited SSRF exposure:

1. **Web App** - Client-side only, no server-side requests
2. **Discord Worker** - Only calls Discord API and internal services
3. **OAuth Worker** - Only calls OAuth endpoints
4. **Presets API** - No external URL fetching
5. **Universalis Proxy** - Controlled proxy to known API

#### Image Validation
**File:** `xivdyetools-discord-worker/src/services/image/validators.ts`

Comprehensive SSRF protection:
- Only Discord CDN URLs allowed
- HTTPS-only enforcement
- Private IP blocking
- Cloud metadata endpoint blocking
- Redirect validation

---

## Summary Table

| OWASP Category | Status | Findings |
|----------------|--------|----------|
| A01: Broken Access Control | PASS | SEC-001 Resolved |
| A02: Cryptographic Failures | PASS | Proper implementation |
| A03: Injection | PASS | Parameterized queries |
| A04: Insecure Design | PASS | Defense in depth |
| A05: Security Misconfiguration | PASS | SEC-010 (intentional), SEC-007 (closed - N/A) |
| A06: Vulnerable Components | PASS | 0 npm vulnerabilities |
| A07: Auth Failures | PASS | Strong OAuth/JWT |
| A08: Data Integrity Failures | PASS | HMAC signatures |
| A09: Logging Failures | PASS | SEC-009 Resolved |
| A10: SSRF | PASS | Limited surface, validation |

---

**Document Owner:** XIV Dye Tools Team
**Classification:** Internal Use
