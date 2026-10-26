# Review: presets-api routes (2026-10-26 security audit, key `presets-api-routes`)

Checkout HEAD 13c386e5, presets-api 2.6.1. Read-only; no probes were run. Every line number below is from this checkout.

## 1. Route table and authz matrix

Global chain (index.ts): requestId → logger (UA off) → validateEnv (500 in production on bad config, :63-86) → security headers (:89-99) → CORS exact allowlist, loopback only when `ENVIRONMENT === 'development'` (:102-155) → `/api/*` per-IP limiter (skipped without CF-Connecting-IP, rate-limit.ts:138-141) → `/api/*` body cap 100 KB / preview 5 MB (body-validation.ts:61-88) → JSON depth 10 → `authMiddleware` on `*` (index.ts:173) → `/api/*` per-user limiter on the authenticated identity (rate-limit.ts:110-161) → Content-Type gate for mutations (index.ts:186-224) → routers. Router-level `requireNotBanned` on POST/PATCH/DELETE (presets.ts:131, votes.ts:30), fails closed 503 outside development (ban-check.ts:89-111).

| Method | Path | Anon | User (JWT/bot) | Owner | Moderator | Visibility / CAS | Quota |
|---|---|---|---|---|---|---|---|
| GET | `/`, `/health` | yes | yes | – | – | returns `environment`, API version | IP |
| GET | `/api/v1/presets` | approved only | approved only | – | any of 4 statuses (:235-240) | `status != 'hidden'` always (preset-service.ts:233-237); limit 1-50, page ≥1 (:249-250) | IP/user |
| GET | `/presets/featured` | yes | yes | – | – | approved only | IP |
| GET | `/presets/mine` | 401 | own rows, all statuses + `rejection_reason` | – | – | WHERE author = acting id | user |
| GET | `/presets/rate-limit` | 401 | own counts | – | – | – | user |
| PATCH | `/presets/refresh-author` | 401 | own rows' author_name; FINDING-014 re-key (web only, ban-guarded per statement) | – | – | identity-rekey-service.ts:47-70 | user |
| DELETE | `/presets/:id` | 401 | 404 if not visible, 403 if not owner | yes | yes (no log row, known PAPI-13) | – | user |
| PATCH | `/presets/:id` | 401 | 404/403 | yes | no (owner only, :587) | WHERE id AND author AND content_revision (preset-service.ts:716); 409 on stale | text_edit 30/day, flagged_edit 10/day |
| GET | `/presets/:id` | approved only | approved or own | own + previous_values | any | `canSeePreset` (:143-152) | IP/user |
| POST | `/presets` | 401 | create | – | – | dup → `respondToDuplicate` visibility rule | 10/day + post-insert recount |
| POST | `/presets/:id/preview-image` | 401 | 404/403 | yes | no | magic-byte sniff, 5 MB stream cap, image-worker re-encode, 10 s timeout; UPDATE `WHERE id = ?` | 20/day reserve |
| DELETE | `/presets/:id/preview-image` | 401 | 404/403 | yes | no | – | user |
| POST/DELETE | `/votes/:presetId` | 401 | approved presets only (votes.ts:39) | – | – | ON CONFLICT DO NOTHING + recount | user |
| GET | `/votes/:presetId/check` | 401 | own vote only | – | – | – | user |
| GET | `/categories`, `/categories/:id` | yes | yes | – | – | public, s-maxage | IP |
| GET | `/moderation/pending`, `/stats`, `/failed-notifications`, `/:presetId`, `/:presetId/history` | 401 | 403 | 403 | yes | `requireModerator` first line of every handler | user |
| PATCH | `/moderation/:presetId/status` | 401 | 403 | 403 | yes | expected_revision + expected_status required (409 REVISION_REQUIRED / STALE_REVIEW); update + log in one batch, `changes() > 0` | user |
| PATCH | `/moderation/:presetId/revert` | 401 | 403 | 403 | yes | revision + status + raw snapshot bound; snapshot dyes re-validated | user |
| PATCH | `/moderation/:presetId/preview-image` | 401 | 403 | 403 | yes | key regex + `startsWith(presetId/)` + `preview_image_status='pending'` in WHERE; log row in batch | user |
| PATCH | `/moderation/failed-notifications/:id/resolve` | 401 | 403 | 403 | yes | – | user |

Auth modes: bot = Bearer `BOT_API_SECRET` (SHA-256 digest compare, auth.ts:141-152) + v2 HMAC over method/path/body/timestamp/nonce/identity + single-use nonce in KV (auth.ts:207-236, 292-346); web = HS256 JWT, issuer pinned when `JWT_ISSUER` set, `jti` revocation (auth.ts:93-115); acting id = `discord_id` claim, `sub` fallback (:71-77). Moderator = acting id in `MODERATOR_IDS`.

## 2. Positive controls (verified at file:line)

- Every D1 statement is `.prepare().bind()`; the only interpolations are constant fragments: placeholder lists (ban-check.ts:56-59, moderation-retention-service.ts:73-83), the fixed `NOT_BANNED` clause (identity-rekey-service.ts:22-25), the constant column list (notification-service.ts:516-519), and `whereClause`/`orderBy`/SET clauses built from literals (preset-service.ts:237-289, 656-718). LIKE wildcards escaped (:32-34).
- `content_revision` CAS holds: owner edit WHERE id+author+revision (preset-service.ts:716), status WHERE id+status+revision (:461), revert WHERE revision+status+raw snapshot (:485); trigger in schema.sql:64-78 is identical to migrations/0014 and watches tags/example_link/secondary_categories too, so a tag/link edit stales a pending review (2026-09-15 FINDING-004/005 and 2026-10-03 FINDING-017 hold).
- Moderation status/revert fail closed without a review binding (moderation.ts:129-142, 197-200, 292-295); stale review returns `current` from a fresh read (:92-113). Preview approval bound to the exact key + pending status (:389-396, 424-450) with an audit row in the same batch (FINDING-020 holds).
- Visibility: `canSeePreset` 404s non-approved presets for everyone but owner/moderator on GET, DELETE, PATCH, preview upload/delete (presets.ts:143-152, 432, 582, 1200, 1397); `toPublicPreset` strips `author_discord_id` for anonymous and non-owner web viewers (preset-service.ts:169-193); `previous_values` only for owner/moderator; `preview_image_url` built only for `approved` (:120-123).
- R2 keys are server-built `${presetId}/${randomUUID()}.webp` from a DB-verified id (preview-image-service.ts:156); the moderator route regex-checks the key and requires it to match the row before any delete.
- Upload gates before image-worker: per-day reservation, 5 MB streamed cap via the exemption (body-validation.ts:75-87), `byteLength` recheck, magic-byte sniff ignoring Content-Type (presets.ts:1258-1288), 10 s timeout on the binding call (preview-image-service.ts:143-149).
- Perspective: key in `x-goog-api-key` header, `doNotStore: true`, 5 s timeout, any non-200 / malformed / throw → `passed: false` (moderation-service.ts:243-333); no key → `unscored` → pending (:377-384).
- Dead letters keep only `{type, preset_id, moderation_status, content_revision}` (notification-service.ts:182-191); the `error` column can carry discord-worker's 4xx body, which is a fixed string (discord-worker index.ts:303-362).
- Error handler hides message/stack unless `ENVIRONMENT === 'development'` (index.ts:278-299); `/__force-error` 404s in production (:244-249).
- Name/description/tags/example_link have control/bidi/invisible rules; example_link stored as canonical `URL.href` (validation-service.ts:486-498) — 2026-10-03 c5 / FINDING-016 holds.
- Rate limits: native `[[ratelimits]]` RL_PUBLIC for both layers, IP key never a header (rate-limit.ts:99-101); per-user key only after auth (:110-114).
- Secrets are not in `[vars]`; `.dev.vars` and `.dev.vars.*` are gitignored (`git check-ignore -v` → .gitignore:11-12). Workers Logs off in both blocks.

## 3. Candidates (detail)

**presets-api-routes-01 (LOW, INTERNET-AUTH)** — tags and example_link never pass content moderation, and an owner edit that touches only them keeps an approved preset public with no review and no daily cap. `moderateContent` receives name + description only on submit (presets.ts:1031-1036); on edit `textChanged` covers only name/description (:653-655) and `ownerEditOutcome('approved', {textChanged:false, flaggedByThisEdit:false})` returns no status write and no notify (:533-536). The tag charset rule (validation-service.ts:159, comment :157 "is never moderated") blocks markup, not words. Residual of 2026-08-21 PAPI-6, whose "include tags in moderateContent" half never landed (FINDING-019 closed on the charset only). With the local list holding no profanity (2026-10-03 FINDING-019 context), the Perspective call is the only text judge and it never sees tags.

**presets-api-routes-02 (LOW, LOCAL; precondition unconfirmed)** — the top-level dev worker `xivdyetools-presets-api-dev` pins `workers_dev = false` but not `preview_urls = false` (wrangler.toml:12-16), while api-worker (:19) and image-worker (:25, :43) pin it and their config tests assert it; apps/presets-api/tests/wrangler-config.test.ts:43 asserts only `workers_dev`. api-worker's own wrangler comment (:10-14) says wrangler ≥ 4.44 turns preview URLs on for a routeless worker, and this app pins wrangler ^4.152.0 (package.json:36). That dev worker runs `ENVIRONMENT = "development"` against the production D1 and R2 (same database_id e17d68a1…, same bucket), where the error handler returns `err.message` + `stack` (index.ts:282-296), a failed ban lookup fails open (ban-check.ts:96-101), and bot auth without `BOT_SIGNING_SECRET` accepts unsigned identity headers including moderator ids (auth.ts:273-285). The 2026-10-03 rejection ("unreachable: no routes, workers_dev=false") did not consider preview URLs. Preconditions not confirmed from the repo: that the dev worker is currently deployed (no CI deploys it; only a manual `npm run deploy`), that wrangler's default actually enables preview URLs when `workers_dev = false`, and the dev worker's secret set. JWT impersonation is blocked regardless: the dev `JWT_ISSUER` is `http://localhost:8788` (wrangler.toml vars), so production tokens fail the issuer pin.

## 4. Rejected items

- Dead-letter `error` column storing `await response.text()` on 4xx (notification-service.ts:294, 412): discord-worker's webhook 4xx/5xx bodies are fixed strings (discord-worker index.ts:303-362, +28/+115 of the following block). Same as the 2026-10-03 rejection.
- Preview upload `UPDATE … WHERE id = ?` with `meta.changes` ignored (presets.ts:1313-1317): re-file of 2026-10-03 rejected "upload race leaves orphaned R2 objects".
- Moderator DELETE writes no `moderation_log` row (presets.ts:437-469): known INFO since 2026-08-21 PAPI-13 / 2026-08-29.
- `/status` `reason` unvalidated (moderation.ts:233): known INFO (PAPI-13); moderator-only input. It now reaches the author through `/mine` `rejection_reason` (preset-service.ts:567-577), which is the intended 8S feature.
- Moderator can move `hidden` → approved via `/status` (expected_status accepts `hidden`, moderation.ts:121-141): moderator-only deliberate action; a pre-ban button is stale because the hide bumps `content_revision`.
- 404 handler echoes method + path (index.ts:266-275): JSON body with nosniff, no personal data.
- `GET /` returns `environment` and `API_VERSION` (index.ts:230-237): non-sensitive.
- Content-Type gate uses `includes()` (index.ts:201, 213): auth is a Bearer header (forces preflight), no cookies, so no CSRF lever.
- Module-scope `pendingCategoryListFetch` (categories.ts:77-81) and limiter singletons: public data / per-isolate fallback only.
- `search` query length unbounded (preset-service.ts:250-255): bound, escaped, URL length capped at the edge, 100/min limiter.
- JWT `type` claim not checked: re-file of the 2026-10-03 rejection (oauth mints one token type).
- `env-validation.ts` error text quoting a malformed `MODERATOR_IDS` entry: only for a non-snowflake value, logged once, Workers Logs off.

## 5. Files covered

24 files opened (several partially, noted): apps/presets-api/src/index.ts, src/middleware/{auth,ban-check,body-validation,rate-limit}.ts, src/handlers/{presets,moderation,votes}.ts, src/handlers/categories.ts (:60-147), src/services/{preset-service,preview-image-service,validation-service,identity-rekey-service}.ts, src/services/moderation-service.ts (:180-393), src/services/notification-service.ts (:150-567), src/services/rate-limit-service.ts (grep + :255-384), src/services/moderation-retention-service.ts (:60-97), src/utils/request-body.ts, src/utils/api-response.ts (grep), src/utils/env-validation.ts (grep), src/retention-job.ts (:60-133), wrangler.toml, schema.sql (trigger), migrations/0014 and 0015, tests/wrangler-config.test.ts (:1-50); cross-checked apps/discord-worker/src/index.ts:285-510 (webhook responses). Directories: apps/presets-api/{src,src/middleware,src/handlers,src/services,src/utils,migrations,tests}.

Not covered: src/types.ts, src/services/category-service.ts, moderation-service.ts:1-180 (local filter), src/data/profanity/*, migrations 0002-0013 and 002, scripts/migrate-presets.ts, the oauth side of the `discord_id` claim (who can set it for XIVAuth-linked accounts).
