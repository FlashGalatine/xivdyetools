# DEAD-049: Deprecated monolithic `characterColorData` JSON export

## Category
Legacy/Deprecated

## Location
- File(s): `packages/core/src/index.ts` (lines 163–166), `packages/core/src/data/character_colors.json`
- Symbol(s): `characterColorData`

## Evidence
```typescript
/**
 * @deprecated Use the CharacterColorService instead, or import individual
 * color data exports (eyeColorsData, hairColorsData, etc.) for tree-shaking.
 */
export { default as characterColorData } from './data/character_colors.json' with { type: 'json' };
```

This exports the monolithic `character_colors.json` file — a single JSON blob containing all character color data. It is explicitly `@deprecated` in favor of `CharacterColorService` or the individual tree-shakeable data exports (which themselves are unused per DEAD-048).

**External consumers:** Zero. No monorepo project imports `characterColorData`.

**Internal consumers:** None. `CharacterColorService` uses the individual JSON files.

The `character_colors.json` file itself is 1 line (minified JSON, likely large payload).

## Why It Exists
Original character color export before the data was split into individual files for tree-shaking.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — explicitly deprecated, zero consumers |
| **Blast Radius** | NONE |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Unlikely — it's deprecated and documented as such |

## Recommendation
**REMOVE**

### Rationale
Explicitly deprecated, zero consumers, and the monolithic JSON file wastes bundle size for anyone importing `@xivdyetools/core`. Clear win.

### If Removing
1. Remove the `export { default as characterColorData }` line from `src/index.ts`
2. Delete `src/data/character_colors.json`
3. Run `npm run type-check` and full test suite
