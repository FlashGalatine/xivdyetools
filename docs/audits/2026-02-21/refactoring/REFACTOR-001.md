# REFACTOR-001: `getColorDistance()` Duplicated in 4+ Files

## Priority
HIGH

## Category
Code Duplication

## Location
- Files: `packages/bot-logic/src/commands/match.ts`, `packages/bot-logic/src/commands/mixer.ts`, `packages/bot-logic/src/commands/gradient.ts`, `packages/svg/src/comparison-grid.ts`
- Scope: Function-level

## Current State
Identical RGB Euclidean distance function (~8 lines) is copy-pasted across 4 files:

```typescript
function getColorDistance(hex1: string, hex2: string): number {
  const rgb1 = ColorService.hexToRgb(hex1);
  const rgb2 = ColorService.hexToRgb(hex2);
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}
```

## Issues
- Maintenance burden: a fix in one copy may not be propagated to others
- Consistency risk: one copy could evolve differently over time
- ~32 lines of pure duplication

## Proposed Refactoring
Move to a shared utility in `packages/bot-logic/src/utils/color-math.ts` or expose from `@xivdyetools/core`:

```typescript
// packages/bot-logic/src/utils/color-math.ts
export function getColorDistance(hex1: string, hex2: string): number {
  const rgb1 = ColorService.hexToRgb(hex1);
  const rgb2 = ColorService.hexToRgb(hex2);
  return Math.sqrt((rgb1.r - rgb2.r) ** 2 + (rgb1.g - rgb2.g) ** 2 + (rgb1.b - rgb2.b) ** 2);
}
```

## Benefits
- Single source of truth for color distance calculation
- Easier to upgrade to a better algorithm (e.g., CIEDE2000) in the future

## Effort Estimate
LOW

## Risk Assessment
Minimal risk — pure function replacement with identical behavior.
