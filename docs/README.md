# XIV Dye Tools Documentation

> Feature specifications, roadmaps, and design documents for the XIV Dye Tools ecosystem.

## Overview

This repository contains planning documents, feature specifications, and design documentation for the XIV Dye Tools project family. These documents guide development and serve as reference material.

## Contents

### Feature Specifications

| Document | Description | Status |
|----------|-------------|--------|
| [Community Presets](./specifications/community-presets.md) | Community preset submission, voting, and moderation system | ✅ Complete |
| [Collections](./specifications/collections.md) | User collections feature for organizing favorite dyes | ✅ Complete |
| [Multi-Color Extraction](./specifications/multi-color-extraction.md) | K-means++ palette extraction from images | ✅ Complete |
| [Preset Palettes](./specifications/preset-palettes.md) | Curated preset color palettes | ✅ Complete |
| [Budget-Aware Suggestions](./specifications/budget-aware-suggestions.md) | Price-conscious dye recommendations | ✅ Complete (shipped as the Budget Suggestions tool) |

### Roadmaps

| Document | Description |
|----------|-------------|
| [Feature Roadmap](./specifications/feature-roadmap.md) | Planned features and development priorities |

### Project-Specific Documentation

| Folder | Description |
|--------|-------------|
| [architecture/](./architecture/) | Ecosystem overview, dependency graph, service bindings, API contracts |
| [projects/](./projects/) | Deep-dive documentation per package and application |
| [developer-guides/](./developer-guides/) | Setup, testing, deployment, release process, contributing |
| [user-guides/](./user-guides/) | End-user guides for the web app, Discord bot, and public API |
| [maintainer/](./maintainer/) | Maintainer guides — canonical dye-addition workflow (`adding-dyes.md`) |
| [operations/](./operations/) | Operational guides (deploy environments, moderation, secret rotation) |
| [reference/](./reference/) | Glossary and FFXIV terminology |
| [research/](./research/) | Research and planning documents (Monorepo 2.0, color matching, API design) |
| [audits/](./audits/) | Dated audit archives — frozen snapshots, not maintained |
| [historical/](./historical/) | Archived documentation from previous development phases |

## Related Projects

This documentation covers the following projects:

### Applications

| Project | Version | Description |
|---------|---------|-------------|
| **xivdyetools-web-app** | v5.0.0 | Interactive web-based color tools (9 tools, Light + Dark themes) |
| **xivdyetools-discord-worker** | v5.0.0 | Serverless Discord bot (Cloudflare Workers, 17 registered commands) |
| **xivdyetools-image-worker** | v1.0.0 | Photon pixel extraction; service-binding only, no public surface |
| **xivdyetools-moderation-worker** | v1.3.0 | Moderation bot for community presets (Cloudflare Workers) |
| **xivdyetools-oauth** | v2.5.0 | Discord OAuth authentication worker (D1) |
| **xivdyetools-presets-api** | v1.6.0 | Community presets REST API (D1) |
| **xivdyetools-api-worker** | v0.5.0 | Public REST API at `data.xivdyetools.app`, Universalis proxy, and the VitePress developer docs |
| **xivdyetools-og-worker** | v2.0.0 | Localized OpenGraph card generation (`?lang=`, `?frame=x`) |
| **xivdyetools-stoat-worker** | v0.2.0 | Revolt bot (Stoat) — parked, no active investment |

### Shared Libraries

| Project | Version | Description |
|---------|---------|-------------|
| **@xivdyetools/core** | v4.0.0 | Color algorithms and the 125-dye database (schema v2); blending via `/blending` |
| **@xivdyetools/types** | v2.0.0 | Shared TypeScript type definitions and branded types |
| **@xivdyetools/auth** | v1.3.0 | JWT verification, HMAC signing, Discord Ed25519; Base64URL/hex via `/encoding` |
| **@xivdyetools/logger** | v1.3.0 | Unified logging across environments |
| **@xivdyetools/worker-kit** | v1.0.0 | Shared Hono middleware + sliding-window rate limiting via `/rate-limiter` |
| **@xivdyetools/svg** | v2.0.0 | Platform-agnostic SVG card generators |
| **@xivdyetools/bot-logic** | v2.0.0 | Platform-agnostic bot command logic; bot i18n via `/i18n` |
| **@xivdyetools/test-utils** | v1.2.0 | Shared testing utilities (workspace-private, not published) |

> **Retired projects**: the original `xivdyetools-discord-bot` (Discord.js + Gateway), the
> `xivdyetools-maintainer` GUI, `xivdyetools-universalis-proxy`, `xivdyetools-api-docs`, and the
> `crypto` / `bot-i18n` / `color-blending` / `rate-limiter` / `worker-middleware` packages have
> all been deprecated or absorbed. See `DEPRECATIONS.md` and the Deprecated table in
> [versions.md](./versions.md) for replacements.

## Contributing

When adding new documentation:

1. Use clear, descriptive filenames (e.g., `FEATURE_NAME_SPEC.md`)
2. Include a header with status, date, and author
3. Follow the existing format for consistency
4. Update this README if adding new categories

### Document Template

```markdown
# Feature Name

**Status**: Draft | In Progress | Complete
**Date**: YYYY-MM-DD
**Author**: Your Name

## Overview

Brief description of the feature.

## Requirements

- Requirement 1
- Requirement 2

## Design

Technical design details...

## Implementation Notes

Any implementation-specific details...
```

## License

MIT © 2025-2026 Flash Galatine

## Legal Notice

**This is a fan-made tool and is not affiliated with or endorsed by Square Enix Co., Ltd. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## Support

- **Issues**: [GitHub Issues](https://github.com/FlashGalatine/xivdyetools/issues)
- **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

---

**Made with ❤️ for the FFXIV community**
