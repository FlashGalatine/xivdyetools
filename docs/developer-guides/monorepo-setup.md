> **⚠️ DEPRECATED:** This document has been superseded by the Documentation Bible.
> See: [index.md](index.md) for the main navigation hub.

# XIV Dye Tools

**The ultimate color toolkit for Final Fantasy XIV glamour enthusiasts**

A comprehensive suite of tools to help you find the perfect dyes for your glamour, analyze color harmonies, extract palettes from images, and discover community-created preset combinations.

---

## Features

### Web Application
A fully-featured browser-based toolkit with **6 interactive tools**:

| Tool | Description |
|------|-------------|
| **Dye Mixer** | Create custom color gradients between any two FFXIV dyes |
| **Color Matcher** | Find the closest FFXIV dye to any color with multi-color palette extraction |
| **Color Harmony Explorer** | Discover complementary, triadic, and analogous dye combinations |
| **Dye Comparison** | Compare dyes side-by-side with visual charts |
| **Accessibility Checker** | Simulate colorblindness to ensure your glamour looks great for everyone |
| **Preset Browser** | Browse, vote on, and share community-created dye palettes |

### Discord Bot
Bring dye tools directly to your Discord server with **17 slash commands**:

- `/match` & `/match_image` - Match colors to FFXIV dyes
- `/harmony` - Generate color harmonies
- `/dye` - Search and explore the 136-dye database
- `/comparison` & `/accessibility` - Analysis tools
- `/preset` - Browse and submit community presets
- `/favorites` & `/collection` - Save your favorite dyes

### Core Features
- **136 Official FFXIV Dyes** - Complete database with accurate colors
- **Real-Time Market Prices** - Powered by Universalis API
- **6 Languages** - English, Japanese, German, French, Korean, Chinese
- **Colorblindness Simulation** - Protanopia, Deuteranopia, Tritanopia support
- **K-means++ Palette Extraction** - Extract dominant colors from any image

---

## Coming Soon

**Budget-Aware Dye Suggestions** - Find affordable alternatives to expensive dyes based on current market prices. [View Specification](../specifications/budget-aware-suggestions.md)

---

## Projects

This monorepo contains six active projects:

| Project | Version | Description |
|---------|---------|-------------|
| [xivdyetools-core](xivdyetools-core/) | v1.3.7 | Core TypeScript library with color algorithms and dye database |
| [xivdyetools-web-app](xivdyetools-web-app/) | v2.6.0 | Vite + Lit web application |
| [xivdyetools-discord-worker](xivdyetools-discord-worker/) | v2.0.1 | Cloudflare Worker Discord bot |
| [xivdyetools-oauth](xivdyetools-oauth/) | v1.1.0 | Discord OAuth authentication worker |
| [xivdyetools-presets-api](xivdyetools-presets-api/) | v1.1.0 | Community presets API with D1 database |
| [xivdyetools-docs](xivdyetools-docs/) | — | Feature specifications and documentation |

---

## Technology Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Lit](https://img.shields.io/badge/Lit-324FFF?style=flat&logo=lit&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)

- **Frontend**: Lit web components, Tailwind CSS, Vite
- **Backend**: Cloudflare Workers, D1 SQLite, KV Storage
- **Core Library**: TypeScript, k-d tree indexing, LRU caching
- **Testing**: Vitest with 97%+ coverage

---

## Quick Start

### Use the Web App
Visit the live web application to start exploring dye colors immediately.

### Add the Discord Bot
Invite the bot to your Discord server to access all dye tools via slash commands.

### Use the Core Library
```bash
npm install xivdyetools-core
```

```typescript
import { ColorService, DyeService, dyeDatabase } from 'xivdyetools-core';

// Find the closest dye to a hex color
const dyeService = new DyeService(dyeDatabase);
const match = dyeService.findClosestDye('#FF6B6B');
console.log(match.name); // "Dalamud Red"

// Generate color harmonies
const harmonies = dyeService.findTriadicDyes('#FF6B6B');
```

---

## Development

Each project has its own development workflow. See individual project READMEs for details.

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/xivdyetools.git
cd xivdyetools

# Install dependencies for a specific project
cd xivdyetools-core
npm install

# Run tests
npm test

# Build
npm run build
```

---

## Documentation

- **[Core Library Docs](xivdyetools-core/README.md)** - API reference and usage examples
- **[Web App Docs](xivdyetools-web-app/README.md)** - Feature guide and development setup
- **[Discord Bot Docs](xivdyetools-discord-worker/README.md)** - Command reference and deployment
- **[Feature Specifications](xivdyetools-docs/)** - Detailed feature specs and roadmaps

---

## License

MIT License - See [LICENSE](LICENSE) for details.

## Legal Notice

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. This project is not affiliated with or endorsed by Square Enix. All FINAL FANTASY XIV content and materials are trademarks and copyrights of Square Enix.

## Author

**DrawfulDev**

- GitHub: [@DrawfulDev](https://github.com/DrawfulDev)
- Discord: Available via the Discord bot
