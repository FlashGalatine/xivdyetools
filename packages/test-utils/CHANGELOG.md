# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
