# Shared Packages Deep-Dive Analysis — 2026-07-18

Scope: `packages/` — types, crypto, logger, auth, rate-limiter, worker-middleware, color-blending, svg, bot-logic, bot-i18n, test-utils. (`packages/core` excluded — covered by a separate agent.)

All line numbers verified against source on 2026-07-18. Paths are relative to `xivdyetools/`.

---

## Prior findings status (2026-05-28 audit)

### REFACTOR-001 — Dual JWT verifiers (packages/auth vs apps/oauth)

**Status: PARTIALLY RESOLVED — consumers consolidated, oauth verifier still duplicated (but hardened to parity).**

- Consumers now on the shared package: `apps/presets-api/src/middleware/auth.ts:10` imports `verifyJWT` and `verifyBotSignature` from `@xivdyetools/auth`; `apps/discord-worker` and `apps/moderation-worker` also depend on `@xivdyetools/auth` (`apps/presets-api/package.json:22`, `apps/discord-worker/package.json:28`, `apps/moderation-worker/package.json:23`) and use its Discord Ed25519 verification.
- `apps/oauth` still ships its own hand-rolled verifier in `apps/oauth/src/services/jwt-service.ts` (`getSigningKey` L37-48, `verifyJwtData` L66-78, `verifyJWT` L204-250, `verifyJWTSignatureOnly` L277-316). `apps/oauth/package.json` has **no** `@xivdyetools/auth` dependency; it only imports base64url helpers from `@xivdyetools/crypto` (jwt-service.ts:10-15).
- Divergence has been closed by hand, not by consolidation: the oauth verifier now enforces HS256 (L223), requires `sub` (L244-247), requires `exp` (L240), and uses constant-time `crypto.subtle.verify` (L77) — each tagged with `// REFACTOR-001` comments referencing the shared package.
- Legitimate blockers to full consolidation remain: oauth's verifier has a throwing API (vs null-returning), plus `jti` revocation (`isTokenRevoked`/`revokeToken`/`verifyJWTWithRevocationCheck`, L351-409) and a wider `JWTPayload` (iss/jti/auth_provider) that `packages/auth` does not model.
- Residual drift risk: two implementations must be kept in behavioral lockstep manually. Note also that `packages/auth`'s `JWTPayload` declares `type: 'access' | 'refresh'` (`packages/auth/src/jwt.ts:35-36`) while oauth-issued tokens carry no `type` claim at all — the shared type definition does not match the actual token shape (see BUG-013).

**Recommendation:** extend `packages/auth` with the revocation helpers and a configurable claim set, then delete the oauth copy; or explicitly document oauth's verifier as the intentional exception.

---

## BUGS

### BUG-001 — `getOAuthLimit` prefix shadowing gives `/auth/xivauth/callback` the wrong (stricter) limit
- **Kind:** BUG
- **Severity:** HIGH
- **Location:** `packages/rate-limiter/src/presets/configs.ts:19-45`
- **Description:** `getOAuthLimit` iterates `Object.entries(OAUTH_LIMITS)` in insertion order and returns the first `path.startsWith(key)` match. `'/auth/xivauth'` (10 req/min) is inserted at line 22, *before* `'/auth/xivauth/callback'` (20 req/min) at line 26. Any request to `/auth/xivauth/callback` therefore matches the `'/auth/xivauth'` prefix first and gets the stricter login-initiation limit (10/min) instead of the intended callback limit (20/min). The `'/auth/xivauth/callback'` entry is unreachable dead config.
- **Evidence:**
  ```ts
  export const OAUTH_LIMITS: Record<string, RateLimitConfig> = {
    '/auth/discord': { maxRequests: 10, windowMs: 60_000 },
    '/auth/xivauth': { maxRequests: 10, windowMs: 60_000 },   // matches first…
    '/auth/callback': { maxRequests: 20, windowMs: 60_000 },
    '/auth/xivauth/callback': { maxRequests: 20, windowMs: 60_000 }, // …never reached
    ...
  };
  export function getOAuthLimit(path: string): RateLimitConfig {
    for (const [key, config] of Object.entries(OAUTH_LIMITS)) {
      if (key !== 'default' && path.startsWith(key)) return config;
    }
  ```
  The same shadowing is replicated in app code: `apps/oauth/src/services/rate-limit.ts:51-55` checks `path.startsWith('/auth/xivauth')` before the callback branch, so the callback branch for xivauth is likewise dead.
- **Repro:** `getOAuthLimit('/auth/xivauth/callback')` → returns `{ maxRequests: 10 }`. Expected 20. XIVAuth users completing OAuth are cut off at half the intended budget; bursty legitimate callback traffic (retries, double-redirects) 429s prematurely.
- **Why it evades testing:** unit tests exercise exact paths against expected configs one key at a time; the bug only shows when a longer key shares a prefix with an earlier shorter key, and the returned config is still a *valid* config — nothing throws.
- **Fix:** match longest prefix first: `Object.entries(OAUTH_LIMITS).sort((a, b) => b[0].length - a[0].length)` (or check exact match before prefix). Apply the same fix to `apps/oauth/src/services/rate-limit.ts::getConfigForPath`.

### BUG-002 — KVRateLimiter "optimistic concurrency" is not implemented: version metadata never compared; verification loop can double-count
- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `packages/rate-limiter/src/backends/kv.ts:194-270` (`increment`), 202-206, 222-235
- **Description:** `increment()` reads the current entry with `getWithMetadata` and captures `currentVersion` (L206), then unconditionally `put`s with `version: currentVersion + 1` (L222-225). **The version is written but never checked** — there is no compare-and-swap, so two concurrent increments that both read `count: 5` both write `count: 6` (classic lost update; limit under-counts and the effective limit is higher than configured). Worse, the "verification" read-back (L228-235: retry unless `verified.count >= entry.count`) can cause **over-counting**: if a concurrent writer resets the window (`count: 1`, L212) or KV serves a stale read, verification fails and the loop re-runs the entire read-modify-write, incrementing a *second* time for the same request.
- **Evidence:**
  ```ts
  const currentVersion = result.metadata?.version ?? 0;   // read…
  ...
  await this.kv.put(kvKey, JSON.stringify(entry), {
    expirationTtl: ttl,
    metadata: { version: currentVersion + 1 },            // …written, never compared
  });
  const verification = await this.kv.get(kvKey);
  if (verification) {
    const verified: KVEntry = JSON.parse(verification) as KVEntry;
    if (verified.count >= entry.count) return;            // lost updates pass this check
  }
  // retry → full re-read + re-put → double increment for this request
  ```
- **Repro:** two isolates call `check(key, cfg)` simultaneously with existing count 5 → both `put` 6 → both verify `6 >= 6` → final count 6, not 7. Conversely: isolate A writes `count: 6`; isolate B's fresh-window write `count: 1` lands between A's put and A's verification read → A sees `1 < 6`, retries, and writes `count: 2` — A's single request counted twice.
- **Why it evades testing:** mock KV (`packages/test-utils/src/cloudflare/kv.ts`) is a synchronous Map with no cross-isolate concurrency or staleness; races only manifest under real distributed load.
- **Fix:** either (a) accept and document the fixed-window KV limiter as best-effort and delete the version metadata and the verification read (they add cost, not correctness — see OPT-001), or (b) move to Durable Objects/Upstash for strict limits (the class doc already recommends this). Do not keep code shaped like OCC that isn't.

### BUG-003 — MemoryRateLimiter cleanup uses the *current request's* window to purge ALL keys (cross-config data loss)
- **Kind:** BUG
- **Severity:** MEDIUM (latent — all current preset configs use 60s windows)
- **Location:** `packages/rate-limiter/src/backends/memory.ts:110-124`, `164-179`
- **Description:** `check()` triggers `cleanupOldEntries(config.windowMs * 2)` every N requests and on LRU pressure, where `config` is the config of *this* request. `cleanupOldEntries` then iterates **every key in the map** and deletes timestamps older than `now - 2 * windowMs`. If one shared `MemoryRateLimiter` instance serves configs with different windows (the API is explicitly designed for per-call configs — `check(key, config)`), a request governed by a short window (e.g. 60s) silently deletes history for keys governed by a long window (e.g. 1h), resetting their limits.
- **Evidence:**
  ```ts
  if (this.requestCount % this.cleanupInterval === 0) {
    this.cleanupOldEntries(config.windowMs * 2);   // current request's window applied to ALL keys
  }
  ```
- **Repro:** one limiter instance; endpoint A `{windowMs: 3_600_000, maxRequests: 5}`, endpoint B `{windowMs: 60_000, maxRequests: 100}`. A client exhausts A's 5/hour. 100 requests to B later, cleanup runs with maxAge 120s and deletes A's timestamps → the client gets 5 more requests on A.
- **Why it evades testing:** tests exercise one config per limiter instance; the deployed apps (`apps/oauth/src/services/rate-limit.ts:35`, `apps/presets-api/src/middleware/rate-limit.ts:17`) currently use uniform 60s windows, so nothing misbehaves today — it breaks the day someone adds a long-window preset.
- **Fix:** track the max `windowMs` seen per key (or store `windowMs` alongside the timestamp array) and clean each key against its own window; or make maxAge a constructor option decoupled from per-call configs.

### BUG-004 — Logger context redaction is exact, case-sensitive key match — trivially bypassed by common key spellings
- **Kind:** BUG
- **Severity:** MEDIUM (security/observability)
- **Location:** `packages/logger/src/core/base-logger.ts:178-211` (esp. 183-187); `packages/logger/src/constants.ts:14-44`
- **Description:** `redactSensitiveFields` does `if (field in redacted)` — an exact, case-sensitive lookup against the redact list. The list contains only specific lowercase spellings (`password`, `token`, `apiKey`, `access_token`, …; worker extras are snake_case only: `jwt_secret`, `bot_api_secret`, …). Any of these leak unredacted: `Token`, `Authorization` (canonical header casing), `jwtSecret`, `botApiSecret`, `sessionToken`, `userToken`, `TOKEN`, `Password`. Additionally the recursion depth cap of 3 (L179, 190) means a secret nested 4+ levels deep is emitted verbatim.
- **Evidence:**
  ```ts
  for (const field of fieldsToRedact) {
    if (field in redacted) {           // exact case-sensitive match only
      redacted[field] = '[REDACTED]';
    }
  }
  ```
- **Repro:** `logger.error('login failed', err, { Authorization: 'Bearer eyJ…' })` → JSON log line contains the full bearer token. `logger.info('cfg', { config: { auth: { discord: { jwtSecret: 's3cret' } } } })` → depth 4, emitted verbatim (and `jwtSecret` wouldn't match at any depth).
- **Why it evades testing:** `types.test.ts` asserts redaction for the exact listed keys; no test uses alternate casings, camelCase worker secrets, or deep nesting.
- **Fix:** normalize each key with `key.toLowerCase().replace(/[_-]/g, '')` and compare against a normalized set (also collapses the `api_key`/`apiKey` duplication); consider substring matching for `token`/`secret`/`password` suffixes; raise or remove the depth cap (cycle-guard with a `WeakSet` instead).

### BUG-005 — `sanitizeErrorMessage` bypassed by JSON-style keys and `key = value` spacing
- **Kind:** BUG
- **Severity:** MEDIUM (security/observability)
- **Location:** `packages/logger/src/core/base-logger.ts:140-170`
- **Description:** All key/value patterns require the separator to *immediately* follow the key name: `` new RegExp(`token[=:]\\s*${V}`) ``. Two very common shapes don't match:
  1. **JSON in error messages** — upstream APIs frequently echo request/response bodies into error strings: `Request failed: {"token":"eyJ…"}`. Here `token` is followed by `"`, not `[=:]`, so nothing is redacted.
  2. **Space before separator** — `token = eyJ…` (`token` followed by a space) is not matched; the `\s*` allows space only *after* the separator.
- **Evidence:**
  ```ts
  const V = `(?:["']([^"']*?)["']|[^\\s,;]+)`;
  ...
  .replace(new RegExp(`token[=:]\\s*${V}`, 'gi'), 'token=[REDACTED]')
  ```
  `'HTTP 401: {"access_token":"SECRET","refresh_token":"SECRET2"}'` → unchanged (keys are `access_token"` — quote blocks the match).
- **Repro:** throw `new Error('Discord API error: {"access_token":"abc123",...}')` in a worker and log it via `logger.error(...)` with default `sanitizeErrors: true`; the token appears verbatim in Cloudflare logs.
- **Why it evades testing:** the existing LOG-ERR-001 tests cover `key=value` and quoted-value forms; nobody tested a JSON-serialized body inside a message, which is precisely how third-party API clients format errors.
- **Fix:** allow an optional quote and optional whitespace around the separator: `` `["']?token["']?\\s*[=:]\\s*${V}` `` (and same for the other keys), or run a dedicated JSON-shaped pass `/"(token|secret|password|[a-z_]*(?:token|secret|key))"\s*:\s*"[^"]*"/gi`.

### BUG-006 — Browser preset sends raw, unredacted context and error to the error tracker, bypassing the entire redaction pipeline
- **Kind:** BUG
- **Severity:** MEDIUM (security — third-party exfiltration path)
- **Location:** `packages/logger/src/presets/browser.ts:106-127`
- **Description:** `createBrowserLogger` monkey-patches `logger.error`/`logger.warn` so production errors also go to the configured `errorTracker` (e.g. Sentry). The console path goes through `BaseLogger.createEntry → mergeContext → redactSensitiveFields` — but the tracker path passes the **caller's raw `context` object** (and the raw error with unsanitized message/stack) straight to `errorTracker.captureException(error, context)`. Redact fields and message sanitization never run for data leaving the origin.
- **Evidence:**
  ```ts
  logger.error = (message, error?, context?) => {
    originalError(message, error, context);        // console path: redacted
    if (error instanceof Error) {
      errorTracker.captureException(error, context); // tracker path: RAW context + raw error
    }
  ```
- **Repro:** `logger.error('auth failed', err, { token: userJwt })` in production → console shows `token: '[REDACTED]'`, Sentry event contains the real JWT.
- **Why it evades testing:** logger tests assert on the console/JSON output, which *is* redacted; the tracker is a user-supplied callback that tests stub without inspecting payload secrecy.
- **Fix:** run `redactSensitiveFields`/`sanitizeErrorMessage` on the payload before invoking the tracker (expose a protected `redact(context)` on `BaseLogger`, or route tracker calls through `createEntry` and forward `entry.context`/`entry.error`).

### BUG-007 — UpstashRateLimiter reports `resetAt`/`retryAfter` as a full window regardless of actual remaining TTL
- **Kind:** BUG
- **Severity:** LOW-MEDIUM (wrong client-facing headers)
- **Location:** `packages/rate-limiter/src/backends/upstash.ts:66-90` (esp. 82, 89)
- **Description:** The window is fixed at the *first* request (`EXPIRE … NX`), but every subsequent `check()` computes `resetAt = new Date(Date.now() + ttlSeconds * 1000)` and, when blocked, `retryAfter: ttlSeconds` — i.e. always a full `windowMs` from *now*, not the key's actual remaining TTL. `X-RateLimit-Reset` / `Retry-After` (via `getRateLimitHeaders`, `packages/rate-limiter/src/headers.ts:37-51`) therefore overstate the wait by up to a full window; a client blocked 55s into a 60s window is told to wait 60s instead of 5s, and the advertised reset time drifts forward on every request.
- **Evidence:**
  ```ts
  const resetAt = new Date(Date.now() + ttlSeconds * 1000);  // ignores actual TTL
  ...
  retryAfter: allowed ? undefined : ttlSeconds,              // always full window
  ```
- **Repro:** with `{maxRequests: 2, windowMs: 60_000}`: t=0 req1 (TTL set), t=50s req2, t=55s req3 blocked → `retryAfter: 60`, real unblock in 5s.
- **Why it evades testing:** tests assert `retryAfter` equals the configured window (which matches the buggy formula) rather than the key's TTL.
- **Fix:** add `pipeline.ttl(redisKey)` as a third pipelined command and use its result: `const remainingTtl = results[2] > 0 ? results[2] : ttlSeconds; resetAt = new Date(Date.now() + remainingTtl * 1000); retryAfter = remainingTtl;` — no extra round-trip (same pipeline).

### BUG-008 — Emoji in SVG text that the bundled fonts cannot render (tofu in generated PNGs)
- **Kind:** BUG
- **Severity:** LOW-MEDIUM (user-visible rendering defect)
- **Location:** `packages/svg/src/preset-swatch.ts:40-47` (`CATEGORY_DISPLAY` icons), `:137-148` (icon prepended to title); `packages/svg/src/random-dyes-grid.ts:79` (default title `'🎲 Random Dyes'`)
- **Description:** The package's own code documents that the bundled fonts (Space Grotesk / Onest / Habibi / Noto subsets) lack emoji glyphs under resvg — `packages/svg/src/budget-comparison.ts:421`: *"(no emoji/Δ — fonts lack those glyphs in resvg)"*. Yet `generatePresetSwatch` unconditionally renders `` `${categoryDisplay.icon} ${name}` `` (⚔️ 🏛️ 🍂 🎉 🎨 🌐) into the card title, and `generateRandomDyesGrid`'s default title contains 🎲. These render as tofu/blank boxes in the PNGs the Discord bot posts. `apps/discord-worker/src/handlers/commands/preset.ts:853` calls `generatePresetSwatch` with these categories in production.
- **Repro:** render any preset swatch through the discord-worker resvg pipeline; the title shows a missing-glyph box before the preset name.
- **Why it evades testing:** SVG unit tests assert on the SVG *string* (emoji present and escaped correctly); the glyph gap only appears after rasterization, which tests don't perform.
- **Fix:** keep `CATEGORY_DISPLAY` icons for Discord message text (where they render fine) but strip icons from SVG text: drop the icon from the title line in `generatePresetSwatch`, and change the `random-dyes-grid` default title to `'Random Dyes'` (callers can pass localized titles).

### BUG-009 — `JWTPayload.type` (`'access' | 'refresh'`) declared but never validated anywhere
- **Kind:** BUG
- **Severity:** LOW (latent token-confusion)
- **Location:** `packages/auth/src/jwt.ts:35-36` (declaration), `153-176` (`verifyJWT` — no type check); consumer: `apps/presets-api/src/middleware/auth.ts:29, 39-49`
- **Description:** The shared `JWTPayload` models a `type: 'access' | 'refresh'` discriminator, but `verifyJWT` accepts any signed, unexpired token with a `sub` — it never checks `type`. No consumer checks it either (presets-api marks it optional and ignores it). Today this is only latent because the oauth issuer doesn't emit a `type` claim at all (`apps/oauth/src/services/jwt-service.ts:99-110, 158-178` — payloads have no `type`), which also means the shared type definition misdescribes real tokens. If refresh tokens with longer lifetimes are ever issued as JWTs under the same secret (which the `type` field and `verifyJWTSignatureOnly`'s refresh-token docstring clearly anticipate), they will be accepted as access tokens by every `verifyJWT` call site.
- **Fix:** either remove `type` from `JWTPayload` until it exists in real tokens, or add `expectedType?: 'access' | 'refresh'` to `verifyJWT` and enforce it when the claim is present. Document the invariant.

### BUG-010 — `verifyJWTSignatureOnly` max-age check silently skipped when `iat` is missing or 0
- **Kind:** BUG
- **Severity:** LOW
- **Location:** `packages/auth/src/jwt.ts:213-220`
- **Description:** `if (maxAgeMs !== undefined && payload.iat)` — a token with no `iat` claim (or `iat: 0`) bypasses the age limit entirely while still passing signature and `sub` checks. Since this function deliberately ignores `exp`, a signed token without `iat` is accepted *forever* even when the caller asked for a 7-day cap. The issuer always sets `iat` today, so exploitation requires a signing-oracle elsewhere, but the guard inverts the caller's intent.
- **Evidence:**
  ```ts
  if (maxAgeMs !== undefined && payload.iat) {   // no iat → no age check at all
    const tokenAge = now - payload.iat * 1000;
    if (tokenAge > maxAgeMs) return null;
  }
  ```
- **Fix:** when `maxAgeMs` is specified, treat missing/non-numeric `iat` as a failure: `if (maxAgeMs !== undefined) { if (typeof payload.iat !== 'number') return null; ... }`.

### BUG-011 — Discord request body limit measured in UTF-16 code units, not bytes
- **Kind:** BUG
- **Severity:** LOW
- **Location:** `packages/auth/src/discord.ts:88-97`
- **Description:** After `await request.text()`, the size check is `body.length > maxBodySize`. `String.length` counts UTF-16 code units; CJK characters are 3 bytes each in UTF-8 and astral characters 4 bytes / 2 units. A payload of 100,000 CJK chars (~300 KB) passes the "100KB" check. The Content-Length pre-check (L67) catches honest clients, but Content-Length is explicitly treated as spoofable (comment L90). Also note the whole body is buffered before the size check, so the limit is a post-hoc filter, not memory protection — Workers' own limits are the real backstop.
- **Fix:** compare bytes: `new TextEncoder().encode(body).byteLength > maxBodySize`, or check `request.body` via a counting stream reader before decoding.

### BUG-012 — `truncateText` can split surrogate pairs, emitting a broken character before the ellipsis
- **Kind:** BUG
- **Severity:** LOW
- **Location:** `packages/svg/src/base.ts:309-312`
- **Description:** `text.slice(0, maxLength - 1)` operates on UTF-16 units. If position `maxLength - 1` lands inside a surrogate pair (emoji in community preset names/descriptions, rare CJK-extension ideographs), the output contains a lone surrogate rendered as U+FFFD in the PNG. Callers: preset names/descriptions (`preset-swatch.ts:152, 216`), dye names (`gradient.ts:104`, `contrast-matrix.ts:197, 228`, `random-dyes-grid.ts:195`).
- **Repro:** `truncateText('Cool Preset 🎨🎨🎨', 14)` → `'Cool Preset 🎨\uD83C…'` — lone high surrogate before the ellipsis.
- **Fix:** slice by code points: `[...text].slice(0, maxLength - 1).join('') + '…'` (also makes the length semantics match `estimateTextWidth`, which already iterates code points).

### BUG-013 — worker-middleware rate-limit backend factory silently breaks stateful limiters; caught errors dropped
- **Kind:** BUG
- **Severity:** LOW (API foot-gun + observability gap)
- **Location:** `packages/worker-middleware/src/rate-limit.ts:36, 114-135`
- **Description:** Two related issues:
  1. `backend` accepts `(c) => RateLimiter` for request-time bindings (KV). If a worker passes `(c) => new MemoryRateLimiter(...)` (the factory shape gives no hint this is wrong), a **fresh limiter is constructed per request** and rate limiting is silently disabled — every check sees an empty map. Nothing warns.
  2. The `catch` around `backend.check()` (L125-135) logs `'Rate limiter backend error'` with key/path/method but **discards the caught error entirely** — no message, no stack — making backend failures (KV outages, misconfig) undiagnosable from logs.
- **Evidence:**
  ```ts
  } catch {                       // error binding dropped
    const logger = c.get('logger');
    if (logger) {
      logger.warn('Rate limiter backend error', { onError, key, path: ..., method: ... });
  ```
- **Fix:** (1) document on the `backend` option that factories must return a shared/stateless-backed instance (KV/Upstash), and/or memoize the factory result per-isolate; (2) `catch (err)` and include `error: err instanceof Error ? err.message : String(err)` in the warn context.

### BUG-014 — test-utils MockD1: `exec()` desynchronizes `_queries` from `_bindings`
- **Kind:** BUG
- **Severity:** LOW (test-infrastructure correctness)
- **Location:** `packages/test-utils/src/cloudflare/d1.ts:284-288` (also session `exec` at 308-312) vs `158-163`
- **Description:** Statement methods push to both `queries` and `bindings` in lockstep, but `exec()` pushes only to `queries`. From then on `db._bindings[i]` no longer corresponds to `db._queries[i]`, so positional assertions (`expect(db._bindings[0]).toEqual([...])`, as shown in the module's own doc example L27-28) silently check the wrong query. `enforceMaxHistory` (L158-163) then shifts both arrays while only `queries.length` exceeds the cap, skewing alignment further.
- **Fix:** `bindings.push([])` in both `exec` implementations.

### BUG-015 — `generateGradientColors(…, 1)` produces `#NaNNaNNaN`
- **Kind:** BUG
- **Severity:** LOW
- **Location:** `packages/svg/src/gradient.ts:201-214` (esp. 209)
- **Description:** `ratio = i / (stepCount - 1)` divides by zero when `stepCount === 1` → `ratio = NaN` (0/0) → `interpolateColor` rounds NaN → `NaN.toString(16)` → the literal string `#NaNNaNNaN` is returned as a color and injected into SVG fill attributes. `generateGradientBar` guards `steps.length < 2` (L58) but `generateGradientColors` is exported independently (`index.ts:40-43`) with no guard.
- **Fix:** clamp: `if (stepCount < 2) return [startColor];` (or throw, matching `generateGradientBar`).

### BUG-016 — KVRateLimiter `check()` can read one window and increment the next across a boundary
- **Kind:** BUG
- **Severity:** LOW
- **Location:** `packages/rate-limiter/src/backends/kv.ts:115-123` vs `194-197`
- **Description:** `checkOnly()` computes the KV key from `Date.now()` at T1; `increment()` recomputes from a fresh `Date.now()` at T2. If the fixed-window boundary (`Math.floor(ts / windowMs)`, L301-303) falls between T1 and T2 (KV read latency makes this window tens of ms wide), the request is judged against window N but recorded in window N+1 — the returned `remaining`/`resetAt` describe a window the increment never touched, and the first request(s) of the new window are pre-consumed. Self-corrects within one window; worth fixing because it is free to fix.
- **Fix:** compute `now` once in `check()` and pass it through to both operations (add an optional `now` parameter to `checkOnly`/`increment`).

---

## REFACTORS

### REF-001 — Match-quality thresholds duplicated 4× with inconsistent boundary semantics
- **Kind:** REFACTOR
- **Severity/Priority:** MEDIUM
- **Locations:**
  - `packages/bot-logic/src/color-math.ts:54-61` — `QUALITY_TIERS`, matched with `distance <= maxDistance` (L76)
  - `packages/svg/src/palette-grid.ts:50-68` — `MATCH_QUALITIES`, matched with `<=` (L63)
  - `packages/svg/src/palette-grid.ts:392-398` — a *second* inline copy in the same file using `<`
  - `packages/svg/src/budget-comparison.ts:163-169` — `getDistanceQualityKey` using `<`
- **Description:** The 0/10/25/50 RGB-distance tiers exist in four places with two different comparison operators. Concretely: a distance of exactly **10** is "excellent" per bot-logic and palette-grid's exported `getMatchQuality`, but "good" per budget-comparison and palette-grid's inline copy; same divergence at 25 and 50. A bot embed (bot-logic) and its attached image (svg) can therefore label the *same match* with different quality tiers.
- **Benefits:** single source of truth, consistent user-facing labels, one place to tune thresholds.
- **Effort:** small — export tiers + classifier from `@xivdyetools/bot-logic` (svg already can't depend on bot-logic without a cycle check: bot-logic → core, svg → core; svg → bot-logic would be acyclic; alternatively put the constant in `@xivdyetools/types`).
- **Risk:** low; behavior change only at exact boundary values — pick `<=` (bot-logic semantics) and note it.

### REF-002 — `@xivdyetools/color-blending` depends on all of `@xivdyetools/core` for one function, contradicting the documented dependency graph
- **Kind:** REFACTOR
- **Severity/Priority:** MEDIUM
- **Location:** `packages/color-blending/package.json:31-33` (`"@xivdyetools/core": "workspace:*"` as the sole dependency); `packages/color-blending/src/blending.ts:13, 53-54` (only use: `ColorService.hexToRgb`)
- **Description:** The workspace CLAUDE.md dependency map documents `@xivdyetools/color-blending (→ types)` as a light Level-2 package, but it actually pulls the entire core package (dye database JSON, k-d tree, i18n, Universalis client) to call `ColorService.hexToRgb` twice. Meanwhile the package *already implements* its own conversion suite (`conversions.ts` — rgbToHsl/hslToRgb/rgbToHex/labs/oklabs), and `packages/svg/src/base.ts:58-72` carries a third copy of hexToRgb/rgbToHex. Bundle-size cost for any consumer that wants blending without the dye DB, plus a doc/architecture mismatch.
- **Benefits:** restores the documented layering (`color-blending → types` only), shrinks browser bundles, removes tree-shaking dependence on core's side-effect flags.
- **Effort:** trivial — add a local ~8-line `hexToRgb` to `conversions.ts` (mirroring svg/base.ts) and drop the core dependency; bump minor version.
- **Risk:** low — core's `hexToRgb` throws `AppError` on invalid hex; replicate the validation (or accept lenient parsing and document it).

### REF-003 — SVG primitive builders interpolate attribute values without validation/escaping
- **Kind:** REFACTOR
- **Severity/Priority:** LOW (defense-in-depth; no script execution in resvg)
- **Location:** `packages/svg/src/base.ts:111-262` (`rect`/`circle`/`line`/`text`/`group` — `fill`, `stroke`, `fontFamily`, `transform` interpolated raw; only text *content* is escaped, L228)
- **Description:** `text()` escapes its content but every attribute value is template-interpolated verbatim. A malformed or hostile `hex`/`fill` value (e.g. from community preset data if upstream validation ever regresses) like `"/><image href="…` restructures the SVG document. Because output is rasterized by resvg, the blast radius is broken/spoofed images rather than XSS — but the primitives are the package's trust boundary and are exported publicly (`index.ts:12-31`).
- **Benefits:** makes the SVG layer safe regardless of caller hygiene.
- **Effort:** small — run `escapeXml` on string attribute values, or validate color-typed params against `/^#[0-9a-fA-F]{6}$|^rgba?\(|^hsl\(|^none$/`.
- **Risk:** negligible.

### REF-004 — `estimateTextWidth` CJK detection misses fullwidth forms and Hangul Jamo
- **Kind:** REFACTOR
- **Severity/Priority:** LOW
- **Location:** `packages/svg/src/base.ts:322-334`
- **Description:** The wide-char ranges cover CJK Unified (0x3000-0x9FFF), Hangul syllables (0xAC00-0xD7AF), and compatibility ideographs — but not Halfwidth/Fullwidth Forms (0xFF00-0xFFEF, common in Japanese strings: `：`, `（）`, fullwidth digits) or Hangul Jamo (0x1100-0x11FF). Localized category badges (`dye-info-card.ts:121` uses this for badge sizing) containing fullwidth punctuation get underestimated widths → text overflows the badge.
- **Effort:** one-line range addition.

### REF-005 — Browser logger's `devOnly` option is accepted but dead
- **Kind:** REFACTOR
- **Severity/Priority:** LOW
- **Location:** `packages/logger/src/presets/browser.ts:16-17, 84-86`
- **Description:** `devOnly` is documented ("Only log in development mode (default: true)") and destructured to `_devOnly` marked "Reserved for future use" — it has no effect. A consumer passing `devOnly: false` expecting production logging still gets `level: 'warn'`. Either wire it (`level: isDevMode || !devOnly ? 'debug' : 'warn'`) or remove it from the public options interface.

### REF-006 — accessibility-comparison labels hardcoded in English while sibling generators are localizable
- **Kind:** REFACTOR
- **Severity/Priority:** LOW
- **Location:** `packages/svg/src/accessibility-comparison.ts:86-107` (`VISION_LABELS`)
- **Description:** `budget-comparison`, `palette-grid`, and `gradient` all take label objects for i18n (6-language ecosystem per workspace docs), but the vision-type names/descriptions ("Normal Vision", "Red-blind (~1% of males)", …) are compile-time English constants. Non-English users get mixed-language accessibility cards.
- **Effort:** small — add an optional `labels?: Record<AllVisionTypes, {label; description}>` option defaulting to the current constants, mirroring `PaletteGridLabels`.

---

## OPTIMIZATIONS

### OPT-001 — KVRateLimiter: drop the post-put verification read (1 fewer billed KV read per allowed request)
- **Kind:** OPT
- **Severity/Priority:** MEDIUM (direct KV-operation cost on every request of every KV-limited worker)
- **Location:** `packages/rate-limiter/src/backends/kv.ts:227-235`
- **Description:** Every successful `increment()` issues an extra `kv.get` to "verify" the write. As established in BUG-002, this read provides no atomicity (lost updates still pass `verified.count >= entry.count`) and can trigger harmful double-increment retries. Removing it cuts KV reads on the hot path by one third (`getWithMetadata` + `put` + `get` → `getWithMetadata` + `put`) — on the free tier's read budget and api-worker's per-request limiter (`apps/api-worker/src/middleware/rate-limit.ts:24-26`) this is a meaningful reduction.
- **Expected improvement:** −33% KV reads per rate-limited request; lower p50 latency (one fewer sequential round-trip); eliminates the double-count retry path.
- **Trade-offs:** none in correctness (the check was cosmetic); the retry loop then only handles thrown KV errors, which is what it's actually good for.

### OPT-002 — Contrast matrix computes every pairwise contrast twice
- **Kind:** OPT
- **Severity/Priority:** LOW
- **Location:** `packages/svg/src/contrast-matrix.ts:240-252`
- **Description:** The cell loop calls `calculateContrast(rowDye.hex, colDye.hex)` for both (i,j) and (j,i); contrast ratio is symmetric. Each call does two full hex→luminance conversions via `ColorService.getContrastRatio`. For the 6-dye max that's 30 calls where 15 suffice.
- **Expected improvement:** ~2× fewer contrast computations; trivial absolute win (micro-benchmark scale) — do it opportunistically when touching the file.
- **Trade-offs:** slight code complexity (precompute a triangular map keyed `i<j`).

### OPT-003 — `base64UrlEncodeBytes` uses O(n) string concatenation in a char-by-char loop
- **Kind:** OPT
- **Severity/Priority:** LOW
- **Location:** `packages/crypto/src/base64.ts:39-45`
- **Description:** `binary += String.fromCharCode(bytes[i])` per byte. Fine for 32-byte HMAC signatures (the dominant use), but the function is a public utility; chunked conversion (`String.fromCharCode.apply(null, chunk)` in 0x8000-size chunks) is ~10-50× faster for KB+ payloads and avoids pathological engine behavior on large inputs.
- **Trade-offs:** none; keep the current shape if callers are guaranteed small.

### OPT-004 — Logger `time()` on `DelegatingLogger` loses child context
- **Kind:** OPT (observability quality; borderline bug)
- **Severity/Priority:** LOW
- **Location:** `packages/logger/src/core/base-logger.ts:317-323`
- **Description:** `DelegatingLogger.time`/`timeAsync` delegate directly to the parent, so the emitted `debug` timing entry (`base-logger.ts:261`) omits the child's context (e.g. `requestId` added via `child({requestId})`). Timing lines become uncorrelatable in aggregated worker logs.
- **Fix/improvement:** implement `time()` locally: capture start, then call `this.debug(...)` (which merges child context) in the returned closure.

---

## Notes (verified non-issues)

- `packages/auth/src/timing.ts` — length-padding before `crypto.subtle.timingSafeEqual` plus original-length equality check is correct; the try/catch fallback correctly handles runtimes lacking the non-standard API (Node/browser) with a constant-time XOR loop.
- `packages/auth/src/hmac.ts:41-74` — module-level `cryptoKeyCache` with LRU cap 10 is the documented-safe Workers pattern (immutable values, no cross-request mutation hazard); LRU refresh on hit is implemented correctly (delete + re-set).
- `packages/bot-logic/src/localization.ts` — the per-locale instance cache genuinely eliminates the singleton `currentLocale` race; concurrent `getLocaleInstance` calls for the same locale can construct twice, but the last-write-wins overwrite is harmless (idempotent instances).
- `packages/rate-limiter/src/ip.ts` — stale comment at L67 says "default true for compat" while the actual default is `false` (L58, matching the FINDING-006 docstring); comment-only fix.
- `packages/worker-middleware/src/request-id.ts` — sets the `X-Request-ID` response header after `next()`; if a downstream handler throws, error responses built in `app.onError` lack the header. Hono's onError receives the context, so apps can re-set it via `getRequestId(c)` — pattern already documented in the helper's JSDoc.
