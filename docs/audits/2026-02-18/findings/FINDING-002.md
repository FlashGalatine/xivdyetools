# [FINDING-002]: Discord Snowflake Format Not Validated

## Severity
LOW

## Category
CWE-20: Improper Input Validation

## Location
- File: `apps/discord-worker/src/index.ts` (userId extraction)
- File: `apps/moderation-worker/src/index.ts` (lines 181, 245)
- File: `apps/presets-api/src/middleware/auth.ts` (moderator ID parsing)

## Description
User IDs extracted from Discord interactions are used for rate limiting, authorization checks, and database operations without validating that they conform to the Discord Snowflake format (`/^\d{15,21}$/`). While Discord itself provides valid snowflakes, a compromised or replayed interaction body (after signature verification) could theoretically contain a malformed userId.

Additionally, moderator IDs parsed from environment variables use flexible splitting (`split(/[\s,]+/)`) without validating individual IDs are valid snowflakes.

## Evidence
```typescript
// apps/moderation-worker/src/index.ts (line 181)
const userId = interaction.member?.user?.id ?? interaction.user?.id;

if (!userId) {
  // Only checks for presence, not format
  logger.error('Unable to identify user from interaction');
  return ephemeralResponse('Unable to identify user.');
}

// Rate limit key uses raw userId without format validation
const rateLimitCheck = await checkRateLimit(env.KV, userId, 'command', ...);
```

## Impact
- A non-snowflake userId string used as a rate limit key could cause cache key collisions or bypass per-user limits
- Invalid moderator IDs in environment config would silently fail authorization checks
- Low practical risk because Discord request verification (Ed25519) prevents tampering with interaction bodies

## Recommendation
1. Add a utility function: `isValidSnowflake(id: string): boolean => /^\d{15,21}$/.test(id)`
2. Validate userId after extraction in all workers
3. Validate moderator IDs at startup in `validateSecurityConfig()`

## References
- [Discord Snowflake Format](https://discord.com/developers/docs/reference#snowflakes)
- [CWE-20](https://cwe.mitre.org/data/definitions/20.html)
