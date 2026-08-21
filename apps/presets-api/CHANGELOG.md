# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-08-21

Security audit remediation (docs/audits/2026-08-21-security, FINDING-002 / FINDING-015). Minor bump: two new bindings, stricter JWT acceptance, no contract break for valid tokens.

### Security

- **Revoked JWTs are now rejected by `authMiddleware`.** The oauth worker's `TOKEN_BLACKLIST` KV namespace is bound into this worker (`wrangler.toml`, dev + production) and a token whose `jti` is blacklisted (logout via `/auth/revoke`, refresh rotation) is treated as unauthenticated. Previously revocation only affected the oauth worker's own `/auth/me` + `/auth/refresh`, so a logged-out token kept full API access until `exp`. Fail-open on KV errors, consistent with the oauth README.
- **Issuer pinning.** New `JWT_ISSUER` var (`https://auth.xivdyetools.app` in production, `http://localhost:8788` in dev) is passed to `verifyJWT({ issuer })`; tokens minted by any other issuer that shares `JWT_SECRET` (e.g. the dormant oauth preview env) are refused. Claim typing from `@xivdyetools/auth` 1.4.0 applies as well (`exp` must be numeric, `sub` a string).

- **Public per-IP rate limiting prefers the native Workers Rate Limiting binding `RL_PUBLIC`** (100 / 60 s) via `CloudflareRateLimiter` (`@xivdyetools/worker-kit` 1.1.0, FINDING-003); the per-isolate memory limiter remains the fallback for dev/tests. `createPublicRateLimitMiddleware()` / `selectPublicRateLimiter()` exported for tests; headers and 429 shape unchanged.

- **Preview-image upload is capped while streaming** (FINDING-004 / PAPI-3): `bodySizeLimit` now applies a 5 MB `bodyLimit` to `POST /api/v1/presets/:id/preview-image` (Content-Length first, then the actual stream) instead of exempting the route and letting the handler buffer the whole body before its own 5 MB check. Same 400 / "Image must be at most 5 MB" response, so the client contract is unchanged; the handler's check stays as a backstop.

- **Append-only daily quotas** (FINDING-008 / PAPI-1). The daily submission cap counted surviving rows in `presets`, so deleting your own presets refilled it; flagged edits and preview-image uploads had no per-user cap at all although each fans out a moderation embed, a Perspective call and dead-letter rows. New `submission_events` table (migration `0011_submission_events.sql`, never deleted by user action) records every submission / flagged edit / preview upload; `checkSubmissionRateLimit` now counts max(live rows, events), and new per-user daily caps apply to edits that trip moderation (`DAILY_FLAGGED_EDIT_LIMIT` = 10 → 429 before anything is persisted) and preview uploads (`DAILY_PREVIEW_UPLOAD_LIMIT` = 20 → 429 before the body is read). Same 429 envelope as the submission cap (`error: RATE_LIMITED`, `remaining`, `reset_at`).

### Deploy notes

- **Apply migration `0011_submission_events.sql` before deploying** (`wrangler d1 execute xivdyetools-presets --remote --file=migrations/0011_submission_events.sql`); without the table every quota check 500s.
- `RL_PUBLIC` (`[[ratelimits]]`, `namespace_id` 1011 prod / 1012 dev) needs no resource creation.
- `TOKEN_BLACKLIST` binds an existing namespace (`0d6f3be3…` prod / `891bbbe8…` dev) — no `wrangler kv namespace create` needed. `JWT_ISSUER` is a plain var, already in `wrangler.toml`.

## [2.0.0] - 2026-08-16

Monorepo 2.0 / Web-App 5.0 release train (branch `monorepo-2.0-prep`, 2026-07-30 → 2026-08-16). Nothing below has shipped until the branch merges. **Major bump**: the wire contract for `dyes` changes from legacy itemIDs to stainIDs, the dye-count rule moves from 2–5 to 3–6, and the `community` category is deleted, so any pre-5.0 client is rejected loudly on submit/edit (see ⚠️ BREAKING).

### ⚠️ BREAKING

- **Preset dyes are stainIDs, not itemIDs.** `POST /api/v1/presets` and `PATCH /api/v1/presets/:id` now require every entry of `dyes` to be a stainID (`1–254`); anything `>= 5000` is rejected with `Dye <n> looks like a legacy item ID; expected a stainID (1-254)` and any other out-of-range value with `Dye IDs must be stainIDs (1-254)`. A half-migrated caller now fails loudly instead of silently rendering empty palettes. Stored rows are rewritten by the deploy-window data migration below; `dye_signature` and `previous_values` are recomputed at the same time (duplicate detection and moderation revert would otherwise break across eras).
- **Dye count is 3–6 per preset** (was 2–5) — `PRESET_VALIDATION_RULES.dyes` in `src/services/validation-service.ts`.
- **The `community` category no longer exists.** Community-ness is a source, not a category: migration `0007` deletes the `categories` row (any preset filed under it lands in `aesthetics`; production matched zero rows), the D1 seed in `schema.sql` no longer creates it, and `getValidCategories()` (DB-backed) therefore rejects it on submit/edit. Co-removed from `@xivdyetools/types` `PresetCategory`.
- **CORS `allowHeaders` shrinks to `Content-Type, Authorization`** (FINDING-005). `X-User-Discord-ID` / `X-User-Discord-Name` are server-to-server bot identity headers honoured only behind a valid HMAC signature; both bot callers reach this Worker over Service Bindings and never preflight, so no browser client is affected — but a browser that was sending them will now fail preflight.

### Deploy window (operator steps, in this order — all user-run)

D1 migrations are **never** applied automatically: `npm run db:migrate` replays `schema.sql`, which is all `CREATE TABLE IF NOT EXISTS`, so against the live database it exits 0 having changed nothing. Every file under `migrations/` is applied by hand with `wrangler d1 execute xivdyetools-presets --remote --file=…`, and each one must land **before** the worker that reads its columns is deployed (the first `INSERT` naming a missing column fails as an opaque 500).

1. `migrations/0007_drop_community_category.sql` — drop the `community` category. **Already applied to production** (matched zero rows); still required for fresh installs, local dev D1 and restores.
2. Generate and apply the data-dependent stainID rewrite: dump `SELECT id, dyes, previous_values FROM presets` with `--json`, run `npx tsx scripts/migrate-dyes-to-stainids.ts <dump.json> > migrations/generated-stainid-updates.sql`, review, apply. Idempotent (already-migrated rows emit no `UPDATE`); must run in the **same** window as the 5.0 worker deploys.
3. `migrations/0008_add_example_link.sql` — `presets.example_link TEXT`.
4. `migrations/0009_add_preview_image.sql` — `presets.preview_image_key TEXT`, `presets.preview_image_status TEXT NOT NULL DEFAULT 'none'`. The R2 bucket `xivdyetools-presets-preview-thumbnails` and its public custom domain `shots.xivdyetools.app` already exist (created 2026-08-10, round-trip verified).
5. `migrations/0010_add_secondary_categories.sql` — `presets.secondary_categories TEXT NOT NULL DEFAULT '[]'` + `INSERT OR IGNORE` of the three new categories `appearance` / `zones` / `raids-trials`.
6. Deploy `xivdyetools-image-worker` first (the new `IMAGE_WORKER` service binding must resolve), then this worker with `npm run deploy:production` — a bare `npm run deploy` now targets the routeless dev worker (see Changed).
7. Verify column presence with a single-row aggregate over `pragma_table_info('presets')`, not a column list.
8. **Identity backfill (decide before deploy):** rows written by web users since the XIVAuth integration hold the oauth UUID in `presets.author_discord_id`, `votes.user_discord_id` and `moderation_log.moderator_discord_id`; after this deploy those authors resolve to their snowflake and can no longer see/edit them. One-time backfill: `SELECT id, discord_id FROM users WHERE discord_id IS NOT NULL` on **oauth's** D1 → `UPDATE … SET <col> = <snowflake> WHERE <col> = <uuid>` on the presets D1 for the three columns (votes may collide if someone voted from both clients — keep the earlier row). XIVAuth-only users who later link Discord flip from UUID to snowflake the same way

### Added

- **Preview images (author-uploaded card pictures) via image-worker + R2** (`src/services/preview-image-service.ts`, spec `docs/superpowers/specs/2026-08-10-preset-glamour-thumbnails-design.md`):
  - `POST /api/v1/presets/:id/preview-image` — author-only; raw image bytes (PNG/JPEG/WebP, ≤ 5 MB `MAX_PREVIEW_IMAGE_BYTES`, identified by magic-byte sniff, never by the declared `Content-Type`) are cropped/encoded to WebP by `IMAGE_WORKER` (`POST /thumbnail`) and stored in the `THUMBNAILS` R2 bucket as `{presetId}/{uuid}.webp` (immutable cache headers). The row flips to `preview_image_status = 'pending'`; a replaced image's old object is deleted after the DB write.
  - `DELETE /api/v1/presets/:id/preview-image` — author-only removal; idempotent 200 when there is no image; the preset's own `status` is untouched and content moderation is not re-run.
  - `PATCH /api/v1/moderation/:presetId/preview-image` with `{ "action": "approve" | "reject" }` — approve sets `preview_image_status = 'approved'`; reject clears the key/status and deletes the R2 object. Rejecting the image never changes the preset's status (a bad picture is not a bad palette).
  - `DELETE /api/v1/presets/:id` now also removes the preset's R2 object.
  - **The moderation gate**: `CommunityPreset.preview_image_url` (`https://shots.xivdyetools.app/<key>`) is built in `rowToPreset()` only when the status is `approved`; `preview_image_status` (`'none' | 'pending' | 'approved'`) is exposed everywhere as a label. `preview_image_key` is never exposed on the API shape.
  - Moderator queue: `GET /api/v1/moderation/pending` returns rows where `status = 'pending'` **or** `preview_image_status = 'pending'`, each carrying `pending_preview_image_url` so moderators can see what they are judging.
  - A new `preview_image` notification variant (`PresetNotificationPayload` is now a discriminated union on `type`) is sent to discord-worker through the same retry / back-off / `failed_notifications` dead-letter path as submissions.
  - Everywhere on this feature the DB write happens **before** the R2 delete and the delete is `try/catch`ed: a failed R2 call may orphan an object (invisible, cheap to clean up) but never leaves a row pointing at a deleted key or 500s a request whose state is already correct.
- **Secondary categories** — a preset now has one primary `category_id` plus up to two `secondary_categories` (`SECONDARY_CATEGORY_MAX = 2`, `validateSecondaryCategories`: cap, unknown value, duplicate, and primary-collision rules). Accepted on `POST /api/v1/presets` and `PATCH /api/v1/presets/:id` (`category_id` and `secondary_categories` are now editable; `[]` clears the list and counts as a real update; category-only edits do not re-queue for moderation). Persisted as a JSON array (`'[]'` default, corrupt values fall back to `[]` per BUG-012) and returned as `CommunityPreset.secondary_categories`. `?category=` filtering and the `preset_count` in `GET /api/v1/categories` / `GET /api/v1/categories/:id` match primary **or** secondary — counts therefore sum to more than the preset total by design.
- **Three new curated categories**: `appearance` (👤 "Palettes built around a character's own colours"), `zones` (🏔️ "Palettes drawn from the places of Eorzea"), `raids-trials` (🗡️ "Palettes from raid and trial encounters") — seeded by migration `0010` and `schema.sql`.
- **`example_link`** (8A Gallery) — an optional https page URL about the glamour, stored as a link and never fetched or copied. `validateExampleLink` / `normalizeExampleLink` in `validation-service.ts`: https only, ≤ 300 chars, bare hosts get the scheme added, host must be on `EXAMPLE_LINK_HOSTS` (exact host or subdomain, suffix look-alikes rejected): `eorzeacollection.com`, `mirapri.com`, `reddit.com`, `redd.it`, `x.com`, `twitter.com`, `bsky.app`, `instagram.com`, `pixiv.net`, `finalfantasyxiv.com` (Lodestone), `misskey.io`. Image hosts (Imgur/Flickr) were deliberately dropped from the initial list — the field is for pages that carry credit and gear info, not raw images. Accepted on submit and edit (`''`/`null` clears it), returned as `CommunityPreset.example_link`; the web app mirrors the list in `apps/web-app/src/shared/example-link.ts`.
- **`rejection_reason` on `GET /api/v1/presets/mine`** — `getPresetsByUser()` joins the latest `moderation_log` reject reason, so a rejected submission shows *why* instead of just failing to appear (previously the reason lived only in the moderation worker).
- `scripts/migrate-dyes-to-stainids.ts` — generates the data-dependent stainID `UPDATE`s from a D1 JSON dump using the canonical `legacyItemID → stainID` map in `packages/core/src/data/dyes.json` (see Deploy window).
- `wrangler.toml`: `THUMBNAILS` R2 binding and `IMAGE_WORKER` service binding in both environments; `Env` gains `IMAGE_WORKER: Fetcher` and `THUMBNAILS: R2Bucket`.

### Changed

- **Bare `wrangler deploy` is now safe** (`docs/operations/DEPLOY_ENVIRONMENTS.md`): the top-level `wrangler.toml` block is the routeless `xivdyetools-presets-api-dev` worker (`workers_dev = false`, localhost CORS); `routes` for `api.xivdyetools.app` / `api.xivdyetools.projectgalatine.com` **moved** into `[env.production]` (they are inheritable keys — leaving them at the top level would have attached the production domains to the dev worker). Production ships only via `npm run deploy:production` (CI already passes `--env production`). Note the dev worker still binds the production D1.
- CORS: `https://beta.xivdyetools.app` added to production `ADDITIONAL_CORS_ORIGINS` (beta uses the production presets backend on purpose; the stale `xiv-colorexplorer.pages.dev` entry is left alone). Until this ships, every community-preset call from beta is CORS-blocked.
- Body guards: `bodySizeLimit` (100 KB) and the JSON-only mutation gate now exempt exactly one request shape — `POST /api/v1/presets/:id/preview-image` (`isPreviewImageUpload()` in `src/middleware/body-validation.ts`), which accepts `image/png`, `image/jpeg`, `image/webp` or no `Content-Type` and enforces its own 5 MB limit; every other endpoint keeps the 100 KB cap and the JSON-only rule (including `PATCH` on the same path).
- `validateEditRequest()` is now async and DB-backed like `validateSubmission()`, taking the preset's current `category_id` so a secondary that repeats the unchanged primary is caught; the "No updates provided" guard recognises `example_link`, `category_id` and `secondary_categories`.
- Migrated from `@xivdyetools/worker-middleware` + `@xivdyetools/rate-limiter` to `@xivdyetools/worker-kit` (`/rate-limiter` subpath) — Tier 1 package consolidation; dropped the unused `@xivdyetools/crypto` dependency. The deploy workflow's path filter now watches `packages/worker-kit/**` (worker-middleware appeared in no deploy filter before).
- `schema.sql` repaired (removing the `community` seed row had left a trailing comma that made the file a syntax error and unable to create a database) and brought in line with migrations 0008–0010 for fresh local databases; the table doc no longer claims six seeded categories.
- Dependencies: `hono` floor raised to `^4.12.34` (2026-08-09 security advisories); `wrangler` `^4.114.0 → ^4.120.0` (miniflare 5 / undici 7.29 — clears the undici advisories); `license: MIT` declared.
- Docs: `README.md` written (accuracy/licensing/attribution audit), `CLAUDE.md` synced to schema v2 / preview images / worker-kit / the dev-vs-production deploy split.

### Fixed

- **JWT identity uses the Discord snowflake, not oauth's `sub`** — the auth middleware took `sub` as the Discord user ID, but oauth issues `sub` = internal user UUID with the snowflake in `discord_id`; web-submitted presets/votes/moderation-log rows therefore carried the UUID while bot rows carried the snowflake (same person = two authors; `/presets/mine`, edit/delete ownership, `banned_users` and `MODERATOR_IDS` never matched web users). `resolveJWTUserId()` now prefers `discord_id`, `sub` only as a fallback for XIVAuth-only accounts (`src/middleware/auth.ts`; 3 previously-skipped JWT tests un-skipped + 6 added)
- **Preview-image upload was unreachable in production** — the two global `/api/*` guards 413'd any body over 100 KB and 415'd anything that was not `application/json`, so every realistic upload died before the route ran while the route's own tests (mounted without the middleware) stayed green. Now exempted as described under Changed, with tests that drive the real app export.
- **Pending preview images never reached the moderator queue** — `getPendingPresets()` filtered on `status = 'pending'` only, so an approved preset with a newly uploaded image was invisible to moderators; the query now also matches `preview_image_status = 'pending'` (with a regression guard for a key-only row).
- Preview-image moderator notification bypassed the retry path (a hand-rolled fetch with no retry, no back-off and no dead-letter row); it now goes through `notifyDiscordBot` on `waitUntil` like submissions.
- `DELETE /api/v1/presets/:id` deleted the R2 object before the D1 batch (the opposite of the documented ordering rule); collapsed a redundant second `SELECT` while there.
- Migration `0007` lands retired `community` presets in `aesthetics` rather than `events` (a preset filed under a source rather than a theme is a general-purpose palette).
- Preview-image upload writes the DB row before deleting the previous R2 object (a failed write must orphan an object, never point at a deleted one), and the 5 MB limit is now tested for real.
- Stale seed-script path in `scripts/migrate-presets.ts`.

### Removed (2026-08-18 dead-code audit)

- **`types.ts`'s dead `ModerationResponse` / `CategoryListResponse` re-exports** (DEAD-025): this worker's handlers never typed their responses with either — only reached this shim as dead re-exports. `@xivdyetools/types`' `ModerationResponse` (and its `ModerationSuccessResponse`/`ModerationErrorResponse` constituents) and `CategoryListResponse` are gone too; nothing else referenced them.

### Security

- **FINDING-002 (2026-08-09 pre-release audit)**: the four loopback CORS origins (`localhost`/`127.0.0.1` on 5173 and 8787) are now reflected only when `ENVIRONMENT === 'development'` — production previously reflected them alongside `credentials: true`. Mirrors OAUTH-SEC-001 in the oauth worker.
- FINDING-005: `X-User-Discord-ID` / `X-User-Discord-Name` removed from CORS `allowHeaders` (see ⚠️ BREAKING).

### Tests

- Coverage raised (branches threshold 75 → 80; workspace gate is 80% for apps): new `tests/handlers/moderation.test.ts`, `tests/services/example-link.test.ts`, `tests/services/preview-image-service.test.ts`, `tests/services/preset-service.test.ts`; `createMockEnv` gains `THUMBNAILS` (mock R2) and a happy-path `IMAGE_WORKER`; D1 fixtures retired the `community` category; app-level tests for the upload exemptions and the pending-image gate.

## [1.6.0] - 2026-07-18

2026-07-18 audit remediation (Sprint 1) — deployed to production 2026-07-18.

### Fixed

- **CRITICAL — moderation self-approval**: closed the state-machine gap that allowed a submitter to approve their own preset; moderation transitions are now validated server-side.
- Moderation state-machine hardening across approve/reject/revert transitions, with D1 `batch()` used as a single transaction and `changes()`-gated updates so concurrent moderation actions cannot double-apply.
- **Migration 0006**: unique index on preset signatures (applied to production after verifying zero duplicate signatures; also surfaced and corrected the fact that migration 0004's index had never been applied as UNIQUE in production).

## [1.5.0] - 2026-04-07

### Security

- **SEC-003**: Added `jsonDepthLimit` middleware (maxDepth 10, 100 KB body; prototype pollution keys rejected) to prevent deeply nested payloads and prototype injection
- **SEC-004**: Added Hono `bodyLimit` middleware (100 KB) on all `/api/*` routes

### Added

- Migrated to `rateLimitMiddleware()` from `@xivdyetools/worker-middleware` — standardized `X-RateLimit-*` headers and `Retry-After` on 429 responses
- 12 new tests for JSON depth limiting; 11 additional tests for body size limits

### Changed

- Migrated request-ID and logger middleware to `@xivdyetools/worker-middleware`; deleted local middleware files
- **ARCH-001**: Removed `nodejs_compat` compatibility flag from `wrangler.toml`
- **BUG-001**: Re-enabled strict TypeScript checks; cleaned up unused variables and implicit returns
- **BUG-002**: Replaced `console.error` with structured logger in `preset-service.ts`; added optional `logger` parameter to service functions
- **CORS**: Reduced preflight `maxAge` from 86400 s to 3600 s — allows CORS policy changes to propagate within one hour
- Extended test coverage for rate limiting (KV error branch), preset notifications (Discord mock with `executionCtx`), category cache, dead-letter storage, moderation edge cases

---

## [1.4.16] - 2026-03-18

### Fixed

- **BUG-012**: Wrapped `JSON.parse()` calls in `rowToPreset()` in try-catch to prevent a single corrupted D1 row from crashing preset listing endpoints; list endpoints now skip corrupted rows with a console error, while single-row lookups propagate the error for a proper 500 response
- **BUG-016**: Rate limit middleware now logs a warning when the rate limiter backend encounters an error (fail-open behavior) for operational visibility
- **BUG-015**: Failed Discord notifications are now persisted to a `failed_notifications` dead-letter table after all retries are exhausted; moderators can view unresolved failures via `GET /moderation/failed-notifications` and mark them resolved via `PATCH /moderation/failed-notifications/:id/resolve`

### Performance

- **OPT-001**: Category cache now uses promise deduplication to prevent thundering herd — concurrent cache misses share a single in-flight D1 query instead of each spawning their own

---

## [1.4.15] - 2026-03-09

### Changed

- Updated `hono` from 4.12.3 to 4.12.5 (security: SSE injection, cookie injection, middleware bypass fixes)
- Updated `@cloudflare/workers-types` from 4.20260305.0 to 4.20260307.1
- Updated `@cloudflare/vitest-pool-workers` from 0.12.18 to 0.12.20 (fix: resource leak on pool shutdown)
- Updated `wrangler` from 4.69.0 to 4.71.0
- Updated `@types/node` from 25.3.3 to 25.3.5

## [1.4.14] - 2026-02-21

### Changed

- Resolve lint errors across the package

## [1.4.13] - 2026-02-19

### Security

- **FINDING-001**: Added production enforcement of `BOT_SIGNING_SECRET` in environment validation
  - Startup validation now fails fast in production if `BOT_SIGNING_SECRET` is not configured
  - Prevents accidental deployment without HMAC signing key for bot request verification

---

## [1.4.12] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

---

## [1.4.11] - 2026-01-26

### Changed

- **REFACTOR-003**: Migrated authentication utilities to `@xivdyetools/auth` shared package
  - JWT verification now uses `verifyJWT()` from shared package
  - Bot signature verification now uses `verifyBotSignature()` from shared package
  - Reduces ~80 lines of duplicated cryptographic code

---

## [1.4.10] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated IP-based rate limiting to `@xivdyetools/rate-limiter` shared package
  - Uses `MemoryRateLimiter` for public endpoint protection
  - Uses `PUBLIC_API_LIMITS` preset from shared package
  - Preserves PRESETS-BUG-001 fix (LRU eviction at 10k entries) via shared implementation
  - D1-based submission limiting remains unchanged

---

## [1.4.9] - 2026-01-25

### Changed

- **REFACTOR-001**: Migrated to `@xivdyetools/crypto` for Base64URL utilities
  - JWT verification now uses shared `base64UrlDecode` and `base64UrlDecodeBytes`
  - Reduces ~15 lines of duplicated code in auth middleware
  - Ensures consistency with oauth worker implementation

---

## [1.4.8] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`
- **FINDING-006**: Updated `devalue` transitive dependency to fix DoS vulnerability (CVSS 7.5)

---

## [1.4.7] - 2026-01-19

### Fixed

- **PRESETS-BUG-001**: Fixed memory leak in IP rate limiter. Added `maxTrackedIps` limit (10,000) with LRU-style eviction to prevent unbounded memory growth under DDoS attacks

### Changed

#### Refactoring (Deep-Dive Audit)

- **PRESETS-REF-001**: Created centralized validation service
  - New `src/services/validation-service.ts` with shared validators
  - `PRESET_VALIDATION_RULES` and `MODERATION_VALIDATION_RULES` constants for consistent limits
  - Generic helpers: `validateStringLength()`, `validateArray()`, `validateEnum()`
  - Preset validators: `validatePresetName()`, `validatePresetDescription()`, `validatePresetDyes()`, `validatePresetTags()`
  - Moderation validators: `validateModerationStatus()`, `validateModerationReason()`
  - `ModerationStatus` type excludes 'hidden' from allowed moderation transitions
  - Removed ~44 lines of duplicated validation logic from handlers

---

## [1.4.6] - 2026-01-05

### Security

#### Low Priority Audit Fixes (2026-01-05 Security Audit)

- **L1**: Added X-Request-ID format validation
  - Request IDs are now validated against UUID v4 pattern
  - Prevents log injection attacks via malformed request IDs
  - Invalid request IDs are replaced with newly generated UUIDs

---

## [1.4.5] - 2025-12-24

### Changed

- Updated `@xivdyetools/types` to ^1.1.1 for ecosystem consistency
- Updated `@xivdyetools/logger` to ^1.0.2 for ecosystem consistency

### Fixed

- Fixed TypeScript type assertion in test file for Env type casting

---

## [1.4.4] - 2025-12-24

### Added

- **PRESETS-MED-002**: Standardized API response utilities
  - Created `src/utils/api-response.ts` with consistent error response format
  - `ErrorCode` constants using `SCREAMING_SNAKE_CASE` for machine-readability
  - Helper functions: `notFoundResponse()`, `forbiddenResponse()`, `validationErrorResponse()`, `invalidJsonResponse()`, `internalErrorResponse()`
  - All error responses now follow format: `{ success: false, error: "CODE", message: "..." }`

### Fixed

- **PRESETS-MED-001**: Added cascade delete integration tests
  - 3 new tests verifying vote deletion when preset is deleted
  - Tests verify correct SQL execution order (votes before presets)
  - Tests verify correct preset ID binding to both DELETE queries

---

## [1.4.3] - 2025-12-24

### Fixed

- **PRESETS-HIGH-003**: UTF-8 safe truncation for Discord embeds
  - Added `truncateUnicodeSafe()` function that preserves Unicode code points
  - Prevents mid-codepoint truncation that causes garbled text for emoji/CJK characters
  - Applied to preset description in moderation Discord alerts (200 char limit)

---

## [1.4.2] - 2025-12-24

### Fixed

- **Test Suite**: Fixed category validation test failures
  - Added `resetCategoryCache()` export for proper test isolation
  - Updated test mocks to return valid categories before testing other validations
  - Fixed "missing category" test to expect correct error message ("Category is required")
  - Ensures tests properly reset module-level state between runs

---

## [1.4.1] - 2025-12-24

### Fixed

#### Security Audit - High Priority Issues Resolved

- **PRESETS-HIGH-001**: Added timeout to Perspective API moderation calls
  - 5 second timeout on content moderation requests
  - If Perspective API is slow or unavailable, submission proceeds (local filter still applies)
  - Prevents submission hang if external API is unresponsive

---

## [1.4.0] - 2025-12-24

### Fixed

#### Security Audit - Critical Issues Resolved

- **PRESETS-CRITICAL-001**: Fixed race condition in duplicate preset detection
  - Wrapped createPreset in try-catch to handle UNIQUE constraint violations
  - On race condition, finds and votes on existing preset instead of failing
  - Graceful handling when two users submit identical dye combinations simultaneously
- **PRESETS-CRITICAL-002**: Dynamic category validation from database
  - Categories now queried from database with 1-minute cache
  - Replaces hardcoded VALID_CATEGORIES array
  - New categories can be added without code deployment
- **PRESETS-CRITICAL-003**: Added retry mechanism for Discord notifications
  - Exponential backoff with jitter (1s, 2s, 4s delays)
  - Up to 3 retries on transient failures (5xx errors, network issues)
  - No retry on client errors (4xx) to avoid wasting attempts
- **PRESETS-CRITICAL-004**: Preserved audit trail on moderation pass
  - No longer clears previous_values when moderation passes
  - Maintains history of previously-flagged content for compliance
  - Helps detect patterns in user behavior over time

---

## [1.3.0] - 2025-12-15

### Added

#### User Ban Enforcement
- **Ban Check Middleware**: `requireNotBannedCheck()` blocks banned users from:
  - Submitting new presets (`POST /api/v1/presets`)
  - Editing presets (`PATCH /api/v1/presets/:id`)
  - Voting on presets (`POST /api/v1/votes/:presetId`)
- Returns 403 with `USER_BANNED` error code for banned users

#### Hidden Preset Status
- Added `hidden` status for presets by banned users
- Hidden presets filtered from all public listings and searches
- Presets restored to `approved` when user is unbanned

### Changed

- Updated preset service to exclude `status = 'hidden'` from queries
- Added safeguard against querying hidden status directly

#### New Files
- `src/middleware/ban-check.ts` - Ban enforcement middleware

---

## [1.2.0] - 2025-12-14

### Added

- **Structured Logging**: Added structured request logger middleware using `@xivdyetools/logger/worker`
- **Shared Package Integration**: Migrated to `@xivdyetools/types` and `@xivdyetools/logger` for ecosystem consistency
- **Test Utils Integration**: Migrated tests to use `@xivdyetools/test-utils` shared package

### Fixed

- **Security**: Tightened HMAC signature timestamp window
- **Security**: Added Content-Type validation and fixed profanity filter ReDoS vulnerability
- **Security**: Added cross-cutting security improvements
- **Security**: Required BOT_SIGNING_SECRET for bot authentication (PRESETS-SEC-001)
- **High Severity**: Addressed HIGH severity preset audit findings
- **Medium Severity**: Addressed MEDIUM severity audit findings
- **Auth**: Improved moderator ID parsing for flexible formats
- **Error Logging**: Improved error logging and added batch documentation
- **Tests**: Resolved 172 pre-existing type errors in test files

### Deprecated

#### Type Re-exports
The following re-exports from `src/types.ts` are deprecated and will be removed in the next major version:

- **Preset Types**: Import from `@xivdyetools/types` instead
- **Auth Types** (AuthSource, AuthContext): Import from `@xivdyetools/types` instead
- **API Types** (ModerationResult, ModerationLogEntry, etc.): Import from `@xivdyetools/types` instead

**Note:** Project-specific types (Env, PresetRow, CategoryRow, VoteRow) remain unchanged.

**Migration Guide:**
```typescript
// Before (deprecated)
import { PresetStatus, CommunityPreset, AuthContext } from './types';

// After (recommended)
import type { PresetStatus, CommunityPreset, AuthContext } from '@xivdyetools/types';
```

---

## [1.1.0] - 2025-12-07

### Added

#### Preset Editing
- `PATCH /api/v1/presets/:id` - Edit existing preset (owner only)
  - Update name, description, dyes, tags
  - Duplicate dye combination detection (409 response with existing preset)
  - Content moderation on edited text
  - Stores previous_values for potential revert

#### Moderation Revert
- `PATCH /api/v1/moderation/:id/revert` - Revert flagged edit
  - Restores preset from previous_values
  - Logs reason in moderation_log
  - Clears previous_values after revert

### Changed

#### Database Schema
- Added `previous_values` column to presets table (stores pre-edit JSON)

#### Service Functions
- `updatePreset()` - Edit preset with validation and moderation
- `findDuplicatePresetExcluding()` - Check dye signature excluding specific preset
- `revertPreset()` - Restore from previous_values

### Files Modified
- `schema.sql` - Added previous_values column
- `src/types.ts` - PresetEditRequest, EditResponse, PreviousValues types
- `src/services/preset-service.ts` - Edit/revert functions
- `src/handlers/presets.ts` - PATCH endpoint
- `src/handlers/moderation.ts` - Revert endpoint

---

## [1.0.0] - 2025-12-07

### Added

#### API Endpoints

**Public:**
- `GET /api/v1/presets` - List presets with filtering and pagination
- `GET /api/v1/presets/featured` - Top 10 presets by vote count
- `GET /api/v1/presets/:id` - Get single preset details
- `GET /api/v1/categories` - List categories with preset counts

**Authenticated (Bot/Web):**
- `POST /api/v1/presets` - Submit new preset
- `POST /api/v1/votes/:id` - Vote for a preset
- `DELETE /api/v1/votes/:id` - Remove vote

**Moderator:**
- `GET /api/v1/moderation/pending` - List pending presets for review
- `PATCH /api/v1/moderation/:id/status` - Approve/reject preset
- `GET /api/v1/moderation/:id/history` - View moderation audit log

#### Features
- **Voting System**: User voting with deduplication (one vote per user per preset)
- **Preset Categories**: Organized browsing by theme/category
- **Search**: Full-text search across name, description, and tags
- **Pagination**: Configurable page size (max 100) with cursor-based pagination
- **Sorting**: By popularity, recency, or alphabetical

#### Content Moderation
- **Local Profanity Filter**: Multi-language bad word detection
- **Perspective API**: Optional ML-based toxicity detection (Google API)
- **Moderation Workflow**: Pending → Approved/Rejected/Flagged status flow
- **Audit Logging**: Full history of moderation actions with reasons

#### Authentication
- **Dual Auth Support**:
  - Bot API: Bearer token (BOT_API_SECRET) + X-User-Discord-ID header
  - Web App: JWT bearer token from OAuth worker
- **Moderator Verification**: MODERATOR_IDS environment variable for admin access

#### Infrastructure
- **Cloudflare D1**: SQLite-compatible database for preset storage
- **Hono Framework**: Fast, lightweight routing
- **Service Binding Ready**: Direct worker-to-worker communication support
