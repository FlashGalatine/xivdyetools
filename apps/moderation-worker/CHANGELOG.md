# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2026-01-26

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

---

## [1.1.3] - 2026-01-26

### Changed

- **REFACTOR-003**: Migrated authentication utilities to `@xivdyetools/auth` shared package
  - Discord signature verification now uses `verifyDiscordRequest()` from shared package
  - Timing-safe comparison now uses `timingSafeEqual()` from shared package
  - Reduces code duplication across Discord workers

---

## [1.1.2] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated KV-based rate limiting to `@xivdyetools/rate-limiter` shared package
  - Uses `KVRateLimiter` with separate `checkOnly()` and `increment()` methods
  - Preserves MOD-BUG-001 fix (optimistic concurrency with retries) via shared implementation
  - Maintains command/autocomplete burst allowance configurations

---

## [1.1.1] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`

---

## [1.1.0] - 2026-01-19

### Fixed

- **MOD-BUG-001**: Fixed race condition in rate limiting. Applied optimistic concurrency with retries and version metadata (same pattern as DISCORD-BUG-001)

### Refactored

- **MOD-REF-001**: Refactored `processModerateCommand` (162 lines) into focused handler functions
  - Created `ModerationContext` interface to reduce 8 parameters to 1 context object
  - Extracted `handlePendingAction()`, `handleApproveAction()`, `handleRejectAction()`, `handleStatsAction()`
  - Added `validatePresetIdOrSendError()` shared validation eliminating ~20 lines of duplication
  - Main function reduced from 162 to ~45 lines (thin dispatcher pattern)

- **MOD-REF-002**: Extracted shared modal types to `src/types/modal.ts`
  - `ModalInteraction` interface, `ModalComponents` type
  - `extractTextInputValue()`, `getModalUserId()`, `getModalUsername()` helpers
  - Removed duplicate code from `preset-rejection.ts` and `ban-reason.ts`

---

## [1.0.0] - 2025-12-14

### Added

- Initial release of XIV Dye Tools Moderation Worker
- **Preset Moderation** - Review pending presets, approve or reject with reasons
- **User Management** - Ban/unban users from the Preset Palettes system
- **Edit Reversion** - Revert flagged edits to previous versions
- **Multi-Language Support** - Full localization for EN, JA, DE, FR, KO, ZH
- **Audit Logging** - All moderation actions logged for accountability
- **Ed25519 Verification** - Secure Discord interaction verification
- **Slash Commands**:
  - `/preset moderate [preset_id]` - View and moderate pending presets
  - `/preset ban_user <user>` - Ban a user from submitting/editing presets
  - `/preset unban_user <user>` - Remove a ban from a user
- **Cloudflare Workers Deployment** - Serverless edge execution
- **D1 Database Integration** - Shared presets, bans, and audit log storage
- **KV Namespace Integration** - User preferences and rate limiting
- **Hono Framework** - Lightweight web framework for routing
- **@xivdyetools/logger Integration** - Structured request logging
- **@xivdyetools/types Integration** - Shared type definitions
