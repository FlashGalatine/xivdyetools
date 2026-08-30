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
FIXED 2026-08-30 dfc6de47 (discord-worker 5.1.0: `max_length: 32` on all four `world` options; sync guard 1–32 trimmed characters and no control characters (non-Latin names allowed); `/preferences set world:` validates through `validateWorld` and stores the canonical name; `resolveWorld` validates a stored world on read — a non-resolving one gets the existing unknown-world reply; `budget.test.ts:145` flipped to assert validation.)
