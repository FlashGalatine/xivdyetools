# [DEAD-003]: `service-worker.js` (root) + `public/js/sw-register.js` — a PWA service worker that never ships and a registrar nothing loads

## Category
Orphaned File

## Location
- `apps/web-app/service-worker.js` (root; not under `public/`)
- `apps/web-app/public/js/sw-register.js` (IS copied to `dist/js/sw-register.js`)

## Evidence
- `service-worker.js` sits at the app root — outside `publicDir` and outside `src/` — so it is neither bundled nor copied. `dist/` has no `service-worker.js` (verified: `ls dist`).
- Its `PRECACHE_URLS` are the v3 pages: `/colormatcher_stable.html`, `/colorexplorer_stable.html`, `/coloraccessibility_stable.html`, `/dyecomparison_stable.html`, `/dye-mixer_stable.html`, `/assets/css/shared-styles.css`, `/assets/js/shared-components.js` — none exist. `CACHE_NAME = 'xiv-dye-tools-v3.0.0'`.
- `public/js/sw-register.js` calls `navigator.serviceWorker.register('/service-worker.js')` — but `grep -n "sw-register" src/index.html vite*.ts src` → **0**: no `<script>` tag or import ever loads it. It ships to `dist/js/` as an unreachable file.
- knip: `service-worker.js` listed under *Unused files*.

## Why It Exists
The v3 site was a PWA with offline caching. The 5.0 SPA never wired the registrar back in, and the worker file was never moved into `public/`.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE — no runtime path reaches either file |
| **Reversibility** | EASY |
| **Hidden Consumers** | Browsers that still hold a *previously registered* v3 SW: unaffected by deleting source that is already absent from production. |

## Recommendation
**REMOVE**

### Rationale
Neither file participates in the build. Keeping `sw-register.js` in `public/` also means every deploy uploads an orphan. Product note (not a dead-code finding): the app currently ships `manifest.json` (installable) but **has no service worker at all** — offline support is not a 5.0 feature. If it should be, that is new work, not a resurrection of this v3 file (its precache list is 100% stale).

### If Removing
1. `git rm apps/web-app/service-worker.js apps/web-app/public/js/sw-register.js`
2. Check `public/_headers` for a `/js/*` or `/service-worker.js` block and drop it if present
3. Build; confirm `dist/js/` no longer contains `sw-register.js`
