# Security Audit Report — Full Monorepo

## Executive Summary

- **Project:** xivdyetools monorepo (11 packages + 9 applications)
- **Audit Date:** 2026-04-07
- **Auditor:** Claude Opus 4.6 (1M context)
- **Overall Posture:** **STRONG**
- **New Findings:** 6 (0 critical, 1 high, 1 medium, 4 low)
- **Critical Issues:** 0
- **Recommendation:** APPROVED FOR PRODUCTION USE with minor remediations

The xivdyetools monorepo demonstrates excellent security practices across all layers: authentication, input validation, rate limiting, CORS, secret management, and content moderation. The codebase shows evidence of continuous security improvement with documented fixes for multiple prior audit findings (BUG-010, BUG-012, BUG-013, BUG-017). The only high-severity finding is a dependency vulnerability in `rollup` (dev dependency, not shipped to production workers).

---

## Findings at a Glance

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| ~~SEC-001~~ | ~~moderation-worker missing global `onError` handler~~ | MEDIUM | **FIXED** (2026-04-07) |
| [SEC-002](security/SEC-002.md) | `innerHTML` usage in modal-container.ts | LOW | Open — controlled input + CSP mitigates |
| [SEC-003](security/SEC-003.md) | JSON depth limiting inconsistent across workers | LOW | Won't Fix — CF limits + Discord trusted source |
| [SEC-004](security/SEC-004.md) | Missing request body size limits on some endpoints | LOW | Won't Fix — CF 100MB platform limit applies |
| ~~SEC-005~~ | ~~Placeholder env var in moderation-worker wrangler.toml~~ | LOW | **FIXED** (2026-04-07) |
| [SEC-006](security/SEC-006.md) | Dependency vulnerabilities (rollup, esbuild, vite) | HIGH (dev) | Open — dev-only deps; update tsup/vitepress |

---

## 1. Authentication & Authorization

### JWT Implementation ✅ SECURE

**Files:** `packages/auth/src/jwt.ts`, `apps/oauth/src/services/jwt-service.ts`

| Control | Status | Detail |
|---------|--------|--------|
| Algorithm enforcement | ✅ | HS256 only; rejects alg:none and others (line 105) |
| Timing-safe verification | ✅ | Uses `crypto.subtle.verify()` (native, not JS comparison) |
| Expiration enforcement | ✅ | Rejects tokens without `exp` claim (lines 161-165) |
| Subject claim validation | ✅ | **FIXED (BUG-010)** — Rejects tokens without `sub` claim (lines 167-170) |
| Token revocation | ✅ | Blacklist via KV with automatic TTL cleanup (jwt-service.ts:314-350) |
| Minimum key length | ✅ | 32-byte minimum for HMAC-SHA256 (hmac.ts:95-98) |

### HMAC & Cryptographic Operations ✅ SECURE

**File:** `packages/auth/src/hmac.ts`

- CryptoKey caching with LRU (max 10 entries) — lines 41-73
- `extractable: false` on all CryptoKey imports — line 103-109
- Timing-safe comparison via `crypto.subtle.verify()` — lines 161-210
- Web Crypto API only (no Node.js crypto imports) — safe for CF Workers

### Discord Interaction Verification ✅ SECURE

**File:** `packages/auth/src/discord.ts`

- Ed25519 signature verification via `discord-interactions` library (line 101)
- Body size limits: Content-Length check (lines 66-73) + actual size verification (lines 91-97)
- Required header validation: X-Signature-Ed25519, X-Signature-Timestamp (lines 76-85)

### Bot Authentication ✅ SECURE

**File:** `apps/presets-api/src/middleware/auth.ts`

- HMAC signature verification with timestamp validation (5 min window + 1 min clock skew) — lines 123-133
- Development-only unsigned fallback: allowed only when `BOT_SIGNING_SECRET` is missing — lines 100-121
- Moderator role enforcement via `MODERATOR_IDS` env var

### OAuth (PKCE) ✅ SECURE

**Files:** `apps/oauth/src/handlers/authorize.ts`, `apps/oauth/src/handlers/callback.ts`

- PKCE enforced: code_verifier validated per RFC 7636 (callback.ts:162-171)
- State signing: HMAC-SHA256 signed state with expiry (authorize.ts:12)
- **FIXED (BUG-013):** Unsigned states only allowed in development mode (callback.ts:61-65)
- Redirect URI whitelist validation (callback.ts:81-109)
- 10-second timeout on Discord API token exchange (callback.ts:193)

---

## 2. Input Validation & Injection Prevention

### SQL Injection ✅ SECURE

**File:** `apps/presets-api/src/services/preset-service.ts`

All D1 queries use parameterized statements:
- `db.prepare(query).bind(...params, limit, offset)` — line 162
- `db.prepare('SELECT * FROM presets WHERE id = ?').bind(id)` — line 217
- INSERT with 14 parameterized placeholders — lines 253-277
- LIKE pattern injection prevented with `escapeLikePattern()` + `ESCAPE '\'` clause — lines 20-22, 121

### XSS Prevention ✅ SECURE

| Layer | Control | File |
|-------|---------|------|
| SVG output | `escapeXml()` — replaces `&<>"'` with entities | `packages/svg/src/base.ts:12-19` |
| Web app | Strict CSP: `script-src 'self'`, no `unsafe-eval` | `apps/web-app/index.html:10-11` |
| Discord text | Control char removal, invisible Unicode stripping, length limits | `apps/discord-worker/src/utils/sanitize.ts` |
| Preset input | Name 2-50 chars, description 10-200 chars, tags max 10 × 30 chars | `apps/presets-api/src/services/validation-service.ts` |

### Content-Type Enforcement ✅ SECURE

**File:** `apps/presets-api/src/index.ts:137-156`

POST/PATCH/PUT requests must include `Content-Type: application/json`. Rejects with 415 Unsupported Media Type otherwise.

---

## 3. Rate Limiting

### Backend Implementations ✅ SECURE

| Backend | Atomicity | Failure Mode | File |
|---------|-----------|--------------|------|
| Memory | Single-threaded (CF isolate) | N/A | `packages/rate-limiter/src/backends/memory.ts` |
| KV | Optimistic concurrency | Fail-open (logged) | `packages/rate-limiter/src/backends/kv.ts` |
| Upstash | Atomic `INCR` + `EXPIRE NX` pipeline | Fail-open (logged) | `packages/rate-limiter/src/backends/upstash.ts:73-76` |

### IP Extraction ✅ SECURE

**File:** `packages/rate-limiter/src/ip.ts`

- Default `trustXForwardedFor: false` (line 58) — prevents client-controlled header spoofing
- Prefers `CF-Connecting-IP` (set by Cloudflare, unforgeable) — line 61
- IPv6 case normalization to prevent bypass — lines 87-89

### Per-Endpoint Rate Limits

| Endpoint | Limit | Scope |
|----------|-------|-------|
| `/auth/discord`, `/auth/xivauth` | 10/min | Per IP |
| `/auth/callback` | 20/min | Per IP |
| `/auth/refresh` | 30/min | Per IP |
| Presets API (public) | 100/min | Per IP |
| Preset submission | 10/day | Per user |
| Discord commands | Per-command limits | Per user |

### Note: Fail-Open Design

Rate limiter backends allow requests on error (availability > strict limiting). This is documented as intentional (BUG-016 comment at `rate-limit.ts:23`) and logged. Acceptable for rate limiting (not used for authentication).

---

## 4. CORS & Security Headers

### CORS Configuration ✅ SECURE

| Worker | Origin Policy | Credentials |
|--------|--------------|-------------|
| presets-api | Configured origin + `CORS_ORIGINS` env; dev: specific localhost ports | Yes |
| oauth | Configured origin + whitelisted localhost ports (3000, 5173, 8787) | Yes |
| universalis-proxy | Configured whitelist; dev: any localhost port | No |
| api-worker | `*` (read-only public API, GET only) | No |
| discord-worker | N/A (webhook-only, no browser access) | N/A |

All CORS policies reject requests without an Origin header (prevents server-to-server bypass).

### Security Headers ✅ STRONG

Applied across all workers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains  (production only)
```

Content-Type validation enforced on mutation requests (POST/PATCH/PUT).

---

## 5. Secret Management

### Environment Validation ✅ SECURE

| Worker | Validation File | Key Checks |
|--------|----------------|------------|
| oauth | `utils/env-validation.ts` | JWT_SECRET ≥ 32 chars, HTTPS in prod, D1 binding |
| presets-api | `utils/env-validation.ts` | Required bindings, secret presence |
| discord-worker | `utils/env-validation.ts` | Public key, bot token, signing secrets |
| moderation-worker | `utils/env-validation.ts` | Full env validation at startup |

### Secret Storage ✅ CLEAN

- No hardcoded secrets in source code
- Secrets listed as comments in `wrangler.toml` (documentation only, not values)
- All sensitive values set via `wrangler secret put` or Cloudflare dashboard
- Production HTTPS enforcement via URL validation

---

## 6. Dependencies & Supply Chain

### pnpm Audit Results

| Severity | Count | Package | Path | Risk |
|----------|-------|---------|------|------|
| HIGH | 1 | rollup `<4.59.0` | `stoat-worker > tsup > rollup` | Arbitrary file write via path traversal |
| MODERATE | 1 | esbuild `≤0.24.2` | `api-docs > vitepress > vite > esbuild` | Dev server request bypass |
| MODERATE | 1 | vite `≤6.4.1` | `api-docs > vitepress > vite` | Path traversal in .map handling |

**Assessment:** All 3 vulnerabilities are in **development dependencies** — none ship to production Cloudflare Workers. The `rollup` vulnerability affects the `stoat-worker` build tool chain; `esbuild` and `vite` affect the `api-docs` (VitePress) dev server only.

**Recommendation:** Update `tsup` in `stoat-worker` to pull `rollup ≥4.59.0`. Update `vitepress` in `api-docs` for the esbuild/vite fixes. Both are low urgency since they only affect local development.

### Dependency Profile

Production dependencies are minimal across all workers:
- Most dependencies are `workspace:*` internal packages
- External: `hono` (HTTP framework), `discord-interactions` (Ed25519)
- No `eval()`, `Function()`, dynamic `require()`, or `fs` module usage
- No regex DoS patterns found (input validation before regex use)

### Previously Addressed CVEs
- **FINDING-004:** hono updated to `^4.11.4` (JWT algorithm confusion, CVSS 8.2)
- **FINDING-005:** wrangler updated to `^4.59.1` (OS command injection)

---

## 7. Content Moderation

### Profanity Filtering ✅ SECURE

**File:** `apps/presets-api/src/services/moderation-service.ts`

- Multi-language word lists: EN, JA, FR, DE, ZH, KO (lines 64-106)
- Compiled to single regex for efficiency — prevents ReDoS via combined pattern
- Word boundary matching `\b...\b` prevents false positives from substring matches
- Special regex characters escaped before compilation (line 20)
- Optional Perspective API integration for ML-based toxicity scoring (lines 150-210)
- Graceful degradation: falls back to local lists if API unavailable

---

## 8. Data Flow & PII

### User Data Storage

| Data | Location | Purpose |
|------|----------|---------|
| Discord user ID | D1 `presets.author_discord_id`, `banned_users.discord_id` | Authorship, moderation |
| Discord username | D1 `presets.author_name` | Display |
| JWT token | Client localStorage (`xivdyetools_auth_token`) | Session auth |
| PKCE verifier | Client localStorage (transient) | OAuth flow |
| User collections | KV store (JSON) | Dye collections |

### Transit Security
- All traffic over HTTPS (enforced by HSTS)
- JWT tokens in `Authorization: Bearer` header
- Service binding calls include `INTERNAL_WEBHOOK_SECRET` header with timing-safe verification
- GitHub webhook payloads verified with HMAC-SHA256 + `crypto.subtle.timingSafeEqual()`

### PII Assessment
- **Stored PII:** Discord user ID and username only (public Discord profile data)
- **No sensitive PII:** No email, real name, payment, or location data
- **Token storage:** localStorage (client-side) — mitigated by strict CSP, no `unsafe-eval`
- **Ban records:** Stores Discord ID + ban reason + moderator ID in D1

---

## 9. Threat Model Summary

| Threat | Risk | Mitigation |
|--------|------|------------|
| SQL injection | NONE | All queries parameterized; LIKE patterns escaped |
| XSS | VERY LOW | CSP `script-src 'self'`; SVG XML escaping; text sanitization |
| CSRF | VERY LOW | HMAC-signed OAuth state; CORS origin validation |
| JWT manipulation | NONE | HS256 enforced; timing-safe verification; exp+sub required |
| Rate limit bypass | LOW | CF-Connecting-IP preferred; fail-open logged; per-user limits |
| Supply chain | LOW | Minimal deps; all dev-only vulns; workspace packages |
| Service binding impersonation | LOW | Webhook secrets with timing-safe comparison |
| Account takeover | LOW | PKCE OAuth; token revocation via KV blacklist |
| Content abuse | LOW | Multi-language profanity filter + optional ML moderation |
| Data breach | VERY LOW | Only public Discord profile data stored; no sensitive PII |

---

## 10. New Security Findings

| ID | Title | Severity | File |
|----|-------|----------|------|
| [SEC-001](security/SEC-001.md) | moderation-worker missing global `onError` handler | MEDIUM | `apps/moderation-worker/src/index.ts` |
| [SEC-002](security/SEC-002.md) | `innerHTML` usage in modal-container.ts | LOW | `apps/web-app/src/components/modal-container.ts:244` |
| [SEC-003](security/SEC-003.md) | JSON depth limiting inconsistent across workers | LOW | Multiple workers |
| [SEC-004](security/SEC-004.md) | Missing request body size limits on some endpoints | LOW | Multiple workers |
| [SEC-005](security/SEC-005.md) | Placeholder env var in moderation-worker wrangler.toml | LOW | `apps/moderation-worker/wrangler.toml:36` |
| [SEC-006](security/SEC-006.md) | Dependency vulnerabilities (rollup, esbuild, vite) | HIGH (dev) | `pnpm audit` output |

---

## 11. Prior Security Findings Status

### From 2026-02-18 Security Audit & 2026-03-18 Deep-Dive

| Prior ID | Title | Current Status | Evidence |
|----------|-------|----------------|----------|
| BUG-010 | JWT missing `sub` claim validation | **FIXED** | `jwt.ts:167-170` enforces sub claim |
| BUG-013 | OAuth state signing accepts unsigned states | **FIXED** | `callback.ts:61-65` — dev only |
| BUG-016 | Rate limiter no fail-closed behavior | **ADDRESSED** | Fail-open logged (rate-limit.ts:23-25) |
| BUG-018 | IP header spoofing for rate limit bypass | **FIXED** | `ip.ts:58` defaults `trustXForwardedFor: false` |
| FINDING-001 | Timing-safe JWT verification | **FIXED** | `crypto.subtle.verify()` throughout |
| FINDING-002 | Timing-safe HMAC verification | **FIXED** | `crypto.subtle.verify()` in hmac.ts |
| FINDING-003 | Require exp claim in JWTs | **FIXED** | `jwt.ts:161-165` |
| FINDING-004 | Hono JWT algorithm confusion | **FIXED** | hono `^4.11.4` |
| FINDING-005 | Wrangler command injection | **FIXED** | wrangler `^4.59.1` |
| FINDING-006 | X-Forwarded-For trust default | **FIXED** | `ip.ts:58` |
| FINDING-009 | HMAC minimum key length | **FIXED** | `hmac.ts:95-98` — 32-byte minimum |

---

## 12. Recommendations

### Immediate (This Sprint)
1. **SEC-001:** Add global `onError` handler to moderation-worker (prevents stack trace leaks)
2. **SEC-006:** Update `tsup` in stoat-worker for rollup fix

### Short-Term (Next Release)
3. **SEC-003:** Add JSON depth limiting to presets-api and discord-worker (moderation-worker already has it)
4. **SEC-004:** Add request body size middleware to workers that parse JSON

### Long-Term (Quarterly Review)
5. **SEC-002:** Migrate `innerHTML` to DOM methods in modal-container.ts
6. Consider `httpOnly` cookie-based auth as defense-in-depth alternative to localStorage
7. Review CORS `maxAge: 86400` — consider reducing to 3600 for faster policy propagation

---

## Conclusion

The xivdyetools monorepo has a **strong security posture** with production-grade implementations across all security domains. Key strengths:

- ✅ Comprehensive JWT/HMAC with timing-safe operations and minimum key lengths
- ✅ All SQL queries parameterized with LIKE pattern escaping
- ✅ Multi-layer rate limiting with secure IP extraction
- ✅ CORS properly scoped per-worker with origin validation
- ✅ Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- ✅ No hardcoded secrets; env validation at startup
- ✅ Minimal production dependencies
- ✅ Continuous improvement evidenced by documented fixes for 11+ prior findings

**Security Status: ✅ PASS**

No critical or high-severity production vulnerabilities. The 1 high-severity dependency issue affects development tooling only.

---

**Last Updated:** 2026-04-07
