# Mechanical sweep: symbols, routes, imports (key `mech-symbols-routes`)

Run 2026-10-11, branch `claude/documentation-audit-787779` @ 42c35e87 (== served 16a6123f for every app). Scope: all 93 living docs in `living-files.txt`. Read-only; this is the only file written.

Method (all against tracked files, `git grep` / `git ls-files`):

- **A** every `ALL_CAPS_WITH_UNDERSCORE` token in backticks (647 occurrences, 193 distinct) checked with `git grep -w` outside `docs/` and `*.md`; only 5 tokens absent from source, all deliberate negations/history (rejected table). Env vars/secrets/bindings for each worker then checked against that worker's `wrangler.toml` and `Env` type (`types/env.ts` / `types.ts`), `.github/workflows/*`, `apps/stoat-worker/src/config.ts`.
- **B** every `METHOD /path` (310 occurrences) plus every bare `/v1/...` and `/api/v1/...` path, checked against a route table built from each worker's router; live routes listed per worker and compared to docs.
- **C** all 57 `import ... from '@xivdyetools/*'` lines in doc code blocks resolved against the package export graph built with the TypeScript compiler API from each `exports`-map entry (`core`, `core/blending`, `types`, `logger` + 3 presets, `test-utils` + 3 subpaths); type-only names checked for `import type`.
- **D** inline `name(` calls (251 distinct), camelCase/PascalCase identifiers in backticks (475 distinct), method calls and functions inside fenced `ts/js` blocks, `Class.method` pairs (checked per class file), backticked repo paths (161) and `src/...` paths in project docs, `pnpm --filter <pkg> <script>` pairs (115, all valid), `--filter` package names.

## Candidates

### cand-mech-01 (LOW, inaccurate): code samples import type-only names with a plain `import { }`
`@xivdyetools/types` exports `Dye`, `RGB`, `HexColor`, `DyeId`, `Hue`, `Saturation`, `JWTPayload`, `AuthProvider`, `PresetPalette`, `CommunityPreset`, `PresetStatus`, `PresetCategory`, `DyeWithDistance`, `FacewearColor`, `HSV`, `HSL`, `LAB` as types only; the base tsconfig has `verbatimModuleSyntax`, and the docs themselves (`contributing.md:76-77`) teach that this is a compile error.
Locations: `docs/projects/types/overview.md:34, 55, 91, 131, 163` (the :163 line also mixes values `createHexColor`/`createDyeId` with types, so needs inline `type` modifiers); `docs/projects/core/overview.md:93, 324`; `docs/CLAUDE.md:155`. (Not filed: `contributing.md:77`, `monorepo-setup.md:145` are deliberate "wrong" examples; `core/overview.md:86` is the labelled v1.x "Before" snippet.)
Evidence: `packages/types/src/index.ts:26` (`export type { RGB, HSV, LAB, OKLAB, OKLCH, LCH, HSL, CMYK }`); export-graph script reports each name as type-only; `docs/developer-guides/contributing.md:76-77`.
Fix: use `import type { ... }`; for core/overview.md:324 and types/overview.md:163 use `import { createHexColor, createDyeId, type HexColor, type DyeId } from '@xivdyetools/types';`.

### cand-mech-02 (MEDIUM, inaccurate): community-presets spec documents HTTP routes and a base URL presets-api does not have
Spec header says "Implemented (December 2025)"; its API section was never marked as draft the way the Discord command section is (`:966-977`).
Locations: `docs/specifications/community-presets.md:311` (`Production: https://presets-api.xivdyetools.workers.dev`; the API is served at `api.xivdyetools.app`), `:41` (diagram `POST /:id/vote`), `:472` (`POST /api/v1/presets/:id/vote`), `:504` (`DELETE /api/v1/presets/:id/vote`), `:519` (`PATCH /api/v1/presets/:id/status`), `:543` (`GET /api/v1/presets/pending`, "Requires moderator authentication").
Truth: votes are `POST /api/v1/votes/:presetId`, `DELETE /api/v1/votes/:presetId`, `GET /api/v1/votes/:presetId/check`; status is `PATCH /api/v1/moderation/:presetId/status`; the pending queue is `GET /api/v1/moderation/pending`. None of the five spec paths is registered.
Evidence: `apps/presets-api/src/index.ts:256-259` (mounts), `apps/presets-api/src/handlers/votes.ts:166,204,232`, `handlers/moderation.ts:148,161`; `docs/projects/presets-api/endpoints.md:230-238,258-262`.
Fix: add the same "draft names, as shipped" callout to the API section, or correct the five paths and the base URL.

### cand-mech-03 (LOW, inaccurate): oauth rate-limit table omits `/auth/xivauth/callback` and says unlisted routes get 30/min
Location: `docs/projects/oauth/endpoints.md:250-262` (table rows `:253-258`, sentence `:260`). Source tiers `/auth/xivauth/callback` at 20/min (longest prefix wins over `/auth/xivauth` 10/min), so GET and POST `/auth/xivauth/callback` do not fall to the 30/min default.
Evidence: `packages/worker-kit/src/rate-limiter/presets/configs.ts:19-33` (`'/auth/xivauth/callback': { maxRequests: 20 }`; also a still-configured `/auth/refresh` entry for a removed route), `:45-51` (`getOAuthLimit`).
Fix: add `GET`/`POST /auth/xivauth/callback | 20/min | 60s` rows.

### cand-mech-04 (LOW, inaccurate/missing): api-worker overview source tree and binding table stale
Locations: `docs/projects/api-worker/overview.md:93` ("memory rate-limiter" under `universalis/services/`) and the Environment Bindings table `:112-124`.
Truth: `universalis/services/rate-limiter.ts` is `selectProxyRateLimiter` over the native `UNIVERSALIS_RATE_LIMITER` / `UNIVERSALIS_SERVICE_RATE_LIMITER` bindings with KV fallback (the per-isolate `MemoryRateLimiter` went with FINDING-011). The table lists `API_RATE_LIMITER`, `TELEMETRY_RATE_LIMITER`, `RATE_LIMIT`, `ANALYTICS`, `ASSETS` but not `SERVICE_RATE_LIMITER`, `UNIVERSALIS_RATE_LIMITER`, `UNIVERSALIS_SERVICE_RATE_LIMITER` (two are named only in the line-62 decisions row; `SERVICE_RATE_LIMITER` appears nowhere in this file), and `RATE_LIMIT` lists only the `api:ip:`/`telemetry:ip:` prefixes (also `api:svc:`, `universalis:ip:`, `universalis:svc:`).
Evidence: `apps/api-worker/src/universalis/services/rate-limiter.ts:1-20`; `apps/api-worker/src/types.ts:5-35`; `apps/api-worker/wrangler.toml:52-86,137-163`; correct table at `docs/developer-guides/environment-variables.md:275-283`.
Fix: replace "memory rate-limiter" with "rate-limiter selector (native binding, KV fallback)"; add the three bindings and the full prefix list.

### cand-mech-05 (LOW, inaccurate): og-worker serves ten tools (Glamour Reader added); docs say nine
Locations: `docs/projects/og-worker/overview.md:112` (quotes `SUPPORTED_TOOLS` with 9 entries and "one `GET /<tool>` handler each"; the Tool Preview Routes table below has no `/glamour` row), `docs/architecture/overview.md:329` ("all nine tools"), `docs/operations/DEPLOY_ENVIRONMENTS.md:31-32` (`<tool>/*` x9 for both routed envs; wrangler declares ten each).
Evidence: `apps/og-worker/src/index.ts:100-111` (`'glamour'` is the tenth entry), `:716-719` (handlers registered per entry), `:889-892` (`/og/glamour/default.png` valid), `apps/og-worker/src/og-data-generator.ts:1083-1086` (glamour default card), `apps/og-worker/wrangler.toml:25-34` beta routes and `:76-86` production routes (`.../glamour/*`).
Fix: add `glamour` to the list and a `/glamour` row (default card only, no share grammar); change nine to ten.

### cand-mech-06 (LOW, inaccurate): web-app components.md names symbols that do not exist
Locations (all `docs/projects/web-app/components.md`): `:37` `clearError()` (base class has `setError()` only); `:136` and `:140` `SecureStorage` (storage-service exports `StorageService`, `NamespacedStorage`, `appStorage`); `:136` `getMarketBoardService()` (only `MarketBoardService.getInstance()`/`resetInstance()` exist); `:158` `AuthService ... consumeReturnTool` (the return tool is read and written inline via `OAUTH_RETURN_TOOL_KEY`; `login(returnPath?, returnTool?)`); `:160` row `resolveCharaGear` (the exported function is `resolveCharaEquipment`); `:163` `MixerBlendingEngine ... blendColors` (module exports functions `blendTwoColors`, `calculateColorDistance`, `findMatchingDyes`, `getContrastColor`; no class, no `blendColors` export); `:164` and `:185` `getCardDisplayOptions` (display-options-helper exports `applyDisplayOptions` only).
Evidence: `apps/web-app/src/components/v4/base-lit-component.ts:93`; `services/storage-service.ts:20,295,344`; `services/market-board-service.ts:133,143`; `services/auth-service.ts:566-575,666,684`; `services/chara-resolve-service.ts:147`; `services/mixer-blending-engine.ts:69,106,128,168`; `services/display-options-helper.ts:97`. `git grep -w` for `clearError`, `SecureStorage`, `getMarketBoardService`, `consumeReturnTool`, `resolveCharaGear`, `getCardDisplayOptions` outside docs returns nothing.
Fix: rename to the real symbols above or drop them.

### cand-mech-07 (LOW, inaccurate): feature roadmap lists `pixelDataToRGB()` as a shipped core helper
Location: `docs/specifications/feature-roadmap.md:286` ("`pixelDataToRGB()` / `pixelDataToRGBFiltered()`"). Only `PaletteService.pixelDataToRGBFiltered` exists (`packages/core/src/services/PaletteService.ts:605`); `git grep -w pixelDataToRGB` finds nothing outside docs.
Fix: list `pixelDataToRGBFiltered()` only.

### cand-mech-08 (LOW, inaccurate): discord-worker overview rendering sample uses non-existent functions and a wrong signature
Location: `docs/projects/discord-worker/overview.md:165-174`. `buildComparisonSvg(dyes)` does not exist (the card is `generateComparisonCard(options)` from `@xivdyetools/svg`, `packages/svg/src/comparison-card.ts:96`); `sendFollowup(interaction, env, { files: [{ name, data }] })` does not exist (it is `sendFollowUp(applicationId, interactionToken, options)` with a single `file: { name, data, contentType }`, `apps/discord-worker/src/utils/discord-api.ts:47-75`). `renderSvgToPng(svg)` is real (`apps/discord-worker/src/services/svg/renderer.ts:78`).
Fix: use the real names/signature or mark the block pseudo-code.

### cand-mech-09 (LOW, inaccurate): service-bindings says presets-api calls the oauth worker for JWT verification
Location: `docs/architecture/service-bindings.md:256` ("Called by: Web app, Presets API (for JWT verification)"). presets-api verifies the HS256 JWT locally with the shared `JWT_SECRET` and shares oauth's `TOKEN_BLACKLIST` KV; it has no binding or fetch to oauth.
Evidence: `apps/presets-api/wrangler.toml:27-38` (only `DISCORD_WORKER` and `IMAGE_WORKER` services), `apps/presets-api/src/middleware/auth.ts:84-111`; `git grep -n "auth.xivdyetools" apps/presets-api/src` finds nothing outside comments.
Fix: "Shares `JWT_SECRET` and the `TOKEN_BLACKLIST` KV with presets-api (no runtime call)".

### cand-mech-10 (LOW, inaccurate): `INTERNAL_WEBHOOK_SECRET` described as an HMAC key
Location: `docs/operations/SECRET_ROTATION.md:45` ("shared HMAC key"). It is a bearer token compared with `timingSafeEqual` (`Authorization: Bearer <secret>`); `api-contracts.md:679` and `environment-variables.md:196` say shared/bearer secret.
Evidence: `apps/discord-worker/src/index.ts:293-340`; `apps/presets-api/src/services/notification-service.ts:279`.
Fix: "shared bearer secret (>= 32 chars in production)".

### cand-mech-11 (LOW, inaccurate): budget spec "Existing APIs" that do not exist
Location: `docs/specifications/budget-aware-suggestions.md:40` (`DyeService.findClosestDyes(hex, count)`: core has `findClosestDye(hex, options)` returning one dye, and `findDyesWithinDistance`) and `:178` ("existing `PriceService` with RedisCacheBackend": no `PriceService`; `RedisCacheBackend` appears only in an `APIService.ts:383` JSDoc example; the roadmap `:143` already says it was never Redis). The body is a design snapshot under an "As shipped" header, so LOW.
Evidence: `packages/core/src/services/DyeService.ts:187`; `git grep -w findClosestDyes` and `-w PriceService` outside docs: none.
Fix: reword as drafted APIs or name `findClosestDye`/`APIService`.

### cand-mech-12 (LOW, missing): live `GET /health` routes not documented
`og-worker` (`apps/og-worker/src/index.ts:566`), `moderation-worker` (`apps/moderation-worker/src/index.ts:143`) and `image-worker` (`apps/image-worker/src/index.ts:121`) each serve `GET /health`, and no living doc defines it (`moderation-worker/overview.md:215` and `IMAGE_WORKER_SPLIT.md:180` mention it only in passing). Already documented: api-worker, presets-api, oauth, discord-worker (`api-contracts.md:778`). Suggested home: a one-line route table in each overview. Optional.

## Positive controls (checked, correct)

- `environment-variables.md` is accurate on every worker: discord-worker Env (secrets/vars/RL_* tiers/service bindings), oauth vars and secrets (`XIVAUTH_*`, `JWT_EXPIRY`), presets-api prod var set incl. `CACHE_PURGE_ZONE_ID`/`JWT_ISSUER`, moderation-worker secrets, og-worker two vars, image-worker `Record<string, never>`, stoat `config.ts` four names, all `namespace_id` values and every `limit/period` (65/240/1300/30/600, dev 60/1200, 100, 25/70), `VITE_*` keys (the only `import.meta.env` reads), `VITE_APP_ENV` read via `process.env`.
- api-worker: all 16 `/v1` routes plus `/`, `/health`, `/universalis/*`, `/api/v2/*` match `index.ts:148-188`; dye ID ranges, 404 messages, `facewearId`/`hex` details, group counts A=85/B=9/C=11/null=20 (`dyes.json`), pagination bounds.
- presets-api and moderation routes in `endpoints.md`/`api-contracts.md` match `index.ts:256-259` and every handler (literal-before-param order); DAILY_* constants 10/10/20/30 match `rate-limit-service.ts:24-45`.
- oauth: `/auth/refresh` is documented as removed everywhere it appears; live set (`/auth/discord`, `/callback` GET+POST, `/xivauth`, `/xivauth/callback` GET+POST, `/me`, `/revoke`, `/`, `/health`) documented.
- discord-worker: `/health`, `POST /`, `/webhooks/preset-submission`, `/webhooks/github`; rate-limit tiers vs `DISCORD_COMMAND_LIMITS` and `LOCAL_COMMAND_LIMITS` (`changelog: 30`).
- Removed names are marked as removed where documented: `notifyModerators` secrets, `createMockD1`, `randomStainId`, `ColorService.blend`, `createLogger`, `evaluateWCAG`, `Result/isOk`, `PaletteExporter`, `apps/maintainer`, `netlify.toml`.
- Every other import line (core: `ColorService`, `DyeService`, `dyeDatabase`, `PaletteService`, `PresetService`, `presetData`, `APIService`, `MemoryCacheBackend`, `LocalizationService`, `SUPPORTED_LOCALES`, `generateHarmonySlots`, the wheel set; logger presets; all test-utils subpath names) resolves in its entry point.
- 115 `pnpm --filter <name> <script>` references resolve to real package names and scripts; 161 backticked repo paths resolve or are explicitly historical/removed; `ColorService`/`PresetService`/web-app service method names resolve.
- CI secrets (`DISCORD_TOKEN`, `MODERATION_DISCORD_TOKEN`, `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID`, `CLOUDFLARE_API_TOKEN_BETA`) exist in the named workflows; `NPM_TOKEN` is correctly described as absent.

## Rejected suspicions

| What | Why |
|---|---|
| `ALLIED_SOCIETY_ACQUISITIONS` (architecture/overview.md:180, versions.md:95,97) | Stated as removed / history rows. |
| `PRICE_TTL`, `STATIC_TTL`, `MAX_ITEMS`, `MAX_RESPONSE_SIZE` (environment-variables.md:251) | Sentence says no such variable exists; the code constant is `MAX_RESPONSE_SIZE_BYTES`. |
| `OklchWeights` (core/overview.md:103) | Inside the list of re-exports removed in core 2.0. |
| `/auth/refresh`, `REFRESH_GRACE_SECONDS` | Documented as a removed route; the constant still exists in `@xivdyetools/auth`. |
| `scripts/migrate-dyes-to-stainids.ts`, `apps/universalis-proxy`, `apps/api-docs`, `apps/web-app/netlify.toml`, `apps/discord-worker/src/services/image/` | History/design-record context, explicitly marked removed or "what moves". |
| `import { Dye }` at contributing.md:77, monorepo-setup.md:145; core/overview.md:86 | Deliberate wrong examples / labelled v1.x snippet. |
| `StainTransient`, `toStartOfWeek`, `headSha`, `verbatimModuleSyntax`, `globalDependencies` | Game sheet, SQL function, GitHub API field, tsconfig/turbo keys. |
| presets-api `GET /__force-error` undocumented | Non-production test route (404s in production). |
| `DISCORD_BOT_TOKEN`, `OWNER_DISCORD_ID`, `MODERATION_WEBHOOK_URL` in SECRET_ROTATION / service-bindings / community-presets | Marked "no longer read by any code, delete" or "not shipped". |
| `ColorService.blend` vs `mixColors*` | Doc says `blend()` does not exist; the `mixColors*` family does. |
| `Grey`/`Analogue`/`centre` rows | Standing rejections (terminology doc, multilingual cells). |
| web-app "10 tools" | Correct; only the og-worker docs lag (cand-05). |

Note outside scope: `apps/api-worker/CLAUDE.md` says CORS is "GET/OPTIONS" while `index.ts:104` allows `GET, POST, OPTIONS`; not a living doc, not filed.

## Per-file coverage

Units are counts of mechanically extracted items per document. "reviewed" means every extracted unit was resolved against source; semantic prose beyond those units belongs to the cluster reviewers.

| path | tier | units (caps/routes/imports/calls/idents/paths) | sections reviewed | result |
|---|---|---|---|---|
| docs/CLAUDE.md | living | 0/0/2/1/0/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-01) |
| docs/README.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/architecture/api-contracts.md | living | 29/54/0/4/6/8 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/architecture/data-flow.md | living | 0/14/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/architecture/dependency-graph.md | living | 0/0/0/0/0/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/architecture/index.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/architecture/overview.md | living | 12/23/0/4/13/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-05) |
| docs/architecture/security-trade-offs.md | living | 2/1/0/3/12/3 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/architecture/service-bindings.md | living | 6/2/1/0/1/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-09) |
| docs/developer-guides/contributing.md | living | 0/0/2/0/2/3 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/deployment.md | living | 4/0/0/0/0/11 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/environment-variables.md | living | 107/6/0/1/5/7 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/index.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/local-setup.md | living | 0/0/0/0/1/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/logging-standards.md | living | 0/0/1/1/3/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/monorepo-setup.md | living | 0/0/2/0/6/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/release-process.md | living | 1/0/0/0/5/7 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/testing.md | living | 4/0/0/21/6/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/developer-guides/troubleshooting.md | living | 3/0/1/0/1/3 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/index.md | living | 7/6/0/3/10/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/maintainer/adding-dyes.md | living | 9/0/1/2/20/8 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/maintainer/dye-maintainer-tool.md | living | 0/0/0/0/0/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/maintainer/index.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/operations/ANALYTICS_QUERIES.md | living | 2/2/0/8/4/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/operations/DEPLOY_ENVIRONMENTS.md | living | 30/0/0/1/0/15 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-05) |
| docs/operations/DOMAIN_DEPRECATION.md | living | 7/0/0/1/0/6 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/operations/IMAGE_WORKER_SPLIT.md | living | 7/3/0/1/0/9 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/operations/MODERATION.md | living | 11/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/operations/OPEN_ITEMS.md | living | 12/3/0/0/4/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/operations/SECRET_ROTATION.md | living | 79/0/0/0/1/3 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-10) |
| docs/operations/index.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/operations/security-remediation-2026-09-15.md | living | 0/0/0/0/1/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/api-worker/endpoints.md | living | 23/35/0/0/31/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/api-worker/overview.md | living | 17/9/0/1/5/3 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-04) |
| docs/projects/core/algorithms.md | living | 6/0/4/12/26/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/core/overview.md | living | 4/0/8/5/36/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-01) |
| docs/projects/core/publishing.md | living | 0/0/0/0/0/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/core/services.md | living | 0/0/5/21/49/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/core/types.md | living | 2/0/3/5/64/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/discord-worker/commands.md | living | 14/2/0/3/10/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/discord-worker/interactions.md | living | 1/4/0/11/1/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/discord-worker/overview.md | living | 34/3/0/1/2/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-08) |
| docs/projects/discord-worker/rendering.md | living | 3/1/0/2/13/5 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/index.md | living | 0/2/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/logger/overview.md | living | 0/0/4/8/25/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/moderation-worker/overview.md | living | 19/1/0/0/5/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/oauth/endpoints.md | living | 13/23/0/4/1/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-03) |
| docs/projects/oauth/jwt.md | living | 5/5/0/1/1/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/oauth/overview.md | living | 10/10/0/0/2/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/oauth/pkce-flow.md | living | 5/10/0/4/2/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/og-worker/overview.md | living | 12/1/0/1/10/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-05) |
| docs/projects/presets-api/database.md | living | 0/4/0/30/2/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/presets-api/endpoints.md | living | 15/37/0/4/5/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/presets-api/moderation.md | living | 5/4/0/3/7/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/presets-api/overview.md | living | 14/2/0/2/1/3 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/presets-api/rate-limiting.md | living | 3/3/0/3/13/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/test-utils/overview.md | living | 2/1/9/7/5/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/types/overview.md | living | 0/0/8/0/12/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-01) |
| docs/projects/universalis-proxy/overview.md | living | 0/0/0/0/0/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/web-app/components.md | living | 14/2/1/78/165/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-06) |
| docs/projects/web-app/overview.md | living | 0/1/0/3/10/4 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/web-app/theming.md | living | 1/0/0/10/8/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/projects/web-app/tools.md | living | 16/0/0/36/152/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/reference/ffxiv-terminology.md | living | 0/1/0/0/32/7 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/reference/glossary.md | living | 3/0/0/2/9/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/reference/index.md | living | 0/0/0/0/0/1 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/specifications/budget-aware-suggestions.md | living | 0/0/0/3/5/2 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-11) |
| docs/specifications/collections.md | living | 0/0/0/0/3/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/specifications/community-presets.md | living | 7/14/0/0/3/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-02) |
| docs/specifications/feature-roadmap.md | living | 1/0/0/9/11/3 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; candidate cand-mech-07) |
| docs/specifications/index.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/specifications/multi-color-extraction.md | living | 0/0/0/0/2/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/specifications/preset-palettes.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/discord-bot/command-reference.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/discord-bot/faq.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/discord-bot/favorites-collections.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/discord-bot/getting-started.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/index.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/public-api.md | living | 0/2/0/0/12/0 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/accessibility.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/budget-suggestions.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/color-harmony.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/community-presets.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/dye-comparison.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/dye-mixer.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/faq.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/favorites-collections.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/getting-started.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/glamour-reader.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/gradient-builder.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/palette-extractor.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/user-guides/web-app/swatch-matcher.md | living | 0/0/0/0/0/0 | all units from sweeps A-D (whole file text scanned by script; no units to resolve) | reviewed (mechanical scope only; no defect found) |
| docs/versions.md | living | 66/19/5/56/0/4 | all units from sweeps A-D (whole file text scanned by script; each unit resolved against source) | reviewed (mechanical scope only; no defect found) |

## Spelling per document (script candidates, American English)

Source: `evidence/american-spelling.txt` restricted to the 93 living docs (422 rows, 54 documents). Excluded as exempt: 13 rows noted glossary or multilingual-row (Grey in names, Analogue and centre in non-English cells) and 3 rows inside quoted material (`architecture/overview.md:24` x2, `budget-suggestions.md:35`). Remaining 406 candidates, dominated by colour/colours (278), behaviour (22), centre/centred (19), normalised/normalise (16), favourite(s) (18), labelled (10). Rows were not individually re-read for further identifier or quotation exemptions; the spelling reviewer confirms. No living-doc candidate is an identifier the code spells British (`git grep favourite` in apps/packages hits only comments and log strings; the KV prefix is `favorites`).

| document | script candidates (after exemptions) |
|---|---|
| docs/versions.md | 41 |
| docs/projects/web-app/tools.md | 39 |
| docs/user-guides/web-app/palette-extractor.md | 28 |
| docs/user-guides/web-app/swatch-matcher.md | 27 |
| docs/projects/web-app/components.md | 19 |
| docs/user-guides/web-app/accessibility.md | 19 |
| docs/user-guides/web-app/color-harmony.md | 18 |
| docs/architecture/overview.md | 14 |
| docs/user-guides/web-app/dye-mixer.md | 14 |
| docs/user-guides/web-app/dye-comparison.md | 13 |
| docs/user-guides/web-app/budget-suggestions.md | 12 |
| docs/user-guides/web-app/getting-started.md | 12 |
| docs/user-guides/web-app/gradient-builder.md | 12 |
| docs/projects/discord-worker/commands.md | 11 |
| docs/projects/api-worker/endpoints.md | 10 |
| docs/user-guides/discord-bot/getting-started.md | 10 |
| docs/index.md | 9 |
| docs/user-guides/discord-bot/command-reference.md | 8 |
| docs/user-guides/web-app/favorites-collections.md | 7 |
| docs/maintainer/adding-dyes.md | 6 |
| docs/projects/discord-worker/overview.md | 5 |
| docs/reference/glossary.md | 5 |
| docs/user-guides/public-api.md | 5 |
| docs/developer-guides/contributing.md | 4 |
| docs/projects/core/algorithms.md | 4 |
| docs/specifications/feature-roadmap.md | 4 |
| docs/user-guides/discord-bot/faq.md | 4 |
| docs/architecture/api-contracts.md | 3 |
| docs/projects/api-worker/overview.md | 3 |
| docs/projects/core/overview.md | 3 |
| docs/projects/core/services.md | 3 |
| docs/user-guides/web-app/faq.md | 3 |
| docs/developer-guides/environment-variables.md | 2 |
| docs/operations/IMAGE_WORKER_SPLIT.md | 2 |
| docs/projects/core/types.md | 2 |
| docs/projects/discord-worker/interactions.md | 2 |
| docs/projects/index.md | 2 |
| docs/projects/og-worker/overview.md | 2 |
| docs/projects/web-app/overview.md | 2 |
| docs/reference/ffxiv-terminology.md | 2 |
| docs/specifications/index.md | 2 |
| docs/architecture/data-flow.md | 1 |
| docs/developer-guides/release-process.md | 1 |
| docs/developer-guides/troubleshooting.md | 1 |
| docs/operations/OPEN_ITEMS.md | 1 |
| docs/projects/discord-worker/rendering.md | 1 |
| docs/projects/oauth/endpoints.md | 1 |
| docs/projects/oauth/jwt.md | 1 |
| docs/projects/presets-api/endpoints.md | 1 |
| docs/projects/types/overview.md | 1 |
| docs/reference/index.md | 1 |
| docs/specifications/collections.md | 1 |
| docs/specifications/multi-color-extraction.md | 1 |
| docs/user-guides/discord-bot/favorites-collections.md | 1 |
