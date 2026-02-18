> **⚠️ DEPRECATED:** This document has been superseded by the Documentation Bible.
> See: [specifications/feature-roadmap.md](specifications/feature-roadmap.md)

# Budget-Aware Dye Suggestions - Feature Specification

> Last Updated: December 5, 2025

## Overview

Enable users to find FFXIV dyes similar to a target color while respecting budget constraints. This feature addresses a common glamour planning scenario: "I want something like Jet Black but cheaper."

---

## User Value

1. **Find affordable alternatives** - Expensive dyes (Pure White, Jet Black, metallic/cosmic dyes) have cheaper alternatives with similar colors
2. **Plan glamours within budget** - Set a maximum price and see all matching options
3. **Compare value** - See the trade-off between color accuracy and price (Best Match vs Best Value)
4. **Discover options** - Users may not know about cheaper similar dyes

---

## Implementation Phases

### Phase 1: Core Library (Optional Enhancement)

The `DyeService` can be optionally enhanced, but the feature can be implemented entirely in the consumer apps using existing APIs:

**Existing APIs that support this feature:**
- `DyeService.findClosestDyes(hex, count)` - Returns N closest dyes by color distance
- `APIService.getPricesForItems(itemIds)` - Fetch prices for multiple dyes
- `dyeDatabase` - Access to all dye data including item IDs

**Optional Core Enhancement:**
```typescript
interface BudgetFilterOptions {
  maxPrice?: number;
  datacenter?: string;
  sortBy?: 'distance' | 'price' | 'value';
}

// Could add to DyeService (optional)
findClosestDyesWithBudget(
  hex: string,
  count: number,
  options: BudgetFilterOptions
): Promise<DyeWithPriceDistance[]>;
```

**Decision:** Implement in consumer apps first (Web App + Discord Bot), then extract to core if pattern proves useful.

---

### Phase 2: Web App Implementation

#### 2.1 Color Matcher Integration

Add budget controls to the existing Color Matcher tool:

**UI Components:**
1. **Budget Toggle** - "Filter by price" checkbox (default: off)
2. **Price Slider** - Range: 0 gil → 1,000,000 gil (logarithmic scale for usability)
3. **Datacenter Selector** - Dropdown for price lookup (default: last used or "North-America")
4. **Sort Options** - Radio buttons: Best Match | Lowest Price | Best Value

**Budget Controls Location:**
- Add below the "Sample Size" slider in the Settings section
- Hidden by default, shown when "Show Market Prices" is enabled
- Collapse when not needed to avoid UI clutter

**Behavior:**
- When budget filter is active, matched dyes are filtered by current market price
- Shows "X of Y dyes within budget" indicator
- Results update in real-time as slider moves (debounced 300ms)

#### 2.2 "Find Alternatives" Quick Action

Add a button to matched dye cards:

**Location:** On each dye result card in Color Matcher
**Label:** "Find Cheaper" or "Alternatives"
**Behavior:**
1. Opens a modal/panel showing similar dyes sorted by price
2. Shows: color swatch, name, distance from original, price, savings vs original
3. Click to select as new match target

#### 2.3 Result Display Enhancements

Update the matched dyes list:

**New Columns/Fields:**
- Price (when market board is enabled)
- Savings (vs most expensive match, e.g., "50,000 gil cheaper")
- Value Score (color distance ÷ price, normalized)

**Sort Options:**
- Best Match (current default) - sort by color distance
- Lowest Price - sort by market price ascending
- Best Value - sort by value score (good match at low price)

---

### Phase 3: Discord Bot Implementation

#### 3.1 Enhanced `/match` Command

Add optional `max_price` parameter:

```
/match color:#8B4513 max_price:50000
```

**Parameters:**
- `color` (required) - Hex code or dye name
- `max_price` (optional) - Maximum price in gil (integer)

**Response Changes:**
- When `max_price` is set, only show dyes within budget
- If no dyes within budget, show "No dyes found within X gil budget. Closest affordable option is [dye] at [price] gil."
- Add price to embed fields when filtering by budget

#### 3.2 New `/dye alternatives` Command

Find cheaper similar dyes to a known dye:

```
/dye alternatives dye:Jet Black count:5
```

**Parameters:**
- `dye` (required) - Dye name (autocomplete)
- `count` (optional) - Number of alternatives (1-10, default: 5)

**Response:**
- Embed showing the target dye and alternatives
- For each alternative:
  - Color swatch (emoji)
  - Dye name
  - Color distance (Δ)
  - Market price
  - Savings vs target dye
- Sorted by a combined score (price × distance weight)

**Example Response:**
```
🎨 Alternatives to Jet Black

Jet Black (#0A0A0A) - Currently ~200,000 gil

Similar dyes (cheaper):
1. Soot Black (#0D0D0D) - Δ5.2 | 500 gil | Save 199,500 gil
2. Ink Blue (#0E0E14) - Δ12.3 | 800 gil | Save 199,200 gil
3. Gunmetal Black (#1A1A20) - Δ18.7 | 1,200 gil | Save 198,800 gil
...
```

#### 3.3 Price Display in Existing Commands

Already implemented for `/match`, `/harmony`, `/dye info`. Ensure consistency with new budget features.

---

## Technical Considerations

### Price Caching

**Strategy:**
- Use existing `PriceService` with RedisCacheBackend
- TTL: 10 minutes (already configured)
- Batch requests to Universalis API (up to 100 items per request)

**Fallback:**
- If prices unavailable, show matches without price filtering
- Display message: "Market prices unavailable, showing all matches"

### Performance

**Concerns:**
- Fetching prices for all 136 dyes on every match would be slow
- Need to balance freshness vs responsiveness

**Solutions:**
1. **Pre-fetch popular dyes** - Cache prices for top 30 dyes proactively
2. **Lazy loading** - Fetch prices only when budget filter is enabled
3. **Background refresh** - Update price cache periodically (every 10 min)
4. **Batch on demand** - When budget filter enabled, fetch all prices in one batch

### Value Score Calculation

**Formula:**
```typescript
// Lower is better for both distance and price
// Normalize to 0-100 scale for comparison
const normalizedDistance = (distance / maxPossibleDistance) * 100;
const normalizedPrice = (price / maxPrice) * 100;

// Weight: 70% color match, 30% price (adjustable)
const valueScore = (normalizedDistance * 0.7) + (normalizedPrice * 0.3);
```

**Sorting:**
- Best Match: sort by `distance` ascending
- Lowest Price: sort by `price` ascending
- Best Value: sort by `valueScore` ascending

---

## UI/UX Guidelines

### Web App

**Budget Slider:**
- Logarithmic scale for better UX (small differences matter more at low prices)
- Tick marks at: 1k, 10k, 50k, 100k, 500k, 1M gil
- Real-time feedback with debouncing

**Visual Feedback:**
- Gray out dyes that exceed budget
- Show "X within budget" badge on results header
- Highlight savings in green

### Discord Bot

**Embed Colors:**
- Use dye color for embed accent
- Show savings in bold when > 50% of target price

**Autocomplete:**
- For `/dye alternatives`, show dye prices in autocomplete hints if available

---

## Data Requirements

### Dye Price Mapping

Need to ensure all 136 dyes have correct Universalis item IDs. This is already maintained in `dyeDatabase`:

```typescript
interface Dye {
  id: number;        // Internal ID
  itemId: number;    // Universalis/game item ID
  name: string;
  hex: string;
  // ...
}
```

### Datacenter Support

Use existing datacenter list from `xivdyetools-core`:
- North America
- Europe
- Japan
- Oceania

---

## Testing Requirements

### Unit Tests

1. Value score calculation
2. Price filtering logic
3. Sort order correctness
4. Edge cases: no prices, all dyes over budget, single dye within budget

### Integration Tests

1. Price fetch + filter pipeline
2. Cache behavior
3. Fallback when API unavailable

### Manual Testing

1. Verify prices match Universalis website
2. Test with expensive dyes (Jet Black, Pure White)
3. Test with very low budgets (< 1000 gil)
4. Test datacenter switching

---

## Localization

### New Translation Keys

**Web App (matcher section):**
```json
{
  "matcher": {
    "budgetFilter": "Budget Filter",
    "maxPrice": "Max Price",
    "sortBy": "Sort By",
    "bestMatch": "Best Match",
    "lowestPrice": "Lowest Price",
    "bestValue": "Best Value",
    "withinBudget": "{count} within budget",
    "noDyesInBudget": "No dyes within budget",
    "findAlternatives": "Find Cheaper",
    "savings": "Save {amount}",
    "priceUnavailable": "Price unavailable"
  }
}
```

**Discord Bot (embeds section):**
```json
{
  "embeds": {
    "alternativesTitle": "Alternatives to {dye}",
    "currentPrice": "Currently ~{price} gil",
    "similarDyesCheaper": "Similar dyes (cheaper)",
    "noBudgetMatches": "No dyes found within {budget} gil budget",
    "closestAffordable": "Closest affordable option"
  }
}
```

---

## Implementation Checklist

### Phase 1: Web App
- [ ] Add budget toggle to Color Matcher settings
- [ ] Implement price slider (logarithmic scale)
- [ ] Add datacenter selector (if not already present)
- [ ] Implement sort options (Best Match, Lowest Price, Best Value)
- [ ] Update results display with price/savings
- [ ] Add "Find Cheaper" button to dye cards
- [ ] Create alternatives modal/panel
- [ ] Add translations (6 languages)
- [ ] Write tests

### Phase 2: Discord Bot
- [ ] Add `max_price` option to `/match` command
- [ ] Update `/match` response to show budget filtering
- [ ] Create `/dye alternatives` command
- [ ] Add autocomplete for dye names
- [ ] Update embeds with price/savings display
- [ ] Add translations (6 languages)
- [ ] Write tests

### Phase 3: Polish
- [ ] Performance optimization (batch price fetches)
- [ ] Error handling for price API failures
- [ ] User feedback for loading states
- [ ] Documentation updates

---

## Related Documents

- [FEATURE_ROADMAP.md](./feature-roadmap.md) - Overall feature planning
- [COLLECTIONS_SPEC.md](./collections.md) - Collections feature (for reference)
- [MULTI_COLOR_EXTRACTION.md](./multi-color-extraction.md) - Palette extraction (for reference)
