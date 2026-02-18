# REFACTOR-002: Consolidate Rate Limiting Implementations

## Priority
**HIGH**

## Category
Code Duplication / Architecture

## Location
- xivdyetools-oauth/src/durable-objects/rate-limiter.ts
- xivdyetools-presets-api/src/services/rate-limit-service.ts
- xivdyetools-moderation-worker/src/middleware/rate-limit.ts
- xivdyetools-discord-worker/src/services/rate-limiter.ts

## Current State
4 independent rate limiting implementations with similar algorithms but different interfaces:
- Durable Object version (most reliable)
- KV-based versions (prone to race conditions)
- Different configuration formats
- Different response types

## Issues
- Inconsistent rate limit behavior
- Duplicate race condition mitigations
- No shared configuration schema
- Testing burden multiplied

## Proposed Refactoring
Create `@xivdyetools/rate-limiter` abstraction:

```typescript
interface IRateLimiter {
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
  increment(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

// Two backends
class DurableObjectRateLimiter implements IRateLimiter { }
class KVRateLimiter implements IRateLimiter { }
```

## Benefits
- Consistent rate limiting across ecosystem
- Single place to fix race condition issues
- Easier to swap backends (KV → DO)
- Shared configuration and response types

## Effort Estimate
**MEDIUM** (4-6 hours)

## Risk Assessment
- Medium risk: Rate limiting is security-critical
- Requires coordination across multiple projects
- Good test coverage essential

## Status
**DEFERRED** (2026-01-25)

**Analysis Notes:**
The 4 implementations use fundamentally different backends with different trade-offs:

| Project | Backend | Atomicity | Persistence | Complexity |
|---------|---------|-----------|-------------|------------|
| oauth | Durable Objects | ✅ Atomic | ✅ Persistent | High |
| presets-api | In-memory Map | ✅ Atomic | ❌ Ephemeral | Low |
| moderation-worker | KV + versioning | ⚠️ Optimistic | ✅ Persistent | Medium |
| discord-worker | KV + JSON | ⚠️ Race-prone | ✅ Persistent | Low |

**Why Deferred:**
1. Each implementation is tailored to its specific use case
2. True consolidation requires creating a new `@xivdyetools/rate-limiter` package
3. Architectural decision needed: standardize on DO (reliable) vs KV (simpler) vs Memory (fast)
4. Existing implementations work correctly with documented limitations

**Recommended Path:**
- Phase 3 (2+ weeks): Create shared abstraction with multiple backend implementations
- For now: Document race conditions (already done via BUG-002) and accept trade-offs
