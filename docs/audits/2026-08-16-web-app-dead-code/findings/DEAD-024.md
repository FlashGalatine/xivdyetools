# [DEAD-024]: `public/assets/icons/` — ~172 KB of unreferenced icons, a duplicate OG image, a publicly reachable dev gallery page, and a dead icon preload

## Category
Orphaned File (asset) / Stale Asset

## Location / Evidence
`evidence/agent-report-non-source.md` §D. Every file grepped against `src/index.html`, `src/**/*.{ts,css}`, `public/manifest.json`, `public/browserconfig.xml`, `vite-plugin-beta-branding.ts`, `src/shared/beta-branding.ts`:

| File(s) | Bytes | Consumer | Verdict |
|---|---:|---|---|
| `tools/preview.html` | 17,236 | none — a standalone dev icon-gallery page; **ships to production at `/assets/icons/tools/preview.html`** (present in `dist/`) | DEAD, publicly reachable |
| `opengraph.png` | 87,145 | none; byte-size identical to `og/default-x.png` | DEAD (duplicate) |
| `favicon.png` 1,735 · `icon-40x40.png` 2,303 · `icon-60x60.{png,webp}` 6,225 · `icon-80x80.{png,webp}` 8,765 · `icon-192x192.webp` 6,902 · `icon-512x512.webp` 21,760 | ~47,700 | none (`scripts/README.md:40` claims `src/components/app-layout.ts` consumes the WebPs — that file does not exist) | DEAD |
| loose UI SVGs `camera, crystal, eyedropper, hint, info, save, share, theme, upload, zoom-fit, zoom-width` | 6,528 | none — the app inlines icons from `src/shared/*-icons.ts` | DEAD |
| `harmony/*.svg` ×9 · `social/*.svg` ×7 · `tools/*.svg` ×6 | 14,293 | none (superseded by `harmony-icons.ts`, `social-icons.ts`, `tool-icons.ts`) | DEAD |
| `icon-40x40.webp` + `src/index.html:77` `<link rel="preload" … icon-40x40.webp … fetchpriority="high">` | 1,474 | the preload is the file's **only** consumer, and the browser reports *"preloaded using link preload but not used within a few seconds"* on every load (`evidence/shadow-dom-css-check.md`, console) — the header logo is inline SVG (`LOGO_SPARKLES`, `v4-app-header.ts:596`) | DEAD pair — a high-priority fetch of an image nothing renders |
| `src/index.html:78` preload of `icon-192x192.png` | — | same browser warning; the file itself is live (`<link rel=icon>`, `manifest.json`) but the *preload* is wasted | dead preload line |

KEEP: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192x192.png`, `icon-512x512.png` (linked), `sparkles.svg` (sole input of `scripts/generate-icons.mjs`), `beta/*` (beta branding, tested).

## Why It Exists
v3 served SVG icon files from `/assets/icons/`; 5.0 inlined every glyph as a TS constant. The `preview.html` gallery was a design-time aid. The preloads were added for FCP/LCP when the header used a raster logo.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (icons); LOW (preload lines — `beta-branding.test.ts:40-41,:136` asserts the two preload lines are present/unchanged in the fixture; update the fixture) |
| **Reversibility** | EASY |
| **Hidden Consumers** | `_headers` `/assets/*` immutable-cache block — unaffected. |

## Recommendation
**REMOVE** (and remove the two `<link rel="preload">` lines at `src/index.html:77-78`; the LCP element is inline SVG text, not these images)

### If Removing
1. `git rm` the files listed as DEAD (keep the KEEP set)
2. Delete `src/index.html:77-78`; update `src/shared/__tests__/beta-branding.test.ts` fixture lines 40-41 and the assertion at `:136`; check `src/shared/beta-branding.ts:94` comment
3. Build; confirm `dist/assets/icons/` shrinks and no console preload warnings remain in `vite preview`
