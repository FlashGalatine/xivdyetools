# FINDING-012: Rate Limiter Key Injection via Unsanitized Delimiter

## Severity
MEDIUM

## Category
CWE-74: Injection

## Location
- Files: `packages/rate-limiter/src/backends/kv.ts`, `packages/rate-limiter/src/backends/upstash.ts`
- Line(s): ~292-296 (KV), ~152-154 (Upstash)
- Function: `buildKey()`

## Description
Neither backend sanitizes the `key` parameter before using it in key construction. The KV backend uses `|` as a delimiter. A malicious key (e.g., from `X-Forwarded-For: "attacker|99999999999"`) could collide with another user's window key, corrupting their rate limit state.

## Evidence
```typescript
// KV buildKey:
private buildKey(key: string, timestamp: number, windowMs: number): string {
  const window = Math.floor(timestamp / windowMs);
  return `${this.keyPrefix}${key}|${window}`;
}
```

## Impact
An attacker crafting an IP address or identifier containing the `|` delimiter could share a rate limit counter with another user, either consuming their quota or hiding their own traffic behind the victim's counter.

## Recommendation
Sanitize or encode the key:

```typescript
private buildKey(key: string, timestamp: number, windowMs: number): string {
  const sanitizedKey = key.replace(/\|/g, '_');
  const window = Math.floor(timestamp / windowMs);
  return `${this.keyPrefix}${sanitizedKey}|${window}`;
}
```

## References
- [CWE-74: Improper Neutralization of Special Elements in Output](https://cwe.mitre.org/data/definitions/74.html)
