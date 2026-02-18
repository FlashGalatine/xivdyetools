# Brainstorming Index - January 2026

**Last Updated**: January 8, 2026  
**Context**: Post-Reddit launch feedback and feature exploration

---

## Background

After sharing the XIV Dye Tools web app on Reddit, feedback has been overwhelmingly positive. This brainstorming session explores potential enhancements based on:

1. **New Data Source**: Datamined color palettes from game files (ExtractedData folder)
2. **User Requests**: Implicit needs from glamour and character customization community
3. **Technical Opportunities**: Synergies with existing Core package architecture

---

## Documents in This Session

### 1. [Extracted Data Review](EXTRACTED_DATA_REVIEW.md)

Overview of the datamined color data available:
- Dye/stain colors from game database (125 dyes)
- Character customization colors from `human.cmp` (eyes, hair, skin, lips, tattoos)
- Data format and structure documentation
- Grid layout patterns (8 columns × N rows)

### 2. [Core Color Verification](CORE_COLOR_VERIFICATION.md)

Comparison between Core package colors and datamined values:
- ✅ **Result**: Hex values verified as accurate
- Recommendation to add `stainID` field

### 3. [StainID Enhancement Proposal](STAINID_ENHANCEMENT.md)

Detailed proposal for adding stainID to Core package:
- Rationale (plugin developer needs)
- Type changes (optional field)
- Migration path (non-breaking)
- Effort estimate (~2 hours)

### 4. [Character Color Matcher](CHARACTER_COLOR_MATCHER.md)

New tool proposal ("Character Color Reference"):
- Match character hair/eye/skin colors to closest dyes
- Display colors in authentic 8-column grid layout
- Show technical data (indexID, RGB, HSV, hex)
- Calculate and display top 3 closest matching dyes
- Integrate with existing context menu for cross-tool navigation

### 5. [Share Button with Dynamic OpenGraph](SHARE_BUTTON_OPENGRAPH.md)

Feature proposal for shareable deep-links with rich social previews:
- Generate deep-link URLs encoding tool state (dye, algorithm, harmony type, etc.)
- Dynamic OpenGraph metadata for Discord/Twitter/Facebook previews
- Custom-generated preview images styled like the Results Card
- Cloudflare Workers architecture for crawler-specific responses
- Tool-specific URL schemas and image templates

---

## Priority Matrix

| Proposal | User Value | Effort | Priority |
|----------|------------|--------|----------|
| Add stainID to Core | Medium | Low (~2h) | **High** |
| Character Color Matcher | High | Medium-High | **Medium** |
| Verify Core colors | ✅ Done | - | - |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (This Week)

1. **Add stainID to colors_xiv.json**
   - Create mapping script from DyeColors.csv
   - Update Dye interface
   - Add `getByStainId()` method
   - Publish Core update

### Phase 2: New Feature (Next Sprint)

2. **Character Color Reference Tool - MVP**
   - Shared colors only (eyes, highlights, lips, tattoos)
   - 8-column grid layout
   - Color detail modal with closest dyes
   - Context menu integration

### Phase 3: Complete Feature

3. **Character Color Reference - Full**
   - Race/gender-specific colors (hair, skin)
   - Race/clan/gender selectors
   - Side-by-side comparison option
   - URL sharing for specific colors

---

## Data Files to Create

| File | Description | Location |
|------|-------------|----------|
| `stainid_mapping.json` | StainID ↔ ItemID lookup | Core/scripts |
| `character_colors.json` | All character colors | Core/data |
| `convert_csv_to_json.py` | Conversion script | ExtractedData |

---

## Open Questions for Future Sessions

1. **Face Paint Colors**: Include in Character Color Reference or separate tool?
2. **Color Export**: Allow users to export color data (for mod creators)?
3. **Race Comparison**: Tool to compare color palettes across races?
4. **Glamourer Integration**: Deep linking to Glamourer presets?
5. **API Endpoint**: Expose character colors via the presets API?

---

## Related Documentation

- [ExtractedData/README.md](../../../ExtractedData/README.md) - Data extraction tools
- [xivdyetools-core/CLAUDE.md](../../xivdyetools-core/CLAUDE.md) - Core package architecture
- [xivdyetools-web-app/CLAUDE.md](../../xivdyetools-web-app/CLAUDE.md) - Web app architecture
