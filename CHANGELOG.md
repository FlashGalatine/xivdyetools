# Changelog

All notable changes to the XIV Dye Tools monorepo will be documented in this file.

This changelog covers the **monorepo itself** (workspace structure, CI/CD, shared configuration). For individual package changelogs, see the `CHANGELOG.md` in each package's directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

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

[Unreleased]: https://github.com/FlashGalatine/xivdyetools/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/v1.0.0
