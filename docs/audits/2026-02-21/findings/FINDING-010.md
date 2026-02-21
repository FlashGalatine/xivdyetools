# FINDING-010: JWT Payload Type Assertion Without Runtime Validation

## Severity
MEDIUM

## Category
CWE-20: Improper Input Validation

## Location
- File: `packages/auth/src/jwt.ts`
- Line(s): ~136-137
- Function: `verifyJWT()`

## Description
After `JSON.parse()`, the JWT payload is cast to `JWTPayload` via `as` without runtime validation. A validly signed token could contain unexpected types (e.g., `{ "sub": 123 }` where `sub` should be a `string`), causing subtle bugs in downstream consumers.

## Evidence
```typescript
const payload: JWTPayload = JSON.parse(payloadJson) as JWTPayload;
// ← No runtime check that payload.sub is a string,
//    payload.type is 'access' | 'refresh', etc.
```

## Impact
A token with valid signature but invalid payload structure would pass verification and be handed to business logic, potentially causing runtime type errors or data corruption.

## Recommendation
Add a runtime guard function:

```typescript
function isValidPayload(p: unknown): p is JWTPayload {
  return (
    typeof p === 'object' && p !== null &&
    typeof (p as JWTPayload).sub === 'string' &&
    typeof (p as JWTPayload).iat === 'number' &&
    typeof (p as JWTPayload).exp === 'number' &&
    ((p as JWTPayload).type === 'access' || (p as JWTPayload).type === 'refresh')
  );
}
```

## References
- [CWE-20: Improper Input Validation](https://cwe.mitre.org/data/definitions/20.html)
