# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.1.0] - 2026-02-27

### Added

- **Prevent Duplicate Results**: `/extractor image` now deduplicates dyes across palette slots — when a monochromatic image causes multiple extracted colors to match the same dye, later slots are reassigned to the next-best unique alternative via `findDyesWithinDistance()`. Always on (no toggle needed with max 5 slots and 136 dyes)

### Fixed

- **ESLint v10 compatibility**: Fix lint errors for new `eslint:recommended` rules
  - `prefer-const`: Convert `uniqueUsersToday` to const in `analytics.ts`
  - `preserve-caught-error`: Add `{ cause: error }` to re-thrown errors in `photon.ts`, `validators.ts`, and `renderer.ts` (2 locations)

## [4.0.2] - 2026-02-21

### Fixed

- Fix `targetDye.hex` reference bug in budget handler
- Fix `stats.test.ts` mock to reject with raw string instead of Error object

### Changed

- Fix 85+ lint errors (unused imports, unsafe type assertions, no-floating-promises, require-await, no-case-declarations)

## [4.0.1] - 2026-02-09

### Fixed

- **BUG-001**: Fixed LocalizationService singleton race condition under concurrent requests
  - Replaced global singleton mutation with per-locale instance cache (`Map<LocaleCode, LocalizationService>`)
  - `getLocalizedDyeName()` and `getLocalizedCategory()` now accept explicit `locale` parameter
  - Updated all 16 command handlers to pass locale explicitly, eliminating shared mutable state
- **BUG-002**: Fixed budget "no world set" displaying a broken image embed
  - JSON responses cannot carry file attachments; replaced with text-only ephemeral response
- **BUG-003**: Fixed `renameCollection()` missing input sanitization
  - Added `sanitizeCollectionName()` call to match `createCollection()` behavior
  - Prevents control characters, Zalgo text, and invisible Unicode in renamed collections
- **BUG-004**: Added timeouts to `sendFollowUp()` and `editOriginalResponse()` Discord API calls
  - 5-second timeout (`AbortSignal.timeout`) for JSON webhook requests
  - 10-second timeout for multipart/file upload requests (larger payloads need more time)
  - Deadline-aware wrappers (`sendFollowUpWithDeadline`, `editOriginalResponseWithDeadline`) skip calls when Discord's 3-second interaction deadline is exceeded
- **BUG-005**: Fixed GitHub webhook reading entire body before checking payload size
  - Added `Content-Length` header pre-check before `c.req.text()` to reject oversized payloads without buffering
  - Retains post-read body length check as defense-in-depth (in case header is missing or spoofed)
- **BUG-007**: Fixed unique user tracking race condition and unbounded KV value growth
  - Replaced single comma-separated string (`stats:users:{date}`) with individual KV keys (`usertrack:{date}:{userId}`)
  - Eliminates read-modify-write race condition (concurrent requests could lose user IDs)
  - Each key is a fixed 1-byte value with TTL auto-expiry instead of an ever-growing string
  - Read-first optimization conserves KV write quota (100k reads/day free vs 1k writes/day)

### Changed

- **REFACTOR-001**: Consolidated duplicate `resolveDyeInput()` from `favorites.ts` and `collection.ts` into `utils/color.ts`
  - Fixes subtle Facewear fallback bug: previously returned a Facewear dye when all search results were Facewear, now correctly returns `null`
  - Both deprecated handlers import from the single shared implementation
- **REFACTOR-002**: Consolidated 9 duplicate `DyeService` instantiations into single shared singleton
  - `utils/color.ts` exports the canonical `dyeService` instance; all other files now import it
  - Eliminates 8 redundant `new DyeService(dyeDatabase)` calls across `index.ts`, `dye.ts`, `favorites.ts`, `collection.ts`, `match-image.ts`, `preset.ts`, `swatch.ts`, and `budget-calculator.ts`
- **REFACTOR-004**: Localized all preferences command strings across 6 languages
  - Preference key labels, display values, validation messages, and subcommand responses use `t.t('preferences.*')` i18n keys
  - ~30 locale keys added to en, ja, de, fr, ko, zh locale files

### Performance

- **OPT-001**: Added 1-hour in-memory cache for world/datacenter autocomplete data
  - `getWorldAutocomplete()` and `validateWorld()` now use cached results
  - Eliminates redundant HTTP requests on every Discord autocomplete keystroke
- **OPT-002**: Pre-filter dyes by color distance before fetching market prices in `/budget find`
  - Calculates color distance (CPU-only) for all 136 tradeable dyes, then fetches prices only for candidates within `maxDistance`
  - Reduces Universalis API calls by 70–85% on cold cache (typically 15–40 candidates instead of 136)
- **OPT-004**: Removed unnecessary SVG→PNG generation in budget "no world set" path
  - The rendered image was never attached to the response (wasted ~50-100ms CPU per invocation)

### Dependencies

- Bumped `@cloudflare/workers-types` to 4.20260207.0
- Bumped `hono` to 4.11.9
- Bumped `@types/node` to 25.2.2

---

## [4.0.0] - 2026-02-05

### Added

#### V4 Infrastructure (Phase 1)
- **Unified Preferences System**: Centralized user settings management with KV storage and migration from legacy keys (`i18n:user:*`, `budget:world:v1:*`)
  - 8 configurable preferences: language, blending, matching, count, clan, gender, world, market
- **Image Caching Service**: Cloudflare Cache API wrapper for SVG→PNG render results with TTL strategy (24h standard, 2h with market data)
- **Error UX Standard**: 6 error categories (validation, notFound, rateLimit, external, internal, permission) with consistent styling and error codes
- **Component Context Storage**: KV-backed context storage for Discord message components with short hash keys and TTL
- **Pagination System**: Button-based navigation for large result sets with 5-button (full) and 3-button (compact) layouts
- **Progress Feedback Service**: Status updates for long-running operations via deferred Discord responses

#### New Commands (Phases 2-3)
- `/extractor` - Merges `/match` and `/match_image` into one command
  - `color` subcommand: find closest dye(s) to a hex color or dye name
  - `image` subcommand: extract colors from image and match to dyes
- `/gradient` - Renamed from `/mixer`, generates color gradients between two colors with dye matches
  - Added color space interpolation: HSV (default), OKLCH, LAB, LCH, RGB
  - Added matching algorithm selection: OKLAB, CIEDE2000, CIE76, HyAB, RGB
- `/preferences` - Unified settings management (show/set/reset) for all 8 user preferences
  - Enhanced `set` subcommand to accept multiple options in a single invocation
- `/mixer` (NEW) - Dye blending with 6 color algorithms: RGB, LAB, OKLAB, RYB, HSL, Spectral (Kubelka-Munk)
- `/swatch` - Character color matching for skin, hair, eyes, highlights, lips, tattoos, facepaint across all 16 FFXIV clans
- `/stats` - Expanded from single embed to 5 subcommands: summary (public), overview, commands, preferences, health (admin)

#### Command Enhancements (Phase 5)
- `/comparison`: Added LAB color values (perceptual color space) with increased section height
- `/dye info`: New visual result card showing large color swatch, dye name, category, HEX/RGB/HSV/LAB values, and internal IDs
- `/dye random`: New visual infographic grid with 5-dye card layout, 3-column grid with centered last row
- `/harmony`: Added `color_space` parameter for hue rotation (HSV, OKLCH, LCH, HSL)

#### CJK Font Rendering
- Bundled subsetted Noto Sans SC (Chinese/Japanese, ~222 KiB) and Noto Sans KR (Korean, ~155 KiB) for proper glyph rendering
- Updated 7 SVG templates with CJK font fallback chains
- Added `scripts/subset-cjk-fonts.py` for re-subsetting when locales change

#### Changelog Announcement System (Phase 7)
- GitHub webhook endpoint listening for pushes to main branch
- Detects CHANGELOG-laymans.md changes, parses latest version entry
- Posts rich Discord embed to announcement channel
- New files: `github.ts` types, `github-verify.ts`, `changelog-parser.ts`, `announcements.ts`

#### CI/CD
- GitHub Actions workflow for automated Cloudflare deployment with CJK font support

### Changed

#### Localization (Phase 6)
- Added locale sections for all v4 commands (swatch, preferences, stats, gradient, extractor, mixer blending modes, pagination, components, matching methods) across all 6 languages
- Localized `/about` command categories and descriptions
- Localized `/mixer` and `/swatch` commands with full i18n support
- Migrated `extractor.ts` from `match.*` to `extractor.*` locale keys
- Migrated `gradient.ts` from `mixer.*` to `gradient.*` locale keys
- Added multilingual support for webhook notifications and admin message formatting

#### Command Deprecations (Phase 4)
- `/language` → Soft deprecated, delegates to `/preferences set language` with yellow deprecation notice
- `/favorites` → Soft deprecated, points to `/preset` with deprecation warnings
- `/collection` → Soft deprecated, points to `/preset` with deprecation warnings
- Command registration updated with `[DEPRECATED]` prefixes

#### Command Registration (Phase 8)
- Removed deprecated commands from registration: `/match`, `/match_image`, `/favorites`, `/collection`
- Final command set: 15 commands (about, harmony, dye, extractor, gradient, mixer, accessibility, manual, stats, preferences, swatch, comparison, language, preset, budget)

#### Dependencies
- Bumped `@xivdyetools/core` to ^1.16.0 (color space support, Korean/Chinese dye names)
- Bumped `@xivdyetools/auth` to ^1.0.2 (timing-safe JWT and HMAC verification)
- Bumped `@xivdyetools/logger` to ^1.1.2 (expanded secret redaction, recursive nested redaction)
- Bumped `@xivdyetools/rate-limiter` to ^1.3.0 (IP spoofing mitigation, IPv6 normalization, KV key safety)
- Bumped `@cloudflare/workers-types` to 4.20260131.0
- Bumped `hono` to 4.11.7
- Bumped `wrangler` to 4.61.1

### Security

#### Dependency Security Audit (2026-02-06)
- **FINDING-001** (auth): JWT signature verification now uses `crypto.subtle.verify()` for timing-safe comparison
- **FINDING-002** (auth): HMAC base64url verification upgraded to timing-safe `crypto.subtle.verify()`
- **FINDING-003** (rate-limiter): `getClientIp()` now supports `trustXForwardedFor` option to disable spoofable header fallback
- **FINDING-005** (logger): Added 6 new secret redaction patterns (`client_secret`, `private_key`, `signing_key`, `webhook_secret`, `auth_token`, `credentials`)
- **FINDING-006** (rate-limiter): IP addresses normalized to lowercase, preventing IPv6 case mismatches in rate-limit keys
- **FINDING-007** (rate-limiter): KV key delimiter changed to avoid ambiguity with IPv6 colons
- **FINDING-008** (logger): Context field redaction now recurses into nested objects (up to 3 levels)
- Full audit report: `xivdyetools-docs/audits/2026-02-06/SECURITY_AUDIT_REPORT.md`

### Fixed

- `/extractor image` quality badges (EXCELLENT, GOOD, FAIR) now vertically centered in each palette row instead of aligned to bottom text baseline
- `/swatch` grid command registration now advertises 1-based row/col ranges matching handler validation
- `/budget` command failures resolved:
  - Use `fetchPricesBatched` for >100 dyes on cold cache
  - Rewrite Universalis aggregated API response parsing to match actual array-based format
  - Filter Facewear dyes with synthetic negative itemIDs (`itemID > 0`)
  - Migrate from legacy user-preferences to unified preferences system
  - Added full i18n support with CJK font fallbacks for SVG graphic

### Performance

- Migrated component context storage from KV to Cache API (eliminates ~1 KV write per interactive command)
- Migrated price cache from KV to Cache API (eliminates ~136 KV writes per `/budget` command)
- Migrated rate limiting from KV to Upstash Redis (atomic operations, eliminates race conditions from DISCORD-BUG-001)
  - Upstash preferred when configured, automatic fallback to KV if not
  - Uses Redis `INCR` for truly atomic counter increments
  - 10,000 free commands/day vs KV's 1,000 writes/day
- All migrations combined keep the worker well within free-tier limits

---

## [2.3.9] - 2026-01-26

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
  - Fixed `analytics.test.ts` mock to properly support OPT-002 list() optimization

---

## [2.3.8] - 2026-01-26

### Changed

- **REFACTOR-003**: Migrated authentication utilities to `@xivdyetools/auth` shared package
  - Discord signature verification now uses `verifyDiscordRequest()` from shared package
  - Timing-safe comparison now uses `timingSafeEqual()` from shared package
  - Reduces code duplication across Discord workers

---

## [2.3.7] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated KV-based rate limiting to `@xivdyetools/rate-limiter` shared package
  - Uses `KVRateLimiter` with `getDiscordCommandLimit()` for command-specific limits
  - Preserves per-user, per-command rate limiting pattern
  - Fail-open behavior maintained via shared package implementation

---

## [2.3.6] - 2026-01-25

### Performance

- **OPT-002**: Optimized analytics `getStats()` using KV list() with metadata
  - Stores counter values in KV metadata during `incrementCounter()`
  - `getStats()` now uses single `kv.list()` call instead of 14+ individual gets
  - Removes hardcoded command list - dynamically discovers all tracked commands
  - Includes backward compatibility fallback for counters without metadata
  - **Reference**: Security audit OPT-002 (2026-01-25)

---

## [2.3.5] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`

---

## [2.3.4] - 2026-01-19

### Fixed

- **DISCORD-BUG-001**: Fixed non-atomic counter increment in analytics. Added optimistic concurrency with retries and version tracking via KV metadata to prevent lost updates under concurrent load
- **DISCORD-BUG-002**: Verified Analytics.writeDataPoint already had try-catch error handling with logger support (no changes needed)

### Refactored

- **DISCORD-REF-001**: Extracted shared color utilities to `src/utils/color.ts`
  - `isValidHex()` - Supports both 6-digit and optional 3-digit shorthand validation
  - `normalizeHex()` - Ensures `#` prefix and expands 3-digit to 6-digit (`#F00` → `#FF0000`)
  - `resolveColorInput()` - Flexible options for different command needs
  - Reduced ~110 lines of duplicated functions across 5 command handlers

---

## [2.3.3] - 2026-01-07

### Added

- **Localization**: Added `matchImageHelp` section translations for all supported languages
  - German (de), French (fr), Japanese (ja), Korean (ko), Chinese (zh)
  - Ensures feature parity with English locale for `/match_image` help command

### Changed

- Updated @xivdyetools/core to 1.5.6 (fixes missing metallic dye IDs)

## [2.3.2] - 2026-01-05

### Added

- **Text Sanitization Utility**: New `src/utils/sanitize.ts` module for secure text handling
  - `sanitizeDisplayText()` - Removes control characters, zalgo text, invisible Unicode
  - `sanitizePresetName()` / `sanitizePresetDescription()` - Preset-specific sanitization
  - `sanitizeCollectionName()` / `sanitizeCollectionDescription()` - Collection-specific sanitization
  - `sanitizeErrorMessage()` - Converts HTTP status codes to safe user messages

### Security

#### Medium Priority Audit Fixes (2026-01-05 Security Audit)

- **M-001**: Sanitized preset names/descriptions before display in Discord embeds
  - Preset webhook embeds now use `sanitizePresetName()` and `sanitizePresetDescription()`
  - Prevents zalgo text, invisible characters, and display issues

- **M-002**: Added character validation for collection names
  - `createCollection()` now sanitizes names/descriptions before storage
  - Removes control characters, normalizes whitespace, enforces length limits

- **M-003**: Sanitized API error messages shown to users
  - Added `getSafeMessage()` method to `PresetAPIError` class
  - Error handlers now use safe messages instead of raw upstream errors
  - Prevents exposing internal API details to end users

---

## [2.3.1] - 2025-12-24

### Changed

- Updated `@xivdyetools/core` to ^1.5.3 for latest bug fixes and performance improvements
- Updated `@xivdyetools/logger` to ^1.0.2 for improved log redaction patterns
- Updated `@xivdyetools/types` to ^1.1.1 for new Dye fields and branded type documentation

---

## [2.3.0] - 2025-12-24

### Changed

#### Low Priority Audit Fixes

- **DISCORD-MED-003**: Added KV schema versioning for future data migrations
  - Added `KV_SCHEMA_VERSION` constant (`v1`) to key prefixes in `user-storage.ts`
  - Keys now follow pattern: `xivdye:favorites:v1:userId`
  - Enables non-breaking schema evolution when data format changes
  - **Note**: Existing user favorites/collections reset (users can rebuild)

### Fixed

#### Security Audit - Critical Issues Resolved

- **DISCORD-CRITICAL-001**: Fixed analytics tracking to use actual command success status
  - Analytics now tracks after command execution, not before
  - Wraps command execution in try-catch to capture failures
  - Provides accurate success/failure metrics for monitoring
- **DISCORD-CRITICAL-002**: Documented race condition in collection autocomplete
  - Added explanatory comment about stale dye counts during concurrent modification
  - Full fix would require schema changes (version/etag on collections)
- **DISCORD-CRITICAL-003**: Fixed timing-safe comparison bypass in webhook auth
  - Separated secret configuration check from auth verification
  - Prevents timing oracle attack to detect configured vs unconfigured secrets

---

## [2.2.0] - 2025-12-15

### Added

#### User Ban System
- `/preset ban_user` - Ban a user from Preset Palettes (moderators only)
  - Autocomplete searches preset authors by username
  - Shows confirmation embed with user details and last 3 presets
  - Modal for entering ban reason
  - Hides all user's presets on ban
- `/preset unban_user` - Unban a user (moderators only)
  - Autocomplete searches currently banned users
  - Restores hidden presets on unban

#### New Files
- `src/types/ban.ts` - Type definitions for ban system
- `src/services/ban-service.ts` - Core ban operations (check, search, ban, unban)
- `src/handlers/commands/preset-ban.ts` - Subcommand handlers
- `src/handlers/buttons/ban-confirmation.ts` - Confirmation button handlers
- `src/handlers/modals/ban-reason.ts` - Ban reason modal handler

### Changed

- Updated `/preset` command registration with ban_user and unban_user subcommands
- Added `hidden` status to STATUS_DISPLAY for banned user presets
- Added autocomplete routing for ban/unban user searches
- Added modal routing for ban reason input

---

## [2.1.1] - 2025-12-15

### Fixed

- **Authentication**: HMAC signatures now sent with Service Binding requests, not just URL fallback
  - Previously, HMAC signing code was inside the `else` block for URL-based requests
  - Service Binding requests were missing signatures, causing "Valid authentication required" errors
  - Voting and other authenticated operations now work correctly via Service Binding
- **Production Config**: Added missing bindings to `[env.production]` in `wrangler.toml`
  - KV namespace, D1 database, Service Binding, and Analytics Engine were not inherited
  - Preset autocomplete and other features now work in production

### Changed

- Updated `wrangler.toml` documentation to clarify `BOT_SIGNING_SECRET` is required

---

## [2.1.0] - 2025-12-14

### Added

- **Structured Logging**: Complete migration to `@xivdyetools/logger/worker` for structured request logging
- **Request Logger Middleware**: New middleware for consistent request/response logging
- **Deadline Tracking**: Added 3-second deadline tracking for Discord interaction timeout handling (DISCORD-PERF-001)

### Changed

- **Dependency Migration**: Migrated from `xivdyetools-core` to `@xivdyetools/core`
- **Types Migration**: Migrated `types/preset.ts` to use `@xivdyetools/types`
- **Logging Refactor**: Replaced all `console` calls with structured logger

### Fixed

- **Security**: Added HMAC signature to preset API fallback requests
- **Security**: Strengthened SSRF protection with redirect validation
- **Security**: Added cross-cutting security improvements
- **Rate Limiter**: Addressed HIGH severity rate limiter audit findings
- **Medium Severity**: Addressed MEDIUM severity audit findings
- **Tests**: Updated test mocks and expectations for logger migration

### Deprecated

#### Type Re-exports
The following re-exports from `src/types/preset.ts` are deprecated and will be removed in the next major version:

- **Preset Types** (PresetStatus, PresetCategory, CommunityPreset, etc.): Import from `@xivdyetools/types` instead
- **Request Types** (PresetFilters, PresetSubmission, etc.): Import from `@xivdyetools/types` instead
- **Response Types** (PresetListResponse, VoteResponse, etc.): Import from `@xivdyetools/types` instead
- **Moderation Types** (ModerationLogEntry, ModerationStats): Import from `@xivdyetools/types` instead

**Note:** Project-specific types (PresetNotificationPayload, PresetAPIError, CATEGORY_DISPLAY, STATUS_DISPLAY) remain unchanged.

**Migration Guide:**
```typescript
// Before (deprecated)
import { PresetStatus, CommunityPreset } from '@/types/preset';

// After (recommended)
import type { PresetStatus, CommunityPreset } from '@xivdyetools/types';
```

---

## [2.0.1] - 2025-12-08

### Changed

#### About Command Enhancement
- `/about` now displays all 17 available commands organized by category
- Version number is dynamically imported from `package.json`
- Commands grouped: Color Tools, Dye Database, Analysis, Your Data, Community, Utility
- Added invite bot link and timestamp
- Added Patreon link to support resources

### Files Added
- `src/handlers/commands/about.ts` - Dedicated about command handler

### Files Modified
- `src/handlers/commands/index.ts` - Export about handler
- `src/index.ts` - Route to about handler instead of inline response

---

## [2.0.0] - 2025-12-08

### Added

#### Stats Command
- `/stats` - Display bot usage statistics (authorized users only)
- KV-based counters for real-time stats (total commands, success rate, top commands)
- Analytics Engine integration for long-term storage
- Access controlled via `STATS_AUTHORIZED_USERS` secret

#### Manual Command Enhancement
- `/manual topic:match_image` - Dedicated help for image matching
- Three comprehensive embeds: How It Works, Examples, Technical Details
- Full localization support in `matchImageHelp` namespace

#### Analytics Service
- New `src/services/analytics.ts` for command tracking
- Automatic tracking of all command executions
- Unique user counting per day
- Command breakdown statistics

### Changed

- **Version bump to 2.0.0** - This release marks full feature parity with the deprecated traditional bot
- Updated `wrangler.toml` with Analytics Engine binding
- Updated `src/types/env.ts` with `ANALYTICS` and `STATS_AUTHORIZED_USERS`
- Enhanced `src/handlers/commands/manual.ts` with topic parameter support

### Deprecated

- The traditional `xivdyetools-discord-bot` (Node.js/Discord.js) is now fully deprecated
- Moved to `_deprecated/` folder in the monorepo
- This worker is now the sole Discord bot for XIV Dye Tools

### Files Added
- `src/services/analytics.ts` - Analytics tracking service
- `src/handlers/commands/stats.ts` - Stats command handler

### Files Modified
- `wrangler.toml` - Added Analytics Engine binding
- `src/types/env.ts` - Added new environment types
- `src/handlers/commands/manual.ts` - Added topic parameter
- `src/handlers/commands/index.ts` - Export stats handler
- `src/index.ts` - Route stats command, add analytics tracking
- `src/locales/en.json` - Added matchImageHelp translations
- `scripts/register-commands.ts` - Added stats command and manual topic option
- `package.json` - Version 2.0.0
- `CLAUDE.md` - Updated documentation

---

## [1.1.0] - 2025-12-07

### Added

#### Preset Editing
- `/preset edit` - Edit your own presets (name, description, dyes, tags)
- Autocomplete for user's own presets
- Duplicate dye combination detection
- Content moderation for edited text

#### Moderation
- **Revert Button**: New moderation button to revert flagged edits
- Modal for revert reason input
- Logs revert actions in moderation log

### Changed

- Updated `/preset` command registration with edit subcommand
- Added `preset_revert_` button handler

### Files Modified
- `src/handlers/commands/preset.ts` - Edit subcommand
- `src/handlers/buttons/preset-moderation.ts` - Revert button handler
- `src/services/preset-api.ts` - Edit and revert API methods
- `scripts/register-commands.ts` - Updated command definitions

---

## [1.0.0] - 2025-12-07

### Added

#### Architecture
- **HTTP Interactions**: Discord bot using HTTP Interactions instead of Gateway WebSocket
- **Cloudflare Workers**: Serverless deployment on Cloudflare edge network
- **Ed25519 Verification**: Request signature verification for Discord interactions

#### Commands
- `/harmony` - Generate color harmony wheels (complementary, triadic, analogous, split-complementary, tetradic, square)
- `/match <color>` - Find closest FFXIV dye to a hex color
- `/match_image` - Extract and match colors from uploaded images (1-5 colors with K-means++ clustering)
- `/dye <name>` - Search the 136-dye database by name
- `/mixer <start> <end>` - Create color gradients between two dyes
- `/accessibility <dye>` - Simulate colorblindness for dye colors
- `/comparison` - Compare multiple dyes side-by-side
- `/manual` - Help and documentation
- `/language` - Change bot UI language (6 languages supported)
- `/favorites` - Manage favorite dyes (add, remove, list)
- `/collection` - Create and manage custom dye collections
- `/preset` - Browse, submit, and vote on community presets
- `/about` - Bot information and credits

#### Features
- **SVG→PNG Rendering**: High-quality image generation via resvg-wasm
- **Rate Limiting**: Per-user, per-command sliding window rate limiter (KV-backed)
- **Favorites System**: Save up to 20 favorite dyes per user
- **Collections System**: Create up to 50 custom collections with up to 20 dyes each
- **Community Presets**: Browse, submit, and vote on user-created color palettes
- **Multi-Language Support**: Full localization for EN, JA, DE, FR, KO, ZH

#### Integrations
- **Service Binding**: Direct connection to xivdyetools-presets-api for preset operations
- **xivdyetools-core**: Shared color algorithms, dye database, and type definitions
- **Universalis API**: Real-time market board pricing (optional)

#### Storage
- **Cloudflare KV**: User preferences, favorites, collections, rate limit counters
- **Cloudflare R2**: Generated images with automatic expiration (optional)
