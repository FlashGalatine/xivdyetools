# XIV Dye Tools v4 Foundation - TODO List

**Branch:** `v4/ui-migration`
**Last Updated:** 2026-01-10
**Status:** Phase 1-10 Complete (V4 Migration Complete!)

---

## Pre-Implementation

- [x] Create `v4/ui-migration` branch from main
- [x] Verify all tests pass on main: `npm run test -- --run`
- [x] Verify build succeeds: `npm run build`

---

## Phase 1: CSS Variables & Theme System ✅ COMPLETE

### 1.1 Type Definitions
- [x] Update `src/shared/types.ts` - Extend ThemePalette interface with v4 optional properties

### 1.2 CSS Variables
- [x] Update `src/styles/themes.css` - Add v4 CSS variables to `:root`
- [x] Create `src/styles/v4-utilities.css` - Glassmorphism utility classes
- [x] Import v4-utilities.css in main stylesheet

### 1.3 Theme Service
- [x] Update `src/services/theme-service.ts` - Add v4 properties to all 11 theme definitions
- [x] Update `applyTheme()` method to set v4 CSS custom properties
- [x] Add `disableBlur: true` to high-contrast themes

### 1.4 Verification
- [x] Run tests: `npm run test -- --run`
- [x] Manual check: All themes load without errors
- [x] Manual check: v4 CSS variables visible in browser dev tools

### 1.5 Commit
- [x] Commit: "feat(v4): Add CSS variable system for v4 themes"

---

## Phase 2: Router Service Updates ✅ COMPLETE

### 2.1 Router Types
- [x] Update `src/services/router-service.ts` - Change ToolId type (8 → 9 tools)
- [x] Update ROUTES array with new paths and titles
- [x] Add LEGACY_ROUTE_REDIRECTS constant
- [x] Update `handleInitialRoute()` to check legacy redirects

### 2.2 Verification (Types)
- [x] Run type-check: `npm run type-check`
- [x] Commit: "feat(v4): Update router service with new tool IDs and redirects"

### 2.3 Component Renames (preserve git history)
- [x] `git mv src/components/matcher-tool.ts src/components/extractor-tool.ts`
- [x] `git mv src/components/mixer-tool.ts src/components/gradient-tool.ts`
- [x] `git mv src/components/character-tool.ts src/components/swatch-tool.ts`
- [x] Commit: "feat(v4): Rename tool components for v4 naming convention"

### 2.4 Update Internal References
- [x] Update class name: `MatcherTool` → `ExtractorTool` in extractor-tool.ts
- [x] Update class name: `MixerTool` → `GradientTool` in gradient-tool.ts
- [x] Update class name: `CharacterTool` → `SwatchTool` in swatch-tool.ts
- [x] Update `src/components/v3-layout.ts` - Import paths and switch cases
- [x] Update component index exports (index.ts)

### 2.5 Create Placeholder Dye Mixer
- [x] Create `src/components/mixer-tool.ts` (NEW placeholder for Dye Mixer)
- [x] Add basic MixerTool class extending BaseComponent
- [x] Add placeholder UI: "Dye Mixer - Coming Soon"
- [x] Commit: "feat(v4): Add Dye Mixer tool placeholder"

### 2.6 Verification (Routes)
- [x] Run type-check: `npm run type-check`
- [X] Manual test: Navigate to `/matcher` → should redirect to `/extractor`
- [X] Manual test: Navigate to `/character` → should redirect to `/swatch`
- [X] Manual test: Navigate to `/mixer` → should load new Dye Mixer placeholder
- [X] Manual test: Navigate to `/gradient` → should load Gradient Builder (old Mixer)
- [X] Manual test: Browser back/forward navigation works

---

## Phase 3: Lit.js Setup ✅ COMPLETE

### 3.1 Dependencies
- [x] **NOTIFY USER:** Need to add `lit@^3.1.0` to package.json
- [x] Add lit to dependencies in package.json
- [x] Run `npm install`

### 3.2 TypeScript Configuration
- [x] Update `tsconfig.json` - Add `experimentalDecorators: true`
- [x] Update `tsconfig.json` - Add `useDefineForClassFields: false`
- [x] Add path alias: `"@v4/*": ["./src/components/v4/*"]`

### 3.3 Vite Configuration
- [x] Update `vite.config.ts` - Add `@v4` path alias

### 3.4 Create v4 Component Infrastructure
- [x] Create directory: `src/components/v4/`
- [x] Create `src/components/v4/base-lit-component.ts` - Base class for v4 Lit components
- [x] Create `src/components/v4/index.ts` - Barrel exports

### 3.5 Verification (Lit Setup)
- [x] Run build: `npm run build`
- [x] Verify Lit imports compile correctly
- [x] Verify v4 base component can be instantiated
- [x] Commit: "feat(v4): Add Lit.js infrastructure for component migration"

---

## Phase 4: Layout Components ✅ COMPLETE

### 4.1 Icons Update
- [x] Add `ICON_LOGO` - XIV Dye Tools branding icon
- [x] Add `ICON_GLOBE` - Language selector icon
- [x] Add `ICON_TOOL_DYE_MIXER` - New Dye Mixer tool icon
- [x] Update `TOOL_ICONS` map with v4 tool IDs (extractor, gradient, swatch, mixer)
- [x] Keep legacy aliases for backwards compatibility

### 4.2 V4AppHeader Component
- [x] Create `src/components/v4/v4-app-header.ts`
- [x] 48px header with logo, theme/language/about buttons
- [x] Events: `theme-click`, `language-click`, `about-click`
- [x] ARIA labels and focus-visible styles

### 4.3 ToolBanner Component
- [x] Create `src/components/v4/tool-banner.ts`
- [x] 64px horizontal navigation with 9 tool icons
- [x] Keyboard navigation (Arrow keys, Home, End)
- [x] Active state with gold accent and glow effect
- [x] Event: `tool-select` with `{toolId: ToolId}`

### 4.4 ConfigSidebar Component
- [x] Create `src/components/v4/config-sidebar.ts`
- [x] 320px glassmorphism sidebar
- [x] All-in-one approach: contains all 10 config sections
- [x] Show/hide sections based on `activeTool` property
- [x] Mobile slide-out drawer behavior
- [x] Config controls are visual placeholders (Phase 6 wiring)

### 4.5 V4LayoutShell Component
- [x] Create `src/components/v4/v4-layout-shell.ts`
- [x] Main orchestrator combining all layout pieces
- [x] MediaQueryList for responsive behavior
- [x] Mobile FAB for sidebar toggle
- [x] Slot for tool content

### 4.6 Layout CSS
- [x] Create `src/styles/v4-layout.css`
- [x] Global layout utilities
- [x] Theme-specific adjustments (light, high-contrast)
- [x] Print styles
- [x] Empty/loading state layouts

### 4.7 Exports
- [x] Update `src/components/v4/index.ts` - Export all Phase 4 components

### 4.8 Verification
- [x] Run type-check: `npm run type-check`
- [x] Run build: `npm run build`
- [ ] Manual test: Components render correctly
- [ ] Manual test: Tool banner navigation works
- [ ] Manual test: Sidebar collapse on mobile

---

## Phase 5: Shared Components ✅ COMPLETE

### 5.1 Icons Update
- [x] Add `ICON_CONTEXT_MENU` - Kebab menu icon for ResultCard context menus

### 5.2 GlassPanel Component
- [x] Create `src/components/v4/glass-panel.ts`
- [x] Three variants: default, card, sidebar
- [x] Four padding options: none, sm, md, lg
- [x] Optional heading with header slot override
- [x] Interactive mode with hover effects
- [x] Full theme integration via CSS variables

### 5.3 ToggleSwitchV4 Component
- [x] Create `src/components/v4/toggle-switch-v4.ts`
- [x] Smooth CSS transition animation
- [x] Full keyboard support (Space, Enter)
- [x] ARIA switch role with proper attributes
- [x] Disabled state handling
- [x] Hidden checkbox for form integration

### 5.4 RangeSliderV4 Component
- [x] Create `src/components/v4/range-slider-v4.ts`
- [x] Value display with custom formatter support
- [x] Filled track overlay showing current position
- [x] Native input element for accessibility
- [x] Separate input (drag) and change (release) events
- [x] Support for decimal steps

### 5.5 ResultCard Component
- [x] Create `src/components/v4/result-card.ts`
- [x] 320px fixed width for consistent layouts
- [x] Split color preview (Original vs Match)
- [x] Two-column details grid (Technical + Acquisition)
- [x] Delta-E color coding (5 levels)
- [x] Context menu with 6 standard actions
- [x] Selected state styling
- [x] Full keyboard accessibility

### 5.6 Exports
- [x] Update `src/components/v4/index.ts` - Export all Phase 5 components with types

### 5.7 Verification
- [x] Run type-check: `npm run type-check`
- [x] Run build: `npm run build`
- [ ] Manual test: Components render correctly
- [ ] Manual test: Theme switching works

---

## Phase 6: Tool Migration to Lit.js ✅ COMPLETE

### 6.1 Type Definitions
- [x] Create `src/shared/tool-config-types.ts` - Interfaces for all 10 tool configs
- [x] Add GlobalConfig, HarmonyConfig, ExtractorConfig, AccessibilityConfig
- [x] Add ComparisonConfig, GradientConfig, MixerConfig, PresetsConfig
- [x] Add BudgetConfig, SwatchConfig
- [x] Add DEFAULT_CONFIGS object with sensible defaults
- [x] Add type-safe helper functions (getDefaultConfig, isToolId)

### 6.2 ConfigController Service
- [x] Create `src/services/config-controller.ts` - Centralized state management
- [x] Singleton pattern for global access
- [x] Type-safe getConfig<K>() and setConfig<K>() methods
- [x] Subscription-based reactivity for tools to receive updates
- [x] Automatic persistence to localStorage with `v4_config_` prefix
- [x] Lazy-loading from storage on first access
- [x] Merge stored configs with defaults for migration safety
- [x] Export from `src/services/index.ts`

### 6.3 Wire ConfigSidebar Controls
- [x] Import ToggleSwitchV4 and RangeSliderV4 components
- [x] Add @state() properties for each tool's configuration
- [x] Replace placeholder HTML toggles with `<v4-toggle-switch>` components
- [x] Replace native range inputs with `<v4-range-slider>` components
- [x] Load initial config from ConfigController in connectedCallback
- [x] Emit config-change events on all control interactions
- [x] Add custom valueFormatter for Budget tool's price display

### 6.4 V4LayoutShell Event Forwarding
- [x] Add @config-change listener to ConfigSidebar element
- [x] Add handleConfigChange() method to re-emit events
- [x] Allows v4-layout.ts to receive config updates

### 6.5 V4 Layout Entry Point
- [x] Create `src/components/v4-layout.ts` - V4 layout initialization
- [x] Initialize RouterService and ConfigController
- [x] Create V4LayoutShell custom element dynamically
- [x] Listen for tool-change events and update router
- [x] Listen for config-change events and forward to active tool
- [x] Subscribe to route changes for browser back/forward
- [x] Lazy-load tools with same pattern as v3-layout.ts
- [x] Clean up resources in destroyV4Layout()

### 6.6 HarmonyTool setConfig() Integration
- [x] Add public setConfig() method to HarmonyTool
- [x] Handle harmonyType changes (regenerates harmonies)
- [x] Log display option changes for Phase 8 integration
- [x] Update harmony type button styles when changed externally

### 6.7 Main.ts V4 Toggle
- [x] Add feature flag check for V4 layout
- [x] Enable via URL: `?v4=true`
- [x] Enable via environment: `VITE_V4_LAYOUT=true`
- [x] Load initializeV4Layout() when flag is set
- [x] V4 layout lazily loaded as separate chunk

### 6.8 Verification
- [x] Run type-check: `npm run type-check`
- [x] Run build: `npm run build`
- [x] Verify v4-layout chunk created in build output
- [X] Manual test: Access http://localhost:5173/?v4=true
- [X] Manual test: V4 layout renders with header, banner, sidebar
- [X] Manual test: ConfigSidebar toggles/sliders are interactive
- [X] Manual test: Harmony type dropdown updates tool

---

## Phase 7: New Dye Mixer Tool Implementation ✅ COMPLETE

### 7.1 Update Default Config
- [x] Update `src/shared/tool-config-types.ts` - Change DEFAULT_CONFIGS.mixer.maxResults from 3 to 5

### 7.2 Implement Mixer Tool Core
- [x] Replace placeholder in `src/components/mixer-tool.ts` with full implementation
- [x] Add MixedColorResult interface for tracking blend results
- [x] Implement `blendColors()` - RGB averaging algorithm
- [x] Implement `findMatchingDyes()` - Find closest dyes using ColorService.getColorDistance()
- [x] Exclude input dyes and Facewear from results
- [x] Apply DyeFilters when available

### 7.3 Left Panel Implementation
- [x] Add CollapsiblePanel sections: Dye Selection, Mix Settings, Filters, Market Board
- [x] Integrate DyeSelector component (maxSelections: 2)
- [x] Add Max Results slider (range 3-8, default 5)
- [x] Integrate DyeFilters component
- [x] Integrate MarketBoard component with price events

### 7.4 Right Panel - Crafting UI
- [x] Create crafting equation layout: [Slot1] + [Slot2] → [Result]
- [x] Implement `createDyeSlot()` - 100x100px glassmorphism input slots
- [x] Implement `createResultSlot()` - 120x120px result slot with gold border
- [x] Add contrast-aware text colors using luminance calculation
- [x] Add hover effects and visual feedback

### 7.5 Results Grid
- [x] Integrate v4-result-card components for matching dyes
- [x] Pass ResultCardData with deltaE, originalColor, matchedColor
- [x] Handle context-action events (add-comparison, add-mixer, copy-hex, etc.)
- [x] Support market price display on result cards

### 7.6 Mobile Drawer Support
- [x] Render mobile drawer content with mirrored controls
- [x] Sync state between desktop and mobile components
- [x] Use separate component instances (same pattern as GradientTool)

### 7.7 V4 Integration
- [x] Add public `setConfig()` method for ConfigSidebar updates
- [x] Subscribe to ConfigController changes in onMount
- [x] Update slider displays when config changes externally
- [x] Integrate with ConfigController for state persistence

### 7.8 Verification
- [x] Run type-check: `npm run type-check`
- [x] Run build: `npm run build`
- [x] Verify mixer-tool chunk created (26.69 KB / 5.85 KB gzip)
- [X] Manual test: Navigate to `/mixer` - loads Dye Mixer
- [X] Manual test: Select two dyes - blend preview appears
- [X] Manual test: Matching dyes display in result grid
- [X] Manual test: Max Results slider updates results count
- [ ] Manual test: Mobile drawer controls work

### 7.9 Commit
- [x] Commit: "feat(v4): implement Dye Mixer tool with crafting UI"

---

## Phase 8: Add setConfig() to Remaining 7 Tools ✅ COMPLETE

### 8.1 BudgetTool
- [x] Add ConfigController import and configUnsubscribe property
- [x] Subscribe to 'budget' config changes in onMount
- [x] Implement setConfig() - handles maxPrice, maxResults, maxDeltaE
- [x] Update UI displays (desktop + mobile) on config changes
- [x] Trigger refilter/re-render when config changes
- [x] Commit: "feat(v4): add setConfig() to BudgetTool"

### 8.2 GradientTool
- [x] Add ConfigController import and configUnsubscribe property
- [x] Subscribe to 'gradient' config changes in onMount
- [x] Implement setConfig() - handles stepCount, interpolation
- [x] Map interpolation ('rgb'/'hsv') to colorSpace state
- [x] Fix: Update ConfigSidebar options from 'linear'/'ease' to 'rgb'/'hsv'
- [x] Update UI displays on config changes
- [x] Commit: "feat(v4): add setConfig() to GradientTool"

### 8.3 ExtractorTool
- [x] Add ConfigController import and configUnsubscribe property
- [x] Add vibrancyBoost state variable and storage key
- [x] Subscribe to 'extractor' config changes in onMount
- [x] Implement setConfig() - handles maxColors, vibrancyBoost
- [x] Update UI displays on config changes
- [x] Commit: "feat(v4): add setConfig() to ExtractorTool with vibrancyBoost support"

### 8.4 SwatchTool
- [x] Add ConfigController import and configUnsubscribe property
- [x] Add maxResults state variable and storage key
- [x] Subscribe to 'swatch' config changes in onMount
- [x] Implement setConfig() - handles race, gender, colorSheet, maxResults
- [x] Use maxResults in findMatchingDyes() instead of hardcoded DEFAULTS.matchCount
- [x] Sync desktop/mobile selectors on config changes
- [x] Commit: "feat(v4): add setConfig() to SwatchTool with maxResults support"

### 8.5 AccessibilityTool
- [x] Add ConfigController import and configUnsubscribe property
- [x] Subscribe to 'accessibility' config changes in onMount
- [x] Implement setConfig() - handles 5 vision types and 3 display options
- [x] Map config keys to enabledVisionTypes Set values
- [x] Sync checkbox states on config changes
- [x] Commit: "feat(v4): add setConfig() to AccessibilityTool"

### 8.6 PresetTool
- [x] Add ConfigController import and configUnsubscribe property
- [x] Add showFavoritesOnly state variable
- [x] Subscribe to 'presets' config changes in onMount
- [x] Implement setConfig() - handles showMyPresetsOnly, showFavorites, sortBy
- [x] Map showMyPresetsOnly to currentTab state
- [x] Commit: "feat(v4): add setConfig() to PresetTool with showFavorites support"

### 8.7 ComparisonTool
- [x] Extend ComparisonOptions interface with showRgb, showHsv, showMarketPrices
- [x] Add storage keys for new options
- [x] Update DEFAULT_OPTIONS with new properties
- [x] Add ConfigController import and configUnsubscribe property
- [x] Subscribe to 'comparison' config changes in onMount
- [x] Implement setConfig() - handles showDeltaE, showRgb, showHsv, showMarketPrices
- [x] Commit: "feat(v4): add setConfig() to ComparisonTool with display options"

### 8.8 Verification
- [x] Run type-check: `npm run type-check`
- [x] Run build: `npm run build`
- [ ] Manual test: All 9 tools respond to ConfigSidebar changes
- [ ] Manual test: Mobile drawer controls sync correctly

---

## Phase 9: Switch Default Layout from v3 to v4 ✅ COMPLETE

### 9.1 Make v4 Default
- [x] Update `src/main.ts` - Invert layout conditional logic
- [x] V4 is now the default, v3 was accessible via `?v3=true` (before removal)
- [x] Update version header comment from v3.0.0 to v4.0.0

### 9.2 Verification
- [x] Run type-check: `npm run type-check`
- [x] Run build: `npm run build`

### 9.3 Commit
- [x] Commit: "feat(v4): switch default layout from v3 to v4"

---

## Phase 10: Remove v3 Layout Code ✅ COMPLETE

### 10.1 Delete v3 Files (7 files removed)
- [x] Delete `src/components/v3-layout.ts` (v3 entry point)
- [x] Delete `src/components/two-panel-shell.ts` (v3 shell)
- [x] Delete `src/components/mobile-drawer.ts` (v3 mobile drawer)
- [x] Delete `src/components/tool-nav.ts` (v3 navigation)
- [x] Delete `src/components/__tests__/two-panel-shell.test.ts`
- [x] Delete `src/components/__tests__/mobile-drawer.test.ts`
- [x] Delete `src/components/__tests__/tool-nav.test.ts`
- [x] Delete `src/components/__tests__/tool-nav-fallbacks.test.ts`
- [x] **Kept:** `collapsible-panel.ts` (still used by tools)

### 10.2 Clean Up Exports
- [x] Update `src/components/index.ts` - Remove v3 exports
- [x] Keep CollapsiblePanel export (shared utility component)

### 10.3 Clean Up CSS
- [x] Update `src/styles/themes.css` - Remove v3 CSS variables
- [x] Remove `--panel-left-width`, `--panel-left-width-lg`, `--panel-collapsed-width`, `--drawer-transition`
- [x] Remove v3 media query for panel width

### 10.4 Simplify main.ts
- [x] Remove v3 conditional logic
- [x] Remove v3 layout import
- [x] Simplify to v4-only initialization

### 10.5 Verification
- [x] Run type-check: `npm run type-check`
- [x] Run build: `npm run build`
- [x] Verify v3-layout chunk is removed from build output
- [x] Bundle size decreased by ~24 KB (6 KB gzipped)

### 10.6 Commits
- [x] Commit: "refactor(v4): remove v3 layout components" (2,352 lines deleted)
- [x] Commit: "chore(v4): clean up v3 CSS variables and simplify main.ts"

---

## Final Verification

- [ ] Run full test suite: `npm run test -- --run`
- [ ] Run E2E tests: `npm run test:e2e`
- [x] Run production build: `npm run build`
- [ ] Check bundle size: `npm run check-bundle-size`
- [ ] Manual testing: All 9 routes work correctly
- [ ] Manual testing: Theme switching works with v4 variables

---

## Commits Made

| Commit | Message |
|--------|---------|
| 1 | feat(v4): Add CSS variable system for v4 themes |
| 2 | feat(v4): Update router with v4 tool IDs and legacy redirects |
| 3 | feat(v4): Rename tool components for v4 naming convention |
| 4 | feat(v4): Add Dye Mixer tool placeholder |
| 5 | feat(v4): Add Lit.js infrastructure for component migration |
| 6 | feat(v4): Add layout icons (ICON_LOGO, ICON_GLOBE, ICON_TOOL_DYE_MIXER) |
| 7 | feat(v4): Add v4 layout components (Header, ToolBanner, Sidebar, Shell) |
| 8 | feat(v4): add ICON_CONTEXT_MENU to ui-icons |
| 9 | feat(v4): implement GlassPanel component |
| 10 | feat(v4): implement ToggleSwitchV4 component |
| 11 | feat(v4): implement RangeSliderV4 component |
| 12 | feat(v4): implement ResultCard component |
| 13 | feat(v4): export Phase 5 shared components |
| 14 | feat(v4): add tool configuration type definitions |
| 15 | feat(v4): implement ConfigController service |
| 16 | feat(v4): wire ConfigSidebar controls with v4 components |
| 17 | feat(v4): forward config-change events in V4LayoutShell |
| 18 | feat(v4): create v4-layout.ts entry point |
| 19 | feat(v4): add setConfig() to HarmonyTool for external configuration |
| 20 | feat(v4): enable v4 layout toggle in main.ts |
| 21 | feat(v4): implement Dye Mixer tool with crafting UI |
| 22 | feat(v4): add setConfig() to BudgetTool |
| 23 | feat(v4): add setConfig() to GradientTool |
| 24 | feat(v4): add setConfig() to ExtractorTool with vibrancyBoost support |
| 25 | feat(v4): add setConfig() to SwatchTool with maxResults support |
| 26 | feat(v4): add setConfig() to AccessibilityTool |
| 27 | feat(v4): add setConfig() to PresetTool with showFavorites support |
| 28 | feat(v4): add setConfig() to ComparisonTool with display options |
| 29 | feat(v4): switch default layout from v3 to v4 |
| 30 | refactor(v4): remove v3 layout components |
| 31 | chore(v4): clean up v3 CSS variables and simplify main.ts |

---

## Notes

### NPM Updates Completed
- **lit@^3.1.0** - Lit.js framework for v4 components (~5KB gzipped) ✅ Added in Phase 3

### CF Workers
- No changes required for this foundation phase

### Route Mapping Reference
| v3 Route | v4 Route | Tool Name |
|----------|----------|-----------|
| /harmony | /harmony | Harmony Explorer |
| /matcher | /extractor | Palette Extractor |
| /accessibility | /accessibility | Accessibility Checker |
| /comparison | /comparison | Dye Comparison |
| /mixer | /gradient | Gradient Builder |
| (new) | /mixer | Dye Mixer (NEW) |
| /presets | /presets | Community Presets |
| /budget | /budget | Budget Suggestions |
| /character | /swatch | Swatch Matcher |

---

## Future Phases

- ~~Phase 4: Layout Components (V4LayoutShell, V4AppHeader, ToolBanner, ConfigSidebar)~~ ✅ COMPLETE
- ~~Phase 5: Shared Components (ResultCard, GlassPanel, ToggleSwitchV4, RangeSliderV4)~~ ✅ COMPLETE
- ~~Phase 6: Tool Migration to Lit.js (wire config controls, connect to services)~~ ✅ COMPLETE
- ~~Phase 7: New Dye Mixer Tool Implementation~~ ✅ COMPLETE
- ~~Phase 8: Add setConfig() to Remaining 7 Tools~~ ✅ COMPLETE
- ~~Phase 9: Switch Default Layout from v3 to v4~~ ✅ COMPLETE
- ~~Phase 10: Remove v3 Layout Code (cleanup)~~ ✅ COMPLETE
