# [DEAD-006]: Dead build config — phantom aliases, a broken `build:css` script, an unreferenced `tsconfig.app.json`, and a stale `main` field

## Category
Dead Config

## Location
- `apps/web-app/vite.config.ts:57-63` — `resolve.alias` entries `@apps`, `@data`, `@assets`, `@v4`
- `apps/web-app/tsconfig.json:21-27` — `paths` entries `@apps/*`, `@data/*`, `@v4/*`
- `apps/web-app/package.json`:
  - `"main": "index.html"` (line 6)
  - `"build:css"` / `"build:css:watch"` (lines 26-27)
- `apps/web-app/tsconfig.app.json` (whole file)

> Not included: `scripts/check-bundle-size.d.ts`. knip lists it as an unused file, but `src/__tests__/bundle-budget.test.ts:31` imports `'../../scripts/check-bundle-size.js'` and TypeScript resolves the sibling `.d.ts` implicitly — a textual-import scanner cannot see that. **KEEP.**

## Evidence
| Item | Check | Result |
|------|-------|--------|
| `@apps` alias / path | `ls src/apps` ; `grep -rn "from '@apps" src` | dir does not exist; 0 imports |
| `@data` alias / path | `ls src/data` ; `grep -rn "from '@data" src` | dir does not exist; 0 imports |
| `@assets` alias | `grep -rn "@assets" src` | 0 imports (dir is itself dead — DEAD-001) |
| `@v4` alias / path | `grep -rn "from '@v4" src` | 0 imports (everything uses `@components/v4/…` or relative) |
| `"main": "index.html"` | `ls apps/web-app/index.html` | file removed in `98d136b`-era cleanup (prior audit DEAD-001); entry is `src/index.html`; `main` is meaningless for a `private` Vite app anyway |
| `build:css` | `ls src/tailwind-input.css` | **input does not exist** → the script fails on invocation; its output path `assets/css/tailwind.css` is in the dead `assets/` dir. Tailwind v4 is compiled by `@tailwindcss/postcss` inside Vite, so a standalone CLI build has no role. |
| `tsconfig.app.json` | `grep -rn "tsconfig.app" . ../../.github ../../turbo.json` (excl. node_modules) | 0 references. `package.json` `build`/`type-check` use `tsc --noEmit` against `tsconfig.json`. |

## Why It Exists
Aliases and paths were scaffolded for a directory layout (`src/apps`, `src/data`) that never materialised in this repo. `tsconfig.app.json` is a Vite-template artefact (emit config) for a project that never emits. `build:css` predates the Tailwind v4 / PostCSS integration.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (config only; verified 0 consumers for every entry) |
| **Reversibility** | EASY |
| **Hidden Consumers** | Editor tooling reads `tsconfig.json` `paths` — removing unused entries has no effect. `tailwind.config.js` `content` still lists `./index.html` — see the CSS category for that separate note. |

## Recommendation
**REMOVE**

### If Removing
1. `vite.config.ts`: delete the `@apps`, `@data`, `@assets`, `@v4` alias lines
2. `tsconfig.json`: delete the `@apps/*`, `@data/*`, `@v4/*` path entries
3. `package.json`: delete `main`, `build:css`, `build:css:watch`
4. `git rm apps/web-app/tsconfig.app.json`
5. `pnpm --filter xivdyetools-web-app run type-check && pnpm --filter xivdyetools-web-app run build`
