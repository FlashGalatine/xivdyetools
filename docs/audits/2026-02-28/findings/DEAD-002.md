# DEAD-002: DyeComparisonChart Component

## Category
Orphaned File

## Location
- File(s): `src/components/dye-comparison-chart.ts` (401 lines)
- Symbol(s): `DyeComparisonChart` class, `ChartType` type

## Evidence
Knip flagged as unused export. Manual verification confirms: `DyeComparisonChart` and `ChartType` are only defined and re-exported via the barrel `components/index.ts`. No file ever imports them from either the barrel or the direct path.

The comparison tool (`comparison-tool.ts`) builds its own chart rendering inline rather than using this dedicated component.

## Why It Exists
Likely extracted as a reusable chart component but the comparison tool was refactored to use inline rendering instead.

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
- 401 lines removed
- No runtime consumers

### If Removing
1. Delete `src/components/dye-comparison-chart.ts`
2. Remove re-export from `src/components/index.ts`
3. Run build + tests to verify
