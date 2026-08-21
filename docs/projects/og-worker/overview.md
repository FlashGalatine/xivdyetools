# OpenGraph Worker Overview

**xivdyetools-og-worker** v2.1.0 - Dynamic OpenGraph metadata for social media previews

---

## What is the OG Worker?

A Cloudflare Worker that generates dynamic OpenGraph metadata and preview images when XIV Dye Tools links are shared on social media platforms. When you share a link like `https://xivdyetools.app/harmony?dye=1` on Discord, Twitter, or Facebook, this worker intercepts the request and returns rich preview content.

### Recent Changes

- **v2.2.0** — The 2026-08-20 i18n audit: the crawler's `og:title` / `og:description` are authored ×6 (`OG_EMBED`, `services/og-embed.ts`) instead of English templates with localized nouns spliced in; band role words (BASE / TARGET / AS DESIGNED …) localize via `OG_ROLE`; dye names in the embed localize like the card; tool names come from `OG_DECK`, never core `tools.*`; `<html lang>` + `og:locale` follow the locale; CJK subsets re-cut. Companion: the web-app now puts `?lang=` on every non-English share URL — before that, no real share ever reached the localized path
- **v2.1.0** — 2026-08-18 dead-code audit executed (28 findings, `docs/audits/2026-08-18-og-worker-dead-code/`): the extractor / presets / budget crawler HTML now emits their 15E cards (it emitted the root default — the cards were unreachable), `/presets/:id` crawler route, comparison honours `?frame=x`, `?algo=` rides the harmony / gradient / mixer image URLs, extractor accepts bare `RRGGBB` (equal ranked bands), ~500 lines of 15E-rewrite sediment removed (`base.ts`, the colour-sheet lookup), `services/svg/tokens.ts`, CJK subsets −45 KB, base tsconfig flags restored
- **v2.0.0** — The 5.0 card rewrite: one 15E band frame for all nine tools (Discord 1200×1050, X 1200×630 via `?frame=x`), per-tool default cards (`/og/:tool/default.png`, `/og/default.png`), `?lang=` reaches the picture, share URLs and `/og/<tool>/:dyeId…` paths key on **stainID** (legacy itemIDs miss into the default card), `?algo=` speaks the 5.0 matching vocabulary, `Helion` → `Helions`, a routed **beta** env (`beta.xivdyetools.app/<tool>/*` + `og-beta.xivdyetools.app`), and the missing `/og/` prefix on every emitted `og:image` URL fixed (no generated card had ever been fetched)
- **v1.4.0** — 2026-07-18 audit: `?algo=` / 3-dye `ratio` actually honoured, explicit browser/edge TTLs, `@xivdyetools/svg` re-exports replace the local fork
- **v1.2.0** — `?lang=` localized metadata, `@xivdyetools/worker-middleware` (now `worker-kit`)

### Why a Separate Worker?

- **Crawler detection** - Social media crawlers need different responses than regular users
- **Dynamic images** - Generate preview images on-the-fly based on URL parameters
- **Edge rendering** - Fast global response times via Cloudflare's edge network
- **No database needed** - All data encoded in URL, stateless operation

---

## Quick Start (Development)

```bash
cd xivdyetools-og-worker

# Install dependencies
npm install

# Start local dev server
npm run dev

# Deploy — bare `deploy` publishes the routed BETA worker (xivdyetools-og-worker-dev, beta.xivdyetools.app/<tool>/*)
npm run deploy
# Production (xivdyetools-og-worker, xivdyetools.app/<tool>/* + og.xivdyetools.app)
npm run deploy:production
```

See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../operations/DEPLOY_ENVIRONMENTS.md).

---

## Supported Platforms

The worker detects and serves optimized content for:

| Platform | User Agent Pattern | Image Size |
|----------|-------------------|------------|
| Discord | Discordbot | 1200x1050 (`og:image`, default frame) |
| Twitter/X | Twitterbot | 1200x630 (`twitter:image` carries `?frame=x`) |
| Facebook | facebookexternalhit | 1200x1050 |
| LinkedIn | LinkedInBot | 1200x1050 |
| Slack | Slackbot | 1200x1050 |
| Telegram | TelegramBot | 1200x1050 |
| iMessage | AppleWebKit | 1200x1050 |

Both frames are the same 400-wide design grid rastered ×3 (Discord 400×350, X 400×210) and take separate cache keys.

---

## Architecture

### Request Flow

```
User shares link → Social platform crawls URL → OG Worker intercepts
     ↓
Crawler detected? → Yes → Generate OG HTML with dynamic image URL
     ↓
                    No → Redirect to web app (302)
```

### Dynamic Image Generation

```
/og/harmony/:dyeId.png → SVG template → resvg-wasm → PNG response
```

1. Parse dye ID from URL
2. Look up dye data from embedded database
3. Generate SVG with dye info and color swatches
4. Render SVG to PNG via resvg-wasm
5. Return image with cache headers

---

## Routes

### Tool Preview Routes

These routes intercept normal web app URLs when accessed by crawlers:

`SUPPORTED_TOOLS` = `harmony`, `gradient`, `mixer`, `swatch`, `comparison`, `accessibility`, `extractor`, `presets`, `budget` — one `GET /<tool>` handler each, reading the web app's share-URL query grammar. Every dye parameter is a **stainID (1–254)**; legacy itemIDs (≥ 5729) render the tool's default card instead of a wrong dye.

| Route (crawler intercept) | Share-URL parameters read |
|-------|-------------|
| `/harmony` | `?dye=<stainID>&harmony=<type>&algo=…&perceptual=1` |
| `/gradient` | `?start=<stainID>&end=<stainID>&steps=…&algo=…` |
| `/mixer` | `?dyeA=<stainID>&dyeB=<stainID>[&dyeC=…]&ratio=…&algo=…` |
| `/swatch` | `?hex=RRGGBB` (`?color=` accepted as a read alias) `&limit=…&algo=…&sheet=…&race=…&gender=…` |
| `/comparison` | `?dyes=<stainID>,<stainID>[,…]` |
| `/accessibility` | `?dyes=<stainID>[,…]&vision=…` |
| `/extractor` | `?colors=RRGGBB[,RRGGBB…]&algo=…` (max 5; the share URL carries no shares, so the card draws equal ranked bands) |
| `/presets`, `/presets/:id` | the preset id is the **path** (`/presets/gc-maelstrom`); curated slugs get their card, `community-<uuid>` / unknown ids degrade to the presets default card |
| `/budget` | `?dye=<stainID>`; a bare-colour `?hex=` target has no card and degrades to the budget default |

### Image Routes

These return the actual preview images:

| Route | Description |
|-------|-------------|
| `/og/default.png` | Root default card |
| `/og/:tool/default.png` | Per-tool default card (registered before the parameterised routes) |
| `/og/harmony/:dyeId/:harmonyType[.png]` | Harmony card |
| `/og/gradient/:startId/:endId/:steps[.png]` | Gradient card |
| `/og/mixer/:dyeAId/:dyeBId/:ratio[.png]`, `/og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio[.png]` | Mixer card (2 or 3 dyes) |
| `/og/swatch/:color/:limit[.png]` | Swatch card |
| `/og/comparison/:dyes[.png]` | Comparison card (comma-joined stainIDs) |
| `/og/accessibility/:dyes/:visionType[.png]` | Accessibility card |
| `/og/extractor/:colors[.png]` | Extractor card (`RRGGBB` or `RRGGBB-share` entries, max 5; bare entries draw equal ranked bands) |
| `/og/presets/:presetId[.png]` | Preset card (slug `^[a-z0-9-]{1,64}$`) |
| `/og/budget/:dyeId[.png]` | Budget card |

Image responses are cached `max-age=86400, s-maxage=604800` (24 h browser / 7 d edge); crawler HTML `max-age=3600, s-maxage=86400`.

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `algo` | Matching method: `ciede2000`, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` (legacy `euclidean` / `hyab` / `oklch-weighted` accepted and normalised). Direct image routes fall back to `oklab` when the parameter is absent |
| `lang` | `en` (default, unparameterised) / `ja` / `de` / `fr` / `ko` / `zh` — localizes the metadata **and** the picture |
| `frame` | `x` for the 1200×630 X/Twitter frame; otherwise the 1200×1050 Discord frame |

---

## Generated Metadata

Example OG HTML response for `/harmony?dye=1` (illustrative — hosts are `xivdyetools.app` / `og.xivdyetools.app/og`, and the real markup also carries `og:image:width/height`, `?lang=` and the `?frame=x` `twitter:image`):

```html
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Snow White Harmony - XIV Dye Tools" />
  <meta property="og:description" content="Explore complementary, triadic, and analogous color harmonies for Snow White" />
  <meta property="og:image" content="https://og.xivdyetools.app/og/harmony/1/complementary.png" />
  <meta property="og:url" content="https://xivdyetools.app/harmony?dye=1" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://og.xivdyetools.app/og/harmony/1/complementary.png" />
</head>
<body>
  <script>window.location.href = "https://xivdyetools.app/harmony?dye=1";</script>
</body>
</html>
```

---

## Image Templates

### Harmony Template

Shows the base dye with a color wheel and harmony points:

```
┌────────────────────────────────────────────────────────────────┐
│  ┌──────────┐                                                  │
│  │   DYE    │   Snow White                                     │
│  │  SWATCH  │   Complementary Harmony                          │
│  │  #FFFFFF │                                                  │
│  └──────────┘   ┌─────────────────┐                            │
│                 │   COLOR WHEEL    │                            │
│                 │   with harmony   │                            │
│                 │     points       │                            │
│                 └─────────────────┘                            │
│                                                                │
│  Related Dyes: Soot Black, Slate Grey, Ash Grey               │
└────────────────────────────────────────────────────────────────┘
```

### Gradient Template

Shows start and end dyes with stepped gradient between:

```
┌────────────────────────────────────────────────────────────────┐
│  XIV Dye Tools - Gradient Builder                              │
│                                                                │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐       │
│  │ 1  │→ │ 2  │→ │ 3  │→ │ 4  │→ │ 5  │→ │ 6  │→ │ 7  │       │
│  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘       │
│                                                                │
│  Snow White → Soot Black (7 steps)                             │
└────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| SVG Rendering | resvg-wasm |
| Fonts | Embedded — Onest, Space Grotesk, Fragment Mono (values), Noto Sans JP/SC/KR subsets (six TTFs) |
| Dye Data | Embedded from @xivdyetools/core |

---

## Caching

| Content | Cache TTL | Cache Location |
|---------|-----------|----------------|
| OG HTML | 1 hour | Edge (Cache-Control) |
| PNG Images | 24 hours | Edge (Cache-Control) |
| Static assets | 1 year | Edge (immutable) |

---

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| None required | — | Stateless operation |

All dye data is embedded at build time from `@xivdyetools/core`.

---

## Analytics

The worker tracks:
- Crawler type (which platform requested)
- Tool type (harmony, gradient, mixer, swatch)
- Dye IDs accessed
- Cache hit/miss ratio

Data is sent to Cloudflare Analytics Engine for monitoring social media sharing patterns.

---

## Related Documentation

- [Web App Overview](../web-app/overview.md) - The app these links point to
- [Architecture Overview](../../architecture/overview.md) - How OG Worker fits in the ecosystem
- [Discord Worker Overview](../discord-worker/overview.md) - Bot that also generates images
