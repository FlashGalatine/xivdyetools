# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
