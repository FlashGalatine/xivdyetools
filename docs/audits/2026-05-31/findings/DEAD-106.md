# DEAD-106: shared/category-icons.ts — over-exported internal constants (file is LIVE)

## Category
Unused Export (over-export, not dead file)

## Location
- File(s): `src/shared/category-icons.ts`
- Symbol(s): `CATEGORY_ICONS`, `ICON_CATEGORY_JOBS`, `ICON_CATEGORY_GRAND_COMPANIES`, `ICON_CATEGORY_SEASONS`,
  `ICON_CATEGORY_EVENTS`, `ICON_CATEGORY_AESTHETICS`, `ICON_CATEGORY_COMMUNITY`, `ICON_CATEGORY_DEFAULT`

## Evidence
**The file is NOT dead.** Its `getCategoryIcon()` (and `ICON_ARROW_BACK`) are imported by live components —
`preset-edit-form.ts:17`, `preset-submission-form.ts:18`, `v4/preset-card.ts:14`, `v4/preset-detail.ts:30`. The symbol sweep
only flagged the individual icon constants and the `CATEGORY_ICONS` map as having no *external* references — because they are
consumed **internally**:
```typescript
// category-icons.ts:99
export const CATEGORY_ICONS: Record<string, string> = { jobs: ICON_CATEGORY_JOBS, … };
// category-icons.ts:112
return CATEGORY_ICONS[name] || ICON_CATEGORY_DEFAULT;   // inside getCategoryIcon()
```
So the `ICON_CATEGORY_*` constants + `CATEGORY_ICONS` are **over-exported** — used only within this file. This is thematically
related to 2026-02-28 DEAD-013/DEAD-014 (unused icon lookups), but here the lookup itself is live.

## Why It Exists
The icon constants were exported individually for potential external reuse that never materialised; only the `getCategoryIcon()`
accessor is consumed externally.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — internal-only consumption confirmed by reading the file |
| **Blast Radius** | NONE — dropping `export` is purely local |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None external (verified) |

## Recommendation
**REFACTOR (de-export), KEEP file** — drop the `export` keyword on the internal constants

### Rationale
- Tightens the module's public surface to just `getCategoryIcon` / `ICON_ARROW_BACK`; no behaviour change.
- Low value — cosmetic. Bundle into the same pass as DEAD-107.

### If Refactoring
1. Remove `export` from `ICON_CATEGORY_*` and `CATEGORY_ICONS` (keep them as local `const`).
2. Remove any of these from the `shared` barrel if re-exported.
3. `pnpm --filter xivdyetools-web-app run type-check`.
