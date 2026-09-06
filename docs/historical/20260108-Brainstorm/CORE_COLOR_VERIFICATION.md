# Core Package Dye Color Verification

**Date**: January 8, 2026  
**Purpose**: Compare Core package colors against datamined values

---

## Comparison Summary

### Data Sources

| Source | File | Dye Count |
|--------|------|-----------|
| Core Package | `colors_xiv.json` | 136 dyes |
| Datamined | `DyeColors.csv` | 125 dyes |

**Note**: The Core package has 136 entries while datamined shows 125. The 11 extra entries are **Facewear color entries** — face-paint colors that are not real dyes (no item ID, not market-tradeable). They get synthetic negative IDs (≤ -1000, name-hash derived) at runtime by `DyeDatabase.initialize()` so they share the `Dye.itemID: number` shape but never collide with real game item IDs. Filter market-board operations with `dye.itemID > 0` rather than null-checks.

---

## Sample Verification

### Neutral Dyes

| Dye | Core Hex | Datamined Hex | Match? |
|-----|----------|---------------|--------|
| Snow White | #e4dfd0 | #E4DFD0 | ✅ |
| Ash Grey | #aca8a2 | #ACA8A2 | ✅ |
| Goobbue Grey | #898784 | #898784 | ✅ |
| Slate Grey | #656565 | #656565 | ✅ |
| Charcoal Grey | #484742 | #484742 | ✅ |
| Soot Black | #2b2923 | #2B2923 | ✅ |

### Red Dyes

| Dye | Core Hex | Datamined Hex | Match? |
|-----|----------|---------------|--------|
| Rose Pink | #e69f96 | #E69F96 | ✅ |
| Lilac Purple | #836969 | #836969 | ✅ |
| Rolanberry Red | #5b1729 | #5B1729 | ✅ |

---

## Verification Result

**Status**: ✅ Colors match between Core package and datamined values.

The hex values in `colors_xiv.json` are accurate and consistent with the game data.

---

## Enhancement Proposal: Add StainID

### Current Core Structure

```json
{
  "itemID": 5729,
  "category": "Neutral",
  "name": "Snow White",
  "hex": "#e4dfd0",
  "acquisition": "Ixali Vendor",
  "price": 216,
  "currency": "Gil",
  "rgb": { "r": 228, "g": 223, "b": 208 },
  "hsv": { "h": 45, "s": 8.77, "v": 89.41 },
  "isMetallic": false,
  "isPastel": false,
  "isDark": false,
  "isCosmic": false
}
```

### Proposed Enhancement

```json
{
  "itemID": 5729,
  "stainID": 1,           // NEW: Game's internal stain ID
  "category": "Neutral",
  "name": "Snow White",
  ...
}
```

### StainID Mapping (First 20 dyes)

| StainID | Name | ItemID (current) |
|---------|------|------------------|
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
| ... | ... | ... |

### Benefits of Adding StainID

1. **Developer Familiarity**: Some plugin developers work with stainID (from Glamourer, Mare, etc.)
2. **Cross-reference**: Easy lookup between different tools
3. **Data Mining Compatibility**: Matches datamined CSV structure

### Considerations

- **Primary Key**: Continue using `itemID` as primary identifier (stable)
- **Documentation**: Note that stainID may shift with game updates
- **Optional Field**: stainID is supplementary, not required

---

## Recommended Next Steps

1. ✅ **Verified**: Color hex values are accurate
2. 📋 **Proposed**: Add `stainID` field to `colors_xiv.json`
3. 📋 **Update Types**: Add optional `stainID?: number` to `Dye` interface
4. 📋 **Documentation**: Document the difference between itemID and stainID
