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
| **Add new dyes after a patch** | [Dye Maintainer Tool](maintainer/dye-maintainer-tool.md) |
| Moderate community presets | [Moderation Guide](operations/MODERATION.md) |
| Check version numbers | [Version Matrix](versions.md) |
| Read feature specifications | [Specifications](specifications/index.md) |
| Review historical decisions | [History Archive](history/index.md) |

---

## Ecosystem at a Glance

```
              ┌────────────────────────────────────────────────────┐
              │                 Shared Foundation                  │
              │  @xivdyetools/types (v1.14.0)                     │
              │  @xivdyetools/logger (v1.2.2)                     │
              │  @xivdyetools/auth (v1.1.2)                       │
              │  @xivdyetools/crypto (v1.1.0)                     │
              │  @xivdyetools/rate-limiter (v1.4.4)               │
              │  @xivdyetools/worker-middleware (v1.1.2)          │
              │  @xivdyetools/test-utils (v1.1.7)                 │
              └───────────────────────┬────────────────────────────┘
                                      │
              ┌───────────────────────▼────────────────────────────┐
              │              @xivdyetools/core (v2.6.0)           │
              │  125 standard dyes plus 11 Facewear color entries │
              │  (synthetic negative IDs), color algorithms,      │
              │  Universalis API, 6 languages, k-d tree matching  │
              ├───────────────────────────────────────────────────-┤
              │  @xivdyetools/color-blending (v1.0.1)             │
              │  @xivdyetools/svg (v1.1.2)                        │
              │  @xivdyetools/bot-logic (v1.2.0)                  │
              │  @xivdyetools/bot-i18n (v1.2.0)                   │
              └──┬──────────────┬─────────────────┬───────────────┘
                 │              │                 │
   ┌─────────────▼──┐   ┌──────▼──────┐   ┌──────▼──────────┐
   │   Web App      │   │  Discord    │   │  Stoat Bot      │
   │   (v4.10.0)    │   │  Worker     │   │  (v0.1.4)       │
   │   9 tools,     │   │  (v4.5.0)   │   │  Revolt.js      │
   │   12 themes    │   │  20 cmds    │   └─────────────────┘
   └───────┬────────┘   └──────┬──────┘
           │                   │
   ┌───────▼────────┐         │   ┌────────────────────┐
   │  OAuth Worker  │         │   │  Presets API       │
   │   (v2.4.0)     │◄────────┴───│   (v1.5.0)         │
   │  PKCE + JWT    │             │  D1 + Moderation   │
   └────────────────┘             └──────┬─────────────┘
           │                             │
   ┌───────▼──────────────┐   ┌──────────▼───────────┐
   │  Universalis Proxy   │   │  Moderation Worker   │
   │   (v1.4.5)           │   │   (v1.2.0)           │
   │  CORS + Dual Caching │   └──────────────────────┘
   └──────────────────────┘

   ┌──────────────────────┐   ┌──────────────────────┐
   │  OpenGraph Worker    │   │  Public REST API     │
   │   (v1.2.0)           │   │  (api-worker v0.4.0) │
   │  Social media cards  │   │  data.xivdyetools…   │
   └──────────────────────┘   └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │  API Docs (VitePress)│
                              │  (api-docs v0.1.0)   │
                              │  developers.xivdye…  │
                              └──────────────────────┘
```

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

### For Developers

| Section | Description |
|---------|-------------|
| [Developer Guides](developer-guides/index.md) | Setup, testing, deployment, contributing |
| [Discord Bot v4](discord-bot/index.md) | V4 parity update, command reference, migration notes |
| [Reference](reference/index.md) | Quick reference materials, glossary |
| [Specifications](specifications/index.md) | Feature specifications and roadmap |

### For Maintainers

| Section | Description |
|---------|-------------|
| [Maintainer Guide](maintainer/index.md) | Architecture decisions, known issues, tech debt |
| [History](history/index.md) | Development timeline organized by topic |

---

## Projects Overview

### Applications

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [@xivdyetools/core](projects/core/overview.md) | npm library | v2.6.0 | Core color algorithms, 125 standard dyes plus 11 Facewear color entries (synthetic negative IDs), Universalis API |
| [xivdyetools-web-app](projects/web-app/overview.md) | Vite + Lit | v4.10.0 | Interactive web toolkit with 9 color tools |
| [xivdyetools-discord-worker](projects/discord-worker/overview.md) | CF Worker | v4.5.0 | Discord bot with 20 slash commands |
| [xivdyetools-moderation-worker](projects/moderation-worker/overview.md) | CF Worker | v1.2.0 | Community preset moderation bot |
| [xivdyetools-oauth](projects/oauth/overview.md) | CF Worker | v2.4.0 | Discord OAuth + JWT issuance |
| [xivdyetools-presets-api](projects/presets-api/overview.md) | CF Worker + D1 | v1.5.0 | Community presets with moderation |
| [xivdyetools-universalis-proxy](projects/universalis-proxy/overview.md) | CF Worker | v1.4.5 | CORS proxy for Universalis API with dual-layer caching |
| [xivdyetools-og-worker](projects/og-worker/overview.md) | CF Worker | v1.2.0 | Dynamic OpenGraph metadata for social media previews |
| [xivdyetools-api-worker](projects/api-worker/overview.md) | CF Worker + KV | v0.4.0 | Public REST API at `data.xivdyetools.app` (9 endpoints) |
| xivdyetools-api-docs | VitePress (CF Pages) | v0.1.0 | Developer-facing API reference at `developers.xivdyetools.app` |
| xivdyetools-stoat-worker | Node.js | v0.1.4 | Revolt (Stoat) bot with shared bot-logic |

### Shared Libraries

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [@xivdyetools/types](projects/types/overview.md) | npm library | v1.14.0 | Shared TypeScript types with Facewear support |
| [@xivdyetools/auth](projects/auth/overview.md) | npm library | v1.1.2 | JWT verification, HMAC signing, Discord Ed25519 |
| [@xivdyetools/crypto](projects/crypto/overview.md) | npm library | v1.1.0 | Base64URL encoding and hex utilities |
| [@xivdyetools/logger](projects/logger/overview.md) | npm library | v1.2.2 | Unified logging across environments |
| [@xivdyetools/rate-limiter](projects/rate-limiter/overview.md) | npm library | v1.4.4 | Sliding window rate limiting (Memory, KV, Upstash) |
| [@xivdyetools/worker-middleware](projects/worker-middleware/overview.md) | npm library | v1.1.2 | Shared Hono middleware (request ID, logger, rate limit) |
| [@xivdyetools/svg](projects/svg/overview.md) | npm library | v1.1.2 | Platform-agnostic SVG card generators |
| [@xivdyetools/bot-logic](projects/bot-logic/overview.md) | npm library | v1.2.0 | Platform-agnostic bot command logic |
| [@xivdyetools/bot-i18n](projects/bot-i18n/overview.md) | npm library | v1.2.0 | Bot internationalization |
| [@xivdyetools/color-blending](projects/color-blending/overview.md) | npm library | v1.0.1 | Color blending modes (RGB, LAB, OKLAB, Spectral) |
| [@xivdyetools/test-utils](projects/test-utils/overview.md) | npm library | v1.1.7 | Shared testing utilities |

### Developer Tools

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [xivdyetools-maintainer](maintainer/dye-maintainer-tool.md) | Vue 3 + Express | v1.0.2 | GUI for adding new dyes to the core library |

---

## Recent Updates

*Last updated: May 7, 2026*

### April 2026 Highlights

- **Patch 7.5 dye consolidation activated end-to-end** (core v2.5.0, web-app v4.9.0) — `CONSOLIDATED_IDS` populated with real itemIDs (A=52254, B=52255, C=52256); Market Board fans 3 consolidated prices to 105 dyes; ~105 → 3 market call collapse in effect
- **Allied Society dye filter retired** (core v2.6.0, types v1.14.0, web-app v4.10.0, discord-worker v4.5.0, api-worker v0.4.0) — `ALLIED_SOCIETY_ACQUISITIONS`, `excludeAlliedSocietyDyes`, `?alliedSociety=` query param all removed since Patch 7.5 consolidated those vendor categories out of the dye database
- **SEC-001 XSS hardening** (web-app v4.10.0) — `auth-button.ts` `innerHTML` interpolation of OAuth response strings replaced with `createElement` + `textContent`
- **`@xivdyetools/worker-middleware` extracted** (v1.0.0 → v1.1.2) — request-ID, logger, and rate-limit middleware consolidated from 5 workers into one shared package; ~185 lines of duplicated code eliminated
- **api-worker v0.4.0** at `data.xivdyetools.app` — Phase 1 with 9 public endpoints (filtering, sorting, pagination, color matching); KV-backed sliding-window rate limiting; OPT-001 `localeMiddleware`
- **api-docs v0.1.0 site** at `developers.xivdyetools.app` — VitePress with inline "Try It" panels firing live requests + one-click "Copy as cURL"
- **og-worker v1.2.0 localization** (`?lang=` query param) — OG embed metadata localized in all 6 languages

### March 2026 Highlights

- **@xivdyetools/core v2.0.0** — **BREAKING**: Removed ~35 deprecated type re-exports. Import `Dye`, `RGB`, etc. from `@xivdyetools/types` instead of core
- **Web App v4.3.0** — Pixel sampling (Shift+Click), canvas panning (Ctrl/Cmd+Drag), configurable 1×1 to 16×16 sample area
- **Patch 7.5 framework landed** (core v2.1.0) — `consolidated-ids.ts`, `getMarketItemID()`, `isConsolidationActive()` ready for activation

### February 2026 Highlights

- **Web App v4.2.0** — Prevent Duplicate Results toggle for Harmony and Extractor, Paste from Clipboard
- **Security Audit** — 14 findings resolved: CSRF fail-open, Upstash race condition, JWT expiration enforcement, hex validation, IP spoofing defaults
- **New Packages** — @xivdyetools/svg, bot-logic, bot-i18n, color-blending extracted as shared libraries

### January 2026 Highlights

- **Web App v4.0.0** — Tool renaming, Glassmorphism UI, 12 themes, Lit.js web components, 9 tools
- **Discord Bot v4.0.0** — Command renaming (`/extractor`, `/gradient`), new `/mixer` and `/swatch` commands

### December 2025 Highlights

- Budget Suggestions tool, Universalis Proxy, Facewear dye support, security hardening

See [Version Matrix](versions.md) for detailed version history and [Feature Roadmap](specifications/feature-roadmap.md) for planned features.

---

## Contributing

See the [Contributing Guide](developer-guides/contributing.md) for information on how to contribute to XIV Dye Tools.

---

## License

MIT License - See individual project repositories for details.

## Legal Notice

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. This project is not affiliated with or endorsed by Square Enix.
