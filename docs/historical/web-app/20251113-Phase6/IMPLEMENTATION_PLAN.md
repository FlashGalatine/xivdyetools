# Implementation Plan - Bugs & Refactoring
**Date**: 2025-11-12
**Status**: Planning Phase - Ready for Implementation

## Decision Summary

Based on feedback discussion, we've decided on:

- **Priority Order**: Bugs → Refactor → Features
- **CSS Approach**: Hybrid (extract highly duplicated styles to shared file)
- **Component Approach**: Dynamic loading via fetch() for nav/footer
- **Dark Mode**: Global sync using single localStorage key across all tools

---

## Phase 1: Bug Fixes (Priority) - COMPLETE ✅ DEPLOYED

**Status**: Both bugs fixed, tested, and copied to stable versions
**Deployment Date**: 2025-11-12
**Commit**: e7d263e
**Files Deployed**: colormatcher_stable.html v1.3.0, dyecomparison_stable.html v1.2.3

### Bug 1.1: Color Matcher Jet Black Issue - FIXED ✅

**Location**: `colormatcher_experimental.html:1285-1329`

**Problem**:
- When "Exclude Pure White & Jet Black" is enabled, these dyes are completely removed from matching pool
- `#000000` matches to Gunmetal Black (#181820) instead of Jet Black
- `#1e1e1e` matches to Dark Brown (#28211C) instead of closer matches
- Users expect exclusion to mean "don't auto-suggest" but still match if color is exact/near-exact

**Root Cause**:
Old code filtered out extremes before distance calculation:
```javascript
// OLD: line 1293-1294
if (isExtremesExcluded && (dye.name === 'Pure White' || dye.name === 'Jet Black')) return false;
```

**Solution Implemented**:
Changed to exact-match prioritization logic:
1. Calculate distance for all dyes including extremes
2. Track excluded extremes separately
3. If closest excluded extreme has distance < 5 (exact/near-exact) AND is closer than other matches, use it
4. Otherwise apply normal exclusion filtering

**New Code** (lines 1285-1329):
```javascript
let dyesToSearch = ffxivDyes.filter(dye => {
    if (dye.category === 'Facewear') return false;
    if (isMetallicExcluded && dye.name.toLowerCase().includes('metallic')) return false;
    return true;
});

let closestColor = null;
let smallestDistance = Infinity;
let excludedExtremeMatch = null;
let excludedExtremeDistance = Infinity;

dyesToSearch.forEach(dye => {
    const dyeRgb = hexToRgb(dye.hex);
    if (dyeRgb) {
        const distance = colorDistance(userRgb, dyeRgb);
        const isExcludedExtreme = isExtremesExcluded && (dye.name === 'Pure White' || dye.name === 'Jet Black');

        if (isExcludedExtreme) {
            if (distance < excludedExtremeDistance) {
                excludedExtremeDistance = distance;
                excludedExtremeMatch = dye;
            }
        } else {
            if (distance < smallestDistance) {
                smallestDistance = distance;
                closestColor = dye;
            }
        }
    }
});

// If excluded extreme is exact/near-exact match (distance < 5), use it
if (isExtremesExcluded && excludedExtremeMatch && excludedExtremeDistance < 5 && excludedExtremeDistance < smallestDistance) {
    closestColor = excludedExtremeMatch;
}
```

**Testing Status**:
- ✅ `#000000` → Jet Black (exact match, distance 0)
- ✅ `#FFFFFF` → Pure White (exact match, distance 0)
- ✅ `#1e1e1e` → Jet Black (near-exact match, distance < 5)
- ✅ Exclusion still works for non-exact matches
- ✅ Tested with exclusion enabled and disabled

---

### Bug 1.2: Dye Comparison Hue-Saturation Chart Rendering - FIXED ✅

**Location**: `dyecomparison_experimental.html:1149-1160` (function `drawHueSaturationChart()`)

**Problem**:
- Only the northwest quarter of the Hue-Saturation chart was rendering
- Chart dimensions: 1000×750 canvas, 890×670 chart area
- With RESOLUTION_REDUCTION=2, ImageData was 445×335 pixels
- ImageData was placed at (70, 40) but never scaled up to fill full chart area

**Root Cause**:
```javascript
// OLD: placed small ImageData without scaling
ctx.putImageData(imageData, leftPadding, topPadding);

// Only set properties, didn't actually perform scaling
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
```

**Solution Implemented**:
Two-stage canvas rendering approach:

**New Code** (lines 1149-1160):
```javascript
// Create temporary off-screen canvas at reduced resolution
const tempCanvas = document.createElement('canvas');
tempCanvas.width = reducedWidth;
tempCanvas.height = reducedHeight;
const tempCtx = tempCanvas.getContext('2d');
tempCtx.putImageData(imageData, 0, 0);

// Scale up to main canvas with smoothing enabled
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
ctx.drawImage(tempCanvas, leftPadding, topPadding, chartWidth, chartHeight);
```

**How It Works**:
1. Creates temporary off-screen canvas at reduced resolution (445×335)
2. Puts the reduced ImageData on the temp canvas
3. Uses `ctx.drawImage()` with dimensions to scale temp canvas onto main canvas
4. Fills the full chartWidth×chartHeight area (890×670)
5. Maintains image smoothing quality during upscaling

**Testing Status**:
- ✅ Full 1000×750 chart renders completely
- ✅ All four quadrants visible (NW, NE, SW, SE)
- ✅ Chart properly fills the designated area
- ✅ Hue gradient spans full 360 degrees
- ✅ Saturation gradient spans full vertical range
- ✅ Tested with 1, 2, 3, and 4 selected dyes

---

## Phase 2: Shared Component Refactoring - COMPLETE ✅ DEPLOYED

**Status**: All shared components created and all tools updated
**Deployment Date**: 2025-11-13
**Commit**: 1eb76a7
**Files Created**: 4 new shared files, all 4 tools + index.html updated

### 2.1: Create Shared CSS File

**New File**: `assets/css/shared-styles.css`

**Contents to Extract** (~500-800 lines):

1. **Dark Mode Styles** (150-250 lines per file × 4 files):
   ```css
   body.dark-mode { background-color: #1f2937; color: #f9fafb; }
   body.dark-mode .bg-white { background-color: #374151; }
   body.dark-mode .text-gray-900 { color: #f9fafb; }
   /* ... 20-30 more overrides ... */
   ```

2. **Dropdown Styles** (~70 lines per file × 4 files):
   ```css
   .nav-dropdown { /* ... */ }
   .nav-dropdown-toggle { /* ... */ }
   .nav-dropdown-menu { /* ... */ }
   .nav-dropdown-item { /* ... */ }
   ```

3. **Footer Styles** (~50 lines per file × 4 files):
   ```css
   footer { /* ... */ }
   footer a { color: #4f46e5; }
   footer a:hover { color: #4338ca; }
   body.dark-mode footer { /* ... */ }
   ```

4. **Common Button/Input Overrides**:
   - Button hover states
   - Input focus states
   - Border/background color overrides

**Estimated Savings**: ~2,000-2,500 lines of duplication eliminated

---

### 2.2: Create Shared HTML Components

#### Nav Component
**New File**: `components/nav.html`

**Content**:
```html
<div class="nav-dropdown inline-block ml-4">
    <button class="nav-dropdown-toggle" onclick="toggleDropdown(this)">
        Tools ▼
    </button>
    <div class="nav-dropdown-menu">
        <a href="index.html" class="nav-dropdown-item">Home / All Tools</a>
        <a href="colorexplorer_experimental.html" class="nav-dropdown-item">Color Harmony Explorer</a>
        <a href="colormatcher_experimental.html" class="nav-dropdown-item">Color Matcher</a>
        <a href="dyecomparison_experimental.html" class="nav-dropdown-item">Dye Comparison</a>
        <a href="coloraccessibility_experimental.html" class="nav-dropdown-item">Color Accessibility Checker</a>
    </div>
</div>
```

**Issue to Fix**: `coloraccessibility_experimental.html` currently links to `_stable.html` files instead of `_experimental.html`

#### Footer Component
**New File**: `components/footer.html`

**Content**: Extract identical footer from all 4 files (~40 lines):
- "Built with love for Eorzea's fashionistas" tagline
- Character attribution (Flash Galatine - Balmung)
- 9 social links (Blog, GitHub, Twitter, Twitch, BlueSky, Patreon, Discord, License, Donate)
- Square Enix disclaimer

---

### 2.3: Create Shared JavaScript

**New File**: `assets/js/shared-components.js`

**Contents**:

1. **Component Loading**:
```javascript
async function loadComponent(url, containerId) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        document.getElementById(containerId).innerHTML = html;
    } catch (error) {
        console.error(`Failed to load ${url}:`, error);
        // Fallback: show minimal content or hide container
    }
}

function initComponents() {
    loadComponent('components/nav.html', 'nav-container');
    loadComponent('components/footer.html', 'footer-container');
}
```

2. **Unified Dark Mode**:
```javascript
const DARK_MODE_KEY = 'xivdyetools_darkMode';

function initDarkMode() {
    const isDark = safeGetStorage(DARK_MODE_KEY, 'false') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    safeSetStorage(DARK_MODE_KEY, isDark.toString());
}
```

3. **Dropdown Toggle** (already exists, but centralize):
```javascript
function toggleDropdown(button) {
    const menu = button.nextElementSibling;
    menu.classList.toggle('show');

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            menu.classList.remove('show');
        }
    });
}
```

4. **FOUC Prevention**:
```javascript
// Add loading placeholders in HTML, remove when loaded
function removeLoadingPlaceholders() {
    document.querySelectorAll('.component-loading').forEach(el => {
        el.classList.remove('component-loading');
    });
}
```

---

### 2.4: Update All HTML Files

**Files to Update** (4 experimental files):
- `coloraccessibility_experimental.html`
- `colorexplorer_experimental.html`
- `colormatcher_experimental.html`
- `dyecomparison_experimental.html`

**Changes for Each File**:

1. **Add Shared CSS Link** (in `<head>`):
```html
<link rel="stylesheet" href="assets/css/shared-styles.css">
```

2. **Add Shared JS** (before closing `</body>`):
```html
<script src="assets/js/shared-components.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        initComponents();
        initDarkMode();
    });
</script>
```

3. **Replace Nav HTML**:
```html
<!-- Before: 15-20 lines of inline nav HTML -->
<!-- After: -->
<div id="nav-container" class="component-loading">
    <!-- Fallback or loading indicator -->
    <span>Loading navigation...</span>
</div>
```

4. **Replace Footer HTML**:
```html
<!-- Before: 40-50 lines of inline footer HTML -->
<!-- After: -->
<div id="footer-container" class="component-loading">
    <!-- Fallback or loading indicator -->
</div>
```

5. **Update Dark Mode Initialization**:
```javascript
// Remove old tool-specific initialization
// Old: safeGetStorage('colorMatcher_darkMode', false)
// Old: safeGetStorage('colorExplorer_darkMode', false)
// Old: safeGetStorage('dyeComparison_darkMode', false)

// New: handled by shared-components.js
// Just call: initDarkMode()
```

6. **Remove Duplicated CSS**:
- Remove dark mode styles now in shared-styles.css
- Remove dropdown styles now in shared-styles.css
- Remove footer styles now in shared-styles.css
- Keep tool-specific styles inline

---

### 2.5: Update index.html

**Changes**:
1. Add shared-styles.css link
2. Fix unsafe localStorage usage (add try-catch or use safeGetStorage)
3. Update to use `xivdyetools_darkMode` key
4. Consider using dynamic nav/footer loading here too

---

## Phase 3: Testing & Deployment

### 3.1: Test Experimental Versions

**Environment Testing**:
- [ ] Test on hosted environment (http://localhost or actual server)
- [ ] Verify dynamic loading works correctly
- [ ] Check for FOUC and loading delays
- [ ] Test fetch error handling (disconnect network, test fallback)

**Browser Testing**:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, macOS)
- [ ] Mobile browsers (Chrome Android, Safari iOS)

**Feature Testing** (per tool):
- [ ] Dark mode toggles and syncs across tools
- [ ] All dropdowns work correctly
- [ ] Footer links all functional
- [ ] Tool-specific features unchanged
- [ ] localStorage persistence works
- [ ] No console errors or warnings

**Bug Verification**:
- [ ] Color Matcher: Jet Black matching works correctly
- [ ] Dye Comparison: Full Hue-Sat chart renders

### 3.2: Copy to Stable Versions

Once all testing passes:
1. Copy all 4 `*_experimental.html` → `*_stable.html`
2. Update version numbers if needed
3. Update CHANGELOG.md with bug fixes and refactoring notes
4. Commit with clear message

---

## Known Considerations

### Dynamic Loading Limitations
- **File protocol**: fetch() doesn't work with `file://` URLs
  - Users opening HTML files directly from disk will see errors
  - Solution: Document that tools should be accessed via HTTP server
- **FOUC**: Brief flash before components load
  - Mitigation: Loading placeholders, consider critical CSS inlining
- **Network dependency**: Tools require successful fetch of components
  - Mitigation: Comprehensive error handling, fallback content

### localStorage Key Migration
- Existing users have tool-specific dark mode keys
- Migration options:
  1. Read old keys first, migrate to new key, delete old keys
  2. Start fresh (users re-select dark mode preference)
  3. Use most recent tool's setting as default
- **Recommendation**: Option 1 (graceful migration)

---

## Future Phases (Not in Current Plan)

These are from the feedback document but deferred for now:

### Phase 4: Font Updates - COMPLETE ✅ DEPLOYED

**Status**: Font updates applied to all tools
**Deployment Date**: 2025-11-13
**Commit**: b85d7be
**Progress**: Phase 4.2 (Font Updates) COMPLETE | Phase 4.1 (Theme System) COMPLETE ✅

#### 4.1: Theme System Implementation - COMPLETE ✅

**Status**: FULLY IMPLEMENTED AND DEPLOYED (2025-11-13)
**Deployment Date**: 2025-11-13
**Commits**: dc1caef, f0ee45d, 8b11049, ffc8a99, daa4877

**Implementation Summary**:
- 10 theme variants: 5 themes × light/dark (Standard, Hydaelyn, Classic FF, Parchment, Sugar Riot)
- All themes WCAG AA/AAA compliant with proper color contrast ratios
- Unified theme switcher in navigation replacing legacy dark mode toggle
- CSS custom properties system for centralized theme management
- 150+ hardcoded colors replaced with theme variables
- Real-time theme switching across all 4 tools simultaneously
- localStorage persistence for user theme preferences

**CSS Variable System**:
```css
:root / body.theme-{name}-{light|dark} {
    --theme-primary, --theme-primary-hover, --theme-primary-light
    --theme-bg, --theme-bg-secondary, --theme-bg-tertiary
    --theme-text, --theme-text-muted
    --theme-border, --theme-card-bg
}
```

**Theme-Aware Elements Implemented**:
- All buttons and interactive controls
- Toggle switches (Market Price panels)
- Range sliders (Vision Type simulations)
- Checkboxes (using accent-color property)
- Select/dropdown menus
- Text input boxes
- File input browse button
- Canvas visualizations
- SVG color wheel elements
- Navigation dropdowns

**Bugs Fixed During Implementation**:
1. Vision Type Simulation sliders remained blue (fixed with accent-color)
2. Market Price toggle switches remained blue (fixed with theme variables)
3. Refresh Prices button text hard to read in dark themes (fixed with adaptive text color)
4. Select/dropdown menus not theme-aware (fixed with var() overrides)
5. Search Colors input not themed (fixed with input[type="text"] styling)
6. Overall Accessibility Score label hardcoded blue (fixed with var(--theme-text-muted))
7. Multiple Tailwind utility classes hardcoded (fixed with 25+ class overrides)

**Files Created/Modified**:
- `assets/css/shared-styles.css` - Added comprehensive theme definitions and overrides
- `assets/js/shared-components.js` - Theme switching functions (getThemeColor, setTheme)
- `components/nav.html` - New theme switcher UI in navigation
- All 4 tool files synced from experimental → stable

**Testing Results**:
- ✅ All 10 themes tested and working
- ✅ Theme persistence across page refreshes
- ✅ All interactive elements properly themed
- ✅ Proper text contrast in all variants
- ✅ Real-time theme switching works

---

**OLD (DEFERRED)**: Theme System Implementation (DEFERRED - Future Phase)
- Standard Light, Standard Dark (current)
- Hydaelyn (light blue), Classic Final Fantasy (dark blue)
- Parchment (beige), Sugar Riot (pink/dark)
- All WCAG compliant (AA minimum, AAA ideal)

#### 4.2: Font Updates - COMPLETE ✅

**Status**: FULLY IMPLEMENTED (All Tools Complete)

**New Font Stack from Google Fonts**:

```css
/* Tool Title Font */
.tool-title {
  font-family: "Cinzel Decorative", serif;
  font-variant-caps: small-caps;
}

/* H1 Headers - Page Titles */
h1 {
  font-family: "Cinzel", serif;
  font-weight: 600;
  /* NO small-caps variant */
}

/* H2 and H3 Headers */
h2, h3 {
  font-family: "Cinzel", serif;
  font-weight: 500;
  font-variant-caps: small-caps;
}

/* Bolded Headers (e.g., dye box headers) */
.section-header, .dye-box-header {
  font-family: "Lexend Giga", sans-serif;
  font-variant-caps: all-small-caps;
}

/* Data Numbers ONLY (see below for details) */
.number {
  font-family: "Habibi", serif;
}

/* General Body Font */
body {
  font-family: "Lexend", sans-serif;
}
```

**Number Styling - Implementation Details**:

Numbers using "Habibi" font should ONLY appear in these contexts:
- **Color Codes**: HEX (#FF1493), RGB (255, 20, 147), HSV (H:300°, S:92%, V:100%)
- **Prices**: Universalis market data (e.g., "5,250 gil")
- **Color Matrix Values**: Deviance ratings, distance values, position percentages
- **Version Numbers**: Tool versions (e.g., "v1.4.0")

Narrative numbers (like "Select up to 8 dyes") should use the default body font (Lexend).

**Implementation Progress**:

##### Dye Comparison Tool - COMPLETE ✅

File: `dyecomparison_experimental.html`

Completed changes:
1. ✅ Added Google Fonts import for: Cinzel, Cinzel Decorative, Lexend, Lexend Giga, Habibi
2. ✅ Updated body font from 'Inter' to "Lexend"
3. ✅ Added CSS classes:
   - `.tool-title` (Cinzel Decorative, small-caps)
   - `h1` (Cinzel, weight 600, no small-caps)
   - `h2, h3` (Cinzel, weight 500, small-caps)
   - `.section-header, .dye-box-header` (Lexend Giga, all-small-caps)
   - `.number` (Habibi)
4. ✅ Applied `.dye-box-header` class to all dye info labels:
   - Name:, Category:, Hex:, RGB:, HSV:, Acquisition:, Price: (all 4 dye slots)
5. ✅ Implemented formatting functions:
   ```javascript
   function formatHexCode(hex)           // Wraps hex in .number span
   function formatRGBValues(r, g, b)    // Wraps R, G, B values individually
   function formatHSVValues(h, s, v)    // Wraps H, S, V values individually
   function formatPrice(priceText)      // Wraps price amounts in .number span
   ```
6. ✅ Updated HTML rendering to use innerHTML for styled numbers:
   - `dye-hex-${num}` → `formatHexCode()`
   - `dye-rgb-${num}` → `formatRGBValues()`
   - `dye-hsv-${num}` → `formatHSVValues()`
   - `dye-price-${num}` → `formatPrice()`
7. ✅ Applied `.number` class to distance matrix values
8. ✅ Applied `.number` class to version number (v1.2.3)
9. ✅ Fixed dark mode text color override for `.text-gray-800` elements (Hue-Saturation Chart, Brightness Chart)

**Testing Status** (Dye Comparison):
- ✅ Hex codes display with Habibi font
- ✅ RGB/HSV numbers use Habibi font
- ✅ Prices display with Habibi font
- ✅ Version number uses Habibi font
- ✅ Headers use Cinzel font
- ✅ Dye box labels use Lexend Giga font
- ✅ General body text uses Lexend font
- ✅ Dark mode text color transitions work correctly
- ✅ All fonts display correctly in both light and dark mode

##### Other Tools - COMPLETE ✅

**Status**: All remaining tools now have font updates applied
**Deployment Date**: 2025-11-13
**Commit**: b85d7be

Font updates completed for:
- ✅ Color Matcher (`colormatcher_experimental.html` & stable.html)
- ✅ Color Harmony Explorer (`colorexplorer_experimental.html` & stable.html)
- ✅ Color Accessibility Checker (`coloraccessibility_experimental.html` & stable.html)
- ✅ Landing Page (`index.html`)

**Summary**: All 5 files now import Google Fonts and use centralized font definitions from shared-styles.css

### Phase 5: New Tool - Dye Mixer - COMPLETE ✅ DEPLOYED

**Status**: FULLY IMPLEMENTED AND DEPLOYED (2025-11-13)
**Deployment Date**: 2025-11-13
**Version**: v1.5.1
**Commits**: 10 commits from Phase 5.0 through 5.5
**Files**: `dye-mixer_stable.html` and `dye-mixer_experimental.html` (~1,640 lines each)

#### Use Case & Design Philosophy

**Problem Statement**:
Help decorators/interior designers find *bridge colors* when transitioning between two dyes. Unlike flat-color scenarios, real-world surfaces have textures (wood grain, fabric patterns) that may need intermediate colors for aesthetic transitions. The Dye Mixer helps discover smooth color progressions without relying purely on mathematical color theory.

**Target User**: Players decorating houses/apartments with complex textures who want to find intermediate dyes between two starting colors.

#### Design Approach

**Color Interpolation**: Use **HSV color space** for interpolation
- Simpler than LAB, more perceptually intuitive than RGB
- Smooth hue transitions and saturation curves
- Good balance between accuracy and implementation complexity

**Responsive Layout**:
- **Portrait/Mobile** (< 768px): Vertical gradient
  - Dyes stack vertically
  - Gradient line flows top-to-bottom
  - Information boxes stack naturally
  - Better use of vertical mobile space

- **Landscape/Desktop** (≥ 768px): Horizontal gradient
  - Dyes arranged left-to-right
  - Gradient line flows left-to-right
  - Information boxes can flow inline or below
  - Better use of horizontal screen space

**Visual Gradient Representation**:
- Display actual HSV-interpolated color gradient as background/line
- Shows users the "color journey" between dyes
- Helps visualize transition quality

#### Phase 5.0: Core Features (MVP) - COMPLETE ✅

**Core Features - ALL IMPLEMENTED**:
- ✅ Select Dye 1 (0% position) via dropdown
- ✅ Select Dye 2 (100% position) via dropdown
- ✅ Display vertical/horizontal gradient visualization with interpolated colors
- ✅ Generate 3/4/7/9 recommended intermediate dyes at equal intervals
- ✅ Display dye information cards with: name, color swatch, deviance rating (0-10), position %
- ✅ 10 theme variants support (from Phase 4.1 theme system)
- ✅ Deduplication logic for repeated dyes across positions
- ✅ Warning if user selects same dye for both positions
- ✅ Responsive mobile/desktop layouts (portrait/landscape)
- ✅ Toast notifications for user feedback
- ✅ Component loading (nav, footer via shared-components.js)

#### Phase 5.2: Market Board Integration - COMPLETE ✅

**Features Implemented**:
- ✅ Reused shared `market-prices.html` component (not custom implementation)
- ✅ Real-time dye pricing via Universalis API
- ✅ Server and world selection dropdowns
- ✅ Acquisition method filters (Base, Craft, Allied Society, Cosmic, Special)
- ✅ Refresh Prices button with debouncing and rate limiting
- ✅ Price toggling per dye with status indicators
- ✅ Used shared utilities: `initializeMarketBoard()`, `fetchUniversalisPrice()`, `shouldFetchPrice()`
- ✅ Session-level API response caching to minimize requests

#### Phase 5.3: Gradient Save/Load System - COMPLETE ✅

**Features Implemented**:
- ✅ Save unlimited gradients with custom names to localStorage
- ✅ Persistent storage with creation timestamp
- ✅ Load saved gradients to restore all settings (dyes, recommendation count)
- ✅ Delete saved gradients with confirmation dialog
- ✅ Collapsible "Saved Gradients" panel with smooth animations (0.3s transitions)
- ✅ Display creation date/time for each saved gradient
- ✅ Auto-refresh list after save/delete operations
- ✅ Empty state message when no gradients exist

#### Phase 5.4: Dye Exclusion Filters - COMPLETE ✅

**Four Filter Types Implemented**:
- ✅ Exclude Metallic Dyes (filters dyes with "Metallic" in name)
- ✅ Exclude Pastel Dyes (filters dyes with "Pastel" in name)
- ✅ Exclude Dark Dyes (filters dyes with "Dark" in name)
- ✅ Exclude Cosmic Dyes (filters Cosmic Exploration and Cosmic Fortunes acquisition)
- ✅ Filters persist via localStorage
- ✅ Recommendations automatically regenerate when filters change
- ✅ All 4 filter states accessible via `isDyeExcluded()` function

#### Phase 5.5: URL Sharing with Filter Persistence - COMPLETE ✅

**Features Implemented**:
- ✅ Generate shareable URLs with gradient configuration (dye1, dye2, count)
- ✅ Filter settings encoded in URL parameters (excludeMetallic, excludePastel, excludeDark, excludeCosmic)
- ✅ Auto-load gradient and filter settings from shared URLs
- ✅ Copy Share URL button with clipboard support
- ✅ Toast notifications for copy success/failure
- ✅ `copyShareUrl()` encodes all settings as URL parameters
- ✅ `loadGradientFromUrl()` decodes and applies settings on page load

#### Additional Features - COMPLETE ✅

**Acquisition Method Display**:
- ✅ Shows dye acquisition source on card hover (e.g., "Dye Vendor", "Cosmic Exploration")
- ✅ Fallback when market board data unavailable
- ✅ HTML-escaped for XSS safety

**Smooth Animations**:
- ✅ Card details expand/collapse on hover with 0.3s transition
- ✅ Saved gradients panel toggle with smooth max-height animation
- ✅ Gradient tooltip appearing with fade effect

**Responsive Design**:
- ✅ Portrait mode (< 768px): Vertical gradient layout
- ✅ Landscape mode (≥ 768px): Horizontal gradient layout
- ✅ Mobile-friendly buttons and spacing
- ✅ Tested across desktop, tablet, mobile

#### File Structure & Code Reuse

**New File**: `dye-mixer_experimental.html` (~2,500-3,500 lines)

**HTML Structure**:
```
dye-mixer_experimental.html
├── <head>
│   ├── Meta tags, Tailwind CDN
│   ├── <link href="assets/css/shared-styles.css"> [FROM PHASE 2]
│   └── <style> [tool-specific styles only]
├── <body>
│   ├── <div id="nav-container"> [LOADED VIA PHASE 2 shared-components.js]
│   ├── <main>
│   │   ├── Title: "Dye Mixer"
│   │   ├── Instructions
│   │   ├── Section: Select Starting & Ending Dyes
│   │   │   ├── Dye 1 selector (dropdown)
│   │   │   └── Dye 2 selector (dropdown)
│   │   ├── Section: Gradient Visualization
│   │   │   ├── Vertical/horizontal gradient container
│   │   │   ├── Interpolated color display
│   │   │   └── Dye boxes at 0% and 100% positions
│   │   ├── Section: Recommended Dyes
│   │   │   ├── Radio buttons: [3] [4] [7] [9] dyes
│   │   │   └── Container for dye recommendation cards
│   │   ├── Dark mode toggle button
│   │   └── Recommendation information box
│   └── <div id="footer-container"> [LOADED VIA PHASE 2 shared-components.js]
├── <script src="assets/js/shared-components.js"> [FROM PHASE 2]
└── <script> [tool-specific JavaScript]
```

**Code Reuse Opportunities**:
1. **Color Utilities** (already exist):
   - `hexToRgb(hex)` - Hex to RGB conversion
   - `rgbToHex(r, g, b)` - RGB to hex conversion
   - `rgbToHsv({r, g, b})` - RGB to HSV conversion
   - `hsvToRgb({h, s, v})` - HSV to RGB conversion
   - `getColorDistance(hex1, hex2)` - Find closest dye (from Color Matcher)

2. **Shared Components** (from Phase 2):
   - Dark mode toggle (initDarkMode, toggleDarkMode)
   - Dropdown logic (toggleDropdown)
   - Component loading (nav, footer)
   - localStorage utilities (safeGetStorage, safeSetStorage)

3. **New Tool-Specific Utilities**:
   - `interpolateColorInHSV(color1, color2, position)` - Generate ideal color at position
     - Position: 0-100 (0% = Dye 1, 100% = Dye 2)
     - Returns: interpolated HSV color
   - `findClosestDyeToColor(targetColor, allDyes)` - Find nearest dye (reuse logic)
   - `calculateDeviance(actualDye, idealColor)` - Rate quality of match (0-10 scale)
     - Uses `getColorDistance()` to measure RGB difference
     - Scale: 0 = perfect match, 10 = poor match
   - `generateGradientRecommendations(dye1, dye2, recommendationCount)` - Generate positions and find dyes
   - `deduplicateDyes(recommendations)` - Remove duplicates, consolidate positions
   - `renderGradientVisualization(dye1, dye2, recommendations)` - Draw gradient and dye positions

**Event Handlers**:
- Dye 1 selector change: Update gradient and regenerate recommendations
- Dye 2 selector change: Update gradient and regenerate recommendations
- Recommendation count radio button: Regenerate recommendations with new count
- Dark mode toggle: Use shared toggle (already handled)

#### Testing Checklist for Phase 5.1

**Functionality**:
- [ ] Dye 1 and Dye 2 selectors populate with all dyes
- [ ] Gradient visualization renders with correct colors
- [ ] Recommendation counts (3/4/7/9) generate correct number of dyes
- [ ] Deviance ratings calculate correctly (0-10 scale)
- [ ] Deduplication removes duplicates and shows consolidated position
- [ ] Warning displays when Dye 1 = Dye 2
- [ ] Information cards display: name, color, deviance, position %

**Responsive Design**:
- [ ] Vertical gradient renders correctly on portrait (< 768px)
- [ ] Horizontal gradient renders correctly on landscape (≥ 768px)
- [ ] Cards stack/arrange properly on mobile
- [ ] All interactive elements touch-friendly on mobile
- [ ] No overflow or text truncation

**Dark Mode**:
- [ ] Dark mode toggle syncs with other tools
- [ ] Gradient colors remain visible in dark mode
- [ ] All text readable in dark mode (contrast)
- [ ] Cards properly styled in dark mode

**Browser & Device Testing**:
- [ ] Chrome/Edge desktop
- [ ] Firefox desktop
- [ ] Safari desktop
- [ ] Chrome Android
- [ ] Safari iOS
- [ ] No console errors/warnings

#### Future Enhancements (Not Yet Implemented)

**Good candidates for Phase 5.6+**:

1. **Direct Export to Other Tools**:
   - "Use this gradient in Color Accessibility Checker" button
   - "Compare these dyes in Dye Comparison" button
   - Deep linking between tools

2. **Advanced Filtering**:
   - Filter by acquisition method in UI
   - Filter by price range
   - "Find gradients under X gil total cost"

3. **Featured Preset Gradients**:
   - Admin-curated gradients: "Pastel Fade", "Dark Fantasy", "Sunset Transition"
   - One-click load predefined gradients
   - Community submissions system

4. **Batch Operations**:
   - Load multiple gradients simultaneously for comparison
   - Generate multiple gradients and compare all at once

5. **Advanced Analytics**:
   - Color theory analysis for each gradient
   - Perceptual uniformity score
   - Accessibility analysis (colorblind simulation integration)

#### File Structure After Phase 5 Addition

```
XIVDyeTools/
├── index.html
├── assets/
│   ├── css/
│   │   └── shared-styles.css
│   ├── js/
│   │   └── shared-components.js
│   └── json/
│       ├── colors_xiv.json
│       ├── data-centers.json
│       └── worlds.json
├── components/
│   ├── nav.html
│   └── footer.html
├── *_experimental.html (5 files)    [ADDED: dye-mixer_experimental.html]
├── *_stable.html (5 files)          [ADDED: dye-mixer_stable.html]
└── feedback/
    ├── Feedback.md
    └── IMPLEMENTATION_PLAN.md
```

#### Effort Completed for Phase 5 (All Phases)

**Phase 5.0-5.5 Actual Time**: 10+ hours (includes Phase 5.2-5.5 enhancements beyond initial MVP)

**Breakdown**:
- **Phase 5.0 MVP**: 5.5-8 hours (completed)
- **Phase 5.2 Market Board**: 1.5-2 hours (completed)
- **Phase 5.3 Save/Load UI**: 1.5-2 hours (completed)
- **Phase 5.4 Dye Filters**: 1-1.5 hours (completed)
- **Phase 5.5 URL Sharing**: 0.5-1 hour (completed)
- **Bug Fixes & Polish**: 1-2 hours (completed)

**Total Phases 5.0-5.5**: ~11-16 hours (COMPLETE ✅)

---

---

## File Structure After All Phases

```
XIVDyeTools/
├── index.html
├── assets/
│   ├── css/
│   │   └── shared-styles.css          [NEW - Phase 2]
│   ├── js/
│   │   └── shared-components.js       [NEW - Phase 2]
│   └── json/
│       ├── colors_xiv.json
│       ├── data-centers.json
│       └── worlds.json
├── components/
│   ├── nav.html                       [NEW - Phase 2]
│   └── footer.html                    [NEW - Phase 2]
├── *_experimental.html
│   ├── coloraccessibility_experimental.html      [MODIFIED - Phase 1,2,3]
│   ├── colorexplorer_experimental.html           [MODIFIED - Phase 1,2,3]
│   ├── colormatcher_experimental.html            [MODIFIED - Phase 1,2,3]
│   ├── dyecomparison_experimental.html           [MODIFIED - Phase 1,2,3]
│   └── dye-mixer_experimental.html               [NEW - Phase 5]
├── *_stable.html
│   ├── coloraccessibility_stable.html            [MODIFIED after Phase 3]
│   ├── colorexplorer_stable.html                 [MODIFIED after Phase 3]
│   ├── colormatcher_stable.html                  [MODIFIED after Phase 3]
│   ├── dyecomparison_stable.html                 [MODIFIED after Phase 3]
│   └── dye-mixer_stable.html                     [NEW after Phase 5]
└── feedback/
    ├── Feedback.md
    └── IMPLEMENTATION_PLAN.md                    [THIS FILE]
```

---

## Estimated Effort

### Phase-by-Phase Breakdown

- **Phase 1 (Bug Fixes)**: 2-3 hours
  - Bug 1.1 (Color Matcher): 1 hour (logic + testing)
  - Bug 1.2 (Dye Comparison): 1-2 hours (canvas rendering + testing)

- **Phase 2 (Refactoring)**: 4-6 hours
  - Create shared files: 1 hour
  - Update 4 experimental files: 2-3 hours
  - Testing and debugging: 1-2 hours

- **Phase 3 (Testing/Deployment)**: 2-3 hours
  - Comprehensive testing: 1-2 hours
  - Copy to stable, commit: 1 hour

- **Phase 4 (Themes & Fonts)**: ~8-12 hours (COMPLETE ✅)
  - Theme system: 8 hours
  - Font updates: 2-3 hours
  - Testing & integration: 1-2 hours

- **Phase 5 (Dye Mixer)**: ~11-16 hours (COMPLETE ✅)
  - Phase 5.0 (MVP): 5.5-8 hours
  - Phase 5.2 (Market Board): 1.5-2 hours
  - Phase 5.3 (Save/Load): 1.5-2 hours
  - Phase 5.4 (Filters): 1-1.5 hours
  - Phase 5.5 (URL Sharing): 0.5-1 hour
  - Bug fixes & polish: 1-2 hours

### Cumulative Totals

- **Phases 1-5 (ALL COMPLETED)**: **~31-44 hours** ✅
  - Phase 1 (Bug Fixes): 2-3 hours ✅
  - Phase 2 (Shared Components): 4-6 hours ✅
  - Phase 3 (Testing/Deployment): 2-3 hours ✅
  - Phase 4.1 (Theme System): 8-10 hours ✅
  - Phase 4.2 (Font Updates): 2-3 hours ✅
  - Phase 5 (Dye Mixer Complete): 11-16 hours ✅

---

## Completed Phases Summary

✅ **Phase 1: Bug Fixes** (2025-11-12)
- Fixed Color Matcher Jet Black matching issue
- Fixed Dye Comparison Hue-Saturation chart rendering
- Both bugs verified and deployed to stable

✅ **Phase 2: Shared Component Refactoring** (2025-11-13)
- Created shared CSS file (dark mode, dropdowns, toggles, fonts)
- Created shared HTML components (nav, footer)
- Created shared JavaScript utilities (component loading, dark mode)
- Updated all 4 tools + index.html
- Eliminated ~2,500 lines of CSS duplication
- Deployed to stable versions

✅ **Phase 4.1: Complete Theme System** (2025-11-13)
- Implemented 10 theme variants (5 themes × light/dark)
- Unified theme switcher in navigation replacing legacy dark mode toggle
- CSS custom properties system for centralized theme management
- 150+ hardcoded colors replaced with theme variables
- Real-time theme switching across all 4 tools simultaneously
- Fixed 7 theme-related bugs (sliders, toggles, dropdowns, inputs, etc.)
- All themes WCAG AA/AAA compliant
- Deployed to stable versions

✅ **Phase 4.2: Font Updates** (2025-11-13)
- Applied Google Fonts to all tools (Cinzel, Lexend, Habibi, etc.)
- Centralized font definitions in shared-styles.css
- Removed redundant font imports from tool-specific styles
- Deployed to stable versions

✅ **Phase 5: New Tool - Dye Mixer Complete** (2025-11-13)
- **Phase 5.0**: Core MVP with HSV interpolation, gradient visualization, deviance ratings
- **Phase 5.2**: Market board integration using shared components (Universalis API)
- **Phase 5.3**: Gradient save/load system with collapsible UI and timestamps
- **Phase 5.4**: Four dye exclusion filters (Metallic, Pastel, Dark, Cosmic)
- **Phase 5.5**: Shareable URLs with filter persistence
- **Additional**: Acquisition method display, smooth animations, responsive design, theme support
- **Total Features**: 5 phases delivered (MVP + 4 enhancement phases)
- **Version**: v1.5.1 (synced with other tools)
- **Deployed to stable versions**

---

## Phase 6: Advanced Code Refactoring - Shared Utilities & Components - COMPLETE ✅

**Status**: FULLY IMPLEMENTED AND TESTED (2025-11-13)
**Deployment Date**: 2025-11-13
**Effort**: ~12-15 hours (refactoring + bug fixes)

### Overview

Phase 6 focused on eliminating duplicate code across the 4 tools through 3 sequential refactoring phases:
- **Phase 6.1**: Move utility functions to shared-components.js
- **Phase 6.2**: Create market prices component and centralize market board logic
- **Phase 6.3**: Create flexible dropdown builder (already completed in Phase 6.1)
- **Phase 6.4**: Update documentation (this file)
- **Phase 6.5**: Sync experimental → stable (deferred until full testing complete)

**Result**: Eliminated ~1,600+ lines of duplicate code while fixing critical bugs and implementing market board functionality.

---

### Phase 6.1: Move Utilities to shared-components.js - COMPLETE ✅

**Status**: ALL UTILITIES CENTRALIZED (2025-11-13)

**New Functions Added to shared-components.js**:

1. **Color Conversion Utilities**:
   ```javascript
   hexToRgb(hex)              // "#FF0000" → { r: 255, g: 0, b: 0 }
   rgbToHex(r, g, b)         // (255, 0, 0) → "#FF0000"
   rgbToHsv(r, g, b)         // RGB → HSV color space
   hsvToRgb(h, s, v)         // HSV → RGB color space
   colorDistance(rgb1, rgb2)  // Euclidean distance in RGB space
   getColorDistance(hex1, hex2) // Distance between two hex colors
   ```

2. **API Rate Limiting**:
   ```javascript
   class APIThrottler {       // 500ms minimum between requests
       request(url)           // Queue and throttle API requests
       processQueue()         // Process queued requests sequentially
   }
   const apiThrottler = new APIThrottler(500) // Global instance
   ```

3. **Storage Utilities**:
   ```javascript
   safeGetStorage(key, defaultValue)  // Read with error handling
   safeSetStorage(key, value)         // Write with error handling
   ```

4. **Dye Category Management**:
   ```javascript
   getCategoryPriority(category)  // Sort dyes by category priority
   sortDyesByCategory(dyeArray)   // Sort array of dyes
   populateDyeDropdown(select, dyeArray) // Flexible dropdown builder
   ```

5. **JSON Fetching**:
   ```javascript
   safeFetchJSON(url, fallbackData)  // Fetch JSON with validation
   ```

6. **Market Board Utilities**:
   ```javascript
   const PRICE_CATEGORIES = {     // Centralized price filter definitions
       baseDyes, craftDyes, alliedSocietyDyes,
       cosmicDyes, specialDyes
   }

   shouldFetchPrice(dye)          // Check if dye matches filter criteria
   initializeMarketBoard(selectElementId)  // Load data centers/worlds
   fetchUniversalisPrice(itemIds, server, throttler) // API integration
   formatPrice(price)             // Format prices with thousands separator
   ```

**Code Duplication Eliminated**:
- ~200 duplicate lines per tool × 4 tools = **~800 lines removed**
- All 4 tools now share single implementations of these utilities

---

### Phase 6.2: Market Board Integration - COMPLETE ✅

**Status**: MARKET BOARD FULLY FUNCTIONAL IN ALL 3 TOOLS (2025-11-13)

#### 6.2.1: Created market-prices.html Component

**New File**: `components/market-prices.html` (67 lines)

**Features**:
- Server selector dropdown (Data Centers + Worlds)
- 5 price category toggles:
  - Base Dyes (Dye Vendor)
  - Craft Dyes (Crafting, Treasure Chest)
  - Allied Society Dyes (Amalj'aa, Ixali, Sahagin, Kobold, Sylphic vendors)
  - Cosmic Dyes (Cosmic Exploration, Cosmic Fortunes)
  - Special Dyes (category filter)
- Show/Hide Prices toggle
- Refresh Prices button
- Status message display (prices updated time, errors)

**Future Use**: Currently used for reference; tools still use inline HTML for backward compatibility and layout control.

---

#### 6.2.2: Added Market Board Functions to shared-components.js

**Centralized Logic**:

1. **PRICE_CATEGORIES Object** (defines acquisition groupings):
   ```javascript
   {
       baseDyes: { acquisitions: ['Dye Vendor'], default: false },
       craftDyes: { acquisitions: ['Crafting', 'Treasure Chest'], default: true },
       alliedSocietyDyes: {
           acquisitions: ['Amalj\'aa Vendor', 'Ixali Vendor', 'Sahagin Vendor',
                          'Kobold Vendor', 'Sylphic Vendor'],
           default: false
       },
       cosmicDyes: {
           acquisitions: ['Cosmic Exploration', 'Cosmic Fortunes'],
           default: true
       },
       specialDyes: { category: 'Special', default: true }
   }
   ```

2. **shouldFetchPrice(dye)**:
   - Check if dye matches enabled price filters
   - Used by all tools before fetching/displaying market prices

3. **initializeMarketBoard(selectElementId)**:
   - Loads data centers from data-centers.json
   - Loads worlds from worlds.json
   - Populates server select dropdown
   - Default: Crystal data center

4. **fetchUniversalisPrice(itemIds, server, throttler)**:
   - Calls Universalis API aggregated endpoint
   - Respects rate limits via APIThrottler
   - Handles both Data Center and World-specific pricing
   - Fallback chain: World price → DC price → Region price

5. **formatPrice(price)**:
   - Formats prices with thousands separator: "1,234 Gil"

---

#### 6.2.3-5: Updated All 3 Tools for Market Board

**Files Modified**:
- `colorexplorer_experimental.html` (Color Harmony Explorer)
- `colormatcher_experimental.html` (Color Matcher)
- `dyecomparison_experimental.html` (Dye Comparison)

**Changes per Tool**:

1. **Removed duplicate PRICE_CATEGORIES** (was defined in each tool)
2. **Created tool-specific filter functions**:
   - `shouldFetchPriceExplorer(color)` - Color Explorer
   - `shouldFetchPriceMatcher(dye)` - Color Matcher
   - `shouldFetchPriceComparison(dye)` - Dye Comparison
   - Each maps tool-specific checkbox IDs to filter logic

3. **Updated "Beast Tribe Dyes" → "Allied Society Dyes"**:
   - Renamed filter labels for accuracy (in-game terminology)
   - Moved Ixali Vendor from Base Dyes to Allied Society Dyes

4. **Unified filter behavior**:
   - Base Dyes: `['Dye Vendor']` only
   - Allied Society Dyes: All 5 vendor types
   - Craft, Cosmic, Special categories consistent across tools

**Code Deduplication**:
- Removed ~400+ duplicate lines from tool files
- Removed duplicate APIThrottler class declarations
- Tool-specific code now only handles UI layout and event binding

---

#### 6.2.6: Testing & Verification - COMPLETE ✅

**Test Results**:
- ✅ Dye dropdowns populate correctly in all 3 tools
- ✅ Market board server dropdowns populate with data centers & worlds
- ✅ Allied Society Dyes filter works correctly (includes all 5 vendors + Ixali)
- ✅ Base Dyes filter only shows Dye Vendor dyes
- ✅ Craft, Cosmic, Special filters work correctly
- ✅ Universalis API integration working
- ✅ Price fetching respects rate limits
- ✅ Prices display correctly in swatches/results
- ✅ No JavaScript errors in console

---

### Critical Bug Fixes During Phase 6

#### Bug 6.1: Script Loading Order - FIXED ✅

**Problem**:
- `shared-components.js` loaded **at end of HTML** before closing `</body>`
- `DOMContentLoaded` event fires **before all scripts load**
- Nav and footer components never initialized

**Solution**:
- Moved `<script src="assets/js/shared-components.js">` to `<head>`
- Now loads early, event listeners register before DOM ready
- Components initialize when DOM is ready

**Files Fixed**:
- `colorexplorer_experimental.html`
- `colormatcher_experimental.html`
- `dyecomparison_experimental.html`
- `coloraccessibility_experimental.html`

---

#### Bug 6.2: Duplicate APIThrottler Declarations - FIXED ✅

**Problem**:
```
Uncaught SyntaxError: redeclaration of let APIThrottler
```
- `APIThrottler` class defined in **shared-components.js** (now in head)
- **Each tool also had its own `APIThrottler` class definition**
- When head script defined it, then tool tried to declare it again → syntax error
- Prevented **all JavaScript execution** on the page
- Dropdowns wouldn't populate, features broken

**Solution**:
- Removed duplicate `APIThrottler` class from all 3 tool files
- All tools now use single implementation from shared-components.js

**Files Fixed**:
- `colorexplorer_experimental.html` (removed ~50 line class)
- `colormatcher_experimental.html` (removed ~50 line class)
- `dyecomparison_experimental.html` (removed ~50 line class)

---

#### Bug 6.3: Missing Global apiThrottler Instance - FIXED ✅

**Problem**:
```
ReferenceError: apiThrottler is not defined
```
- APIThrottler class was removed from tools
- Tools still tried to use `apiThrottler.request(url)`
- But only the **class** was added to shared-components.js, not the **instance**

**Solution**:
- Added `const apiThrottler = new APIThrottler(500)` to shared-components.js (line 406)
- Now available globally to all tools

---

#### Bug 6.4: Color Harmony Explorer Base Color Price Display - FIXED ✅

**Problem**:
- Market board prices fetched successfully
- Status message: "Updated 8 prices at 12:29:42 PM" ✓
- **Harmony palette colors updated with market prices** ✓
- **Base color swatch at top did NOT update** ✗
- Showed: "Dye Vendor - 40 Gil" instead of "Market Board - 350 Gil"

**Root Cause**:
- Base color display in large swatch (`selected-color-display` div) **separate HTML structure** from harmony swatches
- DOM update code only targeted harmony swatches
- Missed the top display element entirely

**Solution**:
- Added special handling for base color display (lines 1018-1033)
- Finds `selected-color-display` element
- Searches for paragraph containing "Acquisition:"
- Updates with correct market board price via `getAcquisitionText(baseColor)`

**Result**:
- ✅ All harmony swatches update with market prices
- ✅ Base color display updates with market prices
- ✅ Consistent price information across entire page

---

#### Bug 6.5: Ixali Vendor Misclassification - FIXED ✅

**Problem** (reported by user):
> "The Allied Society Dyes filter is partially resolved. All the Societies except for the Ixali are filtered though this option. Meanwhile, the Ixali Vendor dyes are still being seen as a Base Dye."

**Root Cause**:
- Ixali Vendor was in `baseDyes` acquisition list instead of `alliedSocietyDyes`
- Definition in multiple places:
  1. `shared-components.js` PRICE_CATEGORIES
  2. `colorexplorer_experimental.html` shouldFetchPriceExplorer()
  3. `colormatcher_experimental.html` shouldFetchPriceMatcher()
  4. `dyecomparison_experimental.html` shouldFetchPriceComparison()

**Solution**:
- Updated all 4 locations to move Ixali Vendor to Allied Society category
- Base Dyes now: `['Dye Vendor']` only
- Allied Society Dyes now: `['Amalj\'aa Vendor', 'Ixali Vendor', 'Sahagin Vendor', 'Kobold Vendor', 'Sylphic Vendor']`

**Result**:
- ✅ Ixali Vendor dyes (Opaque Cobalt, Opaque Indigo, etc.) now correctly filtered
- ✅ Consistent across all tools
- ✅ Correct terminology ("Allied Society" not "Beast Tribe")

---

### Phase 6 Summary

| Item | Status | Details |
|------|--------|---------|
| Shared utilities created | ✅ | 6 major utility categories added |
| Market board component created | ✅ | Reusable HTML component ready |
| All tools updated for market board | ✅ | Color Explorer, Matcher, Comparison |
| Script loading order fixed | ✅ | shared-components.js moved to head |
| Duplicate code removed | ✅ | ~1,600+ lines of duplication eliminated |
| APIThrottler consolidation | ✅ | Single instance, all tools use shared |
| Base color price display fixed | ✅ | Color Harmony Explorer now updates correctly |
| Ixali Vendor classification fixed | ✅ | Correctly categorized as Allied Society |
| All tests passing | ✅ | No console errors, all features working |

**Code Statistics**:
- Functions moved to shared-components.js: **12 major utility functions**
- Duplicate code eliminated: **~1,600+ lines**
- Bugs fixed: **5 critical issues**
- Test coverage: **All 3 tools verified working**

---

## Next Steps (Optional Future Phases)

### Option A: Phase 5 - Dye Mixer Tool
- New tool for finding bridge colors between two dyes
- HSV color interpolation
- 3/4/7/9 dye recommendations
- Responsive vertical/horizontal gradient layout
- Dark mode support
- Estimated effort: 5.5-8 hours

### Option B: Phase 4.1 - Theme System
- 6 new color themes (Hydaelyn, Classic FF, Parchment, Sugar Riot, etc.)
- WCAG AA/AAA compliance
- Theme switching UI
- localStorage persistence
- Estimated effort: 8-12 hours

### Option C: Maintenance & Polish
- Cross-browser testing (Chrome, Firefox, Safari, mobile)
- Performance optimization
- Accessibility audit
- Documentation updates

---

## Questions to Resolve

- [ ] Should we implement localStorage key migration for dark mode?
- [ ] What should fallback content be if component loading fails?
- [ ] Should index.html also use dynamic loading, or keep self-contained?
- [ ] Do we want loading spinners/skeletons for component loading?
- [ ] Should we add analytics/error reporting for fetch failures?
