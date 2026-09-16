# REFACTOR-003: `/preset submit|edit` schemas document name/description length bounds but set no `min_length`/`max_length`, and autocomplete choice names are never truncated to Discord's 100-char cap
**Priority:** P3 · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** discord-worker

## Location
- `apps/discord-worker/src/commands/schemas.ts:1004-1019,1092-1114` (the `world` option shows the enforced pattern)
- `apps/discord-worker/src/services/preset-api.ts:506-511`, `index.ts:1221-1225,1282`

## Evidence
- Reviewer row `discord-core-02`; the server validates, so today's effect is a worse error path, not a wrong result

## Fix
- Add the bounds to the schema (Discord rejects client-side) and `.slice(0, 100)` choice names

## Status
OPEN
