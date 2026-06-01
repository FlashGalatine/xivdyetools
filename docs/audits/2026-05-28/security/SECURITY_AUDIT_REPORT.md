# Security Audit Report — XIV Dye Tools

## Executive Summary

- **Project:** XIV Dye Tools monorepo (12 packages + 11 apps)
- **Audit Date:** 2026-05-28
- **Overall Risk Level:** **LOW**
- **Method:** Static review only. No code was modified.

The ecosystem demonstrates **mature, defense-in-depth security engineering**. The
authentication primitives are centralized and hardened, all database access is
parameterized, the public-facing proxy is SSRF-resistant, and CORS is allowlisted on the
data-handling workers. There are **no critical or high-severity findings.** Every finding
below is a hardening, consistency, or hygiene improvement.

## Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 3 |
| Informational | 3 |

| ID | Title | Severity |
|----|-------|----------|
| [FINDING-001](findings/FINDING-001.md) | OAuth state signature compared with non-constant-time `!==` | LOW |
| [FINDING-002](findings/FINDING-002.md) | oauth `verifyJWT` doesn't explicitly pin `alg=HS256`; duplicates shared auth lib | LOW |
| [FINDING-003](findings/FINDING-003.md) | JWT revocation check fails open on KV error | INFO |
| [FINDING-004](findings/FINDING-004.md) | discord-worker applies wildcard CORS to all routes | LOW |
| FINDING-005 | 3 moderate dev-only dependency advisories (vite/esbuild/qs) | INFO |
| FINDING-006 | oauth dev D1 `database_id` placeholder in wrangler.toml | INFO |

---

## What Was Checked (and Found Clean)

### ✅ Secret management
Repo-wide regex scan for hardcoded credentials returned **only test fixtures**
(`'test-signing-secret'`, `'mock-bot-token'`, etc.), several already annotated
`// pragma: allowlist secret`. No `.dev.vars` or `.env` files are committed. No real secret
values in any `wrangler.toml` (`[vars]` carry only IDs/URLs; all secrets are injected via
`wrangler secret put`).

### ✅ SQL injection (presets-api — the only D1 owner)
Every query uses `db.prepare(sql).bind(...)` with parameter placeholders. Specifically:
- **LIKE search** escapes wildcards: `name LIKE ? ESCAPE '\'` with an `escapeLikePattern`
  helper ([preset-service.ts:145-148](../../../apps/presets-api/src/services/preset-service.ts#L145)).
- **ORDER BY** is a `switch`-based **whitelist** mapping `sort` → a fixed clause; user input
  never reaches the SQL string ([preset-service.ts:160-169](../../../apps/presets-api/src/services/preset-service.ts#L160)).
- **UPDATE** builds `setClauses` from **hardcoded column names**, values bound.
- The two "dynamic" queries in `moderation.ts` select between two **static string literals**
  via a boolean — no interpolation.
- Multi-statement writes use `db.batch()`; votes use `INSERT … ON CONFLICT DO NOTHING`.

**Conclusion: no SQL injection surface.**

### ✅ SSRF (universalis-proxy)
The only worker that fetches an external URL from user input. The upstream URL is composed
solely from a fixed env base (`UNIVERSALIS_API_BASE`) plus:
- `datacenter` validated against `isValidDatacenterOrWorld()` **whitelist**,
- `itemIds` validated by `^[\d,]+$`, then count (1-100) and per-ID range (1-1,000,000).

There is no way to redirect the fetch to an arbitrary/internal host. Additional controls:
per-IP rate limiting (`CF-Connecting-IP`), a 5 MiB upstream response cap, and request
coalescing. **No SSRF.**

### ✅ Authentication primitives (`@xivdyetools/auth`)
- **JWT:** HS256 **pinned** (`if (header.alg !== 'HS256') return null`), blocking
  alg-confusion / `alg:none`; signature via timing-safe `crypto.subtle.verify`; **mandatory
  `exp` and `sub`** claims.
- **timingSafeEqual:** native `crypto.subtle.timingSafeEqual` with an XOR fallback; both
  inputs zero-padded to equal length so loop time can't leak length; returns false if the
  original lengths differed.
- **HMAC:** module-level `CryptoKey` LRU cache; `createHmacKey` enforces a ≥32-byte key.
- **Bot signature:** HMAC over `timestamp:userId:userName` with 5-min max age + 1-min future
  skew tolerance.
- **Discord Ed25519:** `Content-Length` pre-check, required-header check, post-read body
  length check, then `verifyKey`.

### ✅ OAuth worker (PKCE + state + JWT)
- **PKCE-only** (no implicit grant); `code_verifier` validated to RFC 7636 and **only ever
  accepted in the POST body**, never a query param (can't leak via redirects/logs).
- **Signed state** (HMAC over base64url JSON) with `exp`; unsigned states accepted **only in
  `ENVIRONMENT === 'development'`** ([callback.ts:63](../../../apps/oauth/src/handlers/callback.ts#L63), BUG-013) — production rejects them.
- **Open redirect prevented:** `redirect_uri` parsed and matched against an **origin
  allowlist**; `return_path` is only appended as a query param to the *already-validated*
  URL, so it cannot change the destination origin.
- **Token exchange** forces the canonical worker callback `redirect_uri` (ignores a
  client-supplied mismatch); **request timeouts** (10s token, 5s userinfo).
- **JWT revocation** via per-token `jti` + KV blacklist with TTL = remaining lifetime.
- **Generic production errors** (no stack/`err.message` leakage).

### ✅ CORS, body & header hardening
- **Allowlisted CORS** on presets-api, oauth, universalis-proxy (dev-only localhost
  exceptions). Disallowed origins are not reflected back.
- **Body/JSON limits:** presets-api 100 KB + JSON depth limit; oauth 10 KB; discord-worker
  webhook caps 10 KB; Discord interactions 100 KB.
- **Security headers** (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Strict-Transport-Security`) on discord-worker and presets-api responses.
- **Rate limiting** everywhere user-facing (per-IP; Upstash/DO-backed where distributed
  consistency matters, in-memory elsewhere).
- **User content sanitization** (`sanitizePresetName`/`Description` strip control chars,
  invisible Unicode, Zalgo before embedding in Discord).

---

## Detailed Findings (Low / Info)

See `findings/FINDING-00X.md` for FINDING-001..004. Two informational items:

### FINDING-005 — Dev-only dependency advisories (INFO)
`pnpm audit`: **0 critical, 0 high, 3 moderate** (`evidence/pnpm-audit.json`):
| Package | Advisory | Reaches production? |
|---------|----------|---------------------|
| esbuild ≤0.24.2 | dev-server request forgery | No — `api-docs` build tool only |
| vite ≤6.4.1 | path traversal in optimized-deps `.map` | No — `api-docs` build tool only |
| qs 6.11.1-6.15.1 | `qs.stringify` DoS | No — transitive via `express` in the **local** `maintainer` tool |
None are in a deployed Cloudflare Worker's runtime path. **Recommendation:** bump on the next
routine maintenance (`pnpm up vitepress vite esbuild`, refresh maintainer's express). Not urgent.

### FINDING-006 — Config hygiene (INFO)
`apps/oauth/wrangler.toml:66` has `database_id = "TODO_RUN_WRANGLER_D1_CREATE"` for the dev
env. Harmless (dev-only placeholder) but should be resolved or removed so a deploy to that
env fails loudly rather than against a non-existent DB. Confirm the production env block has a
real `database_id`.

---

## Remediation Priority

1. **FINDING-001** — switch the state HMAC comparison to `timingSafeEqual`/`subtle.verify` (tiny, high-consistency).
2. **FINDING-002** — add explicit `alg` pinning in oauth `verifyJWT`; plan consolidation onto `@xivdyetools/auth`.
3. **FINDING-004** — scope discord-worker CORS off wildcard.
4. **FINDING-005/006** — fold into routine maintenance.
5. **FINDING-003** — keep fail-open but document it and add an observability hook.

## Recommendations (program-level)

- Add a CI secret scanner (e.g. gitleaks/trufflehog) to guard the already-clean state.
- Track the **single-JWT-verifier** goal: presets-api uses `@xivdyetools/auth`; migrating
  oauth onto it removes the only duplicated security primitive in the codebase.
- Keep `pnpm audit` in CI with a high/critical gate (moderate dev-only can warn, not fail).

> No code was modified during this audit. Get explicit approval before applying any fix.
