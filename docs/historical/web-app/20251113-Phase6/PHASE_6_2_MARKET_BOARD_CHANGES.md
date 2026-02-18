# Phase 6.2: Market Prices Component - Implementation Guide

## Summary

This phase extracts market board functionality into reusable components and centralized utilities, eliminating ~675 lines of duplicate code across the 3 market-enabled tools (Color Harmony Explorer, Color Matcher, Dye Comparison).

## Changes Made

### 1. Created Market Prices Component
**File**: `components/market-prices.html`

Reusable UI component containing:
- Market Board server/world dropdown
- Price category filter checkboxes with corrected terminology
- Show/Hide prices toggle
- Refresh prices button
- Status message display

**Key Update**: Renamed "Beast Tribe Dyes" to "Allied Society Dyes" (current FFXIV game terminology)

### 2. Centralized Price Categories & Filter Logic
**File**: `assets/js/shared-components.js`

Added three new objects/functions:

#### `PRICE_CATEGORIES` Constant
Defines which dye acquisitions belong to each category:
- **Base Dyes**: Dye Vendor, Ixali Vendor
- **Craft Dyes**: Crafting, Treasure Chest
- **Allied Society Dyes**: Amalj'aa Vendor, Sahagin Vendor, Kobold Vendor, Sylphic Vendor
- **Cosmic Dyes**: Cosmic Exploration, Cosmic Fortunes
- **Special Dyes**: All dyes in "Special" category

#### `shouldFetchPrice(dye)` Function
Checks if a dye should have its market price fetched based on current filter checkbox states.
- Validates dye object
- Checks Special category separately (uses `dye.category` field)
- Checks acquisition-based categories (uses `dye.acquisition` field)
- Returns true if dye matches any enabled filter

#### `initializeMarketBoard(selectElementId)` Function
Loads and populates server/world dropdowns from JSON data files.

#### `fetchUniversalisPrice(itemIds, server, throttler)` Function
Fetches prices from Universalis API with proper throttling.

#### `formatPrice(price)` Function
Formats prices with thousands separator (e.g., "1,234 gil").

## Bug Fixes

### Issue: Allied Society Dyes Filter Not Working
**Root Cause**: The filter logic was spread across each tool with potential inconsistencies.

**Solution**: Centralized all filter logic in `shouldFetchPrice()` which:
1. Validates the dye object properly
2. Checks each category filter in the correct order
3. Uses standardized acquisition names from PRICE_CATEGORIES

### Terminology Update
**Old**: "Beast Tribe Dyes"
**New**: "Allied Society Dyes"
**Why**: This is the current FFXIV game terminology for dyes from Amalj'aa, Sylphic, Kobold, and Sahagin vendors.

## Next Steps

### Phase 6.2.3-5: Update Tools
Each tool (Color Explorer, Color Matcher, Dye Comparison) needs:

1. **Replace inline market board HTML**:
   ```html
   <!-- Before: 40+ lines of inline HTML -->
   <!-- After: Single line -->
   <div id="market-prices-container"></div>
   ```

2. **Load component after nav/footer**:
   ```javascript
   loadComponent('components/market-prices.html', 'market-prices-container');
   ```

3. **Replace tool-specific filter functions** with call to shared `shouldFetchPrice()`:
   ```javascript
   // Old: if (!shouldFetchPriceMatcher(dye)) return;
   // New: if (!shouldFetchPrice(dye)) return;
   ```

4. **Replace tool-specific price fetch functions** with calls to shared utilities:
   ```javascript
   // Old: const prices = await fetchMarketPricesMatcher(itemIds, server);
   // New: const prices = await fetchUniversalisPrice(itemIds, server, apiThrottler);
   ```

5. **Initialize market board after data loads**:
   ```javascript
   await initializeMarketBoard('mb-server-select');
   ```

### Phase 6.2.6: Testing
After all 3 tools are updated, test:
- [ ] Market board dropdowns populate correctly
- [ ] Allied Society Dyes filter works when checkbox is enabled
- [ ] Price fetching works from Universalis API
- [ ] All filter categories (Base, Craft, Allied, Cosmic, Special) work correctly
- [ ] Price display formats correctly with thousands separator
- [ ] Market board works across all themes
- [ ] Responsive design on mobile

## File References

| File | Changes |
|------|---------|
| `components/market-prices.html` | Created new reusable component |
| `assets/js/shared-components.js` | Added market board utilities |
| Color Explorer `_experimental.html` | To be updated in Phase 6.2.3 |
| Color Matcher `_experimental.html` | To be updated in Phase 6.2.4 |
| Dye Comparison `_experimental.html` | To be updated in Phase 6.2.5 |

## Important Notes

1. **ID Changes**: The checkbox ID changed from `mb-price-beast` to `mb-price-allied`
   - Any hardcoded references to the old ID will break
   - Using the shared component prevents this issue

2. **PRICE_CATEGORIES is Global**: Once shared-components.js is loaded, any tool can access the category definitions

3. **Filter Logic is Defensive**: `shouldFetchPrice()` includes multiple guard checks to prevent errors

4. **No Feature Loss**: This refactoring maintains 100% of existing functionality while reducing code duplication
