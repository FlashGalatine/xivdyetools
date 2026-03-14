# Patch 7.5 Dye Consolidation

**Patch Date:** April 28, 2026
**Source:** Live Letter slide — "Dye System Update: Consolidated Dyes"

## Summary

Patch 7.5 consolidates most individual dye items into three base dye items. Players will purchase one consolidated item and select the specific color at application time.

## Consolidation Groups

| Type | Count | Current ItemIDs | Origin |
|------|-------|-----------------|--------|
| A | 85 | 5729-5813 | A Realm Reborn (2.x patches) |
| B | 9 | 30116-30124 | Ishgardian Restoration |
| C | 11 | 48163-48172, 48227 | Cosmic Exploration + Cosmic Fortunes |

**Not consolidated:** Special dyes from Venture Coffers (Pure White, Jet Black, Metallic/Dark/Pastel — itemIDs 13114-13723), Online Store dyes, and Facewear dyes.

## Type B Classification Detail

The 9 Ishgardian Restoration dyes span two acquisition sources:

| ItemIDs | Name | Acquisition | Currency |
|---------|------|-------------|----------|
| 30116-30121 | Ruby Red, Cherry Pink, Canary Yellow, Vanilla Yellow, Dragoon Blue, Turquoise Blue | Cosmic Exploration | Cosmocredits |
| 30122-30124 | Gunmetal Black, Pearl White, Metallic Brass | The Firmament | Skybuilders Scrips |

All 9 share `isIshgardian: true` and `consolidationType: "B"`. Note that 30122-30124 have `category: "Special"` in the display layer, but their consolidation grouping is by origin (Ishgardian Restoration), not display category.

## Type C Classification Detail

11 Cosmic dyes from two sub-sources:

| ItemIDs | Acquisition | Currency |
|---------|-------------|----------|
| 48163-48168, 48227 | Cosmic Exploration | Cosmocredits |
| 48169-48172 | Cosmic Fortunes | Planet-specific Credit |

The Cosmic Fortunes dyes (Metallic Pink, Metallic Ruby Red, Metallic Cobalt Green, Metallic Dark Blue) are included in Type C consolidation despite being in the "Special" display category.

## Impact on Market Board

Post-consolidation:
- All 85 Type A dyes share a single market price
- All 9 Type B dyes share a single market price
- All 11 Type C dyes share a single market price
- Special dyes retain individual market listings

This reduces Universalis API calls from ~105 individual lookups to ~20 (3 consolidated + ~17 Special).

## Implementation Framework

### Data Layer
- `Dye` interface: new `consolidationType: 'A' | 'B' | 'C' | null` and `isIshgardian: boolean` fields
- `colors_xiv.json`: all 136 entries tagged with consolidation type
- `DyeDatabase.initialize()`: defaults missing fields for backward compatibility

### Config
- `packages/core/src/config/consolidated-ids.ts`: single file with 3 placeholder `null` values
- `getMarketItemID(dye)`: returns consolidated or original itemID based on activation state
- `isConsolidationActive()`: implicit feature flag (true when all 3 IDs are set)

### Consumer Updates
- Discord budget calculator: deduplicates market IDs before fetching
- Web app market board service: fans out consolidated prices to individual dye cache entries

## Patch Day Checklist

1. Datamine the 3 new consolidated item IDs from game data
2. Update `packages/core/src/config/consolidated-ids.ts` (3 numbers)
3. Build, test, publish `@xivdyetools/core`
4. Update + deploy discord-worker and web-app
5. Verify budget command and web app prices

## Open Questions

- Will the old individual itemIDs still exist in the game data (for inventory/glamour plate references)?
- Will Universalis track the consolidated items as new itemIDs?
- Will stainIDs change or remain stable?
