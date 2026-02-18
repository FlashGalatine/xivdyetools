> **⚠️ DEPRECATED:** This document has been superseded by the Documentation Bible.
> See: [specifications/feature-roadmap.md](specifications/feature-roadmap.md)

# XIV Dye Tools - Feature Roadmap

> Last Updated: December 5, 2025

This document outlines planned features for the XIV Dye Tools monorepo, prioritized by implementation phase.

---

## Overview

### Priority Features

| Feature | Platform | Core Changes | Effort | Status |
|---------|----------|--------------|--------|--------|
| Multi-Color Palette Extraction | Web + Bot | Yes | Medium-High | ✅ Done |
| Seasonal/Themed Preset Palettes | Web + Bot | Yes | Medium | ✅ Done |
| Dye Collections/Favorites | Web + Bot | No | Medium | ✅ Done |
| Budget-Aware Dye Suggestions | Web + Bot | Optional | Medium | Planned |

### Quick Wins

| Feature | Platform | Effort | Status |
|---------|----------|--------|--------|
| Random Dye Button | Web App | Low | ✅ Done |
| Market Prices in Commands | Discord Bot | Low | ✅ Done |
| Copy Dye Info Buttons | Web App | Low | ✅ Done |
| Copy Dye Info Buttons | Discord Bot | Low | ✅ Done |

### Housekeeping

| Task | Location | Status |
|------|----------|--------|
| Dead code cleanup (12-slot remnants) | Web App - Accessibility Checker | ✅ Done |

---

## Implementation Phases

### Phase 1: Quick Wins (1-2 days each)

#### 1. Random Dye Button (Web App) ✅

Port the Discord bot's `/dye random` functionality to the web app.

**Implemented Features:**
- ✅ "Random Dye" button with SVG dice icon in dye selector search bar
- ✅ Respects current category filter and search query
- ✅ Selects from filtered dye list (contextual randomness)

**Not Implemented (Future Enhancement):**
- Filter options: exclude metallic, pastel, dark, cosmic, expensive
- Count selector (1-5 random dyes)
- Keyboard shortcut: `R` for random

**Files modified:**
- `xivdyetools-web-app/src/components/dye-search-box.ts` - Added random button UI
- `xivdyetools-web-app/src/components/dye-selector.ts` - Added `selectRandomDye()` method
- `xivdyetools-web-app/src/shared/ui-icons.ts` - Added `ICON_DICE` SVG
- `xivdyetools-web-app/src/locales/en.json` - Added localization keys

---

#### 2. Copy Dye Info Buttons (Both Platforms) - Web App ✅

One-click copy buttons for dye information.

**Implemented (Web App):**
- ✅ Hex code (`#FF0000`) - click to copy
- ✅ RGB (`rgb(255, 0, 0)`) - click to copy
- ✅ HSV (`hsv(0, 100%, 100%)`) - click to copy
- ✅ Visual feedback: "Copied!" text replacement for 2 seconds
- ✅ Hover states with blue highlight

**Not Implemented (Future Enhancement):**
- Full info (Name + Hex + Category)
- CSS variable (`--dye-dalamud-red: #FF0000;`)
- Dedicated copy icon buttons (currently uses clickable text)

**Files modified:**
- `xivdyetools-web-app/src/components/color-display.ts` - Added `data-copy` attributes to RGB/HSV values

**Implemented (Discord Bot):**
- ✅ Copy Hex button - sends ephemeral message with code-blocked hex value
- ✅ Copy RGB button - calculates and sends `RGB(r, g, b)` format
- ✅ Copy HSV button - calculates and sends `HSV(h°, s%, v%)` format
- ✅ Mobile-friendly ephemeral responses with copy hint
- ✅ 6-language localization (en, ja, de, fr, ko, zh)
- ✅ Buttons on `/dye info`, `/dye random`, `/match`, `/match_image`, `/harmony`

**Files created/modified:**
- `xivdyetools-discord-bot/src/utils/button-builder.ts` (new)
- `xivdyetools-discord-bot/src/handlers/button-handler.ts` (new)
- `xivdyetools-discord-bot/src/index.ts` - Added button interaction routing
- `xivdyetools-discord-bot/src/services/i18n-service.ts` - Added ButtonInteraction type
- `xivdyetools-discord-bot/src/commands/dye.ts` - Added buttons to info/random
- `xivdyetools-discord-bot/src/commands/match.ts` - Added buttons
- `xivdyetools-discord-bot/src/commands/match-image.ts` - Added buttons
- `xivdyetools-discord-bot/src/commands/harmony.ts` - Added buttons
- `xivdyetools-discord-bot/src/i18n/translations/*.json` - Added `buttons` section (6 files)

---

#### 3. Dead Code Cleanup (Web App) ✅

Remove remnants of the 12-slot system (2 per equipment piece) from the Accessibility Checker.

**Completed:**
- ✅ Deleted `outfit-slot-selector.ts` - Unused component (291 lines)
- ✅ Deleted `outfit-slot-selector.test.ts` - Associated tests
- ✅ Removed `OutfitSlotSelector` export from `components/index.ts`
- ✅ Removed `AccessibilityState` interface from `shared/types.ts`
- ✅ Removed stale tests from `accessibility-checker-tool.test.ts`:
  - "should maintain dual dyes toggle state"
  - "should handle all 6 outfit slots filled"
  - "should handle mixed dual/single dyes"

**Total lines removed:** ~1,298 lines of dead code

---

### Phase 2: Foundation (1 week)

#### 4. Market Prices in Discord Bot ✅

Add Universalis price data to existing commands.

**Implemented Features:**
- ✅ `/match` - Shows market price of matched dye
- ✅ `/harmony` - Shows market prices for base + all companion dyes
- ✅ `/dye info` - Shows current market price
- ✅ PriceService singleton with RedisCacheBackend (10-minute TTL)
- ✅ Graceful degradation when Universalis API unavailable
- ✅ API availability check with 60-second cooldown
- ✅ Translation keys for price display

**Not Implemented:**
- `/comparison` - prices in comparison view (future)
- Optional `show_prices` parameter (always enabled)
- "prices may be outdated" disclaimer (implicit in cache)

**Files created/modified:**
- `xivdyetools-discord-bot/src/services/price-service.ts` (new)
- `xivdyetools-discord-bot/src/commands/match.ts`
- `xivdyetools-discord-bot/src/commands/harmony.ts`
- `xivdyetools-discord-bot/src/commands/dye.ts`
- `xivdyetools-discord-bot/src/utils/embed-builder.ts`
- `xivdyetools-discord-bot/src/i18n/translations/en.json`

---

#### 5. Dye Collections / Favorites ✅
Save favorite dyes and organize into named collections.

**Web App Implementation (Complete):**

*Phase 1 - Favorites:*
- ✅ `CollectionService` - Full favorites/collections API with localStorage persistence
- ✅ Favorite star buttons on every dye card (appears on hover, filled when favorited)
- ✅ Collapsible favorites panel at top of dye selector
- ✅ Toast notifications for add/remove actions
- ✅ Keyboard shortcut: `F` to toggle favorite on focused dye
- ✅ Maximum 20 favorites with warning toast

*Phase 2 - Collections:*
- ✅ Collection Manager Modal - view, create, edit, delete collections
- ✅ Add to Collection menu - folder icon on dye cards, dropdown with collection list
- ✅ Create collection dialog with name and description
- ✅ Edit collection dialog with removable dye tags
- ✅ Import/Export collections as JSON
- ✅ Keyboard shortcut: `C` to open add-to-collection menu
- ✅ "Manage Collections" button in favorites panel header

**Web App Files created/modified:**
- `xivdyetools-web-app/src/services/collection-service.ts` - Core service
- `xivdyetools-web-app/src/components/collection-manager-modal.ts` (new)
- `xivdyetools-web-app/src/components/add-to-collection-menu.ts` (new)
- `xivdyetools-web-app/src/components/dye-grid.ts` - Added collection button
- `xivdyetools-web-app/src/components/dye-selector.ts` - Added manage button
- `xivdyetools-web-app/src/locales/en.json` - i18n keys (already present)

**Discord Bot Implementation (Complete):**

*Favorites Commands:*
- ✅ `/favorites add <dye>` - Add a dye to favorites
- ✅ `/favorites remove <dye>` - Remove from favorites (autocomplete shows only favorites)
- ✅ `/favorites list` - Show all favorite dyes with emoji swatches
- ✅ `/favorites clear` - Clear all favorites

*Collection Commands:*
- ✅ `/collection create <name> [description]` - Create new collection
- ✅ `/collection delete <name>` - Delete a collection
- ✅ `/collection add <collection> <dye>` - Add dye to collection
- ✅ `/collection remove <collection> <dye>` - Remove dye from collection
- ✅ `/collection show <name>` - Display collection contents
- ✅ `/collection list` - List all user collections
- ✅ `/collection rename <old_name> <new_name>` - Rename a collection

*Features:*
- ✅ Redis storage with in-memory fallback (no TTL - permanent user data)
- ✅ Same limits as web app: 20 favorites, 50 collections, 20 dyes per collection
- ✅ Autocomplete for dye names and collection names
- ✅ Context-aware autocomplete (remove shows only dyes in collection)
- ✅ 6-language localization (en, ja, de, fr, ko, zh)

**Discord Bot Files created/modified:**
- `xivdyetools-discord-bot/src/services/collection-storage.ts` (new) - Redis storage service
- `xivdyetools-discord-bot/src/commands/favorites.ts` (new) - /favorites command
- `xivdyetools-discord-bot/src/commands/collection.ts` (new) - /collection command
- `xivdyetools-discord-bot/src/index.ts` - Registered new commands
- `xivdyetools-discord-bot/src/i18n/translations/*.json` - Added `favorites` and `collection` sections (6 files)

See [COLLECTIONS_SPEC.md](./collections.md) for full specification.

---

### Phase 3: Major Features (2-3 weeks)

#### 6. Seasonal/Themed Preset Palettes ✅
Pre-made color palettes for common themes.

**Preset Categories:**
- **FFXIV Jobs:** Red Mage, Black Mage, White Mage, etc.
- **Grand Companies:** Maelstrom, Twin Adders, Immortal Flames
- **Seasons:** Spring, Summer, Autumn, Winter
- **FFXIV Events:** Starlight, Moonfire, Rising
- **Aesthetics:** Gothic, Pastel, Military, Royal

**Web App Implementation (Complete):**
- ✅ `preset-browser-tool.ts` - Full preset browser with category tabs
- ✅ Category filter buttons with icon badges
- ✅ Preset card grid with color swatch strips
- ✅ Detail view with full dye list and tags
- ✅ Back navigation from detail to grid

**Discord Bot Implementation (Complete):**
- ✅ `/preset list [category]` - List presets by category
- ✅ `/preset show <name>` - Show preset with swatch image
- ✅ `/preset random [category]` - Random preset for inspiration
- ✅ Autocomplete for preset names
- ✅ Canvas-rendered swatch images
- ✅ 6-language localization

**Files:**
- Core: `PresetService`, `presetData` (already in xivdyetools-core)
- Web: `xivdyetools-web-app/src/components/preset-browser-tool.ts`
- Bot: `xivdyetools-discord-bot/src/commands/preset.ts`
- Bot: `xivdyetools-discord-bot/src/renderers/preset-swatch.ts`

See [PRESET_PALETTES.md](./preset-palettes.md) for detailed specification.

---

#### 7. Multi-Color Palette Extraction ✅
Extract multiple dominant colors from an image (3-5 colors) instead of just one.

**User Value:**
- Match entire glamour screenshots, not just single pieces
- Create palettes from inspiration images
- Capture the "vibe" of an image with a full palette

**Core Library Implementation (Complete):**
- ✅ `PaletteService` - K-means++ clustering algorithm for dominant color extraction
- ✅ `extractPalette()` - Extract N dominant colors with dominance percentages
- ✅ `extractAndMatchPalette()` - Extract and match to closest FFXIV dyes
- ✅ `pixelDataToRGB()` / `pixelDataToRGBFiltered()` - Canvas data conversion helpers
- ✅ Configurable: colorCount (3-5), maxIterations, convergenceThreshold, maxSamples

**Web App Implementation (Complete):**
- ✅ Extraction mode toggle (Single Color / Palette Mode) in Color Matcher
- ✅ Color count slider (3-5 colors)
- ✅ "Extract Palette" button with loading state
- ✅ Visual sampling indicators - circles on image showing where colors were sampled
- ✅ Palette results with color bar visualization
- ✅ Individual color entries showing extracted → matched dye with dominance %
- ✅ Copy hex buttons for each matched dye
- ✅ 6-language localization (en, ja, de, fr, ko, zh)

**Discord Bot Implementation (Complete):**
- ✅ `/match_image colors:[1-5]` - Optional parameter for multi-color extraction
- ✅ Palette grid renderer with extracted colors and matched dyes
- ✅ Visual sampling indicators on source image preview
- ✅ Canvas-rendered output showing image + palette grid
- ✅ 6-language localization

**Files created/modified:**
- Core: `xivdyetools-core/src/services/PaletteService.ts` (new)
- Web: `xivdyetools-web-app/src/components/color-matcher-tool.ts` - Added palette mode
- Web: `xivdyetools-web-app/src/locales/*.json` - Added 14 translation keys (6 files)
- Bot: `xivdyetools-discord-bot/src/renderers/palette-grid.ts` - Added sampling indicators
- Bot: `xivdyetools-discord-bot/src/commands/match-image.ts` - Added multi-color extraction

See [MULTI_COLOR_EXTRACTION.md](./multi-color-extraction.md) for detailed specification.

---

#### 8. Budget-Aware Dye Suggestions
Find dyes similar to a target color within a budget.

**User Value:**
- "I want something like Jet Black but cheaper"
- Find affordable alternatives for expensive dyes
- Plan glamours within budget constraints

**Web App Implementation (Planned):**
- Budget toggle + price slider (logarithmic scale) in Color Matcher
- Datacenter selector for price lookup
- Sort options: Best Match, Lowest Price, Best Value
- "Find Cheaper" button on dye cards
- Alternatives modal showing similar dyes with price/savings
- 6-language localization

**Discord Bot Implementation (Planned):**
- `/match [color] max_price:[amount]` - Optional budget filter
- `/dye alternatives [dye_name] count:[1-10]` - Show cheaper similar dyes
- Price + color distance + savings in results
- Fallback handling when prices unavailable

**Technical Approach:**
- Use existing `PriceService` with RedisCacheBackend (10-min TTL)
- Batch price fetches to Universalis API
- Value score: weighted combination of color distance and price
- No core library changes required initially

See [BUDGET_AWARE_SUGGESTIONS.md](./budget-aware-suggestions.md) for detailed specification.

---

## Declined Features

| Feature | Reason |
|---------|--------|
| Outfit Builder / Glamour Planner | Serious glamour makers use Glamourer plugin in-game; limited value for this toolset |
| Similar Dye Finder | Functionality covered by Budget-Aware Suggestions |

---

## Technical Notes

### Universalis API Rate Limits
- **Rate limit:** 25 req/s (50 req/s burst)
- **Connections:** 8 simultaneous per IP
- **Strategy:** Batch requests, aggressive caching (5+ min TTL)
- **UX:** Show "prices may be outdated" disclaimers

### Core Library Changes
Features requiring core library modifications:
- ~~Multi-color extraction → Add clustering algorithm~~ ✅ Done (`PaletteService`)
- ~~Preset palettes → Add `PresetService` or extend `DyeService`~~ ✅ Done (`PresetService`)
- Budget filtering → Optional enhancement to `DyeService`

### Platform Parity
All features developed for both platforms simultaneously where applicable.

---

## Related Documents

- [MULTI_COLOR_EXTRACTION.md](./multi-color-extraction.md) - Technical spec for palette extraction
- [PRESET_PALETTES.md](./preset-palettes.md) - Preset data structure and palette list
- [COLLECTIONS_SPEC.md](./collections.md) - Collections/favorites feature spec
- [BUDGET_AWARE_SUGGESTIONS.md](./budget-aware-suggestions.md) - Budget-aware dye suggestions spec
