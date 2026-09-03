# Web App Overview

**xivdyetools-web-app** v5.0.0 - Interactive browser-based toolkit for FFXIV dye colors

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

- **The 5.0 redesign** — every tool re-ported onto the console bar + tool rail shell with an Advanced Options panel and result cards; themes reduced to Light + Dark ([theming](theming.md)); one matching vocabulary (`ciede2000` default / `oklab` / `cie76` / `redmean` / `rgb` / `distinguish`); share URLs key on stainID (`?dye=<stainID>`, `?hex=` bare colours; legacy itemID links rejected loudly); `CollectionService` 5.0 is the single saved-things store (stainID-keyed, 4.x data migrated on load); `.chara` character-file import in the Swatch Matcher; self-hosted fonts; root OG cards; beta build (`VITE_APP_ENV=beta`); locale keys 1,041 → 1,489 × 6. The v4.x notes below are historical.

### New in v4.10.0

- **Result Card v4 "Spectrum" row** — Shows the consolidated dye spectrum (Standard / Wide #1 / Wide #2) on every match across Harmony, Gradient, Budget, Swatch, and Extractor; new `common.spectrum` i18n key in all 6 locales
- **SEC-001 XSS hardening** — `auth-button.ts` `innerHTML` interpolation of OAuth user character name / server replaced with `createElement` + `textContent`; CSP `script-src 'self'` provides defense-in-depth
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

```
src/
├── components/                 # Lit web components
│   ├── tools/                  # Tool-specific components
│   │   ├── palette-extractor/     # v4: was color-matcher
│   │   ├── gradient-builder/      # v4: was dye-mixer
│   │   ├── dye-mixer/             # v4 NEW: RGB blending
│   │   ├── swatch-matcher/        # v4 NEW: character colors
│   │   ├── harmony-explorer/
│   │   ├── dye-comparison/
│   │   ├── accessibility-checker/
│   │   ├── community-presets/     # v4: was preset-browser
│   │   └── budget-suggestions/
│   ├── v4/                     # v4 NEW: Glassmorphism components
│   │   ├── v4-layout-shell.ts
│   │   ├── glass-panel.ts
│   │   ├── result-card.ts
│   │   └── ...
│   ├── shared/                 # Reusable components
│   │   ├── color-swatch/
│   │   ├── dye-picker/
│   │   ├── slot-selection-modal/
│   │   └── ...
│   └── layout/                 # App shell components
├── services/                   # Business logic layer
│   ├── ThemeService.ts         # Theme management
│   ├── StorageService.ts       # localStorage persistence
│   ├── AuthService.ts          # OAuth integration
│   ├── PresetService.ts        # Preset API client
│   ├── ConfigController.ts     # v4 NEW: Centralized tool config
│   └── SubscriptionManager.ts  # Reactive subscription cleanup
├── styles/                     # Global styles
│   ├── themes.css              # Light + Dark theme variables
│   ├── v4-layout.css
│   ├── error-boundary.css
│   ├── globals.css
│   └── tailwind.css
└── utils/                      # Helper functions
```

---

## Features

### Two Themes

`standard-light` and `standard-dark`, with **Dark** as the default. The novelty themes were
retired in 5.0; a stored pre-5.0 theme name is migrated onto whichever of the two matches its
family rather than being discarded. Themes use CSS custom properties — see
[Theming](theming.md).

### PWA Support

- Installable as standalone app
- Offline caching for static assets
- Fast startup via service worker

### Responsive Design

- Mobile-first approach
- Breakpoints: 640px, 768px, 1024px, 1280px
- Touch-friendly interactions

### Localization Ready

- 6 languages via @xivdyetools/core
- Browser language detection
- Manual language selection

---

## Environment Variables

All three are **optional** — each falls back to its production URL when unset, so a plain
`pnpm --filter xivdyetools-web-app run dev` talks to the live backends.

```bash
# .env.local — override only what you are running locally
VITE_OAUTH_WORKER_URL=https://auth.xivdyetools.app
VITE_PRESETS_API_URL=https://api.xivdyetools.app
VITE_UNIVERSALIS_PROXY_URL=   # api-worker's /universalis routes
```

See [Environment Variables](../../developer-guides/environment-variables.md) for the full
inventory across every project.

---

## Deployment

The app is deployed to Cloudflare Pages:

```bash
# Build
npm run build

# Preview locally
npm run preview

# Deploy (via Cloudflare Pages GitHub integration)
git push origin main
```

---

## Related Documentation

- [Tools](tools.md) - Detailed guide to all 9 tools
- [Components](components.md) - Lit component architecture
- [Theming](theming.md) - Theme system documentation
- [Deployment](deployment.md) - Deployment procedures
- [User Guide](../../user-guides/web-app/getting-started.md) - End-user documentation
