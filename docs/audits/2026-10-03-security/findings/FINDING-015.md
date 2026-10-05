# FINDING-015: preferences.ts resetPreference leaves the legacy i18n:user:<id> and budget:world:v1:<id> KV keys, so a reset language or world is re-migrated (or read through the locale fallback) and never deleted
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-459
**Reconcile case:** 1 (Step 3a)

## Location
- apps/discord-worker/src/services/preferences.ts:313-317 — a full reset runs only `kv.delete(buildPrefsKey(userId))`. A single-key reset rewrites the blob, or deletes it when that was the last key (:331-336)
- apps/discord-worker/src/services/preferences.ts:127-128,502,519-543 — if there is no prefs:v1 blob, getUserPreferences calls migrateLegacyPreferences. That reads both legacy keys and writes them back into prefs:v1 ('Legacy keys are NOT deleted')
- packages/bot-logic/src/i18n/locale-resolution.ts:141-166 — resolveUserLocale falls back to the legacy i18n:user:<id> key (step 2) whenever the blob has no language, so even `/preferences reset key:language` does not take effect

## Evidence
- preferences.ts:314-317: `if (!key) { await kv.delete(buildPrefsKey(userId)); return true; }`. The /preferences reset handler (handlers/commands/preferences.ts:505) calls only this function and deletes no other keys
- `git grep -n "i18n:user:\|budget:world:v1"` over the source finds only readers (preferences.ts:519,526; locale-resolution.ts:71; moderation-worker i18n.ts reader). The writers were removed in 45c8d3c6/0a147474 (Mar 2026). They had called `kv.put(...)` with no expirationTtl, so the old keys stay in KV indefinitely
- PRIVACY_POLICY.md:146 says '/preferences reset to reset all your preferences', and :28 gives Preferences a retention of 'Until you reset them or request deletion'. In practice, a v4-era user who resets gets the home world and language back on their next command

## Fix
- In resetPreference, also run `kv.delete` on `i18n:user:<id>` and `budget:world:v1:<id>` for a full reset, and on the matching legacy key when a single reset targets language or world
- Better: delete the legacy keys inside migrateLegacyPreferences once the prefs:v1 write succeeds. Then remove the legacy step from resolveUserLocale, and the moderation-worker getUserLanguagePreference reader, once a backfill has run
- One-off maintenance: list the `i18n:user:` and `budget:world:v1:` KV prefixes, migrate any users who have no prefs:v1 blob, then delete every legacy key so none remain

## Status
FIXED 2026-10-03 — `28769473`, PR #222 merged as `8ecb878f` (discord-worker 5.7.2). The one-off clean-up of untouched legacy keys is the maintainer's (`docs/operations/OPEN_ITEMS.md` §2).
