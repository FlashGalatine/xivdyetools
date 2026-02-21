# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] - 2026-02-21

### Changed

- Resolve lint errors across the package

## [1.4.1] - 2026-02-19

### Added

- **OPT-002**: Structured cache hit/miss logging for observability
  - `cachedFetch` now emits JSON-structured log events: `{"event":"cache_result","status":"hit|miss","key":"...","stale":bool}`
  - Enables log aggregation and cache effectiveness analysis via Cloudflare dashboard

---

## [1.4.0] - 2026-02-05

### Changed

- **Removed KV storage layer** — caching now uses Cloudflare Cache API only
  - The dual-layer architecture (Cache API + KV) introduced in v1.1.0 is replaced by Cache API-only caching
  - Stale-while-revalidate, request coalescing, and cache debugging headers all work identically
  - Eliminates all KV write operations from this worker (0 KV writes per request)
  - Removed `PRICE_CACHE` and `STATIC_CACHE` KV namespace bindings from `wrangler.toml`

### Removed

- `CacheMetadata` type (KV-specific metadata)
- `kvTtl` from `CacheConfig` (KV TTL configuration)
- `getFromKv()`, `storeToKv()` methods from `CacheService`
- KV namespace bindings (`PRICE_CACHE`, `STATIC_CACHE`) from worker environment

---

## [1.3.5] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

---

## [1.3.4] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated to `@xivdyetools/rate-limiter` shared package
  - Rate limiting now uses consolidated `MemoryRateLimiter` from shared package
  - Maintains same behavior with async interface adapter
  - Preserves sliding window algorithm and memory safety features

---

## [1.3.3] - 2026-01-25

### Performance

- **OPT-003**: Added jitter to cleanup interval to prevent thundering herd
  - Cleanup timing now varies ±20% around 10-second base interval
  - Distributes cleanup load across 8-12 second window instead of synchronized spikes
  - Prevents all Worker isolates from running cleanup simultaneously
  - Each cleanup randomizes the next interval for continued distribution
  - **Reference**: Security audit OPT-003 (2026-01-25)

---

## [1.3.2] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`

---

## [1.3.1] - 2026-01-19

### Fixed

- **PROXY-BUG-001**: Fixed race condition in `Response.json()` double-parsing in RequestCoalescer. Applied deferred promise pattern to prevent duplicate in-flight requests consuming response body multiple times
- **PROXY-BUG-002**: Fixed unhandled promise rejection in RequestCoalescer. Deferred promise pattern now ensures rejections propagate correctly to all waiting callers

---

## [1.3.0] - 2026-01-05

### Added

- **Datacenter Whitelist**: New `src/config/datacenters.ts` module
  - Complete whitelist of valid FFXIV datacenters and worlds
  - `isValidDatacenterOrWorld()` helper function for validation
  - Prevents cache pollution from invalid datacenter values

- **Rate Limiting**: New `src/services/rate-limiter.ts` module
  - IP-based sliding window rate limiter
  - Configurable via `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS` env vars
  - Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
  - Periodic cleanup prevents memory growth

### Security

#### Medium Priority Audit Fixes (2026-01-05 Security Audit)

- **MED-001**: Implemented datacenter/world whitelist validation
  - Replaced permissive alphanumeric regex with explicit whitelist
  - Prevents cache pollution and reduces attack surface

- **MED-002**: Implemented IP-based rate limiting
  - Rate limiting now enforced (was previously configured but not used)
  - Default: 60 requests per 60-second window (configurable via env vars)
  - Returns 429 Too Many Requests with Retry-After header when exceeded

---

## [1.2.2] - 2025-12-24

### Security

- **PROXY-HIGH-002**: Added upstream response size limit
  - Maximum allowed response size: 5MB
  - Checks `Content-Length` header before processing response body
  - Throws `ResponseTooLargeError` if limit exceeded
  - Prevents out-of-memory crashes from unexpectedly large upstream responses

---

## [1.2.1] - 2025-12-24

### Fixed

- **Test Suite**: Fixed safety timeout test to match implementation behavior
  - Updated test to use correct 60-second timeout (was incorrectly testing 30s)
  - Fixed cleanup trigger mechanism - cleanup runs at start of new coalesce() call
  - Ensures proper test coverage for stale entry cleanup

---

## [1.2.0] - 2025-12-24

### Fixed

#### Security Audit - Critical Issues Resolved

- **PROXY-CRITICAL-001**: Fixed memory leak in request coalescer
  - Added timestamp-based entries with periodic cleanup
  - Stale entries cleaned every 10 seconds (entries older than 60s)
  - Prevents unbounded map growth if promises hang
- **PROXY-CRITICAL-002**: Refactored CORS middleware for clarity
  - Set CORS headers directly instead of calling cors() middleware function
  - Explicit OPTIONS preflight handling with proper headers
  - More predictable header application on all responses
- **PROXY-CRITICAL-003**: Added item ID count and range validation
  - Maximum 100 items per request (prevents DoS amplification)
  - Item IDs validated to be 1-1,000,000 (reasonable FFXIV range)
  - Returns clear error messages with invalid ID details

### Changed

- Removed unused `cors` import from Hono middleware

---

## [1.1.0] - 2025-12-16

### Added

- **Dual-layer caching system** with Cloudflare Cache API (edge) and KV storage (global)
- **Request coalescing** to prevent duplicate upstream requests when multiple clients request the same data simultaneously
- **Stale-while-revalidate pattern** for instant responses while refreshing cache in background
- Caching for `/api/v2/data-centers` endpoint (24-hour TTL)
- Caching for `/api/v2/worlds` endpoint (24-hour TTL)
- Cache debugging headers: `X-Cache`, `X-Cache-Source`, `X-Cache-Stale`, `Cache-Control`
- New `STATIC_CACHE` KV namespace for rarely-changing data

### Changed

- Upgraded from simple KV-only caching to dual-layer Cache API + KV architecture
- Cache key normalization: item IDs are now sorted for better cache hit rates
- Datacenter names are lowercased in cache keys for consistency
- Version bumped to 1.1.0

### Technical Details

- New files: `src/types/cache.ts`, `src/config/cache.ts`, `src/services/cache-service.ts`, `src/services/request-coalescer.ts`, `src/services/cached-fetch.ts`
- Cache TTLs: 5 minutes for price data, 24 hours for static data (worlds/data-centers)
- SWR windows: 2 minutes for price data, 6 hours for static data

## [1.0.0] - 2025-12-16

### Added

- Initial release of Universalis API proxy
- CORS support for all responses including error responses (429, 500, etc.)
- Proxy endpoints for `/api/v2/aggregated/:datacenter/:itemIds`
- Proxy endpoints for `/api/v2/data-centers` and `/api/v2/worlds`
- Health check endpoints at `/` and `/health`
- Input validation to prevent injection attacks
- User-Agent header identifying XIV Dye Tools
- Optional KV-based caching with 5-minute TTL
- Development and production environment configurations
