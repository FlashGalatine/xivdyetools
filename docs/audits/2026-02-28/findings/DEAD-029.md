# DEAD-029: Legacy KV Preference Functions in i18n.ts

## Category
Legacy Code

## Location
- `apps/discord-worker/src/services/i18n.ts`:
  - `setUserLanguagePreference()` (~15 lines)
  - `clearUserLanguagePreference()` (~10 lines)

## Evidence
- Neither function is imported by any production code.
- The unified `preferences.ts` service now handles all user preferences (including language) via `setPreference()` and `clearPreference()`.
- `preferences.ts` includes explicit migration logic for the old `lang:v1:{userId}` keys that these functions wrote.
- The comment in `i18n.ts` notes: "Legacy - prefer unified preferences".

## Why It Exists
These were the original language preference setters using the `lang:v1:{userId}` KV key pattern. The unified preferences system (DEAD-020's `user-preferences.ts` is the *older* version; `preferences.ts` is the current one) superseded them.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — superseded and unused |
| **Runtime Impact** | NONE — preferences.ts handles the migration |
| **Build Impact** | Removes ~25 lines |
| **External Consumers** | None |

## Recommendation
**REMOVE** both functions from `i18n.ts`. The migration path in `preferences.ts` handles reading old keys, so no data loss risk.
