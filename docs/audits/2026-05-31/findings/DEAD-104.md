# DEAD-104: shared/constants.ts — unused constants (continuation of DEAD-012)

## Category
Unused Export

## Location
- File(s): `src/shared/constants.ts`
- Symbol(s): `KEYBOARD_SHORTCUTS`, `THEME_DISPLAY_NAMES`, `VISION_TYPE_LABELS`, `BRETTEL_MATRICES`, `CARD_CLASSES`,
  `DEBOUNCE_DELAYS`, `MAX_DYES_ACCESSIBILITY`, `MAX_DYES_COMPARISON`, `THEME_COUNT`, `APP_DESCRIPTION`, … (the open remainder)

## Evidence
**This is a continuation of 2026-02-28 finding DEAD-012** ("~30 Unused Constants in shared/constants.ts"), which was marked
**REMOVE** but **never executed** — the constants are still present today (verified by grep):
```
KEYBOARD_SHORTCUTS   : present in constants.ts
THEME_DISPLAY_NAMES  : present
VISION_TYPE_LABELS   : present
BRETTEL_MATRICES     : present
MAX_DYES_COMPARISON  : present
```
The current symbol sweep re-confirms these have no production references. Reconcile the exact removable set against the table in
`../2026-02-28/findings/DEAD-012.md` (some entries there may since have become used — re-check each).

⚠️ Heuristic — confirm with `tsc --noEmit`.

## Why It Exists
Centralised constants added during v3; the v4 components inline or no longer need them. DEAD-012 flagged them in February; the
removal was deferred and the constants outlived another release cycle.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM-HIGH — re-confirmed unused; but BRETTEL_MATRICES / VISION_TYPE_LABELS relate to the accessibility tool — double-check it doesn't read them |
| **Blast Radius** | LOW — internal only |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Verify the accessibility tool computes its own matrices (via `@xivdyetools/core`) rather than these |

## Recommendation
**REMOVE** — after reconciling against DEAD-012 and tsc confirmation

### Rationale
- ~200 lines (per DEAD-012's own estimate) of unused constants finally removed.

### If Removing
1. Cross-check each constant against `DEAD-012`'s list; drop those still unreferenced.
2. `pnpm --filter xivdyetools-web-app run type-check && run test`.
3. Mark DEAD-012 as resolved in the prior audit's tracking (optional).
