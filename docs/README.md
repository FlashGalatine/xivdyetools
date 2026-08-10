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
| [Budget-Aware Suggestions](./specifications/budget-aware-suggestions.md) | Price-conscious dye recommendations | 📋 Planned |

### Roadmaps

| Document | Description |
|----------|-------------|
| [Feature Roadmap](./specifications/feature-roadmap.md) | Planned features and development priorities |

### Project-Specific Documentation

| Folder | Description |
|--------|-------------|
| [maintainer/](./maintainer/) | Maintainer guides — canonical dye-addition workflow (`adding-dyes.md`) |
| [operations/](./operations/) | Operational guides (moderation, secret rotation) |
| [20251207-DiscordBotMigration/](./20251207-DiscordBotMigration/) | Discord bot migration from Gateway to HTTP Interactions |
| [20251207-PresetRefinements/](./20251207-PresetRefinements/) | Preset system refinements and improvements |
| [historical/](./historical/) | Archived documentation from previous development phases |

## Related Projects

This documentation covers the following projects:

### Applications

| Project | Version | Description |
|---------|---------|-------------|
| **xivdyetools-core** | v2.7.0 | Core color algorithms and dye database — 125 standard dyes plus 11 Facewear color entries (synthetic negative IDs); npm library |
| **xivdyetools-web-app** | v4.12.0 | Interactive web-based color tools (9 tools) |
| **xivdyetools-discord-worker** | v4.7.0 | Serverless Discord bot (Cloudflare Workers, 20 commands) |
| **xivdyetools-moderation-worker** | v1.3.0 | Moderation bot for community presets (Cloudflare Workers) |
| **xivdyetools-oauth** | v2.5.0 | Discord OAuth authentication worker |
| **xivdyetools-presets-api** | v1.6.0 | Community presets REST API |
| **xivdyetools-universalis-proxy** | v1.5.0 | CORS proxy for Universalis market data |
| **xivdyetools-og-worker** | v1.4.0 | Dynamic OpenGraph image generation (localized via `?lang=`) |
| **xivdyetools-api-worker** | v0.5.0 | Public REST API at `data.xivdyetools.app` (9 endpoints) |
| **xivdyetools-api-docs** | v0.1.0 | Developer-facing API documentation site (VitePress) |
| **xivdyetools-stoat-worker** | v0.2.0 | Revolt bot (Stoat) |

### Shared Libraries

| Project | Version | Description |
|---------|---------|-------------|
| **@xivdyetools/types** | v1.15.0 | Shared TypeScript type definitions |
| **@xivdyetools/auth** | v1.2.0 | JWT verification, HMAC signing, Discord Ed25519 |
| **@xivdyetools/crypto** | v1.1.2 | Base64URL encoding and hex utilities |
| **@xivdyetools/logger** | v1.3.0 | Unified logging across environments |
| **@xivdyetools/rate-limiter** | v1.5.0 | Sliding window rate limiting |
| **@xivdyetools/worker-middleware** | v1.2.0 | Shared Hono middleware (request ID, logger, rate limit) |
| **@xivdyetools/svg** | v1.2.1 | Platform-agnostic SVG card generators |
| **@xivdyetools/bot-logic** | v1.3.0 | Platform-agnostic bot command logic |
| **@xivdyetools/bot-i18n** | v1.2.1 | Bot internationalization |
| **@xivdyetools/color-blending** | v1.1.0 | Color blending modes |
| **@xivdyetools/test-utils** | v1.1.8 | Shared testing utilities |

### Developer Tools

| Project | Version | Description |
|---------|---------|-------------|

> **Note**: The original `xivdyetools-discord-bot` (Discord.js + Gateway) has been deprecated and replaced by `xivdyetools-discord-worker`.

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
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
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
