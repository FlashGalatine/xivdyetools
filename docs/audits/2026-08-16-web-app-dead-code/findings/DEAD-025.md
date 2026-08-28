# [DEAD-025]: Stale PWA/SEO metadata — `manifest.json` shortcuts to v3 pages, a `share_target` with no handler, a `sitemap.xml` of five dead URLs, and a `browserconfig.xml` tile that 404s

## Category
Stale Code (dead routes in shipped metadata)

## Location
- `apps/web-app/public/manifest.json` — `shortcuts[].url` ×4 → `/colormatcher_stable.html`, `/colorexplorer_stable.html`, `/coloraccessibility_stable.html`, `/dyecomparison_stable.html`; `share_target.action: "/share-handler"`
- `apps/web-app/public/sitemap.xml` — 6 `<loc>`; 5 are `*_stable.html`; `lastmod` 2025-01-14 throughout
- `apps/web-app/public/browserconfig.xml` — `<square150x150logo src="/assets/icons/mstile-150x150.png"/>`

## Evidence
- `src/services/router-service.ts:60-78` defines the 9 SPA routes (`/harmony`, `/extractor`, `/accessibility`, `/comparison`, `/gradient`, `/presets`, `/budget`, `/swatch`, `/mixer`) + 2 legacy aliases (`/matcher`, `/character`). None of the `*_stable.html` URLs exists; `_redirects` catch-all serves `index.html` for them (200, not 404 — so crawlers index five copies of the SPA shell under dead URLs).
- `grep -rn "share-handler" src` → **0**. Installed-PWA "share to app" lands on the SPA shell with no handling.
- `ls public/assets/icons/mstile-150x150.png` → not found (exists only in dead root `assets/icons/`, DEAD-001). `browserconfig.xml` is linked from `src/index.html:63` so Windows tile requests 404.

## Why It Exists
All three files predate the SPA; the icons/paths inside were never re-pointed.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH that the entries are dead |
| **Blast Radius** | LOW — metadata only |
| **Reversibility** | EASY |
| **Hidden Consumers** | Search engines already hold the `*_stable.html` URLs from the sitemap; replacing them with the 9 real routes is strictly better. |

## Recommendation
**REFACTOR FIRST** (these are not deletions but corrections):
- `manifest.json`: point the four shortcuts at `/extractor`, `/harmony`, `/accessibility`, `/comparison` (or drop them); remove `share_target` unless a `/share-handler` route is planned
- `sitemap.xml`: list `/` + the 9 tool routes with a real `lastmod` (or generate it in the build from `ROUTES`)
- `browserconfig.xml`: either copy `mstile-150x150.png` into `public/assets/icons/` (from the dead `assets/icons/` before DEAD-001 deletes it) or drop the `msapplication-config` meta + file (Windows tiles are legacy)

### If Removing
1. Edit the three files as above; run `scripts/smoke-test-pages.js` locally against `vite preview` if it covers them
2. Build; verify `dist/manifest.json`, `dist/sitemap.xml`
