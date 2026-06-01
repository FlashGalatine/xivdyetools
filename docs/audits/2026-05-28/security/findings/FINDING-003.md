# [FINDING-003]: JWT revocation check fails open on KV error

## Severity
INFORMATIONAL (deliberate availability tradeoff — document & accept)

## Category
CWE-636: Not Failing Securely ("Failing Open")

## Location
- File: `apps/oauth/src/services/jwt-service.ts`
- Lines: 314-327 (`isTokenRevoked`)

## Description
```typescript
export async function isTokenRevoked(jti, kv): Promise<boolean> {
  if (!kv || !jti) return false;
  try {
    const revoked = await kv.get(`revoked:${jti}`);
    return revoked !== null;
  } catch {
    // If KV lookup fails, allow token (fail-open for availability)
    return false;   // <-- treats KV outage as "not revoked"
  }
}
```
During a `TOKEN_BLACKLIST` KV outage (or if the binding is absent), a token that has been
explicitly revoked will be treated as valid.

## Impact
A revoked JWT could be replayed during a KV outage, up to its natural `exp` (default 1h).
The blast radius is bounded by the short token lifetime and the rarity of KV outages.

## Recommendation
This is an intentional availability-over-security choice and is reasonable for the threat
model (low-value session tokens, 1h expiry). Keep it, but:
- Make it an explicit, documented decision (it currently is, in a code comment — promote
  to the security docs).
- Consider emitting a metric/log when the fail-open path triggers so outages are visible.
- For higher-value future actions, require a fresh re-auth rather than trusting a possibly
  revoked token.

## References
- CWE-636; OWASP "Fail securely"
