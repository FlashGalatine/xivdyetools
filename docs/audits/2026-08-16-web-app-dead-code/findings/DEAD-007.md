# [DEAD-007]: `spectral.js` listed as a direct dependency of web-app but never imported by it

## Category
Unused Dependency

## Location
- `apps/web-app/package.json` `dependencies."spectral.js": "^3.0.0"`

## Evidence
- `grep -rn "from 'spectral.js'\|import('spectral.js')\|require('spectral.js')" src` → **0**. The only textual hits are the About-modal credit string and the `'spectral'` *mixing-mode* enum value (`mixer-tool.ts`, `config-sidebar.ts`, `mixer-blending-engine.ts:79`).
- `mixer-blending-engine.ts` case `'spectral'` delegates to `@xivdyetools/core/blending`; `packages/core/package.json:66` lists `spectral.js` as **its** dependency. pnpm's strict resolution resolves it from core's own `node_modules`, so web-app's copy of the declaration is redundant.
- knip: *Unused dependencies: spectral.js*. depcheck: same.
- `vite.config.ts` `manualChunks` matches `id.includes('spectral.js')` — that is a **path** test on the resolved module id, and the transitive path still contains `spectral.js`, so the `vendor-spectral` chunk keeps working after removal.

## Why It Exists
Pre-consolidation, the web-app called spectral.js directly; the blending code moved into `@xivdyetools/core/blending` (Monorepo 2.0 Tier-1 consolidation) and the declaration was left behind.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (same version is still installed via core) |
| **Reversibility** | EASY |
| **Hidden Consumers** | Lockfile only. If core ever bumps spectral.js major, web-app follows automatically — which is the correct coupling. |

## Recommendation
**REMOVE**

### If Removing
1. Delete the line from `apps/web-app/package.json`
2. `pnpm install` (lockfile update)
3. `pnpm --filter xivdyetools-web-app run build` and confirm `dist/assets/vendor-spectral-*.js` still exists and `scripts/check-bundle-size.js` passes
