# FINDING-001: oauth persists every XIVAuth user's full FFXIV character roster (names, worlds, Lodestone ids) with no reader, no retention and no disclosure
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** oauth · **Rotation:** NONE · **CWE:** CWE-359 (privacy violation), CWE-1258 (unnecessary data retention)

## Location
- `apps/oauth/src/handlers/xivauth.ts:345-355` — every XIVAuth login maps `characters[]` (lodestone_id, name, home_world, verified — unverified included) and calls `storeCharacters` "(for future features)"
- `apps/oauth/src/services/user-service.ts:259-281` — `storeCharacters` deletes + re-inserts all rows into `xivauth_characters`; `:283-298` `getCharacters` has **zero** non-test callers
- `apps/oauth/schema/users.sql` — `xivauth_characters` table (no TTL, no purge)

## Evidence
- `git ls-files 'apps/*/src/*.ts' 'packages/*/src/*.ts' | xargs grep -n 'getCharacters\|xivauth_characters'` → only the definition, the store call and a test mock; nothing reads the table.
- `apps/web-app/PRIVACY.md` ("Character files", "Community presets") never mentions a character roster; there is no retention row and no deletion path for web users (the bot policy's §7 covers bot data only).
- The JWT already carries the one `primary_character` the app uses (see FINDING-002), so the table serves no live feature.

## Fix
- Stop calling `storeCharacters`; drop (or truncate) `xivauth_characters` in a migration; delete `getCharacters`. If a future feature needs the roster, collect it then, minimally, and disclose it first.

## Status
CODE FIXED 2026-08-30 cdd53fbf (oauth 3.0.0) — `storeCharacters`/`getCharacters` deleted, the roster is read in memory and never persisted; `schema/users.sql` no longer defines `xivauth_characters`. **Remains OPEN until the hand-run migration `apps/oauth/migrations/0001_drop_xivauth_characters.sql` is applied after the 3.0.0 deploy** (drops the table and its historical rows) — see the plan's Sprint 2 *Ends with* and `POST_MERGE_CHECKLIST.md`.
