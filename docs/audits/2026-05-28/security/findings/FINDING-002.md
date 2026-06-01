# [FINDING-002]: oauth `verifyJWT` does not explicitly pin `alg=HS256` (and duplicates the shared auth lib)

## Severity
LOW (defense-in-depth + documentation mismatch + code duplication)

## Category
CWE-1270 / JWT algorithm-confusion hardening; CWE-1041 (redundant security primitive)

## Location
- File: `apps/oauth/src/services/jwt-service.ts`
- Lines: 200-230 (`verifyJWT`), 257-284 (`verifyJWTSignatureOnly`)

## Description
The oauth worker ships its **own** JWT implementation rather than using
`@xivdyetools/auth`. Its `verifyJWT` splits the token and verifies the signature with
`crypto.subtle.verify('HMAC', ...)` but **never inspects the `alg` header**:

```typescript
const [encodedHeader, encodedPayload, signature] = parts;
const signatureInput = `${encodedHeader}.${encodedPayload}`;
const isValid = await verify(signatureInput, signature, secret); // always HMAC-SHA256
```

By contrast, `@xivdyetools/auth`'s `verifyJWT` explicitly does
`if (header.alg !== 'HS256') return null;` and additionally requires the `sub` claim
(BUG-010) and an `exp` claim (FINDING-003 in the auth package's own history).

The oauth worker's `CLAUDE.md` claims "verifyJWT explicitly rejects any algorithm other
than HS256" — but the code does not. The documentation and implementation disagree.

## Impact
**Not currently exploitable.** Because verification is hardcoded to HMAC-SHA256 and never
branches on the header's `alg`, the classic attacks fail:
- `alg: none` → empty/garbage signature → `subtle.verify` returns false → rejected.
- `alg: RS256` swap → attacker still cannot produce a valid HMAC without `JWT_SECRET`.

The risk is **future regression + drift**: two independent JWT verifiers in the same
ecosystem (one pinned, one not, with differing claim requirements) invites the next
edit to introduce an alg-dependent branch in the unpinned copy, or to diverge on claim
validation. The presets-api verifies oauth-issued tokens via the *shared* lib, so the two
verifiers must stay behavior-compatible.

## Recommendation
1. **Short term (hardening):** add an explicit algorithm check at the top of `verifyJWT`
   and `verifyJWTSignatureOnly`:
   ```typescript
   const header = JSON.parse(base64UrlDecode(encodedHeader));
   if (header.alg !== 'HS256') throw new Error('Unsupported JWT algorithm');
   ```
   Also enforce a non-empty `sub` claim to match the shared lib.
2. **Long term (consolidation):** replace `jwt-service.ts`'s verify/decode helpers with
   `@xivdyetools/auth` so there is a single audited JWT verifier across the ecosystem.
   (Token *creation* can remain local — the shared lib intentionally only verifies.)
3. Fix the `CLAUDE.md` claim to match whatever the code actually does.

## References
- Compare `packages/auth/src/jwt.ts` (pinned) vs `apps/oauth/src/services/jwt-service.ts` (unpinned)
- CWE-1270; Auth0 "Critical vulnerabilities in JSON Web Token libraries"
