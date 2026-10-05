# Review: api-worker-public (2026-10-03, commit 0ab33466)

## 1. Entry points and authz matrix
All public, anonymous, GET (CORS also allows POST/OPTIONS; POST only for chara/telemetry, other reviewer). Middleware order (src/index.ts): docs-host branch (43) -> requestId (66) -> logger (69) -> security headers (78) -> CORS `*` (100) -> /v1/* rate limit (122) -> telemetry limit (128-129) -> /v1/* locale (134) -> X-API-Version (137) -> routes.

| Route | Auth | Guards before handler | Caps |
|---|---|---|---|
| GET / , /health | none | CORS, headers | none |
| GET /v1/dyes | none | rate limit 65/60s per CF-Connecting-IP, locale allowlist | perPage<=200, page<=1000, excludeIds<=50, booleans strict (dyes.ts:204-216) |
| GET /v1/dyes/search | none | same | q<=100 chars (dyes.ts:45,55) |
| GET /v1/dyes/categories, /consolidation-groups | none | same | no params |
| GET /v1/dyes/batch | none | same | ids<=50 (dyes.ts:90), canonical int regex validation.ts:336 |
| GET /v1/dyes/stain/:stainId, /:id | none | same | CANONICAL_DYE_ID `^-?[1-9]\d{0,9}$` |
| GET /v1/match/closest, /within-distance | none | same | hex regex, limit<=125, maxDistance finite>=0.01, excludeIds<=50 |
| GET /v1/wheels, /wheels/:id | none | same | stops 3..360 (wheels.ts:173); wheel id allowlist |
| GET /v1/harmony/types, / | none | same | companions<=5, type/wheel/method allowlists, dye XOR hex |
| GET developers.xivdyetools.app/* | none | host check only, skips API middleware (index.ts:43-59) | static assets |
| /v1/chara, /v1/telemetry, /universalis, /api/v2 | other reviewers | | |

Service-binding callers (no CF-Connecting-IP) land in a separate 1300/60s bucket (rate-limit.ts:61-77); not reachable from the internet because CF always sets the header (worker-kit ip.ts:62; XFF untrusted by default, ip.ts:58).

Loops: harmony generateHarmonySlots over <=125 dyes x <=5 companions; stops<=360; no O(n^2/n^3) on user-sized input. Everything is bounded by the 125-dye DB.

## 2. Positive controls
- Locale allowlist from core SUPPORTED_LOCALES; invalid -> 400 (validation.ts:380-390; live check `?locale=xx` -> INVALID_LOCALE).
- Locale race fixed: ensureLocaleLoaded + explicit locale per call (locale.ts:233-242).
- Canonical-ID regex prevents cache-key aliasing (validation.ts:336); hasOwn guard on legacy method map (validation.ts:403).
- Query cache keys: all variation is in the query string; no cookies/headers vary the body; Vary not needed (CORS is `*`, no credentials, index.ts:114).
- Error handler never returns stack/env; generic message outside development (index.ts:244-251); dev detail only when ENVIRONMENT=development (dev worker has workers_dev=false, wrangler.toml:18-19, guarded by tests/wrangler-config.test.ts:29).
- 4xx/5xx and 3xx forced `Cache-Control: no-store` (index.ts:90).
- Rate limiting uses native binding (wrangler.toml:48-52, 75-... prod ns 1001); KV fallback only if unbound; keyed on CF-Connecting-IP; the IP is never logged: logger logs method + pathname only, no query, no UA (worker-kit logger.ts:77-90, logUserAgent default false at :117). api-worker passes no sanitizePath and none is needed.
- No D1/R2/KV user-keyed writes in these routes; no outbound fetch in the public REST half (docs live.ts fetches run in the visitor's browser only).
- Negative facewear itemIDs -> 404 with `facewearId`+hex for mapped legacy IDs, generic 404 otherwise (dyes.ts:239-250; live `/v1/dyes/-1` and `-1000` -> NOT_FOUND generic message).
- bounded-body helpers exist (lib/bounded-body.ts:270) for the POST route; none of the public GETs read a body.
- Docs host gets nosniff, X-Frame-Options DENY, Referrer-Policy, HSTS (index.ts:50-55); live headers on developers.xivdyetools.app match (curl -sI, 2026-10-03). Live data host headers match source (CORS *, nosniff, XFO, HSTS, X-RateLimit-*).
- docs build excludes CLAUDE.md/README.md (config.ts srcExclude); docs source tree contains only guide/reference/index + public fonts/icons; no internal docs, secrets or source maps tracked. Static assets from `docs/.vitepress/dist` only (wrangler.toml run_worker_first, not_found_handling 404-page).
- PII: public REST half writes no analytics datapoint, no KV/D1/R2 data, logs no IP/UA/query. Request ids are returned in the response only.

## 3. Rejected
- Fail-open public rate limiter: accepted trade-off (security-trade-offs.md).
- `received: <raw input>` echoed in JSON 400 details: JSON content-type + nosniff, input bounded by URL length; no HTML context. Docs console renders as text.
- notFound echoing pathname (index.ts:197): JSON only, no reflection risk.
- Public `s-maxage=86400` responses embedding a per-request `meta.requestId`: live data host shows no CF-Cache-Status, so not edge-cached by default; request id is not tied to a person. INFO at most; dropped.
- `category` filter unvalidated: exact string compare (DyeSearch.ts:124), no injection.
- `/v1/telemetry/x` bypass (api-worker-05): fixed, index.ts:128-129.
- workers.dev exposure in production env: prod has custom domains and test line 36 guards workers_dev=true.
- CORS `*` on public read-only API: intended, no credentials.

## 4. Files covered
apps/api-worker/: src/index.ts, src/types.ts, src/lib/{bounded-body,validation,response,services,dye-serializer(55-82),harmony}.ts, src/routes/{dyes,match,wheels,harmony}.ts, src/middleware/{rate-limit,locale}.ts, wrangler.toml, docs/.vitepress/config.ts, docs/.vitepress/theme/lib/live.ts (fetch sites), tests/wrangler-config.test.ts (grep). packages/worker-kit/src/rate-limiter/ip.ts, src/middleware/logger.ts. Live: curl -sI data/developers hosts, GET probes on /v1/dyes/-1, -1000, search q>100, locale=xx.

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | INFO | INTERNET-UNAUTH | apps/api-worker/src/index.ts:50-55 | Docs host sets no Content-Security-Policy or Permissions-Policy; static VitePress site with inline scripts and fetches to data host. Defense-in-depth only; no XSS sink found (v-html only for static SVG glyphs and sidebar counts). |

## 6. Handoffs
- Docs (documentation-audit): wrangler.toml:25-28 comment says production limit is 30 via RATE_LIMIT_REQUESTS only for the Universalis proxy; confirm docs/guide/rate-limits.md states 65/60s for /v1 (error text says "60 requests per minute", rate-limit.ts:126, while the limit is 65).
