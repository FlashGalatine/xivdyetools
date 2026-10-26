# Review: api-worker-chara (deploy unit: api-worker)

Audit 2026-10-26, HEAD 13c386e5. Read-only. Scope: `apps/api-worker/src/chara/**`, `POST /v1/chara/resolve`, `GET /v1/chara/icon/:iconId`, and the shared middleware, body reader and cache service those routes go through.

## Route table and authz matrix

| Method | Path | Auth | Middleware before handler (`src/index.ts`) | Input bounds | Upstream (per request) | Cache | Response caching |
|---|---|---|---|---|---|---|---|
| POST | `/v1/chara/resolve` (`chara/router.ts:192-285`) | none (anonymous, CORS `*`, no credentials) | docs-host branch (43) → requestId (66) → logger (69) → security headers (78) → CORS (100) → `/v1/*` API rate limit, 65/60 s per IP, fail-open (122; `middleware/rate-limit.ts:31,115-137`) → locale (136) | Content-Length fast-fail + streamed 8 KiB cap (`router.ts:151-174`, `lib/bounded-body.ts:26-60`); object-only body; `gear` array ≤ 12 (`router.ts:89`); slot allowlist (105); duplicate slot refused (112); lanes integer 0..65535 (65); `set` only on weapons (118); empty piece refused (121); `glasses` integer 1..65535 (133-146) | at most 1 XIVAPI `/api/search` + 1 `/api/sheet/Glasses/:id` (`router.ts:224-256`); context probe at most once per 10 min per isolate (60 s after a failure) (`xivapi.ts:270-292`) | `chara-resolve` named cache, per (slot column, model key) and Glasses id, key = `chara:5:<JSON[base,version,schema]>:rows:<field>:<int>` (`cache.ts:44-52`); no shared cache when discovery fails (`router.ts:211-214`) | `Cache-Control: no-store` (`router.ts:279`) |
| GET | `/v1/chara/icon/:iconId` (`router.ts:291-341`) | none | same chain | `iconId` `^[1-9]\d{0,5}$` (55, 293); `version` at most once and `^[0-9a-f]{16}$` (306-314) | at most 1 XIVAPI `/api/asset` (`xivapi.ts:462-473`) | `chara-icons` named cache keyed by `[policy, base, version, iconId]` (`icon-cache.ts:25-30`) | `public, max-age=300, must-revalidate` (unversioned) or `public, max-age=2592000, immutable` (explicit version) (`router.ts:331-334`); `Content-Type: image/png`, `CSP: sandbox` |

Service-binding callers (discord-worker `/glamour`) carry no `CF-Connecting-IP` and draw on `SERVICE_RATE_LIMITER` (1300/60 s on one key) (`rate-limit.ts:61-77,136-137`; `worker-kit/src/rate-limiter/ip.ts:61-64`, XFF not trusted by default).

Module-scope state: `contextMemo` / `lastResolvedContext` keyed by env base/version/schema only (`xivapi.ts:165-166,274`); `pendingRows` / `pendingGlasses` capped at 256 keys combined (`lookup-loader.ts:23-40`); lazy ko/zh and acquisition tables (`regional-names.ts`, `acquisition.ts`). No user data held across requests.

## Candidates

### api-worker-chara-01: no cache-miss budget on `/v1/chara/*`; the new icon `?version=` adds a per-request cache bypass (LOW, INTERNET-UNAUTH)
- The resolve key includes the client-chosen `variant` lane (`core/src/services/chara/chara-models.ts:80-92`), so a client can send 12 cache-cold keys per request. Every request is then one XIVAPI search, sent with the project's fixed User-Agent (`xivapi.ts:33`), and it writes up to 12 empty-family entries kept for 8 days (`lookup-loader.ts:61-62`, `cache.ts:21-25`).
- The new `?version=` (added after 2026-10-03, commit 4b03e9e8) accepts any canonical 16-hex value as `cacheable: true` without checking it (`xivapi.ts:294-296`). Each distinct value is a distinct `chara-icons` key and a fresh `/api/asset` fetch for the same icon. This is the cache-busting shape that 2026-08-21 API-4 / FINDING-025 removed for the icon id.
- The only throttle is the shared 65/60 s per-IP API bucket, which fails open (`rate-limit.ts:31,118-119`). The Universalis proxy has a miss-only limiter (`universalis/router.ts:177-183`, FINDING-011); these routes have none, and XIVAPI 429s get no backoff (`xivapi.ts:399-400`).
- Impact: availability and third-party shared fate (XIVAPI throttling the worker's UA hurts every user's import). There is no confidentiality impact.
- Precondition not confirmed: how XIVAPI answers an unknown version key. A 400 or 404 means nothing is cached, but the upstream call is still made.
- Prior context: the 2026-10-03 evidence (`review-api-worker-chara-universalis-telemetry.md:57`) left "chara cache pollution, 65/min/IP" unfiled. That note does not appear in the report's Rejected section, and the version param is new since then.

### api-worker-chara-02: XIVAPI search and Glasses bodies are read with an unbounded `response.json()` (INFO, INTERNET-UNAUTH trigger, upstream precondition)
- `xivapi.ts:432` (`searchItems`) and `xivapi.ts:453` (`getGlasses`) buffer the whole upstream body. By contrast, the same file caps the context probe at 32 KiB (`xivapi.ts:164,327`), icons are capped at 1 MiB (`icons.ts:43-54`) and Universalis at 5 MB (`cached-fetch.ts:45,157`).
- This needs XIVAPI (or the var-configured base) to misbehave. The 500-row `limit` (`xivapi.ts:36`) is only a request to upstream and is not enforced here.
- It was routed as a robustness handoff on 2026-10-03 (`2026-10-03-security/evidence/handoffs.md:217`) and is still unfixed at HEAD.

## Positive controls (verified at HEAD)
- Strict integer-only resolve body. It enforces a slot allowlist, refuses duplicate slots, allows at most 12 entries, keeps lanes within uint16, and caps `glasses` at uint16 (`router.ts:60-149`). The 8 KiB cap is checked on the stream, so a chunked body cannot bypass it (`router.ts:151-174`, `bounded-body.ts:26-52`).
- No query injection. `buildResolveQuery` interpolates only a fixed column name and the decimal packed key (`xivapi.ts:104-114`). Every other parameter goes through `URLSearchParams` (`xivapi.ts:346-350,419-427,121`).
- SSRF: every outbound URL is the env `XIVAPI_BASE` plus a fixed path. Requests use `redirect: 'manual'` and refuse 3xx (`xivapi.ts:387,396-398`), with a 10 s timeout (3 s for the probe) (`xivapi.ts:34,163,381`).
- The cache identity is captured once per request. It covers base, canonical version, canonical schema and row shape v5 (`xivapi.ts:309-316`, `cache.ts:36-45`). A response whose version or schema does not match the captured context is refused and never persisted (`xivapi.ts:352-368`, `router.ts:258-266`). When discovery fails, the shared cache is bypassed (`router.ts:211-214`, `lookup-loader.ts:71-80`).
- Truncated search pages (a `next` cursor, or 500 rows or more) are never stored (`xivapi.ts:437-439`, `lookup-loader.ts:61`).
- Coalescing passes only decoded data, deep-copied through `structuredClone` (`lookup-loader.ts:113-118,146,155`). Waiters are capped at 256 keys, and overflow falls back to a normal fetch (`lookup-loader.ts:38-40,87`). Cleanup deletes an entry only if it is still the same one (`:108-109,152`). The owning request keeps its I/O alive with `waitUntil` (`:111,154`).
- Icon proxy: it checks the PNG magic number, caps the body at 1 MiB on the stream, pins `Content-Type: image/png`, and sets `CSP: sandbox` and `Content-Disposition: inline` (`icons.ts:43-56`, `router.ts:325-336`). The cache store re-checks the size and the magic number (`icon-cache.ts:44-45,54`). A 304 is accepted only when a retained ETag exists (`icons.ts:26-28`, `xivapi.ts:395`).
- Errors: the 503 exposes only `upstreamStatus` (`router.ts:176-186`). The global handler never returns a stack, and the message is echoed only when `ENVIRONMENT === 'development'` (`index.ts:208-255`). Every non-2xx gets `no-store` (`index.ts:90-92`).
- Personal data: the request carries only model integers and a Glasses id. The single chara log line holds counts only (`router.ts:237-241`). The telemetry event `chara_parse` keeps only a boolean `ok` and an enum `producer` (`telemetry/schema.ts:114-118`). No KV or D1 is used on this path.
- Secrets: the routes use none. XIVAPI settings are non-secret `[vars]` (`wrangler.toml:47-48,116`). `.dev.vars*` is gitignored (`.gitignore:11-13`). `workers_dev` and `preview_urls` are false (`wrangler.toml:18-19`).

## Rejected
- **Glasses 404 cached as `null` for 8 days without an identity check** (`xivapi.ts:449`, `lookup-loader.ts:129`): this is correct for the explicitly requested version, and an attacker cannot force a false 404.
- **Coalesced waiters inherit the owner's error or truncated rows**: this lasts one in-flight window only, nothing is persisted, and every query an attacker can build is well formed. Reaching 500 rows across 12 families is speculative.
- **Icon 400 echoes `received: rawId`** (`router.ts:299-302`): JSON envelope, `nosniff`, no HTML context.
- **Cross-site POST without preflight (text/plain)**: the API is anonymous with no credentials or per-user state, so there is no CSRF impact.
- **Lazy 3.4 MB tables cost about 1 s on the first resolve per isolate**: this is a documented design (OPT-002), and a client cannot force it repeatedly.
- **Stale SWR rows replayed without revalidation**: a correctness and freshness matter. The data is public and not user-specific.
- **Rate limiting fails open**: an accepted trade-off (`docs/architecture/security-trade-offs.md:88`). It is noted under -01 only as context.

## Files covered (17)
- `apps/api-worker/src/chara/`: router.ts, resolver.ts, xivapi.ts, lookup-loader.ts, cache.ts, icons.ts, icon-cache.ts, acquisition.ts, regional-names.ts, types.ts (first 40 lines)
- `apps/api-worker/src/`: index.ts, middleware/rate-limit.ts, lib/bounded-body.ts, universalis/services/cache-service.ts, telemetry/schema.ts (lines 95-140)
- `apps/api-worker/wrangler.toml` (grep), `packages/worker-kit/src/rate-limiter/ip.ts` (getClientIp), `packages/core/src/services/chara/chara-models.ts` (lines 80-110)
- Docs: `apps/api-worker/CLAUDE.md`, `docs/projects/api-worker/{endpoints,overview}.md` (chara rows)

Not covered: the core `/chara` facade and the xivcharakit parser, the web-app inspection worker, the discord-worker attachment fetch, chara tests, the worker-kit `loggerMiddleware` default request fields, and the `scripts/build-*` generators.
