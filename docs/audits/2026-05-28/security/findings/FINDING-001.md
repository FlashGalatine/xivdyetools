# [FINDING-001]: OAuth state signature compared with non-constant-time `!==`

## Severity
LOW

## Category
CWE-208: Observable Timing Discrepancy (Side-Channel)

## Location
- File: `apps/oauth/src/utils/state-signing.ts`
- Line: 67
- Function: `verifyState()`

## Description
`verifyState` recreates the expected HMAC and compares it to the attacker-supplied
signature with a plain JavaScript string inequality:

```typescript
const expectedSignature = await signJwtData(encodedState, secret);
if (providedSignature !== expectedSignature) {
  throw new Error('Invalid state signature');
}
```

`!==` on strings short-circuits at the first differing byte, so the comparison time
correlates with how many leading bytes match. In principle this leaks information that
could help an attacker forge a valid state signature byte-by-byte.

This is notable because the codebase already ships a hardened comparator
(`@xivdyetools/auth`'s `timingSafeEqual`) and verifies *JWT* signatures with
`crypto.subtle.verify` (which is constant-time). The state path is the one place that
regressed to `!==`.

## Impact
Low in practice: the signature is a hex HMAC over network-jittered requests, making a
remote timing attack impractical, and a forged state still has to pass `exp` and
origin-allowlist checks. But a valid state forgery would defeat CSRF protection on the
OAuth callback, so the primitive should be constant-time.

## Recommendation
Use a constant-time comparison, reusing the existing primitive:

```typescript
import { timingSafeEqual } from '@xivdyetools/auth/timing';
// ...
const ok = await timingSafeEqual(providedSignature, expectedSignature);
if (!ok) throw new Error('Invalid state signature');
```

Or, better, verify with `crypto.subtle.verify('HMAC', key, sigBytes, dataBytes)` to match
the JWT path exactly.

## References
- CWE-208; OWASP "Timing Attack"
- Consistent with the project's own `packages/auth/src/timing.ts`
