# FINDING-019: `/preferences set world:` accepts any string (up to Discord's 6000 chars) and `/budget` forwards the stored value unvalidated to the Universalis proxy and the Cache API key (residual of 2026-08-21/FINDING-033)
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **CWE:** CWE-20
Supersedes the "not done" item of `2026-08-21-security/FINDING-033`.

## Location
- `apps/discord-worker/src/services/preferences.ts:374-380` — `world`: any non-empty string ("we accept any non-empty string"); `src/schemas.ts:656-662` — no `max_length`
- `apps/discord-worker/src/handlers/commands/budget.ts:129-139` — `resolveWorld` validates only the explicit override; `prefs.world` is returned as-is → proxy query + cache key

## Evidence
- `apps/discord-worker/src/handlers/commands/budget.test.ts:145` pins the unvalidated path; the 2026-08-21 FINDING-033 Status lists it as not done.

## Fix
- `validateWorld` on set and on read; `max_length: 32` in the command schema.

## Status
OPEN
