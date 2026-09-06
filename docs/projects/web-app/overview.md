# Web App Overview

**xivdyetools-web-app** — interactive browser-based toolkit for FFXIV dye colors. Current version: see [versions.md](../../versions.md).

The dye database backing the app is **125 standard dyes** (`dyes.json`, schema v2, keyed by `stainID`). The 11 Facewear colours are a separate `facewearColors` collection, not dyes.

---

## What is the Web App?

A fully-featured web application built with Lit and Vite, offering 9 interactive tools for exploring FFXIV dye colors:

| Tool | Purpose |
|------|---------|
| **Palette Extractor** | Find closest dye to any color + palette extraction |
| **Color Harmony Explorer** | Discover harmonious dye combinations |
| **Gradient Builder** | Create gradients between two dyes |
| **Dye Mixer** | Blend two dyes together (RGB / LAB / OKLAB / RYB / HSL / Spectral) |
| **Swatch Matcher** | Match character colors to dyes |
| **Dye Comparison** | Compare dyes side-by-side |
| **Accessibility Checker** | Colorblindness simulation |
| **Community Presets** | Browse community dye palettes |
| **Budget Suggestions** | Find affordable dye alternatives using market data |

### New in v5.0.0

- **The 5.0 redesign** — every tool re-ported onto the console bar + tool rail shell with an Advanced Options panel and result cards; themes reduced to Light + Dark ([theming](theming.md)); one matching vocabulary (`ciede2000` default / `oklab` / `cie76` / `redmean` / `rgb` / `distinguish`); share URLs key on stainID (`?dye=<stainID>`, `?hex=` bare colours; legacy itemID links rejected loudly); `CollectionService` 5.0 is the single saved-things store (stainID-keyed, 4.x data migrated on load); `.chara` character-file import in the Swatch Matcher; self-hosted fonts; root OG cards; beta build (`VITE_APP_ENV=beta`); the UI locale files grew to 1,152 keys × 6. The v4.x notes below are historical.

### New in v4.10.0

- **Result Card v4 "Spectrum" row** — Shows the consolidated dye spectrum (Standard / Wide #1 / Wide #2) on every match across Harmony, Gradient, Budget, Swatch, and Extractor; new `common.spectrum` i18n key in all 6 locales
- **SEC-001 XSS hardening** — `auth-button.ts` `innerHTML` interpolation of OAuth user character name / server replaced with `createElement` + `textContent`; CSP `script-src 'self'` provides defense-in-depth. (`auth-button.ts` itself is gone in 5.0 — sign-in is `components/signin-modal.ts`.)
- **"Exclude Allied Society Dyes" filter retired** — Patch 7.5 collapsed the old vendor categories out of the dye database, so the toggle had nothing left to exclude

### New in v4.9.0

- **Patch 7.5 dye consolidation active end-to-end** — Market Board service fans out the 3 consolidated prices (Type-A=52254, Type-B=52255, Type-C=52256) to all 105 individual dye cache entries; refresh now issues ~20 API calls instead of 105
- **Price Categories panel removed** — categories stopped being meaningful once consolidated dyes started sharing market IDs; refresh button now lives directly above the price panel

### New in v4.6.0

- **Dye Filters v4 web component** — 9 toggles across 2 collapsible sections; `dye-filter-utils.ts` with `isDyeExcluded` / `filterDyes` / `hasActiveFilters`; integrated across all 6 tools

### New in v4.3.0

- **Pixel Sampling** - Shift+Click to sample a pixel (or configurable NxN area) from images in the Extractor tool
- **Canvas Panning** - Ctrl/Cmd+Drag to pan zoomed images with grab cursor feedback
- **Sample Area Config** - Configurable 1×1 to 16×16 pixel sample area in the Extractor sidebar
- **Pan Offset Persistence** - Pan position preserved across zoom level changes

### New in v4.2.0

- **Prevent Duplicate Results** - Toggle for Harmony Explorer and Palette Extractor that deduplicates dyes across result slots
- **Paste from Clipboard** - Visible "Paste" button (Chromium) and Ctrl+V keyboard paste in Extractor tool

### New in v4.0.0

- **Tool Renaming** - Color Matcher → Palette Extractor, Dye Mixer → Gradient Builder, Preset Browser → Community Presets
- **New Dye Mixer** - Blend two dyes together using RGB color averaging
- **Swatch Matcher** - Match character customization colors (hair, eyes, skin) to dyes
- **Glassmorphism UI** - Modern design system with frosted glass effects
- **Lit.js Web Components** - Full migration to Lit web component architecture
- **9 Tools Total** - Up from 7 in v3.x

### Previous Features (v3.2.x)

- **Dye Action Dropdown** - Context menu for quick actions on dye matches
- **Slot Selection Modal** - Choose which slot to replace when Comparison/Mixer is full
- **Duplicate Detection** - Toast notifications for duplicate presets
- **SVG Icon Consolidation** - Shared icons reduce bundle size by ~10KB
- **SubscriptionManager** - Prevents memory leaks from orphaned reactive subscriptions
- **Theme Factory Pattern** - `createThemePalette()` for easy theme creation

---

## Quick Start (Development)

All commands run from the **monorepo root** — this is a pnpm workspace, so never `cd` in and
`npm install`.

```bash
pnpm install                                          # once, at the root

pnpm --filter xivdyetools-web-app run dev             # localhost:5173
pnpm --filter xivdyetools-web-app run test
pnpm --filter xivdyetools-web-app run test:e2e        # Playwright
pnpm --filter xivdyetools-web-app run build

# Build the app together with its workspace dependencies
pnpm turbo run build --filter=xivdyetools-web-app...
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Components** | Lit | Web components framework |
| **Build** | Vite | Fast bundler and dev server |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Testing** | Vitest + Playwright | Unit and E2E tests |
| **Core Logic** | @xivdyetools/core | Color algorithms, dye database |

---

## Architecture

The tree is flat: there is no `components/tools/` directory and no `utils/`. Every file name below
is real (`git ls-files apps/web-app/src`).

```
src/
├── main.ts                     # Bootstrap + error handling
├── components/                 # Imperative BaseComponent tools + shared UI (flat)
│   ├── base-component.ts
│   ├── v4-layout.ts            # Not a component: shell wiring + tool lazy-load
│   ├── harmony-tool.ts  extractor-tool.ts  accessibility-tool.ts
│   ├── comparison-tool.ts  gradient-tool.ts  mixer-tool.ts
│   ├── budget-tool.ts  swatch-tool.ts        # eight of the nine tools
│   ├── dye-selector.ts  dye-grid.ts  dye-search-box.ts  market-board.ts
│   ├── metric-help.ts  chara-import.ts  export-sheet.ts  empty-state.ts
│   ├── image-zoom-controller.ts                         # the Extractor's canvas + loupe events
│   ├── modal-container.ts  toast-container.ts  offline-banner.ts
│   ├── welcome-modal.ts  changelog-modal.ts  about-modal.ts  signin-modal.ts
│   ├── preset-submission-form.ts  preset-edit-form.ts  my-submissions-modal.ts
│   ├── advanced-options-panel.ts  collection-manager-modal.ts  shortcuts-panel.ts
│   └── v4/                     # Lit shell + primitives
│       ├── v4-layout-shell.ts  v4-app-header.ts  config-sidebar.ts
│       ├── dye-palette-drawer.ts  result-card.ts  share-button.ts
│       ├── v4-color-wheel.ts  display-options-v4.ts  dye-filters-v4.ts
│       ├── range-slider-v4.ts  toggle-switch-v4.ts  base-lit-component.ts
│       ├── theme-modal.ts  language-modal.ts
│       └── preset-tool.ts  preset-card.ts  preset-detail.ts   # the ninth tool, Lit
├── services/                   # Business logic layer (kebab-case files)
│   ├── index.ts                # initializeServices() + the re-export barrel
│   ├── theme-service.ts  theme-switch.ts  language-service.ts  storage-service.ts
│   ├── router-service.ts  config-controller.ts  keyboard-service.ts
│   ├── modal-service.ts  toast-service.ts  tutorial-service.ts
│   ├── dye-service-wrapper.ts  api-service-wrapper.ts  api-worker-origin.ts
│   ├── market-board-service.ts  world-service.ts  pricing-mixin.ts
│   ├── collection-service.ts  saved-presets-service.ts  indexeddb-service.ts
│   ├── community-preset-service.ts  hybrid-preset-service.ts
│   ├── preset-submission-service.ts  auth-service.ts
│   ├── share-service.ts  harmony-generator.ts  mixer-blending-engine.ts
│   ├── chara-resolve-service.ts  telemetry-service.ts
│   └── display-options-helper.ts  tool-panel-builders.ts
├── shared/                     # Pure helpers, types, icon constants
│   ├── tool-config-types.ts  types.ts  i18n-types.ts  constants.ts
│   ├── subscription-manager.ts  error-handler.ts  logger.ts  utils.ts
│   ├── tool-handoff.ts  palette-export.ts  custom-dye.ts  dye-filter-utils.ts
│   └── *-icons.ts  app-logo.ts  glyph-accent.ts  preset-i18n.ts
├── styles/                     # themes.css, globals.css, tool-content.css,
│                               # v4-layout.css, tailwind.css, error-boundary.css
└── locales/                    # en ja de fr ko zh UI strings
```

---

## Features

### Two Themes

`standard-light` and `standard-dark`, with **Dark** as the default. The novelty themes were
retired in 5.0; a stored pre-5.0 theme name is migrated onto whichever of the two matches its
family rather than being discarded. Themes use CSS custom properties — see
[Theming](theming.md).

### Installable, but not offline

- Installable as a standalone app via `public/manifest.json`
- **No service worker and no offline cache.** The v3 `service-worker.js` was never shipped by the
  Vite build and was deleted in the 2026-08-16 cleanup
- `components/offline-banner.ts` only *reports* connectivity — it listens to `online`/`offline` and
  shows a banner; it caches nothing

### Responsive Design

- Mobile-first approach
- Breakpoints: 640px, 768px, 1024px, 1280px
- Touch-friendly interactions

### Localization Ready

- 6 languages (`en ja de fr ko zh`). **UI strings are the app's own** — `src/locales/<lang>.json`,
  read through `LanguageService`; `@xivdyetools/core` supplies the domain tables (dye names,
  categories, acquisitions, currencies, races/clans, harmony and vision-type names)
- Browser language detection
- Manual language selection

---

## Environment Variables

All four `VITE_*` overrides are **optional** — each falls back to its production URL when unset, so
a plain `pnpm --filter xivdyetools-web-app run dev` talks to the live backends.

```bash
# .env.local — override only what you are running locally
VITE_OAUTH_WORKER_URL=https://auth.xivdyetools.app
VITE_PRESETS_API_URL=https://api.xivdyetools.app
VITE_UNIVERSALIS_PROXY_URL=   # api-worker's /universalis routes
VITE_API_WORKER_URL=          # api-worker origin for /v1/chara/* and /v1/telemetry;
                              # dev default http://localhost:8790, prod data.xivdyetools.app
```

A fifth variable is a **build** switch rather than a runtime override: `VITE_APP_ENV=beta` (read in
`vite.config.ts`) turns on `vite-plugin-beta-branding` — the `[BETA]` title prefix, the beta icon
set and `X-Robots-Tag: noindex` on `dist/_headers`. It is set only by the beta deploy workflow.

See [Environment Variables](../../developer-guides/environment-variables.md) for the full
inventory across every project.

---

## Deployment

Cloudflare **Pages** (not Workers), two projects, both deployed by GitHub Actions with
`cloudflare/wrangler-action` running `pages deploy dist` — there is no Pages Git integration.
The shared mechanics are in [Deployment](../../developer-guides/deployment.md) and
[Deploy Environments](../../operations/DEPLOY_ENVIRONMENTS.md). What is specific to this app:

| Environment | Details |
|---|---|
| **Production** | Pages project `xivdyetools` → `xivdyetools.app`. `deploy-web-app.yml`, on push to `main`/`master` under the `apps/web-app/**` + `packages/{core,types,logger,svg}/**` path filter |
| **Beta** | A *second* Pages project, `xivdyetools-beta` → `beta.xivdyetools.app`. `deploy-web-app-beta.yml`, on push to any branch except `main`, `master` and `dependabot/**`. `--branch=beta` is load-bearing (the project's production branch) and fails **silently** without it. Beta reads and writes **production** preset data |
| **Development** | `pnpm --filter xivdyetools-web-app run dev` (localhost:5173) |

**Build.** Vite, `root: 'src'`, output `dist/`. The app bundles no WASM — resvg and Photon live in
the Workers. `scripts/check-bundle-size.js` gates `dist/` per chunk and runs in both workflows;
`scripts/check-beta-build.js` asserts a beta build really is one.

**After deploy**, both workflows run `scripts/smoke-test-pages.js` against the deployment just
made: production asserts it is **not** a beta build (`--expect-robots none`), beta asserts the
`noindex` header end-to-end — on the custom domain, not the `*.pages.dev` alias, because
Cloudflare injects `x-robots-tag: noindex` onto those hostnames itself.

**Two Pages caching hazards** (both real incidents, see `docs/operations/`): overlapping `_headers`
patterns **merge**, and an SPA catch-all plus `immutable` on `/assets/*` can cache an HTML fallback
under a `.js` URL for a year. `functions/_middleware.ts` is the standing guard against the second.

**CORS.** Every backend the app calls enforces an origin allowlist, so a new deployment origin (a
preview URL, a new beta domain) must be added there **before** it works — the failure looks like a
broken app but is a server-side config gap.

| Worker | Purpose |
|---|---|
| OAuth worker (`auth.xivdyetools.app`) | Authentication |
| Presets API (`api.xivdyetools.app`) | Community presets |
| api-worker (`data.xivdyetools.app`; `cors({ origin: '*' })`) | Market prices, `.chara` resolution, telemetry |
| OG worker (`og.xivdyetools.app`, routed on `xivdyetools.app/<tool>/*`) | Social preview images |

---

## Related Documentation

- [Tools](tools.md) - Detailed guide to all 9 tools
- [Components](components.md) - Lit component architecture
- [Theming](theming.md) - Theme system documentation
- [Deployment](../../developer-guides/deployment.md) - The shared deployment guide
- [User Guide](../../user-guides/web-app/getting-started.md) - End-user documentation
