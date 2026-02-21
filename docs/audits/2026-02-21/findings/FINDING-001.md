# FINDING-001: OAuth CSRF State Validation Is Fail-Open

## Severity
HIGH

## Category
CWE-352: Cross-Site Request Forgery

## Location
- File: `apps/web-app/src/services/auth-service.ts`
- Line(s): ~381-384
- Function: OAuth callback handler

## Description
The OAuth CSRF state validation only rejects the callback if **both** the `csrf` parameter and the stored state are non-null **and** differ. If either is missing (attacker strips the `state` URL parameter, or `sessionStorage` is cleared), the validation is silently skipped and the token exchange proceeds.

## Evidence
```typescript
// Verify CSRF state matches
if (csrf && storedState && csrf !== storedState) {
  logger.error('CSRF state mismatch - possible attack detected');
  return;
}
// ← If csrf is null OR storedState is null, this check is SKIPPED entirely
```

## Impact
An attacker could:
1. Initiate a login flow to get a valid authorization code
2. Send the victim a link to `/callback?code=ATTACKER_CODE` (without `state` parameter)
3. The missing `state` bypasses the CSRF check
4. Token exchange proceeds (mitigated by PKCE `code_verifier`)

PKCE provides a secondary defense, but defense-in-depth requires the state check to be fail-closed.

## Recommendation
Change to fail-closed validation:

```typescript
if (!csrf || !storedState || csrf !== storedState) {
  logger.error('CSRF state validation failed');
  return;
}
```

## References
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [CWE-352](https://cwe.mitre.org/data/definitions/352.html)
