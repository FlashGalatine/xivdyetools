# DEAD-087: preset-detail-view.ts (v3 Preset Detail)

## Category
Orphaned File

## Location
- File(s): `src/components/preset-detail-view.ts` (453 lines)
- Symbol(s): `PresetDetailView` class

## Evidence
Not reached from `main.ts` by any import path; no test imports it. Superseded by `src/components/v4/preset-detail.ts`
(first added 2026-02-18), which the v4 preset tool renders. It imports `getCategoryIcon`/`ICON_ARROW_BACK` from
`@shared/category-icons`, but those are also imported by the live v4 detail view, so category-icons stays (see DEAD-106).

- Git: last meaningful commit **2026-03-01**; frozen since the v4 migration.

## Why It Exists
The v3 preset detail screen. Replaced by `v4/preset-detail.ts` in the v4 redesign; the v3 version was left behind.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero importers; live replacement is `v4/preset-detail.ts` |
| **Blast Radius** | NONE — isolated |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- 453 lines removed; part of the v3 preset-stack cleanup (with DEAD-086, DEAD-088).

### If Removing
1. Delete `src/components/preset-detail-view.ts`.
2. `pnpm --filter xivdyetools-web-app run type-check && run test`.
