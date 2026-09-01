# DEAD-002: web-app `tooltip-service.ts` — v2.1-era tooltip system superseded by native `title=`; nothing imports it, but `services/index.ts` still logs "TooltipService ready" — 475 lines + 868 test lines + 77 lines of CSS it is the sole consumer of

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE (app-internal) · **Category:** Orphaned File

## Location
- `apps/web-app/src/services/tooltip-service.ts:1-475` — `TooltipService` (9 public methods), `TooltipConfig`, `TooltipPosition`
- `apps/web-app/src/services/__tests__/tooltip-service.test.ts` (438) + `tooltip-service-branches.test.ts` (430)
- `apps/web-app/src/services/index.ts:86-87` — `// TooltipService is static singleton, always ready` / `logger.info('✅ TooltipService ready')` with **no import of the module**
- `apps/web-app/src/styles/globals.css:444-520` — `.tooltip-container`, `.tooltip`, `.tooltip-visible`, `.tooltip-arrow` and the four `[data-position]` variants (77 lines), whose only consumer is the dead service

## Evidence
- `evidence/test-only-modules.sh` → `prodImporters=0 testImporters=2`. `evidence/members.txt`: all five behavioural methods (`attach`, `updateContent`, `detachAll`, `startOrphanCleanup`, `stopOrphanCleanup`) have `extSrc=0 unitSrc=0` — every reference is a test.
- The live tooltip mechanism is the native `title=` attribute: `v4/config-sidebar.ts:1059,1076`, `mixer-tool.ts`, `v4-color-wheel.ts`, `tutorial-spotlight.ts`. `services/index.ts`'s startup line is the only trace of the old system and it reports readiness for something that is never constructed.
- The CSS cascade: `git ls-files apps/web-app | xargs grep -ln "tooltip-container\|tooltip-arrow\|tooltip-visible"` → the service and its two tests, nothing else. (`tutorial-spotlight.ts:109` sets `role: 'tooltip'` — an ARIA role, not the class.) This is why the general dead-CSS scan does not flag the block: a dead module counts as a consumer.

## Fix
**REMOVE.** `git rm` the module and both test files; delete the two `services/index.ts` lines (the log is false today); delete `globals.css:444-520` in the same commit; web-app CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app`.

## Status
FIXED 2026-09-01 `c89a822c` — module, both tests, the false "TooltipService ready" log and the 77-line `.tooltip*` block in `globals.css` removed.

