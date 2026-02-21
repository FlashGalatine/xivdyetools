# REFACTOR-005: Inconsistent SVG Text Truncation Styles

## Priority
LOW

## Category
Inconsistency

## Location
- Files: Multiple SVG generators across `packages/svg/src/`

## Current State
Different SVG generators use different ellipsis styles for truncated text:

| File | Ellipsis |
|------|----------|
| comparison-grid.ts | `'...'` (three dots) |
| contrast-matrix.ts | `'…'` (Unicode U+2026) |
| gradient.ts | `'..'` (two dots) |
| preset-swatch.ts | Mixed `'..'` and `'...'` |
| random-dyes-grid.ts | `'…'` (Unicode U+2026) |

## Proposed Refactoring
1. Standardize on `'…'` (Unicode ellipsis U+2026) — it's a single character, so truncation math is simpler
2. Extract a shared `truncate()` utility in `base.ts`

```typescript
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}
```

## Effort Estimate
LOW

## Risk Assessment
Visual-only change.
