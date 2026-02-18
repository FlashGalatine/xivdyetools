# Security Audit: Executive Summary

**Project:** xivdyetools-* Monorepo
**Date:** December 15, 2025
**Auditor:** Claude Code Security Analysis
**Classification:** Internal Use

---

## Overview

This comprehensive security audit covers the xivdyetools ecosystem, a monorepo containing 10 interconnected projects that provide color analysis and community tools for Final Fantasy XIV players. The ecosystem includes a web application, Discord bot, OAuth authentication service, and community presets API, all built on modern TypeScript with Cloudflare Workers infrastructure.

### Projects Audited

| Project | Version | Type | Risk Exposure |
|---------|---------|------|---------------|
| xivdyetools-core | 1.4.0 | npm library | Low (no network) |
| xivdyetools-web-app | 3.1.0 | Web application | Medium (public) |
| xivdyetools-discord-worker | 2.1.0 | Cloudflare Worker | Medium (public API) |
| xivdyetools-oauth | 2.1.0 | Cloudflare Worker | High (auth service) |
| xivdyetools-presets-api | 1.2.0 | Cloudflare Worker + D1 | High (data storage) |
| xivdyetools-logger | 1.0.0 | npm library | Low |
| xivdyetools-types | 1.0.0 | npm library | Low |
| xivdyetools-test-utils | 1.0.2 | npm library | Low |
| xivdyetools-maintainer | 1.0.0 | Dev tool | Medium (local) |
| xivdyetools-docs | - | Documentation | N/A |

---

## Risk Assessment Matrix

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | - |
| High | 2 | Requires attention |
| Medium | 4 | Should address |
| Low | 3 | Monitor |
| Informational | 5 | Best practices |

### Findings Overview

| ID | Finding | Severity | Category | Status |
|----|---------|----------|----------|--------|
| SEC-001 | Maintainer service lacks authentication | High | Access Control | Open |
| SEC-002 | Selenium in production dependencies | High | Vulnerable Components | Open |
| SEC-003 | Vitest version inconsistencies (v2/v3/v4) | Medium | Configuration | Open |
| SEC-004 | TypeScript version inconsistencies | Medium | Configuration | Open |
| SEC-005 | Core package version mismatch | Medium | Configuration | Open |
| SEC-006 | @types/node version inconsistencies | Medium | Configuration | Open |
| SEC-007 | Missing SRI for external resources | Low | Integrity | Open |
| SEC-008 | CSP in meta tags vs HTTP headers | Low | Configuration | Open |
| SEC-009 | No automated secret rotation | Low | Operations | Open |

---

## Critical Findings

### SEC-001: Maintainer Service Lacks Authentication (HIGH)

**Location:** `xivdyetools-maintainer/server/api.ts:55-101`

**Description:** The maintainer developer tool exposes POST endpoints that can write directly to core data files without any authentication. While designed for local development only (localhost:3001), if accidentally exposed or misconfigured, it could allow unauthorized modification of:
- Core color definitions (`colors_xiv.json`)
- Localization files (6 languages)

**Risk:** If exposed to network, attackers could corrupt core data files affecting all downstream applications.

**Recommendation:** Add basic authentication or API key validation, even for development tools. Consider environment variable check to prevent accidental production deployment.

---

### SEC-002: Selenium in Production Dependencies (HIGH)

**Location:** `xivdyetools-web-app/package.json:70`

**Description:** The `selenium` package (v2.20.0) is listed as a production dependency instead of a dev dependency. This package:
- Has not been updated since 2020
- Is a browser automation framework with no purpose in a client-side web app
- May contain unpatched vulnerabilities
- Increases bundle size unnecessarily

**Risk:** Potential security vulnerabilities from unmaintained package; unnecessary attack surface.

**Recommendation:** Remove selenium from dependencies entirely, or move to devDependencies if needed for testing (though Playwright is already used for E2E).

---

## Security Strengths

The audit identified several areas of excellent security implementation:

### Authentication & Authorization
- **OAuth 2.0 with PKCE** - Properly implemented with code verifier/challenge flow
- **JWT Validation** - HS256 signing with proper algorithm verification (prevents "alg: none" attacks)
- **Ed25519 Signatures** - Discord interaction verification using cryptographic signatures
- **Token Lifecycle** - Refresh tokens, revocation via KV blacklist, 24h grace periods

### Data Protection
- **Parameterized Queries** - All D1 database queries use `.prepare().bind()` preventing SQL injection
- **LIKE Pattern Escaping** - Special characters escaped in search queries
- **Input Validation** - Comprehensive validation at API boundaries

### Infrastructure Security
- **Rate Limiting** - Multi-tier rate limiting:
  - 5 req/min for image processing
  - 15 req/min for standard commands
  - 100 req/min for public API
  - 10 submissions/day per user
- **Security Headers** - HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff
- **CORS Validation** - Whitelist-based origin validation

### Cryptographic Implementation
- **Timing-Safe Comparisons** - Constant-time secret validation prevents timing attacks
- **HMAC Request Signing** - Bot-to-API authentication with timestamp anti-replay
- **Proper Entropy** - `crypto.getRandomValues()` for PKCE verifier generation

---

## Comparison to Previous Audits

### November 2025 Security Hardening Plan
| Recommendation | Status |
|----------------|--------|
| Input validation for commands | Implemented |
| Image validation/sanitization | Implemented |
| Docker non-root user | Partially (architecture changed to Cloudflare Workers) |
| Secret redaction in logs | Implemented via @xivdyetools/logger |
| Automated dependency scanning | Not implemented |

### January 2025 (Opus45) Audit
| Finding | Status |
|---------|--------|
| glob HIGH severity vulnerability | Fixed |
| vite/vitest chain vulnerabilities | Fixed (upgraded to v7/v4) |
| innerHTML XSS risks | Fixed (51 instances addressed) |
| Console statement info disclosure | Fixed (centralized logger) |

---

## Architecture Security Overview

```
                                   ┌─────────────────────┐
                                   │   Web Application   │
                                   │  (Client-side only) │
                                   └──────────┬──────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              │                               │                               │
              ▼                               ▼                               ▼
   ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
   │  OAuth Worker    │          │  Discord Worker  │          │  Presets API     │
   │                  │          │                  │          │                  │
   │  - PKCE Flow     │          │  - Ed25519 Verify│          │  - D1 Database   │
   │  - JWT Signing   │◄────────►│  - Rate Limiting │◄────────►│  - Moderation    │
   │  - Token Revoke  │          │  - HMAC Signing  │          │  - Rate Limiting │
   └──────────────────┘          └──────────────────┘          └──────────────────┘
           │                              │                              │
           │                              │                              │
           ▼                              ▼                              ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │                        Cloudflare Infrastructure                              │
   │  KV (sessions, rate limits) │ D1 (presets, votes) │ R2 (image cache)         │
   └──────────────────────────────────────────────────────────────────────────────┘
```

**Security Boundaries:**
- All workers validate requests at entry
- Service bindings preferred over public HTTP for worker-to-worker communication
- Secrets managed via Cloudflare wrangler secrets (not in code/config)

---

## Recommendations Summary

### Immediate Actions (This Week)
1. Remove selenium from web-app production dependencies
2. Update @xivdyetools/core references to ^1.4.0
3. Add authentication to maintainer service (even basic API key)

### Short-Term (This Month)
4. Standardize vitest to v4 across all projects
5. Standardize TypeScript to ^5.9.3 across all projects
6. Implement automated dependency auditing in CI/CD

### Long-Term (This Quarter)
7. Move CSP from meta tags to HTTP headers
8. Implement Subresource Integrity (SRI) for external resources
9. Document secret rotation procedures
10. Consider adding automated security scanning (Snyk/Dependabot)

---

## Overall Security Posture

**Rating:** GOOD (with minor improvements needed)

The xivdyetools ecosystem demonstrates a mature security posture with proper implementation of:
- Modern authentication flows (OAuth 2.0 + PKCE)
- Cryptographic best practices
- Defense in depth (multiple validation layers)
- Secure-by-default configurations

The identified issues are primarily configuration hygiene and dependency management rather than fundamental security flaws. The previous audits' recommendations have been substantially addressed, showing good security maintenance practices.

---

## Document Index

| Document | Description |
|----------|-------------|
| [01_DETAILED_FINDINGS.md](./01_DETAILED_FINDINGS.md) | Complete technical findings with OWASP mapping |
| [02_DEPENDENCY_AUDIT.md](./02_DEPENDENCY_AUDIT.md) | Full dependency analysis across all projects |
| [03_AUTHENTICATION_REVIEW.md](./03_AUTHENTICATION_REVIEW.md) | Authentication/authorization deep dive |
| [04_REMEDIATION_ROADMAP.md](./04_REMEDIATION_ROADMAP.md) | Prioritized action plan |

---

**Document Owner:** XIV Dye Tools Team
**Next Review:** March 15, 2026 (Quarterly)
