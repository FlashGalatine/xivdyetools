# Review: api-worker cluster (2026-10-11, HEAD 42c35e87, served 16a6123f)

## Coverage
| path | tier | units | sections reviewed | result |
|---|---|---|---|---|
| docs/projects/api-worker/endpoints.md | living | apps/api-worker, core | all 567 lines vs src/index.ts, routes/*, lib/*, chara/*, telemetry/*, universalis/*, wrangler.toml | reviewed |
| docs/projects/api-worker/overview.md | living | apps/api-worker | all 183 lines vs wrangler.toml, types.ts, middleware/rate-limit.ts, package.json scripts, scripts/ | reviewed |
| docs/projects/universalis-proxy/overview.md | living (stub) | api-worker/src/universalis | all 6 lines; pointer only, target path exists | reviewed |
| docs/user-guides/public-api.md | living | apps/api-worker | all 412 lines; examples vs routes, anchors checked by hand | reviewed |

## Candidates
- cand-api-worker-01 MEDIUM missing: overview.md:62,111-125 omit the SERVICE_RATE_LIMITER binding (1300/60 s, KV prefix `api:svc:`) that gates all IP-less service-binding callers on /v1/*; UNIVERSALIS_RATE_LIMITER and UNIVERSALIS_SERVICE_RATE_LIMITER appear only in the Rate Limiting row, not the bindings table; RATE_LIMIT KV row lists only `api:ip:`/`telemetry:ip:`; line 125 says discord-worker's binding targets only `/api/v2/aggregated/...`, but /glamour calls POST /v1/chara/resolve over it. Evidence: wrangler.toml:56-61 (SERVICE_RATE_LIMITER), src/types.ts:17-22, src/middleware/rate-limit.ts:55-82, apps/discord-worker/src/handlers/commands/glamour.ts:8,43.
- cand-api-worker-02 MEDIUM missing: endpoints.md:365 lists the per-slot answer as `{ itemId, names, iconId, familySize, alternates[], viaMainHand, acquisition?, retired? }` - no `rules[]`, no mention of the top-level `{ version, items, glasses? }` shape or the glasses object `{ id, names, iconId, acquisition? }`, nor the 8-alternate cap. Evidence: src/chara/types.ts:44-104 (`rules: CharaTwinRules[]` always present), resolver.ts:42 (MAX_ALTERNATES=8); apps/api-worker/docs/reference/chara.md:67 documents `rules`.
- cand-api-worker-03 LOW inaccurate: endpoints.md:407 "bare { error } with the upstream status code" and :415 "other upstream statuses forwarded". Only 400/404/429/500/503 pass through; every other upstream status (incl. 3xx, 502) becomes 502; several bodies also carry `message`; validation 400s (`Invalid datacenter or world name`, `Invalid itemIds parameter`, count 1-100, `invalidIds`) are not listed. Evidence: src/universalis/router.ts:93-101, 189-218, 253-262.
- cand-api-worker-04 LOW label: endpoints.md:361 quotes "Dyes on this glamour"; the shipped label is `DYES ON THIS GLAMOUR`. Evidence: apps/web-app/src/locales/en.json:1180 (`equipHead`).
- cand-api-worker-05 LOW missing: since 0.17.0 numeric/id parsing is strict, but endpoints.md:79-83,143 and the parameter tables do not say so: ids must match `^-?[1-9]\d{0,9}$` (`/v1/dyes/0`, `1e3`, `+5729`, `007` -> 400 VALIDATION_ERROR), integers reject `1e2`/`50.9`/` 7`, invalid `consolidationType` -> 400, icon id outside canonical 1-999999 -> 400 VALIDATION_ERROR (endpoints.md:369 lists only 404/503). Evidence: src/lib/validation.ts:204-215 (DECIMAL_INTEGER), :323-333 (CANONICAL_DYE_ID), src/chara/router.ts:50, :236-244, routes/dyes.ts:225-233; apps/api-worker/docs/guide/errors.md:22 states it.
- cand-api-worker-06 LOW spelling (supersedes 2026-09-21-documentation/DOC-003): 20 confirmed British spellings in 3 documents - endpoints.md 10, public-api.md 7, overview.md 3.

## Priors
- DOC-003: STILL_PRESENT (endpoints.md 10 as before; public-api.md 5 prose + 2 code-comment = 7; overview.md 3).

## Seed 1 (api-worker 0.16 -> 0.18.0)
Checked: lazy tables (endpoints.md:365 "loaded lazily"), strict numeric params (cand-05 gap), acquisition (365), retired-family response (365, matches types.ts:96-103), patch-aware cache (365 "latest ... about every 10 minutes", xivapi.ts:143). Telemetry single charge: 240/60 s doc matches rate-limit.ts. Only gaps are cand-01, 02, 05.

## Positive controls
Route count 16 (14 GET, 2 POST) matches index.ts mounts; dye counts (Blues 20, Browns 19, Neutral 6; groups A 85 / unconsolidated 20) match dyes.json; Snow White/Coral Pink example fields match; 10 harmony types, 5 wheels + tags, `stops` 3-360, companions 0-5, limit 1-125, page 1-1000, perPage 1-200, q<=100 chars all match; Universalis TTLs 300+120 / 24 h+6 h, 5 MB cap, 1-100 ids, 20x service budget (600/1200) match; telemetry origins/caps (25 events, 16 KB, 240/60) match; deploy scripts and docs:dev/build:docs exist; anchors `#universalis-market-board-proxy`, `#response-format`, `#9-market-prices-universalis-proxy` resolve; scripts/build-acquisition.ts and build-item-names.mjs exist.

## Rejected
- public-api.md:174,308 "30 requests/min per IP" on aggregated: charged on cache misses only, but the doc is a summary; not misleading enough.
- endpoints.md:549 `stainID` typed "integer" while ApiDye is `number|null`: stainID is always set for current dyes.
- public-api.md heading numbering (unnumbered .chara section before 7): navigation nit.
- endpoints.md:369 "80 px _hr1": cannot verify pixel size from source (xivapi.ts:117 only shows the `_hr1` asset).

## Spelling per document (confirmed 20)
| doc | count | lines |
|---|---|---|
| docs/projects/api-worker/endpoints.md | 10 | 283,373,375,394,396,397,398,430,432,504 |
| docs/user-guides/public-api.md | 7 | 45,46,189,191,205 + code-comment prose 196,201 |
| docs/projects/api-worker/overview.md | 3 | 142,144,159 |
Rejects: none. Extras 196/201 are English prose in shell comments, so confirmed. No additional British spellings found by manual sweep.
