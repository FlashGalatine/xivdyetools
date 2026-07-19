# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`xivdyetools-og-worker` is a Cloudflare Worker that generates **dynamic OpenGraph previews** for shared XIV Dye Tools links. It serves two distinct surfaces:

1. **Crawler interception** — when Discord, Twitter, Facebook, Slack, etc. fetch a tool URL like `xivdyetools.app/harmony/?dye=5771&harmony=tetradic`, the worker detects the bot by `User-Agent` and returns HTML stuffed with locale-aware `og:*` meta tags. Real users get passed through to the SPA.
2. **OG image rendering** — direct PNG endpoints under `/og/*` produce 1200×630 social cards by composing tool-specific SVGs and rasterizing through `resvg-wasm`. Five fonts are bundled as `*.ttf` data imports at build time: Space Grotesk, Onest, Habibi, plus the CJK subsets `NotoSansSC-Subset.ttf` (~290 KiB) and `NotoSansKR-Subset.ttf` (~176 KiB) for ja/zh/ko dye names (regenerate via `scripts/subset-cjk-fonts.py` whenever dyes or locale strings change).

Six tools are supported: harmony, gradient, mixer, swatch, comparison, accessibility. Each has its own SVG generator under `src/services/svg/`. Localization is handled via a stateless `TranslationProvider` with all 6 locales eagerly preloaded — concurrent requests with different `?lang=` cannot trample state (see REFACTOR-001).

## Commands

```bash
pnpm dev                    # wrangler dev
pnpm deploy                 # Deploy to staging (default env)
pnpm deploy:production      # Deploy to env.production
pnpm test                   # vitest run
pnpm test:watch             # vitest in watch mode
pnpm test:coverage          # vitest run --coverage
pnpm type-check             # tsc --noEmit
```

### Pre-commit Checklist

```bash
pnpm type-check && pnpm test
```

(There is no `lint` script in this worker's `package.json`.)

## Architecture

```
Crawler request                          Image request
(/harmony/?dye=5771...)                  (/og/harmony/5771/tetradic.png)
  │                                        │
  ├─► requestIdMiddleware                  ├─► requestIdMiddleware
  ├─► loggerMiddleware                     ├─► loggerMiddleware
  ├─► detectCrawlerFromRequest             ├─► validate IDs / bounds
  │   ├─ isCrawler? → generateOGHTML       ├─► generate{Tool}OG()  → SVG string
  │   └─ else       → fetch(originSPA)     └─► renderOGImage(svg)  → PNG via resvg-wasm
```

### Key Directories

```
src/
├── index.ts                    # Hono app, route table, crawler/image dispatch
├── types.ts                    # Env, ToolId, HarmonyType, VisionType, OGData, AnalyticsEvent
├── crawler-detector.ts         # User-Agent regex table (Discord, Twitter, FB, LinkedIn, Slack, Telegram, WhatsApp, Applebot…)
├── og-data-generator.ts        # Builds locale-aware {title, description, imageUrl} + final HTML
├── fonts/
│   ├── Onest-VariableFont_wght.ttf    # Body / labels (variable 100–900)
│   ├── SpaceGrotesk-VariableFont_wght.ttf  # Headers (variable 300–700)
│   └── Habibi-Regular.ttf              # Hex codes (static regular)
└── services/
    ├── fonts.ts                # getFontBuffers() + FONT_FAMILIES export
    ├── renderer.ts             # initRenderer() + renderSvgToPng() + renderOGImage()
    └── svg/
        ├── base.ts             # Primitives (rect, text, circle, gradients, escapeXml) + THEME, FONTS, OG_DIMENSIONS
        ├── og-card.ts          # Common 1200×630 layout (header bar + content slot + footer)
        ├── dye-helpers.ts      # Shared dye-rendering helpers
        ├── harmony.ts          # generateHarmonyOG()
        ├── gradient.ts         # generateGradientOG()
        ├── mixer.ts            # generateMixerOG() (2- or 3-dye overload)
        ├── swatch.ts           # generateSwatchOG()        — async, may consult color sheets
        ├── comparison.ts       # generateComparisonOG()
        ├── accessibility.ts    # generateAccessibilityOG() — applies vision simulation
        └── index.ts            # Barrel re-exports
```

### Routes

**Crawler-intercept routes** (return HTML with OG meta tags to bots, pass-through to origin for humans):

- `GET /` — site root (redirects humans to `APP_BASE_URL`)
- `GET /:tool` and `GET /:tool/` for `tool ∈ { harmony, gradient, mixer, swatch, comparison, accessibility }`

**OG image routes** (return `image/png`):

| Pattern | Notes |
|---|---|
| `GET /og/harmony/:dyeId/:harmonyType[.png]` | `?algo=oklab\|ciede2000\|euclidean` |
| `GET /og/gradient/:startId/:endId/:steps[.png]` | `steps` clamped to 2–20 (`OG_MAX_GRADIENT_STEPS`) |
| `GET /og/mixer/:dyeAId/:dyeBId/:ratio[.png]` | 2-dye mix; ratio 1–99 |
| `GET /og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio[.png]` | 3-dye mix; ratio 1–99 |
| `GET /og/swatch/:color/:limit[.png]` | `?sheet=`, `?race=`, `?gender=`, `?algo=`; `limit` 1–20 |
| `GET /og/comparison/:dyes[.png]` | `:dyes` is comma-separated itemIDs, max 16 |
| `GET /og/accessibility/:dyes/:visionType[.png]` | vision: normal, protanopia, deuteranopia, tritanopia, achromatopsia |
| `GET /og/default.png` | Generic fallback card; cached 7 days |
| `GET *` | Fallthrough — minimal OG for crawlers, `fetch(req)` to origin for humans |

All image responses set `Cache-Control: public, max-age=86400, s-maxage=604800` (24h browser, 7d edge — BUG-068: `renderOGImage` now takes explicit `{ browser, edge }` TTLs instead of an implicit ×7 multiplier), plus a duplicated `CDN-Cache-Control`. Crawler HTML is `max-age=3600, s-maxage=86400`.

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---|---|---|
| `ANALYTICS` | Analytics Engine Dataset (`xivdyetools_og_analytics`) | `writeDataPoint` for `og_request` / `og_image_request` events. Failures swallowed. |
| `OG_CACHE` | KV (optional, declared in `types.ts` only) | Reserved for future caching — **not currently bound** in `wrangler.toml`. |
| `APP_BASE_URL` | Var | `https://xivdyetools.app` — used for redirects and canonical URLs |
| `OG_IMAGE_BASE_URL` | Var | `https://og.xivdyetools.app` — base for `og:image` URLs |

Routes (production): `xivdyetools.app/{harmony,gradient,mixer,swatch,comparison,accessibility}/*`. Compatibility date `2024-12-01`. **No `nodejs_compat`** (per ARCH-001). The `[[rules]]` block declares `**/*.ttf` as Data imports so wrangler bundles fonts as `ArrayBuffer`s.

### Required Secrets / Optional Secrets

None. Worker is public-facing and stateless.

## Key Patterns

### Image Dimensions

`OG_DIMENSIONS = { width: 1200, height: 630 }` (Twitter/Discord standard) is exported from `services/svg/base.ts`. Every SVG generator targets these dimensions; the `og-card.ts` shell wraps tool content with a header bar (tool name + branding) and footer bar (URL + algorithm).

### resvg-wasm Initialization

Cloudflare Workers disallow dynamic `WebAssembly.instantiate()`, so `services/renderer.ts` uses a **static WASM import** (`import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'`) bundled at build time. `initRenderer()` lazily calls `initWasm(resvgWasm)` once per isolate — guarded by both `wasmInitialized` and `wasmInitPromise` so concurrent first-requests don't race.

### Font Bundling

`services/fonts.ts` does static `import` of all five TTFs (three brand fonts + Noto Sans SC/KR subsets) and caches `Uint8Array` views in module scope. `getFontBuffers()` is passed to `Resvg`'s `font.fontBuffers`; `defaultFontFamily: 'Onest'`. Fonts are referenced in SVG via the `font-family` strings exposed in `FONTS` (re-exported from `@xivdyetools/svg` since REFACTOR-009) and `FONT_FAMILIES` (in `fonts.ts`). CJK rendering for `?lang=ja|ko|zh` works via the bundled subsets — if new dye names introduce unseen glyphs, re-run `scripts/subset-cjk-fonts.py`.

### Crawler Detection

`crawler-detector.ts` runs a small ordered regex table against `User-Agent`. Notably, `Googlebot` is **commented out** — Google requests are intentionally passed through to the SPA so the SPA's own SEO content takes precedence. Apple's `Applebot` (iMessage previews) IS treated as a crawler.

### Stateless Localization (REFACTOR-001)

`og-data-generator.ts` builds a module-scope `TranslationProvider` with all 6 locales preloaded. Each lookup passes the `LocaleCode` explicitly — this **diverges from `api-worker`** which uses `LocalizationService.setLocale()` middleware. The reason: `og-worker` may serve concurrent requests with different `?lang=` query params and the singleton pattern would race. See OPT-001 in the audit log.

### Parameter Bounds (FINDING-003)

Image route parameters are bounded to prevent resource exhaustion: `OG_MAX_GRADIENT_STEPS=20`, `OG_MIN_MIXER_RATIO=1`, `OG_MAX_MIXER_RATIO=99`, `OG_MAX_SWATCH_LIMIT=20`, `OG_MAX_COMPARISON_DYES=16`. `parseInt` results are NaN-checked (FINDING-011) and rejected with 400 before reaching the SVG generators.

### Analytics

`trackAnalytics()` writes to Analytics Engine with `event`/`tool`/`crawler` blobs and `timestamp`/`cacheHit` doubles, indexed by `tool`. Errors are caught and logged but never break the request (analytics is best-effort).

## Dependencies

| Package | Purpose |
|---|---|
| `hono` | HTTP framework |
| `@resvg/resvg-wasm` | SVG → PNG rasterizer (WASM, statically imported) |
| `@cloudflare/workers-types` | Type defs for Analytics Engine, KV, etc. |
| `@xivdyetools/core` | `DyeService`, `dyeDatabase`, `LocaleLoader`/`LocaleRegistry`/`TranslationProvider`, `extractLocaleCode` |
| `@xivdyetools/types` | `Dye`, `LocaleCode`, `HarmonyTypeKey`, `SheetKey`, `ToolKey`, `VisionType` |
| `@xivdyetools/worker-middleware` | `requestIdMiddleware`, `loggerMiddleware`, `getLogger` |

## Related Projects

**Dependencies (internal):** `@xivdyetools/core`, `@xivdyetools/types`, `@xivdyetools/worker-middleware`.

**Service Bindings:** None. `og-worker` does not call other workers and is not called by other workers.

**Sibling:** The main SPA at `apps/web-app/` produces the URLs that this worker intercepts — when the SPA's share-link generator changes parameter shapes, the matching `services/svg/<tool>.ts` and `og-data-generator.ts` must be updated in sync.

## Deployment Checklist

1. `pnpm type-check && pnpm test` — must be green.
2. If a new tool was added: register the route in `wrangler.toml` AND in the `SUPPORTED_TOOLS` array in `index.ts` AND add a `services/svg/<tool>.ts` generator.
3. If fonts changed: re-run `scripts/subset-cjk-fonts.py` if dye/locale strings changed (CJK subsets must cover every rendered glyph or resvg falls back to tofu).
4. Bump `version` in `package.json` if behavior changed.
5. `pnpm deploy` to staging; spot-check a Discord embed via `https://og.xivdyetools.app/og/harmony/5771/tetradic.png`.
6. `pnpm deploy:production`. Validate a real shared link in Discord — the embed should render the new SVG within ~5s of cache expiry.
