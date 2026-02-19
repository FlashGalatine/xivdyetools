# [FINDING-010]: Moderator IDs Not Validated at Startup

## Severity
LOW

## Category
CWE-284: Improper Access Control

## Location
- File: `apps/moderation-worker/src/index.ts` (lines 54-69)
- File: `apps/moderation-worker/src/services/preset-api.ts` (validateSecurityConfig)

## Description
The moderation worker validates security configuration on first request via `validateSecurityConfig()`. However, it logs warnings/errors but does not hard-fail if `MODERATOR_IDS` is missing or empty. If the environment variable is accidentally omitted, the moderation bot would deploy successfully but all moderation commands would fail authorization checks silently, with no clear indication why.

Additionally, individual moderator IDs parsed from the comma-separated list are not validated as valid Discord Snowflake format.

## Evidence
```typescript
// apps/moderation-worker/src/index.ts (lines 54-69)
if (!startupValidationDone) {
  startupValidationDone = true;
  const validation = presetApi.validateSecurityConfig(c.env);

  if (validation.errors.length > 0) {
    console.error('Security configuration errors:', validation.errors);
    // Does NOT return error response or throw - continues processing
  }
}
```

## Impact
- Misconfigured deployment could silently disable all moderation functionality
- Invalid moderator IDs would never match, effectively locking out all moderators
- Low practical risk: would be caught quickly by moderators unable to use commands

## Recommendation
1. Hard-fail startup validation for critical secrets (MODERATOR_IDS, DISCORD_PUBLIC_KEY)
2. Validate each moderator ID matches snowflake format at startup
3. Log the count of valid moderator IDs for operational awareness
4. Return 503 Service Unavailable if critical config is missing

## References
- [CWE-284](https://cwe.mitre.org/data/definitions/284.html)
