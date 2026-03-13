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
              │  @xivdyetools/types (v1.9.0)                      │
              │  @xivdyetools/logger (v1.2.2)                     │
              │  @xivdyetools/auth (v1.1.1)                       │
              │  @xivdyetools/crypto (v1.1.0)                     │
              │  @xivdyetools/rate-limiter (v1.4.3)               │
              │  @xivdyetools/test-utils (v1.1.5)                 │
              └───────────────────────┬────────────────────────────┘
                                      │
              ┌───────────────────────▼────────────────────────────┐
              │              @xivdyetools/core (v2.0.1)           │
              │  136 dyes, color algorithms, Universalis API,     │
              │  6 languages, k-d tree matching                   │
              ├───────────────────────────────────────────────────-┤
              │  @xivdyetools/color-blending (v1.0.1)             │
              │  @xivdyetools/svg (v1.1.2)                        │
              │  @xivdyetools/bot-logic (v1.1.2)                  │
              │  @xivdyetools/bot-i18n (v1.1.0)                   │
              └──┬──────────────┬─────────────────┬───────────────┘
                 │              │                 │
   ┌─────────────▼──┐   ┌──────▼──────┐   ┌──────▼──────────┐
   │   Web App      │   │  Discord    │   │  Stoat Bot      │
   │   (v4.3.1)     │   │  Worker     │   │  (v0.1.3)       │
   │   9 tools,     │   │  (v4.1.2)   │   │  Revolt.js      │
   │   12 themes    │   │  19 cmds    │   └─────────────────┘
   └───────┬────────┘   └──────┬──────┘
           │                   │
   ┌───────▼────────┐         │   ┌────────────────────┐
   │  OAuth Worker  │         │   │  Presets API       │
   │   (v2.3.8)     │◄────────┴───│   (v1.4.15)        │
   │  PKCE + JWT    │             │  D1 + Moderation   │
   └────────────────┘             └──────┬─────────────┘
           │                             │
   ┌───────▼──────────────┐   ┌──────────▼───────────┐
   │  Universalis Proxy   │   │  Moderation Worker   │
   │   (v1.4.3)           │   │   (v1.1.8)           │
   │  CORS + Dual Caching │   └──────────────────────┘
   └──────────────────────┘
           │
   ┌───────▼──────────────┐
   │  OpenGraph Worker    │
   │   (v1.0.6)           │
   │  Social media cards  │
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
| [@xivdyetools/core](projects/core/overview.md) | npm library | v2.0.1 | Core color algorithms, 136-dye database, Universalis API |
| [xivdyetools-web-app](projects/web-app/overview.md) | Vite + Lit | v4.3.1 | Interactive web toolkit with 9 color tools |
| [xivdyetools-discord-worker](projects/discord-worker/overview.md) | CF Worker | v4.1.2 | Discord bot with 19 slash commands |
| [xivdyetools-moderation-worker](projects/moderation-worker/overview.md) | CF Worker | v1.1.8 | Community preset moderation bot |
| [xivdyetools-oauth](projects/oauth/overview.md) | CF Worker | v2.3.8 | Discord OAuth + JWT issuance |
| [xivdyetools-presets-api](projects/presets-api/overview.md) | CF Worker + D1 | v1.4.15 | Community presets with moderation |
| [xivdyetools-universalis-proxy](projects/universalis-proxy/overview.md) | CF Worker | v1.4.3 | CORS proxy for Universalis API with dual-layer caching |
| [xivdyetools-og-worker](projects/og-worker/overview.md) | CF Worker | v1.0.6 | Dynamic OpenGraph metadata for social media previews |
| xivdyetools-stoat-worker | Node.js | v0.1.3 | Revolt (Stoat) bot with shared bot-logic |

### Shared Libraries

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [@xivdyetools/types](projects/types/overview.md) | npm library | v1.9.0 | Shared TypeScript types with Facewear support |
| [@xivdyetools/auth](projects/auth/overview.md) | npm library | v1.1.1 | JWT verification, HMAC signing, Discord Ed25519 |
| [@xivdyetools/crypto](projects/crypto/overview.md) | npm library | v1.1.0 | Base64URL encoding and hex utilities |
| [@xivdyetools/logger](projects/logger/overview.md) | npm library | v1.2.2 | Unified logging across environments |
| [@xivdyetools/rate-limiter](projects/rate-limiter/overview.md) | npm library | v1.4.3 | Sliding window rate limiting (Memory, KV, Upstash) |
| [@xivdyetools/svg](projects/svg/overview.md) | npm library | v1.1.2 | Platform-agnostic SVG card generators |
| [@xivdyetools/bot-logic](projects/bot-logic/overview.md) | npm library | v1.1.2 | Platform-agnostic bot command logic |
| [@xivdyetools/bot-i18n](projects/bot-i18n/overview.md) | npm library | v1.1.0 | Bot internationalization |
| [@xivdyetools/color-blending](projects/color-blending/overview.md) | npm library | v1.0.1 | Color blending modes (RGB, LAB, OKLAB, Spectral) |
| [@xivdyetools/test-utils](projects/test-utils/overview.md) | npm library | v1.1.5 | Shared testing utilities |

### Developer Tools

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [xivdyetools-maintainer](maintainer/dye-maintainer-tool.md) | Vue 3 + Express | v1.0.2 | GUI for adding new dyes to the core library |

---

## Recent Updates

*Last updated: March 13, 2026*

### March 2026 Highlights

- **@xivdyetools/core v2.0.0** — **BREAKING**: Removed ~35 deprecated type re-exports. Import `Dye`, `RGB`, etc. from `@xivdyetools/types` instead of core. 28 symbols marked `@internal`
- **Web App v4.3.0** — Pixel sampling (Shift+Click), canvas panning (Ctrl/Cmd+Drag), configurable 1×1 to 16×16 sample area
- **Discord Worker v4.1.x** — Budget quick picks updated with 20 Cosmic dyes, prevent duplicate results for extractor
- **Dead Code Cleanup** — Waves 5–14 across all packages, removing ~100+ unused symbols, files, and legacy code
- **Dependency Updates** — hono 4.12.5 (security fixes), wrangler 4.71.0, Vitest 4.0.18, TypeScript 5.9.3

### February 2026 Highlights

- **Web App v4.2.0** — Prevent Duplicate Results toggle for Harmony and Extractor, Paste from Clipboard
- **Discord Worker v4.0.1** — 7 bug fixes including LocalizationService race condition, broken budget embeds, input sanitization
- **Security Audit** — 14 findings resolved: CSRF fail-open, Upstash race condition, JWT expiration enforcement, hex validation, IP spoofing defaults
- **ESLint v10 Migration** — Upgraded across entire monorepo, 200+ lint errors fixed
- **Bot Logic Test Suite** — 193 comprehensive tests across 10 files
- **Performance** — LRU cache for `rgbToOklab()` (OPT-001), CryptoKey caching (OPT-002)
- **New Packages** — @xivdyetools/svg, bot-logic, bot-i18n, color-blending extracted as shared libraries
- **Stoat Worker** — Initial Revolt.js bot release

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
