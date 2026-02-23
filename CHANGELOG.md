# Changelog

All notable changes to the XIV Dye Tools monorepo will be documented in this file.

This changelog covers the **monorepo itself** (workspace structure, CI/CD, shared configuration). For individual package changelogs, see the `CHANGELOG.md` in each package's directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

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

[Unreleased]: https://github.com/FlashGalatine/xivdyetools/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/v1.0.0
