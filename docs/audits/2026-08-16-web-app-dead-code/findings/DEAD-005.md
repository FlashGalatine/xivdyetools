# [DEAD-005]: `robots.txt` at the app root — v3 disallow list that is never deployed

## Category
Orphaned File

## Location
- `apps/web-app/robots.txt`

## Evidence
- Not under `public/`, so it is not copied to `dist/` (`ls dist` → no `robots.txt`; `ls public/robots.txt` → no such file).
- Content disallows `/colorexplorer_experimental.html`, `/colormatcher_experimental.html`, `/dyecomparison_experimental.html`, `/coloraccessibility_experimental.html` — v3 pages that no longer exist.
- The deploy smoke test (`scripts/smoke-test-pages.js`, `--expect-robots`) checks the **`x-robots-tag` header** set via `public/_headers` / beta branding — it never looks at a `robots.txt` body.

## Why It Exists
v3 site-root artefact; not moved when the Vite root became `src/` and static files moved to `public/`.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None. |

## Recommendation
**REMOVE** — and decide separately whether production *should* have a `robots.txt`.

### Rationale
The file is inert. But its absence from `dist/` means **`https://xivdyetools.app/robots.txt` currently 404s** while `sitemap.xml` is shipped. Crawlers treat a 404 robots.txt as "allow all", so nothing is broken — but if the team wants an explicit `Sitemap:` hint for crawlers, add a fresh `public/robots.txt` (`User-agent: *` / `Allow: /` / `Sitemap: https://xivdyetools.app/sitemap.xml`) rather than moving this stale one. Beta must NOT get an `Allow: /` robots — its `noindex` is enforced by header, and a permissive body would be misleading; if a body is added, `vite-plugin-beta-branding.ts` should emit a `Disallow: /` variant for beta.

### If Removing
1. `git rm apps/web-app/robots.txt`
2. Optional: add `public/robots.txt` as above (production) — see the note on beta
