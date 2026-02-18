# Feature Specifications

**Technical specifications for XIV Dye Tools features**

This section contains detailed specifications for both implemented and planned features.

---

## Specification Status Overview

| Specification | Status | Platform | Document |
|---------------|--------|----------|----------|
| **Community Presets** | ✅ Implemented | Web + Discord + API | [community-presets.md](community-presets.md) |
| **Collections System** | ✅ Implemented | Web + Discord | [collections.md](collections.md) |
| **Multi-Color Extraction** | ✅ Implemented | Web + Discord | [multi-color-extraction.md](multi-color-extraction.md) |
| **Preset Palettes** | ✅ Implemented | Web + Discord | [preset-palettes.md](preset-palettes.md) |
| **Budget-Aware Suggestions** | 📋 Planned | Web + Discord | [budget-aware-suggestions.md](budget-aware-suggestions.md) |
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
**Status:** ✅ Implemented (December 2025)

Organize favorite dyes into named collections.

**Key Features:**
- Create, edit, delete collections
- Add/remove dyes from collections
- Cross-platform (web + Discord)
- KV-backed storage (Discord) / localStorage (web)

[View Full Specification →](collections.md)

---

### Multi-Color Palette Extraction
**Status:** ✅ Implemented (December 2025)

Extract dominant colors from images using K-means++ clustering.

**Key Features:**
- Upload image or paste URL
- Extract 3-8 dominant colors
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

## Planned Features

### Budget-Aware Dye Suggestions
**Status:** 📋 Planned

Suggest affordable alternatives to expensive dyes based on real-time market prices.

**Concept:**
- Fetch current market prices via Universalis API
- Identify expensive dyes (>X gil threshold)
- Suggest visually similar but cheaper alternatives
- Show price comparison

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
