# Feature Specifications

**Technical specifications for XIV Dye Tools features**

This section contains detailed specifications for both implemented and planned features.

---

## Specification Status Overview

| Specification | Status | Platform | Document |
|---------------|--------|----------|----------|
| **Community Presets** | ✅ Implemented | Web + Discord + API | [community-presets.md](community-presets.md) |
| **Collections System** | ✅ Implemented | Web only (Discord side removed in 5.0) | [collections.md](collections.md) |
| **Multi-Color Extraction** | ✅ Implemented | Web + Discord | [multi-color-extraction.md](multi-color-extraction.md) |
| **Preset Palettes** | ✅ Implemented | Web + Discord | [preset-palettes.md](preset-palettes.md) |
| **Budget-Aware Suggestions** | ✅ Implemented | Web + Discord | [budget-aware-suggestions.md](budget-aware-suggestions.md) |
| **Feature Roadmap** | 📊 Tracking | All | [feature-roadmap.md](feature-roadmap.md) |

---

## Implemented Features

### Community Presets System
**Status:** ✅ Implemented (December 2025)

User-submitted dye palettes with voting, moderation, and cross-platform sync.

**Key Components:**
- REST API (xivdyetools-presets-api)
- D1 SQLite database
- Multi-layer moderation (profanity filter + Perspective API + manual review)
- Duplicate detection via dye signature
- Rate limiting (10 submissions/user/day)

[View Full Specification →](community-presets.md)

---

### Collections System
**Status:** ✅ Implemented — web app only

Favorite dyes plus typed saved-palette records written by the tools' own Save actions.

**Key Features:**
- Create, edit, delete saved palettes
- Add/remove dyes from a saved palette
- Typed records: `palette`, `swap` (budget substitutes) and `character` (`.chara`-derived)
- localStorage-backed, per browser; export / import as JSON
- The Discord side (`/favorites`, `/collection`) was **removed in 5.0** — see the spec

[View Full Specification →](collections.md)

---

### Multi-Color Palette Extraction
**Status:** ✅ Implemented (December 2025)

Extract dominant colors from images using K-means++ clustering.

**Key Features:**
- Upload, paste or drop an image
- Extract dominant colors — the service clamps to 1–10, default 4; the surfaces offer 3–10
- Match each color to closest FFXIV dye
- Available in web app and Discord bot

[View Full Specification →](multi-color-extraction.md)

---

### Preset Palettes
**Status:** ✅ Implemented (December 2025)

Curated dye palettes for various use cases.

**Categories:**
- Glamour presets
- Housing presets
- Seasonal themes
- Job-specific palettes

[View Full Specification →](preset-palettes.md)

---

### Budget-Aware Dye Suggestions
**Status:** ✅ Implemented

Suggest affordable alternatives to expensive dyes based on real-time market prices. Shipped as the
web app's **Budget Suggestions** tool and the Discord bot's `/budget` command (`find`, `quick`,
`set_world`).

**Key Components:**
- Market prices via the Universalis API, proxied and cached by `api-worker`
- Colour-distance ledger of substitutes with a configurable match line (ΔE2000 2–20, default 8)
- 22 quick-pick presets for the popular expensive dyes
- Per-user saved world / data centre

[View Full Specification →](budget-aware-suggestions.md)

---

## Feature Roadmap

The [Feature Roadmap](feature-roadmap.md) tracks all features across the ecosystem:

- ✅ Completed features with implementation details
- 📋 Planned features with effort estimates
- 🔄 In-progress work

---

## Writing Specifications

When adding new feature specifications:

1. **Use the template** - Include Overview, User Value, Technical Design, API contracts
2. **Include diagrams** - ASCII or Mermaid for architecture
3. **Define acceptance criteria** - Clear "done" conditions
4. **Consider all platforms** - Web app, Discord bot, core library
5. **Document trade-offs** - Why this approach vs alternatives

---

## Related Documentation

- [Architecture](../architecture/overview.md) - System design
- [Projects](../projects/index.md) - Technical documentation
- [API Contracts](../architecture/api-contracts.md) - API specifications
