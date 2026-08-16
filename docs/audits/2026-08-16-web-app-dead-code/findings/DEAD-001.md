# [DEAD-001]: Top-level `assets/` directory — 1.1 MB v3-era static bundle outside Vite's publicDir

## Category
Orphaned File

## Location
- Dir: `apps/web-app/assets/` (22 files, 1.1 MB)
  - `css/shared-styles.css`, `css/tailwind.css`, `js/shared-components.js`
  - `icons/` (17 PNG/WebP/ICO — duplicates of `public/assets/icons/`)
  - `json/data-centers.json`, `json/worlds.json` (duplicates of `public/json/`)

## Evidence
- `vite.config.ts:20-22`: `root: 'src'`, `publicDir: '../public'` → the served static root is `apps/web-app/public/`, **not** `apps/web-app/assets/`. Nothing in `dist/` comes from this dir (checked: `dist/assets/` holds Vite output + `public/assets/`).
- `resolve.alias['@assets']` → `./assets` exists in `vite.config.ts:60`, but `grep -rn "@assets" src` → **0 imports**.
- `grep -rn "assets/css/shared-styles\|shared-components.js" src public` → only hits are the dead `public/js/load-css.js` (DEAD-004) and the dead `service-worker.js` (DEAD-003).
- `package.json` `build:css` writes to `./assets/css/tailwind.css` from a non-existent input (`src/tailwind-input.css`) — see DEAD-006.
- Git: last touched by `ed0a6b3` (delete dead dye-data copies) and the migration commit `79e945a`; nothing since.

## Why It Exists
The v3 multi-page site (`colormatcher_stable.html` & co.) served CSS/JS/icons from `/assets/`. When the app became a Vite SPA rooted at `src/` with `public/` as the static dir, this tree was left behind.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE — nothing resolves into it |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None found. `scripts/` do not reference it; CI workflows do not reference it. |

## Recommendation
**REMOVE**

### Rationale
1.1 MB of duplicated binaries and a v3 stylesheet/JS bundle that has no path into the build. Its presence also invites confusion with the real `public/assets/`. Note that `favicon-48x48.png` exists **only** here while `src/index.html:53` links it (see the BUG note in the report) — copy that one file into `public/assets/icons/` first.

### If Removing
1. `cp assets/icons/favicon-48x48.png public/assets/icons/` (fixes the 404 that `src/index.html:53` currently produces)
2. `git rm -r apps/web-app/assets`
3. Remove the `'@assets'` alias from `vite.config.ts` (part of DEAD-006)
4. `pnpm --filter xivdyetools-web-app run build` — confirm `dist/` unchanged apart from the new favicon
