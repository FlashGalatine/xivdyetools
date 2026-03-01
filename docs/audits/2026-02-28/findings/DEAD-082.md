# DEAD-082: discord-worker — Dead `export * from '@xivdyetools/svg'` in services/svg/index.ts

## Category
Orphaned Files / Dead Code Paths

## Location
- File(s): `apps/discord-worker/src/services/svg/index.ts` (line 8)

## Evidence
The discord-worker's SVG service barrel contains:

```typescript
export * from '@xivdyetools/svg';
export * from './renderer.js';
```

The `export * from '@xivdyetools/svg'` re-export is dead because:

1. **No file in discord-worker imports SVG generators through this barrel** — all 8 handler files import directly from `@xivdyetools/svg`:
   - `handlers/commands/budget.ts` → `import { generateBudgetComparison } from '@xivdyetools/svg'`
   - `handlers/commands/extractor.ts` → `import { generatePaletteGrid } from '@xivdyetools/svg'`
   - `handlers/commands/match-image.ts` → `import { generatePaletteGrid } from '@xivdyetools/svg'`
   - `handlers/commands/preset.ts` → `import { generatePresetSwatch } from '@xivdyetools/svg'`

2. **All `services/svg/` imports use the renderer subpath directly**:
   - `import { renderSvgToPng } from '../../services/svg/renderer.js'` (11 call sites)

3. **No file imports from `services/svg/index.js`** or `services/svg/` (which would resolve to index.js)

## Why It Exists
This barrel was likely created during the migration of SVG generators from discord-worker to the shared `@xivdyetools/svg` package. The re-export was kept for backward compatibility during the transition but all consumers were updated to import from the package directly.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero importers confirmed via monorepo-wide grep |
| **Blast Radius** | NONE — removing a line from a barrel that nobody imports from |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — this is an internal barrel within discord-worker |

## Recommendation
**REMOVE**

### Rationale
- Zero consumers; the re-export serves no purpose
- Removing it clarifies that `services/svg/` only provides the renderer, not the generators
- 1 line removed — trivial cleanup

### If Removing
1. In `apps/discord-worker/src/services/svg/index.ts`, remove `export * from '@xivdyetools/svg';`
2. Update the JSDoc comment to reflect that only the WASM renderer is exported
3. Run `npm test -- --run` to verify
