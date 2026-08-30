# FINDING-008: bot privacy policy drift — a permanent `firstrun:v5:{userId}` KV flag and the preset-favourites record are undisclosed, and the access/deletion instructions cite commands removed in 5.0
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **CWE:** CWE-359

## Location
- `apps/discord-worker/src/index.ts:609-622` — `env.KV.put('firstrun:v5:' + userId, '1')` for every user, no TTL, no test
- `apps/discord-worker/src/services/preset-favorites.ts:21-34` — `xivdye:preset_favorites:v2:{userId}` record
- `apps/discord-worker/PRIVACY_POLICY.md:26-27,63,73-74,117-126` — "Favorite Dyes"/"Collections" rows and the §7 self-service steps reference `/favorites`, `/collection`, `/match_image` (all `REMOVED_IN_V5`, `handlers/commands/about.ts:67`); the KV row at `:88` omits firstrun and preset favourites

## Evidence
- Policy "Last Updated" is 2026-08-29 (Tier A analytics amendment) yet a user following §7 cannot exercise access/deletion, and two live records are not listed.

## Fix
- Put a TTL on the first-run flag (or fold it into `prefs:v1`); list preset favourites, the first-run flag and the actual preference fields in §2/§5/§8; replace the removed commands with the live ones (`/preset favorite …`, `/preferences reset`).

## Status
FIXED 2026-08-30 2041ac39, 886d46a1, f5d5f596 (discord-worker 5.1.0: `firstrun:v5:*` carries a 180-day `expirationTtl`; PRIVACY_POLICY.md lists preset favorites, the first-run flag and all 16 preference fields, states where rate-limit counters live, cites the live commands (`/preferences show|reset`, `/preset favorite list|remove`, `/extractor image`) and no longer references any removed feature; §4 "Save your preferences" row corrected in 1a0cf89f.)
