# [FINDING-007]: State Transition Period Legacy Flag

## Severity
LOW

## Category
CWE-1188: Initialization with an Insecure Default

## Location
- File: `apps/oauth/src/handlers/callback.ts` (lines 63-64)

## Description
The OAuth callback handler has a `STATE_TRANSITION_PERIOD` environment variable that, when set to `'true'`, allows unsigned OAuth state parameters. This was presumably added during a migration to signed states but remains in the codebase without a documented deprecation or removal timeline.

If accidentally enabled in production, it would weaken CSRF protection by accepting unsigned state parameters in the OAuth flow.

## Evidence
```typescript
// apps/oauth/src/handlers/callback.ts (lines 63-64)
const allowUnsigned =
  c.env.ENVIRONMENT === 'development' || c.env.STATE_TRANSITION_PERIOD === 'true';

stateData = await verifyState(state, c.env.JWT_SECRET, allowUnsigned);
```

## Impact
- If `STATE_TRANSITION_PERIOD=true` is set in production, OAuth state CSRF protection is weakened
- Low practical risk: requires explicit misconfiguration of environment variables
- The flag is only checked in the callback handler, not globally

## Recommendation
1. Add a deprecation date comment: `// TODO: Remove STATE_TRANSITION_PERIOD by [date]`
2. Add a production warning if the flag is enabled: log an error at startup
3. Consider removing the flag entirely if the transition is complete
4. Add a startup validation check that rejects `STATE_TRANSITION_PERIOD=true` in production

## References
- [CWE-1188](https://cwe.mitre.org/data/definitions/1188.html)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
