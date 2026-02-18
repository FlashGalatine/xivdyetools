# Phase 6.2.6: Market Board Testing Checklist

## Overview

This document provides a comprehensive testing guide for Phase 6.2 changes:
- Renamed "Beast Tribe Dyes" → "Allied Society Dyes"
- Moved Ixali Vendor from Base Dyes to Allied Society Dyes
- Centralized filter logic with corrected acquisition mappings
- Created reusable market-prices.html component for future refactoring

**Test Date**: 2025-11-13
**Tester**: Flash Galatine
**Browser**: Firefox
**Theme**: Standard Light

---

## Pre-Testing Setup

### Before Testing
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab - watch for any JavaScript errors
3. Go to Network tab - watch for API failures
4. Keep Network tab open throughout testing

### Test Environment
- Open all 3 tools in separate browser tabs or windows
- Tools to test:
  1. **Color Harmony Explorer** (colorexplorer_experimental.html)
  2. **Color Matcher** (colormatcher_experimental.html)
  3. **Dye Comparison** (dyecomparison_experimental.html)

---

## Test 1: UI Verification

### 1.1 Verify "Allied Society Dyes" Label
**Expected**: All 3 tools show "Allied Society Dyes" instead of "Beast Tribe Dyes"

- [x] Color Explorer: Look in the sidebar under "Market Board" section
- [x] Color Matcher: Look in the left column under "Market Board" section
- [x] Dye Comparison: Look in the left sidebar under "Market Board" section
- [x] Label correctly reads "Allied Society Dyes" (not "Beast Tribe Dyes")

### 1.2 Verify Checkbox States
**Expected**: Default states match new configuration

- [x] Color Explorer: "Craft Dyes" checked by default
- [x] Color Explorer: "Cosmic Dyes" checked by default
- [x] Color Explorer: "Special Dyes" checked by default
- [x] Color Matcher: "Craft Dyes" checked by default
- [x] Color Matcher: "Cosmic Dyes" checked by default
- [x] Color Matcher: "Special Dyes" checked by default
- [x] Dye Comparison: Same three categories checked by default

---

## Test 2: Filter Verification (Critical)

### 2.1 Verify Ixali Vendor Dyes Appear Under Allied Society Filter

**Setup**:
1. Uncheck all filters initially
2. Check ONLY "Allied Society Dyes" checkbox
3. Trigger dye display/search to populate list

**Ixali Vendor Dyes to Verify** (should appear when filter enabled):
- [ ] Opaque Cobalt
- [ ] Opaque Indigo
- [ ] Opaque Periwinkle
- [ ] Opaque Violet
- [**NOTE FROM FLASH: The list of dyes are wrong but I get the idea.**]

**To Find These Dyes**:

- **Color Explorer**: Type "Opaque" in the harmony explorer search/filter (if available)
- **Color Matcher**: Any of these dyes should match prices if you have a cobalt/violet image
- **Dye Comparison**: Add any of these dyes to comparison - price should be fetchable

### 2.2 Verify Base Dyes Only Include Dye Vendor

**Setup**:
1. Uncheck all filters
2. Check ONLY "Base Dyes" checkbox
3. Look at which dyes appear

**Expected Base Dyes** (Dye Vendor only):
- Black (and other basic colors sold by Dye Vendor)
- Ixali Vendor dyes should NOT appear here
- Amalj'aa, Sahagin, Kobold, Sylphic vendor dyes should NOT appear here

- [x] Only Dye Vendor dyes visible when Base Dyes checked
- [x] Ixali Vendor dyes NOT visible when only Base Dyes checked
- [x] Allied Society dyes NOT visible when only Base Dyes checked

### 2.3 Verify All Allied Society Vendors are Included

**Setup**: Check ONLY "Allied Society Dyes" checkbox

**Dyes to Appear** (all 5 vendors):
- [x] Amalj'aa Vendor dyes (e.g., "Ash Black", "Loam Brown")
- [x] Ixali Vendor dyes (e.g., "Opaque Cobalt", "Opaque Indigo")
- [x] Sahagin Vendor dyes (e.g., "Seafoam", "Turquoise")
- [x] Kobold Vendor dyes (e.g., "Sunset Orange", "Rust Brown")
- [x] Sylphic Vendor dyes (e.g., "Matcha Green", "Mint Green")

### 2.4 Filter Combination Tests

**Setup**: Test multiple filter combinations

- [x] Craft Dyes + Allied Society visible correctly together
- [x] Cosmic Dyes + Allied Society visible correctly together
- [x] Special Dyes + Allied Society visible correctly together
- [x] All filters checked shows all dyes
- [x] No filters checked shows no dyes (or empty state)

---

## Test 3: Market Price Functionality

### 3.1 Price Fetching for Allied Society Dyes

**Setup**:
1. Select a server from dropdown
2. Check "Allied Society Dyes" checkbox
3. Click "Refresh Prices" button (or let auto-refresh trigger)

**Expected**:
- [x] Prices load for Ixali Vendor dyes (Opaque Cobalt, etc.)
- [x] Prices load for other Allied Society dyes
- [x] Status message shows "Fetching prices..." initially
- [x] Status clears when prices load
- [x] No JavaScript errors in console

### 3.2 Price Display Format

**Expected**: Prices display with thousands separator (e.g., "1,234 gil")

- [ ] Color Explorer: Prices show correctly formatted
- [ ] Color Matcher: Prices show in "Market Board - X,XXX Gil" format
- [ ] Dye Comparison: Prices show correctly formatted
- [ ] No prices show as "undefined" or "NaN"

### 3.3 API Integration

**Setup**: Watch Network tab while prices refresh

**Expected**:
- [x] Requests to universalis.app API (if server reached)
- [x] Or graceful fallback if API unavailable
- [x] No CORS errors in console
- [x] Status message handles API failures gracefully

### 3.4 Show/Hide Prices Toggle

**Setup**: Use the "Show Prices" toggle checkbox

- [x] Prices visible when toggle is ON
- [x] Prices hidden/removed when toggle is OFF
- [x] Toggle affects all visible dyes
- [x] Toggle state persists during session

---

## Test 4: Cross-Tool Consistency

### 4.1 Filter Logic Consistency

Test the same filter scenario in all 3 tools:

**Scenario**: Check "Allied Society Dyes" + "Cosmic Dyes" filters

- [x] Color Explorer shows same categories as Color Matcher
- [x] Color Matcher shows same categories as Dye Comparison
- [x] Ixali Vendor dyes visible in all 3 tools
- [x] Filter logic works identically across tools

### 4.2 Label Consistency

- [x] All 3 tools use "Allied Society Dyes" label
- [x] All 3 tools have same filter checkbox order
- [x] All 3 tools have same default state (Craft, Cosmic, Special checked)

### 4.3 Market Board UI Consistency

- [x] Server select dropdown looks identical across tools
- [ ] Price toggles styled consistently
- [x] Refresh button positioned consistently
- [x] Status messages use consistent styling

---

## Test 5: Theme Compatibility

### 5.1 Test Across All 10 Themes

For each tool, test the market board in all themes:

**Themes**:
- [ ] Standard Light
- [ ] Standard Dark
- [ ] Hydaelyn Light
- [ ] Hydaelyn Dark
- [ ] Classic FF Light
- [ ] Classic FF Dark
- [ ] Parchment Light
- [ ] Parchment Dark
- [ ] Sugar Riot Light
- [ ] Sugar Riot Dark

**Verify for each theme**:
- [ ] Text is readable (good contrast)
- [ ] Checkboxes are visible and clickable
- [ ] Dropdown is visible
- [ ] Buttons are styled correctly
- [ ] Status messages are readable

---

## Test 6: Responsive Design

### 6.1 Desktop (1920px+)
- [ ] Market board displays correctly at full width
- [ ] All UI elements properly spaced
- [ ] Server dropdown has sufficient width
- [ ] Price settings display in grid/list format

### 6.2 Laptop (1080p / 1920x1080)
- [ ] All controls fit on screen without horizontal scroll
- [ ] Text remains readable
- [ ] Checkboxes properly aligned

### 6.3 Tablet (768px)
- [ ] Market board section stacks vertically if needed
- [ ] Dropdown width is responsive
- [ ] Touch targets are at least 44px (accessibility)
- [ ] No overflow or text wrapping issues

### 6.4 Mobile (375px)
- [ ] Market board is fully functional on small screens
- [ ] Checkboxes are clickable
- [ ] Dropdown is usable (not too wide)
- [ ] No horizontal scrolling required

---

## Test 7: Error Scenarios

### 7.1 Missing Dye Data
**Scenario**: Test with dyes that might be missing acquisition data

- [ ] No JavaScript errors if dye.acquisition is undefined
- [ ] Filters don't break when dye data is incomplete
- [ ] Graceful fallback if itemID is missing

### 7.2 API Unavailable
**Scenario**: Network tab → offline mode (or Universalis API down)

- [ ] Prices fail gracefully
- [ ] Error message is user-friendly
- [ ] Tools still work without prices
- [ ] No console errors

### 7.3 Invalid Server Selection
**Scenario**: Select different servers

- [ ] Prices refresh correctly for new server
- [ ] Dropdown shows available servers
- [ ] No errors when changing servers

---

## Test 8: Console Verification

### 8.1 No JavaScript Errors
- [ ] Browser console shows NO red error messages
- [ ] No "cannot read property" errors
- [ ] No "undefined function" errors
- [ ] No CORS errors

### 8.2 Expected Console Activity (OK if present)
- [ ] Info messages about prices loading (if present)
- [ ] Minor warnings are acceptable if they don't affect functionality
- [ ] API responses logged (if logging is enabled)

---

## Test 9: Storage & Persistence

### 9.1 Theme Persistence
- [ ] Select a theme
- [ ] Refresh page (F5)
- [ ] Theme remains selected

### 9.2 Filter Preferences (if implemented)
- [ ] Check "Allied Society Dyes"
- [ ] Refresh page
- [ ] Verify if filter state persists (optional feature)

---

## Issue Log

Document any issues found during testing:

### Issue #1
**Description**: [What's broken]
**Steps to Reproduce**: [How to trigger it]
**Expected Behavior**: [What should happen]
**Actual Behavior**: [What actually happened]
**Severity**: Critical / High / Medium / Low
**Browser/Theme**: [What environment]
**Console Errors**: [Any JavaScript errors]

### Issue #2
[Repeat format above]

---

## Summary

### Overall Test Results
- **Pass**: [ ] All tests passed
- **Pass with Issues**: [ ] Some issues found (document above)
- **Fail**: [ ] Critical issues preventing use

### Blockers
Are there any blockers preventing Phase 6.4 (documentation) or Phase 6.5 (syncing)?

- [ ] No blockers - proceed to Phase 6.4
- [ ] Minor issues - can proceed with documentation
- [ ] Critical issues - must fix before proceeding

### Next Steps

If testing passes:
1. Proceed to Phase 6.4: Update IMPLEMENTATION_PLAN.md
2. Then Phase 6.5: Sync experimental → stable versions

If issues found:
1. Document in Issue Log above
2. Fix issues in _experimental.html files
3. Re-test until all pass

---

## Notes

- Ixali Vendor is the key change to verify - these 4 dyes must appear under Allied Society, not Base
- The market-prices.html component has been created but the tools still use inline HTML (OK for now, future refactoring)
- All 3 tools should behave identically for filter logic
- The ID `mb-price-beast` is kept for backward compatibility, but label shows "Allied Society Dyes"

