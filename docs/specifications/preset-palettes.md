> **⚠️ DEPRECATED:** This document has been superseded by the Documentation Bible.
> See: [specifications/community-presets.md](specifications/community-presets.md)

# Seasonal/Themed Preset Palettes - Specification

> Feature Status: Planned
> Platforms: Web App + Discord Bot
> Core Library Changes: Yes (preset data and service)

## Overview

Pre-made color palettes for common themes, allowing users to quickly apply curated dye combinations without manual selection.

### User Value

- **Quick inspiration** - Browse curated palettes for ideas
- **Job identity** - Use official job colors for role-playing
- **Seasonal glamours** - Ready-made palettes for events
- **Starting points** - Customize presets rather than starting from scratch

---

## Data Structure

### Preset Palette Schema

```typescript
interface PresetPalette {
  id: string;           // Unique identifier (e.g., "job-rdm", "season-autumn")
  name: string;         // Display name (e.g., "Red Mage")
  category: PresetCategory;
  description: string;  // Brief description
  dyes: DyeId[];        // Array of dye IDs (3-5 dyes)
  tags: string[];       // Searchable tags
  author?: string;      // Credit for community submissions
  version: string;      // For future updates
}

type PresetCategory =
  | 'jobs'
  | 'grand-companies'
  | 'seasons'
  | 'events'
  | 'aesthetics'
  | 'community';

interface PresetData {
  version: string;
  lastUpdated: string;
  categories: Record<PresetCategory, CategoryMeta>;
  palettes: PresetPalette[];
}

interface CategoryMeta {
  name: string;          // Localized category name
  description: string;   // Category description
  icon?: string;         // Optional icon/emoji
}
```

### Example Data File

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-12-04",
  "categories": {
    "jobs": {
      "name": "FFXIV Jobs",
      "description": "Color schemes inspired by job identities",
      "icon": "⚔️"
    },
    "grand-companies": {
      "name": "Grand Companies",
      "description": "Official Grand Company colors",
      "icon": "🏛️"
    },
    "seasons": {
      "name": "Seasons",
      "description": "Seasonal color palettes",
      "icon": "🍂"
    },
    "events": {
      "name": "FFXIV Events",
      "description": "Colors for in-game seasonal events",
      "icon": "🎉"
    },
    "aesthetics": {
      "name": "Aesthetics",
      "description": "General aesthetic themes",
      "icon": "🎨"
    }
  },
  "palettes": [
    {
      "id": "job-rdm",
      "name": "Red Mage",
      "category": "jobs",
      "description": "The crimson elegance of the Red Mage",
      "dyes": [40, 39, 12, 1],
      "tags": ["red mage", "rdm", "caster", "melee", "crimson"]
    }
  ]
}
```

---

## Initial Palette Collection

### Jobs Category

| ID | Name | Colors | Dyes (Names) |
|----|------|--------|--------------|
| `job-rdm` | Red Mage | Crimson, Black, Gold, White | Dalamud Red, Jet Black, Metallic Gold, Snow White |
| `job-blm` | Black Mage | Purple, Black, Gold | Royal Purple, Jet Black, Metallic Gold |
| `job-whm` | White Mage | White, Green, Brown | Snow White, Celeste Green, Bark Brown |
| `job-pld` | Paladin | Blue, Silver, White | Royal Blue, Metallic Silver, Snow White |
| `job-war` | Warrior | Red, Black, Brown | Wine Red, Soot Black, Bark Brown |
| `job-drk` | Dark Knight | Black, Purple, Red | Jet Black, Grape Purple, Blood Red |
| `job-gnb` | Gunbreaker | Blue, Gray, Black | Turquoise Blue, Ash Grey, Soot Black |
| `job-drg` | Dragoon | Blue, Red, Silver | Dragon Blue, Ruby Red, Metallic Silver |
| `job-mnk` | Monk | Yellow, Orange, Brown | Ul Brown, Sunset Orange, Desert Yellow |
| `job-nin` | Ninja | Black, Red, Purple | Jet Black, Blood Red, Grape Purple |
| `job-sam` | Samurai | Red, White, Black | Wine Red, Snow White, Jet Black |
| `job-rpr` | Reaper | Purple, Black, Red | Currant Purple, Jet Black, Blood Red |
| `job-vpr` | Viper | Green, Purple, Black | Hunter Green, Currant Purple, Jet Black |
| `job-brd` | Bard | Green, Brown, Yellow | Moss Green, Bark Brown, Desert Yellow |
| `job-mch` | Machinist | Gray, Blue, Black | Gunmetal Black, Ice Blue, Soot Black |
| `job-dnc` | Dancer | Pink, White, Gold | Lotus Pink, Snow White, Metallic Gold |
| `job-smn` | Summoner | Green, Yellow, Brown | Turquoise Green, Canary Yellow, Bark Brown |
| `job-sch` | Scholar | Purple, White, Gold | Iris Purple, Snow White, Metallic Gold |
| `job-ast` | Astrologian | Blue, Purple, Gold | Midnight Blue, Lavender Purple, Metallic Gold |
| `job-sge` | Sage | White, Blue, Silver | Pearl White, Ice Blue, Metallic Silver |
| `job-pct` | Pictomancer | Rainbow, White | Various pastels, Snow White |

### Grand Companies Category

| ID | Name | Colors | Dyes (Names) |
|----|------|--------|--------------|
| `gc-maelstrom` | Maelstrom | Red, Black, White | Dalamud Red, Jet Black, Snow White |
| `gc-adders` | Twin Adders | Yellow, Green, Brown | Canary Yellow, Moss Green, Bark Brown |
| `gc-flames` | Immortal Flames | Black, Gold, Red | Soot Black, Metallic Gold, Wine Red |

### Seasons Category

| ID | Name | Colors | Dyes (Names) |
|----|------|--------|--------------|
| `season-spring` | Spring | Pink, Green, Yellow | Lotus Pink, Celeste Green, Cream Yellow |
| `season-summer` | Summer | Blue, Yellow, Orange | Ceruleum Blue, Canary Yellow, Sunset Orange |
| `season-autumn` | Autumn | Orange, Brown, Red | Pumpkin Orange, Bark Brown, Wine Red |
| `season-winter` | Winter | White, Blue, Silver | Snow White, Ice Blue, Metallic Silver |

### Events Category

| ID | Name | Colors | Dyes (Names) |
|----|------|--------|--------------|
| `event-starlight` | Starlight Celebration | Red, Green, White | Dalamud Red, Hunter Green, Snow White |
| `event-moonfire` | Moonfire Faire | Blue, White, Gold | Ceruleum Blue, Snow White, Metallic Gold |
| `event-rising` | The Rising | Gold, Purple, White | Metallic Gold, Royal Purple, Pearl White |
| `event-hatching` | Hatching-tide | Pastel Pink, Pastel Green, Yellow | Pastel Pink, Pastel Green, Cream Yellow |
| `event-valentione` | Valentione's Day | Red, Pink, White | Dalamud Red, Lotus Pink, Snow White |
| `event-heavensturn` | Heavensturn | Red, Gold, Black | Wine Red, Metallic Gold, Jet Black |

### Aesthetics Category

| ID | Name | Colors | Dyes (Names) |
|----|------|--------|--------------|
| `aesthetic-gothic` | Gothic | Black, Purple, Red | Jet Black, Grape Purple, Blood Red |
| `aesthetic-pastel` | Pastel Dream | Pastel Pink, Pastel Blue, Pastel Green | Pastel Pink, Pastel Blue, Pastel Green |
| `aesthetic-military` | Military | Green, Brown, Gray | Olive Green, Bark Brown, Ash Grey |
| `aesthetic-royal` | Royal | Gold, Purple, White | Metallic Gold, Royal Purple, Pearl White |
| `aesthetic-cyberpunk` | Cyberpunk | Pink, Blue, Black | Metallic Pink, Turquoise Blue, Jet Black |
| `aesthetic-nature` | Natural | Green, Brown, Cream | Moss Green, Bark Brown, Cream Yellow |
| `aesthetic-monochrome` | Monochrome | Black, Gray, White | Jet Black, Ash Grey, Snow White |
| `aesthetic-ocean` | Ocean | Blue, Teal, White | Ceruleum Blue, Turquoise Blue, Pearl White |
| `aesthetic-sunset` | Sunset | Orange, Pink, Purple | Sunset Orange, Coral Pink, Lavender Purple |
| `aesthetic-forest` | Forest | Green, Brown, Gold | Hunter Green, Bark Brown, Metallic Gold |

---

## Core Library Implementation

### PresetService

```typescript
// src/services/PresetService.ts
import presetData from '../data/presets.json';

export class PresetService {
  private data: PresetData;

  constructor() {
    this.data = presetData;
  }

  /**
   * Get all preset categories
   */
  getCategories(): CategoryMeta[] {
    return Object.entries(this.data.categories).map(([id, meta]) => ({
      id,
      ...meta
    }));
  }

  /**
   * Get all presets in a category
   */
  getPresetsByCategory(category: PresetCategory): PresetPalette[] {
    return this.data.palettes.filter(p => p.category === category);
  }

  /**
   * Get a specific preset by ID
   */
  getPreset(id: string): PresetPalette | undefined {
    return this.data.palettes.find(p => p.id === id);
  }

  /**
   * Search presets by name or tags
   */
  searchPresets(query: string): PresetPalette[] {
    const lowerQuery = query.toLowerCase();
    return this.data.palettes.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get random preset, optionally filtered by category
   */
  getRandomPreset(category?: PresetCategory): PresetPalette {
    const pool = category
      ? this.getPresetsByCategory(category)
      : this.data.palettes;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Get preset with resolved dye objects
   */
  getPresetWithDyes(id: string, dyeService: DyeService): ResolvedPreset | undefined {
    const preset = this.getPreset(id);
    if (!preset) return undefined;

    return {
      ...preset,
      resolvedDyes: preset.dyes.map(dyeId => dyeService.getDyeById(dyeId))
    };
  }
}

interface ResolvedPreset extends PresetPalette {
  resolvedDyes: Dye[];
}
```

### File Structure

```
xivdyetools-core/
├── src/
│   ├── data/
│   │   └── presets.json      # Preset palette data
│   ├── services/
│   │   └── PresetService.ts  # Preset service
│   └── index.ts              # Export PresetService
```

---

## Web App Implementation

### UI Design

**Option A: Section in Harmony Explorer**
Add "Preset Palettes" tab alongside harmony types.

**Option B: Standalone Preset Browser (Recommended)**
New tool accessible from navigation.

```
┌─────────────────────────────────────────────────────┐
│  Preset Palettes                          [Search]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Categories:                                        │
│  [⚔️ Jobs] [🏛️ Grand Companies] [🍂 Seasons]       │
│  [🎉 Events] [🎨 Aesthetics]                        │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⚔️ Jobs                                            │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ [████████████]  │  │ [████████████]  │          │
│  │ Red Mage        │  │ Black Mage      │          │
│  │ Crimson elegance│  │ Dark arcane     │          │
│  │ [Apply] [View]  │  │ [Apply] [View]  │          │
│  └─────────────────┘  └─────────────────┘          │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ [████████████]  │  │ [████████████]  │          │
│  │ White Mage      │  │ Paladin         │          │
│  │ Pure healing    │  │ Noble defender  │          │
│  │ [Apply] [View]  │  │ [Apply] [View]  │          │
│  └─────────────────┘  └─────────────────┘          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Preset Detail Modal

```
┌─────────────────────────────────────────────────────┐
│  Red Mage                                     [×]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ [████] [████] [████] [████]                  │   │
│  │  Dalamud  Jet    Metallic  Snow              │   │
│  │  Red     Black    Gold    White              │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  The crimson elegance of the Red Mage, combining    │
│  the fiery passion of red magic with the refined    │
│  sophistication of black and gold accents.          │
│                                                     │
│  Tags: red mage, rdm, caster, melee, crimson        │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ [Use in Harmony Explorer]                    │   │
│  │ [Use in Dye Mixer]                           │   │
│  │ [Use in Comparison]                          │   │
│  │ [Copy Dye Names]                             │   │
│  │ [Export as JSON]                             │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### File Changes

| File | Changes |
|------|---------|
| `preset-browser.ts` | New component |
| `preset-card.ts` | New component for palette preview |
| `preset-detail-modal.ts` | New component for detail view |
| `app-layout.ts` | Add navigation item |

---

## Discord Bot Implementation

### Commands

#### `/preset list [category]`

List available presets, optionally filtered by category.

```
🎨 Preset Palettes - Jobs

1. Red Mage - Crimson elegance
2. Black Mage - Dark arcane power
3. White Mage - Pure healing light
4. Paladin - Noble defender
... (15 more)

Use `/preset show <name>` to view details
```

#### `/preset show <name>`

Display preset with color swatches.

```
🎨 Red Mage

The crimson elegance of the Red Mage

Colors:
• Dalamud Red (#AA1111)
• Jet Black (#0A0A0A)
• Metallic Gold (#CBA135)
• Snow White (#F5F5F5)

Tags: red mage, rdm, caster, melee, crimson

[Attached: preset_rdm.png]
```

#### `/preset random [category]`

Get a random preset for inspiration.

```
🎲 Random Preset - Autumn

Warm colors for the fall season

Colors:
• Pumpkin Orange (#E07020)
• Bark Brown (#5C3A1E)
• Wine Red (#7B1E2A)

[Attached: preset_autumn.png]
```

### New Renderer: Preset Swatch

Create `src/renderers/preset-swatch.ts`:

```typescript
interface PresetSwatchOptions {
  preset: ResolvedPreset;
  width?: number;   // Default: 600
  height?: number;  // Default: 200
}

function renderPresetSwatch(options: PresetSwatchOptions): Buffer;
```

**Visual Layout:**
```
┌────────────────────────────────────────────────────┐
│                    Red Mage                         │
├──────────┬──────────┬──────────┬──────────┬────────┤
│  ██████  │  ██████  │  ██████  │  ██████  │        │
│  ██████  │  ██████  │  ██████  │  ██████  │        │
│  ██████  │  ██████  │  ██████  │  ██████  │        │
├──────────┼──────────┼──────────┼──────────┼────────┤
│ Dalamud  │   Jet    │ Metallic │   Snow   │        │
│   Red    │  Black   │   Gold   │  White   │        │
└──────────┴──────────┴──────────┴──────────┴────────┘
```

### File Changes

| File | Changes |
|------|---------|
| `preset.ts` | New command file |
| `preset-swatch.ts` | New renderer |

---

## Localization

### Translatable Strings

```json
{
  "presets": {
    "title": "Preset Palettes",
    "categories": {
      "jobs": "FFXIV Jobs",
      "grand-companies": "Grand Companies",
      "seasons": "Seasons",
      "events": "FFXIV Events",
      "aesthetics": "Aesthetics"
    },
    "actions": {
      "apply": "Apply",
      "view": "View Details",
      "random": "Random Preset"
    }
  }
}
```

Preset names and descriptions should also be localizable for Japanese, German, French, Korean, and Chinese.

---

## Future Enhancements

### Community Presets
- Allow users to submit preset palettes
- Moderation/approval workflow
- Credit system for contributors

### Smart Recommendations
- "Based on your recent dyes, you might like..."
- Seasonal suggestions based on current date

### Preset Variations
- Light/Dark variants of each preset
- Metallic/Non-metallic options

### Integration with Other Tools
- Auto-fill presets in Dye Mixer as start/end
- Use preset as base for harmony generation
