# XIV Dye Tools v2.0.0 Mobile Optimization - Remaining Work

**Status**: Phases 1-7 Complete ✅ | Bug Fixed ✅ | Phases 8-9 Remaining

**Latest Commits**:
- 68965c7: Style: Standardize version number styling in Accessibility Checker
- 32a1d6a: Refactor: Extract mobile bottom navigation to shared component
- 60826b4: Feature: Add privacy notice to Color Matcher camera functionality
- 4b9192c: PHASE 7: Mobile UX Polish - Complete Implementation (Help system + Bottom nav + Keyboard optimization)

**Phase 7 Summary** ✅:
- ✅ Phase 7.1: Mobile-Specific Help/Tutorial System (307 lines of CSS + HTML in all 5 tools)
- ✅ Phase 7.2: Mobile Bottom Navigation Bar (5-tool navigation, refactored to shared component)
- ✅ Phase 7.3: Mobile Keyboard Optimization (font sizing, viewport handling, safe area support)
- ✅ Privacy Notice: Added to Color Matcher camera functionality
- ✅ Code Refactoring: Bottom nav extracted to shared component (eliminated 310 lines of duplication)

---

## Known Issues / Bugs to Fix

### ✅ FIXED: Mobile Navigation Menu Alignment Inconsistent
**Priority**: ~~HIGH~~ **RESOLVED**
**Status**: Fixed in commit b35ebf2
**Affected Tools**: All tools
**Files Modified**:
- `components/nav.html`
- `assets/css/shared-styles.css`

#### Issue (RESOLVED):
Mobile navigation menus (Tools & Themes dropdowns) were misaligned - appearing left or right aligned instead of centered on screen.

#### Solution Applied:
1. **Theme Switcher Menu** (components/nav.html):
   - Changed mobile positioning from `right: 1rem; left: 1rem;` (stretching) to `left: 50%; transform: translateX(-50%);` (centered)
   - Width: 90vw with max-width: 340px
   - Position: fixed on mobile for proper centering

2. **Tools Dropdown Menu** (assets/css/shared-styles.css):
   - Added @media (max-width: 640px) query
   - Same centering pattern: `left: 50%; transform: translateX(-50%);`
   - Width: 90vw with max-width: 340px for consistency

#### Verification (PASSED):
- ✅ Menus centered on 375px viewport
- ✅ Menus centered on 428px viewport
- ✅ Menus centered on 640px viewport
- ✅ Right-aligned on desktop (768px+)
- ✅ No overflow on small screens
- ✅ Proper edge padding maintained
- ✅ Works in portrait and landscape
- ✅ Consistent across all tools

---

## Phase 4: PWA & Camera Support

Progressive Web App configuration and camera integration for mobile devices.

### PHASE 4.1: Add Camera Capture Support to Color Matcher
**File**: `colormatcher_experimental.html`

#### Changes Required:
- [ ] Add `capture="environment"` attribute to image file input
  - Location: Line ~836 (imageLoader input element)
  - Allow mobile users to capture photos directly from camera

- [ ] Add mobile-friendly hint text
  - Update help text to mention "Take photo" option
  - Text: "Drag & drop • Click to browse • Take photo • Paste (Ctrl+V)"

- [ ] Test on iOS (requires HTTPS in production)
  - iOS Safari uses `<input type="file" capture="environment">`
  - Android Chrome uses same attribute

#### Success Criteria:
- [ ] File input shows camera option on iOS Safari
- [ ] File input shows camera option on Android Chrome
- [ ] Camera photos load correctly into canvas
- [ ] Eyedropper tool works on camera images

---

### PHASE 4.2: Create manifest.json for PWA Configuration
**File**: `manifest.json` (new file)

#### Changes Required:
- [ ] Create `/manifest.json` in project root with:
  - [ ] App name: "XIV Dye Tools"
  - [ ] Short name: "Dye Tools" (12 chars max)
  - [ ] Start URL: `/index.html`
  - [ ] Display: "standalone"
  - [ ] Theme color: `#4f46e5` (indigo, matches tools)
  - [ ] Background color: `#ffffff`
  - [ ] Orientation: "portrait-primary"
  - [ ] Icons array:
    - [ ] 192×192 PNG (maskable icon support)
    - [ ] 512×512 PNG (maskable icon support)
    - [ ] Purpose: "any" and "maskable"
  - [ ] Screenshots array:
    - [ ] 540×720 screenshot for portrait
    - [ ] 1280×720 screenshot for landscape
    - [ ] Screenshots should show each tool
  - [ ] Categories: `["productivity", "utilities"]`
  - [ ] Description: "Professional FFXIV dye color tools with accessibility checker, harmony explorer, color matcher, comparison tool, and dye mixer"
  - [ ] Shortcuts (optional but nice):
    - [ ] Color Matcher: `/colormatcher_stable.html`
    - [ ] Color Harmony: `/colorexplorer_stable.html`
    - [ ] Accessibility Checker: `/coloraccessibility_stable.html`
    - [ ] Dye Comparison: `/dyecomparison_stable.html`
    - [ ] Dye Mixer: `/dye-mixer_stable.html`

#### HTML Integration:
- [ ] Add to all 5 experimental tool files:
  ```html
  <link rel="manifest" href="../manifest.json">
  ```
- [ ] Verify `theme-color` meta tag matches manifest theme color

#### Success Criteria:
- [ ] Valid JSON syntax (no trailing commas)
- [ ] All icon files exist and referenced correctly
- [ ] Icons are valid PNG files with transparency
- [ ] Manifest passes PWA validation tools (https://pwa-workshop.js.org/)

---

### PHASE 4.3: Create service-worker.js for Offline Support
**File**: `service-worker.js` (new file)

#### Changes Required:
- [ ] Service Worker registration code
  - Add to all 5 tool files in main script:
    ```javascript
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../service-worker.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed'));
    }
    ```

- [ ] Caching strategy implementation (Cache-First for static assets):
  - [ ] Cache name: `xiv-dye-tools-v2`
  - [ ] Cache on install:
    - HTML files: all 5 tool files + index.html
    - CSS: shared-styles.css, tailwind.css
    - JS: shared-components.js
    - JSON: colors_xiv.json, data-centers.json, worlds.json
    - Fonts: Google Fonts (Inter, Cinzel, Lexend, Habibi)

  - [ ] Network-first for API requests:
    - Universalis API calls (market prices)
    - Fallback to cached data or empty array

- [ ] Cache cleanup:
  - [ ] Delete old caches on activation
  - [ ] Versioning strategy: increment cache version on updates

- [ ] Offline fallback page:
  - [ ] Show "You're offline" message gracefully
  - [ ] Allow cached tools to work offline
  - [ ] Disable Universalis API price fetching when offline

#### Service Worker Features:
- [ ] Precaching of essential static assets
- [ ] Network-first strategy for API calls
- [ ] Cache-first strategy for static resources
- [ ] Background sync (optional, for saved gradients)
- [ ] Push notifications (optional, future feature)

#### Success Criteria:
- [ ] ServiceWorker registers without errors
- [ ] App works offline with cached data
- [ ] Cache updates when service worker updates
- [ ] Can switch between offline/online smoothly

---

### PHASE 4.4: Add App Icons & Update Metadata
**Files**: `assets/icons/` ✅ ICONS CREATED | HTML files need metadata updates

#### Status: Icons Already Created
**✅ Completed**: Application icons have been created and placed in `assets/icons/`:
- ✅ `apple-touch-icon.png` (180×180 for iOS)
- ✅ `icon-192x192.png` (for home screen, smaller devices)
- ✅ `icon-512x512.png` (for splash screen, larger devices)

#### Remaining Changes Required:

- [ ] **Update all 5 experimental tool files with icon metadata**:
  - [ ] `coloraccessibility_experimental.html`
  - [ ] `colorexplorer_experimental.html`
  - [ ] `colormatcher_experimental.html`
  - [ ] `dyecomparison_experimental.html`
  - [ ] `dye-mixer_experimental.html`

  Add to `<head>` section:
  ```html
  <link rel="apple-touch-icon" href="../assets/icons/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/icons/icon-192x192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="../assets/icons/icon-512x512.png">
  ```

- [ ] **Update `manifest.json`** to reference the created icons:
  ```json
  "icons": [
    {
      "src": "assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
  ```

- [ ] **Update `index.html`** with icon metadata:
  ```html
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="assets/icons/icon-192x192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="assets/icons/icon-512x512.png">
  ```

#### Verification Checklist:
- [ ] All 5 tool files have icon links in `<head>`
- [ ] `index.html` has icon links
- [ ] `manifest.json` includes all 4 icon entries (192×192 any + maskable, 512×512 any + maskable)
- [ ] Icons are relative paths (use `../assets/icons/` for tools, `assets/icons/` for index.html)
- [ ] No 404 errors when opening DevTools (Network tab for icon requests)

#### Success Criteria:
- [ ] Icons display on home screen when installed (iOS & Android)
- [ ] Icons display as splash screen on launch
- [ ] Icons are crisp and recognizable at all sizes
- [ ] Icons appear correctly on both iOS and Android
- [ ] PWA validator shows no icon errors
- [ ] No broken image references in DevTools console

---

## Phase 5: Performance Optimization

Canvas and computation optimization for mobile devices.

### PHASE 5.1: Optimize Canvas Resolution on Mobile
**Files**: `dyecomparison_experimental.html`, `colorexplorer_experimental.html`

#### Changes Required:
- [ ] Implement device pixel ratio detection:
  ```javascript
  const dpr = window.devicePixelRatio || 1;
  const mobileResolutionReduction = isMobile() ? 4 : 2;
  const canvasResolution = dpr / mobileResolutionReduction;
  ```

- [ ] Apply to Dye Comparison charts:
  - [ ] Hue-Saturation canvas (1000×750 normally)
    - Mobile: 250×187.5 (divide by 4)
    - Desktop: 500×375 (divide by 2)
  - [ ] Brightness canvas (1000×750 normally)
    - Mobile: 250×187.5 (divide by 4)
    - Desktop: 500×375 (divide by 2)

- [ ] Apply to Color Harmony Explorer:
  - [ ] Color wheel rendering (normally ~200px)
    - Mobile: Use native resolution, scale down with CSS
    - Desktop: Full resolution

- [ ] Scale canvas context up for crisp rendering:
  ```javascript
  ctx.scale(canvasResolution, canvasResolution);
  // Draw at logical sizes, browser scales to device pixels
  ```

#### Memory Optimization:
- [ ] Reduce ImageData operations on mobile
- [ ] Clear canvas context between draws
- [ ] Garbage collection hints after rendering

#### Success Criteria:
- [ ] Canvas renders crisply on high-DPI devices
- [ ] Mobile devices use 4x less memory for canvas
- [ ] Performance maintains 60 FPS on mobile
- [ ] Visual quality remains acceptable on mobile

---

### PHASE 5.2: Optimize Color Matcher Eyedropper
**File**: `colormatcher_experimental.html`

#### Changes Required:
- [ ] Reduce sample size on mobile devices:
  ```javascript
  const defaultSampleSize = isMobile() ? 8 : 16;
  // Reduce from 16x16 pixels to 8x8 on mobile
  ```

- [ ] Implement debouncing for eyedropper cursor movement:
  - [ ] Desktop: 0ms debounce (immediate feedback)
  - [ ] Mobile: 100ms debounce (reduce computation)
  - [ ] Update preview while moving, not on every pixel

- [ ] Lazy load eyedropper preview:
  - [ ] Only render preview when mouse is over canvas
  - [ ] Stop rendering when mouse leaves
  - [ ] Clear preview on touchend on mobile

- [ ] Optimize color sampling algorithm:
  - [ ] Cache ImageData between samples
  - [ ] Reuse typed arrays instead of creating new ones
  - [ ] Use requestAnimationFrame for smooth animations

#### Code Changes:
- [ ] Add to Color Matcher eyedropper event handler:
  ```javascript
  const eyedropperDebounce = isMobile() ? 100 : 0;
  // Apply debounce to mouse move handler
  ```

#### Success Criteria:
- [ ] Eyedropper remains responsive on mobile
- [ ] Reduced CPU usage during color sampling
- [ ] Memory usage stays low during eyedropping
- [ ] Touch input works smoothly on tablets

---

### PHASE 5.3: Add Computation Debouncing for Color Calculations
**Files**: All 5 experimental tool files

#### Changes Required:
- [ ] Implement mobile-specific debouncing:
  ```javascript
  const computationDebounce = isMobile() ? 300 : 100;
  // Delay expensive calculations on mobile
  ```

- [ ] Apply to Color Harmony Explorer:
  - [ ] Debounce color wheel updates when searching
  - [ ] Delay market price fetches by 300ms on mobile
  - [ ] Debounce harmony calculation when slider moves

- [ ] Apply to Color Accessibility Checker:
  - [ ] Debounce accessibility score calculation
  - [ ] Delay warning card updates by 300ms on mobile
  - [ ] Reduce frequency of vision simulation updates

- [ ] Apply to Dye Comparison:
  - [ ] Debounce distance matrix calculation
  - [ ] Delay chart rendering by 300ms on mobile

- [ ] Apply to Dye Mixer:
  - [ ] Debounce gradient generation
  - [ ] Delay deviance calculation

#### Implementation Pattern:
```javascript
// Use shared debounce utility from shared-components.js
const updateResults = debounce(() => {
    // Expensive calculation here
}, isMobile() ? 300 : 100);

// Call in event handler
element.addEventListener('change', updateResults);
```

#### Success Criteria:
- [ ] Mobile devices don't stall during rapid input changes
- [ ] Desktop devices remain responsive (minimal delay)
- [ ] Battery life improved on mobile
- [ ] Smooth user experience on all devices

---

## Phase 6: Advanced Touch Features

Enhanced touch gesture support across tools.

### PHASE 6.1: Add Swipe-to-Change-View Gestures for Color Harmony Explorer
**File**: `colorexplorer_experimental.html`

#### Changes Required:
- [ ] Implement swipe gesture detection:
  - [ ] Swipe Left: Next harmony type
  - [ ] Swipe Right: Previous harmony type
  - [ ] Threshold: 30px horizontal movement

- [ ] Harmony types order (cycling):
  1. Complementary
  2. Analogous
  3. Triadic
  4. Split-Complementary
  5. Tetradic
  6. Square
  (back to Complementary on loop)

- [ ] Visual feedback:
  - [ ] Highlight active harmony type button
  - [ ] Smooth transition between harmony types
  - [ ] Show transition animation

- [ ] Add to Color Harmony Explorer:
  ```javascript
  const gestureManager = new TouchGestureManager(harmonyResultsContainer);
  let currentHarmonyIndex = 0;

  gestureManager.on('onSwipe', (gesture) => {
      if (gesture.direction === 'left') {
          currentHarmonyIndex = (currentHarmonyIndex + 1) % 6;
          updateHarmonyDisplay(currentHarmonyIndex);
          hapticSuccess();
      } else if (gesture.direction === 'right') {
          currentHarmonyIndex = (currentHarmonyIndex - 1 + 6) % 6;
          updateHarmonyDisplay(currentHarmonyIndex);
          hapticSuccess();
      }
  });
  ```

#### Success Criteria:
- [ ] Swipe gesture reliably detects left/right movement
- [ ] Harmony type changes smoothly on swipe
- [ ] Visual feedback confirms gesture recognized
- [ ] Works on iOS and Android
- [ ] No accidental triggers on vertical scrolling

---

### PHASE 6.2: Add Swipe-to-Change-Vision Gesture for Color Accessibility Checker
**File**: `coloraccessibility_experimental.html`

#### Changes Required:
- [ ] Implement swipe gesture for vision type cycling:
  - [ ] Swipe Left: Next vision type
  - [ ] Swipe Right: Previous vision type
  - [ ] Threshold: 30px horizontal movement

- [ ] Vision types order:
  1. Normal Vision
  2. Deuteranopia (Red-Green)
  3. Protanopia (Red-Green)
  4. Tritanopia (Blue-Yellow)
  5. Achromatopsia (Monochrome)
  (back to Normal on loop)

- [ ] Visual feedback:
  - [ ] Highlight active vision type section
  - [ ] Show transition animation
  - [ ] Update all comparison cards

- [ ] Implementation:
  ```javascript
  const gestureManager = new TouchGestureManager(visionComparisonContainer);
  let currentVisionIndex = 0;

  gestureManager.on('onSwipe', (gesture) => {
      if (gesture.direction === 'left') {
          currentVisionIndex = (currentVisionIndex + 1) % 5;
          updateVisionDisplay(currentVisionIndex);
          hapticSuccess();
      }
      // ... handle right swipe
  });
  ```

#### Success Criteria:
- [ ] Swipe reliably cycles through vision types
- [ ] Accessibility score updates on vision change
- [ ] Visual comparison cards update smoothly
- [ ] Warnings and suggestions update correctly
- [ ] Works on touch devices

---

### PHASE 6.3: Add Pinch-to-Zoom for Color Harmony & Dye Comparison Charts
**Files**: `colorexplorer_experimental.html`, `dyecomparison_experimental.html`

#### Changes Required:
- [ ] Color Harmony Explorer:
  - [ ] Pinch-to-zoom on color wheel visualization
  - [ ] Zoom range: 1x to 3x
  - [ ] Recenter on double-tap
  - [ ] Add visual zoom indicator

- [ ] Dye Comparison:
  - [ ] Pinch-to-zoom on hue-saturation chart
  - [ ] Pinch-to-zoom on brightness chart
  - [ ] Pinch-to-zoom on distance matrix (if applicable)
  - [ ] Zoom range: 1x to 2x
  - [ ] Add zoom level indicator

- [ ] Implementation pattern:
  ```javascript
  const gestureManager = new TouchGestureManager(chartContainer);
  let currentZoom = 1;

  gestureManager.on('onPinch', (gesture) => {
      if (gesture.isZoomIn) {
          currentZoom = Math.min(3, currentZoom * 1.2);
      } else {
          currentZoom = Math.max(1, currentZoom / 1.2);
      }
      updateChartZoom(currentZoom);
      hapticLight();
  });

  gestureManager.on('onDoubleTap', () => {
      currentZoom = 1;
      updateChartZoom(1);
      hapticSuccess();
  });
  ```

#### Visual Indicators:
- [ ] Show zoom level percentage
- [ ] Highlight pinch-to-zoom capability on first use
- [ ] Show reset button when zoomed

#### Success Criteria:
- [ ] Pinch gestures smoothly zoom charts
- [ ] Zoom persists while viewing details
- [ ] Double-tap resets to normal zoom
- [ ] Charts remain readable at all zoom levels
- [ ] Touch gestures don't interfere with scrolling

---

### PHASE 6.4: Implement Swipe-to-Close for All Modal Dialogs
**Files**: All 5 experimental tool files

#### Changes Required:
- [ ] Add swipe-down gesture detection for modals:
  - [ ] Swipe Down: Close modal
  - [ ] Threshold: 50px vertical movement downward
  - [ ] Only when not scrolling content

- [ ] Apply to all modals:
  - [ ] Help modal (Color Matcher)
  - [ ] Zoom backdrop (Color Harmony Explorer)
  - [ ] Any dialog/modal elements

- [ ] Implementation:
  ```javascript
  const gestureManager = new TouchGestureManager(modalElement);

  gestureManager.on('onSwipe', (gesture) => {
      if (gesture.direction === 'down' && gesture.distance > 50) {
          closeModal();
          hapticSuccess();
      }
  });
  ```

- [ ] Visual feedback:
  - [ ] Highlight modal close button on swipe down
  - [ ] Show close hint on first modal open
  - [ ] Smooth close animation

#### Accessibility:
- [ ] Keep close button for keyboard/mouse users
- [ ] Don't disable any existing close methods
- [ ] Ensure screen reader announces close option

#### Success Criteria:
- [ ] Swipe-down closes modals reliably
- [ ] Other swipe directions don't trigger close
- [ ] Scroll content doesn't accidentally close modal
- [ ] Works on iOS and Android
- [ ] Close button still available as fallback

---

## Phase 7: Mobile UX Polish

Mobile-specific user experience improvements.

### PHASE 7.1: Create Mobile-Specific Help/Tutorial System
**File**: New file or addition to shared-components.js

#### Changes Required:
- [ ] Detect first-time mobile users:
  ```javascript
  const hasSeenMobileTutorial = getMobileSetting('seenMobileTutorial', false);
  if (!hasSeenMobileTutorial && isMobile()) {
      showMobileTutorial();
  }
  ```

- [ ] Create tutorial overlay:
  - [ ] Semi-transparent backdrop
  - [ ] Highlighted feature with tooltip
  - [ ] "Next" button to advance through tips
  - [ ] Option to skip all tips
  - [ ] Smooth animations between tips

- [ ] Mobile-specific tips:
  - [ ] "Drag & drop or take photo" for Color Matcher
  - [ ] "Swipe to change harmony types" for Explorer
  - [ ] "Swipe to change vision type" for Accessibility
  - [ ] "Pinch to zoom charts" for Dye Comparison
  - [ ] "Two-finger pan to move image" for Matcher
  - [ ] "Swipe down to close dialogs"
  - [ ] "Long-press to save gradients" in Dye Mixer

- [ ] Tutorial sequence:
  1. First tip on page load (2 second delay)
  2. Auto-advance after 4 seconds or user tap
  3. Option to re-show on settings menu

- [ ] Persistent settings:
  - [ ] Store "don't show again" preference in localStorage
  - [ ] Add "Show tips again" button in settings/menu

#### Success Criteria:
- [ ] Tutorial appears only on first mobile visit
- [ ] Tips are contextual to active tool
- [ ] Users can skip or dismiss
- [ ] Clear and concise text (2-3 sentences max)
- [ ] Works on all screen sizes

---

### PHASE 7.2: Add Bottom Navigation Bar for Mobile
**File**: `components/nav.html` (or new mobile-nav component)

#### Changes Required:
- [ ] Create bottom navigation bar:
  - [ ] Fixed position at bottom of screen
  - [ ] 60px height (touch-friendly)
  - [ ] 5 tabs for main tools + portal
  - [ ] Icons + labels for each

- [ ] Navigation items:
  1. 🏠 Portal (index.html)
  2. 🎯 Color Matcher
  3. 🌈 Harmony Explorer
  4. ♿ Accessibility Checker
  5. 🔀 Dye Comparison
  6. 🎨 Dye Mixer (might need scroll or wrapping)

- [ ] Implementation:
  - [ ] Show only on mobile (hide on desktop with CSS)
  - [ ] Active indicator for current page
  - [ ] Icons using SVG or emoji
  - [ ] Smooth transitions

- [ ] CSS:
  ```css
  @media (max-width: 767px) {
      #mobile-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          display: flex;
          gap: 0.5rem;
          background-color: var(--theme-bg-secondary);
          border-top: 1px solid var(--theme-border);
          z-index: 90;
      }

      body {
          padding-bottom: 60px;
          /* Account for fixed bottom nav */
      }
  }
  ```

- [ ] Accessibility:
  - [ ] ARIA labels for each nav item
  - [ ] Keyboard navigation support
  - [ ] Screen reader announcements

#### Success Criteria:
- [ ] Bottom nav appears only on mobile
- [ ] All 5 tools easily accessible with one tap
- [ ] Current page highlighted
- [ ] Doesn't interfere with page content
- [ ] Touch targets are 44×44px minimum

---

### PHASE 7.3: Implement Mobile Keyboard Optimization
**Files**: All 5 experimental tool files

#### Changes Required:
- [ ] Add `inputmode` attributes:
  ```html
  <!-- For color search inputs -->
  <input type="text" inputmode="text" autocomplete="off" />

  <!-- For number inputs -->
  <input type="number" inputmode="numeric" />
  ```

- [ ] Add `autocomplete` attributes strategically:
  ```html
  <!-- Suggest previous searches -->
  <input type="text" id="color-search" autocomplete="on" />

  <!-- Disable for sensitive data -->
  <input type="text" inputmode="text" autocomplete="off" />
  ```

- [ ] Font size optimization for mobile keyboards:
  - [ ] Inputs must be 16px+ to avoid iOS zoom
  - [ ] Apply on mobile only:
    ```css
    @media (max-width: 767px) {
        input, select, textarea {
            font-size: 16px !important;
        }
    }
    ```

- [ ] Disable auto-zoom on input focus:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  ```
  (Note: Only in critical cases, prefer allowing pinch zoom)

- [ ] Add soft keyboard hints:
  - [ ] `inputmode="search"` for search fields
  - [ ] `inputmode="decimal"` for numeric inputs
  - [ ] Appropriate return key: `enterkeyhint="search"` or `enterkeyhint="done"`

#### Specific Changes:
- [ ] Color Matcher:
  - [ ] Search input: `inputmode="text"` with autocomplete
  - [ ] Color picker hex input: `inputmode="text"`

- [ ] Color Harmony Explorer:
  - [ ] Color search: `inputmode="text"`

- [ ] Color Accessibility Checker:
  - [ ] Range sliders: Proper mobile touch handling

- [ ] Dye Comparison:
  - [ ] Dropdowns: Proper `inputmode` hints

- [ ] Dye Mixer:
  - [ ] Dye selects: Optimized for mobile keyboards

#### Success Criteria:
- [ ] Appropriate keyboard appears for input type
- [ ] No unwanted zoom on input focus (iOS)
- [ ] Autocomplete suggestions work
- [ ] Return key has appropriate label
- [ ] All inputs are 16px+ on mobile

---

## Phase 8: Comprehensive Testing

Extensive testing across devices, browsers, and scenarios.

### Quick Reference: Phase 8 Testing Checklist

**Estimated Time**: 8-12 hours (can be spread across multiple sessions)

**Testing Priorities** (in order):
1. **Phase 8.1: Cross-Device Testing** (4-6 hours) - HIGHEST PRIORITY
   - Test on real mobile devices (iOS + Android)
   - Verify responsive design at key breakpoints
   - Test touch interactions and gestures

2. **Phase 8.2: Performance Testing** (2-3 hours)
   - Lighthouse scores for each tool
   - Canvas rendering performance
   - Memory/battery usage on mobile

3. **Phase 8.3: Touch Accuracy Testing** (1-2 hours)
   - Button sizing and touch targets
   - Gesture recognition reliability
   - Edge cases and accidental triggers

4. **Phase 8.4: PWA Testing** (1-2 hours)
   - Installation on iOS and Android
   - Offline functionality
   - Manifest and icon validation

### Practical Testing Setup

**For Testing Without Real Devices:**
1. Use Chrome DevTools Mobile Emulation
   - Open DevTools (F12)
   - Click device toolbar (Ctrl+Shift+M)
   - Test at: 375px, 640px, 768px, 1024px
   - Test orientation changes
   - Test with throttling (Fast 3G, Slow 4G)

2. Use Lighthouse (Built-in to DevTools)
   - Run audits for each tool
   - Check Performance, Accessibility, Best Practices scores
   - Look for actionable recommendations

**For Real Device Testing:**
1. Use BrowserStack (free tier available)
   - Or test on your own iPhone/Android devices if available
2. Test these key devices:
   - iPhone 12 or newer (iOS)
   - Samsung Galaxy S21 (Android)
   - iPad or tablet (landscape orientation)

### Testing Data to Collect

**For Each Tool & Device Combination:**
```markdown
## [Tool Name] - [Device/Screen Size]
**Date**: YYYY-MM-DD
**Environment**: Device/Browser/Version

### Functionality
- [ ] App loads without errors
- [ ] All buttons respond to touch
- [ ] Mobile bottom nav appears and works
- [ ] Help modal opens/closes
- [ ] Tool-specific features work

### Performance
- [ ] Page load time < 5 seconds
- [ ] Interactions responsive (< 200ms)
- [ ] No lag or jank during use

### Issues Found
- [ ] Issue 1: [Description] - [Severity: Critical/High/Medium/Low]
- [ ] Issue 2: ...

### Notes
- [Any observations or concerns]
```

### Success Criteria for Phase 8

**Must Have** (blocking release):
- ✅ All 5 tools load without errors on iOS and Android
- ✅ Responsive design works at 375px, 640px, 768px, 1024px
- ✅ Touch interactions are responsive (< 200ms)
- ✅ Mobile bottom nav visible and functional on mobile
- ✅ Help system opens and closes properly
- ✅ No critical bugs found

**Should Have** (nice to have):
- ✅ Lighthouse Performance score ≥ 85
- ✅ Lighthouse Accessibility score ≥ 90
- ✅ Canvas renders smoothly on mobile
- ✅ Offline mode works with cached data

**Nice to Have** (polish):
- ✅ Battery drain acceptable (< noticeable in 30 min)
- ✅ All gesture interactions smooth and responsive
- ✅ PWA installs cleanly on iOS and Android

### PHASE 8.1: Cross-Device Testing
**Testing Scope**: iOS, Android, multiple screen sizes

#### iOS Testing (Safari):
- [ ] iPhone SE (375×667)
- [ ] iPhone 12/13 (390×844)
- [ ] iPhone 14 Pro (393×852)
- [ ] iPhone 14 Pro Max (430×932)
- [ ] iPad Mini (768×1024)
- [ ] iPad Air (820×1180)
- [ ] iPad Pro 12.9" (1024×1366)

#### Test Cases - All Tools:
- [ ] App loads without errors
- [ ] Layout is responsive at each size
- [ ] Touch targets are 44×44px minimum
- [ ] Buttons respond to tap (no visual lag)
- [ ] Text is readable (16px minimum on mobile)
- [ ] Colors render correctly
- [ ] Theme switching works
- [ ] localStorage persists after refresh
- [ ] Responsive images scale correctly

#### Test Cases - Specific to Tools:
- [ ] **Color Matcher**:
  - [ ] Camera input works on iOS
  - [ ] Drag & drop works (or shows upload prompt)
  - [ ] Eyedropper doesn't lag
  - [ ] Pinch-to-zoom works
  - [ ] Double-tap zoom works
  - [ ] Zoom buttons work

- [ ] **Color Harmony Explorer**:
  - [ ] Color wheel renders crisply
  - [ ] Swipe changes harmony type
  - [ ] Market prices load (if enabled)
  - [ ] Export buttons work

- [ ] **Color Accessibility Checker**:
  - [ ] Dye selection works
  - [ ] Dual dyes toggle works
  - [ ] Vision sliders work
  - [ ] Swipe changes vision type
  - [ ] Accessibility score updates

- [ ] **Dye Comparison**:
  - [ ] Dye select dropdowns work
  - [ ] Cards display correctly at all sizes
  - [ ] Charts render with pinch-zoom
  - [ ] Export buttons work

- [ ] **Dye Mixer**:
  - [ ] Gradient visualization displays
  - [ ] Recommendation buttons work
  - [ ] Dye cards show on tap (not hover)
  - [ ] Save/load gradients work

#### Android Testing (Chrome, Firefox):
- [ ] Galaxy S21 (360×800)
- [ ] Pixel 6 (412×915)
- [ ] Samsung Galaxy A52 (412×914)
- [ ] OnePlus 10 (412×915)
- [ ] Samsung Galaxy Tab S7 (800×1280)
- [ ] Google Pixel Tablet (2560×1600)

#### Same test cases as iOS

#### Tablet Testing:
- [ ] Landscape orientation works
- [ ] All breakpoints respected
- [ ] Touch targets still accessible
- [ ] Two-column layouts (if applicable) work

#### Test Report Template:
```markdown
## [Device] - [OS] - [Browser]
- Date: YYYY-MM-DD
- Tester:
- Issues Found: X

### Color Matcher
- [ ] Load: ✅/⚠️/❌
- [ ] Touch: ✅/⚠️/❌
- [ ] Camera: ✅/⚠️/❌
- [ ] Performance: ✅/⚠️/❌
- Notes:

### [Other Tools...]
```

#### Success Criteria:
- [ ] All tests pass on at least 2 iOS devices
- [ ] All tests pass on at least 2 Android devices
- [ ] No critical bugs reported
- [ ] Touch interaction is responsive (<200ms)
- [ ] No layout shifts or janky animations

---

### PHASE 8.2: Performance Testing
**Testing Scope**: FPS, throttling, memory, battery

#### Tools Required:
- [ ] Chrome DevTools Performance tab
- [ ] Lighthouse (DevTools)
- [ ] WebPageTest.org
- [ ] GTmetrix

#### Performance Benchmarks:
- [ ] **Lighthouse Scores**:
  - [ ] Performance: ≥85
  - [ ] Accessibility: ≥90
  - [ ] Best Practices: ≥85
  - [ ] SEO: ≥90

- [ ] **FPS (Frames Per Second)**:
  - [ ] Canvas rendering: ≥60 FPS on desktop
  - [ ] Canvas rendering: ≥30 FPS on mobile
  - [ ] Gesture animations: ≥60 FPS
  - [ ] Page scrolling: ≥60 FPS

- [ ] **Load Times**:
  - [ ] Page load (3G throttle): <5 seconds
  - [ ] Page load (4G throttle): <2 seconds
  - [ ] Initial paint: <1.5s
  - [ ] Largest contentful paint: <2.5s

- [ ] **Memory Usage**:
  - [ ] Initial load: <10MB
  - [ ] Peak during operation: <20MB
  - [ ] No memory leaks after 5 minutes use

#### Test Scenarios:
- [ ] **Desktop (Baseline)**:
  - [ ] No throttling
  - [ ] Chrome/Firefox/Safari
  - [ ] High-end machine

- [ ] **Mobile 4G (Slow)**:
  - [ ] 4G throttling: 10 Mbps down / 2.5 Mbps up
  - [ ] Chrome DevTools throttle
  - [ ] Test all tools

- [ ] **Mobile 3G (Very Slow)**:
  - [ ] 3G throttling: 1.6 Mbps down / 750 Kbps up
  - [ ] Chrome DevTools throttle
  - [ ] Critical features only

- [ ] **CPU Throttle**:
  - [ ] 4x CPU slowdown (DevTools)
  - [ ] Test canvas rendering
  - [ ] Test gesture response

#### Canvas Optimization Testing:
- [ ] **Dye Comparison Charts**:
  - [ ] Hue-saturation chart FPS (mobile): ≥30 FPS
  - [ ] Brightness chart FPS (mobile): ≥30 FPS
  - [ ] Render time < 100ms per chart

- [ ] **Color Harmony Explorer**:
  - [ ] Color wheel render time: <50ms
  - [ ] Update on search: <300ms (debounced)

#### Memory Testing:
- [ ] Open each tool
- [ ] Perform typical workflow for 5 minutes
- [ ] Check DevTools Memory tab
- [ ] Use Heap Snapshots to detect leaks
- [ ] Compare memory before/after garbage collection

#### Battery Testing (Mobile):
- [ ] Open tool on mobile device
- [ ] Perform typical workflow
- [ ] Monitor battery usage
- [ ] Should not drain battery noticeably in 30 minutes

#### Network Testing:
- [ ] Offline mode works (with cached data)
- [ ] API calls have timeouts (5 second max)
- [ ] Graceful fallback when API unavailable

#### Test Report Template:
```markdown
## Performance Report - [Tool]

### Lighthouse Scores
- Performance: X/100
- Accessibility: X/100
- Best Practices: X/100
- SEO: X/100

### Load Times
- First Paint: Xms
- Largest Contentful Paint: Xms
- Time to Interactive: Xms

### FPS (DevTools Performance)
- Canvas Rendering: X FPS
- Gestures: X FPS
- Scrolling: X FPS

### Memory
- Initial: X MB
- Peak: X MB
- After GC: X MB

### Issues Found
- [ ] Issue 1
- [ ] Issue 2

### Recommendations
-
```

#### Success Criteria:
- [ ] Lighthouse Performance ≥85
- [ ] Canvas FPS ≥30 on mobile
- [ ] Page load <5s on 3G
- [ ] No memory leaks detected
- [ ] Offline mode works

---

### PHASE 8.3: Touch Accuracy Testing
**Testing Scope**: Button sizing, gesture recognition, edge cases

#### Touch Target Testing:
- [ ] All buttons are ≥44×44px
- [ ] Buttons with 12px padding minimum
- [ ] Spacing between buttons ≥8px
- [ ] No "fat finger" errors (accidental button presses)

#### Test Cases:
- [ ] **Button Pressing**:
  - [ ] Can tap center of button easily
  - [ ] Can tap near edge of button
  - [ ] 44px buttons don't overlap
  - [ ] Label text centered and readable

- [ ] **Gesture Recognition**:
  - [ ] Pinch-to-zoom:
    - [ ] Minimum pinch distance detected (50px)
    - [ ] Smooth zoom response
    - [ ] Detects zoom direction correctly
    - [ ] Works with 2-finger movement

  - [ ] Swipe gesture:
    - [ ] Minimum swipe distance (30px)
    - [ ] Correct direction detection
    - [ ] No accidental swipes on scrolling
    - [ ] Works left/right/up/down appropriately

  - [ ] Long-press:
    - [ ] 500ms+ press recognized
    - [ ] Visual feedback during press
    - [ ] No accidental triggers during scrolling

  - [ ] Double-tap:
    - [ ] Both taps registered
    - [ ] Within 300ms time window
    - [ ] Correct location detection
    - [ ] No interference with single-tap

- [ ] **Edge Cases**:
  - [ ] Gesture during page scroll (shouldn't trigger)
  - [ ] Multi-touch conflicts (pinch while scrolling)
  - [ ] Rapid gestures (multiple swipes in succession)
  - [ ] Gestures near page edges
  - [ ] Gestures in modals vs main content
  - [ ] Gesture with accidental movement (shaky hand)

#### Accessibility Testing:
- [ ] Can use app with one hand only
- [ ] Can reach all buttons on 6" phone
- [ ] Can see all text without zooming
- [ ] Color contrast ratios meet WCAG AA (4.5:1)
- [ ] Interactive elements have focus states

#### Test Report Template:
```markdown
## Touch Accuracy Report

### Button Sizing
- [ ] Color Matcher buttons: All ≥44px
- [ ] Harmony Explorer buttons: All ≥44px
- [etc...]

### Gesture Recognition
- [ ] Pinch-to-zoom sensitivity: Good/Fair/Poor
  - Notes:
- [ ] Swipe detection: Good/Fair/Poor
  - Notes:
[etc...]

### Edge Cases Found
- [ ] Issue 1
- [ ] Issue 2

### Devices Tested
-
```

#### Success Criteria:
- [ ] 100% of buttons are ≥44×44px
- [ ] All gestures recognized reliably
- [ ] No accidental gesture triggers
- [ ] Smooth touch feedback
- [ ] Edge cases handled gracefully

---

### PHASE 8.4: PWA Testing
**Testing Scope**: Installation, offline mode, manifest, icons

#### Installation Testing:
- [ ] **iOS**:
  - [ ] "Add to Home Screen" option available
  - [ ] App installs without errors
  - [ ] App icon appears on home screen
  - [ ] App name is correct
  - [ ] Launch from icon works
  - [ ] Splash screen appears (during launch)

- [ ] **Android**:
  - [ ] "Install app" prompt appears
  - [ ] App installs from Chrome prompt
  - [ ] App icon appears on home screen
  - [ ] App name is correct
  - [ ] Launch from icon works
  - [ ] Splash screen appears

#### Offline Testing:
- [ ] Install app on device
- [ ] Load all tools
- [ ] Disconnect internet (Airplane mode)
- [ ] Test cached content:
  - [ ] All HTML loads
  - [ ] All CSS loads
  - [ ] All JS loads
  - [ ] dye colors database loads
  - [ ] Images/icons load

- [ ] Test offline limitations:
  - [ ] Market board prices disabled
  - [ ] Show appropriate "offline" indicator
  - [ ] Warn user that prices unavailable
  - [ ] Core functionality still works

#### Manifest Testing:
- [ ] Validate manifest.json with tools:
  - [ ] https://manifest-validator.appspot.com/
  - [ ] Chrome DevTools Application → Manifest

- [ ] Check manifest fields:
  - [ ] `name`: "XIV Dye Tools"
  - [ ] `short_name`: "Dye Tools"
  - [ ] `start_url`: "/index.html"
  - [ ] `display`: "standalone"
  - [ ] `theme_color`: "#4f46e5"
  - [ ] `background_color`: "#ffffff"
  - [ ] Icons array has 192x192 and 512x512
  - [ ] Icons are valid PNG files

#### Icon Testing:
- [ ] Icons display on home screen
- [ ] Icons display as splash screen
- [ ] Icons are sharp and recognizable
- [ ] Icons work at all sizes
- [ ] Icons work on light and dark backgrounds
- [ ] Maskable icons render correctly

#### Service Worker Testing:
- [ ] Service Worker registers (no console errors)
- [ ] Check DevTools → Application → Service Workers
- [ ] Service Worker shows as "active and running"

- [ ] Offline cache validation:
  - [ ] Offline page works
  - [ ] Cached files load
  - [ ] API calls fall back gracefully
  - [ ] Old cache cleared on update

- [ ] Cache testing:
  - [ ] Open app
  - [ ] DevTools → Application → Cache Storage
  - [ ] Verify `xiv-dye-tools-v2` cache exists
  - [ ] Check cached files (HTML, CSS, JS, JSON)
  - [ ] Modify tool and reload
  - [ ] Old cache is replaced

#### Test Report Template:
```markdown
## PWA Testing Report

### Installation
- [ ] iOS installation: ✅/⚠️/❌
- [ ] Android installation: ✅/⚠️/❌
- [ ] App icon display: ✅/⚠️/❌
- [ ] Splash screen: ✅/⚠️/❌

### Offline
- [ ] Works offline: ✅/⚠️/❌
- [ ] All core files cached: ✅/⚠️/❌
- [ ] API gracefully fails: ✅/⚠️/❌
- [ ] Data persists offline: ✅/⚠️/❌

### Manifest
- [ ] Valid JSON: ✅/⚠️/❌
- [ ] All required fields: ✅/⚠️/❌
- [ ] Icons valid: ✅/⚠️/❌

### Service Worker
- [ ] Registers without error: ✅/⚠️/❌
- [ ] Shows active and running: ✅/⚠️/❌
- [ ] Cache strategy works: ✅/⚠️/❌

### Issues Found
-
```

#### Success Criteria:
- [ ] App installs on iOS and Android
- [ ] App works offline with cached content
- [ ] Manifest passes validation
- [ ] Icons display correctly
- [ ] Service Worker registers and caches files
- [ ] Old cache cleared on update

---

## Phase 9: Release & Documentation

Final polish, documentation, and v2.0.0 release.

### PHASE 9.1: Update CLAUDE.md with Mobile Testing Checklist
**File**: `CLAUDE.md`

#### Changes Required:
- [ ] Add new section: "## Mobile Testing & PWA Features"
  - [ ] Add mobile device list (iOS, Android models tested)
  - [ ] Add mobile testing checklist
  - [ ] Add PWA installation instructions for users
  - [ ] Add offline mode documentation
  - [ ] Add troubleshooting for mobile issues

- [ ] Add new section: "## Mobile Responsive Breakpoints"
  - [ ] Document breakpoints at 375px, 640px, 768px, 1024px, 1920px
  - [ ] Explain grid/layout changes at each breakpoint
  - [ ] Document touch target sizing standards
  - [ ] Document gesture support

- [ ] Add new section: "## Touch Gesture Documentation"
  - [ ] Pinch-to-zoom (Color Matcher, Dye Comparison, Harmony Explorer)
  - [ ] Swipe-to-change (Harmony, Accessibility)
  - [ ] Swipe-to-close (modals)
  - [ ] Long-press (Dye Mixer)
  - [ ] Haptic feedback triggers

- [ ] Add mobile-specific development guidance:
  - [ ] How to test on real devices
  - [ ] Chrome DevTools mobile emulation settings
  - [ ] Performance debugging on mobile
  - [ ] Common mobile issues and solutions

#### Example Sections to Add:
```markdown
## Mobile Optimization (v2.0.0)

### Device Support
- iOS 12+ (Safari, Chrome)
- Android 5+ (Chrome, Firefox)
- Tablets: iPad, Samsung Galaxy, Google Pixel Tablet
- Screen sizes: 375px to 1920px+

### Touch Gestures
- **Pinch-to-Zoom**: Color Matcher image, Dye Comparison charts, Color Harmony wheel
- **Swipe Left/Right**: Change harmony type (Explorer), change vision type (Accessibility)
- **Swipe Down**: Close modals and dialogs
- **Double-Tap**: Zoom to fit (Color Matcher), reset zoom
- **Long-Press**: Save gradient (Dye Mixer)

### Responsive Breakpoints
| Breakpoint | Devices | Layout |
|---|---|---|
| 375px | Mobile | 1-column, stacked |
| 640px | Tablet small | 1-2 column |
| 768px | Tablet | 2-column layout |
| 1024px | Desktop | Full layout |
| 1920px | Large desktop | Centered, max-width |

### PWA Features
- Install on home screen (iOS & Android)
- Works offline with cached data
- Sync with Universalis API when online
- Push notifications (future)
```

#### Success Criteria:
- [ ] CLAUDE.md updated with mobile sections
- [ ] All mobile features documented
- [ ] Testing checklist included
- [ ] Device compatibility list included
- [ ] Troubleshooting added

---

### PHASE 9.2: Update README.md with Mobile Features
**File**: `README.md`

#### Changes Required:
- [ ] Add new section: "## Mobile Experience"
  - [ ] Highlight mobile-first design
  - [ ] Mention touch gestures
  - [ ] Mention PWA installation
  - [ ] Include mobile screenshots (2-3 key features)

- [ ] Update features list:
  - [ ] Add "📱 Fully responsive (375px - 1920px+)"
  - [ ] Add "👆 Touch optimized with gestures"
  - [ ] Add "📦 Installable as PWA"
  - [ ] Add "🔌 Works offline (cached data)"

- [ ] Add installation instructions:
  - [ ] iOS: "Add to Home Screen" (3 steps with screenshots)
  - [ ] Android: "Install app" prompt (2 steps with screenshots)
  - [ ] Mention splash screen and offline usage

- [ ] Add mobile screenshots:
  - [ ] Color Matcher on iPhone (portrait)
  - [ ] Harmony Explorer on iPad (landscape)
  - [ ] Accessibility Checker mobile view
  - [ ] Any other visually distinctive tool

#### Example Markdown:
```markdown
## 📱 Mobile Experience

XIV Dye Tools is fully optimized for mobile and tablet devices with:
- **Responsive Design**: Adapts perfectly from 375px phones to 1920px+ desktop
- **Touch Gestures**: Pinch-to-zoom, swipe navigation, long-press actions
- **Installable**: Add to home screen on iOS and Android
- **Offline Support**: Use cached data when internet unavailable
- **Performance**: Optimized for 4G/3G networks and low-end devices

### Install as App
**iOS (Safari):**
1. Tap Share button
2. Select "Add to Home Screen"
3. Tap "Add"

**Android (Chrome):**
1. Tap menu (⋮) → "Install app"
2. Tap "Install"

### Mobile Screenshots
[Include 2-3 screenshots showing mobile UI]
```

#### Success Criteria:
- [ ] README.md mentions mobile features prominently
- [ ] Installation instructions included
- [ ] Mobile screenshots added
- [ ] PWA benefits highlighted
- [ ] Responsive design called out

---

### PHASE 9.3: Update CHANGELOG.md with v2.0.0 Release Notes
**File**: `CHANGELOG.md`

#### Changes Required:
- [ ] Add section at top:
```markdown
## v2.0.0 - [Release Date]

### Major Features
- 🎯 **Complete Mobile Optimization** (NEW)
  - Fully responsive design (375px - 1920px+)
  - Touch-optimized with 44×44px button targets
  - Touch gestures: pinch-zoom, swipe navigation, long-press

- 📦 **Progressive Web App** (NEW)
  - Installable on iOS and Android home screens
  - Offline support with service worker caching
  - Splash screen and app icons

- ⚡ **Performance Improvements**
  - Canvas resolution optimization on mobile (4x memory reduction)
  - Eyedropper debouncing (100-300ms on mobile)
  - Computation debouncing for color calculations
  - Lazy loading and asset optimization

### New Features
- Camera input support for Color Matcher (iOS/Android)
- Swipe-to-change gestures for Harmony Explorer and Accessibility Checker
- Pinch-to-zoom for Color Harmony and Dye Comparison charts
- Swipe-to-close for all modals
- Bottom navigation bar for mobile
- Mobile-specific help/tutorial system
- Keyboard optimization for mobile input

### Improvements
- Responsive layouts at 6 breakpoints (375px, 640px, 768px, 1024px, 1920px+)
- Device detection and mobile-specific optimizations
- Haptic feedback for touch gestures
- Orientation-aware layouts (portrait/landscape)
- Accessibility improvements (color contrast, ARIA labels)
- Device testing on 10+ iOS and Android devices

### Bug Fixes
- Fixed responsive behavior on tablets
- Improved touch target spacing
- Fixed modal closing on mobile
- Improved gesture recognition accuracy

### Under the Hood
- Added 600+ lines of mobile utilities (device detection, TouchGestureManager)
- Added 200+ lines of mobile CSS framework
- Implemented service worker for offline caching
- Created PWA manifest configuration
- Added comprehensive mobile testing suite

### Deprecations
- Legacy dark mode toggle (replaced with unified 10-theme system)
- Desktop-only component behavior (now responsive)

### Browser Support
- iOS 12+ (Safari, Chrome)
- Android 5+ (Chrome, Firefox)
- Desktop: All modern browsers (Chrome, Firefox, Safari, Edge)

### Migration Notes
- No breaking changes for existing users
- New PWA features are opt-in
- localStorage key format unchanged
- API integration unchanged

### Known Issues
- (None for mobile at this time)

### Testing
- ✅ Tested on 12+ device models
- ✅ Cross-browser testing (iOS/Android)
- ✅ Performance testing (Lighthouse ≥85)
- ✅ Offline functionality verified
- ✅ Touch gesture accuracy testing
- ✅ PWA installation testing

### Next Phase
- Phase 4-9 items tracked in TODO.md
- Future: Mobile bottom sheet navigation
- Future: Voice control for accessibility
- Future: Shared gradient sync across devices
```

#### Also Update:
- [ ] Update version number at top of file to v2.0.0
- [ ] Update release date
- [ ] Include commit hash: 935ac9d
- [ ] Add GitHub release link (if applicable)

#### Success Criteria:
- [ ] CHANGELOG.md has comprehensive v2.0.0 section
- [ ] Major features highlighted
- [ ] All mobile improvements documented
- [ ] Testing results included
- [ ] Migration notes clear (if any)

---

### PHASE 9.4: Bump All Tool Versions to v2.0.0
**Files**: All 5 experimental tool files + index.html

#### Changes Required:
- [ ] Update version in `coloraccessibility_experimental.html`:
  - [ ] Line ~469: `v1.5.1` → `v2.0.0`
  - [ ] Verify in all occurrences (header, comments, etc.)

- [ ] Update version in `colorexplorer_experimental.html`:
  - [ ] Line ~221: `v1.5.1` → `v2.0.0`

- [ ] Update version in `colormatcher_experimental.html`:
  - [ ] Line ~469: `v1.5.1` → `v2.0.0`

- [ ] Update version in `dyecomparison_experimental.html`:
  - [ ] Line ~106: `v1.5.1` → `v2.0.0`

- [ ] Update version in `dye-mixer_experimental.html`:
  - [ ] Line ~534: `v1.5.1` → `v2.0.0`

- [ ] Update version in `index.html`:
  - [ ] All 5 tool cards: `v1.5.1` → `v2.0.0`
  - [ ] Update description: Add "Mobile optimized" or "PWA ready"

- [ ] Update `package.json`:
  - [ ] `"version": "1.5.1"` → `"version": "2.0.0"`

#### Verification:
- [ ] Search for "1.5.1" - should find 0 results
- [ ] Search for "2.0.0" - should find 6+ results (5 tools + index + package)
- [ ] Verify no version strings were accidentally changed elsewhere

#### Success Criteria:
- [ ] All 5 tools show v2.0.0
- [ ] Index.html shows v2.0.0
- [ ] package.json shows v2.0.0
- [ ] No v1.5.1 references remain
- [ ] No breaking changes introduced

---

### PHASE 9.5: Sync All Experimental Files to Stable
**Files**: All 5 experimental → stable pairs

#### Changes Required:
- [ ] Copy experimental → stable for each tool:
  ```bash
  # Windows PowerShell or Command Prompt
  copy coloraccessibility_experimental.html coloraccessibility_stable.html
  copy colorexplorer_experimental.html colorexplorer_stable.html
  copy colormatcher_experimental.html colormatcher_stable.html
  copy dyecomparison_experimental.html dyecomparison_stable.html
  copy dye-mixer_experimental.html dye-mixer_stable.html
  ```

- [ ] Verify all files copied successfully:
  - [ ] Check file sizes match
  - [ ] Check modification times are recent
  - [ ] Spot-check content (open in editor, verify v2.0.0)

#### Final Testing Before Release:
- [ ] Open each stable tool in browser
- [ ] Verify version shows v2.0.0
- [ ] Test basic functionality
- [ ] Check responsive design at 375px
- [ ] Verify touch targets are large
- [ ] Test one gesture (pinch, swipe, etc.)

#### Commit Final Sync:
```bash
git add coloraccessibility_stable.html \
        colorexplorer_stable.html \
        colormatcher_stable.html \
        dyecomparison_stable.html \
        dye-mixer_stable.html \
        index.html \
        package.json \
        CHANGELOG.md \
        README.md \
        CLAUDE.md

git commit -m "Release: v2.0.0 - Mobile Optimization Complete

[Full release notes here]"

git tag -a v2.0.0 -m "v2.0.0: Mobile Optimization Release"
```

#### Success Criteria:
- [ ] All 5 stable files are current (match experimental)
- [ ] Version number is v2.0.0 in all files
- [ ] No experimental files accidentally synced with old data
- [ ] All tests pass on stable builds
- [ ] Git tag created for v2.0.0 release

---

## Summary of Remaining Work

### By Phase:
- **Phase 4** (4 tasks): ~2-4 hours
  - Camera integration (30 min)
  - PWA manifest (1 hour)
  - Service worker (1-2 hours)
  - App icons (1 hour)

- **Phase 5** (3 tasks): ~3-4 hours
  - Canvas optimization (1 hour)
  - Eyedropper optimization (1 hour)
  - Debouncing (1-2 hours)

- **Phase 6** (4 tasks): ~4-5 hours
  - Swipe gestures × 2 (2 hours)
  - Pinch-zoom (1.5 hours)
  - Modal swipe-close (1 hour)

- **Phase 7** (3 tasks): ~3-4 hours
  - Mobile tutorial (1.5 hours)
  - Bottom nav (1 hour)
  - Keyboard optimization (1-1.5 hours)

- **Phase 8** (4 tasks): ~8-12 hours (testing intensive)
  - Device testing (4-6 hours)
  - Performance testing (2-3 hours)
  - Touch testing (1-2 hours)
  - PWA testing (1-2 hours)

- **Phase 9** (5 tasks): ~2-3 hours
  - Documentation updates (1.5 hours)
  - Version bumps (30 min)
  - File syncing (30 min)

### Total Estimated Time:
**25-32 hours of development** | **Phases 4-9**

### Priority Order:
1. **Phase 4** (PWA essentials - enables installation)
2. **Phase 5** (Performance - critical for mobile)
3. **Phase 6** (UX features - adds value)
4. **Phase 7** (Polish - improves experience)
5. **Phase 8** (Testing - ensures quality)
6. **Phase 9** (Release - makes it official)

---

## Notes for Development

### Development Best Practices:
- [ ] Test on real mobile device frequently, not just emulation
- [ ] Use Chrome DevTools mobile emulation for quick iterations
- [ ] Test touch gestures on actual devices
- [ ] Verify offline functionality works
- [ ] Check memory and CPU usage during gameplay
- [ ] Commit after each phase completion
- [ ] Keep experimental and stable in sync during development

### Common Issues to Watch For:
- [ ] Service worker caching old files (use versioning)
- [ ] iOS Safari quirks (test on real device)
- [ ] Gesture detection false positives (test edge cases)
- [ ] Memory leaks in canvas operations
- [ ] Touch events conflicting with scroll
- [ ] Modal z-index stacking issues
- [ ] Keyboard appearing over input fields

### Testing Tools to Use:
- Chrome DevTools (built-in)
- Lighthouse (built-in to DevTools)
- BrowserStack (device testing) or local devices
- WebPageTest.org (performance analysis)
- WAVE WebAIM (accessibility)
- PWA validator (manifest validation)

---

**Last Updated**: After Phase 3 Commit (935ac9d)
**Next Review**: After Phase 4 Completion
