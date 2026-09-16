# REFACTOR-002: `/preset` notification helpers never receive the request logger, so their failures log nowhere
**Priority:** P3 · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** discord-worker

## Location
- `apps/discord-worker/src/handlers/commands/preset.ts:571,576,924` — three `notify*` calls without `logger`

## Evidence
- Reviewer row `discord-handlers-04`

## Fix
- Thread the logger through; assert a `warn` on a failed send

## Status
OPEN
