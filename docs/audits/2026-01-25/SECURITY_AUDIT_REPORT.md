# Security Audit Report

## Executive Summary

- **Project:** xivdyetools-* Ecosystem (12 projects)
- **Audit Date:** 2026-01-25
- **Overall Risk Level:** **LOW** (critical secrets rotated 2026-01-25)
- **Auditor:** Claude Code (Automated + Manual Review)

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 4 |
| Medium | 2 |
| Low | 1 |
| Info | 2 |
| **Total** | **12** |

## Critical Findings - RESOLVED

### FINDING-001: Exposed NPM Token - RESOLVED
**Severity:** CRITICAL | **Projects:** core, logger, types, test-utils | **Status:** RESOLVED (2026-01-25)

NPM token with Read+Write scope was exposed in `.env` files across 4 library projects.

**Resolution:** Token revoked and rotated. New token securely stored in GitHub Secrets.

### FINDING-002: Exposed Discord Bot Token - RESOLVED
**Severity:** CRITICAL | **Project:** discord-worker | **Status:** RESOLVED (2026-01-25)

Discord bot token was exposed in `.env` file.

**Resolution:** Token reset in Discord Developer Portal. New token configured in Cloudflare Secrets.

### FINDING-003: Exposed XIVAuth Client Secret - RESOLVED
**Severity:** HIGH | **Project:** discord-worker | **Status:** RESOLVED (2026-01-25)

XIVAuth OAuth client secret was exposed in `.env` file.

**Resolution:** Secret rotated with XIVAuth service. New secret configured in Cloudflare Secrets.

## High Severity Findings - RESOLVED

### FINDING-004: Hono JWT Algorithm Confusion - RESOLVED
**Severity:** HIGH | **Projects:** All Cloudflare Workers | **Status:** RESOLVED (2026-01-25)

Hono <=4.11.3 has JWT algorithm confusion vulnerabilities (CVSS 8.2). Custom JWT implementation in oauth project mitigates this.

**Resolution:** Updated hono to ^4.11.4 in all 6 Worker projects.

### FINDING-005: Wrangler Command Injection - RESOLVED
**Severity:** HIGH (Dev Tooling) | **Projects:** All Cloudflare Workers | **Status:** RESOLVED (2026-01-25)

Wrangler 4.0.0-4.59.0 has OS command injection in `wrangler pages deploy`.

**Resolution:** Updated wrangler to ^4.59.1 in all 6 Worker projects.

### FINDING-006: Devalue DoS Vulnerability - RESOLVED
**Severity:** HIGH | **Projects:** oauth, presets-api | **Status:** RESOLVED (2026-01-25)

Devalue 5.1.0-5.6.1 vulnerable to memory exhaustion DoS.

**Resolution:** Updated devalue transitive dependency via npm audit fix.

## Detailed Findings

| ID | Title | Severity | Project(s) |
|----|-------|----------|------------|
| FINDING-001 | [Exposed NPM Token](findings/FINDING-001-exposed-npm-token.md) | CRITICAL | core, logger, types, test-utils |
| FINDING-002 | [Exposed Discord Token](findings/FINDING-002-exposed-discord-token.md) | CRITICAL | discord-worker |
| FINDING-003 | [Exposed XIVAuth Secret](findings/FINDING-003-exposed-xivauth-secret.md) | HIGH | discord-worker |
| FINDING-004 | [Hono JWT Vulnerability](findings/FINDING-004-hono-jwt-algorithm-confusion.md) | HIGH | All Workers |
| FINDING-005 | [Wrangler Command Injection](findings/FINDING-005-wrangler-command-injection.md) | HIGH | All Workers |
| FINDING-006 | [Devalue DoS](findings/FINDING-006-devalue-dos-vulnerability.md) | HIGH | oauth, presets-api |
| FINDING-007 | [unsafeHTML Usage Review](findings/FINDING-007-unsafehtml-usage-review.md) | LOW | web-app |
| FINDING-008 | [SQL Injection Prevention](findings/FINDING-008-sql-injection-prevention-verified.md) | INFO | presets-api |

## Security Strengths Identified

### Authentication & Authorization
- **JWT Implementation**: Custom HS256 with algorithm validation, JTI revocation, proper expiry
- **PKCE OAuth**: Full PKCE implementation with signed state parameters
- **Dual Auth**: Bot + Web authentication with HMAC request signing
- **Timing-Safe Comparisons**: crypto.subtle.timingSafeEqual() used throughout

### Input Validation
- **SQL Injection**: All queries parameterized via D1 .bind()
- **XSS Prevention**: unsafeHTML only for static SVG icons
- **SSRF Protection**: Strict URL allowlisting, private IP blocking, redirect validation

### Infrastructure
- **Rate Limiting**: Implemented across all workers (with documented race condition trade-offs)
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, HSTS applied
- **Error Sanitization**: Generic error messages prevent information leakage

## Remediation Priority

### Immediate Action (Within 24 Hours) - COMPLETED
1. ~~Revoke and rotate NPM token~~ - DONE (2026-01-25)
2. ~~Reset Discord bot token~~ - DONE (2026-01-25)
3. ~~Rotate XIVAuth client secret~~ - DONE (2026-01-25)

### This Week - COMPLETED
4. ~~Update hono to >=4.11.4 in all Worker projects~~ - DONE (2026-01-25)
5. ~~Update wrangler to >=4.59.1~~ - DONE (2026-01-25)
6. ~~Update devalue to >=5.6.2~~ - DONE (2026-01-25)

### Technical Debt Backlog
7. ~~Add pre-commit hooks to prevent secret commits~~ - DONE (2026-01-26)
8. ~~Document rate limiting race condition trade-offs~~ - DONE (2026-01-26)
9. Implement token rotation in maintainer tool

## Recommendations

1. **Secrets Management**: Use Cloudflare Secrets exclusively; never store secrets in .env files - ✅ IMPLEMENTED (2026-01-25)
2. **Dependency Updates**: Set up automated dependency scanning (Dependabot/Renovate) - ✅ IMPLEMENTED (2026-01-26)
3. **Pre-commit Hooks**: Add secret detection hooks (git-secrets, detect-secrets) - ✅ IMPLEMENTED (2026-01-26)
4. **Monitoring**: Implement alerting for rate limiter KV errors - ✅ IMPLEMENTED (2026-01-26)
5. **Documentation**: Document security trade-offs in architecture docs - ✅ IMPLEMENTED (2026-01-26)

## Next Steps

1. Review findings with team
2. Prioritize items for remediation
3. Create tickets/issues for tracking
4. Schedule security review after fixes applied
