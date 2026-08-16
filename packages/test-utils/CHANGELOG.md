# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-16

Monorepo 2.0 / web-app 5.0 branch. **This version is not published** — see "Changed" below; 1.1.8 remains the last release on npm.

### Changed

- **Workspace-private, no longer published to npm** (`"private": true`, removed from the Publish Packages workflow — Monorepo 2.0 Tier 1). The package is consumed only via `workspace:*` devDependencies and has no external audience; versions up to 1.1.8 stay on npm as history. Version bumps from here on are internal bookkeeping.
- Internal dependency `@xivdyetools/crypto` → `@xivdyetools/auth`: `src/utils/crypto.ts` now re-exports the Base64URL/hex helpers from `@xivdyetools/auth/encoding` (the retired crypto package was absorbed there). Same exported names, no consumer change.
- **`DEFAULT_CATEGORIES` dropped the `community` row** (DEAD-006) — the fixture now mirrors the five live `PresetCategory` members (`aesthetics`, `events`, `grand-companies`, `jobs`, `seasons`) exactly and is entirely curated. Tests that need an uncurated category should build one with `createMockCategory({ is_curated: false })` instead of indexing the fixture; `createMockCategories()` never indexed it and is unaffected.
- **Preset factories follow the 5.0 `CommunityPreset` / presets-api schema** (migrations 0008–0010):
  - `PresetRow` gains `example_link`, `preview_image_key`, `preview_image_status`, `secondary_categories` (JSON string) and optional `rejection_reason`; `createMockPresetRow()` defaults them to `null` / `null` / `'none'` / `'[]'`.
  - `createMockPreset()` now sets the required `secondary_categories: []` and `preview_image_status: 'none'`.
  - `presetToRow()` serializes `secondary_categories`, carries `example_link` and `preview_image_status` (default `'none'`), and always writes `preview_image_key: null`; `rowToPreset()` parses `secondary_categories` and maps `preview_image_status` back (default `'none'`). Note `rowToPreset()` does not surface `example_link` / `rejection_reason` / `preview_image_url` — presets-api's own `rowToPreset` owns that gating; the mock stays minimal.
- `createMockR2Bucket().put()` accepts `httpMetadata` (`cacheControl` / `contentType`) and stores it on the `_store` entry so preview-image upload tests can assert on it. Existing calls without `httpMetadata` are unchanged.
- Coverage thresholds raised to 90% lines / functions / branches / statements (were 80/80/75/80).
- Docs: `CLAUDE.md` / README updated for the private status and the `@xivdyetools/auth` dependency; license/legal notice added, stale blog link removed.

## [1.1.8] - 2026-07-19

2026-07-18 audit remediation (Sprints 1 & 6).

### Fixed

- **BUG-062**: MockD1's `exec()` (db and session objects) pushes an empty bindings entry, keeping `_queries`/`_bindings` index-aligned for positional assertions and history eviction.
- MockD1 `batch()` routes through `run()` semantics (honors RETURNING rows and mutation meta), matching real D1 behavior (Sprint 1).

## [1.1.6] - 2026-03-14

### Changed

- Updated all mock dye factories and fixtures with `consolidationType` and `isIshgardian` fields

---

## [1.1.5] - 2026-03-09

### Changed

- Updated `@cloudflare/workers-types` from 4.20260305.0 to 4.20260307.1

## [1.1.4] - 2026-03-01

### Removed

- **DEAD-083**: Remove deprecated `nextId()` function — factories now use `randomId()` for parallel-safe test ID generation
  - `dye.ts`: `createMockDye()` now uses `randomId()` instead of `nextId('dye')`
  - `category.ts`: `createMockCategoryRow()`/`createMockCategory()` now use `randomStringId()`/`randomId()` instead of `nextStringId()`/`nextId()`
- **DEAD-084**: Remove legacy counter infrastructure from `counters.ts` — `counters` Map, `resetCounters()`, `resetCounter()`, `getCounterValue()`
  - Removed from barrel re-exports in `factories/index.ts`
  - Consumers no longer need `resetCounters()` in `beforeEach()` — IDs are fully random

### Changed

- Updated all factory test files to remove `resetCounters()` `beforeEach` calls (no longer needed with random IDs)
- Updated `dye.test.ts` and `category.test.ts` assertions from sequential ID expectations to random ID expectations

---

## [1.1.3] - 2026-02-21

### Fixed

- **BUG-006**: Fix D1 mock `bind()` recording at bind-time instead of execution-time — bindings are now tracked when the statement is actually executed via `first()`/`all()`/`run()`/`raw()`, matching real D1 behavior
- **BUG-007**: Fix D1 mock `batch()` discarding statement results — now returns actual results from each statement instead of always returning empty arrays

### Added

- New D1 mock tests for bind-at-execution-time (4 tests) and batch result passthrough (1 test)

## [1.1.2] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.1.1] - 2026-01-25

### Changed

- **REFACTOR-001**: Migrated to `@xivdyetools/crypto` for cryptographic utilities
  - Crypto utilities now re-exported from shared package
  - Reduces ~80 lines of duplicated code
  - All existing exports maintained for backwards compatibility:
    - `base64UrlEncode`, `base64UrlEncodeBytes`
    - `base64UrlDecode`, `base64UrlDecodeBytes`
    - `hexToBytes`, `bytesToHex`

---

## [1.1.0] - 2026-01-19

### Fixed

- **TEST-BUG-001**: Fixed race condition in KV mock TTL expiration using snapshot-based timestamp capture (`Date.now() / 1000` at start of operation) to prevent TOCTOU races with mocked time. Added proper expired key cleanup in `list()`
- **TEST-BUG-002**: Fixed memory leak in Fetcher mock call history. Added `maxCallHistory` config with FIFO eviction to prevent unbounded memory growth in long-running test suites
- **TEST-BUG-005**: Fixed Base64URL decode failing on UTF-8 multi-byte characters. Added `base64UrlDecodeBytes()` helper with `TextDecoder`
- **TEST-OPT-003**: Added `maxQueryHistory` config with FIFO eviction to D1 mock, preventing unbounded memory growth (matches pattern from TEST-BUG-002)

---

## [1.0.3] - 2025-12-24

### Changed

- Updated `@xivdyetools/types` to ^1.1.1 for new Dye fields and branded type improvements

---

## [1.0.2] - 2025-12-14

### Added

- DOM testing utilities module (`@xivdyetools/test-utils/dom`)
- Common test constants module (`@xivdyetools/test-utils/constants`)

### Changed

- Improved mock dye factory with more realistic default values

---

## [1.0.1] - 2025-12-14

### Fixed

- Fixed TypeScript exports for subpath imports

---

## [1.0.0] - 2025-12-14

### Added

- Initial release of shared test utilities
- Cloudflare Worker testing utilities (`@xivdyetools/test-utils/cloudflare`)
- Auth mock utilities (`@xivdyetools/test-utils/auth`)
- Factory functions for mock data (`@xivdyetools/test-utils/factories`)
- Assertion helpers (`@xivdyetools/test-utils/assertions`)
