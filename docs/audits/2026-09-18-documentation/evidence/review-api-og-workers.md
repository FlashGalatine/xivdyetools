# Cluster review: api-og-workers

Scope: `docs/projects/api-worker/overview.md`, `docs/projects/api-worker/endpoints.md`,
`docs/projects/og-worker/overview.md`, `docs/projects/universalis-proxy/overview.md`,
`docs/projects/index.md`, checked against `apps/api-worker/`, `apps/og-worker/`,
`apps/image-worker/` (where mentioned) in this worktree (`origin/main` @ `0fec18f4`).

## Coverage table

| file | sections reviewed | result |
|---|---|---|
| `docs/projects/api-worker/overview.md` | all (What is / Quick Start / Architecture / Key Design Decisions / Source Structure / Dependencies / Env Bindings / Dye ID Auto-Detection / What is on /v1 / Still unbuilt / Related Docs) | reviewed |
| `docs/projects/api-worker/endpoints.md` | all (Health / Dyes ×7 / Match ×2 / Chara ×2 / Harmony+Wheels ×4 / Universalis ×3 / Internal telemetry / Response Format / Error Codes / Headers / Dye Object Schema) | reviewed |
| `docs/projects/og-worker/overview.md` | all (What is / Quick Start / Supported Platforms / Architecture / Routes / Query Parameters / Generated Metadata / Image Templates / Tech Stack / Caching / Env Bindings / Analytics / Related Docs) | reviewed |
| `docs/projects/universalis-proxy/overview.md` | entire file (redirect stub, 7 lines) | reviewed |
| `docs/projects/index.md` | all (Comparison Matrix / Architecture Layers diagram / Quick Links / Versions / Related Docs) | reviewed |

Source files opened: `apps/api-worker/src/index.ts`, `routes/{dyes,match,wheels,harmony}.ts`,
`middleware/rate-limit.ts`, `lib/{validation,api-error,response,dye-serializer}.ts`,
`telemetry/{router,origin,schema}.ts`, `chara/{router,cache}.ts`, `universalis/{router,config/cache,services/rate-limiter}.ts`,
`wrangler.toml`, `apps/api-worker/docs/reference/*` + `.vitepress/theme/lib/endpoints.ts`;
`apps/og-worker/src/index.ts`, `og-params.ts`, `og-data-generator.ts`, `crawler-detector.ts`,
`wrangler.toml`; `apps/image-worker/src/index.ts` (routes only, for the index.md row);
`packages/worker-kit/src/rate-limiter/{headers,backends/cloudflare}.ts`;
`packages/core/src/config/consolidated-ids.ts`; `packages/types/src/dye/dye.ts`.
All relative links in the five documents were resolved with `git ls-files` (33 distinct targets
checked across `index.md`, plus the in-text references in `overview.md`/`endpoints.md`) — all
resolve.

## Candidates

### C1 — MISSING: Error Codes table omits INVALID_COLOR_WHEEL / INVALID_HARMONY_TYPE
Severity: MEDIUM
File: `docs/projects/api-worker/endpoints.md:494-508` (the "Error Codes" reference table, the
page whose job is to enumerate every error code the API returns).
Claim vs reality: the table lists 11 codes (`VALIDATION_ERROR`, `MISSING_PARAMETER`,
`INVALID_HEX`, `INVALID_MATCHING_METHOD`, `INVALID_LOCALE`, `INVALID_STAIN_ID`, `NOT_FOUND`,
`RATE_LIMITED`, `INVALID_BODY`, `INTERNAL_ERROR`, `UPSTREAM_UNAVAILABLE`) but omits
`INVALID_COLOR_WHEEL` and `INVALID_HARMONY_TYPE`, both of which are real, currently-thrown 400
codes documented inline elsewhere on the very same page (`GET /v1/wheels/:id`: "Unknown id → `400
INVALID_COLOR_WHEEL`", line 383; `GET /v1/harmony`: "unknown → `400 INVALID_HARMONY_TYPE`", line
395/396).
Evidence: `apps/api-worker/src/lib/api-error.ts:26-29` defines both codes; thrown at
`apps/api-worker/src/lib/validation.ts:73-79` (`parseColorWheel`) and `:87-93`
(`parseHarmonyType`), both reachable from `routes/wheels.ts:41` and `routes/harmony.ts:95-96`.

### C2 — MISSING: `/v1/dyes` `page` parameter's upper bound not documented
Severity: LOW
File: `docs/projects/api-worker/endpoints.md:48` (Query Parameters table for `GET /v1/dyes`).
Claim vs reality: the table lists `page | integer | 1 | Page number (min 1)` — no upper bound is
stated, but the route enforces `max: MAX_PAGE` (1000) and returns a 400
(`VALIDATION_ERROR`, "must be <= 1000") past that.
Evidence: `apps/api-worker/src/routes/dyes.ts:47` (`MAX_PAGE = 1000`) and `:289`
(`parseIntParam(..., { min: 1, max: MAX_PAGE, defaultValue: 1 })`).

### C3 — MISSING: `/v1/dyes/search` `q` max length not documented
Severity: LOW
File: `docs/projects/api-worker/endpoints.md:151-154` (Query Parameters table for
`GET /v1/dyes/search`).
Claim vs reality: `q` is documented only as "Search query (case-insensitive substring match)" with
no length bound, but the route 400s (`VALIDATION_ERROR`) any query over 100 characters.
Evidence: `apps/api-worker/src/routes/dyes.ts:45` (`MAX_SEARCH_QUERY_CHARS = 100`) and `:57-63`.

## Positive controls (verified correct — do not re-chase)

- `/v1/*` rate limit 60+5 burst=65, native `API_RATE_LIMITER` binding fail-open, `RATE_LIMIT` KV
  fallback; `POST /v1/telemetry` on its own `TELEMETRY_RATE_LIMITER` (240/60s) that fails
  **closed** — `apps/api-worker/src/middleware/rate-limit.ts:31-32,64-169`, matches
  `overview.md:62` and `endpoints.md:436`.
- `X-RateLimit-Remaining` is synthetic (`limit - 1` allowed / `0` denied, per-colo, not a live
  counter) — `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:186-199`, matches
  `endpoints.md:528-531`.
- Universalis proxy: `/aggregated` cached 300s+120s SWR, `/data-centers` and `/worlds` cached
  86400s+21600s SWR, production per-IP limiter 30/60s (dev 60/60s), errors `502`/`429` with the
  exact bare-`{error}` bodies documented — `apps/api-worker/src/universalis/{router.ts,
  config/cache.ts}`, `wrangler.toml` prod vars, matches `endpoints.md:405-415` and
  `overview.md:62`.
- Dye ID auto-detection ranges (1-254 stain, ≥5729 item, 255-5728 invalid, <0 legacy Facewear
  404-with-guidance) and the consolidated-market-ID (52254-52256) explanatory 404 — matches
  `apps/api-worker/src/lib/validation.ts:116-121` and `routes/dyes.ts:220-257`.
- Consolidation groups: A=52254 (85 ARR dyes), B=52255 (9 Ishgardian), C=52256 (11 Cosmic),
  105 consolidated + 20 unconsolidated = 125 — matches `packages/core/src/config/consolidated-ids.ts`
  and the illustrative counts in `endpoints.md:237-249`.
- `.chara` resolve: body cap 8 KB (`413`), icon cache `public, max-age=2592000, immutable`,
  per-(slot,key) cache ~7 days (`CHARA_CACHE_CONFIG.cacheTtl = 7*24*60*60`), `503
  UPSTREAM_UNAVAILABLE` on XIVAPI outage — matches `chara/router.ts:44-53`, `chara/cache.ts:20-24`,
  `endpoints.md:365-369`.
- `/v1/wheels`, `/v1/wheels/:id`, `/v1/harmony/types`, `/v1/harmony` shapes, defaults (`wheel`
  default `rgb`, `type` default `complementary`, `strict` default `true`, `companions` 0-5 default
  `0`) and error behaviour all match `routes/wheels.ts`, `routes/harmony.ts`, `lib/validation.ts`.
- `Dye Object Schema` table's `id` field ("same as itemID") is correct: `DyeDatabase.ts:216` sets
  `normalizedDye.id = normalizedDye.itemID` at init — `packages/types/src/dye/dye.ts:50-57`.
- og-worker: all 9 `SUPPORTED_TOOLS`, the `/presets/:presetId` path-form route, all 11 `/og/*`
  image route patterns, the 5-key `OG_ALLOWED_QUERY_KEYS` allowlist (`lang,frame,algo,mode,wheel`)
  and their per-route readers, all match `apps/og-worker/src/index.ts` exactly.
- og-worker share-URL parameter grammars for every tool (harmony `?dye=&harmony=&algo=&wheel=`
  with no `perceptual`; swatch `?slot=/?sheet=&i=` + `?hex=/?color=` fallback; budget `?dye=` only,
  no `?hex=`; presets path-id) — matches `apps/og-worker/src/og-data-generator.ts` case-by-case.
- og-worker caching TTLs (HTML 1h/24h, PNG 24h/7d) and env bindings (`ANALYTICS`, `APP_BASE_URL`,
  `OG_IMAGE_BASE_URL`) match `wrangler.toml` and `index.ts`.
- `docs/projects/index.md`'s "9 apps, 8 packages" and the list of each match `apps/*` and
  `packages/*` on disk exactly; `api-docs` and `universalis-proxy` do not exist as apps (confirmed
  absent from `apps/`); all 33+ relative links in the five reviewed documents resolve.
- `index.md` carries no current-version numbers (per the doc-tier rule) — confirmed by full read.
- `apps/image-worker`'s row in `index.md` ("POST /extract ... POST /thumbnail ... service binding
  only") matches `apps/image-worker/src/index.ts:135,185` and its "no public routes" comment.

## Rejected items (looked wrong, were right)

- Doc claims `stainID` is always a plain integer in the Dye Object Schema table, while
  `ApiDye.stainID` is typed `number | null` in `dye-serializer.ts`. **Rejected**: every dye that
  reaches a route handler comes from `DyeDatabase.initialize()`, which the `Dye` type's own comment
  (`packages/types/src/dye/dye.ts:41-44`) guarantees always populates `stainID`; the `null` arm
  exists only for legacy fixtures never reached from a live API route.
- `og-worker/overview.md`'s "Supported Platforms" table looked like it might contradict the code
  since `og:image` doesn't vary by crawler type. **Rejected**: `og:image` is always the Discord
  frame and `twitter:image` always carries `?frame=x` regardless of which crawler fetched the page —
  the table's per-platform framing describes which *meta tag* each platform reads, not a per-crawler
  branch in the code, and that's exactly what `generateOGHTML` does.
- The historical version markers ("Since api-worker 0.14.0 (core 5.2.0, PR #167)" in
  `endpoints.md:375`) look stale against the current `apps/api-worker/package.json` version
  (0.14.2) and `packages/core/package.json` (5.3.0). **Rejected**: per the audit brief's version
  rule, mentioning a *past* release elsewhere is allowed — these are historical "since" markers,
  not claims about the current version.
