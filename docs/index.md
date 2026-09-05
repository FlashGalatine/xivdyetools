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
| Finish the 5.0 post-merge follow-ups (dashboard, credentials, cleanup) | [Post-merge Checklist](operations/POST_MERGE_CHECKLIST.md) |
| Check version numbers | [Version Matrix](versions.md) — the only version table in `docs/`; CI checks it against `package.json` |
| Read feature specifications | [Specifications](specifications/index.md) |
| Review historical decisions | [History Archive](historical/index.md) |

---

## Ecosystem at a Glance

The monorepo holds **17 active projects — 8 packages and 9 applications**. Packages are layered
by dependency depth; nothing at a given level imports from a level below it. Version numbers
live in one place, the [Version Matrix](versions.md).

```
   Level 0 ─ no internal dependencies
   ┌──────────────────────┬──────────────────────┬───────────────────────────────┐
   │ @xivdyetools/types   │ @xivdyetools/logger  │ @xivdyetools/auth             │
   │ branded types,       │ multi-runtime, secret│ JWT, HMAC, Ed25519            │
   │ shared interfaces    │ redaction            │ (incl. /encoding)             │
   └──────────┬───────────┴──────────┬───────────┴───────────────┬───────────────┘
              │                      │                           │
   Level 1    ▼                      ▼                           ▼
   ┌────────────────────────────┬─────────────────────────┬───────────────────────┐
   │ @xivdyetools/core          │ @xivdyetools/worker-kit │ @xivdyetools/test-utils│
   │ 125 dyes (schema v2),      │ Hono middleware +       │ D1/KV/R2 mocks,        │
   │ colour algorithms, k-d     │ /rate-limiter backends  │ factories (private)    │
   │ tree, harmony wheels,      │ (Memory, KV, Upstash,   │                        │
   │ Universalis, 6 langs,      │ Cloudflare native)      │                        │
   │ incl. /blending            │                         │                        │
   └──────────┬─────────────────┴─────────────────────────┴───────────────────────┘
              │
   Level 2    ▼
   ┌────────────────────────────┐
   │ @xivdyetools/svg           │   SVG card generators (data → SVG string)
   └──────────┬─────────────────┘
              │
   Level 3    ▼
   ┌────────────────────────────┐
   │ @xivdyetools/bot-logic     │   Platform-agnostic bot command logic
   │ (incl. /i18n)              │   + the bot UI translation engine
   └──────────┬─────────────────┘
              │
              ▼
   Applications
   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
   │  web-app            │  │ discord-worker      │  │ stoat-worker        │
   │  9 tools, Light +   │  │ 17 slash commands   │  │ Revolt.js (parked)  │
   │  Dark, Vite + Lit   │  │ HTTP Interactions   │  └─────────────────────┘
   └──────────┬──────────┘  └──────────┬──────────┘
              │                        │
              │            ┌───────────┴───────────┐
              │            ▼                       ▼
              │   ┌──────────────────┐   ┌──────────────────────┐
              │   │ image-worker     │   │ presets-api          │
              │   │ /extract +       │◄──│ D1 + R2 + moderation │
              │   │ /thumbnail,      │   └──────────┬───────────┘
              │   │ service-binding  │              │
              │   │ only             │              ▼
              │   └──────────────────┘   ┌──────────────────────┐
              │                          │ moderation-worker    │
              ▼                          │ moderator-only bot   │
   ┌──────────────────────┐              └──────────────────────┘
   │ oauth-worker         │
   │ PKCE + JWT, D1       │
   └──────────────────────┘

   ┌──────────────────────┐   ┌───────────────────────────────────────────┐
   │ og-worker            │   │ api-worker                                │
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
| [Architecture](architecture/index.md) | How all projects interconnect, service bindings, data flows, and the [security trade-offs](architecture/security-trade-offs.md) behind them |
| [Projects](projects/index.md) | Deep-dive documentation for each project |
| [Versions](versions.md) | Current version matrix, per-release history and the compatibility matrix |

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
| [Reference](reference/index.md) | Glossary and FFXIV terminology |
| [Specifications](specifications/index.md) | Feature specifications and roadmap |
| [Research](research/index.md) | The investigation behind each major decision (frozen once built) |
| [Specs & plans](superpowers/README.md) | The design spec and implementation plan behind each feature, with shipped / parked status |

### For Maintainers

| Section | Description |
|---------|-------------|
| [Maintainer Guide](maintainer/index.md) | Dye-addition workflow, known issues, tech debt |
| [Operations](operations/index.md) | Deploy environments, secret rotation, moderation, [analytics queries](operations/ANALYTICS_QUERIES.md), the [post-merge checklist](operations/POST_MERGE_CHECKLIST.md) |
| [Audits](audits/index.md) | Every dated audit and what came of it |
| [History](historical/index.md) | Development timeline organized by topic |

---

## Projects Overview

Current versions: [Version Matrix](versions.md). Projects without a deep-dive page link to
their `README.md` in the monorepo.

### Applications

| Project | Type | Purpose |
|---------|------|---------|
| [xivdyetools-web-app](projects/web-app/overview.md) | Vite + Lit | Interactive web toolkit with 9 colour tools |
| [xivdyetools-discord-worker](projects/discord-worker/overview.md) | CF Worker | Discord bot, 17 registered slash commands |
| [xivdyetools-image-worker](../apps/image-worker/README.md) | CF Worker | Photon host — `POST /extract` (pixels) + `POST /thumbnail` (WebP); reachable only via service bindings (discord-worker, presets-api) |
| [xivdyetools-moderation-worker](projects/moderation-worker/overview.md) | CF Worker | Community preset moderation bot |
| [xivdyetools-oauth](projects/oauth/overview.md) | CF Worker + D1 | Discord OAuth + JWT issuance |
| [xivdyetools-presets-api](projects/presets-api/overview.md) | CF Worker + D1 + R2 | Community presets with moderation and preview images |
| [xivdyetools-api-worker](projects/api-worker/overview.md) | CF Worker + KV | Public REST API, Universalis proxy, and developer docs |
| [xivdyetools-og-worker](projects/og-worker/overview.md) | CF Worker | Localized OpenGraph cards for social previews |
| [xivdyetools-stoat-worker](../apps/stoat-worker/README.md) | Node.js | Revolt (Stoat) bot — **parked**, no active investment |

### Shared Libraries

| Project | Type | Purpose |
|---------|------|---------|
| [@xivdyetools/core](projects/core/overview.md) | npm | Colour algorithms, 125-dye database (schema v2), harmony colour wheels, Universalis, blending (`/blending`) |
| [@xivdyetools/types](projects/types/overview.md) | npm | Branded types (HexColor, DyeId, StainId) and shared interfaces |
| [@xivdyetools/logger](projects/logger/overview.md) | npm | Multi-runtime logging with secret redaction |
| [@xivdyetools/auth](../packages/auth/README.md) | npm | JWT verification, HMAC signing, Discord Ed25519, Base64URL/hex (`/encoding`) |
| [@xivdyetools/worker-kit](../packages/worker-kit/README.md) | npm | Hono middleware + sliding-window rate limiting (`/rate-limiter`) |
| [@xivdyetools/svg](../packages/svg/README.md) | npm | Platform-agnostic SVG card generators |
| [@xivdyetools/bot-logic](../packages/bot-logic/README.md) | npm | Bot command logic + bot UI translation engine (`/i18n`) |
| [@xivdyetools/test-utils](projects/test-utils/overview.md) | workspace-private | Cloudflare Workers mocks and test factories |

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

*Last updated: September 5, 2026*

### September 2026 Highlights

- **Selectable harmony colour wheels** (PR #167, 2026-09-05) — the Harmony Explorer, `/harmony`
  and the OG harmony card can measure harmony angles on `rgb` (unchanged default), `ryb`,
  `munsell`, `oklch-hue` or `oklch-lightness`; core 5.2.0 owns the wheels, share URLs carry
  `?wheel=`, and api-worker 0.14.0 exposes them at `GET /v1/wheels` / `GET /v1/harmony`
  (PR #169). The developer docs were restyled on the web app's design register (PR #168).
- **Harmony convergence** (PR #159) — the web app, the bot and og-worker had each rotated hue
  differently and disagreed on 89–100% of base dyes. Core's `generateHarmonySlots` is now the
  one implementation; `HARMONY_OFFSETS` the one table.
- **Mixing and matching fact-check** (PR #164) — the bot's `spectral` mode returned near-black
  (per-channel Kubelka-Munk on gamma-encoded sRGB; now `spectral.js`), core shipped two RYB
  mixers that disagreed by up to ΔE₀₀ 38 (the Gossett-Chen cube, which failed the identity law,
  was removed in core 5.0.0), and `oklab` matching became ΔEOK2 (core 5.1.0 — different ranking
  and a ~1.4–2× scale). CIEDE2000 matching was verified correct against Sharma's 34 pairs.
- **2026-09-02 deep-dive remediation** (PR #158) — 250 findings across 19 sprints: moderation
  embeds naming dyes by stainID again, the moderation stats panel no longer "undefined" ×4
  (types 3.0.0), the bot fleet no longer 429-ing itself on `/budget`, every Swatch share
  unfurling the right cell, tightened test-utils mocks (2.0.0), and more.
- **Dead-code guardrails** (PR #157, root `CHANGELOG.md` 2.1.0) — knip gates every workspace
  but the parked stoat-worker, and `scripts/check-dead-code.ts` closes the test-only
  reachability gap knip cannot see. Sibling gate added 2026-09-05: `pnpm docs:check-versions`
  keeps the root README and [versions.md](versions.md) in step with `package.json`.
- **i18n audit** (PR #162) — locale data was already complete; every finding was code or fonts
  (bold CJK rendered Thin because the variable-font fix had been Latin-only; facewear names
  were never localized). **"Show all pieces"** in the Swatch Matcher's glamour block (PR #160).

### August 2026 Highlights

- **XIV Dye Tools 5.0 wave merged to `main` on 2026-08-28** (PR #123; root `CHANGELOG.md`
  2.0.0) — coordinated major releases across `core` v4.0.0, `types` v2.0.0, `svg` v2.0.0,
  `bot-logic` v2.0.0, `worker-kit` v1.0.0 (new), `web-app` v5.0.0, `discord-worker` v5.0.0,
  `og-worker` v2.0.0, `presets-api` v2.0.0 (stainID presets, 3–6 dyes, `community` category
  retired, preview images), plus `oauth` 2.6.0 / `api-worker` 0.6.0 / `moderation-worker` 1.4.0.
  Merging was the release; the remaining user-run follow-ups are in the
  [post-merge checklist](operations/POST_MERGE_CHECKLIST.md).
- **Two security audits** (2026-08-21: 36 findings; 2026-08-29: 31 findings, PR #152) — all
  remediated before or on merge day: native `[[ratelimits]]` bindings replace Upstash, oauth
  3.0.0 dropped `/auth/refresh` and the character roster table, presets-api stopped exposing
  `author_discord_id`, logger redaction hardened, a separate `CLOUDFLARE_API_TOKEN_BETA` for the
  beta deploy workflows.
- **Chara-name privacy** (PR #151) — the bot never displays a character's name or a `.chara`
  filename on cards or embeds (svg 3.0.0 / bot-logic 3.0.0).
- **Analytics** — the web app's *Enable Analytics* toggle became real (api-worker 0.9.0
  `POST /v1/telemetry`, PR #149); the bot's Tier A analytics record outcomes, never option
  values (PR #150). See [ANALYTICS_QUERIES](operations/ANALYTICS_QUERIES.md).
- **`.chara` equipment resolution** — api-worker 0.7.0 `POST /v1/chara/resolve` backs the
  Swatch Matcher's glamour block.
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
