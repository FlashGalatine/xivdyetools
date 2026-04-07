# REFACTOR-002: Rate Limiting Middleware Inconsistent Across Workers

- **Priority:** MEDIUM
- **Effort:** MEDIUM
- **Category:** Code Duplication / Inconsistency
- **Files:**
  - `apps/discord-worker/src/services/rate-limiter.ts` — Custom per-command rate limits
  - `apps/presets-api/src/middleware/rate-limit.ts` — KV-backed public rate limiting
  - `apps/presets-api/src/services/rate-limit-service.ts` — Per-user submission rate limiting
  - `apps/oauth/src/services/rate-limit.ts` — Path-specific IP rate limiting

## Description

Each worker implements rate limiting differently:

| Worker | Backend | Key Format | Behavior on Error |
|--------|---------|------------|-------------------|
| discord-worker | Memory/KV | `cmd:{userId}:{command}` | Block |
| presets-api | KV | `{ip}` | Fail-open (logged) |
| oauth | Memory/KV | `{ip}:{path}` | Fail-open |

While different workers have legitimately different rate limiting needs, the middleware patterns for:
- Extracting rate limit results
- Setting `X-RateLimit-*` response headers
- Handling `Retry-After` timing
- Logging rate limit events

...are duplicated and inconsistent.

## Impact

- Rate limit header formats may differ between workers
- Error handling behavior varies (fail-open vs block)
- New workers must re-derive the rate limiting integration pattern

## Recommendation

Create a shared rate limiting middleware factory in `@xivdyetools/worker-middleware`:

```typescript
export function rateLimitMiddleware(options: {
  backend: RateLimiter;
  keyExtractor: (c: Context) => string;
  onError?: 'fail-open' | 'fail-closed';
}): MiddlewareHandler;
```

Individual workers would configure their specific backends and key strategies while sharing header formatting and error handling.

## Effort

MEDIUM — Requires abstracting common patterns while preserving per-worker configuration.
