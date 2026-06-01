# DEAD-109: Dependency hygiene — misplaced + phantom deps

## Category
Dependency Hygiene (related to dead code, not dead code itself)

## Location
- File(s): `apps/web-app/package.json`
- Symbol(s): `@tailwindcss/postcss` (placement), `cross-env` (phantom)

## Evidence
1. **Misplaced:** `@tailwindcss/postcss` is listed under `dependencies` but is a **build-only** PostCSS plugin (used in
   `postcss.config.js`). It ships nothing to the runtime bundle and belongs in `devDependencies`.
2. **Phantom:** `cross-env` is invoked by a package.json script —
   ```json
   "test:e2e:coverage": "cross-env PLAYWRIGHT_PROJECT_NAME=chromium-coverage playwright test --project=chromium-coverage"
   ```
   — but is **not declared** in `package.json`. It currently resolves via pnpm root hoisting, which is fragile (breaks under
   stricter hoisting / isolated installs).

## Why It Exists
`@tailwindcss/postcss` was likely added to `dependencies` by reflex during the Tailwind v4 upgrade. `cross-env` was used in a
script without adding the corresponding devDependency.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — both are clear hygiene issues |
| **Blast Radius** | LOW — manifest-only changes |
| **Reversibility** | EASY |
| **Hidden Consumers** | None |

## Recommendation
**FIX** (not a removal): move `@tailwindcss/postcss` to `devDependencies`; declare `cross-env` as a `devDependency`.

### Rationale
- Correct dependency classification; eliminate reliance on hoisting for `cross-env`.

### If Fixing
1. Move `@tailwindcss/postcss` from `dependencies` → `devDependencies`.
2. Add `cross-env` to `devDependencies` (pin to the workspace's existing version if one is hoisted).
3. `pnpm install && pnpm --filter xivdyetools-web-app run build && run test:e2e:coverage` (smoke).
