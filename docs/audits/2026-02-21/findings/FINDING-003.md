# FINDING-003: JWT `verifyJWT` Accepts Tokens Without `exp` Claim

## Severity
MEDIUM

## Category
CWE-613: Insufficient Session Expiration

## Location
- File: `packages/auth/src/jwt.ts`
- Line(s): ~140-145
- Function: `verifyJWT()`

## Description
The expiration check uses `payload.exp && payload.exp < now`, which means tokens missing the `exp` claim (or with `exp: 0`) are accepted as valid with no expiration. This creates perpetually valid tokens.

## Evidence
```typescript
// Check expiration
const now = Math.floor(Date.now() / 1000);
if (payload.exp && payload.exp < now) {
  return null;
}
// ← If payload.exp is undefined or 0, token is accepted as never-expiring
```

A test confirms this behavior:
```typescript
it('Should pass since no exp means no expiration check', ...);
```

## Impact
If the token-issuing service ever has a bug that omits `exp`, or if an attacker crafts a token with `exp: 0` (requires knowing the secret), the token becomes perpetually valid.

## Recommendation
Make `exp` mandatory for full JWT verification:

```typescript
if (!payload.exp || payload.exp < now) {
  return null;
}
```

Leave `verifyJWTSignatureOnly` unchanged since that function is intentionally lenient for refresh flows.

## References
- [CWE-613](https://cwe.mitre.org/data/definitions/613.html)
- [JWT Best Practices RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725)
