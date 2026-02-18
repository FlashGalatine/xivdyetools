# FINDING-004: KV Rate Limiter Race Condition Allows Limit Overrun

## Severity
MEDIUM

## Category
CWE-362: Concurrent Execution Using Shared Resource with Improper Synchronization

## Location
- File: `xivdyetools-rate-limiter/src/backends/kv.ts`
- Line(s): 99-105, 176-252
- Function/Component: `KVRateLimiter.check()`, `KVRateLimiter.increment()`

## Description
The KV rate limiter's `check()` method separates the read (checkOnly) and write (increment) into two distinct KV operations. Between these operations, another concurrent request can read the same counter value and also pass the check, leading to a TOCTOU (Time-of-Check-Time-of-Use) race condition.

The code acknowledges this limitation (line 174: "minimizes but doesn't eliminate the race window") and implements optimistic concurrency with retries (MOD-BUG-001 fix). However, the race window still exists.

## Evidence
```typescript
// kv.ts:99-105 (check combines checkOnly + increment)
async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const result = await this.checkOnly(key, config);  // READ
  // ← Race window: another request can read the same count here
  if (result.allowed && !result.backendError) {
    await this.increment(key, config);                 // WRITE
  }
  return result;
}
```

**Race scenario (limit = 5):**
1. Request A calls `checkOnly()` → count=4, allowed=true
2. Request B calls `checkOnly()` → count=4, allowed=true (same stale value)
3. Request A calls `increment()` → count=5
4. Request B calls `increment()` → count=6 (exceeds limit!)

The verification check (line 214: `if (verified.count >= entry.count)`) only verifies that the write succeeded, not that the limit wasn't exceeded.

## Impact
**Practical risk: Low-Medium.** This primarily affects high-concurrency scenarios. For the Discord worker:
- Discord interactions are serialized per-user (Discord doesn't send concurrent interactions from the same user)
- The Upstash Redis backend (used in production) provides truly atomic operations
- KV is used as a fallback when Upstash is unavailable

The race window is small (~10-50ms between read and write to KV) and requires precise concurrent timing to exploit.

## Recommendation
1. **Use Upstash Redis as the primary backend** (already done in production) — its atomic INCR operations eliminate this class of bug entirely.

2. **Document the KV limitation clearly** for consumers:
   ```typescript
   /**
    * WARNING: KV backend has a TOCTOU race window. For strict rate limiting,
    * use UpstashRateLimiter which provides atomic operations.
    * KV is suitable for best-effort rate limiting where occasional overruns
    * (1-2 extra requests) are acceptable.
    */
   ```

3. **Consider Cloudflare Durable Objects** for truly atomic KV-like rate limiting without external dependencies.

## References
- CWE-362: https://cwe.mitre.org/data/definitions/362.html
- CWE-367: TOCTOU Race Condition
- Cloudflare KV documentation: Eventual consistency model
