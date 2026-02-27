# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-02-27

### Fixed

- Fix `globalThis` index signature errors in `browser.test.ts` — cast to `Record<string, unknown>` for dynamic property access
- Fix missing `process` type in `browser.test.ts` — added ambient declaration for vitest's Node environment
- Fix `Logger` type mismatch in `library.test.ts` — use `Logger` type for mock service fields

## [1.2.0] - 2026-02-21

### Security

- **FINDING-007**: Recurse into arrays during sensitive field redaction — previously array elements containing secrets were logged unredacted
- **FINDING-008**: Merge custom `redactFields` with defaults instead of replacing — previously custom fields replaced defaults, silently removing protection for `password`, `token`, etc.

### Changed

- Lint fixes and code quality improvements

## [1.1.3] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.1.2] - 2026-02-06

### Security

- **FINDING-008**: `redactSensitiveFields()` now recursively walks nested objects (up to 3
  levels deep) to redact sensitive fields like `token`, `password`, etc. at any nesting level,
  not just top-level context properties.

### Added

- 5 new tests for recursive redaction (nested objects, depth limit, arrays, null values)

---

## [1.1.1] - 2026-02-06

### Security

- **FINDING-005**: Added 6 new secret redaction patterns to `sanitizeErrorMessage()`:
  `client_secret`, `private_key`, `signing_key`/`signing_secret`, `webhook_secret`, `auth_token`, `credentials`
- Refactored value-matching regex into shared pattern variable for consistency across all redaction rules

---

## [1.1.0] - 2026-01-19

### Fixed

- **LOGGER-BUG-001**: Fixed race condition in `perf.start()` that silently overwrote existing timers with same label. Now warns and returns `false` if timer already active, preventing data loss when concurrent operations use the same label

### Refactored

- **LOGGER-REF-003**: Consolidated hardcoded redact fields to centralized `constants.ts`. Core fields (9) and worker-specific fields (4) now defined in single source of truth with `CORE_REDACT_FIELDS`, `WORKER_SPECIFIC_REDACT_FIELDS`, and `WORKER_REDACT_FIELDS` constants

---

## [1.0.2] - 2025-12-24

### Fixed

- Fixed authorization pattern incorrectly matching "Authorization: Bearer ..." headers
  - Added negative lookahead `(?!Bearer\s)` to skip Bearer token headers
  - Bearer tokens are now correctly handled by the dedicated Bearer pattern

---

## [1.0.1] - 2025-12-24

### Fixed

#### Medium Priority Audit Fixes

- **LOG-ERR-001**: Fixed incomplete secret redaction patterns in `sanitizeErrorMessage`
  - Original patterns stopped at whitespace, potentially leaking partial secrets
  - Now properly handles both quoted (`token="value"`) and unquoted (`token=value`) formats
  - Added missing patterns for `authorization`, `access_token`, and `refresh_token` fields

---

## [1.0.0] - 2025-12-14

### Added

- Initial release of unified logging for xivdyetools ecosystem
- Support for browser, Node.js, and Cloudflare Workers environments
- Preset configurations: `browser`, `worker`, `library`
- Log levels: debug, info, warn, error
- Structured logging with context support
- Sensitive data sanitization
- `NoOpLogger` for silent operation
- `ConsoleLogger` for development
- Full TypeScript support
