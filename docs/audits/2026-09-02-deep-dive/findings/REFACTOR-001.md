# REFACTOR-001: moderation-worker keeps a full private fork of discord-worker's Discord plumbing (~24 exported symbols, 4 files)
**Priority:** MEDIUM · **Effort:** MEDIUM · **Risk:** MEDIUM (touches every moderation command path) · **Deploy unit:** `moderation-worker` (primary), `@xivdyetools/bot-logic` (destination), `discord-worker` (secondary)

## Location
- `apps/moderation-worker/src/utils/response.ts` (290 lines) vs `apps/discord-worker/src/utils/response.ts` (165) — `deferredResponse`, `ephemeralResponse`, `messageResponse`, `pongResponse`, `errorEmbed`, `successEmbed`, `MessageFlags`.
- `apps/moderation-worker/src/utils/discord-api.ts` (190) vs `apps/discord-worker/src/utils/discord-api.ts` (362) — `editOriginalResponse`, `editMessage`, `sendMessage`.
- `apps/moderation-worker/src/services/i18n.ts` (116) vs `apps/discord-worker/src/services/i18n.ts` (133) — `LocaleCode`, `SUPPORTED_LOCALES`, `discordLocaleToLocaleCode`, `resolveUserLocale`, `isValidLocale`.
- `apps/moderation-worker/src/services/preset-api.ts` (449) vs `apps/discord-worker/src/services/preset-api.ts` (495) — `PresetAPIError`, `getPreset`, `getPresets`, `getPendingPresets`, `searchPresetsForAutocomplete`, `isModerator`, `STATUS_DISPLAY`.

## Evidence
- `evidence/cross-unit-dupes.txt`: 24 exported symbols are defined in both bot workers. `evidence/fork-diffs.txt`: 1,063 changed lines across the four files above (368 / 174 / 107 / 414).
- The fork has already produced one user-visible defect — [[BUG-001]], where only one copy learned about `prefs:v1:`. `apps/discord-worker/src/services/preset-api.ts:200-204` carries the scar of an earlier one: BUG-073 of the 2026-07-18 audit, where the two `isModerator` copies disagreed on separators until both were pointed at `bot-logic`'s `parseModeratorIds`.
- `moderation-worker/src/services/i18n.ts:36` redeclares `LocaleCode` as a local union instead of importing `@xivdyetools/bot-logic/i18n`'s. Structural typing hides this: adding a seventh locale to the shared type would compile clean here and silently exclude it.
- The destination already exists and is already used by this worker — `@xivdyetools/bot-logic` supplies `parseModeratorIds`/`isModeratorId` to both bots today.

## Fix
- Move the locale layer first (`LocaleCode`, `SUPPORTED_LOCALES`, `discordLocaleToLocaleCode`, `isValidLocale`, `resolveUserLocale`) into `@xivdyetools/bot-logic/i18n`, which also fixes [[BUG-001]] at the class rather than the instance.
- Then the response builders and the Discord REST helpers; leave `preset-api.ts` last, since the two clients genuinely diverge (moderation reads the queue, the main bot reads public presets).
- Needs a `bot-logic` publish before either worker deploys — schedule as two sprints.

## Status
OPEN
