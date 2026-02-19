# [FINDING-006]: KV Rate Limiter TOCTOU Race Condition

## Severity
LOW (Documented)

## Category
CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition

## Location
- File: `packages/rate-limiter/src/backends/kv.ts`

## Description
Cloudflare KV does not support atomic read-modify-write operations. The KV rate limiter performs a `checkOnly()` (read) followed by `increment()` (write) as separate operations. Under high concurrency, multiple requests can pass `checkOnly()` before any of them increment the counter, briefly exceeding the rate limit.

This limitation is well-documented in the codebase with mitigations already in place.

## Evidence
```typescript
// packages/rate-limiter/src/backends/kv.ts
async check(key: string, config: RateLimitConfig) {
  const result = await this.checkOnly(key, config);  // Read
  if (result.allowed) {
    await this.increment(key, config);               // Write
  }
  return result;
  // Concurrent requests can both pass checkOnly() before either increments
}
```

## Impact
- Rate limits may be briefly exceeded by a small margin under high concurrency
- Not exploitable for sustained abuse due to eventual consistency
- The Upstash backend uses truly atomic Redis INCR operations and doesn't have this issue

## Recommendation
1. Current mitigations (optimistic concurrency, version metadata, fail-open) are adequate
2. For endpoints requiring strict rate limiting, use the Upstash backend or Durable Objects
3. Document the KV backend as "best effort" rate limiting in API docs
4. Consider adding an integration test for concurrent rate limit behavior

## References
- [CWE-367](https://cwe.mitre.org/data/definitions/367.html)
- [Cloudflare KV Consistency Model](https://developers.cloudflare.com/kv/reference/consistency/)
