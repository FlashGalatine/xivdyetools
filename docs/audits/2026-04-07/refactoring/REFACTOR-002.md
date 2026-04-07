# REFACTOR-002: Rate Limiting Middleware Inconsistent Across Workers

- **Priority:** MEDIUM
- **Effort:** MEDIUM
- **Category:** Code Duplication / Inconsistency
- **Status:** **FIXED**
- **Files:**
  - `apps/discord-worker/src/services/rate-limiter.ts` — Custom per-command rate limits
  - `apps/presets-api/src/middleware/rate-limit.ts` — KV-backed public rate limiting
  - `apps/presets-api/src/services/rate-limit-service.ts` — Per-user submission rate limiting
  - `apps/oauth/src/services/rate-limit.ts` — Path-specific IP rate limiting

## Resolution

Created `rateLimitMiddleware()` factory in `@xivdyetools/worker-middleware` that standardizes:
- X-RateLimit-* header formatting (via shared `getRateLimitHeaders()`)
- Retry-After calculation
- Fail-open/fail-closed error handling with structured logging
- 429 response format

Supports both pre-created backends and lazy factory functions (for KV bindings only available at request time).

Refactored:
- **presets-api** (`middleware/rate-limit.ts`): Now uses shared factory with MemoryRateLimiter + PUBLIC_API_LIMITS
- **api-worker** (`middleware/rate-limit.ts`): Now uses shared factory with lazy KVRateLimiter + custom `formatError`

Not refactored (intentionally — unique patterns):
- **discord-worker**: Per-user, per-command with Upstash/KV fallback chain
- **oauth**: Durable Object-based per-endpoint limits
- **universalis-proxy**: Inline route-level with seconds-based adapter

MEDIUM — Requires abstracting common patterns while preserving per-worker configuration.
