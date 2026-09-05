# StainID Enhancement Proposal

**Date**: January 8, 2026  
**Scope**: Core Package Enhancement  
**Status**: ✅ Implemented

---

## Implementation Summary

**Completed**: January 2026

### Changes Made

1. **colors_xiv.json**: Added `stainID` field to all 136 dyes
   - Standard dyes (125): `stainID: 1-125`
   - Facewear dyes (11): `stainID: null`

2. **@xivdyetools/types**: Added `stainID: number | null` to `Dye` interface

3. **DyeDatabase**: Added `getByStainId(stainId: number): Dye | null` method
   - Uses optimized Map lookup (O(1))
   - Returns `null` for invalid stainIDs

4. **Tests**: Added 5 new tests for stainID functionality
   - All 1262 tests passing

---

## Summary

Add an optional `stainID` field to the dye data in `colors_xiv.json` to provide the internal game ID alongside the existing `itemID`.

---

## Motivation

### Current State

The Core package uses `itemID` as the primary identifier for dyes:

```json
{
  "itemID": 5729,
  "name": "Snow White",
  ...
}
```

### The Two ID Systems

FFXIV uses two different ID systems for dyes:

| ID Type | Source | Range | Stability | Use Case |
|---------|--------|-------|-----------|----------|
| **itemID** | Item database | 5729+ | ✅ Stable | Inventory, market, crafting |
| **stainID** | Stain table | 1-125 | ⚠️ Can shift | Internal coloring, save data |

### Why Developers Ask for StainID

1. **Plugin Development**: Glamourer, Mare Synchronos, and other plugins expose stainID
2. **Data Mining**: CSV exports from Godbert/SaintCoinach use stainID
3. **Save Data**: Character appearance data uses stainID internally
4. **Modding**: Texture modders reference stainID for color modifications

### Why ItemID Should Remain Primary

1. **Stability**: itemIDs don't change when new dyes are added
2. **Market Integration**: Universalis API uses itemID
3. **Universality**: Players recognize items by their inventory ID
4. **Existing Codebase**: All current tools use itemID

---

## Proposal

### Add Optional stainID Field

```json
{
  "itemID": 5729,
  "stainID": 1,        // NEW: Optional field
  "category": "Neutral",
  "name": "Snow White",
  "hex": "#e4dfd0",
  ...
}
```

### Complete Mapping

Based on datamined `DyeColors.csv`:

| stainID | Name | itemID |
|---------|------|--------|
| 1 | Snow White | 5729 |
| 2 | Ash Grey | 5730 |
| 3 | Goobbue Grey | 5731 |
| 4 | Slate Grey | 5732 |
| 5 | Charcoal Grey | 5733 |
| 6 | Soot Black | 5734 |
| 7 | Rose Pink | 5735 |
| 8 | Lilac Purple | 5736 |
| 9 | Rolanberry Red | 5737 |
| 10 | Dalamud Red | 5738 |
| 11 | Rust Red | 5739 |
| 12 | Wine Red | 5740 |
| 13 | Coral Pink | 5741 |
| 14 | Blood Red | 5742 |
| 15 | Salmon Pink | 5743 |
| 16 | Sunset Orange | 5744 |
| 17 | Mesa Red | 5745 |
| 18 | Bark Brown | 5746 |
| 19 | Chocolate Brown | 5747 |
| 20 | Russet Brown | 5748 |
| ... | ... | ... |
| 125 | Metallic Dark Blue | 39544 |

---

## Type Changes

### Current Type

```typescript
interface Dye {
  itemID: number;
  category: DyeCategory;
  name: string;
  hex: HexColor;
  // ...
}
```

### Proposed Type

```typescript
interface Dye {
  itemID: number;
  stainID?: number;    // NEW: Optional for backwards compatibility
  category: DyeCategory;
  name: string;
  hex: HexColor;
  // ...
}
```

---

## New Utility Functions

### DyeDatabase Additions

```typescript
class DyeDatabase {
  // Existing
  getByItemId(itemId: number): Dye | undefined;
  getByName(name: string): Dye | undefined;
  
  // NEW: Lookup by stainID
  getByStainId(stainId: number): Dye | undefined;
}
```

### Implementation

```typescript
getByStainId(stainId: number): Dye | undefined {
  return this.dyes.find(dye => dye.stainID === stainId);
}
```

---

## Migration Path

### Phase 1: Add to Data (Non-Breaking)

1. Update `colors_xiv.json` with stainID values
2. Update `Dye` interface with optional field
3. Add `getByStainId()` method
4. Update documentation

### Phase 2: Documentation

Document the relationship:
```
itemID  → Use for: Universalis API, market lookups, stable references
stainID → Use for: Plugin interop, save data analysis, modding
```

---

## Testing Requirements

1. Verify all 125 datamined dyes have correct stainID mapping
2. Test `getByStainId()` lookup performance
3. Ensure backwards compatibility (existing code doesn't break)
4. Test with dyes that have stainID but no matching itemID (if any exist)

---

## Edge Cases

### Cosmic Dyes (7.2)

Recent cosmic dyes may have new stainIDs. Need to verify:
- Do they follow sequential stainID pattern?
- Are stainIDs reassigned or just appended?

### Event/Limited Dyes

Some dyes in Core may not have stainIDs if they're:
- Purely theoretical (palette entries)
- Event-only with different data structures

**Resolution**: Mark as `stainID: undefined` for these cases.

---

## Documentation Updates

### README.md

Add section:

```markdown
## ID Systems

Dyes in FFXIV have two identification systems:

- **itemID**: Inventory item ID (stable, used for market/crafting)
- **stainID**: Internal stain table ID (used by plugins/save data)

The Core package uses `itemID` as the primary identifier. 
`stainID` is provided as an optional field for developers who need plugin interoperability.

### Lookup by ID

```typescript
// Preferred: by itemID
const dye = dyeDatabase.getByItemId(5729);

// Alternative: by stainID (for plugin interop)
const dye = dyeDatabase.getByStainId(1);
```
```

---

## Effort Estimate

| Task | Time |
|------|------|
| Update colors_xiv.json | 30 min |
| Update Dye interface | 10 min |
| Add getByStainId() | 15 min |
| Write tests | 30 min |
| Update documentation | 20 min |
| **Total** | ~2 hours |

---

## Decision

**Recommendation**: ✅ Implement

- Low effort, high value for plugin developers
- Non-breaking change
- Completes the data model with authoritative game data

---

## References

- [Stain CSV from XIVAPI](https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/Stain.csv)
- [Glamourer Stain Documentation](https://github.com/Ottermandias/Glamourer)
- ExtractedData/DyeColors.csv (local)
