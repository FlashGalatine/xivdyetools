# [DEAD-004]: `public/js/load-css.js` — v3 async-CSS loader shipped to prod but never referenced

## Category
Orphaned File

## Location
- `apps/web-app/public/js/load-css.js` (copied to `dist/js/load-css.js` on every build)

## Evidence
- The file appends `<link>`s for `assets/css/shared-styles.css`, `src/styles/themes.css`, `src/styles/globals.css` — v3 paths; none of the three exist at those URLs in `dist/`.
- `grep -rn "load-css" src public/_headers vite*.ts` → only `vite-plugin-async-css.ts`, which **generates its own** `dist/assets/load-css-async.js` and injects that (`vite-plugin-async-css.ts:55-68`). Nothing injects `/js/load-css.js`.
- `src/index.html` has no `<script src="/js/…">` at all (only `<script type="module" src="/main.ts">`).

## Why It Exists
Predecessor of the `asyncCss()` Vite plugin. Superseded when the plugin took over.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None. |

## Recommendation
**REMOVE**

### If Removing
1. `git rm apps/web-app/public/js/load-css.js` (after DEAD-003 this leaves `public/js/` empty — remove the dir)
2. Build; `dist/js/` should no longer exist
