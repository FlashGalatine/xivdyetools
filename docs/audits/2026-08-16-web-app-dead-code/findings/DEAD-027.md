# [DEAD-027]: `e2e/example.spec.ts` — Playwright scaffold hitting playwright.dev

## Category
Stale Test

## Location
- `apps/web-app/e2e/example.spec.ts` (586 B, 2 tests)

## Evidence
- `example.spec.ts`: both tests `page.goto('https://playwright.dev/')` and assert on Playwright's own docs site. Tests nothing in this app, adds an **external network dependency** to every `test:e2e` run, and is collected by all three projects (`chromium`, `chromium-coverage`, `mobile-chrome`) because `playwright.config.ts` has no `testMatch`.
- **Correction (Wave 1 execution):** the verification pass reported `toolSwitcher`, `activeToolControl`, `closePaletteDrawer` in `e2e/fixtures/navigation.ts` as unused. Re-checked before deletion — **all three are live**: `ui-interactions.spec.ts:35,63,72,281`, `preset-browser.spec.ts:7,58`, `accessibility-checker.spec.ts:7,243,278`. Kept. All 9 fixture exports are used.
- Skips: zero across all 11 specs (`test.skip`/`describe.skip`/`fixme`/`.only` → 0; the prior audit's DEAD-007 skipped suites were deleted in `7bbbe5e`). No stale spec — every spec has resolving selectors; the zero-match selectors found are all the redundant arm of a comma-OR.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None. |

## Recommendation
**REMOVE**

### If Removing
1. `git rm apps/web-app/e2e/example.spec.ts`
2. `pnpm --filter xivdyetools-web-app run test:e2e -- --list` to confirm the scaffold no longer appears
