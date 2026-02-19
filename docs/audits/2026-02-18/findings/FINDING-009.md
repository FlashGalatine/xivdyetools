# [FINDING-009]: IP Header Trust Without Cloudflare Validation

## Severity
INFORMATIONAL

## Category
CWE-290: Authentication Bypass by Spoofing

## Location
- File: `apps/universalis-proxy/src/index.ts` (client IP extraction)
- File: `packages/rate-limiter/src/ip.ts` (IP extraction utility)

## Description
The universalis-proxy and rate limiting code trusts `CF-Connecting-IP` and `X-Forwarded-For` headers for client identification. When deployed behind Cloudflare (the intended environment), `CF-Connecting-IP` is set by Cloudflare and cannot be spoofed by clients. However, if any worker is deployed outside of Cloudflare (e.g., local development, alternative CDN), these headers could be spoofed to bypass rate limiting.

## Evidence
```typescript
// packages/rate-limiter/src/ip.ts
// Checks CF-Connecting-IP first, then X-Forwarded-For
const ip = request.headers.get('CF-Connecting-IP')
  || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
  || 'unknown';
```

## Impact
- No impact in production (Cloudflare Workers always set CF-Connecting-IP)
- In local development with Wrangler, the header may not be present, falling back to X-Forwarded-For
- IP-based rate limiting could be bypassed in non-Cloudflare environments

## Recommendation
1. No changes needed for production deployment on Cloudflare
2. Consider documenting that rate limiting assumes Cloudflare infrastructure
3. For local development, Wrangler sets CF-Connecting-IP, so this is already handled

## References
- [Cloudflare HTTP Headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/)
- [CWE-290](https://cwe.mitre.org/data/definitions/290.html)
