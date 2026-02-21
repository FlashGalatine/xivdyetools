# FINDING-002: Upstash INCR Without Atomic EXPIRE — Immortal Keys

## Severity
HIGH

## Category
CWE-362: Race Condition / CWE-770: Resource Exhaustion

## Location
- File: `packages/rate-limiter/src/backends/upstash.ts`
- Line(s): ~94-109
- Function: `check()`

## Description
The Upstash backend pipelines `INCR` + `TTL`, then sets `EXPIRE` in a **separate** command if TTL is `-1`. Between the `pipeline.exec()` and the `await this.redis.expire()`, if the Worker isolate terminates (timeout, crash, or Cloudflare recycling), the key exists with a counter but **no expiration**. It will persist indefinitely, and the counter will keep incrementing across all future windows, permanently rate-limiting the user.

## Evidence
```typescript
const pipeline = this.redis.pipeline();
pipeline.incr(redisKey);
pipeline.ttl(redisKey);
const results = await pipeline.exec<[number, number]>();

// Gap between INCR and EXPIRE — key persists without TTL if crash here
if (ttl === -1) {
  await this.redis.expire(redisKey, ttlSeconds);
}
```

## Impact
- Users can be permanently rate-limited if the Worker crashes between INCR and EXPIRE
- Immortal keys accumulate in Redis, consuming storage
- Under high concurrency, multiple requests may race to set EXPIRE (benign but wasteful)

## Recommendation
Use atomic INCR + EXPIRE with NX flag (Redis 7.0+):

```typescript
const pipeline = this.redis.pipeline();
pipeline.incr(redisKey);
pipeline.expire(redisKey, ttlSeconds, 'NX'); // NX = only set if no TTL exists
const [count] = await pipeline.exec<[number, number]>();
```

Or use a Lua script for full atomicity:

```lua
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
```

## References
- [CWE-362: Concurrent Execution using Shared Resource with Improper Synchronization](https://cwe.mitre.org/data/definitions/362.html)
- [Redis EXPIRE NX](https://redis.io/commands/expire/)
