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
| [maintainer/](./maintainer/) | Maintainer guides including the Dye Maintainer Tool |
| [operations/](./operations/) | Operational guides (moderation, secret rotation) |
| [20251207-DiscordBotMigration/](./20251207-DiscordBotMigration/) | Discord bot migration from Gateway to HTTP Interactions |
| [20251207-PresetRefinements/](./20251207-PresetRefinements/) | Preset system refinements and improvements |
| [historical/](./historical/) | Archived documentation from previous development phases |

## Related Projects

This documentation covers the following projects:

### Applications

| Project | Version | Description |
|---------|---------|-------------|
| **xivdyetools-core** | v1.5.4 | Core color algorithms and dye database (npm library) |
| **xivdyetools-web-app** | v4.0.0 | Interactive web-based color tools (9 tools) |
| **xivdyetools-discord-worker** | v2.3.1 | Serverless Discord bot (Cloudflare Workers) |
| **xivdyetools-oauth** | v2.2.2 | Discord OAuth authentication worker |
| **xivdyetools-presets-api** | v1.4.5 | Community presets REST API |

### Shared Libraries

| Project | Version | Description |
|---------|---------|-------------|
| **@xivdyetools/types** | v1.1.1 | Shared TypeScript type definitions |
| **@xivdyetools/logger** | v1.0.2 | Unified logging across environments |
| **@xivdyetools/test-utils** | v1.0.3 | Shared testing utilities |

### Developer Tools

| Project | Version | Description |
|---------|---------|-------------|
| **xivdyetools-maintainer** | v1.0.0 | GUI for adding new dyes (Vue 3 + Express) |

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

MIT © 2025 Flash Galatine

## Legal Notice

**This is a fan-made tool and is not affiliated with or endorsed by Square Enix Co., Ltd. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**

## Connect With Me

**Flash Galatine** | Balmung (Crystal)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X / Twitter**: [@AsheJunius](https://x.com/AsheJunius)
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
