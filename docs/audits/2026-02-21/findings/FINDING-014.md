# FINDING-014: OAuth State Signature Uses Non-Constant-Time Comparison

## Severity
MEDIUM

## Category
CWE-208: Observable Timing Discrepancy

## Location
- File: `apps/oauth/src/` (state signing/verification)
- Function: State HMAC verification in Discord callback

## Description
The OAuth state parameter's HMAC signature is compared using standard string equality (`===`) instead of a constant-time comparison function. This opens a theoretical timing side-channel attack where an attacker could determine the correct HMAC byte-by-byte by measuring response times.

## Evidence
The state token is signed with HMAC to prevent tampering, but the verification comparison uses JavaScript's `===` operator which short-circuits on the first differing byte.

## Impact
Practical exploitation is extremely difficult in a Cloudflare Worker environment (network jitter dwarfs timing differences), but it's a defense-in-depth gap for security-critical HMAC comparison.

## Recommendation
Use `crypto.subtle.verify()` or the `timingSafeEqual()` function from `@xivdyetools/auth`:

```typescript
import { timingSafeEqual } from '@xivdyetools/auth';
const isValid = await timingSafeEqual(computedSignature, providedSignature);
```

## References
- [CWE-208: Observable Timing Discrepancy](https://cwe.mitre.org/data/definitions/208.html)
