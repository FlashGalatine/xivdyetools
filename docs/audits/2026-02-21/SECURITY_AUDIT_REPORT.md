# Security Audit Report

## Executive Summary
- **Project:** XIV Dye Tools (xivdyetools monorepo)
- **Audit Date:** 2026-02-21
- **Overall Risk Level:** MEDIUM
- **Auditor:** GitHub Copilot (Claude Opus 4.6)

The xivdyetools monorepo demonstrates **good overall security posture** with several defense-in-depth patterns including PKCE for OAuth, prototype pollution protection, parameterized SQL queries, ReDoS prevention, and API response size limits. No SQL injection or critical authentication bypass vulnerabilities were found. The most significant findings are in fail-open validation patterns and race conditions in the rate limiter.

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 2     |
| Medium   | 9     |
| Low      | 3     |
| Info     | 0     |

**Total: 14 findings**

## High-Severity Findings

### FINDING-001 — OAuth CSRF State Validation Is Fail-Open
**Component:** `apps/web-app` | **CWE:** CWE-352
The CSRF state check silently skips when either parameter is missing, rather than rejecting. PKCE provides mitigation, but defense-in-depth requires fail-closed logic.

### FINDING-002 — Upstash Rate Limiter INCR Without Atomic EXPIRE
**Component:** `packages/rate-limiter` | **CWE:** CWE-362
If a Worker crashes between INCR and EXPIRE, rate limit keys persist indefinitely, permanently blocking affected users.

## Medium-Severity Findings

### FINDING-003 — JWT Accepts Missing `exp` Claim
**Component:** `packages/auth` | **CWE:** CWE-613
Tokens without `exp` are treated as never-expiring.

### FINDING-004 — `hexToBytes` Silent Data Corruption
**Component:** `packages/crypto` | **CWE:** CWE-20
Invalid hex input silently produces zeroed bytes instead of throwing.

### FINDING-005 — Bot Signature Ambiguous Message Format
**Component:** `packages/auth` | **CWE:** CWE-287
Missing userId/userName produces indistinguishable signatures from system-level requests.

### FINDING-006 — `getClientIp` Trusts X-Forwarded-For by Default
**Component:** `packages/rate-limiter` | **CWE:** CWE-290
Default `trustXForwardedFor: true` allows trivial IP spoofing for rate limit bypass.

### FINDING-007 — Logger Doesn't Redact Array Elements
**Component:** `packages/logger` | **CWE:** CWE-532
Secrets nested in arrays bypass redaction.

### FINDING-008 — Custom `redactFields` Replaces Defaults
**Component:** `packages/logger` | **CWE:** CWE-532
Adding a custom redaction field disables all built-in redaction (password, token, etc.).

### FINDING-009 — No Minimum HMAC Secret Length
**Component:** `packages/auth` | **CWE:** CWE-326
Empty or single-character secrets are accepted without warning.

### FINDING-010 — JWT Payload Type Assertion Without Validation
**Component:** `packages/auth` | **CWE:** CWE-20
`JSON.parse()` output cast to `JWTPayload` without runtime type checking.

### FINDING-011 — OG Worker Missing NaN Validation on dyeId
**Component:** `apps/og-worker` | **CWE:** CWE-20
Non-numeric dyeId path parameters cause 500 errors.

## Low-Severity Findings

### FINDING-012 — Rate Limiter Key Injection via Delimiter
**Component:** `packages/rate-limiter` | **CWE:** CWE-74
Unsanitized `|` delimiter in keys allows cross-user counter corruption.

### FINDING-013 — OG Worker `themeColor` Not HTML-Escaped
**Component:** `apps/og-worker` | **CWE:** CWE-79
Defense-in-depth gap for meta tag value insertion.

### FINDING-014 — OAuth State Signature Non-Constant-Time Comparison
**Component:** `apps/oauth` | **CWE:** CWE-208
Theoretical timing attack on HMAC state verification.

## Remediation Priority

### 1. Immediate (this week)
- **FINDING-001** — Change CSRF check to `if (!csrf || !storedState || csrf !== storedState)`
- **FINDING-002** — Use atomic `EXPIRE NX` flag with INCR pipeline
- **FINDING-003** — Change to `if (!payload.exp || payload.exp < now)`

### 2. Short-term (next sprint)
- **FINDING-004** — Add hex validation in `hexToBytes()`
- **FINDING-005** — Require all bot signature fields or use distinct message format
- **FINDING-006** — Change `trustXForwardedFor` default to `false`
- **FINDING-007** — Recurse redaction into array elements
- **FINDING-008** — Merge custom redact fields with defaults instead of replacing
- **FINDING-009** — Add `keyData.length >= 32` check in `createHmacKey()`

### 3. Medium-term (next release)
- **FINDING-010** — Add runtime payload validation guard
- **FINDING-011** — Add NaN guards on OG worker routes
- **FINDING-012** — Sanitize rate limiter key delimiters
- **FINDING-013** — Apply `escapeHtml()` to `themeColor`
- **FINDING-014** — Use `timingSafeEqual()` for state HMAC comparison

## Strong Security Patterns (Positive Findings)

The following patterns are well-implemented and should be preserved:

| Pattern | Location | Assessment |
|---------|----------|------------|
| Prototype pollution protection | `core/DyeDatabase.safeClone()` | Correctly filters `__proto__`, `constructor`, `prototype` |
| Parameterized SQL queries | `presets-api`, `oauth` | All D1 queries use `?` placeholders — no concatenation |
| ReDoS prevention | `core/utils/isValidHexColor()` | Length check before regex |
| API response size limits | `core/APIService.fetchWithTimeout()` | Validates Content-Length AND body size |
| PKCE OAuth flow | `web-app/auth-service.ts` | code_verifier + code_challenge correctly implemented |
| URL path sanitization | `core/APIService.sanitizeDataCenterId()` | Strips non-alphanumeric characters |
| Return path sanitization | `web-app/auth-service.ts` | Blocks protocol-relative URLs, javascript:, data: |
| Non-extractable CryptoKeys | `auth/hmac.ts` | `extractable: false` correctly set |
| `unsafeHTML` safety | `web-app/` | Only used with compile-time static constants |
| Datacenter allowlist | `universalis-proxy` | Prevents SSRF via static name validation |
| Race condition prevention | `core/APIService`, `universalis-proxy` | Deferred promise deduplication pattern |
