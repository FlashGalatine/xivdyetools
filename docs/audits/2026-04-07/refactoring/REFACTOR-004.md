# REFACTOR-004: `DiscordSnowflake` Branded Type Not Adopted by Callers

- **Priority:** LOW
- **Effort:** LOW
- **Category:** Type Safety
- **File:** `packages/types/src/auth/discord-snowflake.ts:29`

## Description

The `@xivdyetools/types` package defines a `DiscordSnowflake` branded type with validation (`isValidSnowflake()`) and a type guard (`assertSnowflake()`). However, it's marked `@internal` and no consumer uses it.

Throughout the codebase, Discord user IDs are typed as plain `string`:
- `presets.author_discord_id: string`
- `banned_users.discord_id: string`
- Auth middleware `userId: string`

## Impact

Without the branded type, invalid snowflake strings (e.g., empty string, non-numeric) can flow through the system without compile-time detection. Runtime validation catches these, but branded types would provide earlier, compile-time safety.

## Recommendation

1. Remove `@internal` from `DiscordSnowflake`
2. Gradually adopt in type definitions:
   ```typescript
   interface CommunityPreset {
     author_discord_id: DiscordSnowflake;  // was: string
   }
   ```
3. Use `assertSnowflake()` at system boundaries (env validation, API input)

This is a progressive improvement — don't change everything at once.

## Effort

LOW — Incremental adoption; no runtime changes needed.
