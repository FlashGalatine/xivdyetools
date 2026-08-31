# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-08-31

Security audit remediation (docs/audits/2026-08-29-security, FINDING-015, Sprint 11 fix round). Not published — this package is workspace-private (see 1.2.0 below); no external consumers to break.

### Removed

- **`auth/signature.ts`** (`createBotSignature`, `createTimestampedSignature`, `verifyBotSignature`, `TEST_SIGNING_SECRET` — 103 lines) and its dedicated unit test `tests/auth/signature.test.ts` (17 tests). The 2026-08-18 dead-code audit (DEAD-026) called this module "shim-only" but kept it because `integration/setup.ts` and `integration/discord-presets/bot-authentication.test.ts` still imported `createBotSignature`/`createTimestampedSignature` — see the 1.2.0 entry below. That justification no longer holds: `@xivdyetools/auth` 2.0.0 (same finding) removed its own v1 `verifyBotSignature`, which had been the only signature presets-api still accepted a fallback for; once presets-api accepted only `X-Request-Signature-V2`, the v1-signature test blocks in `bot-authentication.test.ts` were asserting against a hand-rolled local simulation of a contract that no longer existed anywhere, and were deleted along with the `createSignedBotHeaders`/`createInvalidSignatureHeaders` header builders and the `verifyBotRequestSignature`/`SIGNATURE_MAX_AGE_SECONDS` local verifier in `setup.ts` and the test file itself that only those blocks used. `setup.ts`'s exported `BOT_SIGNING_SECRET` constant survives as an inline literal (was derived from the deleted `TEST_SIGNING_SECRET`) — `createMockPresetsEnv()`'s mock environment still needs a value for that field.
- **`bot-authentication.test.ts` narrowed from 15 tests to 5.** Kept: the unsigned dev/test bot-auth bypass (API-secret path, user-context pass-through, moderator recognition) and wrong-API-secret / missing-Authorization rejection — all still real, still mirror live `presets-api/src/middleware/auth.ts` behaviour. Lost: all coverage of the signed (production) bot-request path, since this file's `processBotAuth` simulation never modeled the v2 contract and had nothing live left to assert once v1 was gone. Restoring that coverage — porting the harness to sign with `@xivdyetools/auth`'s `createBotSignatureV2` — is a follow-up, not done in this pass; the file's own module comment documents the gap.

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

### Removed (2026-08-18 dead-code audit)

Wave 2b, Task 5 (DEAD-026 whole-module prune + DEAD-027 unused-extras trim). Named-import evidence covered `apps/*` and `packages/*`, so two DEAD-026 candidates turned out to have live consumers inside this package's own `integration/` suite and were kept instead of deleted — see the two "KEPT, deviates from DEAD-026" notes below.

- **`/dom` subpath** (`src/dom/{canvas,fetch,localStorage,matchMedia,resizeObserver,index}.ts`, ~760 src + ~1,000 test lines): zero consumers — web-app (the only browser test suite) has its own `matchMedia` stub and doesn't depend on this package. Removed the `./dom` entry from `package.json#exports`, the `@testing-library/dom` devDependency, and the README/CLAUDE.md sections describing it.
- **`/assertions` subpath** (`src/assertions/{response,index}.ts`, ~184 + ~250 lines): `assertJsonResponse` reached only the presets-api test shim's chain-dead re-export (below); the other six asserts had zero references anywhere. Removed the `./assertions` entry from `package.json#exports` and the README/CLAUDE.md sections.
- **`factories/user.ts`** (`createMockUser`, `createMockUsers`, `createDiscordUser`, `createXIVAuthUser`, `userToRow`, `createMockUserRow`, `UserRow` — 157 lines) and **`factories/vote.ts`** (`createMockVoteRow`/`createMockVote`, `createMockVotes`, `createVotesForPreset`, `createVotesFromUser` — 97 lines): zero external importers (`apps/oauth`'s own `UserRow`/`createMockUser` test helpers are unrelated locals, not this package's).
- **`constants/secrets.ts`** (13 `TEST_*` constants, 86 lines): zero references; `TEST_SIGNING_SECRET` (a different symbol, defined in `auth/signature.ts`) is unaffected.
- **`auth/context.ts`** (`createAuthContext`, `createModeratorContext`, `createBotAuthContext`, `createWebAuthContext`, `createUnauthenticatedContext`, `AuthSource` re-export — 104 lines): zero references anywhere, including this package's own `integration/` tests.
- **`utils/crypto.ts`** (6-function pass-through of `@xivdyetools/auth/encoding`, 15 lines): the two remaining internal callers (`auth/jwt.ts`, `auth/signature.ts`) now import `base64UrlEncode`/`base64UrlEncodeBytes`/`bytesToHex` directly from `@xivdyetools/auth/encoding`; `base64UrlDecodeBytes`/`base64UrlDecode`/`hexToBytes` were unused even internally.
- **`factories/index.ts`**'s duplicate `randomId`/`randomStringId` re-export (5 lines): the same two functions are already reachable via `utils/index.ts` → the root barrel; nothing imported the `/factories`-subpath copy.
- **Unused extras in otherwise-live files** (DEAD-027, ~500 lines): `factories/dye.ts` (`createMockDyes`, `createMetallicDye`, `createPastelDye`, `createDarkDye`, `getMockDyeById`, `getMockDyesByIds` — `mockDyes` and `createMockDye` stay); `factories/preset.ts` (`createMockPreset`, `createMockPresets`, `createPresetWithStatus`, `createCuratedPreset`, `presetToRow`, `rowToPreset` — `createMockPresetRow`/`createMockSubmission` stay); `factories/category.ts` (`createMockCategory`, `createMockCategories`, `createCuratedCategory`, `categoryToRow`, `DEFAULT_CATEGORIES`, and the now-fully-unreferenced `Category` interface that only backed those four — `CategoryRow`/`createMockCategoryRow` stay); `constants/pkce.ts` (`INVALID_*`, `MIN/MAX_VERIFIER_LENGTH`, `S256_CHALLENGE_LENGTH`, `VERIFIER_PATTERN`, `generateCodeChallenge`, `isValid*Format` — `VALID_CODE_VERIFIER`/`VALID_CODE_CHALLENGE` stay); `auth/headers.ts` (`jsonHeaders`, `authenticatedJsonHeaders`, `mergeHeaders`, `authHeadersWithSignature` — `authHeaders` stays); `auth/jwt.ts` (`createJWTWithExpiration` deleted outright; `TestJWTPayload`/`FullJWTPayload` un-exported rather than deleted — `createTestJWT`/`createExpiredJWT` still need them as internal parameter/local types, but no external caller imports either type by name).
- **`apps/presets-api/tests/test-utils.ts`** trimmed its 9 chain-dead re-exports (`createBotSignature`, `authHeadersWithSignature`, `createAuthContext`, `createModeratorContext`, `createUnauthenticatedContext`, `createMockPreset`, `createMockVoteRow`, `assertJsonResponse`, `TEST_SIGNING_SECRET`) — none were imported by any presets-api test.
- **KEPT, deviates from DEAD-026 — `auth/signature.ts`** (`createBotSignature`, `createTimestampedSignature`, `verifyBotSignature`, `TEST_SIGNING_SECRET`): the DEAD-026 finding called this "shim-only," but `integration/setup.ts` and `integration/discord-presets/bot-authentication.test.ts` (a 15-test suite) import `createBotSignature`/`createTimestampedSignature`/`TEST_SIGNING_SECRET` directly from this module — the audit's evidence scan evidently didn't cover this package's own `integration/` directory. Kept the whole file, including `verifyBotSignature` (untested by any external caller but the natural verify-side counterpart of `createBotSignature`, exercised by its own unit test).
- **KEPT, deviates from DEAD-026 — `cloudflare/analytics.ts`** (`createMockAnalyticsEngine`): had zero consumers at audit time, but this same task's DEAD-005 consolidation (see `apps/discord-worker` CHANGELOG) wires it into `discord-worker/src/test-utils.ts`'s `createMockEnv`. Deleting a module in the same task that gives it a consumer would be self-defeating, so it stays.

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
