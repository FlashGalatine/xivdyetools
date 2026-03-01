# Changelog

All notable changes to the XIV Dye Tools monorepo will be documented in this file.

This changelog covers the **monorepo itself** (workspace structure, CI/CD, shared configuration). For individual package changelogs, see the `CHANGELOG.md` in each package's directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **web-app**: Shift+Click pixel sampling in Extractor tool — samples a pixel (or configurable NxN area) and finds closest matching dyes using v4 unified result cards
- **web-app**: Ctrl/Cmd+Drag panning for zoomed images in Extractor tool with grab cursor feedback
- **web-app**: Pixel Sample Area size config (1×1 to 16×16) in the Extractor sidebar
- **web-app**: Pan offset persistence across zoom changes in Extractor tool
- **web-app**: New locale keys for pixel sampling and panning in all 6 languages
- **docs**: Dead code audit (2026-02-28) — 19 findings (DEAD-001 through DEAD-019) with categorized reports, evidence, and analysis manifest

### Changed

- **web-app**: Migrate `@shared/types` re-exports to direct `@xivdyetools/types` imports across 46 files; deprecated re-export blocks removed from `shared/types.ts` (local types `Theme`, `AppState`, `DataCenter`, `World` remain)
- **web-app**: Migrate `NoOpLogger` import from `@xivdyetools/core` to `@xivdyetools/logger/library` in `api-service-wrapper.ts`
- **bot-i18n**: Marked `LocaleData` and `TranslatorLogger` type exports as `@internal` (DEAD-033)
- **bot-logic**: Marked `HARMONY_TYPES`, `VISION_TYPES`, `EmbedData`, `EmbedField`, `ResolveColorOptions` as `@internal` (DEAD-037–040); cleaned up stale REFACTOR comment markers (DEAD-041)
- **core**: Wave 9 — `@xivdyetools/core` v2.0.0: marked 28 symbols `@internal` (DEAD-045, DEAD-046, DEAD-048, DEAD-054); added `isAbortError` tests (DEAD-054); removed all deprecated type re-exports — import `Dye`, `RGB`, `PresetCategory`, etc. from `@xivdyetools/types` (DEAD-047 Phase 2)
- **bot-logic**: Added `@xivdyetools/types` as explicit dependency; migrated `Dye` type imports across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **svg**: Migrated `Dye`/`RGB` type imports across 7 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **discord-worker**: Migrated type imports (`Dye`, `RGB`, `CharacterColorMatch`) across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **og-worker**: Migrated type imports (`Dye`, `SubRace`, `Gender`) across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **stoat-worker**: Migrated `Dye` type import from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **web-app**: Migrated type imports (`Dye`, `PresetCategory`, `PresetPalette`, `PresetData`, `CategoryMeta`, `PriceData`, `CachedData`) across 10 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)

### Removed

- **svg**: Dead code cleanup — Wave 13 (DEAD-077–082, DEAD-085 from 2026-02-28 audit)
  - Phase 1: Remove unused params/interfaces in `comparison-grid.ts` (DEAD-079, DEAD-080); remove unused `baseName` from `HarmonyWheelOptions` (DEAD-081); remove dead `export * from '@xivdyetools/svg'` re-export in discord-worker (DEAD-082)
  - Phase 2: Extract `rgbToHsv()` to shared `base.ts` utility (DEAD-077); replace local luminance/contrast with `ColorService` (DEAD-078); standardize truncation with `truncateText()` (DEAD-085)
- **bot-logic**: Remove `baseName` from `generateHarmonyWheel()` call — follows svg DEAD-081
- **web-app**: 5 orphaned v3 components — `tool-header`, `dye-comparison-chart`, `dye-preview-overlay`, `featured-presets-section`, `mobile-bottom-nav` (DEAD-002 – DEAD-005, DEAD-007)
- **web-app**: Dead v3 components `AppLayout` and `SavedPalettesModal` plus their tests (DEAD-001, DEAD-006)
- **web-app**: Components barrel files `components/index.ts` and `v4/index.ts`; `main.ts` updated to import `offlineBanner` directly (DEAD-008, DEAD-009)
- **web-app**: Deprecated `fetchPrice()` and `getWorldName()` from MarketBoard component (DEAD-010)
- **web-app**: `LocalStorageCacheBackend` class and all associated tests (DEAD-011)
- **web-app**: ~30 unused constants from `shared/constants.ts` — API config, FFXIV stats, chart/zoom/sampling/color-wheel config, `SUCCESS_MESSAGES`, `ANIMATION_DURATIONS` (DEAD-012)
- **web-app**: Unused empty-state icon exports and lookup functions (DEAD-013), unused UI icon exports and lookup functions (DEAD-014)
- **web-app**: 26 unused local variables across 16 component/service files (DEAD-015)
- **web-app**: `initErrorTracking()`, `errorTrackerInstance`, dead production error-tracking branches, `isProd()` (DEAD-017)
- **web-app**: Dead icon exports from `empty-state-icons.ts` and `ui-icons.ts` (DEAD-009, DEAD-013, DEAD-014)
- **discord-worker**: Dead code cleanup — Wave 5 (DEAD-020 through DEAD-023 from 2026-02-28 audit):
  - 6 dead service/util files + tests: `pagination`, `progress`, `image-cache`, `color-blending`, `user-preferences`, `css-colors` (DEAD-020)
  - 6 orphaned locale JSON files duplicating `@xivdyetools/bot-i18n` data (DEAD-021)
  - Legacy `handleMixerCommand` handler, replaced by `handleGradientCommand` (DEAD-022)
  - Unused `discord-interactions` devDependency (DEAD-023)
- **discord-worker**: Dead code cleanup — Wave 6 (DEAD-024–027, 029, 035): `InteractionContext`/deadline infrastructure, 4 unused component builders, legacy KV preference functions, dead exports, unused re-exports
- **bot-i18n**: 3 unused function exports (`translate`, `getAvailableLocales`, `isLocaleSupported`) and 5 unused locale key sections (`buttons`, `status`, `pagination`, `components`, `matching`) from all 6 language files (DEAD-032, DEAD-034)
- **bot-logic**: `resolveCssColorName` from barrel export — internal helper not part of public API (DEAD-036)
- **core**: Dead code cleanup — Wave 7 (DEAD-043, 044, 049–053): legacy omnibus test files (`core.test.ts`, `logger.test.ts`), deprecated `characterColorData` barrel export, 3 orphaned `add-type-flags` scripts, `compare-scrapes.js`, stale `response.json` debug artifact, tracked `dye_names.csv`
- **core**: Dead code cleanup — Wave 8 (DEAD-042, DEAD-047 Phase 1): deprecated `types/logger.ts` wrapper file, ~35 zero-consumer deprecated barrel re-exports (auth types, preset sub-types, localization types, character types/constants, error types, color space types, `Logger`/`NoOpLogger`/`ConsoleLogger`)
- **types**: Dead code cleanup — Wave 10 Phase 1 (DEAD-060, DEAD-061, DEAD-063): removed entire utility module (`Result`, `AsyncResult`, `Nullable`, `Optional`, `isOk`, `isErr`), removed generic API response types (`APISuccessResponse`, `APIErrorResponse`, `APIResponse`), removed orphaned preset types (`AuthenticatedPresetSubmission`). `ResolvedPreset` migrated to `@xivdyetools/core` PresetService (audit had missed core consumer)
- **types**: Dead code cleanup — Wave 10 Phase 2 (DEAD-057, DEAD-058, DEAD-059, DEAD-060, DEAD-064): marked 31 symbols `@internal` and removed from main barrel — 11 preset response sub-types, 7 auth response sub-types, `DiscordSnowflake`/`createSnowflake`, `CharacterColorCategory`, `Matrix3x3`, `Race`, `SharedColorCategory`, `RaceSpecificColorCategory`, `LocalizedDye`, `DyeDatabase`. All remain accessible via subpath imports
- **core**: `ResolvedPreset` interface now defined and exported from `PresetService` (migrated from `@xivdyetools/types`)
- **logger**: Dead code cleanup — Wave 11 (DEAD-066–070): removed `getRequestId` from barrel exports (deprecated, superseded by app-local Hono Context versions); marked 10 implementation-detail symbols `@internal` (`BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter`, `createSimpleLogger`, `createWorkerLogger`, `LogEntry`); updated README and `@packageDocumentation` examples to use `createRequestLogger`
- **rate-limiter**: Dead code cleanup — Wave 12 (DEAD-073, DEAD-074): deleted orphaned `src/backends/index.ts` barrel file; removed duplicate `UpstashRateLimiterOptions` interface from `src/backends/upstash.ts` (now imports canonical definition from `types.ts`)

---

## [1.4.0] - 2026-02-27

### Fixed

- **ESLint v10 compatibility**: Fix 17 lint errors across 15 files for new `eslint:recommended` rules
  - `no-useless-assignment`: Remove dead variable initializers in `ColorConverter`, `harmony-wheel`, `url-sanitizer`, `dye-grid`, `tool-banner`, and test files
  - `preserve-caught-error`: Add `{ cause: error }` to re-thrown errors in `APIService`, `photon`, `validators`, `renderer`, `community-preset-service`, and test files
  - `prefer-const`: Convert `uniqueUsersToday` to const in analytics service
- **web-app**: Update TypeScript lib from ES2020 to ES2022 for `ErrorOptions` support
- **rate-limiter**: Fix `vi.fn()` mock typing in `upstash.test.ts` — type generics now match `RateLimiterLogger` signatures (type-check error)
- **logger**: Fix `globalThis`/`process` typing and `Logger` type mismatch in test presets (type-check errors)
- **web-app**: Fix 159 ESLint errors across 38 files — removed unused imports/variables, replaced `@ts-ignore` with `@ts-expect-error`, replaced `any` with proper types, added `void` for floating promises

### Changed

- **deps**: Upgrade `@eslint/js` from 9.39.3 to 10.0.2 (major version with new recommended rules)
- **deps**: Upgrade `eslint` from 10.0.1 to 10.0.2, `typescript-eslint` from 8.56.0 to 8.56.1
- **deps**: Upgrade Cloudflare tooling — `wrangler` 4.67.0 → 4.68.1, `miniflare` 4.20260219.0 → 4.20260302.0, `@cloudflare/vitest-pool-workers` 0.12.14 → 0.12.17
- **deps**: Upgrade `tailwindcss` from 4.2.0 to 4.2.1, `@tailwindcss/postcss` patch update
- **deps**: Upgrade `hono` and `@cloudflare/workers-types` to latest patch versions

### Added

- **web-app**: Prevent Duplicate Results toggle for Harmony Explorer — deduplicates dyes across harmony slots using a shared `Set<number>` tracker, with next-best unique match fallback. Configurable via `preventDuplicates` on `HarmonyConfig` (default: on). User-swapped dyes override dedup
- **web-app**: Prevent Duplicate Results toggle for Palette Extractor — deduplicates dyes across palette slots as a post-processing pass on `PaletteMatch[]`. Configurable via `preventDuplicates` on `ExtractorConfig` (default: on). Raw extraction results preserved for toggle re-render without re-extraction
- **web-app**: Updated `config.preventDuplicatesDesc` locale strings in all 6 languages to be tool-agnostic ("result slots")
- **discord-worker**: Prevent Duplicate Results for `/extractor image` — deduplicates dyes across palette slots as a post-processing pass on `PaletteMatch[]`. When a monochromatic image causes multiple extracted colors to match the same dye, later slots are reassigned to the next-best unique alternative via `findDyesWithinDistance()`. Always on (no toggle)
- **web-app**: Paste from Clipboard feature for Extractor tool — visible "Paste" button (Chromium), Ctrl+V keyboard paste, and hint text in drop zone. Paste handling moved from `ImageUploadDisplay` to `ExtractorTool` to avoid duplicate processing
- **web-app**: `ICON_CLIPBOARD` SVG icon in `ui-icons.ts`
- **web-app**: New locale keys (`pasteFromClipboard`, `pasteNoImage`, `pasteNotSupported`) in all 6 languages

---

## [1.3.0] — 2026-02-21

### Added

- **@xivdyetools/bot-logic**: Comprehensive test suite — 193 tests across 10 files covering input resolution, CSS colors, localization, and all 8 commands (dye-info, harmony, match, comparison, gradient, mixer, accessibility, random)
- **core**: `spectral-js.d.ts` type declarations for untyped spectral.js library
- **web-app**: New tests for CSRF fail-closed validation (missing `csrf` param and missing stored state)
- **crypto**: New `hex.test.ts` test suite — 15 tests covering valid conversion, rejection of invalid input, and roundtrips
- **bot-logic**: New `color-math.ts` shared utility module with `getColorDistance()` and `getMatchQualityInfo()`, plus 9-test suite (REFACTOR-001, REFACTOR-002)
- **svg**: New `truncateText()` and `estimateTextWidth()` shared utilities in `base.ts` with 11-test suite (REFACTOR-005, BUG-012)
- **test-utils**: New D1 mock tests for bind-at-execution-time (4 tests) and batch result passthrough (1 test) (BUG-006, BUG-007)

### Security

- **web-app**: Fix CSRF state validation fail-open — reject OAuth callback when `csrf` or stored state is missing, not only on mismatch (FINDING-001)
- **rate-limiter**: Fix Upstash race condition — use atomic `INCR` + `EXPIRE NX` pipeline instead of separate `EXPIRE` call that could leave immortal keys on Worker crash (FINDING-002)
- **auth**: Require `exp` claim in `verifyJWT` — reject tokens without expiration instead of treating them as never-expiring (FINDING-003)
- **crypto**: Validate hex input in `hexToBytes` — reject odd-length strings and non-hex characters instead of silently producing corrupt output (FINDING-004)
- **rate-limiter**: Default `trustXForwardedFor` to `false` in `getClientIp` — prevents IP spoofing in Cloudflare Workers where `CF-Connecting-IP` is the trusted source (FINDING-006)
- **logger**: Recurse into arrays during sensitive field redaction — previously array elements containing secrets were logged unredacted (FINDING-007)
- **logger**: Merge custom `redactFields` with defaults — previously custom fields replaced defaults, silently removing protection for `password`, `token`, etc. (FINDING-008)
- **auth**: Enforce 32-byte minimum key length in `createHmacKey` — reject weak secrets that undermine HMAC-SHA256 security (FINDING-009)
- **og-worker**: Add NaN validation for all `parseInt`'d `dyeId` route parameters — prevents unhandled 500 errors from crafted non-numeric URLs in harmony, gradient, and mixer routes (FINDING-011)
- **og-worker**: Apply `escapeHtml()` to `themeColor` meta tag — defense-in-depth against XSS if upstream hex validation is bypassed (FINDING-013)

### Fixed

- **test-utils**: Fix D1 mock `bind()` recording at bind-time instead of execution-time — bindings are now tracked when the statement is actually executed via `first()`/`all()`/`run()`/`raw()`, matching real D1 behavior (BUG-006)
- **test-utils**: Fix D1 mock `batch()` discarding statement results — now returns actual results from each statement instead of always returning empty arrays (BUG-007)
- **svg**: Fix CJK badge width miscalculation in dye-info-card — use `estimateTextWidth()` to account for full-width CJK characters in category badges (BUG-012)
- **svg**: Remove double XML escaping across 7 SVG generators — `escapeXml()` was called on values already escaped by tagged template literals, producing `&amp;amp;` in output (BUG-001)
- **rate-limiter**: Fix KV backend `checkOnly` off-by-one — `remaining` was 1 less than actual remaining capacity due to premature decrement (BUG-004)
- **rate-limiter**: Fix KV backend `check` post-increment accounting — `remaining` now reflects the consumed request after `increment()` (BUG-005)
- **moderation-worker**: Fix `safeParseJSON` prototype pollution check — use `Object.hasOwn()` instead of `in` operator, which false-positived on every object due to inherited `__proto__`/`constructor` (BUG-002)
- **moderation-worker**: Fix rate limit response returning HTTP 429 instead of 200 — Discord silently discards non-200 interaction responses (BUG-003)

### Changed

- **bot-logic**: Consolidate duplicated `getColorDistance()` across match, mixer, and gradient commands into shared `color-math.ts` — single source of truth delegating to `ColorService.getColorDistance()` from core (REFACTOR-001)
- **bot-logic**: Consolidate duplicated match quality thresholds across match, mixer, and gradient commands into shared `getMatchQualityInfo()` with consistent tiers and i18n key lookup (REFACTOR-002)
- **svg**: Replace local `getColorDistance()` in `comparison-grid.ts` with `ColorService.getColorDistance()` from core (REFACTOR-001)
- **auth**: Deduplicate JWT verification logic — extract shared `verifyJWTSignature()` helper used by both `verifyJWT()` and `verifyJWTSignatureOnly()`, eliminating ~30 lines of duplication (REFACTOR-003)
- **svg**: Standardize text truncation across all SVG generators — replace 3 inconsistent ellipsis styles (`..`, `...`, `…`) with shared `truncateText()` utility using Unicode ellipsis (REFACTOR-005)

### Performance

- **core**: Add LRU cache for `rgbToOklab()` conversions — OKLAB is the recommended matching method and was the only uncached color space conversion on the hot path (OPT-001)
- **auth**: Cache `CryptoKey` objects at module level — eliminates redundant `crypto.subtle.importKey()` calls when the same HMAC secret is reused across requests within a Worker isolate (OPT-002)

- **bot-logic**: Add `--passWithNoTests` to test script for CI compatibility (reverted once tests were added)
- **bot-logic** / **stoat-worker**: Resolve CI lint failures — add `^build` dependency to Turbo lint task, include test files in tsconfig, fix async/unused-var/misused-promises violations
- **discord-worker**: Fix 85+ lint errors (unused imports, unsafe type assertions, no-floating-promises, require-await, no-case-declarations) and fix `targetDye.hex` reference bug in budget handler
- **discord-worker**: Fix `stats.test.ts` mock to reject with raw string instead of Error object
- **moderation-worker** / **oauth** / **presets-api** / **universalis-proxy**: Resolve lint errors across all worker packages
- **oauth**: Fix type-check errors — add type assertions for `response.json()`, fix mock Env properties (`XIVAUTH_CLIENT_ID`, `DB`), fix `XIVAuthCharacter.server` → `home_world`, fix D1Meta cast
- **oauth**: Cast mock context through `unknown` to fix TS2352 type-check errors
- **oauth**: Handle `URLSearchParams` in mock fetch body assertions
- **core** / **rate-limiter**: Resolve type-check errors in tests — add missing Dye properties (`stainID`, `isMetallic`, `isPastel`, `isDark`, `isCosmic`), fix type-only imports, rename OklchWeights `L/C/H` → `kL/kC/kH`
- **auth**: Fix type-check errors with strict `unknown` return types
- **web-app**: Auto-format sources via `eslint --fix`; fix lint issues in components, services, and tests
- **14 packages**: Resolve all remaining ESLint warnings — add type assertions to `JSON.parse()` calls, add explicit return types, fix `no-base-to-string`, replace `as any` with proper types, type `Object.create(null)` calls
- **Turbo**: Add `dependsOn: ["^build"]` to lint task for correct dependency ordering
- **ESLint**: Relax rules for test-utils files in root config; add `tsconfig.build.json` split for packages needing separate build/dev configs

### Changed

- **8 packages**: Patch version bumps for lint-only changes — auth 1.0.3, bot-i18n 1.0.1, color-blending 1.0.1, core 1.17.1, logger 1.1.3, rate-limiter 1.3.1, svg 1.0.1, test-utils 1.1.2

### CI

- Add `color-blending`, `svg`, `bot-i18n`, `bot-logic` to publish workflow

### Docs

- Update monorepo README with new packages and stoat-worker
- Update all project READMEs with MIT license, social links, and server change (Midgardsormr, Aether)
- **2026-02-21 audit**: Deep-dive analysis and security audit — 12 hidden bugs (2 critical), 14 security findings (2 high), 6 refactoring opportunities, 3 optimization opportunities, with prioritized remediation plan

---

## [1.2.0] — 2026-02-20

### Added

- **stoat-worker 0.1.0**: Initial scaffold for Stoat (Revolt) bot — revolt.js WebSocket client, prefix command parser (`!xivdye` / `!xd`), command router, dye resolver, and 4 commands (ping, help, about, info)

### Docs

- **stoat-worker**: README with command reference, architecture overview, development guide, and project structure
- **stoat-worker**: CHANGELOG (initial 0.1.0 release)
- **@xivdyetools/bot-logic**: README with API surface, usage examples, and dependency overview
- **@xivdyetools/bot-logic**: CHANGELOG (initial 1.0.0 release)
- **@xivdyetools/bot-i18n**: README with Translator class usage, locale utilities, and translation key reference
- **@xivdyetools/bot-i18n**: CHANGELOG (initial 1.0.0 release)
- **@xivdyetools/svg**: README with all 14 generators, SVG primitives, color utilities, and design principles
- **@xivdyetools/svg**: CHANGELOG (initial 1.0.0 release)
- **@xivdyetools/color-blending**: README with 6 blending modes, comparison examples, and API reference
- **@xivdyetools/color-blending**: CHANGELOG (initial 1.0.0 release)

---

## [1.1.0] — 2026-02-19

### Security

- **og-worker 1.0.3**: Added parameter bounds validation to OG image generation routes (FINDING-003)
- **presets-api 1.4.13**: Enforce `BOT_SIGNING_SECRET` in production env validation (FINDING-001)
- **oauth 2.3.6**: Block `STATE_TRANSITION_PERIOD=true` in production (FINDING-007)
- **web-app 4.1.7**: Clear APIService cache on logout (FINDING-008)
- **web-app 4.1.7**: Millisecond timestamp guard for token expiry (BUG-001)

### Added

- **moderation-worker 1.1.5**: Startup environment variable validation with production fail-fast (REFACTOR-001)
- **web-app 4.1.7**: Cross-tab session sync via `StorageEvent` (BUG-002)
- **DEPRECATIONS.md**: Deprecation registry with removal timelines (REFACTOR-003)
- **core 1.17.0**: Cache hit/miss/eviction/error metrics in `APIService` (OPT-002)
- **universalis-proxy 1.4.1**: Structured cache hit/miss logging for observability (OPT-002)
- **types 1.8.0**: `DiscordSnowflake` branded type with `isValidSnowflake()` / `createSnowflake()` (FINDING-002)

### Changed

- **presets-api** / **discord-worker** / **moderation-worker**: Replaced inline snowflake regex with shared `isValidSnowflake()` from `@xivdyetools/types` (FINDING-002)

### Docs

- Audit findings FINDING-004 and BUG-003 verified as false positives (already correctly implemented)
- Audit findings FINDING-007, FINDING-008, FINDING-010, BUG-001, BUG-002 resolved with code changes

---

## [1.0.0] — 2026-02-18

### Summary

Initial release of the XIV Dye Tools monorepo, consolidating 15 previously independent repositories into a single pnpm workspace with Turborepo.

### Added

#### Monorepo Infrastructure
- pnpm 10 workspace with `workspace:*` protocol for all internal dependencies
- Turborepo 2.8 task orchestration with dependency-aware build, test, lint, and type-check pipelines
- Shared `tsconfig.base.json` (TypeScript 5.9, strict mode, ES2022, bundler module resolution)
- Root ESLint 9 flat config with typescript-eslint and relaxed rules for test files
- Root Prettier 3 configuration
- Shared `.gitignore` covering all project types

#### Libraries Migrated (7 packages)
- **`@xivdyetools/types`** v1.7.0 — Branded types and shared interfaces
- **`@xivdyetools/crypto`** v1.0.0 — Base64URL encoding utilities
- **`@xivdyetools/logger`** v1.1.2 — Multi-runtime logging with secret redaction
- **`@xivdyetools/auth`** v1.0.2 — JWT verification, HMAC signing, Discord Ed25519
- **`@xivdyetools/rate-limiter`** v1.3.0 — Sliding window rate limiting (Memory, KV, Upstash)
- **`@xivdyetools/core`** v1.16.0 — Color algorithms, 136-dye database, k-d tree, 6-language i18n
- **`@xivdyetools/test-utils`** v1.1.1 — Cloudflare Workers mocks and test factories

#### Applications Migrated (8 apps)
- **`xivdyetools-discord-worker`** v4.0.1 — Primary Discord bot (1,403 tests)
- **`xivdyetools-moderation-worker`** v1.1.4 — Moderation bot for presets (546 tests)
- **`xivdyetools-presets-api`** v1.4.12 — Community presets REST API (463 tests)
- **`xivdyetools-oauth-worker`** v2.3.5 — Discord OAuth + JWT issuance (228 tests)
- **`xivdyetools-universalis-proxy`** v1.3.5 — Universalis market data proxy (90 tests)
- **`xivdyetools-og-worker`** v1.0.2 — OpenGraph image generation (288 tests)
- **`xivdyetools-web-app`** v4.1.5 — Main web app (2,574 tests)
- **`xivdyetools-maintainer`** v1.0.1 — Local dev tool for dye database

#### Documentation
- Migrated 523 documentation files from the standalone docs repository
- Architecture overviews, API contracts, deployment guides, and research notes
- `CLAUDE.md` with comprehensive AI coding guidance for the monorepo

#### CI/CD (GitHub Actions)
- **CI workflow** — Lint, type-check, test, and build on every push/PR to `main` (affected packages only via Turbo filtering)
- **7 deploy workflows** — Path-filtered auto-deploy to Cloudflare Workers/Pages on push to `main`
- **Publish workflow** — Manual `workflow_dispatch` to publish any `@xivdyetools/*` package to npm with provenance

### Changed

- All `@xivdyetools/*` dependencies now use `workspace:*` protocol instead of pinned npm versions
- TypeScript, ESLint, and Prettier hoisted to root — no longer duplicated across 15 repos
- Common devDependencies shared across all packages (reduces total `node_modules` size significantly)
- `@xivdyetools/test-utils` mock factories updated to include `stainID` field (aligning with `@xivdyetools/types` v1.7.0)

### Security

- Revoked and regenerated exposed npm authentication token
- All authentication tokens stored exclusively in GitHub Secrets
- No `.npmrc` or `.env` files containing secrets in the repository

### Migration Notes

- All 15 original repositories were tagged with `archive/pre-monorepo` before migration
- No git history was merged — the monorepo starts with a clean history
- All original test suites pass with identical results (pre-existing failures in oauth, presets-api, and moderation-worker are unchanged)
- Total test count: ~7,800 tests across 15 packages

---

[Unreleased]: https://github.com/FlashGalatine/xivdyetools/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/v1.0.0
