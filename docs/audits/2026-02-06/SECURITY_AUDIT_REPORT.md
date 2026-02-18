# Security Audit Report

## Executive Summary

| Field | Value |
|-------|-------|
| **Project** | xivdyetools-discord-worker v4.0.0 + @xivdyetools/* dependencies |
| **Audit Date** | 2026-02-06 |
| **Auditor** | Claude Code (Opus 4.6) |
| **Overall Risk Level** | **LOW** |
| **Scope** | 5 packages: discord-worker, core, auth, logger, rate-limiter |

The xivdyetools ecosystem demonstrates **strong security practices overall**. No critical or high-severity vulnerabilities were found. The codebase shows evidence of thoughtful security design including Ed25519 signature verification, timing-safe comparisons for webhook authentication, structured error handling that avoids information leakage, and comprehensive input sanitization.

The 10 findings identified are primarily defense-in-depth improvements and minor inconsistencies between documented and actual behavior. The most actionable items are the timing-unsafe JWT signature comparison (FINDING-001) and the incomplete logger redaction patterns (FINDING-005).

---

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 4 |
| Low | 4 |
| Info | 2 |

---

## Dependency Audit (npm audit)

| Package | Prod Deps | Vulnerabilities | Notes |
|---------|-----------|-----------------|-------|
| xivdyetools-discord-worker | 16 | **0** | Clean |
| xivdyetools-core | 4 | **0** | Clean |
| xivdyetools-auth | 3 | **1 HIGH (dev only)** | `@isaacs/brace-expansion` ReDoS — dev dependency, not in production bundle |
| xivdyetools-rate-limiter | 3 | **0** | Clean |
| xivdyetools-logger | 1 | **0** | Clean |

**No production vulnerabilities found across any package.**

---

## Medium Findings (Action Recommended)

### FINDING-001: JWT Signature Uses Non-Constant-Time Comparison
- **Package:** `@xivdyetools/auth`
- **File:** `jwt.ts:137, 214`
- **Issue:** `verifyJWT()` uses `!==` for signature comparison despite the module claiming "timing-safe" in its docstring
- **Fix:** Use existing `timingSafeEqual` from `timing.ts`, or switch to `crypto.subtle.verify()`
- **Effort:** Trivial (reuse existing utility)

### FINDING-003: X-Forwarded-For IP Spoofing Can Bypass Rate Limits
- **Package:** `@xivdyetools/rate-limiter`
- **File:** `ip.ts:33-38`
- **Issue:** Falls back to spoofable `X-Forwarded-For` when `CF-Connecting-IP` is unavailable
- **Mitigated in production:** Cloudflare always provides `CF-Connecting-IP`
- **Fix:** Add documentation warning and optional `trustXForwardedFor` parameter

### FINDING-004: KV Rate Limiter Race Condition Allows Limit Overrun
- **Package:** `@xivdyetools/rate-limiter`
- **File:** `kv.ts:99-105`
- **Issue:** TOCTOU race between `checkOnly()` and `increment()` can allow 1-2 extra requests
- **Mitigated in production:** Upstash Redis backend (atomic) is the primary backend
- **Fix:** Document KV limitation clearly; consider Durable Objects for stricter needs

### FINDING-005: Logger Secret Redaction Regex Patterns Incomplete
- **Package:** `@xivdyetools/logger`
- **File:** `base-logger.ts:131-151`
- **Issue:** Missing patterns for `client_secret`, `private_key`, `signing_key`, `webhook_secret`
- **Fix:** Add additional regex patterns or adopt a generic `*_secret`/`*_token` matcher

---

## Low Findings (Best Practice Improvements)

| ID | Package | Summary |
|----|---------|---------|
| [FINDING-002](findings/FINDING-002.md) | auth | `hmacVerify()` uses `===` not timing-safe (hex variant is safe) |
| [FINDING-006](findings/FINDING-006.md) | rate-limiter | IPv6 addresses not normalized (e.g., `2001:DB8::1` vs `2001:db8::1`) |
| [FINDING-007](findings/FINDING-007.md) | rate-limiter | KV key prefix concatenation allows ambiguous keys with `:` delimiter |
| [FINDING-008](findings/FINDING-008.md) | logger | Secrets in nested objects/JSON strings bypass field-level redaction |

## Informational Findings (Design Documentation)

| ID | Package | Summary |
|----|---------|---------|
| [FINDING-009](findings/FINDING-009.md) | discord-worker | CORS middleware allows all origins (no practical impact for server-to-server) |
| [FINDING-010](findings/FINDING-010.md) | discord-worker | Env validation warns but continues (appropriate fail-safe design) |

---

## Remediation Priority

1. **FINDING-001** — JWT timing-safe comparison (trivial fix, closes doc/impl gap)
2. **FINDING-002** — HMAC timing-safe comparison (trivial fix, consistency)
3. **FINDING-005** — Logger redaction patterns (moderate effort, prevents future leaks)
4. **FINDING-003** — X-Forwarded-For documentation/option (low effort)
5. **FINDING-008** — Recursive field redaction (moderate effort)
6. **FINDING-004** — KV race condition documentation (low effort)
7. **FINDING-006** — IPv6 normalization (low effort)
8. **FINDING-007** — KV key delimiter (low effort)
9. **FINDING-009** — CORS restriction (optional)
10. **FINDING-010** — Env validation tiering (optional)

---

## Positive Security Observations

The audit identified numerous security-positive practices that deserve recognition:

### Authentication & Cryptography
- **Ed25519 Discord interaction verification** — signatures verified before body parsing (defense in depth)
- **HMAC-SHA256 for webhook authentication** — GitHub and internal webhooks properly verified
- **Algorithm confusion prevention** — JWT verification explicitly rejects non-HS256 tokens
- **Timing-safe comparison** for webhook Bearer tokens (constant-time via `crypto.subtle`)
- **Clock skew tolerance** in bot signature verification (prevents replay attacks)
- **Web Crypto API** used throughout (no custom crypto implementations)

### Input Validation & Sanitization
- **Text sanitization** — Zalgo text, control characters, invisible Unicode stripped from user input
- **Prototype pollution protection** — `DyeDatabase` filters `__proto__`, `constructor`, `prototype` keys
- **Body size limits** — 10KB caps on webhook payloads prevent OOM attacks
- **Hex color validation** — regex with length check prevents ReDoS
- **Discord snowflake validation** — MODERATOR_IDS verified as 17-19 digit numbers
- **DataCenter ID sanitization** — non-alphanumeric characters stripped in API URLs

### Error Handling & Information Protection
- **Structured error responses** — 6-category error system with user-friendly messages
- **No stack traces in production** — `sanitizeErrors: true` by default
- **Generic error messages** — internal errors don't leak implementation details
- **Error codes** for debugging without exposing internals

### Infrastructure Security
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS`
- **Service Bindings** — Worker-to-Worker communication avoids public URL exposure
- **Secrets management** — all secrets via `wrangler secret put`, not in code/config
- **`.dev.vars` and `.npmrc` properly gitignored** — local development secrets excluded from VCS
- **Pre-commit hooks** — secret detection, merge conflict checks, large file detection

### Rate Limiting & Availability
- **Fail-open design** — rate limiter prefers availability over strict enforcement
- **Multi-backend support** — Upstash (atomic), KV (distributed), Memory (per-isolate)
- **Burst allowance** — accommodates legitimate fast-clicking users
- **Deadline tracking** — 3-second Discord interaction timeout enforced to prevent worker hangs

### Code Quality
- **No `eval()`, `new Function()`, or dynamic code execution** anywhere in the codebase
- **No dynamic `import()` of user-controlled paths**
- **TypeScript strict mode** with branded types for critical values
- **Comprehensive test coverage** for security-critical functions (Ed25519, JWT, HMAC, rate limiting)
- **Defensive copying** — `getAllDyes()` returns copies, not references

---

## Per-Package Risk Assessment

| Package | Risk Level | Notes |
|---------|-----------|-------|
| **xivdyetools-discord-worker** | LOW | Well-hardened with defense-in-depth patterns |
| **xivdyetools-core** | LOW | Excellent input validation, prototype pollution protection |
| **xivdyetools-auth** | LOW | Sound crypto design; minor timing inconsistency (FINDING-001, 002) |
| **xivdyetools-logger** | LOW-MEDIUM | Good defaults; edge cases in redaction coverage (FINDING-005, 008) |
| **xivdyetools-rate-limiter** | LOW-MEDIUM | Effective against simple abuse; documented limitations in KV backend |

---

## Conclusion

The xivdyetools ecosystem is **well-secured for its threat model** — a Discord bot serving a gaming community. The architecture follows security best practices with defense-in-depth layers. The findings identified are improvements rather than vulnerabilities, and the most impactful fixes (FINDING-001, FINDING-002) are trivial to implement using utilities already present in the codebase.

**No immediate action is required for safe continued operation.** The recommended remediation items should be addressed in the normal development cycle, prioritized by the order listed above.
