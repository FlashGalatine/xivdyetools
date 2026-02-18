# REFACTOR-001: Duplicate `resolveDyeInput` Functions

## Priority
MEDIUM

## Category
Code Smell / Duplicate Code

## Location
- File(s): src/handlers/commands/favorites.ts (lines 46-62), src/handlers/commands/collection.ts (lines 51-66)
- Scope: function level

## Current State
Both `favorites.ts` and `collection.ts` define identical `resolveDyeInput()` functions that:
1. Search by name (filtering Facewear dyes)
2. Fall back to hex color closest-dye lookup
3. Return `Dye | null`

Meanwhile, `utils/color.ts` has a similar but more feature-rich `resolveColorInput()` function used by other commands.

## Issues
- Identical code in two files (DRY violation)
- Different resolution logic from `resolveColorInput()` in `utils/color.ts`
- If dye resolution logic changes (e.g., new dye categories), both files need updating
- Bug in both: if searching by name returns only Facewear dyes, it falls through to return `dyes[0]` which IS a Facewear dye

## Proposed Refactoring
Consolidate into a single `resolveDyeInput()` in `utils/color.ts` that both handlers import:

```typescript
// utils/color.ts
export function resolveDyeInput(
  input: string,
  options?: { excludeFacewear?: boolean }
): Dye | null {
  const exclude = options?.excludeFacewear ?? true;
  const dyes = dyeService.searchByName(input);
  if (dyes.length > 0) {
    const filtered = exclude ? dyes.filter(d => d.category !== 'Facewear') : dyes;
    return filtered[0] ?? null;  // Don't fall back to Facewear
  }
  if (/^#?[0-9A-Fa-f]{6}$/.test(input)) {
    const hex = input.startsWith('#') ? input : `#${input}`;
    return dyeService.findClosestDye(hex);
  }
  return null;
}
```

## Benefits
- Single source of truth for dye input resolution
- Fixes the Facewear fallback bug in both files
- Easier to maintain and test

## Effort Estimate
LOW

## Risk Assessment
Low risk — both files already deprecated, and the function signature is simple.
