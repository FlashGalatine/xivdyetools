# [REFACTOR-001]: Environment Variable Validation Centralization

## Priority
MEDIUM

## Category
Maintainability

## Location
- File(s): `apps/discord-worker/src/utils/env-validation.ts`, `apps/presets-api/src/utils/env-validation.ts`, `apps/oauth/src/utils/env-validation.ts`
- Scope: All worker applications

## Current State
Each worker application has its own `env-validation.ts` module with similar but slightly different validation logic. The pattern is consistent (validate required vars, return errors/warnings), but the implementation is duplicated across 3+ workers. The validation function signatures and return types vary slightly between workers.

## Issues
- Code duplication across workers
- Inconsistent validation strictness (some workers hard-fail in production, others don't)
- Adding a new validation pattern requires changes in multiple files
- No shared testing of the validation framework itself

## Proposed Refactoring
Create a shared `@xivdyetools/env-validation` utility (or add to an existing package like `@xivdyetools/auth`) that provides:

```typescript
// Shared validation builder
const validator = createEnvValidator({
  required: ['DISCORD_PUBLIC_KEY', 'JWT_SECRET'],
  requiredInProduction: ['BOT_SIGNING_SECRET'],
  optional: ['LOG_LEVEL'],
  format: {
    DISCORD_PUBLIC_KEY: /^[a-f0-9]{64}$/,
    MODERATOR_IDS: /^(\d{15,21})(,\s*\d{15,21})*$/,
  },
});

const result = validator.validate(env);
```

## Benefits
- Single source of truth for validation patterns
- Consistent behavior across all workers
- Easier to add Discord Snowflake format validation (see FINDING-002)
- Shared tests cover all workers

## Effort Estimate
LOW

## Risk Assessment
Low risk - purely internal refactoring with no external API changes
