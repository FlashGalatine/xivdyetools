# REFACTOR-004: `rgbToHsv` Duplicated in SVG Package

## Priority
LOW

## Category
Code Duplication

## Location
- Files: `packages/svg/src/comparison-grid.ts`, `packages/svg/src/dye-info-card.ts`
- Scope: Function-level (identical ~26-line functions)

## Current State
Identical `rgbToHsv()` function exists in both files.

## Proposed Refactoring
Move to `packages/svg/src/base.ts` alongside `hexToRgb()` / `rgbToHex()` and export from `packages/svg/src/index.ts`.

## Benefits
- Single source of truth
- Easier to test and maintain

## Effort Estimate
LOW

## Risk Assessment
None — identical implementations.
