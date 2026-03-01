# DEAD-050: Orphaned `add-type-flags` scripts (3 duplicate versions)

## Category
Orphaned Files

## Location
- File(s): `packages/core/scripts/add-type-flags.js` (45 lines), `packages/core/scripts/add-type-flags.mjs` (48 lines), `packages/core/scripts/add-type-flags.ts` (61 lines)
- Total: 154 lines across 3 files

## Evidence
Three versions of the same script exist (CJS `.js`, ESM `.mjs`, TypeScript `.ts`) — none are referenced by any `package.json` script, CI config, or build pipeline:

```bash
# package.json scripts:
"build": "npm run build:version && npm run build:locales && tsc -p tsconfig.build.json && npm run copy:locales"
# No reference to add-type-flags in any script
```

The scripts add computed boolean flags (`isMetallic`, `isPastel`, `isDark`, `isCosmic`) to the dye database JSON. Grep for `isMetallic` in `colors_xiv.json` confirms these flags already exist in the data — the scripts were run once and the results committed.

No npm script invokes these. No CI pipeline references them. No documentation (beyond scripts/README.md) references running them as part of any workflow.

## Why It Exists
Utility scripts run once to augment the dye database with computed properties. Three versions were created during migration from CJS to ESM to TypeScript; only one was ever needed.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — no automation references them; results already committed |
| **Blast Radius** | NONE |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — manual dev utility at best |

## Recommendation
**REMOVE**

### Rationale
154 lines across 3 duplicate files with zero automated usage. The flags they produce are already in the data. If the script is ever needed again, git history preserves it; alternatively, keep one version (the `.ts` one).

### If Removing
1. Delete `scripts/add-type-flags.js`
2. Delete `scripts/add-type-flags.mjs`
3. Delete `scripts/add-type-flags.ts`
4. Optionally update `scripts/README.md` if it references these
