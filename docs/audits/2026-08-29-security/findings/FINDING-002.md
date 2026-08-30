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
PARTIAL — code half FIXED 2026-08-30 cdd53fbf (oauth 3.0.0): `users.avatar_url` no longer written (dropped by migration 0001), the JWT mints only `sub, iat, exp, iss, jti, username, global_name, avatar, auth_provider, discord_id` — no `orig_iat`, `xivauth_id` or `primary_character` — and the XIVAuth response carries no character. Ruling R1: the sign-in `users` row stays (it is the identity behind `sub`); the web-guide disclosure of that record, the deletion route and the sign-in copy landed 2026-08-30 114f6dde (web-app: the sign-in modal states in all six locales that signing in creates an account record — provider ID + username; PRIVACY.md says the record is created at sign-in, not first submission, and points deletion requests at the contact route; the dead `primary_character` readers in auth-service are gone). FINDING-002 is now CLOSED across both units (the `@xivdyetools/types` optional field itself goes in Sprint 11).
