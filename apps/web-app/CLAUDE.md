# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The main XIV Dye Tools web application — a static SPA that runs entirely in the browser. It is the primary consumer of `@xivdyetools/core` and exposes nine standalone tools backed by the 136-dye database.

**Stack:** Vite 8 + Lit 3 (web components) + Tailwind CSS 4 + TypeScript (strict). Test stack is Vitest 4 (jsdom) + Playwright 1.59 with multi-project E2E. Deployed as a static bundle (Cloudflare Pages / Netlify) with a service worker for offline support.

### The Nine Tools (`ToolId` from `services/router-service.ts`)

| ID | Title | What it does |
|----|-------|--------------|
| `harmony` | Harmony Explorer | Generates color-theory palettes (complementary, triadic, analogous, etc.) from a base dye |
| `extractor` | Palette Extractor | Uploads an image and pulls a palette via K-means++; matches each swatch to the closest FFXIV dye |
| `accessibility` | Accessibility Checker | Colorblindness simulation (5 vision types) + WCAG contrast |
| `comparison` | Dye Comparison | Side-by-side compare for up to 4 dyes with hex/RGB/HSV/LAB readouts |
| `gradient` | Gradient Builder | Multi-stop gradients between dyes (was "mixer" in v3) |
| `mixer` | Dye Mixer | Pure two-dye blend across six color spaces (RGB, LAB, OKLAB, RYB, HSL, Spectral via spectral.js) |
| `presets` | Community Presets | Browse / submit / vote on community dye presets via the presets-api worker |
| `budget` | Budget Suggestions | Universalis-priced "what dyes can I afford?" picker |
| `swatch` | Swatch Matcher | Match to character/skin/hair/eye reference swatches (was "character" in v3) |

## Commands

```bash
npm run dev                  # vite dev server on localhost:5173
npm run build                # tsc --noEmit && vite build
npm run preview              # serve the production build
npm run type-check           # tsc --noEmit only
npm run lint                 # eslint with --fix
npm run format               # prettier --write src/**/*.ts

npm run test                 # vitest run
npm run test:watch           # vitest in watch mode
npm run test:ui              # vitest UI
npm run test:coverage        # vitest with coverage thresholds

npm run test:e2e             # playwright test (chromium project)
npm run test:e2e:ui          # playwright --ui
npm run test:e2e:headed      # playwright --headed
npm run test:e2e:report      # show last HTML report
npm run test:e2e:coverage    # chromium-coverage project (V8 coverage via CDP)
npm run test:e2e:mobile      # mobile-chrome project
npm run test:e2e:comparison  # only dye-comparison.spec.ts

npm run build:css            # tailwindcss → assets/css/tailwind.css
npm run build:css:watch      # tailwindcss --watch
npm run check-bundle-size    # validate dist/ bundles against limits
npm run validate:i18n        # check locale completeness
npm run build:check          # build + check-bundle-size (CI guard)
```

### Pre-commit Checklist

```bash
npm run lint && npm run test -- --run && npm run type-check && npm run build:check
```

## Architecture

The app boots from `src/main.ts`, which initializes services, then dynamically imports `@components/v4-layout` (the v4 glassmorphism shell). Tools are lazy-loaded from inside the shell when the user navigates to them.

```
src/main.ts
   │
   ├─ initializeServices() ── theme, storage, language, api, dye, palette, ...
   ├─ import('@components/v4-layout')
   │     └─ V4LayoutShell ── header + tool-banner + sidebar + content slot
   │           └─ RouterService routes ToolId → dynamic import('@components/<tool>-tool')
   │                 └─ activeTool.init(container)   ◄── BaseComponent contract
   │
   └─ Lazy modals: welcome-modal, changelog-modal, theme-modal, language-modal, about-modal
```

### Key Directories

```
src/
├── main.ts                          # Bootstrap, error handling, dev-only mockup loader
├── components/
│   ├── base-component.ts            # BaseComponent abstract class (init/render/destroy)
│   ├── v4-layout.ts                 # Layout entry point, RouterService glue, tool lazy-load
│   ├── v4/                          # Lit-based v4 shell pieces (header, sidebar, modals)
│   │   ├── v4-layout-shell.ts       # Custom element <v4-layout-shell>
│   │   ├── config-sidebar.ts        # Centralized config panel
│   │   ├── theme-modal.ts           # Theme picker
│   │   ├── language-modal.ts        # Language picker
│   │   └── ... range-slider, toggle-switch, glass-panel, share-button, color-wheel
│   ├── harmony-tool.ts              # The nine tool components (lazy-loaded chunks)
│   ├── extractor-tool.ts
│   ├── accessibility-tool.ts
│   ├── comparison-tool.ts
│   ├── gradient-tool.ts
│   ├── mixer-tool.ts
│   ├── preset-tool.ts
│   ├── budget-tool.ts
│   ├── swatch-tool.ts
│   ├── modal-container.ts           # Modal stack/host
│   ├── toast-container.ts           # ToastService host
│   ├── tutorial-spotlight.ts        # First-run tutorial overlay
│   ├── welcome-modal.ts             # First-visit welcome
│   ├── changelog-modal.ts           # "What's New" modal (parses CHANGELOG.md at build time)
│   └── ... color-display, color-wheel-display, dye-grid, dye-search-box, market-board, etc.
├── services/
│   ├── index.ts                     # initializeServices(), getServicesStatus(), re-exports
│   ├── router-service.ts            # ToolId, ROUTES, history.pushState navigation
│   ├── config-controller.ts         # Centralized tool config state
│   ├── theme-service.ts             # 12 themes, persists via storage
│   ├── language-service.ts          # 6 languages: en, ja, de, fr, ko, zh
│   ├── storage-service.ts           # localStorage wrapper, all keys prefixed
│   ├── auth-service.ts              # Discord OAuth via oauth worker, JWT in localStorage
│   ├── api-service-wrapper.ts       # Wraps core APIService (Universalis through proxy)
│   ├── dye-service-wrapper.ts       # Wraps core DyeService
│   ├── harmony-generator.ts         # Color-harmony math
│   ├── palette-service.ts           # K-means++ palette extraction for image upload
│   ├── community-preset-service.ts  # Talks to presets-api worker
│   ├── hybrid-preset-service.ts     # Local + community preset combiner
│   ├── market-board-service.ts      # Universalis pricing for budget/comparison
│   ├── world-service.ts             # FFXIV worlds + datacenters
│   ├── share-service.ts             # Share URLs + analytics
│   ├── modal-service.ts             # Modal stack
│   ├── toast-service.ts             # Toasts
│   ├── tooltip-service.ts           # Hoverable tooltips
│   ├── tutorial-service.ts          # First-run tutorial flows per tool
│   ├── announcer-service.ts         # ARIA live-region screen-reader output
│   ├── keyboard-service.ts          # Global shortcuts
│   ├── camera-service.ts            # Camera-preview-modal capture
│   ├── indexeddb-service.ts         # IDB wrapper for cached community presets
│   └── pricing-mixin.ts             # Shared price-formatting helpers
├── shared/
│   ├── constants.ts                 # APP_VERSION, STORAGE_PREFIX, etc.
│   ├── error-handler.ts             # Centralized error mapping + user-friendly messages
│   ├── logger.ts                    # Wraps @xivdyetools/logger for browser
│   ├── utils.ts                     # escapeHtml, clearContainer, debounce, etc.
│   ├── ui-icons.ts                  # SVG icon constants (innerHTML-safe, all static)
│   ├── tool-icons.ts / harmony-icons.ts / category-icons.ts / empty-state-icons.ts
│   ├── i18n-types.ts / tool-config-types.ts / browser-api-types.ts / types.ts
│   └── subscription-manager.ts      # Pub/sub helpers for service events
├── styles/                          # themes.css (12 themes), v4-utilities.css, v4-layout.css, tailwind.css
├── locales/                         # Per-language UI strings (en, ja, de, fr, ko, zh)
└── public/                          # robots.txt, manifest.json, _headers (CSP)
# (dev-only mockups relocated 2026-05-31 → docs/historical/web-app/20260531-Mockups/ — see docs/audits/2026-05-31/findings/DEAD-112.md)
```

### Path Aliases (vite.config.ts + tsconfig)

```typescript
import { ColorService } from '@services/index';
import { BaseComponent } from '@components/base-component';
import { escapeHtml } from '@shared/utils';
import { THEMES } from '@v4/theme-modal';
// Also: @, @apps, @data, @assets
```

## Key Patterns

### Component Lifecycle

Every tool extends `BaseComponent`, which standardizes init/render/destroy. Tools render into a single container element handed to them by `v4-layout.ts`. When the user navigates away, the layout calls `activeTool.destroy()` before swapping in the next tool.

```typescript
export class MyTool extends BaseComponent {
  init(): void { this.container.innerHTML = this.render(); this.attachEventListeners(); }
  render(): string { return `<div style="color: var(--theme-text)">...</div>`; }
  destroy(): void { /* remove listeners, clear timers */ }
}
```

### Routing

`RouterService` owns `history.pushState`, parses `LEGACY_ROUTE_REDIRECTS` (e.g. `/matcher` → `/extractor`), and emits navigation events. `ROUTES` is the single source of truth for `ToolId → path → title`.

### Service Initialization

`initializeServices()` runs in a fixed order (theme → storage → api → dye → palette → ...). Services are singletons — there is no DI container; every consumer imports the same module. Mutating a service in one tool affects all tools.

### Theme Tokens (Never Hardcode Colors)

Twelve themes in `styles/themes.css` define `--theme-*` CSS variables. Components must use these tokens; hardcoded colors break theme switching. Tailwind sees the variables via the `@apply`-friendly setup in `tailwind.config.js`.

```css
color: var(--theme-text);
background: var(--theme-card-background);
border-color: var(--theme-border);
```

### Lazy Loading & Manual Chunks

`vite.config.ts` declares manual chunks so the initial bundle stays small:

- `vendor-core` — `@xivdyetools/core` (~1.2 MB raw, dye DB + locales)
- `vendor-lit` — Lit framework
- `vendor-spectral` — `spectral.js` (used only by Mixer)
- `vendor` — everything else from `node_modules`
- `modals` — welcome + changelog modals (loaded once)

Each tool component is its own dynamic import.

### Storage Keys

All `StorageService` keys are prefixed with `xivdyetools_`. Tutorial-offered flags use `${STORAGE_PREFIX}_tutorial_offered_${tool}`.

### Universalis Pricing

`MarketBoardService` calls Universalis through `proxy.xivdyetools.app` (the universalis-proxy worker), never the upstream directly — this is the only way the browser gets reliable CORS. Synthetic-ID Facewear dyes (`itemID < 0`) are filtered out before any market call.

### Service Worker

`service-worker.js` handles offline fallback for navigation requests. The `OfflineBanner` component listens to `online`/`offline` events.

## Custom Vite Plugins

| Plugin | File | Role |
|--------|------|------|
| `asyncCss` | `vite-plugin-async-css.ts` | Defers non-critical CSS to avoid render-block |
| `changelogParser` | `vite-plugin-changelog-parser.ts` | Parses `CHANGELOG.md` into a JSON module the changelog modal imports |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@xivdyetools/core` | Dye database, color algorithms, Universalis client |
| `@xivdyetools/types` | `HexColor`, `DyeId`, branded types |
| `@xivdyetools/logger` | Browser-flavored logger |
| `lit` | Web-components framework for v4 shell pieces |
| `spectral.js` | Pigment-physics color blending (Mixer "Spectral" mode) |
| `@tailwindcss/postcss` / `tailwindcss` | Styling |
| `vite` | Bundler / dev server |
| `vitest` / `@vitest/coverage-v8` | Unit tests |
| `@playwright/test` | E2E |
| `msw` | Network mocks for unit tests |
| `@xivdyetools/test-utils` | Shared test factories (devDependency) |

## Build & Bundle Notes

- `npm run build:check` runs `vite build` then `scripts/check-bundle-size.js`, which enforces per-bundle byte ceilings (e.g. main entry ≤ 150 KB raw, layout shell ≤ 200 KB). CI fails if a chunk grows past its budget.
- Webfonts (Cinzel, Lexend, Habibi) are self-hosted under `fonts/` as woff2. CJK rendering for SVG export uses subset Noto Sans SC + Noto Sans KR fonts shipped from `@xivdyetools/svg`.
- `src/index.html` is the Vite entry; `vite.config.ts` sets `root: 'src'` and `outDir: '../dist'`.
- `assets/css/tailwind.css` is built by `npm run build:css` and committed; the dev script does **not** rebuild Tailwind on save — use `build:css:watch` in another terminal if you're editing styles.
- `public/_headers` (Netlify/Pages) sets the production CSP: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'`.
- `manifest.json`, `robots.txt`, `service-worker.js` ship from the root (not via `public/`) due to historical filesystem layout.

## Security Patterns

- **innerHTML for static SVG only** — icons in `shared/*-icons.ts` are compile-time constants. User content always goes through `textContent` or `escapeHtml`.
- **Tokens in localStorage** — `auth-service.ts` documents the rationale: strict CSP prevents XSS exfil, expiry is checked on every `isAuthenticated()` call, server revokes on logout.
- **CSP** — production headers prevent inline scripts, frame embedding, and form hijacking.
- **No PII in analytics** — `share-service.ts` analytics uses opaque event names only.

## Testing

- **Unit (Vitest, jsdom):** Co-located `*.test.ts` next to source, plus `src/__tests__/`. Coverage thresholds 80% lines/functions/branches.
- **E2E (Playwright):** `e2e/` directory. Three projects: `chromium` (default), `chromium-coverage` (V8 coverage via CDP, merged in `global-teardown.ts`), `mobile-chrome`.
- **Mocks:** `msw` intercepts network in unit tests; `@xivdyetools/test-utils` for shared factories.

```bash
npx vitest run src/services/__tests__/color-service.test.ts
npx playwright test --project=mobile-chrome
```

## Related Projects

**Dependencies:**
- `@xivdyetools/core`, `@xivdyetools/types`, `@xivdyetools/logger`

**Sibling apps it talks to:**
- `xivdyetools-presets-api` — community presets (HTTPS)
- `xivdyetools-oauth` — Discord login + JWT issuance
- `xivdyetools-universalis-proxy` — market-board pricing (CORS proxy)
- `xivdyetools-og-worker` — dynamic OpenGraph images for share links

## Documentation

The project's deeper design docs live in `docs/` inside this app folder (`ARCHITECTURE.md`, `SERVICES.md`, `TOOLS.md`, `STYLE_GUIDE.md`, `TROUBLESHOOTING.md`) and the repo-level `xivdyetools/docs/`.
