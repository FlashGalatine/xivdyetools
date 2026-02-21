# FINDING-006: `getClientIp` Trusts `X-Forwarded-For` by Default

## Severity
MEDIUM

## Category
CWE-290: Spoofing / CWE-346: Origin Validation Error

## Location
- File: `packages/rate-limiter/src/ip.ts`
- Line(s): ~58-77
- Function: `getClientIp()`

## Description
The `trustXForwardedFor` option defaults to `true`. Since the target environment is Cloudflare Workers (where `CF-Connecting-IP` is always set and trustworthy), the XFF fallback introduces an unnecessary IP spoofing vector. An attacker can set `X-Forwarded-For: 1.2.3.4` to bypass per-IP rate limiting.

## Evidence
```typescript
const { trustXForwardedFor = true } = options;  // ← Default true is dangerous
```

## Impact
Attackers can trivially bypass IP-based rate limiting by rotating the `X-Forwarded-For` header with each request. This is especially dangerous for the OAuth rate limiter and APIs without additional authentication.

## Recommendation
Change the default to `false`:
```typescript
const { trustXForwardedFor = false } = options;
```

Consumers in non-Cloudflare environments who need XFF can explicitly opt in.

## References
- [CWE-290: Authentication Bypass by Spoofing](https://cwe.mitre.org/data/definitions/290.html)
