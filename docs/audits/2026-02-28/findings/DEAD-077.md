# DEAD-077: @xivdyetools/svg — Duplicate `rgbToHsv` Function in Two Files

## Category
Dead Code Paths / Legacy

## Location
- File(s): `packages/svg/src/comparison-grid.ts` (lines ~96–130), `packages/svg/src/dye-info-card.ts` (duplicated implementation)
- Symbol(s): `rgbToHsv` (private function, copy-pasted in both files)

## Evidence
The function `rgbToHsv` is defined as a private (non-exported) function in both `comparison-grid.ts` and `dye-info-card.ts`. The implementations are identical:

```typescript
// Both files contain this identical ~25-line function
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}
```

No other module in the monorepo duplicates this. The `@xivdyetools/color-blending` package has `rgbToHsl` but NOT `rgbToHsv`.

## Why It Exists
Each SVG generator was developed semi-independently. Both needed HSV conversion for displaying color properties but neither extracted it to a shared location.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — clear duplication |
| **Blast Radius** | LOW — extract to `base.ts` and update two files |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — private functions |

## Recommendation
**REFACTOR** — Extract `rgbToHsv` to `base.ts` and import from both files

### Rationale
- Eliminates 25 lines of copy-pasted code
- `base.ts` is the designated location for color utility functions (`hexToRgb`, `rgbToHex`, `getLuminance` are already there)
- Reduces maintenance risk of the function diverging between files

### If Removing
1. Add `export function rgbToHsv(...)` to `packages/svg/src/base.ts`
2. Remove private `rgbToHsv` from `packages/svg/src/comparison-grid.ts`
3. Remove private `rgbToHsv` from `packages/svg/src/dye-info-card.ts`
4. Add `import { rgbToHsv } from './base.js'` to both files
5. Optionally export from `index.ts` (or keep internal)
6. Run `npm test -- --run` to verify
