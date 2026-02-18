# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.12] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

---

## [1.4.11] - 2026-01-26

### Changed

- **REFACTOR-003**: Migrated authentication utilities to `@xivdyetools/auth` shared package
  - JWT verification now uses `verifyJWT()` from shared package
  - Bot signature verification now uses `verifyBotSignature()` from shared package
  - Reduces ~80 lines of duplicated cryptographic code

---

## [1.4.10] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated IP-based rate limiting to `@xivdyetools/rate-limiter` shared package
  - Uses `MemoryRateLimiter` for public endpoint protection
  - Uses `PUBLIC_API_LIMITS` preset from shared package
  - Preserves PRESETS-BUG-001 fix (LRU eviction at 10k entries) via shared implementation
  - D1-based submission limiting remains unchanged

---

## [1.4.9] - 2026-01-25

### Changed

- **REFACTOR-001**: Migrated to `@xivdyetools/crypto` for Base64URL utilities
  - JWT verification now uses shared `base64UrlDecode` and `base64UrlDecodeBytes`
  - Reduces ~15 lines of duplicated code in auth middleware
  - Ensures consistency with oauth worker implementation

---

## [1.4.8] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`
- **FINDING-006**: Updated `devalue` transitive dependency to fix DoS vulnerability (CVSS 7.5)

---

## [1.4.7] - 2026-01-19

### Fixed

- **PRESETS-BUG-001**: Fixed memory leak in IP rate limiter. Added `maxTrackedIps` limit (10,000) with LRU-style eviction to prevent unbounded memory growth under DDoS attacks

### Changed

#### Refactoring (Deep-Dive Audit)

- **PRESETS-REF-001**: Created centralized validation service
  - New `src/services/validation-service.ts` with shared validators
  - `PRESET_VALIDATION_RULES` and `MODERATION_VALIDATION_RULES` constants for consistent limits
  - Generic helpers: `validateStringLength()`, `validateArray()`, `validateEnum()`
  - Preset validators: `validatePresetName()`, `validatePresetDescription()`, `validatePresetDyes()`, `validatePresetTags()`
  - Moderation validators: `validateModerationStatus()`, `validateModerationReason()`
  - `ModerationStatus` type excludes 'hidden' from allowed moderation transitions
  - Removed ~44 lines of duplicated validation logic from handlers

---

## [1.4.6] - 2026-01-05

### Security

#### Low Priority Audit Fixes (2026-01-05 Security Audit)

- **L1**: Added X-Request-ID format validation
  - Request IDs are now validated against UUID v4 pattern
  - Prevents log injection attacks via malformed request IDs
  - Invalid request IDs are replaced with newly generated UUIDs

---

## [1.4.5] - 2025-12-24

### Changed

- Updated `@xivdyetools/types` to ^1.1.1 for ecosystem consistency
- Updated `@xivdyetools/logger` to ^1.0.2 for ecosystem consistency

### Fixed

- Fixed TypeScript type assertion in test file for Env type casting

---

## [1.4.4] - 2025-12-24

### Added

- **PRESETS-MED-002**: Standardized API response utilities
  - Created `src/utils/api-response.ts` with consistent error response format
  - `ErrorCode` constants using `SCREAMING_SNAKE_CASE` for machine-readability
  - Helper functions: `notFoundResponse()`, `forbiddenResponse()`, `validationErrorResponse()`, `invalidJsonResponse()`, `internalErrorResponse()`
  - All error responses now follow format: `{ success: false, error: "CODE", message: "..." }`

### Fixed

- **PRESETS-MED-001**: Added cascade delete integration tests
  - 3 new tests verifying vote deletion when preset is deleted
  - Tests verify correct SQL execution order (votes before presets)
  - Tests verify correct preset ID binding to both DELETE queries

---

## [1.4.3] - 2025-12-24

### Fixed

- **PRESETS-HIGH-003**: UTF-8 safe truncation for Discord embeds
  - Added `truncateUnicodeSafe()` function that preserves Unicode code points
  - Prevents mid-codepoint truncation that causes garbled text for emoji/CJK characters
  - Applied to preset description in moderation Discord alerts (200 char limit)

---

## [1.4.2] - 2025-12-24

### Fixed

- **Test Suite**: Fixed category validation test failures
  - Added `resetCategoryCache()` export for proper test isolation
  - Updated test mocks to return valid categories before testing other validations
  - Fixed "missing category" test to expect correct error message ("Category is required")
  - Ensures tests properly reset module-level state between runs

---

## [1.4.1] - 2025-12-24

### Fixed

#### Security Audit - High Priority Issues Resolved

- **PRESETS-HIGH-001**: Added timeout to Perspective API moderation calls
  - 5 second timeout on content moderation requests
  - If Perspective API is slow or unavailable, submission proceeds (local filter still applies)
  - Prevents submission hang if external API is unresponsive

---

## [1.4.0] - 2025-12-24

### Fixed

#### Security Audit - Critical Issues Resolved

- **PRESETS-CRITICAL-001**: Fixed race condition in duplicate preset detection
  - Wrapped createPreset in try-catch to handle UNIQUE constraint violations
  - On race condition, finds and votes on existing preset instead of failing
  - Graceful handling when two users submit identical dye combinations simultaneously
- **PRESETS-CRITICAL-002**: Dynamic category validation from database
  - Categories now queried from database with 1-minute cache
  - Replaces hardcoded VALID_CATEGORIES array
  - New categories can be added without code deployment
- **PRESETS-CRITICAL-003**: Added retry mechanism for Discord notifications
  - Exponential backoff with jitter (1s, 2s, 4s delays)
  - Up to 3 retries on transient failures (5xx errors, network issues)
  - No retry on client errors (4xx) to avoid wasting attempts
- **PRESETS-CRITICAL-004**: Preserved audit trail on moderation pass
  - No longer clears previous_values when moderation passes
  - Maintains history of previously-flagged content for compliance
  - Helps detect patterns in user behavior over time

---

## [1.3.0] - 2025-12-15

### Added

#### User Ban Enforcement
- **Ban Check Middleware**: `requireNotBannedCheck()` blocks banned users from:
  - Submitting new presets (`POST /api/v1/presets`)
  - Editing presets (`PATCH /api/v1/presets/:id`)
  - Voting on presets (`POST /api/v1/votes/:presetId`)
- Returns 403 with `USER_BANNED` error code for banned users

#### Hidden Preset Status
- Added `hidden` status for presets by banned users
- Hidden presets filtered from all public listings and searches
- Presets restored to `approved` when user is unbanned

### Changed

- Updated preset service to exclude `status = 'hidden'` from queries
- Added safeguard against querying hidden status directly

#### New Files
- `src/middleware/ban-check.ts` - Ban enforcement middleware

---

## [1.2.0] - 2025-12-14

### Added

- **Structured Logging**: Added structured request logger middleware using `@xivdyetools/logger/worker`
- **Shared Package Integration**: Migrated to `@xivdyetools/types` and `@xivdyetools/logger` for ecosystem consistency
- **Test Utils Integration**: Migrated tests to use `@xivdyetools/test-utils` shared package

### Fixed

- **Security**: Tightened HMAC signature timestamp window
- **Security**: Added Content-Type validation and fixed profanity filter ReDoS vulnerability
- **Security**: Added cross-cutting security improvements
- **Security**: Required BOT_SIGNING_SECRET for bot authentication (PRESETS-SEC-001)
- **High Severity**: Addressed HIGH severity preset audit findings
- **Medium Severity**: Addressed MEDIUM severity audit findings
- **Auth**: Improved moderator ID parsing for flexible formats
- **Error Logging**: Improved error logging and added batch documentation
- **Tests**: Resolved 172 pre-existing type errors in test files

### Deprecated

#### Type Re-exports
The following re-exports from `src/types.ts` are deprecated and will be removed in the next major version:

- **Preset Types**: Import from `@xivdyetools/types` instead
- **Auth Types** (AuthSource, AuthContext): Import from `@xivdyetools/types` instead
- **API Types** (ModerationResult, ModerationLogEntry, etc.): Import from `@xivdyetools/types` instead

**Note:** Project-specific types (Env, PresetRow, CategoryRow, VoteRow) remain unchanged.

**Migration Guide:**
```typescript
// Before (deprecated)
import { PresetStatus, CommunityPreset, AuthContext } from './types';

// After (recommended)
import type { PresetStatus, CommunityPreset, AuthContext } from '@xivdyetools/types';
```

---

## [1.1.0] - 2025-12-07

### Added

#### Preset Editing
- `PATCH /api/v1/presets/:id` - Edit existing preset (owner only)
  - Update name, description, dyes, tags
  - Duplicate dye combination detection (409 response with existing preset)
  - Content moderation on edited text
  - Stores previous_values for potential revert

#### Moderation Revert
- `PATCH /api/v1/moderation/:id/revert` - Revert flagged edit
  - Restores preset from previous_values
  - Logs reason in moderation_log
  - Clears previous_values after revert

### Changed

#### Database Schema
- Added `previous_values` column to presets table (stores pre-edit JSON)

#### Service Functions
- `updatePreset()` - Edit preset with validation and moderation
- `findDuplicatePresetExcluding()` - Check dye signature excluding specific preset
- `revertPreset()` - Restore from previous_values

### Files Modified
- `schema.sql` - Added previous_values column
- `src/types.ts` - PresetEditRequest, EditResponse, PreviousValues types
- `src/services/preset-service.ts` - Edit/revert functions
- `src/handlers/presets.ts` - PATCH endpoint
- `src/handlers/moderation.ts` - Revert endpoint

---

## [1.0.0] - 2025-12-07

### Added

#### API Endpoints

**Public:**
- `GET /api/v1/presets` - List presets with filtering and pagination
- `GET /api/v1/presets/featured` - Top 10 presets by vote count
- `GET /api/v1/presets/:id` - Get single preset details
- `GET /api/v1/categories` - List categories with preset counts

**Authenticated (Bot/Web):**
- `POST /api/v1/presets` - Submit new preset
- `POST /api/v1/votes/:id` - Vote for a preset
- `DELETE /api/v1/votes/:id` - Remove vote

**Moderator:**
- `GET /api/v1/moderation/pending` - List pending presets for review
- `PATCH /api/v1/moderation/:id/status` - Approve/reject preset
- `GET /api/v1/moderation/:id/history` - View moderation audit log

#### Features
- **Voting System**: User voting with deduplication (one vote per user per preset)
- **Preset Categories**: Organized browsing by theme/category
- **Search**: Full-text search across name, description, and tags
- **Pagination**: Configurable page size (max 100) with cursor-based pagination
- **Sorting**: By popularity, recency, or alphabetical

#### Content Moderation
- **Local Profanity Filter**: Multi-language bad word detection
- **Perspective API**: Optional ML-based toxicity detection (Google API)
- **Moderation Workflow**: Pending → Approved/Rejected/Flagged status flow
- **Audit Logging**: Full history of moderation actions with reasons

#### Authentication
- **Dual Auth Support**:
  - Bot API: Bearer token (BOT_API_SECRET) + X-User-Discord-ID header
  - Web App: JWT bearer token from OAuth worker
- **Moderator Verification**: MODERATOR_IDS environment variable for admin access

#### Infrastructure
- **Cloudflare D1**: SQLite-compatible database for preset storage
- **Hono Framework**: Fast, lightweight routing
- **Service Binding Ready**: Direct worker-to-worker communication support
