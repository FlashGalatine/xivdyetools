# FINDING-006: IPv6 Address Normalization Missing in Rate Limiter

## Severity
LOW

## Category
CWE-290: Authentication Bypass by Spoofing

## Location
- File: `xivdyetools-rate-limiter/src/ip.ts`
- Line(s): 25-42
- Function/Component: `getClientIp()`

## Description
The `getClientIp()` function returns IP addresses as-is without normalizing them. IPv6 addresses have multiple valid string representations for the same address, which means the same client could map to different rate limit buckets.

## Evidence
```typescript
// ip.ts:27-30 - IP returned as-is
const cfIp = request.headers.get('CF-Connecting-IP');
if (cfIp) {
  return cfIp.trim();  // No normalization
}
```

**IPv6 normalization examples:**
```
2001:0db8:0000:0000:0000:0000:0000:0001  (full form)
2001:db8::1                                (compressed form)
2001:0DB8::1                               (uppercase hex)
```

All three represent the same address but would create separate rate limit entries.

## Impact
**Practical risk: Very Low.** Cloudflare's `CF-Connecting-IP` header uses a consistent format, so in production the same client always gets the same IP string. Additionally, the Discord worker uses user IDs (not IPs) for rate limiting. This primarily affects non-Cloudflare deployments using the package independently.

## Recommendation
Normalize IP addresses before using them as rate limit keys:

```typescript
function normalizeIp(ip: string): string {
  // Simple trim and lowercase for consistent casing
  const trimmed = ip.trim().toLowerCase();

  // For production use, consider using a proper IP parsing library
  // that handles IPv6 compression, IPv4-mapped IPv6, etc.
  return trimmed;
}
```

At minimum, apply `.toLowerCase()` to handle hex casing differences.

## References
- CWE-290: https://cwe.mitre.org/data/definitions/290.html
- RFC 5952: A Recommendation for IPv6 Address Text Representation
