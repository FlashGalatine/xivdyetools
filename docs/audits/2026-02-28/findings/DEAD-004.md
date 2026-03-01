# DEAD-004: FeaturedPresetsSection Component

## Category
Orphaned File

## Location
- File(s): `src/components/featured-presets-section.ts` (160 lines)
- Symbol(s): `FeaturedPresetsSection` class, `FeaturedPresetCallback` type

## Evidence
Only defined and re-exported via the barrel `components/index.ts`. Zero imports from any other file. Knip flagged as unused export.

The preset tool (`preset-tool.ts`) and v4 preset tool (`v4/preset-tool.ts`) handle featured presets inline rather than using this standalone section component.

## Why It Exists
Extracted as a reusable section for featured presets display, but the preset tool implementations embed this functionality directly.

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
- 160 lines removed

### If Removing
1. Delete `src/components/featured-presets-section.ts`
2. Remove re-export from `src/components/index.ts`
3. Run build + tests to verify
