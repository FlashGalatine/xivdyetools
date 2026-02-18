# Security Assessment

**Version:** 4.0.0
**Date:** January 2026
**Overall Rating:** EXCELLENT

---

## Executive Summary

The xivdyetools-web-app demonstrates a strong security posture with:
- **Zero dependency vulnerabilities** (npm audit clean)
- **Strict Content Security Policy** (no unsafe-eval)
- **PKCE OAuth implementation** (industry standard)
- **XSS prevention patterns** (no user input in innerHTML)
- **Comprehensive input validation** (file uploads, presets)

**Security Status: PRODUCTION-READY**

---

## Dependency Security

### npm audit Results

```
found 0 vulnerabilities
```

### Runtime Dependencies (Minimal Attack Surface)

| Package | Version | Risk Level | Notes |
|---------|---------|------------|-------|
| lit | 3.1.0 | Low | Well-maintained, Google-backed |
| @xivdyetools/core | local | Internal | First-party package |
| @xivdyetools/logger | 1.0.2 | Internal | First-party package |
| @xivdyetools/types | local | Internal | Type definitions only |

### Dependency Management

- Regular updates via Dependabot/Renovate
- Lock file (`package-lock.json`) committed
- No deprecated packages in production dependencies

---

## XSS Prevention

### innerHTML Usage Audit

**Status:** SAFE

All innerHTML usage falls into safe categories:

| Pattern | Usage | Risk |
|---------|-------|------|
| Container clearing | `container.innerHTML = ''` | None |
| Static SVG icons | From `*-icons.ts` constants | None |
| Compile-time templates | Static HTML strings | None |

### Unsafe Patterns NOT Found

| Pattern | Found | Notes |
|---------|-------|-------|
| User input interpolation | NO | |
| Dynamic script injection | NO | |
| Unsanitized URL insertion | NO | |
| Template literal injection | NO | |

### User Content Handling

All user-provided content uses safe DOM methods:

```typescript
// Safe pattern used throughout
element.textContent = userProvidedString;

// Never this:
// element.innerHTML = userProvidedString; // NOT FOUND
```

---

## Authentication Security

### OAuth Implementation

File: `src/services/auth-service.ts`

| Feature | Implementation |
|---------|----------------|
| Flow Type | Authorization Code with PKCE |
| State Parameter | Cryptographic random, validated on callback |
| Code Verifier | 128-bit random, SHA-256 hashed |
| Token Storage | localStorage with expiry validation |
| Logout | Server-side revocation + local cleanup |

### PKCE Flow

```
1. User clicks "Login"
2. Generate random state (32 bytes)
3. Generate code_verifier (32 bytes)
4. Compute code_challenge = SHA-256(code_verifier)
5. Store verifier + state in sessionStorage
6. Redirect to OAuth provider with challenge
7. On callback: validate state, exchange code with verifier
8. Store JWT in localStorage
9. Clear sessionStorage
```

### Token Storage Rationale

| Data | Storage | Justification |
|------|---------|---------------|
| PKCE verifier | sessionStorage | Ephemeral, per-tab only |
| OAuth state | sessionStorage | Ephemeral, per-tab only |
| JWT token | localStorage | Persistence across tabs needed |

**Mitigation for localStorage:**
- Strict CSP prevents XSS exfiltration
- Token expiry validated on every `isAuthenticated()` call
- Server-side revocation on logout

### Open Redirect Prevention

File: `src/services/auth-service.ts`

```typescript
function sanitizeReturnPath(path: string | null): string {
  if (!path) return '/';
  if (!path.startsWith('/')) return '/';      // Must be relative
  if (path.startsWith('//')) return '/';       // Protocol-relative blocked
  if (path.includes('://')) return '/';        // Absolute URL blocked
  if (path.includes('javascript:')) return '/'; // Script injection blocked
  if (path.includes('data:')) return '/';      // Data URL blocked

  // Additional URL parsing validation
  try {
    const url = new URL(path, 'https://example.com');
    if (url.host !== 'example.com') return '/';
  } catch {
    return '/';
  }

  return path;
}
```

---

## Content Security Policy

### Production Headers

File: `public/_headers` (Netlify) / `netlify.toml`

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https://cdn.discordapp.com;
  connect-src 'self'
              https://universalis.app
              https://*.workers.dev
              https://*.projectgalatine.com;
  base-uri 'self';
  form-action 'none';
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

### CSP Analysis

| Directive | Value | Security Level |
|-----------|-------|----------------|
| `script-src` | 'self' | EXCELLENT - No inline, no eval |
| `style-src` | 'self' 'unsafe-inline' | ACCEPTABLE (see below) |
| `form-action` | 'none' | EXCELLENT - Form hijacking blocked |
| `frame-ancestors` | 'none' | EXCELLENT - Clickjacking blocked |
| `base-uri` | 'self' | EXCELLENT - Base tag hijacking blocked |

### unsafe-inline for Styles

**Reason:** Required for dynamic color swatches in the dye tools.

```typescript
// Dynamic color display requires inline styles
element.style.backgroundColor = dye.colorHex;
element.style.color = getContrastColor(dye.colorHex);
```

**Mitigation:**
- No user input in style values (only hex colors from validated dye database)
- All 136 dyes have pre-validated color values

---

## Additional Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | MIME sniffing prevention |
| X-Frame-Options | DENY | Clickjacking prevention (legacy) |
| X-XSS-Protection | 1; mode=block | Legacy XSS filter |
| Referrer-Policy | strict-origin-when-cross-origin | Referrer leakage control |
| Permissions-Policy | geolocation=(), microphone=(), camera=() | Feature restriction |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | HTTPS enforcement |

---

## Input Validation

### File Upload Validation

File: `src/components/extractor-tool.ts`

```typescript
// Type validation
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!ALLOWED_TYPES.includes(file.type)) {
  throw new ValidationError('Invalid file type');
}

// Size validation (20MB max)
const MAX_SIZE = 20 * 1024 * 1024;
if (file.size > MAX_SIZE) {
  throw new ValidationError('File too large');
}

// Dimension validation (after load)
if (image.width > 8192 || image.height > 8192) {
  throw new ValidationError('Image dimensions too large');
}
```

### Preset Submission Validation

File: `src/services/preset-submission-service.ts`

| Field | Validation | Limit |
|-------|------------|-------|
| Name | Required, trimmed | 2-50 characters |
| Description | Required, trimmed | 10-200 characters |
| Category | Whitelist validation | Enum values only |
| Dyes | Array of IDs | 2-5 items, numeric only |
| Tags | Optional array | 0-10 items, max 30 chars each |

### Validation Pattern

```typescript
function validatePresetSubmission(data: unknown): PresetSubmission {
  validateNotNull(data, 'submission');
  validateCondition(
    typeof data === 'object' && data !== null,
    'Submission must be an object'
  );

  const { name, description, category, dyes, tags } = data as Record<string, unknown>;

  // Name validation
  validateCondition(
    typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 50,
    'Name must be 2-50 characters'
  );

  // ... additional validations
}
```

---

## API Security

### External API Usage

| API | Authentication | Data Sensitivity |
|-----|----------------|------------------|
| Universalis | None (public) | Market prices (public data) |
| XIV Dye Tools Backend | OAuth JWT | User presets, collections |
| Discord OAuth | OAuth 2.0 | User identity only |

### API Error Handling

- Network errors caught and displayed gracefully
- No sensitive data in error messages
- Rate limiting handled with user feedback
- Timeout handling prevents hanging requests

---

## Local Storage Security

### Data Stored

| Key Pattern | Data | Sensitivity |
|-------------|------|-------------|
| `xivdyetools_theme` | Theme preference | Low |
| `xivdyetools_language` | Language code | Low |
| `xivdyetools_v4_config_*` | Tool configurations | Low |
| `xivdyetools_auth_token` | JWT token | HIGH |
| `xivdyetools_collections` | User dye collections | Medium |

### Token Security

```typescript
// Token expiry validation on every auth check
isAuthenticated(): boolean {
  const token = this.getToken();
  if (!token) return false;

  try {
    const payload = this.decodeToken(token);
    const expiry = payload.exp * 1000;
    return Date.now() < expiry;
  } catch {
    return false;
  }
}
```

---

## Third-Party Script Security

### No Third-Party Scripts

The application loads **no external JavaScript**:
- No analytics scripts (Google Analytics, Plausible, etc.)
- No tracking pixels
- No advertising scripts
- No CDN-hosted libraries (all bundled)

### Font Loading

Fonts loaded from Google Fonts:
- Preconnect hints for performance
- CSP allows only fonts.googleapis.com and fonts.gstatic.com
- No script execution from font URLs

---

## Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| npm audit clean | PASS | 0 vulnerabilities |
| No hardcoded secrets | PASS | Env vars used |
| XSS prevention | PASS | textContent used for user data |
| CSRF protection | PASS | PKCE + state validation |
| CSP implemented | PASS | Strict policy |
| Secure auth flow | PASS | OAuth 2.0 + PKCE |
| Input validation | PASS | All user inputs validated |
| Error handling | PASS | No sensitive data leaked |
| HTTPS enforced | PASS | HSTS header |
| Clickjacking protection | PASS | frame-ancestors 'none' |

---

## Recommendations

### Current State (No Action Required)

All security controls are production-ready. No changes required before release.

### Future Enhancements (Post-Release)

1. **CSP Nonce Support**
   - Replace `'unsafe-inline'` for styles with nonces
   - Requires hosting platform support for dynamic headers

2. **httpOnly Cookie Sessions**
   - Move JWT from localStorage to httpOnly cookie
   - Requires backend changes to OAuth worker

3. **Subresource Integrity**
   - Add SRI hashes for CDN-hosted resources
   - Currently N/A (no CDN scripts)

---

## Security Verdict

| Category | Rating |
|----------|--------|
| Dependency Security | EXCELLENT |
| XSS Prevention | EXCELLENT |
| Authentication | EXCELLENT |
| CSP Implementation | EXCELLENT |
| Input Validation | EXCELLENT |
| **Overall** | **EXCELLENT** |

**Conclusion:** The application's security posture is production-ready with no blocking issues.
