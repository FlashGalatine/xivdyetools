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
FIXED — code 2026-08-30 cdd53fbf (oauth 3.0.0) — `storeCharacters`/`getCharacters` deleted, the roster is read in memory and never persisted; `schema/users.sql` no longer defines `xivauth_characters`. **FULLY FIXED 2026-09-01** — the hand-run migration was applied to production after the 3.0.0 deploy went live with the merge of PR #152 (`15695107`). `xivauth_characters` held **5 rows** at the time; the table and `users.avatar_url` are both gone. Verified as the migration header specifies: `SELECT COUNT(*) FROM xivauth_characters` now errors with *no such table*, and `PRAGMA table_info(users)` lists `id, discord_id, xivauth_id, auth_provider, username, created_at, updated_at` and no `avatar_url`. oauth answers `/health` 200 and `/auth/me` 401 (not 500) against the new schema, which is what shows the 3.0.0 code genuinely never reads the dropped column.

Applied statement-by-statement with `d1 execute --command` rather than `--file`: the D1 bulk-`/import` endpoint was returning `Authentication error [code: 10000]` for this database while the query endpoint authenticated normally on the same OAuth credentials and the same wrangler 4.126.0 that had applied presets-api `0012`/`0013` hours earlier. The migration is two statements, so the file's own ordering was preserved exactly. **The rollback trap still stands: do not roll oauth below 3.0.0.**
