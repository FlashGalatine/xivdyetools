# [FINDING-005]: JWT Stored in localStorage

## Severity
LOW (Documented Trade-off)

## Category
CWE-922: Insecure Storage of Sensitive Information

## Location
- File: `apps/web-app/src/services/auth-service.ts`

## Description
The web application stores JWT tokens in `localStorage` for session persistence. This is a well-documented architectural trade-off in the codebase. The code includes extensive comments explaining the rationale:

1. CSP prevents `unsafe-inline` scripts, reducing XSS attack surface
2. Token has short expiry with server-side revocation capability
3. Tokens are never logged
4. `httpOnly` cookies are not feasible with the cross-origin Worker architecture

## Evidence
```typescript
// apps/web-app/src/services/auth-service.ts
// Comments document the security rationale extensively
// Token is stored with explicit expiry tracking
localStorage.setItem('jwt_token', token);
localStorage.setItem('jwt_expires_at', expiresAt.toString());
```

## Impact
- If XSS bypasses CSP, attacker can read the JWT from localStorage
- Cross-tab token sharing means all tabs are affected by a single compromise
- Mitigated by: short token expiry, CSP, no `unsafe-inline`, server-side revocation

## Recommendation
1. Current approach is acceptable given the architecture constraints
2. Consider adding a `logout` event listener across tabs via `StorageEvent` for cross-tab invalidation
3. Monitor CSP violation reports for XSS attempts
4. Ensure token expiry remains short (current implementation is good)

## References
- [OWASP - Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [CWE-922](https://cwe.mitre.org/data/definitions/922.html)
