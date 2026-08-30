# Security review — `apps/api-worker` (2026-08-29 whole-monorepo audit)

| | |
|---|---|
| **Deploy unit** | `xivdyetools-api-worker` — production routes `data.xivdyetools.app`, `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com`, `developers.xivdyetools.app` (`wrangler.toml:66-78`); top-level block is the routeless `…-dev` worker with `workers_dev`/`preview_urls` off (`wrangler.toml:18-19`) |
| **Tree** | worktree `security-audit-2026-08-29` @ `4c213248` (= `main`), read-only |
| **Delta since 2026-08-21** | 11 commits, 33 files (`git log b195723f..HEAD -- apps/api-worker`): FINDING-003 native rate-limit bindings (e90922f9), FINDING-025 bundle (6e23014d), `redirect: 'manual'` hot-fix (6f257062), telemetry sink 0.9.0 (561cb599, dffc1a5e, c88c113b, 2d1b3a32), two Dependabot bumps |
| **Method** | Every non-test source file read in full; tests read/grepped only to confirm a fix is guarded; one empirical Hono routing probe run against the main checkout's `node_modules` (read-only). No production call was made. |
| **Result** | CRITICAL 0 · HIGH 0 · MEDIUM 1 (conditional) · LOW 2 · INFO 5. The telemetry **datapoint** is clean (every column enum- or DB-validated, no IP/UA/request id/timestamp); the leads are about the request *around* the datapoint (any-Origin sink, fail-open limiter × 25 writes, UA in the access log) and doc drift. All 14 previous items re-verified: FINDING-003 and FINDING-025 (API-1..13) are real and test-guarded; API-14 is promoted (API-03 below). |

## Route / command table + authz matrix

No route requires, accepts or derives an identity — the worker is anonymous end to end. Middleware order (`src/index.ts:40-130`): docs-host short-circuit → request-id → logger (`logUserAgent: true`) → security headers (+ `no-store` on ≥ 400) → CORS `origin: '*'` → `/v1/*` API limiter (skips `/v1/telemetry*`) → `/v1/telemetry` limiter → `/v1/*` locale → routes. Native `[[ratelimits]]` bindings are declared in **both** envs (`wrangler.toml:48-58, 99-108`), so the KV fallback (`src/middleware/rate-limit.ts:48,131`) is unreachable in production.

| Method | Path (host) | Auth | Limiter | Body cap | Cache | Outbound |
|---|---|---|---|---|---|---|
| ANY | `*` on `developers.xivdyetools.app` (`index.ts:40-56`) | none | none | — | Workers Static Assets, `404-page` | none (ASSETS binding) |
| OPTIONS | `*` (`index.ts:96-113`) | none | none | — | `Access-Control-Max-Age: 3600` | none |
| GET | `/`, `/health` (`index.ts:136-147`) | none | none | — | none | none |
| GET | `/v1/dyes`, `/v1/dyes/search?q=`, `/categories`, `/batch?ids=`, `/consolidation-groups`, `/stain/:stainId`, `/:id` (`routes/dyes.ts`) | none | `API_RATE_LIMITER` 65/60 s per `CF-Connecting-IP`, per colo, fail-open | — (`q` ≤ 100, `ids` ≤ 50, `page` ≤ 1000, `perPage` ≤ 200) | `public, max-age=3600, s-maxage=86400` | none |
| GET | `/v1/match/closest`, `/v1/match/within-distance` (`routes/match.ts`) | none | API bucket | — (`hex` regex, `maxDistance` finite, `limit` ≤ 125) | same | none |
| POST | `/v1/chara/resolve` (`chara/router.ts:195-265`) | none | API bucket | 8 KB streamed (`router.ts:154-171`) | envelope `no-store`; per-key Cache API `chara-resolve` 7 d + 1 d SWR, namespaced by `XIVAPI_VERSION` (env) | XIVAPI `/api/search` (+ `/api/sheet/Glasses/:id`), ≤ 2 calls, 10 s timeout, `redirect: 'manual'` (`chara/xivapi.ts:185-201`) |
| GET | `/v1/chara/icon/:iconId` (`chara/router.ts:271-345`) | none | API bucket | upstream 1 MB streamed | `caches.default` 30 d immutable, canonical key | XIVAPI `/api/asset?path=ui/icon/NNN000/NNNNNN_hr1.tex&format=png`, PNG magic enforced |
| POST | `/v1/telemetry` (`telemetry/router.ts:46-82`) | none — **any Origin, any Content-Type** | `TELEMETRY_RATE_LIMITER` 240/60 s per IP, fail-open | 16 KB streamed | none (204 no body) | Analytics Engine `ANALYTICS`: ≤ 25 `writeDataPoint` per request in `waitUntil` |
| GET | `/universalis/aggregated/:dc/:ids` and `/api/v2/aggregated/…` (`universalis/router.ts:81-252`) — data.\*/proxy.\* hosts **and** discord-worker service binding (`UNIVERSALIS_PROXY`, IP = `'unknown'`) | none | per-isolate `MemoryRateLimiter` `RATE_LIMIT_REQUESTS` (30/60 s prod), charged on cache **misses only** | — (dc ∈ static ∪ live lists; ids `^[\d,]+$`, ≤ 100, 1–1 000 000) | Cache API `universalis-proxy` 300 s + 120 s SWR | `${UNIVERSALIS_API_BASE}/aggregated/<dc>/<ids>?listings=5&entries=5`, 5 MB streamed, 10 s timeout, `redirect: 'manual'` |
| GET | `/universalis/data-centers`, `/universalis/worlds` (+ `/api/v2/…`) (`router.ts:255-312`) | none | none | — | 24 h + 6 h SWR | Universalis |
| ANY | everything else | — | API bucket only under `/v1/*` (except `/v1/telemetry/<suffix>`, API-04) | — | `no-store` | JSON 404 envelope (`index.ts:175-188`) |

Telemetry datapoint columns actually written (`src/telemetry/schema.ts:144-167`): `index1`/`blob1` event ∈ 5-name `Map`; `blob2` tool ∈ 9 ids; `blob3` ∈ {initial,share,nav} / {drawer,grid} / 'true'|'false' / 2 themes; `blob4` stainID (must resolve via `dyeService.getByStainId`, `schema.ts:82-85`) / producer ∈ 5 / ''; `blob5` locale ∈ core `SUPPORTED_LOCALES` (6 codes, `packages/core/src/services/LocalizationService.ts:32-39`); `blob6` theme ∈ 2; `blob7` vp ∈ {m,t,d}; `blob8` ver (regex + 16-char clamp — API-05); `blob9` env ∈ {production,beta} (client-supplied — API-01); `double1` dwell int 0–1800. Nothing else from the request is read by the route (`telemetry/router.ts:46-82`).

## Candidates

### API-01 — Telemetry sink accepts beacons from any Origin, and the `env` (production | beta) dimension is trusted from the client

| | |
|---|---|
| **Severity** | LOW — integrity of the four product metrics (and of the beta/production split), not confidentiality; no PII can be injected because every column is enumerated. |
| **Exposure** | INTERNET-UNAUTH |
| **Rotation** | none |
| **Files** | `apps/api-worker/src/index.ts:96-113` (`cors({ origin: '*' … allowMethods: [… 'POST'] })` on `*`), `src/telemetry/router.ts:46-67` (reads only the body; never `Origin`, never `Sec-GPC`), `src/telemetry/schema.ts:55,149` (`ENVS` taken from `body['env']`); no `Origin`/`Sec-GPC` read anywhere in `src/**` (grep) |

```ts
// src/telemetry/schema.ts:144-150 — the beta/production split is whatever the sender says
const envelope = [
  envelopeField(body['locale'], SUPPORTED_LOCALES),
  …
  version(body['ver']),
  envelopeField(body['env'], ENVS),        // 'production' | 'beta' from the body
];
```

**Trigger.** `curl -X POST https://data.xivdyetools.app/v1/telemetry -H 'Content-Type: text/plain' --data '{"v":1,"ver":"5.0.3","env":"production","locale":"en","theme":"standard-dark","vp":"d","events":[{"n":"dye_pick","p":{"tool":"harmony","stainID":102,"via":"grid"}}]}'` → `204`, one production datapoint. Browser-borne variant: any third-party page runs `navigator.sendBeacon('https://data.xivdyetools.app/v1/telemetry', body)` — `text/plain` needs no preflight, so CORS is irrelevant to whether the write lands, and the traffic arrives from every visitor's own IP (defeats the per-IP bucket).

**Impact.** Anyone can skew tool popularity / dye picks / `.chara` counts / theme share, or label junk as `production` vs `beta`. The web app is the only intended sender (spec §2) and it always sends `Origin: https://xivdyetools.app` or `https://beta.xivdyetools.app` (browsers attach `Origin` to every cross-origin POST, `sendBeacon` included), so the server has a cheap, spoof-resistant-in-browsers signal it does not use.

**Fix.** In `telemetryRouter.post('/')`: (1) soft-allowlist `Origin` ∈ {`https://xivdyetools.app`, `https://beta.xivdyetools.app`, `http://localhost:5173` when `ENVIRONMENT=development`} — on mismatch/absence answer `204` and **skip the write** (never 4xx: the client cannot read the response anyway); (2) derive `blob9` from that Origin host (`beta.` → `beta`, else `production`) instead of `body['env']`; (3) also drop the batch when the request carries `Sec-GPC: 1` (see API-08). Document that a non-browser sender can still forge the header — the endpoint is unauthenticated by design.

### API-02 — Telemetry limiter fails open, and each accepted request fans out to up to 25 metered Analytics Engine writes

| | |
|---|---|
| **Severity** | LOW — cost / data-integrity amplification; no data exposure. |
| **Exposure** | INTERNET-UNAUTH |
| **Rotation** | none |
| **Files** | `apps/api-worker/src/middleware/rate-limit.ts:110-115` (`failOpen: true`), `:140` (`onError: 'fail-open'`); `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:159-173` (binding error → `allowed: true`); `packages/worker-kit/src/middleware/rate-limit.ts:153-156` (middleware fail-open); `src/telemetry/schema.ts:25,154-156` (25 events kept); `src/telemetry/router.ts:31-44,74-79` (one `writeDataPoint` per event in `waitUntil`) |

```ts
// src/middleware/rate-limit.ts:110-115
const TELEMETRY_LIMIT = {
  maxRequests: 240,
  windowMs: 60_000,
  burstAllowance: 0,
  failOpen: true,          // ← a binding error = no limit at all
} as const;
```

**Trigger.** Sustained `POST /v1/telemetry` at ≤ 240/min from each of N addresses (the native counter is per colo — `cloudflare.ts:43-44` — so a distributed sender also gets limit × colos), each body carrying 25 valid events; or any period in which `TELEMETRY_RATE_LIMITER.limit()` throws.

**Impact.** 240 × 25 = 6 000 datapoints/min per IP with zero authentication. Analytics Engine bills per data point written on Workers Paid (10 M/month included, then per additional million — verify current pricing) and **samples under load**, so a flood both costs money and crowds genuine opted-in events out of the sampled series the queries in `docs/operations/ANALYTICS_QUERIES.md` rely on. The fail-open trade-off (`docs/architecture/security-trade-offs.md` §2) is justified by availability; a fire-and-forget sink has no availability requirement — the client ignores the response (`apps/web-app/src/services/telemetry-service.ts:229-239`).

**Fix.** Make the telemetry middleware fail-closed (`failOpen: false`, `onError: 'fail-closed'` — or, cleaner, on backend error answer `204` and skip the write). Consider charging the bucket per batch size (e.g. one slot per 5 events) or lowering to 120/min (one tab flushes ≤ 4/min: `telemetry-service.ts:48-49`). Optionally add a per-colo global circuit breaker (a second `[[ratelimits]]` binding called with a constant key, e.g. 5 000/min) so no single deployment can write more than ~125 k points/min regardless of source count. Combine with API-01's Origin gate, which removes the browser-borne distributed case.

### API-03 — Every telemetry beacon is access-logged with the User-Agent, contradicting the privacy guide's "the server discards everything about the request except the validated events"

| | |
|---|---|
| **Severity** | MEDIUM by the brief's personal-data rubric (a field the policy explicitly says is "never collected" reaches a log on the privacy-sensitive route); **LOW if the request log is not retained** — no `[observability]`/Logpush block exists in any `wrangler.toml` (grep across all five workers), so retention depends on the dashboard state, which was not checked. Promotes 2026-08-21 API-14 (INFO) because the opt-in telemetry route now sits behind the same logger. |
| **Exposure** | INTERNET-UNAUTH (data of every opted-in visitor) |
| **Rotation** | none |
| **Files** | `apps/api-worker/src/index.ts:66-73` (`loggerMiddleware({ … logUserAgent: true })` on `*`, before the telemetry route); `packages/worker-kit/src/middleware/logger.ts:141-145` (`startContext.userAgent = c.req.header('user-agent')` → `logger.info('Request started', …)`); `apps/web-app/PRIVACY.md:78-82`; `src/telemetry/router.ts:18-19` (comment: "no IP, no User-Agent, no request id" — true of the datapoint, not of the request) |

```ts
// packages/worker-kit/src/middleware/logger.ts:141-145
const startContext: Record<string, unknown> = { method, path };
if (logUserAgent) {
  startContext.userAgent = c.req.header('user-agent');
}
logger.info('Request started', startContext);   // fires for POST /v1/telemetry too
```

`PRIVACY.md:78-82`: *"What is never collected: your IP address, user agent or device details, … The server discards everything about the request except the validated events."*

**Trigger.** Any opted-in visitor's normal beacon. Each produces a structured `Request started` line with `{ requestId, method: 'POST', path: '/v1/telemetry', userAgent }` and a `Request completed` line, timestamped within seconds of the datapoints written for that batch. The client IP additionally reaches the log only when the limiter backend errors (`packages/worker-kit/src/middleware/rate-limit.ts:142-150, 175-183` log `key` = IP).

**Impact.** The AE datapoint itself is clean (verified column by column above). The gap is between the published promise and the operational log: with Workers Logs (3–7 day retention) or Logpush enabled, an operator holds `userAgent` + timestamp + path per beacon, which is exactly the "device details" the guide rules out and can be time-correlated with the datapoints. Even without retention, `wrangler tail` shows it live, and the CHANGELOG (`apps/api-worker/CHANGELOG.md:16`) repeats the "no User-Agent" claim without the qualifier.

**Fix.** Set `logUserAgent: false` for api-worker (an anonymous read API gains nothing forensic from UA), or skip the `Request started` line when `isTelemetryPath(c.req.path)`; on that path also omit `key` from the limiter's backend-error warning (or hash it). Then either leave `PRIVACY.md` as is (now true) or, if any request logging is retained, add one sentence disclosing transient operational logs (method, path, status, timing) and their retention.

### API-04 — `/v1/telemetry/` and `/v1/telemetry/<anything>` are exempt from both rate-limit buckets

| | |
|---|---|
| **Severity** | INFO — only a JSON 404 is reachable; cost per hit is a locale load + envelope. |
| **Exposure** | INTERNET-UNAUTH |
| **Rotation** | none |
| **Files** | `apps/api-worker/src/middleware/rate-limit.ts:54-56` (`isTelemetryPath` = exact **or prefix** `/v1/telemetry/`), `src/index.ts:118-119` (API bucket skips the prefix; telemetry bucket mounted on the **exact** path), `src/index.ts:161` (router only answers `POST /v1/telemetry`) |

```ts
// src/middleware/rate-limit.ts:54-56
export function isTelemetryPath(path: string): boolean {
  return path === TELEMETRY_PATH || path.startsWith(`${TELEMETRY_PATH}/`);   // prefix …
}
// src/index.ts:119
app.use(TELEMETRY_PATH, telemetryRateLimitMiddleware);                        // … but exact mount
```

**Trigger / evidence.** Probe against hono 4.13.4 (`pnpm-lock.yaml:3129`) with the same wiring: `POST /v1/telemetry` → 204 via the telemetry limiter; `POST /v1/telemetry/` and `/v1/telemetry/x` → 404 with **neither** middleware invoked; `/v1/telemetry%2Fx` → 404 via the API limiter (Hono keeps `%2F` encoded). Every other unrouted `/v1/*` path is still charged to the API bucket, so these two shapes are the only unlimited `/v1` paths.

**Fix.** Make `isTelemetryPath` exact (`path === TELEMETRY_PATH`), or mount the telemetry limiter on both `TELEMETRY_PATH` and `${TELEMETRY_PATH}/*`. Add the probe as a test next to `rate-limit.test.ts:96-131`.

### API-05 — `ver` is the only telemetry column that is not an enumeration (≤ 10 free alphanumerics via the prerelease suffix)

| | |
|---|---|
| **Severity** | INFO — a tampered or third-party sender can write a short arbitrary token into `blob8`; legitimate clients send a build constant, so no user data is at stake. |
| **Exposure** | INTERNET-UNAUTH |
| **Rotation** | none |
| **Files** | `apps/api-worker/src/telemetry/schema.ts:58-59,126-130`; sender constant `apps/web-app/src/shared/constants.ts:38-39` (`APP_VERSION` from a Vite define) |

```ts
// src/telemetry/schema.ts:58-59, 126-130
const VER_MAX_LENGTH = 16;
const VER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
…
  return typeof value === 'string' && VER_PATTERN.test(value) ? value.slice(0, VER_MAX_LENGTH) : INVALID;
```

**Trigger.** `"ver":"1.0.0-abcdefghij"` → `blob8 = "1.0.0-abcdefghij"` (16 chars). The spec (§4) only asked for `^\d+\.\d+\.\d+` + clamp; the anchored implementation is already stricter than spec.

**Fix.** Store only the numeric triple (`m.[0]` of `/^(\d{1,4}\.\d{1,4}\.\d{1,4})/`) or allowlist the one prerelease shape the beta build actually emits (`-beta\.\d+`). Also stops `blob8` from becoming a per-build fingerprint if beta builds ever embed a timestamp (the test at `schema.test.ts:164-173` already anticipates `5.0.3-beta.20260829.1234`).

### API-06 — Public rate-limit documentation still describes the retired KV sliding window and a real `X-RateLimit-Remaining`

| | |
|---|---|
| **Severity** | INFO — documentation drift (public contract), no runtime effect. Follow-up to 2026-08-21 API-1 fix item 3. |
| **Exposure** | INTERNET-UNAUTH (published) |
| **Rotation** | none |
| **Files** | `apps/api-worker/docs/guide/rate-limits.md:9` ("60 req/min per IP (KV-backed sliding window)"), `:13` ("before the sliding window kicks in"), `:27` (`X-RateLimit-Remaining` described as a live counter) vs `src/middleware/rate-limit.ts:38-44` (native binding when bound) and `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:36-44,147` (fixed 60 s period, per colo, `remaining` is always `limit − 1` while allowed) |

**Fix.** Rewrite the two sentences (fixed 60-second period, counted per Cloudflare location, `Remaining` is an "at least one more" indicator) and drop the "sliding" wording; the same paragraph is mirrored in `apps/api-worker/CLAUDE.md`.

### API-07 — Negative icon and glasses lookups are never cached, so each unknown id is one upstream XIVAPI round trip per request

| | |
|---|---|
| **Severity** | INFO — 1:1, no amplification, bounded by the 65/60 s native bucket (per colo). |
| **Exposure** | INTERNET-UNAUTH |
| **Rotation** | none |
| **Files** | `apps/api-worker/src/chara/router.ts:304-306` (upstream 404 → `ApiError` 404; `no-store` from `index.ts:86-88`; `edge.put` at `:341-343` only on success); glasses: `chara/router.ts:244-247` does cache `null` for 7 d (fine) |

**Trigger.** `GET /v1/chara/icon/<n>` over ids that have no asset (the id space is 1–999 999; real icons are a small subset) from many colos/addresses → one `/api/asset` fetch each, from the worker's fixed UA. The comment at `chara/router.ts:8-9` ("one upstream search per request at most") holds for `/resolve`, not for the icon proxy.

**Fix.** Put a short negative entry (e.g. `Cache-Control: public, max-age=3600`, status 404) under the same canonical key, and serve it on the next hit.

### API-08 — Server does not honour `Sec-GPC`; the GPC promise rests entirely on the client

| | |
|---|---|
| **Severity** | INFO — hardening; the shipped client honours GPC (`apps/web-app/src/services/telemetry-service.ts:117-119`). |
| **Exposure** | INTERNET-UNAUTH |
| **Rotation** | none |
| **Files** | `apps/api-worker/src/telemetry/router.ts:46-82` (no header read); `apps/web-app/PRIVACY.md:57-59` ("never if your browser sends the Global Privacy Control signal") |

**Trigger.** A stale cached bundle, a modified client, or a third-party page (API-01) posting from a GPC-enabled browser: the browser still stamps `Sec-GPC: 1` on the request, and the worker writes the batch anyway.

**Fix.** In the telemetry route: `if (c.req.header('Sec-GPC') === '1') return c.body(null, 204);` before parsing. Two lines, makes the policy sentence true at the server as well.

## Positive controls

- **Telemetry datapoint is an allowlist end to end** — `EVENT_SCHEMAS` is a `Map` (prototype-safe, `schema.ts:87-120`; tests `router.test.ts:43-53`, `schema.test.ts:22-31`); every dim is `oneOf(...)` or `dyeService.getByStainId` (`schema.ts:70-85`); envelope fields degrade to `'invalid'` instead of rejecting (`schema.ts:122-130,144-150`; test `schema.test.ts:145-162`); ≤ 25 events (`:154-156`), 16 KB streamed cap with reader cancel (`lib/bounded-body.ts:26-52`; test `router.test.ts:98-103`); `JSON.parse` wrapped (`router.ts:57-62`); writes per point in `try/catch` inside `waitUntil` (`router.ts:31-44,76-78`); absent binding → 204 no-op (`:74-79`; test `router.test.ts:105-110`); GET → 404. No IP/UA/request id/`cf` field/timestamp is read into the point. Client sends no identifier and stores nothing (`telemetry-service.ts:186-208,229-239`).
- **FINDING-003 fixed and guarded** — native `CloudflareRateLimiter` selected whenever the binding is bound (`middleware/rate-limit.ts:38-49,118-132`), bindings present in both envs with unique `namespace_id`s across all five workers (api 1001–1004, presets 1011/1012, oauth 1021–1026, moderation 1031–1034); tests `src/middleware/rate-limit.test.ts:78-160` (binding used, KV untouched, telemetry carve-out both directions), `tests/wrangler-config.test.ts:49-59`. IP key = `CF-Connecting-IP`, XFF distrusted (`worker-kit/src/rate-limiter/ip.ts:53-79`).
- **FINDING-025 / API-2..13 all real and test-guarded** — API-2 streamed 8 KB cap (`chara/router.ts:154-177`; `router.test.ts:206-233`); API-3 truncated pages not cached (`router.ts:224-235`, `xivapi.ts:233`; `router.test.ts:238`, `xivapi.test.ts:146-158`); API-4 canonical icon id + key (`router.ts:53,273-287`; `router.test.ts:317-336`); API-5 no stack in any env + `workers_dev`/`preview_urls` off (`index.ts:209-229`, `wrangler.toml:18-19`; `app-hardening.test.ts:16-47`, `wrangler-config.test.ts:27-37`); API-7 miss-only proxy limiter (`universalis/router.ts:90-95,172`, `cached-fetch.ts:103-107`; `router.test.ts:160-175`); API-8 upstream detail logged not echoed (`universalis/router.ts:207-250`; `router.test.ts:133`); API-9 10 s timeouts + `redirect: 'manual'` on both clients (`cached-fetch.ts:152-153`, `xivapi.ts:188-201`; `cached-fetch.test.ts:64-90`, `xivapi.test.ts:117-124`) — the 2026-08-28 `'error'` regression (6f257062) is now pinned by those assertions; API-10 docs-host headers (`index.ts:40-56`; `app-hardening.test.ts:71-96`); API-11 `X-API-Key` gone, `ALLOWED_ORIGINS` removed (`index.ts:101`, `universalis/types.ts:37-46`; `app-hardening.test.ts:100-115`); API-12 PNG magic, pinned `image/png`, `CSP: sandbox`, 1 MB streamed (`router.ts:55-59,310-340`; `router.test.ts:341-365`); API-13 `q` ≤ 100, `page` ≤ 1000, finite `maxDistance`, `no-store` on every ≥ 400 (`dyes.ts:44-46,56,281`, `validation.ts:190`, `index.ts:86-88`; `dyes.test.ts:46,317`, `match.test.ts:134`, `app-hardening.test.ts:50-67`).
- **SSRF / URL construction unchanged and sound** — every upstream URL is env base + validated integers / allowlisted names / `URLSearchParams` (`xivapi.ts:84-102,176-180,221-226,239`; `universalis/router.ts:99-127,158-167`; `datacenters.ts:148-176` exact-match after lowercasing); `XIVAPI_VERSION` cache namespace comes from env only (`xivapi.ts:167,172-174`, `chara/cache.ts:35-37`); cache keys canonical in named caches under the request origin, which on custom-domain routes is one of the four configured hosts (`cache-service.ts:65-67`); only `ok` JSON bodies stored, error bodies never.
- **Config / CI hygiene** — no secrets in this worker, `[vars]` are non-sensitive (`wrangler.toml:29-44,78`); `.dev.vars*` gitignored (`.gitignore:11-13`); production config only under `[env.production]`; deploy workflow SHA-pinned, `permissions: contents: read`, `environment: production`, `deploy --env production`, tests + type-check before deploy (`.github/workflows/deploy-api-worker.yml:20-68`); `spectral.js` in `package.json` is a documented pnpm-isolation requirement for core's blending module (`CLAUDE.md:169`), not dead.

## Rejected

- **SSRF via `:datacenter` path segment** — value must equal a static or live-list name after lowercasing before it is interpolated (`datacenters.ts:148-176`); `toLowerCase()` folding can only yield the canonical ASCII name.
- **Cache poisoning through the request origin used in synthetic cache URLs** — on custom-domain routes `new URL(c.req.url).origin` is one of the four routed hosts; not client-controllable.
- **Prototype pollution / JSON bombs in telemetry or chara bodies** — no object merging; own-property reads on parsed JSON; `Map` schema table; 16 KB / 8 KB streamed caps and `JSON.parse` in `try/catch` → 400.
- **KV rate-limiter fallback reachable from the internet** — both native bindings are declared under `[env.production]` (`wrangler.toml:99-108`); the fallback runs only if a binding is absent. Removal remains gated by `docs/operations/POST_MERGE_CHECKLIST.md` §3.
- **2026-08-21 API-7 residual (service-binding callers share the `'unknown'` bucket)** — now charged on cache misses only; the remaining risk is the bot self-throttling at > 30 distinct uncached `(dc, ids)` tuples/min/isolate, availability-only, INTERNAL. Re-file only if `/budget` shows proxy 429s.
- **Per-IP keys do not bucket IPv6 /64s** — generic platform limitation shared by every worker; no api-worker-specific angle.
- **Docs host has no CSP** — VitePress hydration needs inline scripts; static content, `X-Frame-Options: DENY` already set (`index.ts:47-52`).
- **`Content-Type` not enforced on `/v1/telemetry`** — by design (`sendBeacon` sends `text/plain`); a form-encoded cross-site POST fails `JSON.parse` → 400 with nothing written.
- **`hono@4.13.4`** (`pnpm-lock.yaml:3129`) — no known advisory at review time; nightly `pnpm audit --prod` covers it.
- **`/` root advertises `https://data.xivdyetools.app/docs`** (`index.ts:141`) — stale link (docs live on `developers.*`), cosmetic.
- **`localeMiddleware` runs on telemetry beacons** (`index.ts:124`) — `?locale=xx` merely yields a 400; `ensureLocaleLoaded` is memoised. Cosmetic.

## Files covered

**api-worker (read in full):** `src/index.ts`, `src/types.ts`, `src/middleware/rate-limit.ts`, `src/middleware/locale.ts`, `src/lib/api-error.ts`, `src/lib/bounded-body.ts`, `src/lib/dye-serializer.ts`, `src/lib/response.ts`, `src/lib/services.ts`, `src/lib/validation.ts`, `src/routes/dyes.ts`, `src/routes/match.ts`, `src/telemetry/router.ts`, `src/telemetry/schema.ts`, `src/chara/router.ts`, `src/chara/xivapi.ts`, `src/chara/cache.ts`, `src/chara/resolver.ts`, `src/chara/types.ts`, `src/universalis/router.ts`, `src/universalis/types.ts`, `src/universalis/config/cache.ts`, `src/universalis/services/cached-fetch.ts`, `src/universalis/services/cache-service.ts`, `src/universalis/services/rate-limiter.ts`, `src/universalis/test-setup.ts`, `wrangler.toml`, `package.json`, `vitest.config.ts`, `docs/.vitepress/config.ts`, `tests/test-utils.ts`, `tests/wrangler-config.test.ts`, `tests/app-hardening.test.ts`, `src/telemetry/router.test.ts`, `src/telemetry/schema.test.ts`, `src/middleware/rate-limit.test.ts` (lines 40-160).
**api-worker (grep / partial):** `src/universalis/config/datacenters.ts` (validation functions), `src/chara/router.test.ts`, `src/chara/xivapi.test.ts`, `src/universalis/router.test.ts`, `src/universalis/services/cached-fetch.test.ts`, `tests/routes/dyes.test.ts`, `tests/routes/match.test.ts`, `tests/middleware/rate-limit.test.ts`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`, `docs/guide/rate-limits.md`.
**Not read:** `src/chara/regional-names.ts` + `src/chara/data/*.json` (generated tables), `src/universalis/services/request-coalescer.ts` (unchanged since the 2026-08-21 full read), `scripts/build-item-names.mjs`, `docs/reference/*.md`, `docs/.vitepress/theme/*`.
**Dependencies:** `packages/worker-kit/src/middleware/rate-limit.ts`, `middleware/logger.ts`, `middleware/request-id.ts`, `rate-limiter/backends/cloudflare.ts`, `rate-limiter/ip.ts` (full); `packages/core/src/services/LocalizationService.ts:28-42`; `packages/core/package.json` (grep).
**Adjacent:** `apps/web-app/src/services/telemetry-service.ts` (full), `apps/web-app/src/shared/constants.ts` (grep), `apps/web-app/PRIVACY.md` (full), `apps/discord-worker/src/services/budget/universalis-client.ts:125-140`, `.github/workflows/deploy-api-worker.yml` (full), `.gitignore` (grep), `pnpm-lock.yaml` (grep), every `apps/*/wrangler.toml` (grep for `namespace_id`/`observability`).
**Audit context:** `evidence/REVIEWER_BRIEF.md`, `evidence/delta-files-by-unit.txt`, `evidence/pii-sinks.txt` + `pii-sources.txt` (api-worker rows), `docs/audits/2026-08-21-security/evidence/review-api-worker.md`, `docs/superpowers/specs/2026-08-29-web-analytics-design.md`, `docs/architecture/security-trade-offs.md`, `docs/operations/POST_MERGE_CHECKLIST.md` §3, `docs/operations/ANALYTICS_QUERIES.md` (grep).
**Probe:** one `node -e` Hono routing check against `C:/dev/XIVProjects/xivdyetools/apps/api-worker/node_modules/hono` (read-only, results in API-04).
