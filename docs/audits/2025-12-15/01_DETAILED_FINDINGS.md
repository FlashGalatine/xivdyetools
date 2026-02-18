# Security Audit: Detailed Findings

**Project:** xivdyetools-* Monorepo
**Date:** December 15, 2025
**Framework:** OWASP Top 10 (2021)

---

## OWASP Top 10 Assessment

This document maps all security findings to the OWASP Top 10 2021 categories for standardized risk assessment.

---

## A01:2021 - Broken Access Control

### Finding SEC-001: Maintainer Service Lacks Authentication

**Severity:** HIGH
**Status:** Open
**CVSS Score:** 7.5 (High)

#### Description
The xivdyetools-maintainer service provides an Express.js API for managing core data files. This API exposes POST endpoints that write directly to the filesystem without any authentication or authorization checks.

#### Affected Endpoints
- `POST /api/colors` - Writes to `colors_xiv.json`
- `POST /api/locale/:code` - Writes to locale JSON files

#### Evidence

**File:** `xivdyetools-maintainer/server/api.ts`

```typescript
// Lines 54-63: POST /api/colors - No authentication
app.post('/api/colors', async (req, res) => {
  try {
    await writeJsonFile(COLORS_PATH, req.body)  // Direct write, no auth check
    res.json({ success: true })
  } catch (error) {
    console.error('Error writing colors file:', error)
    res.status(500).json({ success: false, error: 'Failed to write colors file' })
  }
})

// Lines 84-101: POST /api/locale/:code - Only locale code validation, no auth
app.post('/api/locale/:code', async (req, res) => {
  const { code } = req.params
  const validCodes = ['en', 'ja', 'de', 'fr', 'ko', 'zh']

  if (!validCodes.includes(code)) {
    return res.status(400).json({ success: false, error: 'Invalid locale code' })
  }

  try {
    const filePath = path.join(LOCALES_PATH, `${code}.json`)
    await writeJsonFile(filePath, req.body)  // Direct write after code validation
    res.json({ success: true })
  } catch (error) {
    // ...
  }
})
```

#### Mitigating Factors
- Tool is designed for local development only
- Runs on `localhost:3001` by default
- Not deployed to production environments
- CORS is enabled but localhost:3001 limits exposure

#### Attack Scenario
1. Attacker discovers maintainer service exposed (misconfiguration, port forwarding)
2. Attacker sends crafted POST request to `/api/colors`
3. Core color definitions are overwritten with malicious data
4. All applications using @xivdyetools/core receive corrupted data

#### Recommendation
```typescript
// Add environment check
if (process.env.NODE_ENV === 'production') {
  console.error('Maintainer service should not run in production!');
  process.exit(1);
}

// Add basic API key authentication
const API_KEY = process.env.MAINTAINER_API_KEY;

app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && req.method !== 'GET') {
    const providedKey = req.headers['x-api-key'];
    if (!API_KEY || providedKey !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
});
```

---

### Finding: Positive - OAuth Worker Access Control

**Status:** PASS

The OAuth worker properly implements access control:

**File:** `xivdyetools-oauth/src/handlers/callback.ts`
- PKCE verification prevents authorization code interception
- State parameter validated to prevent CSRF
- Redirect URL sanitization prevents open redirect

**File:** `xivdyetools-presets-api/src/middleware/auth.ts`
- JWT validation with algorithm verification
- User ID extracted from token for row-level access control
- Moderator role validation for admin endpoints

---

## A02:2021 - Cryptographic Failures

### Finding: Positive - Proper Cryptographic Implementation

**Status:** PASS

The ecosystem demonstrates proper cryptographic practices:

#### JWT Implementation
**File:** `xivdyetools-oauth/src/services/jwt-service.ts`

- Uses HMAC-SHA256 (HS256) algorithm
- Algorithm explicitly checked (prevents "alg: none" attacks)
- Proper base64url encoding/decoding
- Expiration validation

#### PKCE Implementation
**File:** `xivdyetools-web-app/src/services/auth-service.ts`

```typescript
// Proper entropy source
const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(64)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

// SHA-256 for code challenge
const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
```

#### Timing-Safe Comparison
**File:** `xivdyetools-discord-worker/src/utils/verify.ts`

```typescript
// Constant-time comparison prevents timing attacks
let diff = aBytes.length ^ bBytes.length;
for (let i = 0; i < maxLength; i++) {
  diff |= aPadded[i] ^ bPadded[i];
}
return diff === 0;
```

#### No Issues Found
- Secrets not hardcoded in source
- Proper key lengths used
- Modern algorithms (SHA-256, HMAC-SHA256, Ed25519)

---

## A03:2021 - Injection

### Finding: Positive - SQL Injection Prevention

**Status:** PASS

All D1 database queries use parameterized statements:

**File:** `xivdyetools-presets-api/src/services/preset-service.ts`

```typescript
// Line 85-87: Parameterized query with .bind()
const result = await db.prepare(query).bind(...params, limit, offset).all<PresetRow>();

// Line 21-22: LIKE pattern escaping
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&');
}
```

#### Query Patterns Verified
- All `SELECT` queries use `.prepare().bind()`
- All `INSERT` queries use parameterized values
- All `UPDATE` queries use bound parameters
- LIKE patterns escaped to prevent wildcards injection

### Finding: Positive - Command Injection Prevention

**Status:** PASS

No evidence of:
- `eval()` usage
- `Function()` constructor
- `child_process.exec()` with user input
- Shell command construction

---

## A04:2021 - Insecure Design

### Finding: Positive - Secure Architecture

**Status:** PASS

The ecosystem demonstrates secure design principles:

#### Defense in Depth
1. **Request Verification** - Discord Ed25519 signatures
2. **Authentication** - JWT tokens with validation
3. **Authorization** - Role-based access (user/moderator)
4. **Rate Limiting** - Multi-tier limits
5. **Input Validation** - At all API boundaries

#### Principle of Least Privilege
- Service bindings used for worker-to-worker communication
- KV namespaces isolated by purpose (rate limits, sessions, analytics)
- D1 database access limited to presets-api worker

#### Secure Defaults
- CORS restricted to specific origins
- Security headers enabled by default
- Rate limiting on all public endpoints

---

## A05:2021 - Security Misconfiguration

### Finding SEC-003: Vitest Version Inconsistencies

**Severity:** MEDIUM
**Status:** Open

#### Description
Different projects use different major versions of Vitest, leading to:
- Inconsistent test behavior across projects
- Potential compatibility issues with shared test utilities
- Harder maintenance and debugging

#### Evidence

| Project | Vitest Version |
|---------|---------------|
| xivdyetools-core | ^4.0.13 |
| xivdyetools-web-app | ^4.0.15 |
| xivdyetools-discord-worker | ^4.0.15 |
| xivdyetools-oauth | ^2.1.9 |
| xivdyetools-presets-api | ^3.2.4 |
| xivdyetools-logger | ^2.1.8 |
| xivdyetools-test-utils | ^2.0.0 |
| xivdyetools-types | ^4.0.15 |

#### Impact
- @xivdyetools/test-utils requires `vitest >=2.0.0` as peer dependency
- Projects on v2 won't benefit from v4 security/performance improvements
- Test snapshots may behave differently across versions

#### Recommendation
Standardize all projects to Vitest v4.x:
```bash
npm install vitest@^4.0.15 @vitest/coverage-v8@^4.0.15 --save-dev
```

---

### Finding SEC-004: TypeScript Version Inconsistencies

**Severity:** MEDIUM
**Status:** Open

#### Evidence

| Project | TypeScript Version |
|---------|-------------------|
| xivdyetools-core | ^5.3.2 |
| xivdyetools-web-app | ^5.9.3 |
| xivdyetools-discord-worker | ^5.9.3 |
| xivdyetools-oauth | ^5.7.2 |
| xivdyetools-presets-api | ^5.9.3 |
| xivdyetools-logger | ^5.3.2 |
| xivdyetools-test-utils | ^5.3.2 |
| xivdyetools-types | ^5.3.2 |

#### Impact
- Type inference differences between versions
- Some newer TypeScript features unavailable in older projects
- Potential type errors when compiling shared packages

#### Recommendation
Standardize to TypeScript ^5.9.3 across all projects.

---

### Finding SEC-007: Missing Subresource Integrity (SRI)

**Severity:** LOW
**Status:** Open

#### Description
External resources (if any CDN dependencies exist) should use SRI hashes to ensure integrity.

#### Recommendation
For any external scripts/stylesheets:
```html
<script src="https://example.com/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

---

### Finding SEC-008: CSP in Meta Tags vs HTTP Headers

**Severity:** LOW
**Status:** Open

#### Description
Content Security Policy is implemented via `<meta>` tags in the web app. HTTP headers provide stronger protection as they:
- Cannot be bypassed by early script execution
- Support all CSP directives (meta tags have limitations)
- Are enforced before HTML parsing begins

#### Current Implementation
Cloudflare Pages can add headers via `_headers` file.

#### Recommendation
Move CSP to HTTP headers:
```
# _headers file
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
```

---

## A06:2021 - Vulnerable and Outdated Components

### Finding SEC-002: Selenium in Production Dependencies

**Severity:** HIGH
**Status:** Open

#### Description
The web-app project includes `selenium@^2.20.0` as a **production** dependency. This is incorrect for multiple reasons:

1. **Outdated**: Package last updated in 2020 (5+ years old)
2. **Wrong Location**: Testing framework should be in devDependencies
3. **Unnecessary**: Playwright is already used for E2E testing
4. **Security Risk**: Unmaintained packages may have unpatched vulnerabilities

#### Evidence

**File:** `xivdyetools-web-app/package.json`
```json
{
  "dependencies": {
    "@tailwindcss/postcss": "^4.1.17",
    "@xivdyetools/core": "^1.3.7",
    "@xivdyetools/logger": "^1.0.0",
    "@xivdyetools/types": "^1.0.0",
    "selenium": "^2.20.0"  // <-- SHOULD NOT BE HERE
  }
}
```

#### Impact
- Increases production bundle size
- Potential security vulnerabilities
- Supply chain risk from abandoned package

#### Recommendation
```bash
# Remove selenium entirely
npm uninstall selenium

# Or if needed for some reason, move to devDependencies
npm uninstall selenium && npm install selenium --save-dev
```

---

### Finding SEC-005: Core Package Version Mismatch

**Severity:** MEDIUM
**Status:** Open

#### Description
@xivdyetools/core is at version 1.4.0, but consuming projects depend on ^1.3.7.

#### Evidence

| Project | Core Dependency | Available |
|---------|-----------------|-----------|
| xivdyetools-web-app | ^1.3.7 | 1.4.0 |
| xivdyetools-discord-worker | ^1.3.7 | 1.4.0 |
| xivdyetools-maintainer | file:../xivdyetools-core | Latest |

#### Impact
- Web-app and discord-worker miss features/fixes in 1.4.0
- Potential inconsistencies between projects

#### Recommendation
```bash
npm install @xivdyetools/core@^1.4.0
```

---

### Finding: Positive - No Known CVEs in Dependencies

**Status:** PASS

Based on current `package-lock.json` files:
- No critical vulnerabilities from `npm audit`
- Previous vulnerabilities (glob, vite, vitest) have been patched
- Dependencies are reasonably up-to-date

---

## A07:2021 - Identification and Authentication Failures

### Finding: Positive - Strong Authentication Implementation

**Status:** PASS

See [03_AUTHENTICATION_REVIEW.md](./03_AUTHENTICATION_REVIEW.md) for detailed analysis.

Summary:
- OAuth 2.0 with PKCE prevents authorization code interception
- JWT tokens properly validated
- Ed25519 signatures for Discord interactions
- HMAC request signing for bot authentication
- Token revocation mechanism via KV blacklist

---

## A08:2021 - Software and Data Integrity Failures

### Finding: Positive - Proper Data Integrity

**Status:** PASS

#### Request Signing
**File:** `xivdyetools-presets-api/src/middleware/auth.ts`

Bot requests include HMAC signatures:
```typescript
// Signature: HMAC-SHA256(timestamp:userId:userName)
// Verified with timing-safe comparison
// Timestamp checked within 2-minute window (anti-replay)
```

#### Package Integrity
- `package-lock.json` files present in all projects
- Exact versions locked for reproducible builds
- No evidence of compromised dependencies

---

## A09:2021 - Security Logging and Monitoring Failures

### Finding: Positive - Centralized Logging

**Status:** PASS

The ecosystem uses @xivdyetools/logger for consistent logging:

**Features:**
- Environment-aware (dev/production modes)
- Structured logging with request IDs
- Error tracking in production
- Debug filtering in production

**File:** `xivdyetools-logger/src/presets/worker.ts`
```typescript
// Request ID middleware for correlation
// Log levels: debug, info, warn, error
// Production filters non-error logs
```

#### Logging Coverage
- Authentication events: logged
- Rate limit violations: logged
- API errors: logged
- Moderation actions: logged with audit trail

---

### Finding SEC-009: No Automated Secret Rotation

**Severity:** LOW
**Status:** Open

#### Description
No documented procedure for rotating secrets like:
- JWT_SECRET
- DISCORD_TOKEN
- BOT_API_SECRET

#### Recommendation
Document and automate secret rotation:
1. Create SECRETS_ROTATION.md with procedures
2. Set calendar reminders for quarterly rotation
3. Consider using Cloudflare Workers Secrets with versioning

---

## A10:2021 - Server-Side Request Forgery (SSRF)

### Finding: Positive - Limited SSRF Surface

**Status:** PASS

#### Analysis
The ecosystem has limited SSRF exposure:

1. **Web App** - Client-side only, no server-side requests
2. **Discord Worker** - Only calls Discord API and internal services
3. **OAuth Worker** - Only calls Discord/XIVAuth OAuth endpoints
4. **Presets API** - No external URL fetching

#### User-Controlled URLs
Only the image upload in Discord bot accepts user-provided URLs, but:
- URLs come from Discord CDN attachments (trusted source)
- No arbitrary URL fetching implemented
- Image processing limited to specific formats

---

## Summary Table

| OWASP Category | Status | Findings |
|----------------|--------|----------|
| A01: Broken Access Control | Partial | SEC-001 (maintainer auth) |
| A02: Cryptographic Failures | Pass | Proper implementation |
| A03: Injection | Pass | Parameterized queries |
| A04: Insecure Design | Pass | Defense in depth |
| A05: Security Misconfiguration | Partial | SEC-003, SEC-004, SEC-007, SEC-008 |
| A06: Vulnerable Components | Partial | SEC-002, SEC-005 |
| A07: Auth Failures | Pass | Strong OAuth/JWT |
| A08: Data Integrity Failures | Pass | HMAC signatures |
| A09: Logging Failures | Partial | SEC-009 |
| A10: SSRF | Pass | Limited surface |

---

**Document Owner:** XIV Dye Tools Team
**Classification:** Internal Use
