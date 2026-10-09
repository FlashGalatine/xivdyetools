# OpenGraph Worker Overview

**xivdyetools-og-worker** - Dynamic OpenGraph metadata for social media previews

---

## What is the OG Worker?

A Cloudflare Worker that generates dynamic OpenGraph metadata and preview images when XIV Dye Tools links are shared on social media platforms. When you share a link like `https://xivdyetools.app/harmony?dye=1` on Discord, Twitter, or Facebook, this worker intercepts the request and returns rich preview content.

Current version: [docs/versions.md](../../versions.md). Release history:
[`apps/og-worker/CHANGELOG.md`](../../../apps/og-worker/CHANGELOG.md).

### Why a Separate Worker?

- **Crawler detection** - Social media crawlers need different responses than regular users
- **Dynamic images** - Generate preview images on-the-fly based on URL parameters
- **Edge rendering** - Fast global response times via Cloudflare's edge network
- **No database needed** - All data encoded in URL, stateless operation

---

## Quick Start (Development)

```bash
# From the monorepo root (xivdyetools/)
pnpm install

# Start the local dev server
pnpm --filter xivdyetools-og-worker run dev

# Deploy — bare `deploy` publishes the routed BETA worker
# (xivdyetools-og-worker-dev, beta.xivdyetools.app/<tool>/* + og-beta.xivdyetools.app)
pnpm --filter xivdyetools-og-worker run deploy
# Production (xivdyetools-og-worker, xivdyetools.app/<tool>/* + og.xivdyetools.app)
pnpm --filter xivdyetools-og-worker run deploy:production
```

⚠️ Unlike every other worker in the monorepo, a bare `deploy` here publishes to **real, public
hostnames** — the top-level env is the beta worker, not a routeless sandbox.

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
| WhatsApp | WhatsApp | 1200x1050 |
| iMessage | Applebot | 1200x1050 |

`Googlebot` is **deliberately absent** from the table: Google requests pass through to the SPA so
its own SEO content is what gets indexed (`crawler-detector.test.ts` pins this).

Both frames are the same 400-wide design grid rastered ×3 (Discord 400×350, X 400×210) and take separate cache keys.

---

## Architecture

### Request Flow

```
User shares link → Social platform crawls URL → OG Worker intercepts
     ↓
Crawler detected? → Yes → Generate OG HTML with dynamic image URL
     ↓
                    No → depends on which host the request arrived on
```

A non-crawler is **not** always redirected. The worker branches on the request's hostname:

| Host | Non-crawler gets |
|------|------------------|
| `APP_BASE_URL`'s host (`xivdyetools.app` / `beta.xivdyetools.app`) | `fetch(request)` — passed straight through to the SPA origin |
| `OG_IMAGE_BASE_URL`'s host (`og.xivdyetools.app`) on an unmatched path | A bare `404`. This worker **is** the origin there, and Cloudflare blocks a worker fetching its own custom domain (error 1042) |
| Anything else (a `workers.dev` name, `wrangler dev`) | `302` to `APP_BASE_URL` |

This is why `OG_IMAGE_BASE_URL`'s hostname must never equal `APP_BASE_URL`'s — `isOgImageHost`
identifies "our own image host" by exactly that comparison, and pointing both at one hostname would
bounce every real visitor away from the tool pages. `tests/wrangler-env.test.ts` guards it.

### Dynamic Image Generation

```
/og/harmony/:dyeId/:harmonyType[.png] → SVG template → resvg-wasm → PNG response
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
| `/harmony` | `?dye=<stainID>&harmony=<type>&algo=…&wheel=…`, or a bare-color `?hex=RRGGBB` base (there is no `perceptual` parameter — a `?perceptual=1` in an old share URL is simply not read) |
| `/gradient` | `?start=<stainID>&end=<stainID>&steps=…&interpolation=…&algo=…`, with `hexStart` / `hexEnd` for a bare-color endpoint. Read as the page reads them: `steps` only as a whole number 3–12 (anything else, or none, previews the page's default 8), `interpolation` only as one of `rgb` / `hsv` / `lab` / `oklch` / `lch` spelled exactly (anything else previews `hsv`) |
| `/mixer` | `?dyeA=<stainID>&dyeB=<stainID>[&dyeC=…]&ratio=…&mode=…&algo=…`, with `hexA` / `hexB` for a bare-color input |
| `/swatch` | `?slot=<sheet>&i=<cellIndex>` is the 5.0 share grammar (`?sheet=` is the pre-5.0 alias for `slot`), plus `&race=…&gender=…`; `?hex=RRGGBB` (`?color=` alias) is the fallback when the cell address resolves nothing, with `&limit=…&algo=…` |
| `/comparison` | `?dyes=<stainID>,<stainID>[,…]` |
| `/accessibility` | `?dyes=<stainID>[,…]&vision=…` |
| `/extractor` | `?colors=RRGGBB[,RRGGBB…]&algo=…` (max 5; the share URL carries no shares, so the card draws equal ranked bands) |
| `/presets`, `/presets/:id` | the preset id is the **path** (`/presets/gc-maelstrom`); curated slugs get their card, `community-<uuid>` / unknown ids degrade to the presets default card |
| `/budget` | `?dye=<stainID>`; a bare-colour `?hex=` target has no card and degrades to the budget default |

A bare color has no stainID, so it has no card on the stainID-keyed image routes (BUG-059). A
custom harmony, gradient or mixer share takes the tool's default card, like budget's `?hex=`
target, but keeps the rest of its embed: a title naming the color by its hex, the first
endpoint's color (the base, start, or `dyeA`) as `theme-color`, and an `og:url` that reopens the
custom share.

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

`lang`, `frame`, `algo`, `mode`, `wheel` and `interpolation` (`OG_ALLOWED_QUERY_KEYS`) are the
**only** query keys any `/og/*` image route may carry (2026-08-29 FINDING-024, OG-4) — any other
key gets a `404` before the cache lookup or a render, without echoing the key back. `algo`, `mode`,
`wheel` and `interpolation` have their *values* validated by that same guard on every `/og/*`
route, not just the routes that read them, so a bad spelling is the same `400` everywhere
(`Invalid algorithm` / `Invalid mixing mode` / `Invalid color wheel` / `Invalid interpolation`),
and an empty value (`?algo=` or bare `?algo`) counts as absent. An allowed key that occurs more
than once, including through a percent-encoded spelling of its name (`interpolatio%6E`), is a `400`
(`Repeated query parameter`): the cache key and the route would otherwise read different
occurrences and store one mode's card under another's key.

| Parameter | Description |
|-----------|-------------|
| `algo` | Matching method: `ciede2000`, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` (legacy `euclidean` / `hyab` / `oklch-weighted` accepted and normalized). Read by the six algo-aware routes: harmony, gradient, both mixer routes, swatch and (since BUG-060) the extractor. Direct image routes fall back to **`ciede2000`** (`DEFAULT_MATCHING_METHOD`) when the parameter is absent — not `oklab` |
| `lang` | `en` (default, unparameterised) / `ja` / `de` / `fr` / `ko` / `zh` — localizes the metadata **and** the picture |
| `frame` | `x` for the 1200×630 X/Twitter frame; otherwise the 1200×1050 Discord frame |
| `mode` | The mixing mode. Read only by the two mixer routes — added 2026-09-03, after which a shared mix stopped rendering in CIELAB regardless of which algorithm the sharer picked |
| `wheel` | The harmony card's wheel geometry (`parseColorWheelId`'s five ids). Read only by the parameterized harmony card (`/og/harmony/:dyeId/:harmonyType`); added 2026-09-04 for the Harmony Explorer |
| `interpolation` | The color space the gradient card's ramp runs in: `rgb`, `hsv` (default), `lab`, `oklch` or `lch`, spelled exactly, as the Gradient Builder accepts them. Read only by the parameterized gradient card; added 2026-10-06 (BUG-008), before which the card ramped in a space it chose from `?algo=`, never the one the share named. The card resolves the page's whole ramp at `:steps` and draws up to five of its steps, labeled with the page's step numbers |

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
| Fonts | Embedded — Onest and Space Grotesk as three static instances each (Regular / SemiBold / Bold), Fragment Mono Regular (values), Noto Sans JP/SC/KR subsets: **ten TTFs**. Static instances, never variable files — resvg exposes only a variable font's default instance, so every `font-weight` used to be a no-op |
| Dye Data | Embedded from @xivdyetools/core |

---

## Caching

| Content | Cache TTL | Cache Location |
|---------|-----------|----------------|
| OG HTML | 1 hour browser / 24 hours edge | Edge (Cache-Control) |
| PNG Images | 24 hours browser / 7 days edge | Edge (Cache-Control) |

(This worker serves no static assets — it has no assets binding and every response it produces is
generated.)

The `Cache-Control` headers above describe TTLs but do nothing by themselves on a Worker
response — `index.ts` also stores every successful `/og/*` render in Cloudflare's
`caches.default` (the Cache API) and serves repeat requests from there instead of
re-rastering through resvg. The key is **canonical**, not the full request URL
(2026-08-29 FINDING-024, OG-4). It is the decoded path — with a trailing `.png` stripped, since the
suffix is optional at every route except `/og/:tool/default.png` — plus, in a fixed order:

| Axis | Form |
|------|------|
| `lang` | The **resolved** locale (`?lang=EN`, `?lang=en-US` and no `lang` collapse onto one entry) |
| `frame` | The **resolved** `discord` \| `x` (an unrecognised `?frame=` renders `discord` and shares its entry) |
| `v` | `CARD_VERSION` — this worker's own package version. Because the stored response says `s-maxage=604800`, a card-design change would otherwise keep serving the pre-deploy PNG from every warm colo for up to seven days; bumping the version is what retires the old cards (BUG-025, deploy-checklist step 4) |
| `algo` | The **raw** query value, omitted when absent, and only on the six algo-aware routes (BUG-058) — a card that ignores it must not split its entries on it |
| `mode` | The **raw** query value, omitted when absent, and only on the two mixer routes — two mixing modes are two different pictures |
| `wheel` | **Normalized**, non-default, and only on the parameterized harmony card — the one route that renders with it. Keying on it elsewhere would let `?wheel=` mint five identical rasters of one card |
| `interpolation` | Non-default (`hsv` elided, so it shares the bare entry), and only on the parameterized gradient card (BUG-008). The guard admits only the five exact spellings, so the raw value is already canonical |

So `.png` and no-suffix spellings of one card share an entry, as does a percent-encoded path
spelling that decodes to the same route. This is checked and filled for `HEAD` requests as well as
`GET`. It bounds *spellings of one card* to one cache entry — it does not bound how many
*distinct* ids a client can request (see the Query Parameters note above and the WAF
rate-limiting rule in `docs/historical/20260828-PostMerge5.0/POST_MERGE_CHECKLIST.md` §2, deployed 2026-09-01).

---

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `ANALYTICS` | Analytics Engine dataset | `xivdyetools_og_analytics` (production) / `xivdyetools_og_analytics_beta` (beta). `writeDataPoint` for `og_request` / `og_image_request`; failures are swallowed |
| `APP_BASE_URL` | Var | `https://xivdyetools.app` (beta: `https://beta.xivdyetools.app`) — redirect target and canonical URL base, and what `isAppHost` compares against |
| `OG_IMAGE_BASE_URL` | Var | `https://og.xivdyetools.app/og` (beta: `https://og-beta.xivdyetools.app/og`) — base for emitted `og:image` URLs. The `/og` suffix is load-bearing: without it every emitted card URL 404s. Its **hostname must never equal `APP_BASE_URL`'s** |

No KV, D1, R2 or secrets — all dye data is embedded at build time from `@xivdyetools/core`, so the
worker holds no state of its own.

---

## Analytics

One datapoint per **crawler** hit — human page views produce nothing here (they were only a cost;
FINDING-024). The shape written to the `ANALYTICS` dataset is fixed:

| Field | Contents |
|-------|----------|
| `blobs` | `[event, tool, crawler]` — the event name (`og_request` / `og_image_request`), the tool id, and the detected crawler type |
| `doubles` | `[timestamp]` |
| `indexes` | `[tool]` |

Dye IDs are **not** recorded, and neither is cache hit/miss ratio. A `writeDataPoint` failure is
caught and logged, never surfaced — analytics must not break a render.

---

## Related Documentation

- [Web App Overview](../web-app/overview.md) - The app these links point to
- [Architecture Overview](../../architecture/overview.md) - How OG Worker fits in the ecosystem
- [Discord Worker Overview](../discord-worker/overview.md) - Bot that also generates images
