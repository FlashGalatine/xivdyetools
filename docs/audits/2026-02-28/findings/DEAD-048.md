# DEAD-048: 11 character color data JSON exports with zero consumers

## Category
Unused Exports

## Location
- File(s): `packages/core/src/index.ts` (lines 147–161)
- Symbol(s): `characterColorMeta`, `eyeColorsData`, `highlightColorsData`, `lipColorsDarkData`, `lipColorsLightData`, `tattooColorsData`, `facePaintDarkData`, `facePaintLightData`, `hairColorsData`, `skinColorsData`, `characterColorData` (deprecated, see also DEAD-049)

## Evidence
These 11 exports provide direct access to character color JSON data files:

```typescript
export { default as characterColorMeta } from './data/character_colors/index.json' with { type: 'json' };
export { default as eyeColorsData } from './data/character_colors/shared/eye_colors.json' with { type: 'json' };
export { default as highlightColorsData } from './data/character_colors/shared/highlight_colors.json' with { type: 'json' };
// ... 7 more ...
```

**Internal consumers:** `CharacterColorService.ts` imports these JSON files directly via relative paths (e.g., `import eyeColors from '../data/character_colors/shared/eye_colors.json'`), NOT via the public barrel exports.

**External consumers:** Zero. Grep across all monorepo apps and packages found no imports of any of these 11 symbols from `@xivdyetools/core`.

All character color functionality is consumed exclusively through the `CharacterColorService` class. The data exports were designed for "tree-shaking" direct access but no consumer has exercised this pattern.

## Why It Exists
Added as part of the `CharacterColorService` feature for consumers who might want raw data access without going through the service layer. The 10 individual exports were specifically created for "tree-shaking" (import only the data you need).

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — zero consumers in monorepo, but npm consumers might use them |
| **Blast Radius** | NONE — no internal code uses them via barrel |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possible external npm consumers |

## Recommendation
**REMOVE WITH CAUTION (v2.0.0)**

### Rationale
11 exports adding to barrel size and public API surface with zero known consumers. The `CharacterColorService` provides the proper abstraction layer. Schedule for v2.0.0 with `@internal` markers in the interim.

Note: This does NOT affect the `CharacterColorService` — it imports JSON files via relative paths, not the barrel.

### If Removing
1. Remove the 11 `export { default as ... }` lines from `src/index.ts`
2. The underlying JSON data files in `src/data/character_colors/` must be kept (used by `CharacterColorService`)
3. Run `npm run type-check`
4. Run full test suite
