# Web App Overview

**xivdyetools-web-app** v4.10.0 - Interactive browser-based toolkit for FFXIV dye colors

The dye database backing the app is **125 standard dyes plus 11 Facewear color entries** (the Facewear entries get synthetic negative IDs at runtime so they share the `Dye.itemID: number` shape but never collide with real game item IDs).

---

## What is the Web App?

A fully-featured web application built with Lit and Vite, offering 9 interactive tools for exploring FFXIV dye colors:

| Tool | Purpose |
|------|---------|
| **Palette Extractor** | Find closest dye to any color + palette extraction |
| **Color Harmony Explorer** | Discover harmonious dye combinations |
| **Gradient Builder** | Create gradients between two dyes |
| **Dye Mixer** | Blend two dyes together (RGB averaging) |
| **Swatch Matcher** | Match character colors to dyes |
| **Dye Comparison** | Compare dyes side-by-side |
| **Accessibility Checker** | Colorblindness simulation |
| **Community Presets** | Browse community dye palettes |
| **Budget Suggestions** | Find affordable dye alternatives using market data |

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

```bash
cd xivdyetools-web-app

# Install dependencies
npm install

# Start dev server (localhost:5173)
npm run dev

# Run tests
npm test

# Build for production
npm run build
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
│   │   ├── dye-action-dropdown/
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
│   ├── themes/                 # 12 theme files
│   ├── v4-utilities.css        # v4 NEW: Glassmorphism styles
│   └── tailwind.css
└── utils/                      # Helper functions
```

---

## Features

### 12 Themes

The app includes 12 professionally designed themes:

- **Light themes**: Default Light, Forest, Ocean, Sunset
- **Dark themes**: Default Dark, Midnight, Void, Abyss
- **Special**: High Contrast, Eorzean Gold, Crystal Tower, Moogle

Themes use CSS custom properties for easy customization.

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

```bash
# .env.local
VITE_OAUTH_URL=https://oauth.xivdyetools.com
VITE_PRESETS_API_URL=https://presets.xivdyetools.com
VITE_ANALYTICS_ID=optional-analytics-id
```

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
