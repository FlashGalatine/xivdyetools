# DEAD-085: @xivdyetools/svg — Inconsistent Name Truncation in comparison-grid.ts

## Category
Legacy/Deprecated

## Location
- File(s): `packages/svg/src/comparison-grid.ts`
- Symbol(s): Inline string truncation pattern

## Evidence
In `comparison-grid.ts`, dye names are truncated using a raw `substring` + ASCII ellipsis pattern:

```typescript
name.substring(0, maxLength - 1) + '...'
```

Every other SVG generator in the package uses the standardized `truncateText()` function from `base.ts` with Unicode ellipsis `'…'`:

| File | Truncation Method |
|------|------------------|
| `palette-grid.ts` | `truncateText()` + `'…'` ✓ |
| `gradient.ts` | `truncateName()` → `truncateText()` ✓ |
| `contrast-matrix.ts` | `truncateName()` → `truncateText()` ✓ |
| `random-dyes-grid.ts` | `truncateText()` ✓ |
| `preset-swatch.ts` | `truncateText()` ✓ |
| `comparison-grid.ts` | `substring()` + `'...'` ✗ |

The `truncateText` function is already imported (via `base.js`) in the file's import block — it's available but unused.

## Why It Exists
comparison-grid.ts was likely developed before `truncateText` was added to `base.ts`, or the developer used inline logic without checking for shared utilities.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — clear inconsistency with established pattern |
| **Blast Radius** | NONE — visual change to truncation character only |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REFACTOR** — Replace inline truncation with `truncateText()` calls

### Rationale
- Consistency across all SVG generators
- Unicode ellipsis (`…`) is visually superior to ASCII (`...`)
- Removes duplicated truncation logic
- `truncateText` already handles edge cases (empty strings, short strings)

### If Removing
1. Replace all `name.substring(0, n) + '...'` with `truncateText(name, n)`
2. Verify `truncateText` is imported from `./base.js` (it likely already is)
3. Run `npm test -- --run` to verify visual output
