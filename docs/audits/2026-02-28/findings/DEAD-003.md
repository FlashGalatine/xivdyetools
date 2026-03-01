# DEAD-003: DyePreviewOverlay Component

## Category
Orphaned File

## Location
- File(s): `src/components/dye-preview-overlay.ts` (317 lines)
- Symbol(s): `DyePreviewOverlay` class

## Evidence
Only defined and re-exported via the barrel `components/index.ts`. Zero imports from any other file. Knip flagged as unused export.

## Why It Exists
Appears to be a hover/preview overlay for dye cards that was either prototyped but never integrated, or superseded by the v4 result card's own preview behavior.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero import references |
| **Blast Radius** | NONE — isolated file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- 317 lines removed
- No runtime consumers

### If Removing
1. Delete `src/components/dye-preview-overlay.ts`
2. Remove re-export from `src/components/index.ts`
3. Run build + tests to verify
