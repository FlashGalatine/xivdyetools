# REFACTOR-003: Environment Validation Duplication; Snowflake Regex Not Centralized

- **Priority:** LOW
- **Effort:** LOW
- **Category:** Code Duplication
- **Files:**
  - `apps/discord-worker/src/utils/env-validation.ts`
  - `apps/presets-api/src/utils/env-validation.ts`
  - `apps/oauth/src/utils/env-validation.ts`
  - `apps/moderation-worker/src/utils/env-validation.ts`
  - `packages/types/src/auth/discord-snowflake.ts` — Centralized `isValidSnowflake()`

## Description

Each worker's `env-validation.ts` independently validates Discord snowflake IDs using the regex `/^\d{17,20}$/`. Meanwhile, `@xivdyetools/types` provides a centralized `isValidSnowflake()` function and `DiscordSnowflake` branded type that encapsulates this validation.

The branded type is marked `@internal` and documented as "not yet adopted" (discord-snowflake.ts:29). Env validation files don't import it.

## Impact

- Snowflake validation logic duplicated in 4+ files
- If Discord ever changes snowflake format (unlikely but possible), all copies must update
- The centralized `isValidSnowflake()` function goes unused

## Recommendation

1. Remove `@internal` annotation from `DiscordSnowflake`
2. Replace inline regex with `isValidSnowflake()` in env-validation files:

```typescript
// Before:
if (!/^\d{17,20}$/.test(env.DISCORD_CLIENT_ID)) { ... }

// After:
import { isValidSnowflake } from '@xivdyetools/types';
if (!isValidSnowflake(env.DISCORD_CLIENT_ID)) { ... }
```

## Effort

LOW — Find-and-replace inline regex with function call; publish updated `@xivdyetools/types`.
