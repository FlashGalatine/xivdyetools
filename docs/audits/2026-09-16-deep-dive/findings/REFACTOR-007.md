# REFACTOR-007: `config-sidebar` carries a dead field-initializer default (`tetradic`/false) that disagrees with the real default (`complementary`/true)
**Priority:** P3 · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** web-app

## Location
- `apps/web-app/src/components/v4/config-sidebar.ts:147-156` vs `shared/tool-config-types.ts:419-428`

## Evidence
- Reviewer row `webapp-v4-23`; harmless today, a trap for the next edit

## Fix
- Initialise from `DEFAULT_TOOL_CONFIGS` or delete the initializer

## Status
OPEN
