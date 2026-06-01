# DEAD-094: theme-switcher.ts (v3, test-only)

## Category
Stale Test Code / Orphaned-in-Production

## Location
- File(s): `src/components/theme-switcher.ts` (278 lines),
  `src/components/__tests__/theme-switcher.test.ts` (261 lines)
- Symbol(s): `ThemeSwitcher` class

## Evidence
Only its own test imports the source (`__tests__/theme-switcher.test.ts:22: import { ThemeSwitcher } from '../theme-switcher'`).
No production module imports it. Theme selection in v4 is handled by `v4/theme-modal.ts` (opened from the config sidebar).
The underlying `services/theme-service.ts` remains live and is unaffected.

- Git: last meaningful commit **2026-02-18** (frozen at the migration commit).

## Why It Exists
The v3 inline theme-switcher button. The v4 redesign moved theme selection into a modal (`v4/theme-modal.ts`).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is its own test; live replacement is `v4/theme-modal.ts` |
| **Blast Radius** | NONE — `theme-service.ts` is separate and stays |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — no `<theme-switcher>` tag in any prod template |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 539 lines removed (278 source + 261 test).

### If Removing
1. Delete `src/components/theme-switcher.ts` and its test.
2. Confirm `services/theme-service.ts` is untouched.
3. `pnpm --filter xivdyetools-web-app run test && run type-check`.
