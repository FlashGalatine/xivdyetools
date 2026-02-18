# FINDING-003: X-Forwarded-For IP Spoofing Can Bypass Rate Limits

## Severity
MEDIUM

## Category
CWE-290: Authentication Bypass by Spoofing

## Location
- File: `xivdyetools-rate-limiter/src/ip.ts`
- Line(s): 33-38
- Function/Component: `getClientIp()`

## Description
The `getClientIp()` function falls back to the `X-Forwarded-For` header when `CF-Connecting-IP` is not present. The `X-Forwarded-For` header is client-controlled and can be trivially spoofed by an attacker to bypass IP-based rate limits.

The function correctly prioritizes `CF-Connecting-IP` (line 27-30), which is set by Cloudflare and cannot be spoofed by the client. However, in environments where Cloudflare is not the reverse proxy (e.g., local development, testing, or alternative deployment targets), the fallback to `X-Forwarded-For` is vulnerable.

## Evidence
```typescript
// ip.ts:32-38
// X-Forwarded-For contains a chain of IPs, first is the client
const xForwardedFor = request.headers.get('X-Forwarded-For');
if (xForwardedFor) {
  const firstIp = xForwardedFor.split(',')[0];
  if (firstIp) {
    return firstIp.trim();
  }
}
```

**Attack scenario:**
```
# Attacker sends requests with different spoofed IPs
curl -H "X-Forwarded-For: 1.1.1.1" https://bot.example.com/
curl -H "X-Forwarded-For: 2.2.2.2" https://bot.example.com/
curl -H "X-Forwarded-For: 3.3.3.3" https://bot.example.com/
# Each request gets its own rate limit bucket
```

## Impact
**In production (Cloudflare Workers): Mitigated.** Cloudflare always sets `CF-Connecting-IP`, so the `X-Forwarded-For` fallback is never reached in normal production traffic.

**In non-Cloudflare environments: Exploitable.** If this rate limiter package is used outside Cloudflare Workers (it's an npm package), IP-based rate limits can be completely bypassed.

**For the Discord worker specifically:** Rate limiting uses Discord user IDs (not IPs), so this finding has minimal impact on the primary use case. IP-based limiting is only used by the Universalis proxy.

## Recommendation
1. Add a prominent JSDoc warning that `X-Forwarded-For` is untrusted:
   ```typescript
   /**
    * WARNING: X-Forwarded-For is client-controlled and can be spoofed.
    * Only rely on this in environments where a trusted reverse proxy
    * strips/overwrites the header. In Cloudflare Workers, CF-Connecting-IP
    * is always available and trustworthy.
    */
   ```

2. Consider adding a `trustedProxy` option to optionally disable `X-Forwarded-For`:
   ```typescript
   export function getClientIp(request: Request, options?: { trustXForwardedFor?: boolean }): string
   ```

3. For defense in depth, validate that the extracted IP is a valid IP format.

## References
- CWE-290: https://cwe.mitre.org/data/definitions/290.html
- OWASP: HTTP Request Smuggling via X-Forwarded-For
- Cloudflare docs: CF-Connecting-IP header
