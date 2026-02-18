# Phase 12: Architecture Refactor - Implementation Checklist

**Version**: v2.0.0 (TypeScript + Vite)
**Target Completion**: 6-8 weeks
**Status**: 🚀 IN PROGRESS (Phases 12.1-12.5 substantially complete)

---

## 📅 Phase 12.1: Build System Setup (Week 1-2)

### 12.1.1 Vite Configuration
- [ ] Install Vite 5.x and dependencies
  - [ ] `npm install vite @vitejs/plugin-vue @vitejs/plugin-react`
  - [ ] `npm install --save-dev @types/node @types/es2020`

- [ ] Create `vite.config.ts`
  - [ ] Configure root to `src/`
  - [ ] Configure output to `dist/`
  - [ ] Set target to ES2020
  - [ ] Enable sourcemaps for production
  - [ ] Configure path aliases (@, @components, @services, @shared)
  - [ ] Set up dev server on port 5173
  - [ ] Enable minification with esbuild

- [ ] Test Vite setup
  - [ ] `npm run dev` starts server successfully
  - [ ] Hot module replacement (HMR) works
  - [ ] Asset serving works correctly
  - [ ] Build completes without errors

### 12.1.2 TypeScript Configuration
- [ ] Create `tsconfig.json`
  - [ ] Target ES2020
  - [ ] Enable strict mode (`"strict": true`)
  - [ ] Configure path aliases
  - [ ] Enable source maps
  - [ ] Configure module resolution

- [ ] Validate TypeScript
  - [ ] `npm run type-check` reports 0 errors
  - [ ] IDE shows correct type hints
  - [ ] All imports resolve correctly

### 12.1.3 ESLint & Prettier Setup
- [ ] Install ESLint dependencies
  - [ ] `npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser`
  - [ ] `npm install --save-dev eslint-config-prettier eslint-plugin-prettier`

- [ ] Create `.eslintrc.json`
  - [ ] Configure TypeScript parser
  - [ ] Enable recommended rules
  - [ ] Configure no-explicit-any as error
  - [ ] Configure no-unused-vars with underscore exception
  - [ ] Disable console.log (warn only console.warn/error)

- [ ] Create `.prettierrc.json`
  - [ ] Line width: 100
  - [ ] Trailing comma: es5
  - [ ] Single quotes: true
  - [ ] Semi: true
  - [ ] Tab width: 2

- [ ] Add pre-commit hooks (optional but recommended)
  - [ ] Install husky: `npm install husky`
  - [ ] Install lint-staged: `npm install lint-staged`
  - [ ] Configure `.husky/pre-commit` to run `npm run lint`

- [ ] Test linting
  - [ ] `npm run lint` identifies no errors
  - [ ] `npm run format` (if added) applies formatting

### 12.1.4 Testing Framework Setup
- [ ] Install Vitest & dependencies
  - [ ] `npm install --save-dev vitest @vitest/ui @vitest/coverage-v8`
  - [ ] `npm install --save-dev jsdom`
  - [ ] `npm install --save-dev @testing-library/dom @testing-library/user-event`

- [ ] Create `vitest.config.ts`
  - [ ] Set environment to jsdom
  - [ ] Enable globals
  - [ ] Configure coverage to v8
  - [ ] Set exclude patterns
  - [ ] Configure reporters

- [ ] Create test directory structure
  - [ ] `src/__tests__/` root directory
  - [ ] Mirror structure for each module (e.g., `src/services/__tests__/`)
  - [ ] Create `src/test-setup.ts` for test utilities

- [ ] Test framework setup
  - [ ] `npm run test` runs successfully
  - [ ] `npm run test:coverage` generates coverage report
  - [ ] Coverage UI accessible at http://localhost:51204

### 12.1.5 Package.json Scripts
- [ ] Update package.json version to 2.0.0-alpha.1
- [ ] Add build scripts:
  - [ ] `"dev": "vite"`
  - [ ] `"build": "tsc --noEmit && vite build"`
  - [ ] `"preview": "vite preview"`
  - [ ] `"type-check": "tsc --noEmit"`
  - [ ] `"lint": "eslint src/**/*.ts --fix"`
  - [ ] `"test": "vitest"`
  - [ ] `"test:coverage": "vitest --coverage"`
  - [ ] `"test:ui": "vitest --ui"`

### 12.1.6 Initial Project Structure
- [ ] Create directory structure:
  ```
  src/
  ├── main.ts
  ├── index.html
  ├── apps/
  ├── components/
  ├── services/
  ├── shared/
  ├── data/
  ├── styles/
  └── __tests__/
  ```

- [ ] Create placeholder files
  - [ ] `src/main.ts` - entry point
  - [ ] `src/index.html` - HTML entry
  - [ ] `.eslintignore` - ESLint ignore file
  - [ ] `.prettierignore` - Prettier ignore file
  - [ ] `tailwind.config.ts` - Tailwind configuration

### ✅ 12.1 Completion Criteria
- [ ] Vite dev server runs and HMR works
- [ ] `npm run build` produces dist/ folder
- [ ] TypeScript strict mode enabled with 0 errors
- [ ] ESLint configured and passing
- [ ] Vitest running and ready for tests
- [ ] All npm scripts working correctly
- [ ] Project structure created and organized

---

## 📅 Phase 12.2: TypeScript Migration (Week 3-4)

### 12.2.1 Core Service Layer

#### Color Service (`src/services/color-service.ts`)
- [ ] Create type definitions
  - [ ] `RGB` interface with r, g, b
  - [ ] `HSV` interface with h, s, v
  - [ ] `ColorblindType` enum
  - [ ] `Matrix3x3` type for Brettel matrices

- [ ] Implement color conversions
  - [ ] `hexToRgb(hex: string): RGB`
  - [ ] `rgbToHex(r: number, g: number, b: number): string`
  - [ ] `rgbToHsv(r: number, g: number, b: number): HSV`
  - [ ] `hsvToRgb(h: number, s: number, v: number): RGB`
  - [ ] Validate all conversions against v1.6.x outputs

- [ ] Implement colorblindness simulation
  - [ ] Create Brettel 1997 matrices as constants
  - [ ] `simulateColorblindness(rgb: RGB, type: ColorblindType): RGB`
  - [ ] Test with known colorblind vision samples

- [ ] Implement color distance calculation
  - [ ] `getColorDistance(hex1: string, hex2: string): number`
  - [ ] Validate against v1.6.x algorithm

- [ ] Add JSDoc documentation
  - [ ] Document all functions with param/return types
  - [ ] Add usage examples
  - [ ] Document color space assumptions

- [ ] Create unit tests (`src/services/__tests__/color-service.test.ts`)
  - [ ] Test hex to RGB conversion
  - [ ] Test RGB to hex conversion
  - [ ] Test HSV conversions (round-trip)
  - [ ] Test colorblindness matrices with known inputs
  - [ ] Test color distance calculations
  - [ ] Edge cases (black, white, pure colors)
  - [ ] **Target**: ≥95% coverage

#### Dye Service (`src/services/dye-service.ts`)
- [ ] Create type definitions
  - [ ] `Dye` interface (itemID, name, hex, rgb, hsv, category, acquisition, cost)
  - [ ] `DyeCategory` type

- [ ] Implement DyeDatabase class
  - [ ] Load JSON data asynchronously
  - [ ] Cache loaded data
  - [ ] `getAllDyes(): Dye[]`
  - [ ] `getDyeById(id: number): Dye | null`
  - [ ] `searchDyes(query: string): Dye[]` (case-insensitive)
  - [ ] `filterDyes(category: string, exclude?: number[]): Dye[]`
  - [ ] `findClosestDye(hex: string, exclude?: number[]): Dye`

- [ ] Add JSDoc documentation
  - [ ] Document class methods
  - [ ] Add usage examples

- [ ] Create unit tests (`src/services/__tests__/dye-service.test.ts`)
  - [ ] Test getDyeById with valid/invalid IDs
  - [ ] Test searchDyes with various queries
  - [ ] Test filterDyes by category
  - [ ] Test filterDyes with exclusions
  - [ ] Test findClosestDye accuracy
  - [ ] **Target**: ≥90% coverage

#### Storage Service (`src/services/storage-service.ts`)
- [ ] Create type definitions
  - [ ] Generic `<T>` support
  - [ ] Storage migration interface

- [ ] Implement StorageService class
  - [ ] `get<T>(key: string, defaultValue: T): T`
  - [ ] `set<T>(key: string, value: T): void`
  - [ ] `remove(key: string): void`
  - [ ] `clear(): void`
  - [ ] `getAllKeys(): string[]`
  - [ ] Automatic JSON serialization/deserialization
  - [ ] Try-catch error handling

- [ ] Implement migration support
  - [ ] `migrateFromV1(oldKey: string, newKey: string, transformer?: (v: any) => any): void`
  - [ ] Handle backward compatibility with v1.6.x localStorage

- [ ] Add JSDoc documentation

- [ ] Create unit tests (`src/services/__tests__/storage-service.test.ts`)
  - [ ] Test get/set for primitives
  - [ ] Test get/set for objects/arrays
  - [ ] Test default value return
  - [ ] Test remove operation
  - [ ] Test error handling with full quota
  - [ ] Test migrations
  - [ ] **Target**: ≥85% coverage

#### Theme Service (`src/services/theme-service.ts`)
- [ ] Create type definitions
  - [ ] `ThemeName` union type (all 10 themes)
  - [ ] `ThemeColors` interface
  - [ ] Theme color mappings

- [ ] Implement ThemeService class
  - [ ] `getCurrentTheme(): ThemeName`
  - [ ] `setTheme(name: ThemeName): void`
  - [ ] `getThemeColors(theme: ThemeName): ThemeColors`
  - [ ] `getAllThemes(): ThemeName[]`
  - [ ] Emit theme change events
  - [ ] Persist to localStorage

- [ ] Add JSDoc documentation

- [ ] Create unit tests (`src/services/__tests__/theme-service.test.ts`)
  - [ ] Test getting/setting theme
  - [ ] Test theme color retrieval
  - [ ] Test localStorage persistence
  - [ ] Test all 10 themes
  - [ ] Test theme change events
  - [ ] **Target**: ≥90% coverage

#### API Service (`src/services/api-service.ts`)
- [ ] Create type definitions
  - [ ] `PriceData` interface
  - [ ] `UniversalisResponse` interface

- [ ] Implement APIService class
  - [ ] `fetchMarketPrices(dataCenter: string, itemID: number, worldID?: number): Promise<PriceData>`
  - [ ] Automatic response caching with 5-minute TTL
  - [ ] Request debouncing (500ms)
  - [ ] Graceful error fallback
  - [ ] Console logging for debugging

- [ ] Add JSDoc documentation

- [ ] Create unit tests (`src/services/__tests__/api-service.test.ts`)
  - [ ] Test successful API calls
  - [ ] Test caching behavior
  - [ ] Test debouncing
  - [ ] Test error handling
  - [ ] Test fallback on network error
  - [ ] **Target**: ≥85% coverage

### 12.2.2 Shared Utilities & Types

#### Type Definitions (`src/shared/types.ts`)
- [ ] Define core types
  - [ ] `RGB`, `HSV`, `HexColor` (branded string)
  - [ ] `AppState` base interface
  - [ ] Tool-specific state interfaces (AccessibilityState, ExplorerState, etc.)
  - [ ] `AppError` custom error class
  - [ ] `ThemeName`, `VisionType` unions

- [ ] Create type mapping interfaces
  - [ ] Color mappings
  - [ ] Category enums
  - [ ] Settings interfaces

- [ ] Export all types for use across app
- [ ] Document complex type structures with JSDoc

#### Utility Functions (`src/shared/utils.ts`)
- [ ] Math utilities
  - [ ] `clamp(value, min, max): number`
  - [ ] `lerp(a, b, t): number`
  - [ ] `degrees(radians): number`
  - [ ] `radians(degrees): number`

- [ ] String utilities
  - [ ] `escapeHTML(text): string`
  - [ ] `formatNumber(num, decimals?): string`
  - [ ] `slugify(text): string`
  - [ ] `capitalize(text): string`

- [ ] Array utilities
  - [ ] `unique<T>(array): T[]`
  - [ ] `groupBy<T, K>(array, keyFn): Record<K, T[]>`
  - [ ] `sortByProperty<T>(array, property, order?): T[]`
  - [ ] `flatten<T>(array): T[]`
  - [ ] `chunk<T>(array, size): T[][]`

- [ ] DOM utilities
  - [ ] `createElement<K>(tagName, options?): HTMLElement`
  - [ ] `querySelector<T>(selector, parent?): T | null`
  - [ ] `querySelectorAll<T>(selector, parent?): T[]`
  - [ ] `addEventListener(target, event, handler): void`
  - [ ] `removeEventListener(target, event, handler): void`

- [ ] Create unit tests with ≥95% coverage

#### Constants (`src/shared/constants.ts`)
- [ ] Define all magic numbers and configuration
  - [ ] `FFXIV_DYES_COUNT = 125`
  - [ ] `THEME_NAMES` array
  - [ ] `VISION_TYPES` array
  - [ ] `HARMONY_TYPES` array

- [ ] Color algorithm constants
  - [ ] Brettel matrices (deuteranopia, protanopia, tritanopia, achromatopsia)
  - [ ] Color space ranges
  - [ ] Default settings

- [ ] API constants
  - [ ] `UNIVERSALIS_API_BASE`
  - [ ] `API_CACHE_TTL`
  - [ ] `API_DEBOUNCE_DELAY`

- [ ] UI constants
  - [ ] Breakpoints (mobile, tablet, desktop)
  - [ ] Animation durations
  - [ ] Z-index values

#### Error Handler (`src/shared/error-handler.ts`)
- [ ] Create ErrorHandler class
  - [ ] `handle(error: unknown): AppError`
  - [ ] `log(error: AppError): void`
  - [ ] `createUserMessage(error: AppError): string`

- [ ] Create wrapped functions
  - [ ] `withErrorHandling<T>(fn, fallback?): T | undefined`
  - [ ] `withAsyncErrorHandling<T>(fn, fallback?): Promise<T | undefined>`

- [ ] Create unit tests with ≥90% coverage

### ✅ 12.2 Completion Criteria
- [ ] All 5 core services fully typed and functional
- [ ] All shared utilities created and tested
- [ ] ≥80% test coverage for service layer
- [ ] 0 ESLint warnings
- [ ] `npm run type-check` passes with strict mode
- [ ] Services documented with JSDoc
- [ ] All v1.6.x algorithms verified against new implementations

---

## 📅 Phase 12.3: Component Layer (Week 5)

### 12.3.1 Base Component Class (`src/components/base-component.ts`)
- [ ] Create abstract BaseComponent class
  - [ ] Constructor accepting container element
  - [ ] Abstract `render()` method
  - [ ] Abstract `bindEvents()` method
  - [ ] Protected helper methods for DOM manipulation

- [ ] Implement helper methods
  - [ ] `createElement<K>(tagName, options?): HTMLElement`
  - [ ] `on<K>(target, event, handler): void`
  - [ ] `off<K>(target, event, handler): void`
  - [ ] `emit(eventName, detail?): void`
  - [ ] `setState(newState): void`

- [ ] Create unit tests
- [ ] Document with JSDoc

### 12.3.2 Theme Switcher Component
- [ ] Create directory: `src/components/theme-switcher/`
- [ ] Implement `component.ts`
  - [ ] Extends BaseComponent
  - [ ] Render dropdown with 10 themes
  - [ ] Bind click handlers
  - [ ] Emit theme-changed events

- [ ] Create `template.ts`
  - [ ] HTML generation functions
  - [ ] Accessibility attributes

- [ ] Create `styles.css`
  - [ ] Component-scoped styles
  - [ ] Mobile responsive
  - [ ] Dropdown animations

- [ ] Create `types.ts`
  - [ ] ThemeSwitcherOptions interface

- [ ] Create unit tests
  - [ ] Render test
  - [ ] Event binding test
  - [ ] Theme change event test

### 12.3.3 Mobile Navigation Component
- [ ] Create directory: `src/components/mobile-nav/`
- [ ] Implement component
  - [ ] Navigation bar (≤768px only)
  - [ ] Tool links with icons
  - [ ] Active state styling
  - [ ] Responsive layout

- [ ] Create styles with mobile-first approach
- [ ] Create unit tests
- [ ] Test responsive behavior

### 12.3.4 Footer Component
- [ ] Create directory: `src/components/footer/`
- [ ] Implement component
  - [ ] Version display
  - [ ] Resource links
  - [ ] License attribution

- [ ] Create styles
- [ ] Create unit tests

### 12.3.5 Market Prices Component
- [ ] Create directory: `src/components/market-prices/`
- [ ] Implement component
  - [ ] Extends BaseComponent
  - [ ] Toggle button for show/hide prices
  - [ ] Integrate with APIService
  - [ ] Loading states
  - [ ] Error handling
  - [ ] Price display formatting

- [ ] Create styles
- [ ] Create unit tests
  - [ ] API integration
  - [ ] Loading state
  - [ ] Error handling
  - [ ] Price formatting

### ✅ 12.3 Completion Criteria
- [ ] 5 UI components fully implemented
- [ ] BaseComponent pattern established
- [ ] Event system working across components
- [ ] ≥80% test coverage
- [ ] Accessibility attributes present
- [ ] Mobile responsive tested

---

## 📅 Phase 12.4: Tool Applications Migration (Week 6-8)

### 12.4.1 Color Matcher (Pattern Tool)
- [ ] Create directory: `src/apps/color-matcher/`

#### Types (`types.ts`)
- [ ] `ColorMatcherState` interface
- [ ] `MatchResult` interface
- [ ] `ImageProcessingOptions` interface

#### Logic (`logic.ts`)
- [ ] Create `ColorMatcherLogic` class
- [ ] Implement methods:
  - [ ] `matchColor(sourceHex, options?): MatchResult`
  - [ ] `processImage(imageData, options?): HexColor`
  - [ ] `findClosestDyes(hex, topN?): MatchResult[]`
  - [ ] `calculateSampleAverageColor(pixels, sampleSize): RGB`

- [ ] Migrate algorithms from v1.6.x
- [ ] Validate outputs match v1.6.x
- [ ] Create unit tests with ≥85% coverage

#### UI (`ui.ts`)
- [ ] Create `ColorMatcherUI` class extending BaseComponent
- [ ] Implement methods:
  - [ ] `render(): void`
  - [ ] `updateMatchResult(result): void`
  - [ ] `displayImagePreview(image): void`
  - [ ] `updateZoomLevel(level): void`
  - [ ] `showLoadingState(): void`
  - [ ] `showErrorState(error): void`

- [ ] Create unit tests

#### Handlers (`handlers.ts`)
- [ ] File input handler
- [ ] Color picker handler
- [ ] Clipboard paste handler
- [ ] Eyedropper handler
- [ ] Sample size change handler
- [ ] Zoom control handlers
- [ ] Create unit tests

#### Styles (`styles.css`)
- [ ] Component-scoped styles
- [ ] Responsive design
- [ ] Mobile optimizations

#### Tests (`__tests__/`)
- [ ] `logic.test.ts` - Algorithm tests
- [ ] `ui.test.ts` - UI rendering tests
- [ ] `integration.test.ts` - Full workflow tests

### 12.4.2 Color Accessibility
- [ ] Repeat Color Matcher pattern
- [ ] Additional complexity:
  - [ ] 6 outfit slots
  - [ ] Dual dyes feature
  - [ ] 5 vision types
  - [ ] Accessibility scoring algorithm

- [ ] Create comprehensive tests
- [ ] **Target**: ≥85% coverage

### 12.4.3 Color Explorer
- [ ] Repeat pattern
- [ ] Additional complexity:
  - [ ] 6 harmony types
  - [ ] Canvas visualization
  - [ ] Deviance calculations
  - [ ] Color wheel rendering

- [ ] Create comprehensive tests
- [ ] **Target**: ≥85% coverage

### 12.4.4 Dye Comparison
- [ ] Repeat pattern
- [ ] Additional complexity:
  - [ ] 3 chart types
  - [ ] Distance matrix calculations
  - [ ] Canvas rendering (2D)
  - [ ] Export functionality (JSON, CSS)

- [ ] Create comprehensive tests
- [ ] **Target**: ≥80% coverage

### 12.4.5 Dye Mixer
- [ ] Repeat pattern
- [ ] Additional complexity:
  - [ ] Interpolation algorithm
  - [ ] Gradient visualization
  - [ ] Position management

- [ ] Create comprehensive tests
- [ ] **Target**: ≥80% coverage

### ✅ 12.4 Completion Criteria
- [ ] All 5 tools fully migrated to TypeScript
- [ ] Logic, UI, and handlers separated for each tool
- [ ] ≥80% test coverage overall
- [ ] 100% feature parity with v1.6.x
- [ ] Zero console errors when running
- [ ] All algorithms verified against v1.6.x

---

## 📅 Phase 12.5: Integration & Build Optimization (Week 8)

### 12.5.1 App Initializer
- [ ] Create `src/app-initializer.ts`
  - [ ] Determine which tool to load from URL
  - [ ] Dynamically import tool module
  - [ ] Initialize services
  - [ ] Mount to DOM

- [ ] Create `src/main.ts`
  - [ ] Import styles
  - [ ] Call initializer
  - [ ] Handle errors
  - [ ] Register service worker

- [ ] Create `src/index.html`
  - [ ] Single app container `<div id="app">`
  - [ ] Script tag for main.ts
  - [ ] Meta tags (charset, viewport, etc.)

### 12.5.2 Service Worker (`src/service-worker.ts`)
- [ ] Migrate from v1.6.x service-worker.js
- [ ] Update cache version to v2.0.0
- [ ] Implement caching strategies:
  - [ ] Cache-first for assets
  - [ ] Network-first for API calls
  - [ ] Stale-while-revalidate for data

- [ ] Handle offline mode gracefully
- [ ] Test in various network conditions

### 12.5.3 Build Optimization
- [ ] Configure code splitting in vite.config.ts
  - [ ] Vendor chunk
  - [ ] Color algorithms chunk
  - [ ] API integration chunk

- [ ] Implement lazy loading for tools
  - [ ] Each tool loads on-demand
  - [ ] Reduce initial bundle

- [ ] Optimize CSS
  - [ ] Remove unused Tailwind classes
  - [ ] Minify CSS output

- [ ] Verify bundle size
  - [ ] Total gzipped ≤500KB
  - [ ] Document breakdown by chunk

- [ ] Run production build
  - [ ] `npm run build` completes successfully
  - [ ] `npm run preview` serves dist correctly

### 12.5.4 Performance Metrics
- [ ] Measure vs. v1.6.x baseline
  - [ ] Bundle size
  - [ ] Load time
  - [ ] Paint time
  - [ ] Time to interactive

- [ ] Document improvements
- [ ] Create performance report

### ✅ 12.5 Completion Criteria
- [ ] Single entry point working
- [ ] Service worker functional
- [ ] Build optimization complete
- [ ] Bundle ≤500KB gzipped
- [ ] Performance metrics better than v1.6.x
- [ ] Preview server serving correctly

---

## 📅 Phase 12.6: Testing & Validation (Week 8-9)

### 12.6.1 Unit Test Coverage
- [ ] Service layer tests
  - [ ] 5 services with ≥85% coverage
  - [ ] Total lines: ~500

- [ ] Utility tests
  - [ ] All helpers tested
  - [ ] Edge cases covered
  - [ ] Total lines: ~200

- [ ] Tool logic tests
  - [ ] 5 tools × ~200 lines each = ~1000 lines
  - [ ] ≥85% coverage for each tool

- [ ] Component tests
  - [ ] 5 components × ~100 lines each = ~500 lines
  - [ ] Rendering and event tests

- [ ] Integration tests
  - [ ] Multi-service workflows
  - [ ] Error recovery
  - [ ] Total lines: ~600

**Total Test Code**: 2,500+ lines

### 12.6.2 Coverage Goals
- [ ] Overall: ≥80% coverage
- [ ] Services: ≥90% coverage
- [ ] Tools: ≥85% coverage
- [ ] Critical paths: 100% coverage

- [ ] Run coverage report: `npm run test:coverage`
- [ ] Generate HTML report
- [ ] Identify gaps if any

### 12.6.3 Browser Testing
Test matrix:
| Browser | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | ✅ |
| Edge | - | ✅ | ✅ |

For each browser:
- [ ] All 5 tools load correctly
- [ ] All themes render properly
- [ ] No console errors/warnings
- [ ] Responsive layout verified
- [ ] Performance acceptable
- [ ] localStorage working

### 12.6.4 Device Testing
- [ ] iPhone 13 (375px)
  - [ ] Bottom nav visible
  - [ ] Tools dropdown hidden
  - [ ] Touch interactions work

- [ ] iPad Pro (1024px)
  - [ ] Both navs visible together (check logic)
  - [ ] Proper scaling

- [ ] Desktop 1920x1080
  - [ ] Tools dropdown visible
  - [ ] Bottom nav hidden
  - [ ] All features accessible

- [ ] Dark/Light mode testing on all devices

### 12.6.5 Accessibility Testing
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
  - [ ] Tab through controls
  - [ ] Enter/Space to activate
  - [ ] Escape to close modals

- [ ] Screen reader testing
  - [ ] ARIA labels present
  - [ ] Semantic HTML
  - [ ] Focus indicators visible

- [ ] Color contrast
  - [ ] All text ≥4.5:1 contrast
  - [ ] Test with contrast checker

### 12.6.6 Performance Testing
- [ ] Lighthouse audit
  - [ ] Target ≥90 on all metrics
  - [ ] Run in DevTools

- [ ] Load time testing
  - [ ] Target: <2 seconds
  - [ ] Test with DevTools throttling

- [ ] Runtime performance
  - [ ] No jank in animations
  - [ ] Smooth scrolling
  - [ ] Input responsiveness

### ✅ 12.6 Completion Criteria
- [ ] ≥80% overall test coverage
- [ ] All browsers passing tests
- [ ] All devices tested
- [ ] Zero critical accessibility issues
- [ ] Performance meets targets
- [ ] No console errors

---

## 📅 Phase 12.7: Documentation & Release (Week 9)

### 12.7.1 Developer Documentation
- [ ] Create `ARCHITECTURE.md`
  - [ ] Design decisions
  - [ ] Module structure
  - [ ] Service layer overview
  - [ ] Component patterns
  - [ ] Data flow diagrams
  - [ ] ~500 lines

- [ ] Create `DEVELOPER_GUIDE.md`
  - [ ] Setup instructions
  - [ ] Development workflow
  - [ ] Running dev server
  - [ ] Building for production
  - [ ] Debugging tips
  - [ ] Common tasks
  - [ ] ~400 lines

- [ ] Create `API_DOCUMENTATION.md`
  - [ ] Service interfaces
  - [ ] Type definitions
  - [ ] Usage examples
  - [ ] ~300 lines

- [ ] Create `TESTING_GUIDE.md`
  - [ ] How to run tests
  - [ ] Writing new tests
  - [ ] Coverage goals
  - [ ] ~200 lines

- [ ] Create `MIGRATION_GUIDE.md`
  - [ ] Changes from v1.6.x
  - [ ] Breaking changes (if any)
  - [ ] localStorage compatibility
  - [ ] ~200 lines

### 12.7.2 User Documentation
- [ ] Update `README.md`
  - [ ] New v2.0.0 features
  - [ ] Version highlights
  - [ ] Installation for contributors

- [ ] Update `CHANGELOG.md`
  - [ ] v2.0.0 section header
  - [ ] Complete list of changes
  - [ ] Performance improvements
  - [ ] Developer experience improvements
  - [ ] Migration notes

- [ ] Update `CLAUDE.md`
  - [ ] Architecture overview
  - [ ] New development setup
  - [ ] Build process

### 12.7.3 Code Quality Audit
- [ ] TypeScript strict mode
  - [ ] `npm run type-check` → 0 errors

- [ ] ESLint validation
  - [ ] `npm run lint` → 0 errors/warnings

- [ ] Test coverage
  - [ ] `npm run test:coverage` → ≥80%

- [ ] Bundle analysis
  - [ ] Run `npm run build`
  - [ ] Verify size targets
  - [ ] Document breakdown

### 12.7.4 Pre-Release Checklist
- [ ] Code Quality
  - [ ] ✅ TypeScript strict mode: 0 errors
  - [ ] ✅ ESLint: 0 warnings
  - [ ] ✅ Test coverage: ≥80%
  - [ ] ✅ No console errors

- [ ] Functionality
  - [ ] ✅ All 5 tools working
  - [ ] ✅ All themes rendering
  - [ ] ✅ Feature parity with v1.6.x
  - [ ] ✅ localStorage compatibility

- [ ] Performance
  - [ ] ✅ Bundle ≤500KB gzipped
  - [ ] ✅ Load time <2s
  - [ ] ✅ Lighthouse ≥90

- [ ] Testing
  - [ ] ✅ All browsers passing
  - [ ] ✅ All devices tested
  - [ ] ✅ No accessibility issues

- [ ] Documentation
  - [ ] ✅ All docs complete
  - [ ] ✅ CHANGELOG updated
  - [ ] ✅ README updated
  - [ ] ✅ Setup guides verified

### 12.7.5 Release Execution
- [ ] Create release branch
  - [ ] `git checkout -b release/v2.0.0`

- [ ] Update version numbers
  - [ ] `package.json`: 2.0.0
  - [ ] `src/main.ts`: version constant
  - [ ] Any hardcoded version strings

- [ ] Commit release prep
  - [ ] `git commit -m "Release: v2.0.0 - Architecture Refactor with TypeScript & Vite"`

- [ ] Create release tag
  - [ ] `git tag -a v2.0.0 -m "v2.0.0 Release"`

- [ ] Create GitHub release
  - [ ] Use changelog as release notes
  - [ ] Include performance metrics
  - [ ] Link to migration guide

- [ ] Build production bundle
  - [ ] `npm run build`
  - [ ] Verify dist/ folder

- [ ] Deploy to production (if applicable)
  - [ ] Upload dist/ to hosting
  - [ ] Verify deployment
  - [ ] Test on live site

### ✅ 12.7 Completion Criteria
- [ ] All documentation complete
- [ ] Release checklist fully passed
- [ ] Version bumped to 2.0.0
- [ ] Git tag created
- [ ] GitHub release published
- [ ] Production deployment complete (if applicable)

---

## 🎯 Overall Phase 12 Status

### Week-by-Week Summary
- **Week 1-2**: Build system setup
- **Week 3-4**: Core service migration
- **Week 5**: UI components
- **Week 6-8**: Tool applications (3 weeks for 5 complex tools)
- **Week 8**: Integration and optimization
- **Week 8-9**: Testing and validation
- **Week 9**: Documentation and release

### Completion Gates
- [ ] All sub-phases complete (12.1-12.7)
- [ ] All success criteria met
- [ ] Zero critical issues remaining
- [ ] Team sign-off obtained
- [ ] Ready for production deployment

### Success Metrics
- ✅ Code Quality: 100% TypeScript strict, 0 ESLint warnings, ≥80% coverage
- ✅ Performance: ≤500KB gzipped, <2s load time, ≥90 Lighthouse
- ✅ Functionality: 100% feature parity, all 5 tools working, all themes rendering
- ✅ Testing: All browsers/devices passing, zero accessibility issues
- ✅ Documentation: Complete API docs, developer guide, user guide

---

## 📝 Notes for Implementation

### Important Reminders
- **Byte-by-byte accuracy**: All algorithms must produce identical outputs to v1.6.x
- **Backward compatibility**: localStorage must support v1.6.x data
- **Test-driven**: Write tests as you implement, not after
- **Incremental commits**: Commit frequently with meaningful messages
- **Code review**: Have work reviewed before merging
- **Performance monitoring**: Check bundle size regularly

### Potential Blockers to Watch
- Complex color algorithm correctness
- Canvas rendering edge cases (Dye Comparison)
- Service worker caching strategy
- Browser compatibility edge cases
- localStorage migration issues

### Dependencies
- Node.js 18+ (required for Vite)
- TypeScript 5.x knowledge
- Understanding of webpack/Vite concepts
- Familiarity with Vitest
- Basic knowledge of service workers

---

**Checklist Version**: 1.0
**Created**: November 16, 2025
**Last Updated**: November 16, 2025
**Status**: Ready for Phase 12 Kickoff
