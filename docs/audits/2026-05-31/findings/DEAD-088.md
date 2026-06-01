# DEAD-088: preset-card.ts (v3 Preset Card)

## Category
Orphaned File

## Location
- File(s): `src/components/preset-card.ts` (162 lines)
- Symbol(s): `PresetCard` class

## Evidence
Not reached from `main.ts`; no test imports it. The live preset card is `src/components/v4/preset-card.ts` (first added
2026-02-18). Both files import `getCategoryIcon` from `@shared/category-icons`, so the v3 root-level `preset-card.ts` is the
dead twin.

- Git: last meaningful commit **2026-02-18** (frozen at the migration commit).

## Why It Exists
The v3 preset card. The v4 redesign introduced `v4/preset-card.ts`; the root-level version was orphaned.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero importers; live twin is `v4/preset-card.ts` |
| **Blast Radius** | NONE — isolated |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- 162 lines removed; completes the v3 preset-stack cleanup.

### If Removing
1. Delete `src/components/preset-card.ts`.
2. `pnpm --filter xivdyetools-web-app run type-check && run test`.
