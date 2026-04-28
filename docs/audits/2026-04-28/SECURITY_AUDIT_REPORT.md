# Security Audit Report — Delta since 2026-04-07

## Executive Summary

- **Project:** xivdyetools monorepo (12 packages + 11 applications)
- **Audit Date:** 2026-04-28
- **Auditor:** Claude Opus 4.7
- **Approach:** Delta-focused — verifies prior-finding status and audits only code paths added or changed since the [2026-04-07 baseline audit](../2026-04-07/SECURITY_AUDIT_REPORT.md)
- **Overall Posture:** **STRONG** — unchanged from 2026-04-07
- **New Findings:** 3 (0 critical, 0 high, 0 medium, 2 low, 1 info)
- **Prior Findings Closed:** 1 (`2026-04-07/SEC-002` confirmed FIXED)
- **Standing Findings:** 1 (`2026-04-07/SEC-006` → tracked as [SEC-003](security/SEC-003.md), partial fix in place, full fix blocked by VitePress 1.x)
- **Recommendation:** **APPROVED FOR PRODUCTION USE**

The biggest new attack surface — the public-facing `apps/api-worker` (KV-backed, GET-only dye API at `data.xivdyetools.app`) — is well-built. Input validation is whitelisted at every parameter, the IP-keyed rate limiter inherits the hardened `getClientIp` default (`trustXForwardedFor: false`), and there are no service bindings or write paths to exploit. The new shared `packages/worker-middleware` cleans up the prior `Context<any>` antipattern via Hono module augmentation and exposes safe defaults. The only material new finding is a defense-in-depth one: a single `innerHTML` interpolation of XIVAuth-provided character data in the web-app auth dropdown, which violates the project's own documented XSS rule.

The 2026-04-28 deep-dive audit (in this same folder) raised cross-cutting hygiene items (`ARCH-001` — long CORS `maxAge` on api-worker; `REFACTOR-002` — api-worker missing the standard logger middleware). Those are *not* security vulnerabilities and are not double-reported here; they are linked from § 4.

## Findings at a Glance

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| [SEC-001](security/SEC-001.md) | `innerHTML` interpolation of XIVAuth character data in `auth-button.ts:222` | **LOW** | OPEN |
| [SEC-002](security/SEC-002.md) | `worker-middleware` rate-limit `keyExtractor` is a quiet footgun | **INFO** | OPEN |
| [SEC-003](security/SEC-003.md) | Dev-only dependency vulns (esbuild, vite via vitepress) | **LOW** (dev-only) | STANDING — partial fix in place |
| ~~`2026-04-07/SEC-002`~~ | ~~`innerHTML` in `modal-container.ts`~~ | LOW | **FIXED** (verified 2026-04-28) |
| `2026-04-07/SEC-006` (rollup arm) | rollup `<4.59.0` path traversal in stoat-worker build chain | HIGH (dev) | **FIXED** via `pnpm.overrides` (verified 2026-04-28) |

---

## 1. Prior-Finding Status Update

### `2026-04-07/SEC-002` — `innerHTML` in `modal-container.ts` → **FIXED**

The 2026-04-07 finding flagged a string-typed `modal.content` being assigned via `innerHTML`. As of 2026-04-28, [`apps/web-app/src/components/modal-container.ts:236-243`](../../apps/web-app/src/components/modal-container.ts#L236-L243) builds the content container with `createElement` and uses `content.appendChild(modal.content)` — `modal.content` is now typed as `HTMLElement`, not `string`. The only remaining `innerHTML` in the file is the close-button's static SVG glyph at line 223 (compile-time literal, no interpolation), which is sanctioned by the project's documented "static SVG via innerHTML" pattern in [`apps/web-app/CLAUDE.md`](../../apps/web-app/CLAUDE.md).

**Closeout:** No follow-up.

### `2026-04-07/SEC-006` (rollup arm) — `<4.59.0` path traversal → **FIXED**

The 2026-04-07 finding flagged `tsup` in `apps/stoat-worker` pulling in a vulnerable `rollup`. The current root [`package.json:23-27`](../../package.json#L23-L27) carries:

```json
"pnpm": {
  "overrides": {
    "typescript": "^5.9.3",
    "rollup": ">=4.59.0"
  }
}
```

The 2026-04-28 `pnpm audit --audit-level=low` output **does not list rollup**, confirming the override is reaching the resolution graph. `tsup` in stoat-worker continues to work (no build failures observed in CI since the override was added), so this is a clean fix.

**Closeout:** No follow-up.

### `2026-04-07/SEC-006` (esbuild + vite arms) — Dev-only path-traversal / dev-server bypass → **STANDING**

Continued tracking in this audit as **[SEC-003](security/SEC-003.md)**. Both vulns flow through `apps/api-docs` → `vitepress ^1.6.4` → vulnerable `vite` / `esbuild`. Production exposure: none (api-docs is a static site rendered at build time; no Cloudflare Worker bundles esbuild or vite at runtime). Full fix is blocked on VitePress 2.x; current posture (wait) is appropriate.

---

## 2. Code Delta Since 2026-04-07

For context, the following commits introduced new code or changed security-relevant code paths since the prior audit:

- **New apps:** `apps/api-worker` (public read-only API at `data.xivdyetools.app`), `apps/api-docs` (VitePress static site)
- **New packages:** `packages/worker-middleware` (request-id, logger, rate-limit factory)
- **Patch 7.5 dye consolidation activation** (`913a6f0`, `3cf1eab`, `6d2dfaa`) — data only, no security-relevant code
- **Dependency bumps** (Dependabot batches on 2026-04-13, 2026-04-21, 2026-04-27)
- **Type-assertion cleanup** (`5c9a9a2`, `b79eb8f`, `de54ac0`, etc.) — lint/quality, not security
- **OAuth/JWT verifyJWT return-type simplification** (`d256fe4`) — cosmetic, no behavior change

The audit therefore concentrates on api-worker, worker-middleware, and a regression sweep of the rest of the monorepo.

---

## 3. New Attack Surface Audit — `apps/api-worker`

### 3.1 Endpoint Map

11 routes, all `GET` or `OPTIONS`:

| Route | Path | File:Line |
|-------|------|-----------|
| Health (root) | `GET /` | [`src/index.ts:76`](../../apps/api-worker/src/index.ts#L76) |
| Health | `GET /health` | [`src/index.ts:85`](../../apps/api-worker/src/index.ts#L85) |
| Dye name search | `GET /v1/dyes/search?q=…&locale=…` | [`src/routes/dyes.ts:44`](../../apps/api-worker/src/routes/dyes.ts#L44) |
| Categories | `GET /v1/dyes/categories` | [`src/routes/dyes.ts:78`](../../apps/api-worker/src/routes/dyes.ts#L78) |
| Batch lookup | `GET /v1/dyes/batch?ids=…&idType=…&locale=…` | [`src/routes/dyes.ts:93`](../../apps/api-worker/src/routes/dyes.ts#L93) |
| Consolidation groups | `GET /v1/dyes/consolidation-groups` | [`src/routes/dyes.ts:134`](../../apps/api-worker/src/routes/dyes.ts#L134) |
| Stain ID lookup | `GET /v1/dyes/stain/:stainId?locale=…` | [`src/routes/dyes.ts:167`](../../apps/api-worker/src/routes/dyes.ts#L167) |
| Single dye | `GET /v1/dyes/:id?locale=…` | [`src/routes/dyes.ts:199`](../../apps/api-worker/src/routes/dyes.ts#L199) |
| List/filter/page | `GET /v1/dyes/?…filters…` | [`src/routes/dyes.ts:236`](../../apps/api-worker/src/routes/dyes.ts#L236) |
| Closest match | `GET /v1/match/closest?hex=…&method=…` | [`src/routes/match.ts:35`](../../apps/api-worker/src/routes/match.ts#L35) |
| Within distance | `GET /v1/match/within-distance?hex=…&maxDistance=…` | [`src/routes/match.ts:97`](../../apps/api-worker/src/routes/match.ts#L97) |

No write methods. No authentication. KV is **read-only** (via `KVRateLimiter`, key prefix `api:ip:`). No service bindings ([`apps/api-worker/wrangler.toml`](../../apps/api-worker/wrangler.toml) has only `[[kv_namespaces]]` for `RATE_LIMIT`, `[vars]` for `ENVIRONMENT` / `API_VERSION`, and a custom-domain route). The blast radius for any compromise of api-worker is bounded to "read public dye data and read/write the IP rate-limit counters".

### 3.2 CORS

[`apps/api-worker/src/index.ts:44-61`](../../apps/api-worker/src/index.ts#L44-L61):

```typescript
cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept', 'X-API-Key'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset',
                  'X-Request-Id', 'X-API-Version', 'Retry-After'],
  maxAge: 86400,
  credentials: false,
})
```

`origin: '*'` paired with `credentials: false` is the canonical safe pattern for a public read-only API: browsers will refuse to send cookies or `Authorization` headers, so cross-site reads cannot be escalated to cross-site state changes. Methods are restricted to safe verbs. No CSRF risk because there are no mutating endpoints.

`maxAge: 86400` (24 h) is **noted** but is not a security finding — it's a hygiene item already filed by the 2026-04-28 deep-dive as [`architecture/ARCH-001`](architecture/ARCH-001.md). For an evolving public API, 1 hour (`3600`) is a more conservative choice; the cost of the longer cache is that CORS-policy fixes propagate slowly to clients.

### 3.3 Security Headers

[`apps/api-worker/src/index.ts:34-41`](../../apps/api-worker/src/index.ts#L34-L41) sets on every response:

- `X-Content-Type-Options: nosniff` ✓
- `X-Frame-Options: DENY` ✓
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production only) ✓

No `Content-Security-Policy` is set — appropriate for a JSON-only API with no rendered HTML.

### 3.4 Rate Limiting

[`apps/api-worker/src/middleware/rate-limit.ts`](../../apps/api-worker/src/middleware/rate-limit.ts) wires the shared `rateLimitMiddleware` factory to:

- **Backend:** `KVRateLimiter` with `keyPrefix: 'api:ip:'`, lazily constructed per-request from `c.env.RATE_LIMIT`
- **Key extractor:** `getClientIp(c.req.raw)` — inherits the hardened default (`trustXForwardedFor: false`, prefers `CF-Connecting-IP`, normalizes IPv6 case)
- **Config:** 60 requests / minute, 5 burst, 60-second window
- **Failure mode:** `fail-open` — documented and logged (the prior `BUG-016` decision)
- **Custom 429 body:** Includes `requestId`, `retryAfter`, and a hint about future API-key tier (300/min)

Verified: an attacker setting `X-Forwarded-For: <random>` cannot bypass the limiter, because [`packages/rate-limiter/src/ip.ts:60-65`](../../packages/rate-limiter/src/ip.ts#L60-L65) only consults `CF-Connecting-IP` (set by Cloudflare's edge, unforgeable). The KV key namespace is fully prefix-controlled — no user input enters the key derivation, so KV-key enumeration or collision attacks are not possible.

### 3.5 Input Validation

[`apps/api-worker/src/lib/validation.ts`](../../apps/api-worker/src/lib/validation.ts) centralizes every parser. Audit pass-through:

| Parser | Strategy | Notes |
|--------|----------|-------|
| `parseHex` | Strict regex `/^#?[0-9A-Fa-f]{6}$/` | Auto-prepends `#`, uppercases — defensive |
| `parseIntParam` | `parseInt(value, 10)` + min/max bounds | Throws on `NaN`; bounds enforced |
| `parseFloatParam` | `parseFloat` + min/max | Same |
| `parseEnumParam` | Whitelist `validValues.includes(...)` | Throws on miss; defaults are typed |
| `parseBooleanParam` | Literal match `'true' \| 'false' \| '1' \| '0'` | No type coercion — returns `undefined` for invalid |
| `parseCommaSeparatedIds` | `split(',').filter(Boolean)`, max items, integer-validate each | **Hard error** on invalid item, not silent skip |
| `parseLocale` | Whitelist `VALID_LOCALES` | Defaults to `'en'` |
| `parseMatchingMethod` | Whitelist | Defaults to `'oklab'` |
| `resolveExcludeIds` | Calls `parseCommaSeparatedIds`, then resolves to internal IDs; **silently skips** unknown IDs | The silent-skip is intentional — allows clients to pass mixed itemID/stainID/facewearID without errors |
| `resolveIdType` | Disjoint-range dispatch (`<0` → facewear, `1-125` → stain, `≥5729` → item) | All branches return; `invalid` range produces `null` from `lookupDyeByResolvedId` |

A note on [`src/routes/dyes.ts:256`](../../apps/api-worker/src/routes/dyes.ts#L256): `consolidationType` is read with a raw cast (`as 'A' | 'B' | 'C' | undefined`) and only validated by the `if (consolidationType && !VALID_CONSOLIDATION_TYPES.includes(...))` check three lines later. The cast is harmless because the validation immediately follows and rejects any non-whitelisted value, but consolidating it through `parseEnumParam` (as the rest of the file does) would be slightly cleaner. Not a finding — TypeScript-level cosmetics.

No string is ever interpolated into SQL (api-worker has no D1 binding), into shell commands (no `exec`/`spawn`), or into HTML (responses are JSON). The hex parser's regex is bounded so ReDoS is not a concern.

### 3.6 Error Handling

[`apps/api-worker/src/index.ts:115-146`](../../apps/api-worker/src/index.ts#L115-L146) implements a global `onError`:

- Structured `ApiError` instances are returned with their `code`/`statusCode`/optional `details`.
- Unstructured errors are logged via `console.error` with request-ID correlation; the response carries a generic `INTERNAL_ERROR` and includes the full stack only in `development`.
- Production responses redact `err.stack` and `err.message` (replacing the latter with `'An unexpected error occurred'`).

The 2026-04-28 deep-dive flagged this worker as missing the shared `loggerMiddleware` (filed as [`refactoring/REFACTOR-002`](refactoring/REFACTOR-002.md)). This is an **observability** issue — pre-`onError` errors will land on `console.error` rather than the structured logger — not a security vulnerability. Reproducing it here would be double-counting, so we cross-reference instead.

### 3.7 Secrets / Env

[`apps/api-worker/wrangler.toml`](../../apps/api-worker/wrangler.toml) declares **zero secrets**. No `[[secrets]]` block. No `wrangler secret put` is required to run the worker. The KV namespace IDs in the file are not sensitive (they're public-facing namespace identifiers, not credentials), and the worker uses no third-party APIs.

---

## 4. New Attack Surface Audit — `packages/worker-middleware`

The package exposes three middleware factories and one type augmentation. Audit pass-through:

### 4.1 `requestIdMiddleware` ([`packages/worker-middleware/src/request-id.ts`](../../packages/worker-middleware/src/request-id.ts))

- Default `validateFormat: true` — incoming `X-Request-ID` headers are matched against a strict UUID v4 regex; on mismatch a fresh `crypto.randomUUID()` is generated.
- Prevents log injection: an attacker cannot send `X-Request-ID: \nFAKE LOG LINE` and have it appear verbatim in structured logs.
- `getRequestId(c)` is a try/catch wrapper around `c.get('requestId')` with `'unknown'` fallback — safe in `onError` paths where the middleware may not have run.

**Verdict:** Secure-by-default. No findings.

### 4.2 `loggerMiddleware` ([`packages/worker-middleware/src/logger.ts`](../../packages/worker-middleware/src/logger.ts))

- Builds a request-scoped logger from `@xivdyetools/logger` with the request ID as correlation key.
- Reads `c.env` through type-guarded access (`typeof env?.ENVIRONMENT === 'string'`) — safe against missing or wrongly-typed env vars.
- Optional `sanitizePath` callback for redacting sensitive query strings before logging. Critical: the default `getRequestInfo` logs `url.pathname` only (without `url.search`), so query strings never leak unless the caller explicitly opts in via `sanitizePath`. Good default.

**Verdict:** Secure-by-default. No findings.

### 4.3 `rateLimitMiddleware` ([`packages/worker-middleware/src/rate-limit.ts`](../../packages/worker-middleware/src/rate-limit.ts))

- Backend can be a `RateLimiter` instance or a factory `(c) => RateLimiter` for lazy KV initialization.
- `keyExtractor` is a fully arbitrary callback — flexibility comes at a cost: see [SEC-002](security/SEC-002.md).
- `onError: 'fail-open'` (default) is documented in JSDoc; `'fail-closed'` is also supported.
- `result.backendError` triggers a `logger.warn` even when the request is allowed — good observability, no policy bypass.
- Standard `X-RateLimit-*` headers are set on every response via the shared `getRateLimitHeaders(result)`.

**Verdict:** Mostly secure. The single concern — the `keyExtractor` footgun — is a documentation hardening item filed as **[SEC-002](security/SEC-002.md)**. All current callers are correct.

### 4.4 `types.ts` — Hono module augmentation ([`packages/worker-middleware/src/types.ts`](../../packages/worker-middleware/src/types.ts))

- `declare module 'hono' { interface ContextVariableMap { requestId: string; logger: ExtendedLogger; } }` — eliminates the prior `Context<any, any, any>` antipattern that the 2026-04-07 audit's `BUG-003` flagged.
- `getRequestId`/`getLogger` still take `Context<any, any, any>` for safety in error-handler scenarios where the type may not flow correctly. This is annotated and limited in scope.

**Verdict:** No findings; an improvement over the prior pattern.

---

## 5. Dependency Posture Delta

### 5.1 `pnpm audit` Result (2026-04-28)

```
2 vulnerabilities found
Severity: 2 moderate
```

Both are dev-only via `apps/api-docs > vitepress > vite > esbuild`. See [SEC-003](security/SEC-003.md) for full detail.

### 5.2 Production Dependency Versions (Spot Check)

| Package | Version | Apps | Posture |
|---------|---------|------|---------|
| `hono` | `^4.12.15` | api-worker, discord-worker, moderation-worker, oauth, og-worker, presets-api, universalis-proxy | ✅ Above the 4.11.4 cut-off for the JWT algorithm-confusion CVE (`2026-04-07/FINDING-004`) |
| `wrangler` | `^4.85.0` | All workers (dev) | ✅ Above the 4.59.1 cut-off for the OS command-injection CVE (`2026-04-07/FINDING-005`) |
| `discord-interactions` | `^4.4.0` | moderation-worker, packages/auth | ✅ |
| `vite` | `^8.0.8` (web-app), `^8.0.10` (maintainer) | Production builds | ✅ Above 6.4.1; not the version VitePress pins |
| `vitepress` | `^1.6.4` | api-docs only | ⚠️ See [SEC-003](security/SEC-003.md) |

**No new production runtime dependencies were added since 2026-04-07.** All workspace packages continue to use `workspace:*`.

### 5.3 Active `pnpm.overrides`

[`package.json:23-27`](../../package.json#L23-L27):

```json
"pnpm": {
  "overrides": {
    "typescript": "^5.9.3",
    "rollup": ">=4.59.0"
  }
}
```

The `rollup` override is the canonical fix for the 2026-04-07 high-severity dev-tool finding and is verified effective (no `rollup` line in current `pnpm audit`).

---

## 6. Cross-Cutting Regression Sweep

| Check | Result |
|-------|--------|
| `eval(`, `new Function(`, `setTimeout('string')` across the monorepo | ✅ None found |
| Node `crypto.createHmac` / `createHash` in worker code | ✅ None — Web Crypto (`crypto.subtle`) used throughout |
| `Math.random()` in security-relevant paths (token, ID, secret) | ✅ None — `crypto.randomUUID()` used; `Math.random` only appears in test mocks |
| `innerHTML` / `outerHTML` / `document.write` in `apps/web-app/src` | Mostly compliant with the documented "static SVG icons OK / textContent for user data" rule. **One violation:** [SEC-001](security/SEC-001.md) |
| `innerHTML` in `apps/maintainer/src` | Static templates only, no user-data interpolation found |
| Security-related TODO/FIXME/HACK comments | ✅ None — no auth/secret/token/csrf/xss TODOs |
| Hardcoded secrets in source | ✅ None — `wrangler.toml` placeholders only document required secret names |
| New service bindings since 2026-04-07 | None — api-worker has no service bindings, no other workers added bindings |

The web-app's [`auth-button.ts`](../../apps/web-app/src/components/auth-button.ts) has additional `innerHTML` uses at lines 97, 109, 239 that interpolate `LanguageService.t(...)` strings into HTML. Those are **NOT** flagged because the i18n strings are project-controlled, ship in the bundle, and are reviewed at PR time. If a future change ever sources locale strings from a non-project origin (e.g., a translation API at runtime), that decision should re-open the question.

---

## 7. Threat Model Delta

| Threat | 2026-04-07 risk | 2026-04-28 risk | Notes |
|--------|-----------------|-----------------|-------|
| SQL injection | NONE | NONE | api-worker has no DB; presets-api unchanged |
| XSS in web-app | VERY LOW | VERY LOW | One new `innerHTML` site flagged ([SEC-001](security/SEC-001.md)) — defense-in-depth fix |
| XSS in api-worker | N/A | NONE | JSON-only responses |
| CSRF | VERY LOW | VERY LOW | api-worker is GET-only with `credentials: false` |
| JWT manipulation | NONE | NONE | No JWT-handling code changed |
| Rate-limit bypass | LOW | LOW | New api-worker inherits hardened `getClientIp`; key derivation prefix-controlled. Footgun in shared middleware filed as [SEC-002](security/SEC-002.md) |
| Supply chain | LOW (3 dev-only) | LOW (2 dev-only) | rollup arm closed; esbuild + vite remain blocked by VitePress 1.x |
| Service-binding impersonation | LOW | LOW | No new bindings; existing workers unchanged |
| Account takeover | LOW | LOW | OAuth/PKCE code unchanged |
| Content abuse | LOW | LOW | Moderation engine unchanged |
| Data breach | VERY LOW | VERY LOW | Stored data unchanged (Discord public profile only) |
| **NEW:** Public-API enumeration | — | LOW | api-worker ID ranges are public game data; rate limiter gates volume |
| **NEW:** API cost amplification | — | LOW | 60 req/min IP ceiling + edge `Cache-Control: public, max-age=3600, s-maxage=86400` on all dye routes |

---

## 8. Recommendations

### Immediate (this sprint)

1. **[SEC-001](security/SEC-001.md)** — Replace the `innerHTML` template at `auth-button.ts:222` with `createElement` + `textContent` calls. Trivial change (~10 lines), aligns code with the project's documented XSS rule, removes upstream-trust dependency on XIVAuth's character-name validation. Defense-in-depth.

### Short-term (next release cycle)

2. **[SEC-002](security/SEC-002.md)** — Strengthen the `keyExtractor` JSDoc in `worker-middleware/rate-limit.ts` with an explicit "do not derive keys from `X-Forwarded-For`" warning, *or* default `keyExtractor` to `(c) => getClientIp(c.req.raw)` so callers must opt out. Either change prevents the next worker author from accidentally re-introducing `BUG-018`.
3. Cross-reference: act on [`architecture/ARCH-001`](architecture/ARCH-001.md) (api-worker CORS `maxAge: 86400` → consider `3600`) and [`refactoring/REFACTOR-002`](refactoring/REFACTOR-002.md) (api-worker missing `loggerMiddleware`). Neither is a security finding, but both improve incident-response and policy-evolution agility.

### Long-term (quarterly review)

4. **[SEC-003](security/SEC-003.md)** — Re-check VitePress 2.x release status quarterly. A single dependency bump closes the remaining two `pnpm audit` lines.
5. Consider migrating XIVAuth-stored auth tokens from `localStorage` to `httpOnly` cookies as a defense-in-depth alternative to the current strict-CSP approach. Tracking item carried over from 2026-04-07.

---

## 9. Conclusion

The 2026-04-07 audit set a **STRONG** posture; the 2026-04-28 audit confirms it. One prior-finding closure (`SEC-002` modal `innerHTML`), one partial-fix verification (rollup arm of `SEC-006` closed via override), and three new findings — all LOW or INFO — define the delta. The two new code surfaces (`api-worker`, `worker-middleware`) are well-built and don't move the threat model in a meaningful direction.

| Indicator | Status |
|-----------|--------|
| Critical/high in production code | **0** |
| New attack surfaces audited | api-worker, worker-middleware (both pass) |
| Prior findings closed this cycle | 2 (SEC-002, SEC-006-rollup) |
| Standing dev-only items | 1 (SEC-003 — VitePress chain) |
| Defense-in-depth fixes identified | 2 (SEC-001 inline DOM, SEC-002 JSDoc/default) |

**Security Status:** ✅ **PASS** — APPROVED FOR PRODUCTION USE.

---

**Last Updated:** 2026-04-28
