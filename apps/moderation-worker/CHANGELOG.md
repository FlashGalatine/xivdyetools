# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-08-16

Monorepo 2.0 / 5.0-release follow-through (additive behaviour). Deploy note: production is now **only** `wrangler deploy --env production`; a bare `deploy` targets the routeless `xivdyetools-moderation-worker-dev` worker.

### Added

- **Image-only entries in `/preset moderate pending`** (2026-08-11 whole-branch review, FINDING-001): presets-api's moderation queue now also lists *approved* presets whose new preview picture alone is awaiting review, but this command's approve/reject act on the preset's own status — approving such an entry was a `WHERE status = 'approved'` no-op that left it stuck in the queue, and rejecting one pulled a live, approved palette from the gallery over a disliked picture. `handlePendingAction` now marks those entries with 🖼 plus a "Picture pending review: {url}" note (the API's previously-discarded `pending_preview_image_url`, surfaced through a new `ModerationQueueEntry` type in `src/types/preset.ts` and `presetApi.getPendingPresets()`), and the embed footer stops advertising approve/reject for them (`footerMixedQueue` vs `footerTextOnly`). Picture review itself happens on the moderation embed discord-worker posts. Four new en locale keys in `src/services/bot-i18n.ts` (`imageOnlyNote`, `imageOnlyNoteNoUrl`, `footerTextOnly`, `footerMixedQueue`).
- **New preset categories** in `CATEGORY_DISPLAY` (`src/types/preset.ts`): `appearance` 👤, `zones` 🏔️, `raids-trials` 🗡️ "Raids & Trials" — the `Record<PresetCategory, …>` stays exhaustive against `@xivdyetools/types@2.0.0`. Test fixtures gained the new `secondary_categories` / `preview_image_status` fields of the widened `CommunityPreset`.

### Removed

- **`community` preset category** dropped from `CATEGORY_DISPLAY` — the category was retired by the 5.0 presets migration (curated presets are keyed by stainID; the community bucket no longer exists in `@xivdyetools/types`).

### Removed (2026-08-18 dead-code audit)

- **`types/preset.ts`'s `CATEGORY_DISPLAY`** (DEAD-014): this worker's own copy had zero consumers of its own (only `STATUS_DISPLAY` and `PresetAPIError` from that module were ever imported elsewhere) — deleted outright rather than replaced with an `@xivdyetools/svg` import, since nothing here needs the table at all. `PresetCategory` dropped from the same file's local type-only import as a result.
- **`types/preset.ts`'s dead `PresetSortOption` re-export** (DEAD-025): only reached this shim, never imported past it. `@xivdyetools/types`' own `PresetSortOption` alias is gone too — its one real use (`PresetFilters.sort`) now has the union inlined directly.
- **`middleware/rate-limit.ts`'s `RATE_LIMIT_CONFIGS` adopts worker-kit's `MODERATION_LIMITS` preset** (DEAD-023, adopt): the numbers (`command`: 20/min + 5 burst, `autocomplete`: 60/min + 10 burst) were previously hand-declared here and separately in `@xivdyetools/worker-kit/rate-limiter`'s `MODERATION_LIMITS` — identical values, never reconciled. `RATE_LIMIT_CONFIGS` now calls the new `getModerationLimit(type)` lookup and adapts its `{ maxRequests, windowMs, burstAllowance }` shape to this middleware's pre-existing `{ requestsPerMinute, burstAllowance }` one. No behaviour change — the existing `RATE_LIMIT_CONFIGS` test asserting the exact numbers still passes unmodified.

### Changed

- **Tier 1 package consolidation (2026-07-31)**: `@xivdyetools/worker-middleware` → `@xivdyetools/worker-kit` (`requestIdMiddleware`, `loggerMiddleware`, `MiddlewareVariables`) and `@xivdyetools/rate-limiter` → `@xivdyetools/worker-kit/rate-limiter` (`KVRateLimiter` in `src/middleware/rate-limit.ts`). No behaviour change; migration paths in `xivdyetools/DEPRECATIONS.md`.
- **`wrangler.toml` deploy safety** (`docs/operations/DEPLOY_ENVIRONMENTS.md`): the top-level env is renamed `xivdyetools-moderation-worker-dev` with `workers_dev = false` and **no routes**; the two production custom domains (`moderation-bot.xivdyetools.app`, `moderation-bot.xivdyetools.projectgalatine.com`) moved under `[env.production]` so a bare `wrangler deploy` can no longer overwrite the production bot. `npm run deploy` therefore deploys the dev worker; production is `deploy:production`.
- Docs: `README.md` rewritten from the audit template (accurate command surface, licensing/attribution, MIT + Square Enix legal notice, Blog link dropped); `CLAUDE.md` synced to worker-kit and the dev/production deploy split.
- Tests: coverage thresholds raised to 90/80/90/90 (statements/branches/functions/lines) with new `src/utils/env-validation.test.ts` and `src/utils/sql-helpers.test.ts` suites and expanded `preset.test.ts` coverage of the pending listing.

### Security

- `hono` floor raised `^4.12.32` → `^4.12.34` (resolves to 4.13.1; clears the four hono advisories, though this worker mounts no CORS middleware and no `hono/language`, so none were reachable here); `wrangler` dev dependency `^4.114.0` → `^4.120.0` (Sprint 6 dev-toolchain advisory sweep).

## [1.3.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 5).

### Fixed

- **BUG-035**: throw-safe, outcome-checked Discord API wrappers (`safeSendMessage` / `safeEditMessage`) at every call site — API failures are logged instead of silently dropped.
- **BUG-073**: MODERATOR_IDS parsed via the shared `@xivdyetools/bot-logic` grammar (whitespace/comma separators + snowflake validation) — the code now matches its documentation.
- **REFACTOR-027 (docs)**: CLAUDE.md corrected to state what the inter-worker HMAC actually signs (`timestamp:userId:userName`); signature v2 (binding method/path/body) deferred to the shared-signer extraction.

## [1.2.0] - 2026-04-07

### Security

- **SEC-001**: Added global `onError` handler to prevent stack trace leakage in production error responses
- **SEC-005**: Fixed placeholder `DISCORD_CLIENT_ID` value in `wrangler.toml` `[env.production.vars]`; added startup validation in `env-validation.ts` to detect placeholder at boot time

### Changed

- Migrated request-ID, logger, and rate-limit middleware to `@xivdyetools/worker-middleware`; deleted local middleware files
- **ARCH-001**: Removed `nodejs_compat` compatibility flag from `wrangler.toml`
- **BUG-001**: Re-enabled strict TypeScript checks; cleaned up unused variables and implicit returns

---

## [1.1.9] - 2026-03-18

### Fixed

- **ARCH-001**: Deploy workflow now triggers on changes to `crypto` package (transitive dependency via auth)

---

## [1.1.8] - 2026-03-09

### Changed

- Updated `hono` from 4.12.3 to 4.12.5 (security: SSE injection, cookie injection, middleware bypass fixes)
- Updated `@cloudflare/workers-types` from 4.20260305.0 to 4.20260307.1
- Updated `wrangler` from 4.69.0 to 4.71.0
- Updated `@types/node` from 25.3.3 to 25.3.5

## [1.1.7] - 2026-02-27

### Fixed

- **ESLint v10 compatibility**: Remove dead initializer (`message`) in `url-sanitizer.ts` for `no-useless-assignment` rule

## [1.1.6] - 2026-02-21

### Fixed

- **BUG-002**: Fix `safeParseJSON` prototype pollution check — use `Object.hasOwn()` instead of `in` operator, which false-positived on every object due to inherited `__proto__`/`constructor`
- **BUG-003**: Fix rate limit response returning HTTP 429 instead of 200 — Discord silently discards non-200 interaction responses

### Changed

- Resolve lint errors

## [1.1.5] - 2026-02-19

### Added

- **REFACTOR-001**: Added `env-validation.ts` for startup environment variable validation
  - Validates all required secrets, config variables, and bindings on first request
  - Validates `MODERATOR_IDS` entries as Discord Snowflake format
  - Fails fast in production if misconfigured (returns 503)
  - Provides structured error logging via `@xivdyetools/logger` when available

---

## [1.1.4] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

### Fixed

- Updated test suite for `@xivdyetools/auth` migration (REFACTOR-003 follow-up)
  - Fixed `verify.test.ts` to mock shared auth package instead of deprecated `discord-interactions`

---

## [1.1.3] - 2026-01-26

### Changed

- **REFACTOR-003**: Migrated authentication utilities to `@xivdyetools/auth` shared package
  - Discord signature verification now uses `verifyDiscordRequest()` from shared package
  - Timing-safe comparison now uses `timingSafeEqual()` from shared package
  - Reduces code duplication across Discord workers

---

## [1.1.2] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated KV-based rate limiting to `@xivdyetools/rate-limiter` shared package
  - Uses `KVRateLimiter` with separate `checkOnly()` and `increment()` methods
  - Preserves MOD-BUG-001 fix (optimistic concurrency with retries) via shared implementation
  - Maintains command/autocomplete burst allowance configurations

---

## [1.1.1] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`

---

## [1.1.0] - 2026-01-19

### Fixed

- **MOD-BUG-001**: Fixed race condition in rate limiting. Applied optimistic concurrency with retries and version metadata (same pattern as DISCORD-BUG-001)

### Refactored

- **MOD-REF-001**: Refactored `processModerateCommand` (162 lines) into focused handler functions
  - Created `ModerationContext` interface to reduce 8 parameters to 1 context object
  - Extracted `handlePendingAction()`, `handleApproveAction()`, `handleRejectAction()`, `handleStatsAction()`
  - Added `validatePresetIdOrSendError()` shared validation eliminating ~20 lines of duplication
  - Main function reduced from 162 to ~45 lines (thin dispatcher pattern)

- **MOD-REF-002**: Extracted shared modal types to `src/types/modal.ts`
  - `ModalInteraction` interface, `ModalComponents` type
  - `extractTextInputValue()`, `getModalUserId()`, `getModalUsername()` helpers
  - Removed duplicate code from `preset-rejection.ts` and `ban-reason.ts`

---

## [1.0.0] - 2025-12-14

### Added

- Initial release of XIV Dye Tools Moderation Worker
- **Preset Moderation** - Review pending presets, approve or reject with reasons
- **User Management** - Ban/unban users from the Preset Palettes system
- **Edit Reversion** - Revert flagged edits to previous versions
- **Multi-Language Support** - Full localization for EN, JA, DE, FR, KO, ZH
- **Audit Logging** - All moderation actions logged for accountability
- **Ed25519 Verification** - Secure Discord interaction verification
- **Slash Commands**:
  - `/preset moderate [preset_id]` - View and moderate pending presets
  - `/preset ban_user <user>` - Ban a user from submitting/editing presets
  - `/preset unban_user <user>` - Remove a ban from a user
- **Cloudflare Workers Deployment** - Serverless edge execution
- **D1 Database Integration** - Shared presets, bans, and audit log storage
- **KV Namespace Integration** - User preferences and rate limiting
- **Hono Framework** - Lightweight web framework for routing
- **@xivdyetools/logger Integration** - Structured request logging
- **@xivdyetools/types Integration** - Shared type definitions
