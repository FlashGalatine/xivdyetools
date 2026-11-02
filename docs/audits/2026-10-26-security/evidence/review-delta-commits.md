# Review: delta-commits (cross-unit), 2026-10-26

Scope: `git diff 0ab33466 HEAD` (base of the 2026-10-03 audit to HEAD 13c386e5), filtered to code
that touches auth, signing, rate limiting, CORS, headers, logging, storage, request parsing, caches,
routes, wrangler.toml, workflows and dependencies. Docs-, changelog- and test-only changes were
skipped. The xivcharakit feature itself (core /chara, web-app worker, bot-logic /swatch and
/glamour, api-worker /v1/chara caches) belongs to other reviewers; only its cross-cutting side
effects (build config, CSP, dependency graph) were looked at here.

Result: **no candidate findings.** Every security-relevant hunk read either tightens a control or
fixes a previously filed finding. No regression of a 2026-10-03 finding was found.

## Change table (security-relevant hunks read)

| Area | Files | Change | Verdict |
|---|---|---|---|
| auth pkg | packages/auth/src/jwt.ts | JSDoc only (JWTPayload is a local, narrower type) | no behavior change |
| worker-kit body guards | packages/worker-kit/src/body-guards/body-guards.ts:43-55,129 | JSON media type matched case-insensitively plus `+json`; never narrower than the old substring test | tightened (BUG-149) |
| worker-kit rate-limit middleware | packages/worker-kit/src/middleware/rate-limit.ts:97-111,195,240 | custom 429 bodies keep computed Retry-After / X-RateLimit headers | tightened (BUG-150) |
| worker-kit KV limiter | packages/worker-kit/src/rate-limiter/backends/kv.ts:277-312 | reset pages the KV cursor; chunked deletes | correctness, no exposure |
| logger | packages/logger/src/core/base-logger.ts:367-381,445-535,797-848 | own `toJSON` stripped, `toJSON` results redacted, free-text scrub of nested strings, linear JWT scan replaces quadratic regex, fan-out/depth caps | tightened (BUG-140/141) |
| oauth | apps/oauth/src/constants/oauth.ts:14-24; src/index.ts:184-241; src/middleware/body-validation.ts:43-73; handlers/callback.ts:64-77; handlers/xivauth.ts:95-108,311-375 | retired projectgalatine origin removed from redirect+CORS allowlist; rate-limit key on decoded path; 415 gate on JSON callbacks; non-object body 400; roster elements type-checked | FINDING-006 fixed, tightened |
| oauth wrangler | apps/oauth/wrangler.toml:6-11,42-49 | retired custom domain removed; `[observability] enabled = false` | FINDING-006/022 fixed |
| presets-api auth/ban | apps/presets-api/src/middleware/auth.ts:369-375; middleware/ban-check.ts:48-64,147 | ban matches acting id, JWT sub and JWT discord_id against discord_id OR xivauth_id, all bound | FINDING-014 fixed |
| presets-api re-key | apps/presets-api/src/services/identity-rekey-service.ts:39-71; handlers/presets.ts:334-401 | sub->snowflake move only from ids proven by one verified JWT; every statement ban-guarded; one batch; fromId===toId no-op | no new authz path |
| presets-api body | apps/presets-api/src/utils/request-body.ts:22-33 | non-object JSON answered as invalid | tightened (BUG-064) |
| presets-api retention | apps/presets-api/src/retention-job.ts; services/moderation-retention-service.ts; migrations/0015_rewrite_legacy_dead_letters.sql | daily prune, logs counts only; legacy dead letters rewritten to `{type, preset_id, moderation_status}` | FINDING-005/017 data minimization |
| presets-api CORS | apps/presets-api/wrangler.toml:76 | projectgalatine origin removed from ADDITIONAL_CORS_ORIGINS | narrowed |
| discord-worker webhook | apps/discord-worker/src/index.ts:308-323 | production refuses `INTERNAL_WEBHOOK_SECRET` < 32 chars with 503 before comparison | FINDING-027 fixed |
| discord-worker webhook payload | apps/discord-worker/src/index.ts:171-185,427-477 | `edited_from` / `previous_values` shape-checked before use; only preset id/source/isEdit logged | no new logging of user text |
| discord-worker REST | apps/discord-worker/src/utils/discord-api.ts:336-389 | new delete-original helper; only caller budget.ts:213 passes the request logger | no new leak |
| discord-worker /stats | apps/discord-worker/src/handlers/commands/stats.ts (-170 lines) | preference sampling removed; no `kv.list` left in any app src | FINDING-013 fixed |
| moderation-worker | apps/moderation-worker/src/index.ts:321,397,500-515; middleware/rate-limit.ts; utils/discord-api.ts:106-143 | dead pass-through middleware removed; unban autocomplete offers xivauth_id rows; follow-up helper logs status + Discord error body | no exposure change |
| og-worker | apps/og-worker/src/crawler-detector.ts:59-84 | userAgent no longer carried in CrawlerInfo | narrowed |
| api-worker Universalis limiter | apps/api-worker/src/universalis/router.ts:136-188; services/rate-limiter.ts:72-123; wrangler.toml:73-87,154-163 | per-isolate memory limiter replaced by native UNIVERSALIS_* bindings (KV fallback), charged on cache misses only; backend logs key scope, not IP | FINDING-011 fixed; KV fallback disclosed (apps/web-app/PRIVACY.md:224-228) |
| api-worker telemetry | apps/api-worker/src/index.ts:122-131 | single `/v1/telemetry/*` registration (no double charge), subtree still limited | correctness |
| api-worker validation | apps/api-worker/src/lib/validation.ts:188-256 | strict decimal integer/float parsing | tightened (BUG-038) |
| api-worker icons | apps/api-worker/src/chara/icons.ts:15-67 | Content-Length + streamed cap, PNG magic check, 304 only with retained ETag | bounded (detail: api-worker-chara reviewer) |
| core APIService | packages/core/src/services/APIService.ts (sanitizeDataCenterId, dataCenterPathSegment) | DC sanitizer widened to `\p{L}\p{N}` but output is `encodeURIComponent`-ed and the proxy re-validates against its DC/world list | no path injection (`.`, `/` are not letters/numbers) |
| web-app _headers | apps/web-app/public/_headers:7-46,116-124 | CSP unchanged (`script-src 'self'`, no worker-src needed: same-origin module worker under /assets); new `/licenses/*` rule is a distinct pattern, merged not replacing `/*` | no weakening |
| web-app beta branding | apps/web-app/vite-plugin-beta-branding.ts:63-73; src/shared/beta-branding.ts:122-135 | robots header inserted inside `/*`; build throws on any repeated pattern or missing `/*` | FINDING-001 fixed, guarded |
| web-app worker build | apps/web-app/vite.config.ts:53-62; src/services/chara-inspection-service.ts:291-309 | `worker.format: 'es'`, minified; `new Worker(new URL(..., import.meta.url))` same-origin; dedicated worker messaging (no cross-origin postMessage) | CSP-compatible |
| web-app logout | apps/web-app/src/services/auth-service.ts (performLogout) | storage/state cleared synchronously first, revoke fire-and-forget with 5 s timeout | logout clears regardless of network |
| wrangler (all 7 CF workers) | apps/*/wrangler.toml | `[observability] enabled = false` top-level and `[env.production.observability]`; retired projectgalatine custom domains removed; presets-api cron production-only | FINDING-022/006 fixed |
| CI | .github/workflows/ci.yml:53-55,94-96,288-294 | per-PR cancel only; full-tree audit report-only step; `pnpm workers:check-logs` gate (scripts/check-worker-logs.ts:98-117 also rejects logpush / tail_consumers) | tightened |
| beta deploys | .github/workflows/deploy-{web-app,og-worker,discord-worker}-beta.yml | `changes` guard job (read-only git diff, contents: read), per-ref + job-level shared concurrency; still `environment: beta` + CLOUDFLARE_API_TOKEN_BETA | no secret widening |
| publish | .github/workflows/publish-packages.yml:152-211 | skips dependents of a failed / unpublished @xivdyetools dep; OIDC + provenance unchanged | correctness |
| sync-dye-emojis | .github/workflows/sync-dye-emojis.yml:36,53 | job runs in `environment: production`, so DISCORD_TOKEN is the main-only environment secret | FINDING-023 direction |
| actions pins | ci.yml, deploy-*.yml, publish-packages.yml | setup-node / upload-artifact bumps, still full SHA pins | unchanged policy |
| dependencies | packages/core/package.json (`xivcharakit: 0.1.0-beta.4`); pnpm-lock.yaml:4048-4049,7149; pnpm-workspace.yaml (seroval >=1.6.3, miniflare>undici >=7.29.1 <8, source-map-js >=1.2.2; `qs` floor dropped) | xivcharakit exact-pinned, integrity hash, zero transitive deps; `qs` no longer in the lockfile; other bumps are patch/minor of existing deps; minimumReleaseAge 1440 kept (pnpm-workspace.yaml:59) | no new transitive surface |
| secrets in diff | added lines across the delta (excluding data JSON / lockfile / fonts) | secret-shape scan hit test fixtures only | none |

## Positive controls (new since 2026-10-03)

- Ban enforcement now matches every id a verified session proves, in both ban columns, bound parameters only (apps/presets-api/src/middleware/ban-check.ts:48-64).
- Identity re-key moves rows only between two ids from one verified JWT and re-checks the ban inside every statement of one D1 batch (apps/presets-api/src/services/identity-rekey-service.ts:21-71).
- Webhook bearer secret has a production length floor that fails closed per-route (apps/discord-worker/src/index.ts:308-323).
- oauth: retired origin gone from redirect and CORS allowlists (apps/oauth/src/constants/oauth.ts:14-24); 415 gate so the depth / `__proto__` guard always sees callback bodies (apps/oauth/src/middleware/body-validation.ts:55-73).
- Shared body guard matches JSON media types case-insensitively and fails safe (packages/worker-kit/src/body-guards/body-guards.ts:43-55).
- Logger: `toJSON` can no longer smuggle unredacted values; JWT detection is linear-time (packages/logger/src/core/base-logger.ts:367-381,797-848).
- Workers Logs pinned off in every wrangler.toml and asserted in CI (scripts/check-worker-logs.ts:98-117; .github/workflows/ci.yml:288-294).
- Beta `_headers` can no longer lose the `/*` security rule: insertion in place plus a duplicate-pattern build failure (apps/web-app/vite-plugin-beta-branding.ts:63-73).
- Universalis proxy limiter is per colo through native bindings, charged on cache misses, logs no IP (apps/api-worker/src/universalis/services/rate-limiter.ts:72-102).
- Legacy dead letters holding author id / name / preset text are rewritten to ids only (apps/presets-api/migrations/0015_rewrite_legacy_dead_letters.sql:8).
- New runtime dependency xivcharakit is exact-pinned with no transitive dependencies (pnpm-lock.yaml:4048-4049,7149).

## Rejected (checked, not filed)

- **core `sanitizeDataCenterId` widened to Unicode letters/digits** - output is `encodeURIComponent`-ed and the proxy validates DC/world names against its list; `.` and `/` stay excluded.
- **Universalis limiter KV fallback stores the client IP in a KV key** - fallback only when the binding is unbound (both are declared for production, wrangler.toml:73-87,154-163) and disclosed with its 120 s lifetime (apps/web-app/PRIVACY.md:224-228).
- **Universalis limiter fails open** - accepted trade-off (security-trade-offs.md: fail-open rate limiting); cache + coalescer are the upstream protection.
- **oauth rate-limit bucket per unmatched path, key not length-bounded** - pre-existing path keying, documented in apps/oauth/CLAUDE.md; the delta only switched to the decoded path (apps/oauth/src/index.ts:184-187), which narrows bucket splitting.
- **presets-api still allows `https://xiv-colorexplorer.pages.dev`** - not introduced by the delta (unchanged since before 0ab33466; reviewed in 2026-08-21/08-29/10-03 presets-api evidence); tokens live in per-origin localStorage, so CORS trust alone exposes no token.
- **moderation-worker logs a malformed modal `custom_id`** - moderator-only interaction, custom_id is bot-generated id/revision text, no personal field.
- **discord-worker delete-original console fallback logs the raw error** - the only caller passes the request logger (apps/discord-worker/src/handlers/commands/budget.ts:213-217), so the sanitizing logger path is taken.
- **web-app logout no longer awaits `/auth/revoke`** - local token is cleared first in all cases; a failed revoke leaves the same 1 h server-side validity as before.
- **CSP lacks `worker-src`** - falls back to `script-src 'self'`; the inspection worker is a same-origin module under /assets.
- **No validateEnv in api-worker for the new UNIVERSALIS_* bindings** - same pre-existing pattern as API_RATE_LIMITER; degradation is to the disclosed KV fallback, not to no limit.

## Files covered

46 files read at diff or source level, in: .github/workflows/ (ci, publish-packages, sync-dye-emojis, deploy-api-worker, deploy-*-beta); scripts/ (check-worker-logs.ts); packages/auth/src, packages/worker-kit/src/{body-guards,middleware,rate-limiter/backends}, packages/logger/src/core, packages/core/src/services (APIService); apps/oauth/src/{constants,handlers,middleware,index.ts}, apps/oauth/wrangler.toml; apps/presets-api/src/{middleware,handlers/presets.ts,services/identity-rekey-service.ts,services/notification-service.ts,utils/request-body.ts,index.ts}, apps/presets-api/migrations/0015, apps/presets-api/wrangler.toml; apps/discord-worker/src/{index.ts,utils/discord-api.ts,handlers/commands/budget.ts,handlers/commands/stats.ts}, apps/discord-worker/wrangler.toml; apps/moderation-worker/src/{index.ts,middleware/rate-limit.ts,utils/discord-api.ts}, wrangler.toml; apps/api-worker/src/{index.ts,lib/validation.ts,universalis/router.ts,universalis/services/rate-limiter.ts,chara/icons.ts}, wrangler.toml; apps/og-worker/src/crawler-detector.ts, wrangler.toml; apps/image-worker/src/index.ts, wrangler.toml; apps/web-app/{public/_headers,vite.config.ts,vite-plugin-beta-branding.ts,src/shared/beta-branding.ts,src/services/auth-service.ts,src/services/chara-inspection-service.ts}; root package.json, pnpm-workspace.yaml, pnpm-lock.yaml (xivcharakit, qs, seroval entries); all apps/*/package.json and packages/*/package.json manifests (dependency hunks).

## Not covered (budget)

- moderation-worker review-message.ts (+333), preset-moderation.ts (+367) and preset-rejection.ts (+363) bodies, and packages/types/src/preset/review-custom-id.ts (+200): left to the moderation-worker reviewer.
- og-worker index.ts / og-params.ts / og-data-generator.ts hunks: left to the og-worker reviewer.
- presets-api handlers/moderation.ts (+234) and validation-service.ts hunks: left to the presets-api reviewers.
- api-worker chara router.ts / xivapi.ts / lookup-loader.ts / cache.ts / icon-cache.ts: left to the api-worker-chara reviewer.
- web-app component diffs (swatch-tool, gradient-tool, result-card, v4-layout-shell): left to the web-app sinks reviewer.
