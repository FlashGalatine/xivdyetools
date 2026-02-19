# [FINDING-001]: Bot Signing Secret Not Enforced in Production

## Severity
MEDIUM

## Category
CWE-287: Improper Authentication

## Location
- File: `apps/presets-api/src/middleware/auth.ts`
- Function: Bot authentication middleware

## Description
The presets-api allows unsigned bot authentication requests when `BOT_SIGNING_SECRET` is not configured. While this is intended for development, there is no explicit hard-fail check in the production environment validation to ensure this secret is always present. If deployed to production without the secret, bot auth requests could bypass HMAC signature verification.

The `apps/presets-api/src/index.ts` does validate environment variables on first request (line 50-68) and fails fast in production if misconfigured. However, the bot signing secret should be explicitly listed as a required production variable.

## Evidence
```typescript
// apps/presets-api/src/index.ts (lines 50-68)
app.use('*', async (c, next) => {
  if (!envValidated) {
    const result = validateEnv(c.env);
    envValidated = true;
    if (!result.valid) {
      logValidationErrors(result.errors);
      if (c.env.ENVIRONMENT === 'production') {
        return c.json({ success: false, error: ErrorCode.SERVICE_UNAVAILABLE }, 500);
      }
      // In development, log warnings but continue
    }
  }
  await next();
});
```

## Impact
If `BOT_SIGNING_SECRET` is accidentally omitted from production environment variables, bot authentication could be weakened or bypassed, allowing unauthorized service-to-service calls to the presets API.

## Recommendation
1. Ensure `BOT_SIGNING_SECRET` is explicitly listed as a required variable in `validateEnv()`
2. Add a startup check: `if (env.ENVIRONMENT === 'production' && !env.BOT_SIGNING_SECRET) throw new Error('BOT_SIGNING_SECRET required in production')`
3. Consider adding a Wrangler deployment check that verifies all required secrets are set

## References
- [OWASP - Broken Authentication](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- [CWE-287](https://cwe.mitre.org/data/definitions/287.html)
