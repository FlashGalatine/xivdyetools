# Changelog

All notable changes to `@xivdyetools/worker-kit` (formerly `@xivdyetools/worker-middleware`) will be documented in this file.

## [1.3.0] - 2026-09-02

Deep-dive remediation, Sprint 15 (docs/audits/2026-09-02-deep-dive). Minor bump: three behaviour
changes, no API removal. **The native rate-limit binding key format changed, so every counter
resets once on deploy** — a one-off, and the counters are per-minute.

### Fixed

- **BUG-097 — `MemoryRateLimiter.check()` truncated history a wider window still needed.** The
  timestamp array was filtered by the *current* request's `windowMs` before being written back, so
  a narrow-window check erased history a wide-window check was still counting — defeating, inside
  `check()` itself, the per-key cutoff BUG-023 gave `cleanupOldEntries()`. One key checked at
  `{maxRequests: 2, windowMs: 1h}` then `{maxRequests: 100, windowMs: 60s}` admitted three requests
  inside the hour on a bucket the hour config limits to two. Retention is now bounded by the key's
  largest window; only the decision uses this request's. Latent in-repo (every shared instance uses
  a single `windowMs`), which is why it survived.

- **`X-RateLimit-*` were dropped for any handler returning a raw `Response`.** They were set with
  `c.header()` *before* `await next()`, which in Hono lands them in `#preparedHeaders` — merged only
  by `#newResponse`, i.e. `c.json()`/`c.text()`/`c.body()`. `api-worker`'s `GET /v1/chara/icon/:id`
  returns `new Response(bytes, …)` on both the miss and the cache hit, so it consumed a slot and
  shipped no rate-limit headers at all, while api-worker's CORS config advertises them in
  `exposeHeaders` and its deploy checklist asks an operator to verify them. The allowed path now
  applies them *after* `next()` (where `c.header()` clones the finalized response — the placement
  `requestIdMiddleware` already relies on); the 429 path still sets them before returning.

- **`CloudflareRateLimiter` binding keys are now genuinely tier-scoped.** The key was
  `keyPrefix + key` while a source comment claimed it kept "one client [from sharing] a bucket
  across two configs" — separation came entirely from the tiers being distinct binding objects, so
  two tiers pointed at the *same* binding (a plausible wrangler typo) shared one counter across a
  10-limit and a 30-limit config. The key now carries the tier's `(limit, period)`.

- **`selectTier()` ignored `windowMs`.** It matched on `limit` alone, so tiers
  `[{limit:10, periodSeconds:10}, {limit:30, periodSeconds:60}]` served a
  `{maxRequests:10, windowMs:60_000}` config from the 10-second tier — 6x the intended rate — while
  `resetAt` reported that tier's period end, leaving the emitted headers self-consistent and the
  mismatch invisible. Tiers whose period equals the config's window are now preferred, falling back
  to the historical limit-only choice rather than failing the request. Latent in-repo: every bound
  tier is `periodSeconds: 60`.

### Tests

Four suites asserted things that could not fail, and each is now falsifiable (verified by reverting
the source and watching the test go red):

- `cloudflare.test.ts` — "keys different tiers apart so a client cannot share one bucket across two
  configs" asserted the **opposite** of its own name: both bindings received the identical key `'k'`.
- `memory.test.ts` — the only cleanup test said in its own comment "we just verify no errors occur";
  after advancing three windows the stamp is outside the window regardless, so it held whether
  cleanup ran, ran with the wrong cutoff, or never ran. It now asserts the key was deleted, and a
  new case proves short-window keys do not purge a long-window key's history.
- `upstash.test.ts` — "provides a resetAt in the future" could not fail: every case seeds
  `exec -> [n, 1, 60]`, where the key's TTL happens to equal a full window, making BUG-055's fix
  indistinguishable from the `now + windowMs` it replaced.
- `headers.test.ts` — the `X-RateLimit-Reset` assertion recomputed the implementation's own
  `Math.ceil` on a timestamp with a zero sub-second part, where ceil, floor and trunc all agree.

New coverage for the KV backend's fixed-window boundary (BUG-064), which had no test at all: the
read and the write must address the same window key when the clock crosses a boundary mid-call.

## [1.2.1] - 2026-09-02

### Changed

This package is now gated on the monorepo's `knip` dead-code check (`pnpm run lint:dead`, folded
into `lint`; root `knip.jsonc`). Because `@xivdyetools/worker-kit` sits at its registry version
(1.2.0), nothing was removed — the first run found 20 barrel exports (11 values, 9 types) with no
in-repo consumer, spread across `middleware/index.ts`, `rate-limiter/index.ts`, and the published
`rate-limiter/presets/index.ts` subpath. Each is tagged `@public` rather than removed; four of the
seven presets re-exports (`getOAuthLimit`, `getDiscordCommandLimit`, `getModerationLimit`,
`PUBLIC_API_LIMITS`) are tagged even though the same values are also reachable in-repo through the
sibling `rate-limiter/index.ts` barrel — the other three (`OAUTH_LIMITS`, `DISCORD_COMMAND_LIMITS`,
`MODERATION_LIMITS`) have no in-repo consumer by any path, which is why they are tagged at
`rate-limiter/index.ts` too. All seven are tagged regardless, because `./rate-limiter/presets` is
its own published `package.json#exports` entry.

## [1.2.0] - 2026-08-30

Security audit remediation (docs/audits/2026-08-29-security, FINDING-010 + FINDING-012). Minor bump: a behaviour change in what gets logged, plus a constructor that now throws in a case it previously let through silently.

### Security

- **Rate-limit backend-error and fail-open log lines no longer carry the raw key.** The `key` passed to `RateLimiter.check()`/`checkOnly()` is a client IP or a Discord user id — exactly the kind of per-client identifier `apps/web-app/PRIVACY.md` promises is never collected — and every fail-open / backend-error log line logged it verbatim (the KV backend logged it **twice**: once as `key`, once embedded in the derived `kvKey`). All six sites now log a `keyScope` field instead (e.g. `public:ip`, `ratelimit`, or a shape label like `ip` / `id` / `unknown` when no `keyPrefix` is configured), via one new internal helper (`scopeRateLimitKey`) so the sites cannot drift apart. **If you parse these log lines for anything other than the message text, the `key`/`kvKey` fields are gone and a `keyScope` field has taken their place** — `middleware/rate-limit.ts`'s two warns (`'Rate limiter backend error'`, `'Rate limiter backend error (failing open)'`), `CloudflareRateLimiter`'s fail-open warn, `KVRateLimiter`'s `checkOnly` fail-open warn and its `increment` retry-exhausted error (both the structured-logger and the `console.error` fallback), and `UpstashRateLimiter`'s fail-open warn.
- **Fail-open is no longer silent when no logger is configured — in the three backends.** `CloudflareRateLimiter`, `KVRateLimiter` (`checkOnly`) and `UpstashRateLimiter` now fall back to `console.warn` with the same redacted context when constructed without a `logger` — previously `this.logger?.warn(...)` meant a limiter built without one fell open with **no signal anywhere**. That was, and remains, every in-repo limiter construction: none of the six passes `logger:` to the backend constructor, by design — a long-lived per-isolate instance would otherwise freeze the first request's id onto every later fail-open line, so all five in-repo Workers that use one instead read `result.backendError` after the call and report it through their own request-scoped logger (see the double-logging note below). `docs/architecture/security-trade-offs.md` accepts fail-open on the condition that fail-open events are logged and alertable; this closes the gap between that condition and what the code actually did for anyone who has not adopted that same pattern. `KVRateLimiter.increment()`'s existing `console.error` fallback was the in-repo precedent this shape follows, not a new convention. **`rateLimitMiddleware`'s own fail-open paths are not part of this fix and remain silent without a logger** — its caught backend throw and its `result.backendError` check (`middleware/rate-limit.ts`) each guard their `logger.warn(...)` on `c.get('logger')` with no fallback. This matters only for a backend configured `failOpen: false` while `onError` is left at its default `'fail-open'` (or any app that wires up `rateLimitMiddleware` without `loggerMiddleware` in the same chain) — no in-repo consumer does either, but a future one could.
- **`CloudflareRateLimiter`'s constructor now validates every tier's binding.** A tier whose `binding` has no callable `limit()` — a `[[ratelimits]]` name typo, or the wrong binding type — used to compile and construct without error, then fail *open* on the first request that reached it (the `check()` catch allows the request through). The constructor now throws immediately naming the offending tier's configured limit, the same fail-closed-at-startup trade Sprints 1-4 made for other missing security bindings elsewhere in this monorepo.
- **`result.backendError` was verified, not changed** — all three fallible backends (`CloudflareRateLimiter`, `KVRateLimiter`, `UpstashRateLimiter`) already set it correctly on every fail-open path, including through `KVRateLimiter.check()`'s wrapping of `checkOnly()`. No client-visible header was added for it — a `backendError: true` header would tell a brute-forcer exactly when the limiter is degraded; read it from `result.backendError` in your own request-scoped logger instead, the way `oauth` 3.0.0 and `moderation-worker` 1.6.0 already do.

### Fixed

- `loggerMiddleware`'s JSDoc usage example showed `logUserAgent: true` — the package's own documentation recommending the exact option this audit removed from three consumers' opt-ins. The example and the option's JSDoc now state the default (`false`) and why it stays that way.

### Operator notes

- This closes the worker-kit half of FINDING-010 and FINDING-012 (docs/audits/2026-08-29-security). Both findings' consumer halves already shipped: `presets-api` 2.2.0, `oauth` 3.0.0 and `api-worker` 0.10.0 removed their `logUserAgent: true` opt-ins; `oauth` 3.0.0 and `moderation-worker` 1.6.0 already read `result.backendError` and report it through their own request-scoped logger — **neither, nor any other in-repo consumer, passes a `logger` to the backend constructor itself**; see the double-logging note directly below, which now applies to them. In-repo consumers pick this up at their next build via `workspace:*`; npm consumers get it at the next publish of this package.
- **If this applies to you, you will now see two log lines per fail-open event, not one.** If you construct a backend (`CloudflareRateLimiter`, `KVRateLimiter`, `UpstashRateLimiter`) without `logger:` — commonly because the instance is a long-lived singleton and you read `result.backendError` afterward to report it through the *current request's* logger instead — you will now get this package's new `console.warn` fallback (raw, unstructured) **in addition to** your own structured line, for the same event. This is intentional, not a bug to route around: visibility must not depend on whether a logger happened to be configured, which is the condition `docs/architecture/security-trade-offs.md` sets for accepting fail-open at all. Pass `logger:` to the backend constructor instead if you want only the one structured line and are not affected by the staleness concern above. In this repo, that is five Workers, each on the one limiter that is actually fail-open: `api-worker`'s public `/v1/*` bucket (not its telemetry bucket — `TELEMETRY_LIMIT` sets `failOpen: false` *and* its middleware sets `onError: 'fail-closed'`, so that limiter rethrows and never reaches this fallback), `presets-api`, `oauth`, `moderation-worker` and `discord-worker`.

## [1.1.0] - 2026-08-21

Security audit remediation (docs/audits/2026-08-21-security, FINDING-003). Minor bump: additive API.

### Added

- **`CloudflareRateLimiter`** (`src/rate-limiter/backends/cloudflare.ts`, exported from `/rate-limiter` and the new `/rate-limiter/cloudflare` subpath) — a backend over the native Workers **Rate Limiting binding** (`[[ratelimits]]`, GA 2025-09). Takes one or more *tiers* (`{ limit, periodSeconds, binding }`, one per distinct `[[ratelimits]]` entry) and routes each `RateLimitConfig` to the smallest tier that holds `maxRequests + burstAllowance`. Implements `ExtendedRateLimiter` so it drops into both the one-shot (`check`) and two-phase (`checkOnly` / `increment`) call styles; `checkOnly` consumes a slot (the binding has no peek) and `increment` / `reset` / `resetAll` are no-ops. Fail-open with `backendError` unless `config.failOpen === false`. Also exports `RateLimitBinding`, `CloudflareRateLimitTier`, `CloudflareRateLimiterOptions`.

### Security

- **The KV backend is documented as unable to throttle a fast client** and should only be a fallback: KV allows 1 write/s/key, `KVRateLimiter.increment()` swallows the resulting 429s (so a counter advances at most ≈1/s, never reaching a 60 s threshold of 65), reads are eventually consistent, and `check()` fails open on any KV error. All per-client limiters in the monorepo (api-worker, presets-api, oauth, moderation-worker) now prefer `CloudflareRateLimiter`; discord-worker keeps Upstash (atomic INCR) and warns when it falls back to KV.

## [1.0.0] - 2026-08-16

**New npm package** — first release. Formed in the Monorepo 2.0 Tier 1 package consolidation (2026-07-31) by merging `@xivdyetools/worker-middleware` v1.2.0 and `@xivdyetools/rate-limiter` v1.5.0; both source trees moved verbatim, and neither API changed. `@xivdyetools/worker-kit` has never been published, so nothing below is breaking for an existing consumer — but see the migration notes for the two retired packages.

### Removed (2026-08-18 dead-code audit)

- `formatRateLimitMessage()` (`rate-limiter/headers.ts`) — zero callers; discord-worker's same-named function is a different, Discord-markdown message and is unaffected.
- `UNIVERSALIS_PROXY_LIMITS` preset — zero callers; api-worker's universalis router builds its config from env vars instead.
- `EndpointRateLimitConfig` type — never referenced anywhere, including inside this package.
- `MODERATION_LIMITS` **adopted, not removed**: added a `getModerationLimit(type)` lookup next to `getOAuthLimit`/`getDiscordCommandLimit`; `apps/moderation-worker/src/middleware/rate-limit.ts`'s `RATE_LIMIT_CONFIGS` now derives its numbers from the preset via a small shape adapter (its pre-existing `requestsPerMinute` field vs. the preset's `maxRequests`/`windowMs`) instead of re-declaring them inline.

### ⚠️ Migration from the retired packages

- `import { … } from '@xivdyetools/worker-middleware'` → `import { … } from '@xivdyetools/worker-kit'` (or the `/middleware` subpath).
- `import { … } from '@xivdyetools/rate-limiter'` → `import { … } from '@xivdyetools/worker-kit/rate-limiter'`.
- Backend subpaths keep their names one level down: `@xivdyetools/rate-limiter/{memory,kv,upstash,presets}` → `@xivdyetools/worker-kit/rate-limiter/{memory,kv,upstash,presets}`.
- All eight in-repo Worker consumers were flipped on the branch (`api-worker`, `discord-worker`, `moderation-worker`, `oauth`, `og-worker`, `presets-api`, `stoat-worker`, and the since-absorbed `universalis-proxy`). Full details and the removal checklist live in `DEPRECATIONS.md`.

### Added

- `src/middleware/` — the Hono middleware stack, exported from the package root and `./middleware`: `requestIdMiddleware()` (UUID-validated `X-Request-ID`, log-injection safe), `loggerMiddleware()` (per-request `@xivdyetools/logger` with `serviceName` / env / API-version / user-agent / `sanitizePath` options), `rateLimitMiddleware()` (memoized backend factory, standard `X-RateLimit-*` + `Retry-After` headers, fail-open by default), plus the `getRequestId(c)` / `getLogger(c)` context helpers and the `MiddlewareVariables` type.
- `src/rate-limiter/` — the sliding-window rate-limiting engine at `./rate-limiter`: `MemoryRateLimiter` (per-isolate, LRU-evicted), `KVRateLimiter` (best-effort fixed window on Cloudflare KV) and `UpstashRateLimiter` (distributed sliding window on Upstash Redis) behind the shared `RateLimiter` / `ExtendedRateLimiter` interfaces; `getClientIp(request, options?)` (prefers `CF-Connecting-IP`, never trusts `X-Forwarded-For` unless opted in); `getRateLimitHeaders()` / `formatRateLimitMessage()`; and the presets `OAUTH_LIMITS`, `DISCORD_COMMAND_LIMITS` (incl. `autocomplete`), `MODERATION_LIMITS`, `PUBLIC_API_LIMITS`, `UNIVERSALIS_PROXY_LIMITS` with the `getOAuthLimit()` / `getDiscordCommandLimit()` lookups. Every backend also has its own subpath (`./rate-limiter/{memory,kv,upstash,presets}`) so a Worker bundles only the one it uses.
- `hono` and `@cloudflare/workers-types` are both **optional** peers, so rate-limiter-only consumers (e.g. `stoat-worker`, a Node.js bot) don't need hono at all. `@upstash/redis` and `@xivdyetools/logger` are the only runtime dependencies. `"sideEffects": false` for tree-shaking; `./package.json` is exported.

### Security

- Optional `hono` peer floor raised from `^4.0.0` to `^4.12.34` (2026-08-09 pre-release audit FINDING-001 — the CORS ReDoS advisory in hono < 4.12.34 is reachable on the four Workers that mount `cors()`). Tightening a peer range would normally be a major bump, but the package has never been published, so the floor simply lands in this first release.

### Changed

- **`DISCORD_COMMAND_LIMITS` re-keyed to the 5.0 command roster** — the retired v4 keys (`match`, `match_image`, `favorites`, `collection`, `language`) are gone (they had been silently mis-tiering their replacements: `/extractor image` fell to the 15/min default instead of the 5/min image tier); `extractor`, `gradient`, `swatch`, `contrast`, `preset` (10/min), `preferences` added; new `command:subcommand` convention with `getDiscordCommandLimit(command, subcommand?)` resolving `command:subcommand` → `command` → `default` (`extractor:image` = 5/min)
- Tests: both suites (~2,250 lines across the middleware and rate-limiter modules) came across intact; the 90% lines / functions / branches / statements gate carried over from worker-middleware and now covers the rate-limiter tree too.
- Docs: README rewritten for the merged package (import-path table, middleware option tables, backend comparison, Worker configuration examples, license/legal notice); `CLAUDE.md` synced (incl. the `api-worker` ↔ `universalis-proxy` absorption).

### Operator notes (release day)

- `@xivdyetools/worker-kit` does **not** exist on npm yet. OIDC trusted publishing cannot create a new package: the first version must be published manually by a 2FA-authenticated human, and the trusted-publisher config added on npmjs.com afterwards (checklist in `DEPRECATIONS.md`). Until then, the "Publish Packages to npm" workflow entry for worker-kit will fail.
- `npm deprecate` `@xivdyetools/worker-middleware` and `@xivdyetools/rate-limiter` pointing at this package (manual, needs npm 2FA).

---

## Predecessor history: `@xivdyetools/worker-middleware` (1.0.0 – 1.2.0)

Everything below this line is the changelog of `@xivdyetools/worker-middleware`, the package whose shell was renamed to become worker-kit — it is **not** worker-kit release history. `@xivdyetools/rate-limiter`'s changelog (1.0.0 – 1.5.0) was not carried over; read it from git at `packages/rate-limiter/CHANGELOG.md` before commit `3f73b08` (2026-07-31).

## [1.2.0] - 2026-07-19

### Fixed

- **BUG-061** (2026-07-18 audit): the `backend` factory result is memoized per isolate — passing `(c) => new MemoryRateLimiter()` can no longer construct a fresh empty limiter per request and silently disable rate limiting (constraint documented on the option). The backend-error catch now logs the actual error message instead of swallowing it, making KV outages/misconfigurations diagnosable from logs.

## [1.1.2] — 2026-04-29

### Fixed

- **LINT-FIX** (REFACTOR-003 follow-up): Made `getLogger` and `getRequestId` generic over Hono's `Context<E, P, I>`, with constraint-type defaults (`E extends Env = Env`, `P extends string = string`, `I extends Input = Input`). The 1.1.1 refactor to a bare `Context` parameter caused `@typescript-eslint/no-unsafe-argument` to fire on `presets-api/src/index.ts:61` because that worker extends `MiddlewareVariables` with `& { auth: AuthContext }`, and the resulting intersection prevents TS from reducing the third generic position cleanly. Forwarding generics preserves the caller's exact context shape end-to-end. Defaults use the constraint types themselves (rather than `any`/`{}`) so the helpers comply with `no-explicit-any` and `no-empty-object-type` without disable comments. No behavioral change for any real call site (defaults only matter when a caller explicitly omits inference). Resolves CI run #66700292576 lint failure.

---

## [1.1.1] — 2026-04-29

### Changed

- **REFACTOR-003** (2026-04-28 audit): Replaced `Context<any, any, any>` in `getLogger` and `getRequestId` with Hono's standard `Context` type. The `ContextVariableMap` augmentation in `types.ts` already registers `requestId` and `logger` globally, so the `any` triple was never needed. Callers now retain their narrow `Bindings` / `Variables` typing through both helpers (a typo'd `c.get('reqIdTypo')` will be caught by tsc rather than silently typed `any`).
- **SEC-002** (2026-04-28 audit): Strengthened the `keyExtractor` JSDoc on `RateLimitMiddlewareOptions` with an explicit security warning against deriving keys from client-controlled headers like `X-Forwarded-For`. Cross-references `BUG-018` / 2026-04-07/FINDING-006 (the prior library-layer fix). Pure documentation hardening; no API change.

---

## [1.1.0] — 2026-04-07

### Added

- `rateLimitMiddleware()` — Configurable Hono middleware factory for rate limiting with standardized `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` response headers, `Retry-After` on 429 responses, and fail-open error handling. Adopted by `presets-api` and `api-worker` (resolves REFACTOR-002).
- 15 tests for `rateLimitMiddleware` covering header propagation, 429 format, fail-open, and configuration variants.

### Fixed

- **BUG-003**: Eliminated all `any` types — replaced `Context<any>` with Hono `ContextVariableMap` module augmentation; replaced `Record<string, any>` with `Record<string, unknown>` throughout.

---

## [1.0.0] — 2026-04-07

### Added

- `requestIdMiddleware()` — Configurable Hono middleware for request ID management with optional UUID format validation (enabled by default for log injection prevention). Extracted from 5 worker-local implementations.
- `loggerMiddleware()` — Configurable Hono middleware for per-request structured logging via `@xivdyetools/logger`. Supports environment reading, API version, user-agent logging, and custom path sanitization. Extracted from 4 worker-local implementations.
- `getRequestId()` — Safe context helper with `'unknown'` fallback for error handlers.
- `getLogger()` — Safe context helper with `undefined` fallback for error handlers.
- `MiddlewareVariables` type — Base Hono context variables (`requestId`, `logger`) for workers to extend.

### Motivation

Resolves **REFACTOR-001** from the 2026-04-07 deep-dive audit: ~185 lines of nearly identical request ID and logger middleware were duplicated across discord-worker, presets-api, oauth, moderation-worker, and api-worker. This package provides a single, tested, configurable source of truth.
