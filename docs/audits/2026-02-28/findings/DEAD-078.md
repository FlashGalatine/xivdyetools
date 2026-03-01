# DEAD-078: @xivdyetools/svg — Duplicate Contrast/Luminance Logic in comparison-grid.ts

## Category
Dead Code Paths / Legacy

## Location
- File(s): `packages/svg/src/comparison-grid.ts`
- Symbol(s): `getRelativeLuminance` (private), `getContrastRatio` (private)
- Lines: Within the comparison-grid.ts file

## Evidence
`comparison-grid.ts` contains private reimplementations of luminance and contrast ratio calculations:

```typescript
function getRelativeLuminance(hex: string): number { ... }
function getContrastRatio(hex1: string, hex2: string): number { ... }
```

These duplicate:
1. **`base.ts::getLuminance`** — which is already imported and available in the same package
2. **`@xivdyetools/core::ColorService.getContrastRatio`** — which is already imported in the same file for `getColorDistance`

The file already imports `ColorService` from `@xivdyetools/core` for `ColorService.getColorDistance()`, yet rolls its own contrast ratio calculation instead of using `ColorService.getContrastRatio()`.

## Why It Exists
The comparison grid was likely developed before `ColorService.getContrastRatio` was available, or the developer wasn't aware of the existing utility. The base.ts `getLuminance` was added separately.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — clear functional duplication with available alternatives |
| **Blast Radius** | LOW — single file internal change |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — private functions |

## Recommendation
**REFACTOR** — Replace private functions with existing utilities

### Rationale
- Eliminates ~30 lines of duplicated luminance/contrast logic
- Makes comparison-grid consistent with contrast-matrix (which uses `ColorService.getContrastRatio`)
- Reduces risk of mathematical divergence between implementations

### If Removing
1. Delete private `getRelativeLuminance` from comparison-grid.ts
2. Delete private `getContrastRatio` from comparison-grid.ts
3. Add `getContrastRatio` to the existing `ColorService` import usage
4. Replace calls to private `getContrastRatio(hex1, hex2)` with `ColorService.getContrastRatio(hex1, hex2)`
5. Run `npm test -- --run` to verify output parity
