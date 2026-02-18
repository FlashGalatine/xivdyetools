# Extracted Data Review

**Date**: January 8, 2026  
**Context**: Review of game data extracted via data mining tools (ExtractedData folder)

---

## Overview

The ExtractedData folder contains FFXIV color palettes extracted directly from game files using custom Python/C# scripts. This provides authoritative color data that can be used to verify and enhance the Core package.

---

## Available Datasets

### 1. Dye/Stain Colors (Gear Dyes)

**Source**: `Stain` Excel sheet from game database  
**Files**: 
- `DyeColors.csv` - 125 dyes with all data
- `DyeColors_ByCategory.csv` - Same data, grouped by shade category

**Data Columns**:
| Column | Description |
|--------|-------------|
| StainID | Game ID (1-125, not 0-indexed) |
| Name | Localized dye name |
| Hex | Color as #RRGGBB |
| R, G, B | RGB components (0-255) |
| H, S, V | HSV values |
| Shade | Category ID (1-10) |
| IsMetallic | Boolean |

**Shade Categories**:
| ID | Category | Count |
|----|----------|-------|
| 2 | Gray/White/Black | 6 |
| 4 | Red/Pink | 12 |
| 5 | Orange/Brown | 18 |
| 6 | Yellow/Bone | 9 |
| 7 | Green | 17 |
| 8 | Blue | 17 |
| 9 | Purple | 10 |
| 10 | Special/Metallic | 36 |

### 2. Character Customization Colors

**Source**: `human.cmp` binary file  
**Location in game**: `chara/xls/charamake/human.cmp`

#### Race-Agnostic (Shared) Palettes

| File | Offset Range | Count | Grid Layout |
|------|--------------|-------|-------------|
| `EyeColors.csv` | 0-191 | 192 | 8 cols × 24 rows |
| `HighlightColors.csv` | 256-447 | 192 | 8 cols × 24 rows |
| `TattooColors.csv` | 0-191 | 192 | Same as Eyes |
| `LipColors_Dark.csv` | 512-607 | 96 | 8 cols × 12 rows |
| `LipColors_Light.csv` | 1024-1119 | 96 | 8 cols × 12 rows |
| `FacePaintColors_Dark.csv` | 640-735 | 96 | 8 cols × 12 rows |
| `FacePaintColors_Light.csv` | 1152-1247 | 96 | 8 cols × 12 rows |

#### Race/Gender-Specific Palettes

| File | Description | Count per Combo |
|------|-------------|-----------------|
| `SkinColors_ByRace.csv` | All skin tones | 192 per race/gender |
| `HairColors_ByRace.csv` | All hair colors | 192 per race/gender |

**Total combinations**: 16 races × 2 genders = 32 palettes each

**SubRace Reference**:
| ID | Race | Clan |
|----|------|------|
| 1 | Hyur | Midlander |
| 2 | Hyur | Highlander |
| 3 | Elezen | Wildwood |
| 4 | Elezen | Duskwight |
| 5 | Lalafell | Plainsfolk |
| 6 | Lalafell | Dunesfolk |
| 7 | Miqo'te | Seeker of the Sun |
| 8 | Miqo'te | Keeper of the Moon |
| 9 | Roegadyn | Sea Wolf |
| 10 | Roegadyn | Hellsguard |
| 11 | Au Ra | Raen |
| 12 | Au Ra | Xaela |
| 13 | Hrothgar | Helion |
| 14 | Hrothgar | The Lost |
| 15 | Viera | Rava |
| 16 | Viera | Veena |

---

## Data Format

All CSV files use consistent column structure:

```csv
Index,Offset,Hex,R,G,B,A,H,S,V
0,0,#F7F7F7,247,247,247,255,0.0,0.000,0.969
```

Race-specific files add:
```csv
Race,Gender,Index,Offset,Hex,R,G,B,A,H,S,V
Midlander,Male,0,3328,#F6D0BB,246,208,187,255,21.4,0.240,0.965
```

---

## Key Observations

### Grid Layout Pattern

In-game, colors are displayed in an **8-column grid**:
- Rows 0-7: Indices 0-7
- Row 8-15: Indices 8-15
- And so on...

This layout should be replicated in any UI that displays these palettes.

### Color Index (indexID)

The `Index` column is the **indexID** - the in-game identifier for each color within its category. This is crucial for:
- Save data (character appearance)
- Glamourer presets
- Third-party tools

### StainID vs ItemID

For dyes:
- **StainID**: Internal game ID (1-125), found in `Stain` table
- **ItemID**: Item inventory ID (e.g., 5729 for Snow White)

The Core package currently uses **itemID** as the primary identifier, which is the stable choice since itemIDs don't shift when new dyes are added.

---

## Potential Uses

1. **Verify Core package colors** - Compare hex values with datamined values
2. **Add stainID to Core** - Optional field for developers familiar with stain IDs
3. **New Character Color Tools** - Match character colors to dyes
4. **Educational resources** - Show players the actual color values
