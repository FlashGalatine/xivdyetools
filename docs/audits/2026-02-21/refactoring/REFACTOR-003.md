# REFACTOR-003: Duplicated JWT Verification Logic

## Priority
MEDIUM

## Category
Code Duplication

## Location
- File: `packages/auth/src/jwt.ts`
- Functions: `verifyJWT()` and `verifyJWTSignatureOnly()`

## Current State
Header parsing, algorithm check, and HMAC verification sequence is duplicated between `verifyJWT()` and `verifyJWTSignatureOnly()`. Both functions parse the JWT structure, check for HS256, import the key, and verify the signature independently.

## Proposed Refactoring
Extract a shared `verifyJWTSignature(token, secret)` helper:

```typescript
async function verifyJWTSignature(
  token: string,
  secret: string
): Promise<{ header: JWTHeader; payload: JWTPayload } | null> {
  // Parse, validate HS256, verify HMAC
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const result = await verifyJWTSignature(token, secret);
  if (!result) return null;
  // Additional checks: exp, iat, etc.
  return result.payload;
}
```

## Benefits
- ~40 lines of deduplication
- Bug fixes apply to both paths
- Easier to add new verification variants

## Effort Estimate
LOW

## Risk Assessment
Low — pure internal restructuring.
