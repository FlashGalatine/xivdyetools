# New Tool Proposal: Character Color Matcher

**Date**: January 8, 2026  
**Working Title**: "Matching Matrix" / "Character Color Reference"  
**Status**: Brainstorming

---

## Concept Overview

A new tool that helps players find the **closest matching dye** for their character's hair, eyes, or skin tone. This extends the existing Color Matcher concept but focuses specifically on character customization colors.

### Use Cases

1. **Glamour Coordination**: "What dye matches my character's eye color?"
2. **Character Creation Reference**: "What skin tones are available for Au Ra Xaela?"
3. **Cross-race Comparison**: "Does this hair color exist for other races?"
4. **Technical Reference**: Color enthusiasts wanting exact RGB/hex values

---

## Data Structure

### Color Categories

#### Race-Agnostic (Shared Colors)

| Category | Colors | Grid Layout |
|----------|--------|-------------|
| Eye Colors | 192 | 8 × 24 |
| Highlight Colors | 192 | 8 × 24 |
| Dark Lip Colors | 96 | 8 × 12 |
| Light Lip Colors | 96 | 8 × 12 |
| Tattoo Colors | 192 | 8 × 24 |

#### Race/Gender-Specific

| Category | Colors per Combo | Grid Layout |
|----------|------------------|-------------|
| Hair Colors | 192 | 8 × 24 |
| Skin Colors | 192 | 8 × 24 |

**Total Combos**: 16 subraces × 2 genders = 32 combinations

---

## UI/UX Design

### Tool Layout

```
┌─────────────────────────────────────────────────────────────┐
│  CHARACTER COLOR REFERENCE                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Tab: Shared Colors] [Tab: Race-Specific Colors]           │
│                                                             │
│  Category: [Eye Colors ▼]                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Color Grid (8 columns × N rows)                    │    │
│  │                                                     │    │
│  │  [■][■][■][■][■][■][■][■]  ← Row 0 (indices 0-7)   │    │
│  │  [■][■][■][■][■][■][■][■]  ← Row 1 (indices 8-15)  │    │
│  │  [■][■][■][■][■][■][■][■]  ← Row 2 (indices 16-23) │    │
│  │  ...                                                │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Click any color to view details                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Race-Specific Tab

```
┌─────────────────────────────────────────────────────────────┐
│  Race-Specific Colors                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Race: [Au Ra ▼]  Clan: [Xaela ▼]  Gender: [♀ Female ▼]    │
│                                                             │
│  Category: [Hair Colors ▼] [Skin Colors]                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Color Grid (8 × 24)                                │    │
│  │  ...                                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Color Detail Modal

When a color is clicked:

```
┌─────────────────────────────────────────────────────────────┐
│  Eye Color #47                               [×]            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────┐                                                     │
│  │    │  ← Large color preview swatch                      │
│  └────┘                                                     │
│                                                             │
│  TECHNICAL DATA                                             │
│  ─────────────────                                          │
│  Category:    Eye Colors                                    │
│  Index ID:    47                                            │
│  Hex:         #5A3F1C                                       │
│  RGB:         90, 63, 28                                    │
│  HSV:         33.9°, 68.9%, 35.3%                           │
│                                                             │
│  CLOSEST MATCHING DYES                                      │
│  ─────────────────────                                      │
│  1. Chestnut Brown   Δ 4.2   #3D290D   [View]               │
│  2. Orchard Brown    Δ 8.7   #644216   [View]               │
│  3. Opo-opo Brown    Δ 12.1  #7B5C2D   [View]               │
│                                                             │
│  [🔗 Send to Other Tools]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Context Menu (Same as Other Tools)

The "Send to Other Tools" button opens the standard context menu:
- View in Harmony Explorer
- View in Dye Comparison
- View in Color Accessibility
- View in Dye Mixer

---

## Technical Implementation

### Data Files Needed

1. **character_colors.json** - New data file for Core package:

```json
{
  "shared": {
    "eyeColors": [
      { "index": 0, "hex": "#F7F7F7", "rgb": { "r": 247, "g": 247, "b": 247 } },
      { "index": 1, "hex": "#E7E7E7", "rgb": { "r": 231, "g": 231, "b": 231 } },
      ...
    ],
    "highlightColors": [...],
    "lipColorsDark": [...],
    "lipColorsLight": [...],
    "tattooColors": [...]
  },
  "raceSpecific": {
    "Midlander": {
      "Male": {
        "hairColors": [...],
        "skinColors": [...]
      },
      "Female": {
        "hairColors": [...],
        "skinColors": [...]
      }
    },
    ...
  }
}
```

2. **CSV to JSON conversion script** - Transform ExtractedData CSVs to JSON

### Core Package Changes

1. **New Service**: `CharacterColorService`
   - `getEyeColors(): CharacterColor[]`
   - `getHairColors(race, gender): CharacterColor[]`
   - `getSkinColors(race, gender): CharacterColor[]`
   - `findClosestDyes(color: RGB, count: number): DyeMatch[]`

2. **New Types**:
```typescript
interface CharacterColor {
  index: number;      // indexID (0-191 or 0-95)
  hex: HexColor;
  rgb: RGB;
  hsv?: HSV;
}

interface CharacterColorCategory {
  name: string;
  colors: CharacterColor[];
  gridColumns: 8;
  gridRows: 12 | 24;
}

type SubRace = 'Midlander' | 'Highlander' | 'Wildwood' | ... ;
type Gender = 'Male' | 'Female';
```

### Web App Changes

1. **New Tool Component**: `character-color-tool.ts`
2. **Route**: `/character-colors` or `/matching-matrix`
3. **Lazy Loading**: Add to Vite code splitting
4. **i18n**: Add translations for all labels

### Color Matching Algorithm

Reuse existing `DyeService.findClosestDye()` logic:

```typescript
// Get top 3 closest dyes for a character color
const characterColor = { r: 90, g: 63, b: 28 };
const matches = dyeService.findClosestDyes(characterColor, 3);

// Returns:
[
  { dye: chestnutBrown, delta: 4.2 },
  { dye: orchardBrown, delta: 8.7 },
  { dye: opoopoBrown, delta: 12.1 }
]
```

---

## Data Size Considerations

### Estimated JSON Size

| Category | Colors | Size Est. |
|----------|--------|-----------|
| Eye Colors | 192 | ~20 KB |
| Highlight Colors | 192 | ~20 KB |
| Lip Colors (Dark) | 96 | ~10 KB |
| Lip Colors (Light) | 96 | ~10 KB |
| Tattoo Colors | 192 | ~20 KB |
| Hair (32 combos × 192) | 6,144 | ~640 KB |
| Skin (32 combos × 192) | 6,144 | ~640 KB |

**Total**: ~1.4 MB uncompressed, ~200-300 KB gzipped

### Loading Strategy Options

1. **Bundled**: Include all data in initial bundle (simple, but larger)
2. **Lazy Load**: Fetch race-specific data only when selected (smaller initial, more requests)
3. **Split by Race**: Separate files per race (balanced approach)

**Recommendation**: Start with bundled approach for MVP, optimize later if needed.

---

## Alternative Names for the Tool

1. **Character Color Reference** - Descriptive, clear
2. **Matching Matrix** - Original suggestion, emphasizes the grid
3. **Color Picker Reference** - Familiar to players
4. **Customization Colors** - Matches in-game terminology
5. **Character Palette Explorer** - Emphasizes browsing aspect

**Recommendation**: "Character Color Reference" - clear, searchable, professional

---

## Open Questions

1. **Scope**: Include face paint colors or exclude for MVP?
2. **Export**: Allow exporting color data as JSON/CSV?
3. **Comparison**: Side-by-side comparison of same index across races?
4. **URL Sharing**: Direct links to specific colors (e.g., `/character-colors/eye/47`)
5. **History**: Recent viewed colors?

---

## Priority Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| User Value | High | Unique feature, no alternatives exist |
| Development Effort | Medium | New data pipeline, but reuses Core algorithms |
| Data Availability | ✅ Ready | All CSVs already extracted |
| Technical Complexity | Medium | Grid rendering, race selection |
| Maintenance Burden | Low | Data rarely changes (only with major patches) |

**Recommendation**: ✅ Worth pursuing for a future update

---

## Next Steps

1. [ ] Create `character_colors.json` from CSV data
2. [ ] Add `CharacterColorService` to Core package
3. [ ] Design detailed mockups
4. [ ] Implement MVP with shared colors only
5. [ ] Add race-specific colors in phase 2
6. [ ] Add i18n translations
7. [ ] User testing and feedback
