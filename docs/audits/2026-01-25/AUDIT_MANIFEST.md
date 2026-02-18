# Security Audit Manifest

## Audit Information

- **Audit Date:** 2026-01-25
- **Auditor:** Claude Code (Automated + Manual Review)
- **Methodology:** OWASP Top 10 2021, Custom Deep-Dive Analysis
- **Tools Used:** npm audit, grep-based secret scanning, manual code review

## Scope

### Projects Audited (12 Total)

| Project | Type | Files | Priority |
|---------|------|-------|----------|
| xivdyetools-oauth | Cloudflare Worker | 30 TS | Tier 1 - CRITICAL |
| xivdyetools-presets-api | Cloudflare Worker + D1 | 41 TS | Tier 1 - CRITICAL |
| xivdyetools-discord-worker | Cloudflare Worker | 115 TS | Tier 2 - HIGH |
| xivdyetools-moderation-worker | Cloudflare Worker | 45 TS | Tier 2 - HIGH |
| xivdyetools-web-app | Vite + Lit SPA | 257 TS | Tier 2 - HIGH |
| xivdyetools-universalis-proxy | Cloudflare Worker | 15 TS | Tier 3 - MEDIUM |
| xivdyetools-og-worker | Cloudflare Worker | 32 TS | Tier 3 - MEDIUM |
| xivdyetools-maintainer | Vue 3 + Express | 32 TS/Vue | Tier 3 - MEDIUM |
| xivdyetools-core | npm Library | 61 TS | Tier 4 - LOW |
| xivdyetools-logger | npm Library | 22 TS | Tier 4 - LOW |
| xivdyetools-types | npm Library | 33 TS | Tier 4 - LOW |
| xivdyetools-test-utils | npm Library | 61 TS | Tier 4 - LOW |

### Out of Scope

- xivdyetools-docs (documentation only, no executable code)
- Third-party dependencies internal code (only vulnerabilities via npm audit)

## OWASP Categories Evaluated

- [x] A01:2021 - Broken Access Control
- [x] A02:2021 - Cryptographic Failures
- [x] A03:2021 - Injection
- [x] A04:2021 - Insecure Design
- [x] A05:2021 - Security Misconfiguration
- [x] A06:2021 - Vulnerable and Outdated Components
- [x] A07:2021 - Identification and Authentication Failures
- [x] A08:2021 - Software and Data Integrity Failures
- [x] A09:2021 - Security Logging and Monitoring Failures
- [x] A10:2021 - Server-Side Request Forgery (SSRF)

## Findings Index

See individual finding files in `findings/` directory.

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| FINDING-001 | Exposed NPM Token in Multiple Projects | CRITICAL | **RESOLVED** (2026-01-25) |
| FINDING-002 | Exposed Discord Bot Token | CRITICAL | **RESOLVED** (2026-01-25) |
| FINDING-003 | Exposed XIVAuth Client Secret | HIGH | **RESOLVED** (2026-01-25) |
| FINDING-004 | Hono JWT Algorithm Confusion | HIGH | **RESOLVED** (2026-01-25) |
| FINDING-005 | Wrangler Command Injection | HIGH | **RESOLVED** (2026-01-25) |
| FINDING-006 | Devalue DoS Vulnerability | HIGH | **RESOLVED** (2026-01-25) |
| FINDING-007 | unsafeHTML Usage Review | LOW | Reviewed - Acceptable |
| FINDING-008 | SQL Injection Prevention Verified | INFO | Secure |

## Audit Statistics

- **Total Findings:** 8
- **Critical:** 2
- **High:** 4
- **Medium:** 0
- **Low:** 1
- **Informational:** 1

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Cloudflare Workers Security Best Practices](https://developers.cloudflare.com/workers/runtime-apis/security/)
