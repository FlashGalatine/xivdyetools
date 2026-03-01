# DEAD-079: @xivdyetools/svg — `ComparisonDye` and `DyePair` Exported but Not Re-exported from Barrel

## Category
Unused Exports

## Location
- File(s): `packages/svg/src/comparison-grid.ts` (lines 43–62)
- Symbol(s): `ComparisonDye` (interface), `DyePair` (interface)

## Evidence
Both interfaces are `export`ed from `comparison-grid.ts`:

```typescript
export interface ComparisonDye {
  dye: Dye;
  index: number;
}

export interface DyePair {
  index1: number;
  index2: number;
  distance: number;
  contrastRatio: number;
}
```

However, they are **NOT re-exported** from `packages/svg/src/index.ts`. The barrel only exports `ComparisonGridOptions` and `generateComparisonGrid` from this module.

External consumers importing from `@xivdyetools/svg` cannot access these types. Internal consumers (within the svg package) also don't import them — they're only used as internal type annotations within `comparison-grid.ts` itself.

TypeScript compiler does not flag this since the interfaces are used within the file.

## Why It Exists
The types were likely exported anticipating that consumers would need them, but they were unintentionally omitted from the barrel during development.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — exported but unreachable through the barrel |
| **Blast Radius** | NONE — removing `export` keyword only affects the file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — package.json only exports `.` entry which points to barrel |

## Recommendation
**REMOVE EXPORT** — Make them non-exported (private interfaces)

### Rationale
- These types are only used locally within comparison-grid.ts
- If they were intended for external consumption, they should be added to index.ts instead
- Removing the `export` keyword keeps them accessible within the file but removes the false promise of external availability

### If Removing
1. In `packages/svg/src/comparison-grid.ts`:
   - Change `export interface ComparisonDye` to `interface ComparisonDye`
   - Change `export interface DyePair` to `interface DyePair`
2. Run `npm run build` to verify
