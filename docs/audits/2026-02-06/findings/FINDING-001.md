# FINDING-001: JWT Signature Uses Non-Constant-Time Comparison

## Severity
MEDIUM

## Category
CWE-208: Observable Timing Discrepancy

## Location
- File: `xivdyetools-auth/src/jwt.ts`
- Line(s): 137, 214
- Function/Component: `verifyJWT()`, `verifyJWTSignatureOnly()`

## Description
The JWT signature verification uses JavaScript's `!==` operator to compare the expected signature with the provided signature. This is a non-constant-time comparison that can leak information about the correct signature through timing differences.

When comparing two strings with `!==`, JavaScript short-circuits on the first mismatched character. An attacker could theoretically measure response times to determine how many characters of their forged signature match the expected value, enabling a byte-by-byte brute-force of the signature.

## Evidence
```typescript
// jwt.ts:136-139 (verifyJWT)
// Compare signatures (using string comparison - both are base64url)
if (signatureB64 !== expectedSignatureB64) {
  return null;
}

// jwt.ts:214 (verifyJWTSignatureOnly)
if (signatureB64 !== expectedSignatureB64) {
  return null;
}
```

Note: The module's own docstring (line 10) claims "Timing-safe signature comparison" but the implementation uses `!==`.

## Impact
**Practical risk: Low.** Exploiting timing side-channels over a network (especially through Cloudflare's edge network with variable latency) is extremely difficult. However:
- The `@xivdyetools/auth` package already exports `timingSafeEqual` from `timing.ts`
- The fix is trivial and eliminates the theoretical risk entirely
- This represents a gap between documented behavior and actual implementation

## Recommendation
Replace `!==` comparisons with the existing `timingSafeEqual` utility:

```typescript
import { timingSafeEqual } from './timing.js';

// In verifyJWT() and verifyJWTSignatureOnly():
const encoder = new TextEncoder();
if (!(await timingSafeEqual(
  encoder.encode(signatureB64),
  encoder.encode(expectedSignatureB64)
))) {
  return null;
}
```

Alternatively, use `crypto.subtle.verify()` directly (which is inherently timing-safe):

```typescript
const isValid = await crypto.subtle.verify(
  'HMAC', key, base64UrlDecodeBytes(signatureB64), encoder.encode(signatureInput)
);
if (!isValid) return null;
```

## References
- CWE-208: https://cwe.mitre.org/data/definitions/208.html
- OWASP: Testing for Timing Attacks
- Existing timing-safe implementation: `xivdyetools-auth/src/timing.ts`
