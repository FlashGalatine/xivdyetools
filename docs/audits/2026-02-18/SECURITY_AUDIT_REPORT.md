# Security Audit Report

## Executive Summary
- **Project:** XIV Dye Tools (xivdyetools monorepo)
- **Audit Date:** 2026-02-18
- **Overall Risk Level:** LOW
- **Auditor:** Claude Code (automated + manual review)

The XIV Dye Tools codebase demonstrates **strong security fundamentals** across all packages and applications. No critical vulnerabilities were identified. The project uses modern cryptographic practices (Web Crypto API, Ed25519, HMAC-SHA256), comprehensive input validation, parameterized database queries, and defense-in-depth patterns throughout.

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 0     |
| Medium   | 3     |
| Low      | 6     |
| Info     | 1     |

## Findings by Severity

### Medium Findings

| ID | Title | Component |
|----|-------|-----------|
| [FINDING-001](findings/FINDING-001.md) | Bot signing secret not enforced in production | presets-api |
| [FINDING-003](findings/FINDING-003.md) | OG-Worker image parameter bounds unchecked | og-worker |
| [FINDING-004](findings/FINDING-004.md) | SVG text injection risk in OG generation | discord-worker, og-worker |

### Low Findings

| ID | Title | Component |
|----|-------|-----------|
| [FINDING-002](findings/FINDING-002.md) | Discord snowflake format not validated | All workers |
| [FINDING-005](findings/FINDING-005.md) | JWT stored in localStorage (documented trade-off) | web-app |
| [FINDING-006](findings/FINDING-006.md) | KV rate limiter TOCTOU race condition (documented) | rate-limiter |
| [FINDING-007](findings/FINDING-007.md) | State transition period legacy flag | oauth |
| [FINDING-008](findings/FINDING-008.md) | APIService cache not cleared on logout | web-app |
| [FINDING-010](findings/FINDING-010.md) | Moderator IDs not validated at startup | moderation-worker |

### Informational

| ID | Title | Component |
|----|-------|-----------|
| [FINDING-009](findings/FINDING-009.md) | IP header trust without Cloudflare validation | universalis-proxy, rate-limiter |

## Security Strengths

The following areas were reviewed and found to be **well-implemented**:

### Authentication & Cryptography
- **Ed25519 signature verification** for all Discord interactions (discord-worker, moderation-worker)
- **JWT verification** with algorithm confusion prevention (rejects non-HS256)
- **HMAC-SHA256** for inter-service authentication with timing-safe comparison
- **PKCE (RFC 7636)** enforced on all OAuth flows with format validation
- **Timing-safe operations** via `crypto.subtle.timingSafeEqual()` with XOR fallback
- **Web Crypto API** used throughout — no deprecated crypto libraries

### Input Validation
- **Parameterized SQL queries** via D1 `.bind()` in all database operations (presets-api, moderation-worker)
- **Content sanitization** for Zalgo text, invisible characters, and control characters (discord-worker)
- **PKCE verifier format validation** per RFC 7636 (`/^[A-Za-z0-9\-._~]{43,128}$/`)
- **Item ID validation** in universalis-proxy (positive integers, max 1,000,000, max 100 per batch)
- **Redirect URI validation** preventing open redirects (oauth)
- **Content-Type enforcement** on mutation requests (presets-api)
- **Prototype pollution protection** in DyeDatabase (`__proto__`, `constructor`, `prototype` filtered)

### Rate Limiting
- **Multiple backends**: Memory (dev), KV (Workers), Upstash Redis (atomic), Durable Objects (oauth)
- **Sliding window algorithm** with burst allowance
- **Fail-open design** for availability
- **Per-user and per-IP** limiting with IPv6-aware key delimiter

### Logging & Error Handling
- **Secret redaction** in all log output (passwords, tokens, API keys, bearer tokens)
- **Structured logging** with request ID correlation
- **Error sanitization** in production (no stack traces, no internal details)
- **Safe JSON parsing** in moderation-worker (max depth, structure validation, result freezing)

### CORS & Headers
- **Strict CORS origin validation** with whitelist (no wildcards in production)
- **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy: default-src 'none'` (moderation-worker)
- **No CORS for server-to-server calls** (requests without Origin header are rejected)

### Architecture
- **Service Bindings** for inter-worker communication (no public HTTP exposure)
- **Environment variable validation** at startup with production fail-fast
- **Minimal external dependencies** (only `@upstash/redis`, `discord-interactions`, `hono`)

## Remediation Priority

### Immediate (Next Sprint)
1. **FINDING-001**: Verify `BOT_SIGNING_SECRET` is in production env validation
2. **FINDING-003**: Add upper bounds to OG-Worker image parameters
3. **FINDING-004**: Verify XML entity escaping in SVG text interpolation

### Short-Term (Next Month)
4. **FINDING-002**: Add Discord snowflake format validation utility
5. **FINDING-007**: Remove or add expiry for `STATE_TRANSITION_PERIOD` flag
6. **FINDING-010**: Hard-fail on missing `MODERATOR_IDS` in production

### Low Priority (Backlog)
7. **FINDING-005**: Add `StorageEvent` listener for cross-tab logout
8. **FINDING-006**: Document KV rate limiter as "best effort"
9. **FINDING-008**: Clear APIService cache on logout
10. **FINDING-009**: No action needed (Cloudflare-only deployment)

## Automated Scan Results

### pnpm audit (2026-02-18)

**673 total dependencies scanned** — 2 advisories found, both in **development tooling only** (not shipped to production):

| Package | Severity | CVE | Via | Impact |
|---------|----------|-----|-----|--------|
| `ajv` v6.12.6 | Moderate | CVE-2025-69873 | eslint | ReDoS when `$data` option is enabled. ESLint does not use `$data` option, so not exploitable in this context. |
| `minimatch` v3.1.2, v9.0.5 | High | CVE-2026-26996 | eslint, typescript-eslint | ReDoS via repeated wildcards. Only affects glob matching with untrusted input — ESLint processes developer-controlled globs, not user input. |

**Assessment:** Neither vulnerability affects production code or user-facing functionality. Both are in development-only dependencies (linting tools). No immediate action required, but updating eslint to a version with patched transitive dependencies is recommended as routine maintenance.

See [evidence/pnpm-audit.json](evidence/pnpm-audit.json) for full scan output.
