# XIV Dye Tools v4.0 Testing Checklist

This document provides a comprehensive testing checklist for validating the v4.0 UI migration. Tests are organized by category and priority.

---

## Quick Reference

| Category | Tests | Priority |
|----------|-------|----------|
| [Unit Tests](#1-unit-tests) | 45 | P0 |
| [Integration Tests](#2-integration-tests) | 28 | P0 |
| [Visual Regression](#3-visual-regression-tests) | 33 | P1 |
| [Accessibility](#4-accessibility-tests) | 24 | P0 |
| [Cross-Browser](#5-cross-browser-tests) | 15 | P1 |
| [Performance](#6-performance-tests) | 12 | P2 |
| [Mobile/Responsive](#7-mobileresponsive-tests) | 18 | P1 |
| [E2E User Flows](#8-e2e-user-flow-tests) | 20 | P0 |

**Priority Legend:**
- **P0**: Must pass before release (blocking)
- **P1**: Should pass before release (high priority)
- **P2**: Nice to have (can be addressed post-release)

---

## 1. Unit Tests

### 1.1 Layout Components

#### V4LayoutShell
- [ ] Renders header, tool banner, sidebar, and content areas
- [ ] Accepts `initialTool` prop and sets active state
- [ ] Calls `onToolChange` when tool selection changes
- [ ] Handles sidebar collapse/expand state
- [ ] Cleans up event listeners on destroy

#### V4AppHeader
- [ ] Renders logo and app title
- [ ] Renders theme, language, settings buttons
- [ ] Emits events on button clicks
- [ ] Applies correct text color based on header background

#### ToolBanner
- [ ] Renders all 9 tool buttons
- [ ] Highlights active tool with underline indicator
- [ ] Emits navigation event on tool click
- [ ] Supports keyboard navigation (Tab, Enter, Arrow keys)
- [ ] Scrolls horizontally when tools overflow

#### ConfigSidebar
- [ ] Renders tool-specific configuration sections
- [ ] Toggles collapse state on button click
- [ ] Persists collapsed state to storage
- [ ] Animates open/close transition

### 1.2 Shared Components

#### ResultCard
- [ ] Renders dye name in header
- [ ] Displays split color preview (original/match)
- [ ] Shows technical data (ΔE, HEX, RGB)
- [ ] Shows acquisition data (source, market, price)
- [ ] Opens context menu on kebab click
- [ ] Calls `onSelect` when primary action clicked
- [ ] Applies correct ΔE color coding (green/yellow/red)

#### GlassPanel
- [ ] Applies glassmorphism styles
- [ ] Supports collapsible mode
- [ ] Renders title and content slots
- [ ] Falls back gracefully without backdrop-filter

#### ContextMenuDropdown
- [ ] Opens on trigger click
- [ ] Closes on outside click
- [ ] Closes on Escape key
- [ ] Renders menu items with icons
- [ ] Emits action event on item click
- [ ] Positions correctly (doesn't overflow viewport)

#### ToggleSwitchV4
- [ ] Renders on/off states correctly
- [ ] Toggles state on click
- [ ] Emits change event with new value
- [ ] Supports disabled state
- [ ] Has accessible label

### 1.3 Tool Components

#### ExtractorTool (renamed from MatcherTool)
- [ ] Class renamed to `ExtractorTool`
- [ ] All internal references updated
- [ ] Existing functionality preserved
- [ ] Uses ResultCard for output

#### GradientTool (renamed from MixerTool)
- [ ] Class renamed to `GradientTool`
- [ ] All internal references updated
- [ ] Existing functionality preserved
- [ ] Uses ResultCard for output

#### SwatchTool (renamed from CharacterTool)
- [ ] Class renamed to `SwatchTool`
- [ ] All internal references updated
- [ ] Existing functionality preserved
- [ ] Uses ResultCard for output

#### DyeMixerTool (NEW)
- [ ] Renders two input dye slots
- [ ] Renders result slot
- [ ] Accepts dye drag/drop or click-to-select
- [ ] Computes blended color from inputs
- [ ] Displays matching dyes in ResultCard grid
- [ ] Handles empty slot states

### 1.4 Services

#### RouterService
- [ ] `ToolId` type includes all 9 tools
- [ ] `navigateTo()` works for all new routes
- [ ] `getCurrentToolId()` returns correct value
- [ ] Query parameters preserved on navigation
- [ ] Browser history updated correctly

#### ThemeService
- [ ] `ThemePalette` interface includes v4 properties
- [ ] `applyTheme()` sets all v4 CSS variables
- [ ] All 11 themes apply without errors
- [ ] Glassmorphism variables computed correctly

#### StorageService
- [ ] v3 → v4 key migration runs on first load
- [ ] Migration only runs once (flag set)
- [ ] Old keys properly renamed
- [ ] Data integrity preserved after migration

---

## 2. Integration Tests

### 2.1 Layout Integration

- [ ] V4LayoutShell integrates with RouterService
- [ ] Tool changes update URL and content area
- [ ] Sidebar config changes when tool changes
- [ ] Mobile drawer opens/closes correctly
- [ ] Layout responds to viewport resize

### 2.2 Tool Loading

- [ ] Harmony Explorer loads via `/harmony`
- [ ] Palette Extractor loads via `/extractor`
- [ ] Accessibility Checker loads via `/accessibility`
- [ ] Dye Comparison loads via `/comparison`
- [ ] Gradient Builder loads via `/gradient`
- [ ] Dye Mixer loads via `/mixer`
- [ ] Community Presets loads via `/presets`
- [ ] Budget Suggestions loads via `/budget`
- [ ] Swatch Matcher loads via `/swatch`

### 2.3 Theme Integration

- [ ] Theme changes apply to all visible components
- [ ] Glassmorphism renders correctly in all themes
- [ ] High contrast themes disable blur effects
- [ ] Theme persists across page refresh
- [ ] Theme applies on initial load (no flash)

### 2.4 Cross-Tool Workflows

- [ ] "Add to Comparison" from Harmony → opens Comparison
- [ ] "Add to Mixer" from ResultCard → opens Dye Mixer
- [ ] "See Harmonies" context action → opens Harmony with dye
- [ ] "Budget Suggestions" context action → opens Budget with dye
- [ ] Share link opens correct tool with correct state

### 2.5 Data Flow

- [ ] Dye selection in sidebar updates tool state
- [ ] Market data fetches and displays correctly
- [ ] Color calculations produce correct results
- [ ] Favorites persist across sessions
- [ ] Collections sync with storage

---

## 3. Visual Regression Tests

### 3.1 Per-Theme Screenshots

Capture and compare screenshots for each of the 11 themes:

#### Standard Light
- [ ] App header appearance
- [ ] Tool banner appearance
- [ ] Config sidebar appearance
- [ ] ResultCard appearance
- [ ] Glass panel appearance

#### Standard Dark
- [ ] App header appearance
- [ ] Tool banner appearance
- [ ] Config sidebar appearance
- [ ] ResultCard appearance
- [ ] Glass panel appearance

#### Hydaelyn Light
- [ ] App header appearance
- [ ] Tool banner appearance
- [ ] Config sidebar appearance
- [ ] ResultCard appearance
- [ ] Glass panel appearance

#### OG Classic Dark
- [ ] App header appearance
- [ ] Glass panel on deep blue background
- [ ] High contrast borders visible

#### Parchment Light
- [ ] Warm color scheme applied
- [ ] Brown text on cream background readable

#### Cotton Candy
- [ ] Pink accents visible
- [ ] Soft pastel appearance

#### Sugar Riot
- [ ] Hot pink accents visible
- [ ] Dark background with neon glow

#### Grayscale Light
- [ ] No color hues present
- [ ] Sufficient contrast

#### Grayscale Dark
- [ ] No color hues present
- [ ] Sufficient contrast

#### High Contrast Light
- [ ] Black borders visible
- [ ] No glassmorphism blur
- [ ] Maximum contrast achieved

#### High Contrast Dark
- [ ] Yellow on black visible
- [ ] No glassmorphism blur
- [ ] Maximum contrast achieved

### 3.2 Component States

- [ ] Button hover states
- [ ] Button active/pressed states
- [ ] Button disabled states
- [ ] Toggle switch on/off states
- [ ] Input focus states
- [ ] Card hover states
- [ ] Context menu open state
- [ ] Modal overlay appearance

---

## 4. Accessibility Tests

### 4.1 Keyboard Navigation

- [ ] Tab order follows logical reading order
- [ ] All interactive elements focusable
- [ ] Focus indicator visible in all themes
- [ ] Focus indicator visible in high contrast themes (3px+)
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals and menus
- [ ] Arrow keys navigate tool banner
- [ ] Skip link available (to main content)

### 4.2 Screen Reader

- [ ] App header has landmark role
- [ ] Tool banner has navigation landmark
- [ ] Main content has main landmark
- [ ] Sidebar has complementary/aside role
- [ ] Tool changes announced
- [ ] Modal open/close announced
- [ ] Error states announced
- [ ] Loading states announced

### 4.3 Color & Contrast

- [ ] All text meets WCAG AA (4.5:1 for normal, 3:1 for large)
- [ ] High contrast themes meet WCAG AAA (7:1)
- [ ] Focus indicators have 3:1 contrast
- [ ] Interactive elements distinguishable without color
- [ ] Error states have icon + text (not color alone)

### 4.4 Motion & Animation

- [ ] Animations respect `prefers-reduced-motion`
- [ ] No flashing content (3 flashes/second rule)
- [ ] Glassmorphism blur doesn't cause motion sickness
- [ ] Transitions are subtle (< 300ms)

### 4.5 Assistive Technology

- [ ] Works with NVDA (Windows)
- [ ] Works with VoiceOver (macOS)
- [ ] Works with VoiceOver (iOS)
- [ ] Works with TalkBack (Android)
- [ ] Windows High Contrast Mode supported

---

## 5. Cross-Browser Tests

### 5.1 Desktop Browsers

| Browser | Version | Tests |
|---------|---------|-------|
| Chrome | Latest | All P0 tests |
| Firefox | Latest | All P0 tests |
| Safari | Latest | All P0 tests |
| Edge | Latest | All P0 tests |

#### Per-Browser Checks
- [ ] Layout renders correctly
- [ ] Glassmorphism blur works (or fallback)
- [ ] CSS variables applied
- [ ] Fonts load correctly
- [ ] Animations smooth
- [ ] No console errors

### 5.2 Safari-Specific

- [ ] `-webkit-backdrop-filter` works
- [ ] Color picker input works
- [ ] Smooth scrolling works
- [ ] Touch events work (if on touch device)

### 5.3 Firefox-Specific

- [ ] `backdrop-filter` supported (Firefox 103+)
- [ ] Fallback works for older Firefox
- [ ] Range slider styling correct

---

## 6. Performance Tests

### 6.1 Load Performance

- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] First Input Delay < 100ms

### 6.2 Runtime Performance

- [ ] Theme switch < 100ms
- [ ] Tool switch < 200ms (excluding lazy load)
- [ ] Lazy load chunk < 500ms
- [ ] Scroll performance 60fps
- [ ] Animation performance 60fps

### 6.3 Memory

- [ ] No memory leaks on tool switch
- [ ] No memory leaks on theme switch
- [ ] Memory stable after 10 tool switches
- [ ] Event listeners cleaned up properly
- [ ] No detached DOM nodes

### 6.4 Bundle Size

- [ ] Main bundle < 200KB (gzipped)
- [ ] Per-tool chunk < 50KB (gzipped)
- [ ] CSS < 50KB (gzipped)
- [ ] Total initial load < 300KB (gzipped)

---

## 7. Mobile/Responsive Tests

### 7.1 Breakpoint Behavior

#### Desktop (> 1100px)
- [ ] Full sidebar visible
- [ ] Tool banner shows all tools
- [ ] Multi-column result grid

#### Tablet (768px - 1100px)
- [ ] Sidebar collapsible
- [ ] Tool banner may scroll
- [ ] 2-column result grid

#### Mobile (< 768px)
- [ ] Sidebar becomes drawer overlay
- [ ] Tool banner horizontal scroll
- [ ] Single-column result grid
- [ ] Touch-friendly tap targets (44x44px min)

### 7.2 Touch Interactions

- [ ] Tap on tool button navigates
- [ ] Swipe to scroll tool banner
- [ ] Tap outside drawer closes it
- [ ] Long-press shows context menu (if applicable)
- [ ] Pinch-to-zoom disabled on app (optional)

### 7.3 Orientation

- [ ] Portrait mode renders correctly
- [ ] Landscape mode renders correctly
- [ ] Orientation change doesn't break layout

### 7.4 Device Testing

| Device | OS | Screen Size |
|--------|-----|-------------|
| iPhone SE | iOS | 375px |
| iPhone 14 Pro | iOS | 393px |
| iPad | iPadOS | 768px |
| Samsung Galaxy S21 | Android | 360px |
| Pixel 7 | Android | 412px |

---

## 8. E2E User Flow Tests

### 8.1 First-Time User

- [ ] App loads without errors
- [ ] Welcome modal appears (if enabled)
- [ ] Default theme applied correctly
- [ ] Default tool (Harmony) loads
- [ ] Tutorial hints appear (if enabled)

### 8.2 Harmony Explorer Flow

- [ ] Select a dye from sidebar
- [ ] Harmony ring updates
- [ ] Result cards display
- [ ] Click "Select Dye" on result
- [ ] New harmony calculated from selected dye
- [ ] Context menu opens on kebab click
- [ ] "Add to Comparison" navigates correctly

### 8.3 Palette Extractor Flow

- [ ] Navigate to `/extractor`
- [ ] Upload an image (drag-drop or click)
- [ ] Palette extraction runs
- [ ] Results display in ResultCard grid
- [ ] Zoom controls work
- [ ] Clear image and upload new one

### 8.4 Gradient Builder Flow

- [ ] Navigate to `/gradient`
- [ ] Select start dye
- [ ] Select end dye
- [ ] Gradient steps display
- [ ] Adjust step count slider
- [ ] Results update
- [ ] Change interpolation method

### 8.5 Dye Mixer Flow (NEW)

- [ ] Navigate to `/mixer`
- [ ] Add dye to first slot
- [ ] Add dye to second slot
- [ ] Blended result appears
- [ ] Matching dyes display
- [ ] Clear slots and try again

### 8.6 Theme Switching Flow

- [ ] Open theme selector
- [ ] Switch to each of 11 themes
- [ ] Verify UI updates correctly
- [ ] Close and reopen app
- [ ] Theme persists

### 8.7 Community Presets Flow

- [ ] Navigate to `/presets`
- [ ] Browse preset grid
- [ ] Click preset to open detail modal
- [ ] View dye cards in modal
- [ ] Close modal
- [ ] Filter by category
- [ ] Sort by popularity

### 8.8 Budget Suggestions Flow

- [ ] Navigate to `/budget`
- [ ] Select an expensive dye (Jet Black)
- [ ] Alternatives display with savings
- [ ] Adjust price threshold
- [ ] Results update
- [ ] Click "Quick Pick" button

### 8.9 Deep Linking

> **Note:** Deep links use item IDs instead of dye names for locale-agnostic sharing.
> Example IDs: Jet Black = `13115`, Wine Red = `5740`, Pure White = `13116`

- [ ] `/harmony?dye=13115&type=Tetradic` loads with Jet Black selected and Tetradic harmony
- [ ] `/extractor` loads extractor tool
- [ ] `/gradient?start=5740&end=13115` loads with Wine Red → Jet Black gradient
- [ ] `/mixer?slot1=13115&slot2=13116` loads Dye Mixer with slots filled
- [ ] `/swatch?sheet=eyes&race=hyur&gender=female` loads Swatch Matcher with filters
- [ ] Invalid dye ID shows graceful error (not crash)
- [ ] Invalid route redirects to default

### 8.10 Error Handling

- [ ] Network error shows toast notification
- [ ] Invalid dye name handled gracefully
- [ ] Image upload failure shows error
- [ ] API timeout handled with retry option

---

## 9. Regression Checklist

### 9.1 Features That Must Not Break

- [ ] All 8 original tools functional
- [ ] Color calculations accurate
- [ ] Market data fetching works
- [ ] i18n translations load (all 6 languages)
- [ ] Favorites/collections persist
- [ ] Share links generate correctly
- [ ] Offline mode works (if PWA enabled)

### 9.2 Known v3 Issues to Verify Fixed

- [ ] (List any known v3 bugs that should be fixed in v4)

### 9.3 Data Migration

- [ ] User preferences migrate from v3
- [ ] Saved collections accessible
- [ ] Theme preference preserved
- [ ] Language preference preserved

---

## 10. Sign-Off Checklist

### Before Release

- [ ] All P0 tests passing
- [ ] All P1 tests passing (or documented exceptions)
- [ ] No critical accessibility violations
- [ ] Performance budgets met
- [ ] Cross-browser testing complete
- [ ] Mobile testing complete
- [ ] Changelog updated
- [ ] Release notes drafted

### Stakeholder Approval

- [ ] QA sign-off
- [ ] Design sign-off (visual match to prototypes)
- [ ] Product sign-off
- [ ] Accessibility sign-off

---

## Appendix: Test Commands

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E tests headed (visible browser)
npm run test:e2e -- --headed

# Accessibility audit (axe-core)
npm run test:a11y

# Visual regression (if configured)
npm run test:visual

# Bundle size check
npm run check-bundle-size

# Lighthouse audit
npx lighthouse http://localhost:5173 --view
```

---

## Appendix: Bug Report Template

When logging issues found during testing:

```markdown
**Test Case:** [Which checklist item]
**Browser/Device:** [e.g., Chrome 120 / Windows 11]
**Theme:** [e.g., Standard Dark]
**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**

**Actual Result:**

**Screenshots/Video:**

**Console Errors:**

**Priority:** P0 / P1 / P2
```
