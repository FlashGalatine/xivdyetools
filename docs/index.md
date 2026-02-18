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
                    ┌─────────────────────────────────┐
                    │        Shared Packages          │
                    │  @xivdyetools/types (v1.7.0)    │
                    │  @xivdyetools/logger (v1.1.0)   │
                    │  @xivdyetools/test-utils (v1.1.0)│
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │    @xivdyetools/core (v1.15.1)  │
                    │   136 dyes, color algorithms,   │
                    │   Universalis API, 6 languages  │
                    └──┬──────────────┬───────────┬───┘
                       │              │           │
         ┌─────────────▼──┐    ┌──────▼─────┐    │
         │   Web App      │    │  Discord   │    │
         │   (v4.1.1)     │    │  Worker    │    │
         │   9 tools,     │    │  (v2.3.4)  │    │
         │   12 themes    │    │  17 cmds   │    │
         └───────┬────────┘    └──────┬─────┘    │
                 │                    │          │
         ┌───────▼────────┐           │   ┌──────▼──────────┐
         │  OAuth Worker  │           │   │  Presets API    │
         │   (v2.2.2)     │◄──────────┴───│   (v1.4.7)      │
         │  PKCE + JWT    │               │  D1 + Moderation │
         └────────────────┘               └──────┬──────────┘
                 │                               │
         ┌───────▼────────────────┐    ┌────────▼────────────┐
         │  Universalis Proxy     │    │  Moderation Worker  │
         │   (v1.3.0)             │    │   (v1.0.1)          │
         │  CORS + Dual Caching   │    └─────────────────────┘
         └────────────────────────┘
                 │
         ┌───────▼────────────────┐
         │  OpenGraph Worker      │
         │   (v1.0.0)             │
         │  Social media previews │
         └────────────────────────┘
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
| [@xivdyetools/core](projects/core/overview.md) | npm library | v1.15.1 | Core color algorithms, 136-dye database, Universalis API |
| [xivdyetools-web-app](projects/web-app/overview.md) | Vite + Lit | v4.1.1 | Interactive web toolkit with 9 color tools |
| [xivdyetools-discord-worker](projects/discord-worker/overview.md) | CF Worker | v2.3.4 | Discord bot with 17 slash commands |
| [xivdyetools-moderation-worker](projects/moderation-worker/overview.md) | CF Worker | v1.0.1 | Community preset moderation bot |
| [xivdyetools-oauth](projects/oauth/overview.md) | CF Worker | v2.2.2 | Discord OAuth + JWT issuance |
| [xivdyetools-presets-api](projects/presets-api/overview.md) | CF Worker + D1 | v1.4.7 | Community presets with moderation |
| [xivdyetools-universalis-proxy](projects/universalis-proxy/overview.md) | CF Worker | v1.3.0 | CORS proxy for Universalis API with dual-layer caching |
| [xivdyetools-og-worker](projects/og-worker/overview.md) | CF Worker | v1.0.0 | Dynamic OpenGraph metadata for social media previews |

### Shared Libraries

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [@xivdyetools/types](projects/types/overview.md) | npm library | v1.7.0 | Shared TypeScript types with Facewear support |
| [@xivdyetools/logger](projects/logger/overview.md) | npm library | v1.1.0 | Unified logging across environments |
| [@xivdyetools/test-utils](projects/test-utils/overview.md) | npm library | v1.1.0 | Shared testing utilities |

### Developer Tools

| Project | Type | Version | Purpose |
|---------|------|---------|---------|
| [xivdyetools-maintainer](maintainer/dye-maintainer-tool.md) | Vue 3 + Express | v1.0.0 | GUI for adding new dyes to the core library |

---

## Recent Updates

*Last updated: January 22, 2026*

### January 2026 Highlights

- **Web App v4.0.0** - Major release with tool renaming and new tools:
  - Color Matcher → **Palette Extractor**
  - Dye Mixer → **Gradient Builder**
  - Preset Browser → **Community Presets**
  - NEW: **Dye Mixer** (RGB color blending)
  - NEW: **Swatch Matcher** (character color matching)
- **9 Total Tools** - Up from 7 in v3.x
- **Glassmorphism UI** - New design system with 12 theme variants
- **Lit.js Web Components** - Modern component architecture
- **Discord Bot v4.0.0** - Planned parity update ([see documentation](discord-bot/v4-parity-update.md)):
  - `/match` + `/match_image` → `/extractor` (with subcommands)
  - `/mixer` → `/gradient` (frees up `/mixer` for new feature)
  - NEW: `/mixer` (dye blending) and `/swatch` (character colors)
  - Removes `/favorites` and `/collection` (consolidated into `/preset`)

### December 2025 Highlights

- **Budget Suggestions Tool** - New tool in the web app for finding affordable dye alternatives
- **Universalis Proxy** - New project providing CORS proxy with dual-layer caching for market data
- **User Ban System** - Discord bot now supports `/preset ban_user` and `/preset unban_user` commands
- **Facewear Dye Support** - Core library and types now support synthetic dye IDs for Facewear gear slot
- **Security Hardening** - Open redirect fixes, timeout protections, response size limits across all workers
- **Performance Optimizations** - Pre-computed search indices, LRU cache consolidation, memory leak fixes

See [Version Matrix](versions.md) for detailed version history and [Feature Roadmap](specifications/feature-roadmap.md) for planned features.

---

## Contributing

See the [Contributing Guide](developer-guides/contributing.md) for information on how to contribute to XIV Dye Tools.

---

## License

MIT License - See individual project repositories for details.

## Legal Notice

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. This project is not affiliated with or endorsed by Square Enix.
