# [DEAD-025]: `vitest.config.ts` excludes `src/index.ts` from coverage although `src/index.test.ts` (471 lines) exercises it

## Category
Stale Test (configuration drift)

## Location
- `apps/og-worker/vitest.config.ts:14-19` `exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/services/fonts.ts', 'src/services/renderer.ts']`

## Evidence
`fonts.ts` / `renderer.ts` are excluded for a real reason (they import `.ttf`/`.wasm` binaries that vitest cannot load — `index.test.ts` mocks `./services/renderer`). `index.ts` was presumably excluded for the same reason back when it imported those directly; today it is the most-tested file in the app (16 route describes) yet contributes nothing to the 85 % gate — which means the 12 route handlers' branches (validation 400s, `isOgImageHost`, the catch-all) are invisible to the threshold. Not dead code, but a gate that isn't measuring the entry point.

## Recommendation
**KEEP / REVISIT** — try removing `'src/index.ts'` from `exclude`; if the renderer mock keeps the binaries out of the graph (it should — the mock replaces the module), the gate starts covering the router for free. If it drops below 85 %, that is information, not a reason to hide it.
