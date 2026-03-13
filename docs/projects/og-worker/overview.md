# OpenGraph Worker Overview

**xivdyetools-og-worker** v1.0.6 - Dynamic OpenGraph metadata for social media previews

---

## What is the OG Worker?

A Cloudflare Worker that generates dynamic OpenGraph metadata and preview images when XIV Dye Tools links are shared on social media platforms. When you share a link like `https://xivdyetools.com/harmony/1` on Discord, Twitter, or Facebook, this worker intercepts the request and returns rich preview content.

### Recent Changes

- **v1.0.6** — Dependency updates
- **v1.0.4** — Added NaN validation for dye ID parameters; added `escapeHtml` for theme color output (XSS prevention)
- **v1.0.3** — Added parameter bounds validation (step count, hex length)

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

# Deploy to production
npm run deploy:production
```

---

## Supported Platforms

The worker detects and serves optimized content for:

| Platform | User Agent Pattern | Image Size |
|----------|-------------------|------------|
| Discord | Discordbot | 1200x630 |
| Twitter/X | Twitterbot | 1200x628 |
| Facebook | facebookexternalhit | 1200x630 |
| LinkedIn | LinkedInBot | 1200x627 |
| Slack | Slackbot | 1200x630 |
| Telegram | TelegramBot | 1200x630 |
| iMessage | AppleWebKit | 1200x630 |

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

| Route | Description |
|-------|-------------|
| `/harmony/:dyeId` | Color harmony preview for a dye |
| `/harmony/:dyeId/:type` | Specific harmony type (complementary, triadic, etc.) |
| `/gradient/:startId/:endId` | Gradient between two dyes |
| `/gradient/:startId/:endId/:steps` | Gradient with custom step count |
| `/mixer/:dye1Id/:dye2Id` | Dye mixing result |
| `/swatch/:hexColor` | Color swatch with matching dyes |
| `/comparison/:dye1Id/:dye2Id` | Side-by-side dye comparison |
| `/accessibility/:dyeId` | Accessibility analysis preview |

### Image Routes

These return the actual preview images:

| Route | Description |
|-------|-------------|
| `/og/harmony/:dyeId.png` | Harmony preview image |
| `/og/harmony/:dyeId/:type.png` | Specific harmony type image |
| `/og/gradient/:startId/:endId/:steps.png` | Gradient preview image |
| `/og/mixer/:dye1Id/:dye2Id.png` | Mixer preview image |
| `/og/swatch/:hexColor.png` | Swatch preview image |
| `/og/comparison/:dye1Id/:dye2Id.png` | Comparison preview image |
| `/og/accessibility/:dyeId.png` | Accessibility preview image |

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `algo` | Color matching algorithm override: `oklab`, `ciede2000`, `rgb` |

---

## Generated Metadata

Example OG HTML response for `/harmony/1`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Snow White Harmony - XIV Dye Tools" />
  <meta property="og:description" content="Explore complementary, triadic, and analogous color harmonies for Snow White" />
  <meta property="og:image" content="https://xivdyetools.com/og/harmony/1.png" />
  <meta property="og:url" content="https://xivdyetools.com/harmony/1" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://xivdyetools.com/og/harmony/1.png" />
</head>
<body>
  <script>window.location.href = "https://xivdyetools.com/harmony/1";</script>
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
| Fonts | Embedded (Onest, Space Grotesk, Habibi) |
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
