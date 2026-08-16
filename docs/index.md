# XIV Dye Tools Documentation

**The comprehensive documentation bible for the XIV Dye Tools ecosystem**

This wiki-style documentation serves developers, end users, and maintainers with everything needed to understand, use, and contribute to XIV Dye Tools.

---

## Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| Understand how projects connect | [Architecture Overview](architecture/overview.md) |
| Use the web app | [Web App User Guide](user-guides/web-app/getting-started.md) |
| Use the Discord bot | [Discord Bot Guide](user-guides/discord-bot/getting-started.md) |
| Set up development environment | [Local Setup](developer-guides/local-setup.md) |
| Integrate the core library | [Core Library Overview](projects/core/overview.md) |
| **Add new dyes after a patch** | [Adding Dyes](maintainer/adding-dyes.md) |
| Deploy a worker safely | [Deployment](developer-guides/deployment.md) |
| Moderate community presets | [Moderation Guide](operations/MODERATION.md) |
| Check version numbers | [Version Matrix](versions.md) |
| Read feature specifications | [Specifications](specifications/index.md) |
| Review historical decisions | [History Archive](historical/index.md) |

---

## Ecosystem at a Glance

The monorepo holds **17 active projects — 8 packages and 9 applications**. Packages are layered
by dependency depth; nothing at a given level imports from a level below it.

```
   Level 0 ─ no internal dependencies
   ┌──────────────────────┬──────────────────────┬───────────────────────────────┐
   │ @xivdyetools/types   │ @xivdyetools/logger  │ @xivdyetools/auth             │
   │ v2.0.0               │ v1.3.0               │ v1.3.0  (incl. /encoding)     │
   └──────────┬───────────┴──────────┬───────────┴───────────────┬───────────────┘
              │                      │                           │
   Level 1    ▼                      ▼                           ▼
   ┌────────────────────────────┬─────────────────────────┬───────────────────────┐
   │ @xivdyetools/core  v4.0.0  │ @xivdyetools/worker-kit │ @xivdyetools/test-utils│
   │ 125 dyes (schema v2),      │ v1.0.0                  │ v1.2.0                 │
   │ colour algorithms, k-d     │ Hono middleware +       │ D1/KV/R2 mocks,        │
   │ tree, Universalis, 6 langs │ /rate-limiter backends  │ factories (private)    │
   │ incl. /blending            │                         │                        │
   └──────────┬─────────────────┴─────────────────────────┴───────────────────────┘
              │
   Level 2    ▼
   ┌────────────────────────────┐
   │ @xivdyetools/svg   v2.0.0  │   SVG card generators (data → SVG string)
   └──────────┬─────────────────┘
              │
   Level 3    ▼
   ┌────────────────────────────┐
   │ @xivdyetools/bot-logic     │   Platform-agnostic bot command logic
   │ v2.0.0  (incl. /i18n)      │   + the bot UI translation engine
   └──────────┬─────────────────┘
              │
              ▼
   Applications
   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
   │  web-app  v5.0.0    │  │ discord-worker      │  │ stoat-worker v0.2.1 │
   │  9 tools, Light +   │  │ v5.0.0              │  │ Revolt.js (parked)  │
   │  Dark, Vite + Lit   │  │ 17 slash commands   │  └─────────────────────┘
   └──────────┬──────────┘  └──────────┬──────────┘
              │                        │
              │            ┌───────────┴───────────┐
              │            ▼                       ▼
              │   ┌──────────────────┐   ┌──────────────────────┐
              │   │ image-worker     │   │ presets-api  v2.0.0  │
              │   │ v1.0.0           │◄──│ D1 + moderation      │
              │   │ service-binding  │   └──────────┬───────────┘
              │   │ only, no public  │              │
              │   │ surface          │              ▼
              │   └──────────────────┘   ┌──────────────────────┐
              │                          │ moderation-worker    │
              ▼                          │ v1.4.0               │
   ┌──────────────────────┐              └──────────────────────┘
   │ oauth-worker v2.6.0  │
   │ PKCE + JWT           │
   └──────────────────────┘

   ┌──────────────────────┐   ┌───────────────────────────────────────────┐
   │ og-worker    v2.0.0  │   │ api-worker   v0.6.0                       │
   │ Localized OG cards   │   │ data.xivdyetools.app — public REST API,   │
   │ (15E band frame)     │   │ /universalis market proxy, and the        │
   └──────────────────────┘   │ VitePress developer docs                  │
                              └───────────────────────────────────────────┘
```

The dye database is **125 standard dyes** (`dyes.json`, schema v2 — stainID-keyed). The 11
Facewear colours are **not dyes**; they live separately in `facewear_colors.json`. See
[Dye Database Composition](#dye-database-composition) below.

---

## Documentation Sections

### For Everyone

| Section | Description |
|---------|-------------|
| [Architecture](architecture/overview.md) | How all projects interconnect, service bindings, data flows |
| [Projects](projects/index.md) | Deep-dive documentation for each project |
| [Versions](versions.md) | Current version matrix and changelog links |

### For Users

| Section | Description |
|---------|-------------|
| [Web App Guides](user-guides/web-app/getting-started.md) | Step-by-step guides for all 9 web tools |
| [Discord Bot Guides](user-guides/discord-bot/getting-started.md) | Command reference and usage examples |
| [Public API](user-guides/public-api.md) | Using `data.xivdyetools.app` from your own project |

### For Developers

| Section | Description |
|---------|-------------|
| [Developer Guides](developer-guides/index.md) | Setup, testing, deployment, releasing, contributing |
| [Reference](reference/glossary.md) | Glossary and FFXIV terminology |
| [Specifications](specifications/index.md) | Feature specifications and roadmap |

### For Maintainers

| Section | Description |
|---------|-------------|
| [Maintainer Guide](maintainer/index.md) | Dye-addition workflow, known issues, tech debt |
| [Operations](operations/DEPLOY_ENVIRONMENTS.md) | Deploy environments, secret rotation, moderation |
| [History](historical/index.md) | Development timeline organized by topic |

---

## Projects Overview

### Applications

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [xivdyetools-web-app](projects/web-app/overview.md) | Vite + Lit | v5.0.0 | Interactive web toolkit with 9 colour tools |
| [xivdyetools-discord-worker](projects/discord-worker/overview.md) | CF Worker | v5.0.0 | Discord bot, 17 registered slash commands |
| xivdyetools-image-worker | CF Worker | v1.0.0 | Photon host — `POST /extract` (pixels) + `POST /thumbnail` (WebP); reachable only via service bindings (discord-worker, presets-api) |
| [xivdyetools-moderation-worker](projects/moderation-worker/overview.md) | CF Worker | v1.4.0 | Community preset moderation bot |
| [xivdyetools-oauth](projects/oauth/overview.md) | CF Worker + D1 | v2.6.0 | Discord OAuth + JWT issuance |
| [xivdyetools-presets-api](projects/presets-api/overview.md) | CF Worker + D1 | v2.0.0 | Community presets with moderation |
| [xivdyetools-api-worker](projects/api-worker/overview.md) | CF Worker + KV | v0.6.0 | Public REST API, Universalis proxy, and developer docs |
| [xivdyetools-og-worker](projects/og-worker/overview.md) | CF Worker | v2.0.0 | Localized OpenGraph cards for social previews |
| xivdyetools-stoat-worker | Node.js | v0.2.1 | Revolt (Stoat) bot — **parked**, no active investment |

### Shared Libraries

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [@xivdyetools/core](projects/core/overview.md) | npm | v4.0.0 | Colour algorithms, 125-dye database (schema v2), Universalis, blending (`/blending`) |
| [@xivdyetools/types](projects/types/overview.md) | npm | v2.0.0 | Branded types (HexColor, DyeId, StainId) and shared interfaces |
| [@xivdyetools/logger](projects/logger/overview.md) | npm | v1.3.0 | Multi-runtime logging with secret redaction |
| @xivdyetools/auth | npm | v1.3.0 | JWT verification, HMAC signing, Discord Ed25519, Base64URL/hex (`/encoding`) |
| @xivdyetools/worker-kit | npm | v1.0.0 | Hono middleware + sliding-window rate limiting (`/rate-limiter`) |
| @xivdyetools/svg | npm | v2.0.0 | Platform-agnostic SVG card generators |
| @xivdyetools/bot-logic | npm | v2.0.0 | Bot command logic + bot UI translation engine (`/i18n`) |
| [@xivdyetools/test-utils](projects/test-utils/overview.md) | workspace-private | v1.2.0 | Cloudflare Workers mocks and test factories |

---

## Dye Database Composition

**125 standard dyes**, stored in `packages/core/src/data/dyes.json` as **schema v2** — seven
fields per entry (`stainID`, `name`, `hex`, `category`, `acquisition`, `consolidationType`,
`legacyItemID`). `stainID` (the game's Stain sheet row ID) is the canonical identifier.

Everything else is **derived at `DyeDatabase.initialize()`** — `rgb`/`hsv`/`lab` from `hex`,
`cost`/`currency` from `ACQUISITION_META`, and the five `is*` flags. The runtime `Dye` object
still has its full 16-field shape, so consumers of dye objects were unaffected by the migration.

The **11 Facewear colours are not dyes.** They live in `facewear_colors.json` and the
`facewearColors` export as `FacewearColor` (string slug `id`, `name`, `hex`). The pre-v2
synthetic negative itemIDs survive only as the frozen `LEGACY_FACEWEAR_ITEM_IDS` compatibility
map, read via `getFacewearColorByLegacyItemID()`.

**Patch 7.5 dye consolidation is active.** 105 of the 125 dyes share three real consolidated
itemIDs (Type-A = 52254, Type-B = 52255, Type-C = 52256). `getMarketItemID()` and
`CONSOLIDATED_DYES` handle the legacy → consolidated mapping. The Allied Society / Beast Tribe
filter category was retired by this consolidation.

---

## Recent Updates

*Last updated: August 16, 2026*

### August 2026 Highlights

- **XIV Dye Tools 5.0 wave** (`monorepo-2.0-prep`, root `CHANGELOG.md` 2.0.0) — coordinated
  major releases across `core` v4.0.0, `types` v2.0.0, `svg` v2.0.0, `bot-logic` v2.0.0,
  `worker-kit` v1.0.0 (new), `web-app` v5.0.0, `discord-worker` v5.0.0, `og-worker` v2.0.0,
  `presets-api` v2.0.0 (stainID presets, 3–6 dyes, `community` category retired, preview
  images), plus `oauth` 2.6.0 / `api-worker` 0.6.0 / `moderation-worker` 1.4.0. Not yet merged
  to `main` or published — merging is the release; see [versions.md](versions.md).
- **One matching vocabulary** — `ciede2000` (default) / `oklab` / `cie76` / `redmean` / `rgb` /
  `distinguish` across core, web-app, bot, og-worker and api-worker; `hyab` and `oklch-weighted`
  retired (normalised on read). Share URLs and og-worker paths key on stainID.
- **Themes reduced to Light + Dark** — the 12-theme system is retired. `ThemeName` is now
  `'standard-light' | 'standard-dark'`, with legacy stored names migrated on load
  ([theming](projects/web-app/theming.md)).
- **Discord command roster reworked** — v4 `/match`, `/match_image`, `/favorites`, `/collection`,
  `/language` deleted; `/contrast` split out of `/accessibility` for WCAG 1.4.11 pairs,
  `/changelog` and `/a11y` added, `/swatch` reads a `.chara` file, and a `COMMAND_REGISTRY` now
  holds the roster of record so the dispatch switch, the registration schema, and `/about` can no
  longer disagree ([commands](projects/discord-worker/commands.md)).
- **og-worker v2.0.0 card rewrite** — one 15E band frame for all nine tools, Discord (1200×1050)
  and X (1200×630 via `?frame=x`) variants, default cards, and a JP font subset. Also fixed the
  missing `/og/` prefix, which meant no generated card had ever been fetched.
- **image-worker split out of discord-worker** — `@cf-wasm/photon` moved behind a service
  binding, bringing `discord-worker` back under Cloudflare's 3 MiB gzip limit
  ([IMAGE_WORKER_SPLIT](operations/IMAGE_WORKER_SPLIT.md)).
- **Deploy-environment hazard fixed** — a bare `wrangler deploy` targeted **production** on
  `discord-worker`, `moderation-worker`, and `presets-api`. All three now default to `-dev`
  workers; production requires an explicit `--env production`
  ([DEPLOY_ENVIRONMENTS](operations/DEPLOY_ENVIRONMENTS.md)).
- **`*.xivdyetools.projectgalatine.com` domains deprecated** in favour of `xivdyetools.app`
  ([DOMAIN_DEPRECATION](operations/DOMAIN_DEPRECATION.md)).

### July 2026 Highlights

- **Monorepo 2.0 Tier 1 consolidation (12 → 8 packages)** — `crypto` → `auth/encoding`,
  `bot-i18n` → `bot-logic/i18n`, `color-blending` → `core/blending`, and
  `rate-limiter` + `worker-middleware` → the new `worker-kit`. See `DEPRECATIONS.md` for
  migration paths.
- **Dye data schema v2** (core v3.0.0) — `colors_xiv.json` (136 × 16 fields) became `dyes.json`
  (125 × 7 fields, stainID-keyed) with Facewear colours split into their own collection. Also
  fixed `isMetallic` (now the Stain sheet's 16-dye gloss set) and `isCosmic` (11, no longer
  polluted by the 9 Firmament dyes).
- **universalis-proxy and api-docs absorbed into api-worker** — the proxy became
  `/universalis` + `/api/v2` compatibility routes; the VitePress site now ships as Workers
  Static Assets.
- **`xivdyetools-maintainer` retired** — dye additions are a documented workflow
  ([adding-dyes](maintainer/adding-dyes.md)) with the invariants moved into CI.
- **2026-07-18 audit remediation shipped monorepo-wide** (8 sprints) — presets-api v1.6.0 closed
  a CRITICAL moderation self-approval gap, discord-worker v4.7.0 made moderation buttons
  routable, core v2.7.0 fixed perceptual dye search, logger v1.3.0 hardened redaction.
- **npm publishing migrated to trusted publishing (OIDC)** — the `NPM_TOKEN` secret is gone; the
  publish workflow authenticates via its GitHub Actions identity.

### Earlier

- **April 2026** — Patch 7.5 dye consolidation activated end-to-end; Allied Society filter
  retired; api-worker and its docs site launched.
- **March 2026** — core v2.0.0 removed ~35 deprecated type re-exports (import from
  `@xivdyetools/types` instead).
- **January 2026** — Web App v4.0.0 and Discord Bot v4.0.0: tool renaming, Lit.js web
  components, 9 tools.

See [Version Matrix](versions.md) for detailed version history and
[Feature Roadmap](specifications/feature-roadmap.md) for planned features.

---

## Contributing

See the [Contributing Guide](developer-guides/contributing.md) for branch conventions, commit
format, and the pull-request checklist.

---

## License

MIT License - See individual project repositories for details.

## Legal Notice

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. This project is not affiliated with or endorsed by Square Enix.
