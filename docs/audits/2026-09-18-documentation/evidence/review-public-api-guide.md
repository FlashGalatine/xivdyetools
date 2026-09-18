# Review: public-api-guide

Cluster: `docs/user-guides/public-api.md` (single file, 412 lines, fully read).

Source of truth: `apps/api-worker/src/{index.ts,routes/*,lib/*,middleware/*,chara/*,universalis/*,telemetry/*}`,
`apps/api-worker/wrangler.toml`, `apps/api-worker/CLAUDE.md`, `packages/core/src/{constants/index.ts,
services/dye/wheels/ColorWheel.ts,services/dye/HarmonySelector.ts,data/dyes.json}`,
`packages/worker-kit/src/rate-limiter/backends/cloudflare.ts`, `apps/api-worker/docs/reference/*.md`.

Reviewed late: the first fan-out covered `user-guides/web-app/` and `user-guides/discord-bot/` and
missed this file, which sits directly in `user-guides/`. Read at `0fec18f4`; the candidate was
confirmed by the verifier that also reviewed the `/manual` change (see the report's *Late cluster*).

## Coverage

| file | sections reviewed | result |
|---|---|---|
| `docs/user-guides/public-api.md` | all (Quick Start, Common Use Cases 1–10, Distance Methods, Localization, Response Format, Rate Limiting, CORS, Code Examples, Caching, Dye ID Types, Related) | reviewed |

## Candidates

| cand-id | sev | kind | file:line | one-line claim vs reality | evidence pointer (source path:line) |
|---|---|---|---|---|---|
| PUB-1 | MEDIUM | WRONG | docs/user-guides/public-api.md:296-303 | Example `X-RateLimit-Remaining: 59` implies a normally-decrementing live counter; in production (native binding is bound in both envs) `remaining` is synthetic and is always `limit - 1` (64) while the request is allowed, or `0` when denied — it never counts down through arbitrary values like 59 | apps/api-worker/wrangler.toml:100-102 (`[[env.production.ratelimits]] … simple = { limit = 65, period = 60 }`); packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:188 (`remaining: Math.max(0, tier.limit - 1)`) and :195 (`remaining: 0` when denied); apps/api-worker/CLAUDE.md ("`X-RateLimit-Remaining` is synthetic — `limit - 1` while allowed, `0` when denied — because the Workers Rate Limiting API exposes no live count") |

Only 1 candidate found after a full pass of every concrete claim in the file (endpoints, params, defaults, limits, response/error shapes, examples, rate limits, auth, CORS, caching, links).

## Scope note (requested by the brief)

Every public `/v1/*` route family in source is in fact represented somewhere in this guide's scope:
- `/v1/wheels`, `/v1/wheels/:id` — Common Use Case §10 ("Harmonies on a Colour Wheel").
- `/v1/harmony`, `/v1/harmony/types` — same §10.
- `/v1/chara/resolve`, `/v1/chara/icon/:id` — "Resolve a `.chara` file's equipment (POST)" subsection.
- `/v1/telemetry` — explicitly named and correctly scoped out in the Rate Limiting section ("**not part of the public API**… documented here only so you are not surprised to see it"), matching `apps/api-worker/src/telemetry/router.ts` and the "Deliberately NOT part of the public API" comment at telemetry/router.ts:11.

No MISSING route-family finding to file.

## Positive controls (checked and correct — do not re-chase)

- Base URL `https://data.xivdyetools.app/v1` — apps/api-worker/wrangler.toml:73 (`env.production.routes`, `data.xivdyetools.app`) and index.ts:166-174 (`app.route('/v1/dyes', …)` etc.).
- `GET /v1/dyes/5729` = Snow White by itemID, `GET /v1/dyes/1` = Snow White by stainID — packages/core/src/data/dyes.json:2-9 (`stainID:1, name:"Snow White", legacyItemID:5729`).
- ja localized name "スノウホワイト" for Snow White (doc's Localization example) — packages/core/dyenames.csv:2 (`5729,Snow White ,スノウホワイト,…`).
- Category names `Reds`, `Blues`, `Neutral` are real, exact, case-sensitive values — packages/core/src/data/dyes.json (grep of `"category":` values: Neutral, Reds, Browns, Yellows, Greens, Blues, Purples, Special).
- Boolean filter list (`metallic, pastel, dark, cosmic, ishgardian, vendor, craft, expensive`) + `consolidationType=A|B|C`, `minPrice`/`maxPrice`, `excludeIds` — apps/api-worker/src/lib/validation.ts:419-442 (`DyeQueryFilters`, `parseDyeFilters`) and routes/dyes.ts:298-326.
- Sort fields `name, brightness, saturation, hue, cost` — apps/api-worker/src/lib/validation.ts:45.
- Batch lookup cap of 50 — apps/api-worker/src/routes/dyes.ts:103 (`parseCommaSeparatedIds(…, 50)`).
- `/v1/match/closest` and `/v1/match/within-distance` response shapes (`data.dye.name`, `data.dye.hex`, `data.distance`) used correctly in the JS example — apps/api-worker/src/routes/match.ts:65-69, lib/dye-serializer.ts:58-67.
- Legacy method compatibility: `hyab`/`oklch-weighted` → `ciede2000`, `euclidean` → `rgb`, `kL/kC/kH` ignored, `method` field echoes what was actually used — apps/api-worker/src/lib/validation.ts:395-413 and routes/match.ts:67 (`method,` in response).
- Distance method scales (`rgb` 0–~441.67, `redmean` 0–~765, `distinguish` 0–100 integer) — packages/core/src/services/ColorService.ts:150-171.
- Five colour wheels `rgb` (default), `ryb`, `munsell`, `oklch-hue`, `oklch-lightness` — packages/core/src/services/dye/wheels/ColorWheel.ts:17-25 and `__tests__/registry.test.ts:16-17`.
- Ten harmony types — packages/core/src/constants/index.ts:166-177 (`HARMONY_OFFSETS` has exactly 10 keys).
- `/v1/wheels/:id?stops=` bounds 3–360, default 72 — apps/api-worker/src/routes/wheels.ts:42.
- `/v1/harmony?…&companions=` bounds 0–5, default 0 — apps/api-worker/src/routes/harmony.ts:99.
- Harmony slot fields `targetHex`, `dye`, `distance`, `distanceUnit` (method vs `degrees` when `strict=false`) — apps/api-worker/src/lib/harmony.ts:65-88, routes/harmony.ts:132.
- `.chara` example body (`HeadGear base:361 variant:5`, `MainHand set:634 base:19 variant:1`) uses real, valid slot names and the exact base/variant pair from the code's own doc comment example — packages/core/src/services/chara/chara-models.ts:45-58, 67 (`gearModelKey(361, 5) === 328041`).
- `.chara` resolve: `items.<slot>` nullable, `503 UPSTREAM_UNAVAILABLE` — apps/api-worker/src/chara/resolver.ts:111-140 (items map), chara/router.ts:179-189 (`upstreamDown`).
- Universalis proxy: outside `/v1`, own rate limit **30 req/min per IP** on `/aggregated/*` in production, data-centers/worlds unlimited — apps/api-worker/wrangler.toml:78 (`RATE_LIMIT_REQUESTS = "30"`), src/universalis/router.ts:148-165 (aggregated only calls `checkRateLimit`), :321-376 (data-centers/worlds — no rate-limit call).
- Rate limit config: 60 req/min + 5 burst (effective limit 65), matches header example `X-RateLimit-Limit: 65` — apps/api-worker/src/middleware/rate-limit.ts:31-32, wrangler.toml:100-102.
- `429` carries `Retry-After` header and body `retryAfter` — packages/worker-kit/src/middleware/rate-limit.ts:165,207; apps/api-worker/src/middleware/rate-limit.ts:79 (`retryAfter,` in JSON body).
- `/health` is not rate-limited (registered outside `/v1/*`) — apps/api-worker/src/index.ts:122 (`app.use('/v1/*', rateLimitMiddleware)`) vs :158 (`app.get('/health', …)`).
- `POST /v1/telemetry`: no query, bare 204, own bucket 240/60s no burst, fails closed, own `X-RateLimit-*` headers — apps/api-worker/src/middleware/rate-limit.ts:118-123 (`TELEMETRY_LIMIT`), telemetry/router.ts:53-111.
- CORS `Access-Control-Allow-Origin: *` — apps/api-worker/src/index.ts:100-117 (`cors({ origin: '*', … })`).
- `Cache-Control: public, max-age=3600, s-maxage=86400` on all `GET /v1/*` dye/match/wheel/harmony routes — apps/api-worker/src/routes/dyes.ts, match.ts, wheels.ts, harmony.ts (all use the identical literal).
- Response envelope shape (`success/data/meta`, `meta.requestId`/`apiVersion`/`locale`), pagination shape, error shape (`success:false, error, message, details?, meta`) — apps/api-worker/src/lib/response.ts, src/index.ts:206-253 (`app.onError`).
- Error code `VALIDATION_ERROR` used in the doc's error example is a real code — apps/api-worker/src/lib/api-error.ts:20.
- No auth required, fully public/stateless (no secrets, no D1) — apps/api-worker/CLAUDE.md ("Required Secrets/Optional Secrets: None").
- Links resolve: `../projects/api-worker/endpoints.md`, `../user-guides/discord-bot/getting-started.md`, and the VitePress anchor `developers.xivdyetools.app/reference/dyes#get-v1-dyes-consolidation-groups` — docs/projects/api-worker/endpoints.md (exists), docs/user-guides/discord-bot/getting-started.md (exists), apps/api-worker/docs/reference/dyes.md:125 (`## GET /v1/dyes/consolidation-groups` heading matches the anchor).
- Supported locales `en, ja, de, fr, ko, zh` — apps/api-worker/src/lib/validation.ts:35 (`SUPPORTED_LOCALES` from core), consistent throughout.

## Rejected items (looked wrong, were right)

- Stain ID range table says "1–254" with "125 assigned today" — at first glance this looks like it should be "1–125" but the code genuinely reserves the full Stain-sheet byte range (1–254) while only 125 rows are populated; doc's phrasing already distinguishes range from assigned count correctly. apps/api-worker/src/lib/validation.ts:116-121.
- "Get all dyes" quick-start example (`GET /v1/dyes` with no `perPage`) actually returns only the first 50 (default `perPage`), not literally all 125 — considered as a candidate but rejected: it's a one-line intro example, not a claim about defaults, and the Response Format section correctly documents pagination immediately after.
- Doc's already-known items (page max 1000, `q` max 100 chars, `INVALID_COLOR_WHEEL`/`INVALID_HARMONY_TYPE` codes filed against `endpoints.md`) — confirmed public-api.md does **not** restate any numeric limit for `page`/`q` and does not name either error code, so there is nothing to re-flag here per the brief's instruction.
