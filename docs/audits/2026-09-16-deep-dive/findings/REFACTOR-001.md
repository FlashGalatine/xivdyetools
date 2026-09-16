# REFACTOR-001: Delete the unreachable legacy `navigate-to-tool` context-action branches in Swatch and Mixer (and their success toasts)
**Priority:** P2 · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** web-app

## Location
- `apps/web-app/src/components/swatch-tool.ts:2373-2416`, `mixer-tool.ts:2014-2077` — `case 'add-comparison'` … dispatch `new CustomEvent('navigate-to-tool')` that no listener handles
- `apps/web-app/src/components/v4/result-card.ts:100-118,1099,1177` — the emitter's `ContextAction` vocabulary is `inspect-*` / `transform-*` / `external-*` / `add-mixer-slot-*` only

## Evidence
- Reviewer row `webapp-tools-a-01` graded this HIGH as a live no-op; the Opus pass and the coordinator's re-check found it unreachable — dead code, not a defect (`evidence/verifier-pass.md`)
- `git grep navigate-to-tool apps/web-app/src` → 9 dispatch sites, 0 listeners

## Fix
- Remove the branches, the dispatches and the `navigate-to-tool` string; route anything still wanted through `@shared/tool-handoff`; the dead-code gate did not see this because the code is reachable by type

## Status
OPEN
