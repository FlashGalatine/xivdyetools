# FINDING-007: KV Key Prefix Allows Ambiguous Key Construction

## Severity
LOW

## Category
CWE-138: Improper Neutralization of Special Elements

## Location
- File: `xivdyetools-rate-limiter/src/backends/kv.ts`
- Line(s): 278-281
- Function/Component: `KVRateLimiter.buildKey()`

## Description
The KV key construction concatenates the prefix, user key, and window minute with `:` delimiters, but neither the prefix nor the key are validated or escaped. If a user-controlled key contains `:`, the resulting KV key becomes ambiguous and could potentially collide with other rate limit entries.

## Evidence
```typescript
// kv.ts:278-281
private buildKey(key: string, timestamp: number, windowMs: number): string {
  const minute = Math.floor(timestamp / windowMs);
  return `${this.keyPrefix}${key}:${minute}`;
}
```

**Ambiguity example:**
```
prefix = "ratelimit:"
key = "user123:456"     (contains colon)
minute = 789

Result: "ratelimit:user123:456:789"

// Is this:
// prefix="ratelimit:" key="user123:456" minute=789 ?
// prefix="ratelimit:" key="user123" minute=456:789 ?
```

**Cross-limiter collision:**
If multiple `KVRateLimiter` instances share the same KV namespace with overlapping prefixes, crafted keys could collide:
```
Limiter A: prefix="rl:" key="cmd:user1" → "rl:cmd:user1:42"
Limiter B: prefix="rl:cmd:" key="user1" → "rl:cmd:user1:42"  // Same key!
```

## Impact
**Practical risk: Very Low.** In the Discord worker:
- Rate limit keys are Discord user IDs (numeric snowflakes, no colons)
- Only one KVRateLimiter prefix is used per namespace
- The default prefix `ratelimit:` is unlikely to collide

This is primarily a defensive coding concern for the package's reusability.

## Recommendation
1. Use a delimiter that's less likely to appear in keys (e.g., `|` or `\x00`):
   ```typescript
   return `${this.keyPrefix}${key}|${minute}`;
   ```

2. Or validate/escape keys:
   ```typescript
   private sanitizeKey(key: string): string {
     return key.replace(/:/g, '_');
   }
   ```

3. Document the key format constraints for consumers.

## References
- CWE-138: https://cwe.mitre.org/data/definitions/138.html
