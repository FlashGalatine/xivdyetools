# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BUG-001** (2026-04-28 audit): Replaced bare `console.error` in the global error handler with the structured logger from `@xivdyetools/worker-middleware`; added `loggerMiddleware` to the global middleware chain so all unhandled errors carry request ID, service name, and JSON structure.
- **ARCH-001** (2026-04-28 audit): Reduced CORS `maxAge` from `86400` (24 h) to `3600` (1 h) to match the `presets-api` / `oauth` precedent and tighten the cache window for an evolving public API.

---

## [0.3.0] - 2026-04-07

### Added

- **OPT-001**: Pending-promise deduplication on `GET /api/v1/categories` — concurrent CDN cache misses now share a single in-flight D1 query instead of each spawning a separate one (thundering herd prevention)
- Extended test coverage: `calculateDistance` branches, sort variants, locale handling, security headers, error handler paths
- New `tests/lib/services.test.ts` for distance calculation branches
- New `tests/utils/api-response.test.ts` for all response helper functions

### Changed

- Migrated rate-limit, request-ID, and logger middleware to `@xivdyetools/worker-middleware`; deleted local middleware files
- **ARCH-001**: Removed `nodejs_compat` compatibility flag from `wrangler.toml`
- **BUG-001**: Re-enabled strict TypeScript checks; cleaned up unused variables and implicit returns
- **REFACTOR-010**: Extracted category cache TTL values to named constants (`CATEGORY_CDN_TTL`, `CATEGORY_BROWSER_TTL`, `CATEGORY_SWR_TTL`) in `categories.ts`

---

## [0.2.0] - 2026-04-03

### Added

- `DyeQueryFilters` interface and `parseDyeFilters()` for parsing dye filter query parameters
- Dye type filtering on `GET /v1/dyes` endpoint via boolean query parameters
- Filter exclusion support on `/closest` and `/within-distance` match endpoints
- `applyDyeFilters()`, `buildFilterExcludeIds()`, `hasActiveDyeFilters()`, `dyeMatchesFilters()` utility functions
- 11 unit tests for filter functionality

---

## [0.1.0] - 2026-04-01

### Added

- Initial release — public REST API for XIV Dye Tools dye database and color matching
