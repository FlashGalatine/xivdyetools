# FINDING-018: discord-worker logs the Discord user id in lines PRIVACY_POLICY §5 does not name: the preferences-migration info line (preferences.ts:546) and the preset-favorite failure lines (preset-favorites.ts:96/160/189)
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-532
**Reconcile case:** 1 (Step 3a) · **Scope:** discord-worker only. The same pattern in moderation-worker is not filed: it re-files the 2026-09-15 rejected suspicion "Discord pseudonymous IDs in logs", and the 2026-09-16 §5 sentence describes the Bot only.

## Location
- apps/discord-worker/src/services/preferences.ts:546 — logger.info('Migrated legacy preferences to unified format', { userId, keys }); reached via getUserPreferences(..., logger) from /harmony, /mixer and /preferences
- apps/discord-worker/src/services/preset-favorites.ts:99,160,189 — error logs with { userId } and { userId, presetId } in getPresetFavoriteEntries / addPresetFavorite / removePresetFavorite
- apps/discord-worker/PRIVACY_POLICY.md:118 — 'Two of them include your Discord User ID — one when a command starts, one when a command is rate limited'

## Evidence
- preferences.ts:545-549: `logger.info('Migrated legacy preferences to unified format', { userId, keys: Object.keys(prefs) });`
- preset-favorites.ts:186-189: `logger.error('Failed to remove preset favorite', error..., { userId, presetId });`. The same shape is at 157-160 (add) and 96-99 ({ userId }); callers are preset.ts:1238/1314/1371 and index.ts:1264 (autocomplete), each passing the request logger
- packages/logger/src/constants.ts CORE_REDACT_FIELDS has no userId entry, so the field is emitted as-is. apps/discord-worker/wrangler.toml has no observability block, so the lines exist only in a live tail

## Fix
- Remove userId from the context objects at preferences.ts:546 and preset-favorites.ts:99/160/189. The request ID already ties a log line to the 'Handling command' line, which the policy does list
- Optionally add a test asserting these service logs carry no userId, so the policy's 'two lines' statement stays true

## Status
OPEN
