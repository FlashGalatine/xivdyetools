# FINDING-002: identity row (username, avatar URL) written on every sign-in — not only on submission as the web privacy guide says — and the JWT carries an unverified character name the sign-in copy denies
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** oauth (+ web-app copy) · **Rotation:** NONE · **CWE:** CWE-359

## Location
- `apps/oauth/src/handlers/callback.ts:222-228` (Discord) and `apps/oauth/src/handlers/xivauth.ts:333-343` (XIVAuth) — `findOrCreateUser` persists `discord_id`/`xivauth_id`/`username`/`avatar_url` on every sign-in; `users.avatar_url` is write-only (responses recompute it from the id)
- `apps/oauth/src/services/jwt-service.ts:130-141`, `xivauth.ts:357-369` — JWT claims include `xivauth_id` (no consumer) and `primary_character {name, server, verified}` even when `verified: false`; presets-api reads only `sub`/`discord_id`/`username`/`global_name` (`apps/presets-api/src/middleware/auth.ts:31-48`)
- `apps/web-app/src/locales/en.json:1072` (sign-in modal) — "No character data"; `apps/web-app/src/services/auth-service.ts:459-464` token in `localStorage`, `:493-496` character name logged (DEV-only logger)

## Evidence
- `apps/web-app/PRIVACY.md` "Community presets": "the account identity you sign in with is stored with the presets and votes you submit" — a user who signs in and never submits still gets a `users` row, and the guide offers no deletion route (the bot policy §7 offers one for bot data only).

## Fix
- Create the `users` row lazily on first submission/vote (or document the sign-in record + add a deletion route to the web guide); drop `avatar_url` and unverified `primary_character` from storage/claims — mint only what presets-api reads; correct the sign-in copy.

## Status
OPEN
