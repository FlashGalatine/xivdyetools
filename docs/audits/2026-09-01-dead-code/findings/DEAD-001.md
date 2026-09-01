# DEAD-001: web-app `dye-action-dropdown.ts` — a 570-line component no production file imports, kept alive by eight test files that mock it — 570 lines + 383-line test + 7 dead `vi.mock` blocks

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE (app-internal) · **Category:** Orphaned File

## Location
- `apps/web-app/src/components/dye-action-dropdown.ts:1-570` — exports `createDyeActionDropdown`, `DyeAction`, `DyeActionCallback`
- `apps/web-app/src/components/__tests__/dye-action-dropdown.test.ts` — 383 lines, the only file that exercises it
- Seven tool test files (`accessibility|budget|comparison|extractor|gradient|mixer|swatch-tool.test.ts`) carry a `vi.mock('../dye-action-dropdown', …)` block for a module their subject never imports

## Evidence
- `git ls-files apps/web-app | xargs grep -ln "dye-action-dropdown"` → 9 files: the module, its own test, and 7 tool tests. **Zero production importers**; `services/index.ts` does not re-export it.
- No dynamic reach either: the web-app's `import()` sites (`v4-layout.ts:585-682`, the modal loaders) name nine tools and five modals — none is this module. No `.html`/CSS reference beyond its own `container.className`.
- Invisible to the existing gates by construction: knip treats test files as entries, so a module imported only by tests is "used"; `evidence/scripts/test-only-modules.sh` is the scan that surfaces this tier.

## Fix
**REMOVE.** `git rm apps/web-app/src/components/dye-action-dropdown.ts apps/web-app/src/components/__tests__/dye-action-dropdown.test.ts`; delete the seven `vi.mock('../dye-action-dropdown', …)` blocks (2 matching lines each); re-grep `createDyeActionDropdown` immediately before deleting; web-app CHANGELOG `### Removed`. Coverage will move — this module is fully covered today, so expect the aggregate to drop (report the ratchet, do not lower web-app's 71/55/65/72).
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` + `pnpm --filter xivdyetools-web-app run build:check`.

## Status
FIXED 2026-09-01 `c89a822c` — module, its test and the seven dead `vi.mock` blocks removed; the 17 `harmony.*` locale keys it owned went with it (the orphan gate caught them).

