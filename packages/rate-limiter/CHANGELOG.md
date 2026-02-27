# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-02-27

### Fixed

- Fix `vi.fn()` mock typing in `upstash.test.ts` — added type generics to match `RateLimiterLogger` signatures, resolving type-check error

## [1.4.0] - 2026-02-21

### Security

- **FINDING-002**: Fix Upstash race condition — use atomic `INCR` + `EXPIRE NX` pipeline instead of separate `EXPIRE` call that could leave immortal keys on Worker crash
- **FINDING-006**: Default `trustXForwardedFor` to `false` in `getClientIp` — prevents IP spoofing in Cloudflare Workers where `CF-Connecting-IP` is the trusted source

### Fixed

- **BUG-004**: Fix KV backend `checkOnly` off-by-one — `remaining` was 1 less than actual remaining capacity due to premature decrement
- **BUG-005**: Fix KV backend `check` post-increment accounting — `remaining` now reflects the consumed request after `increment()`

## [1.3.1] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.3.0] - 2026-02-06

### Security

- **FINDING-003**: Added `GetClientIpOptions` with `trustXForwardedFor` option to `getClientIp()`.
  Allows consumers to disable X-Forwarded-For fallback (which is client-spoofable) and rely
  solely on Cloudflare's `CF-Connecting-IP` header.
- **FINDING-004**: Enhanced JSDoc documentation on `KVRateLimiter.check()` to clearly describe
  the TOCTOU race condition inherent in non-atomic KV operations, along with existing mitigations
  and recommendations for atomic alternatives.
- **FINDING-006**: IP addresses returned by `getClientIp()` are now normalized to lowercase,
  preventing IPv6 case mismatches (e.g., `2001:DB8::1` vs `2001:db8::1`) from creating
  duplicate rate limit buckets.
- **FINDING-007**: Changed KV key delimiter from `:` to `|` in `buildKey()` to prevent key
  ambiguity when rate-limit keys contain colons (e.g., IPv6 addresses). Existing KV entries
  will expire naturally within their window TTL.

### Added

- `GetClientIpOptions` interface (exported from package root)
- `normalizeIp()` internal helper for consistent IP comparison
- 6 new tests covering `trustXForwardedFor` and IPv6 normalization

---

## [1.2.0] - 2026-01-26

_Version 1.2.0 was an internal build; release skipped._

---

## [1.1.0] - 2026-01-26

### Added

- `RateLimiterLogger` interface for structured logging integration
- Optional `logger` parameter in `KVRateLimiterOptions`
- Structured logging for fail-open events (warn level)
- Structured logging for KV increment failures after retries (error level)
- 3 new tests for logger integration

### Changed

- `KVRateLimiter` now logs fail-open events when a logger is provided
- Improved error context in increment failures (includes operation, attempts, maxRetries)
- Backward-compatible: falls back to `console.error` when no logger is provided

### Technical Notes

- Implements security audit recommendation #4: "Monitoring - Implement alerting for rate limiter KV errors"
- Compatible with @xivdyetools/logger or any logger implementing warn() and error()

## [1.0.0] - 2026-01-25

### Added

- Initial release of @xivdyetools/rate-limiter
- `MemoryRateLimiter` - In-memory sliding window with LRU eviction
  - Deterministic cleanup every N requests
  - Configurable max entries (default: 10,000)
  - Preserves PRESETS-BUG-001 fix for memory safety
- `KVRateLimiter` - Cloudflare KV backend with optimistic concurrency
  - Version metadata for conflict detection
  - Retry logic with exponential backoff
  - Preserves MOD-BUG-001 fix for KV race conditions
  - Separate `checkOnly()` and `increment()` methods
- `getRateLimitHeaders()` - Standard rate limit response headers
- `formatRateLimitMessage()` - Human-readable rate limit messages
- `getClientIp()` - Client IP extraction (CF-Connecting-IP, X-Forwarded-For)
- Pre-built configurations:
  - `OAUTH_LIMITS` - OAuth endpoint protection
  - `DISCORD_COMMAND_LIMITS` - Per-command Discord bot limits
  - `MODERATION_LIMITS` - Moderation bot with burst allowance
  - `PUBLIC_API_LIMITS` - General API protection
  - `UNIVERSALIS_PROXY_LIMITS` - Universalis proxy limits
- Comprehensive test suite (36 tests)
- Subpath exports for tree-shaking

### Technical Notes

- REFACTOR-002: Consolidates 5 rate limiting implementations from:
  - xivdyetools-oauth
  - xivdyetools-presets-api
  - xivdyetools-moderation-worker
  - xivdyetools-discord-worker
  - xivdyetools-universalis-proxy
