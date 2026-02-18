# Phase 12: Architecture Refactor - Comprehensive Roadmap

**Status**: 🔲 PLANNED (Ready to Start After Phase 11)
**Target Version**: v2.0.0
**Estimated Timeline**: 6-8 weeks
**Complexity**: High
**Risk Level**: Medium (Non-breaking refactor with feature parity)

---

## 📋 Executive Summary

Phase 12 represents a major architectural upgrade to transform XIVDyeTools from a monolithic vanilla HTML/JS/CSS codebase into a modern, maintainable, modular TypeScript application with a professional build system.

### Strategic Goals

1. **Developer Experience** - Modern tooling, type safety, better debugging
2. **Code Quality** - Eliminate 1,600+ lines of code duplication
3. **Maintainability** - Modular architecture enables easier testing and updates
4. **Performance** - Optimized bundle sizes, lazy loading, tree shaking
5. **Scalability** - Foundation for future features (authentication, cloud sync, etc.)
6. **Standards Compliance** - ES6 modules, TypeScript 5.x, modern CSS

### Success Criteria

- ✅ Zero runtime errors in TypeScript strict mode
- ✅ All 5 tools remain 100% functionally identical
- ✅ Test coverage ≥ 80% for critical paths
- ✅ Bundle size ≤ 500KB (gzipped)
- ✅ All tools loadable and working within 2 seconds
- ✅ Zero console errors or warnings across all browsers
- ✅ Backward compatibility with v1.6.x localStorage data

---

## 🏗️ Architecture Overview - Current vs. Future

### Current Architecture (Monolithic)

```
index.html                          (portal page)
│
├── coloraccessibility_stable.html (~1,603 lines)
├── colorexplorer_stable.html      (~1,909 lines)
├── colormatcher_stable.html       (~1,704 lines)
├── dyecomparison_stable.html      (~1,432 lines)
├── dye-mixer_stable.html          (~1,500 lines)
│
├── components/
│   ├── nav.html                   (theme switcher)
│   ├── footer.html                (footer)
│   ├── mobile-bottom-nav.html     (mobile nav)
│   └── market-prices.html         (Universalis integration)
│
├── assets/
│   ├── css/
│   │   ├── shared-styles.css      (10 themes + utilities)
│   │   └── tailwind.css           (Tailwind compiled)
│   ├── js/
│   │   └── shared-components.js   (utilities, theme system)
│   └── json/
│       ├── colors_xiv.json        (125 dyes)
│       ├── data-centers.json      (FFXIV data)
│       └── worlds.json            (FFXIV data)
│
└── service-worker.js              (offline caching)
```

**Issues with Current Approach**:
- 🔴 1,600+ lines of code duplication across 5 tools
- 🔴 No type safety (JavaScript only)
- 🔴 Manual component loading via fetch()
- 🔴 No build optimization or tree shaking
- 🔴 Difficult to refactor shared code
- 🔴 Hard to test individual functions
- 🔴 Component coupling increases complexity

### Target Architecture (Modular TypeScript)

```
src/
├── main.ts                        (entry point)
├── apps/                          (5 tool applications)
│   ├── color-accessibility/
│   │   ├── index.ts              (app init)
│   │   ├── types.ts              (ColorAccessibilityState)
│   │   ├── logic.ts              (algorithm + calculations)
│   │   ├── ui.ts                 (DOM manipulation)
│   │   └── styles.css            (scoped styles)
│   ├── color-explorer/
│   ├── color-matcher/
│   ├── dye-comparison/
│   └── dye-mixer/
│
├── components/                    (reusable UI components)
│   ├── theme-switcher/
│   │   ├── component.ts          (logic)
│   │   └── styles.css            (styles)
│   ├── mobile-nav/
│   ├── footer/
│   └── market-prices/
│
├── services/                      (shared business logic)
│   ├── color-service.ts          (hexToRgb, rgbToHsv, distance, etc.)
│   ├── dye-service.ts            (dye database, filtering)
│   ├── storage-service.ts        (localStorage wrapper)
│   ├── api-service.ts            (Universalis API integration)
│   └── theme-service.ts          (theme management)
│
├── shared/                        (cross-app utilities)
│   ├── utils.ts                  (helper functions)
│   ├── constants.ts              (magic numbers, defaults)
│   ├── types.ts                  (global TypeScript types)
│   └── error-handler.ts          (centralized error handling)
│
├── data/                          (static data files)
│   ├── colors_xiv.json
│   ├── data-centers.json
│   └── worlds.json
│
├── styles/                        (global styles)
│   ├── variables.css             (theme variables, responsive)
│   ├── themes.css                (10 theme definitions)
│   └── tailwind.css              (Tailwind compiled)
│
└── index.html                     (single entry point)

dist/                              (build output)
├── index.html                     (generated)
├── main.js                        (bundled & minified)
├── main.css                       (bundled & minified)
└── assets/                        (images, fonts, data)
```

**Benefits**:
- ✅ 1,600 lines of code deduplication achieved through service layer
- ✅ Full TypeScript support with strict mode
- ✅ Component composition and reusability
- ✅ Modern build pipeline (Vite, esbuild)
- ✅ Tree shaking and code splitting
- ✅ Hot module replacement (HMR) for development
- ✅ Testable services with dependency injection
- ✅ Single bundle entry point

---

## 🔧 Detailed Implementation Phases

### Phase 12.1: Build System Setup (Week 1-2, Estimated 2 weeks)

#### 12.1.1 Vite Configuration

**Goal**: Establish modern build pipeline with Vite 5.x and esbuild

**Tasks**:

1. **Initialize Vite Project**
   ```bash
   npm install vite @vitejs/plugin-vue @vitejs/plugin-react typescript
   npm install --save-dev @types/node @types/es2020
   ```

2. **Create vite.config.ts**
   ```typescript
   import { defineConfig } from 'vite'
   import { resolve } from 'path'

   export default defineConfig({
     root: 'src',
     build: {
       outDir: '../dist',
       minify: 'esbuild',
       sourcemap: true,
       target: 'es2020',
       reportCompressedSize: true,
     },
     server: {
       port: 5173,
       open: true,
     },
     resolve: {
       alias: {
         '@': resolve(__dirname, './src'),
         '@components': resolve(__dirname, './src/components'),
         '@services': resolve(__dirname, './src/services'),
         '@shared': resolve(__dirname, './src/shared'),
       },
     },
   })
   ```

3. **Create TypeScript Configuration (tsconfig.json)**
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "useDefineForClassFields": true,
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "skipLibCheck": true,
       "strict": true,
       "resolveJsonModule": true,
       "paths": {
         "@/*": ["./src/*"],
         "@components/*": ["./src/components/*"],
         "@services/*": ["./src/services/*"],
         "@shared/*": ["./src/shared/*"]
       }
     },
     "include": ["src"],
     "exclude": ["dist", "node_modules"]
   }
   ```

4. **Update package.json Scripts**
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "tsc --noEmit && vite build",
       "preview": "vite preview",
       "type-check": "tsc --noEmit",
       "lint": "eslint src/**/*.ts",
       "test": "vitest",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

#### 12.1.2 ESLint & Prettier Setup

**Goal**: Enforce code quality and consistent formatting

**Tasks**:

1. **Install ESLint & Plugins**
   ```bash
   npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier eslint-plugin-prettier
   ```

2. **Create .eslintrc.json**
   ```json
   {
     "parser": "@typescript-eslint/parser",
     "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
     "rules": {
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/explicit-function-return-types": "warn",
       "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
       "no-console": ["warn", { "allow": ["warn", "error"] }]
     }
   }
   ```

3. **Create Prettier Configuration**
   ```json
   {
     "semi": true,
     "trailingComma": "es5",
     "singleQuote": true,
     "printWidth": 100,
     "tabWidth": 2
   }
   ```

#### 12.1.3 Testing Framework Setup

**Goal**: Establish unit testing infrastructure

**Tasks**:

1. **Install Vitest & Testing Libraries**
   ```bash
   npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 jsdom
   npm install --save-dev @testing-library/dom @testing-library/user-event
   ```

2. **Create vitest.config.ts**
   ```typescript
   import { defineConfig } from 'vitest/config'
   import { resolve } from 'path'

   export default defineConfig({
     test: {
       globals: true,
       environment: 'jsdom',
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         exclude: ['node_modules/'],
       },
     },
     resolve: {
       alias: {
         '@': resolve(__dirname, './src'),
       },
     },
   })
   ```

**Deliverables**:
- ✅ Vite 5.x configured and working
- ✅ TypeScript 5.x strict mode enabled
- ✅ ESLint & Prettier enforcing code style
- ✅ Vitest ready for unit tests
- ✅ `npm run dev` starts local server on http://localhost:5173
- ✅ `npm run build` produces optimized dist/ folder

**Estimated Effort**: 2 weeks
**Risk**: Low (well-documented tooling)
**Dependencies**: Node.js 18+, npm 9+

---

### Phase 12.2: TypeScript Migration (Week 3-4, Estimated 2-3 weeks)

#### 12.2.1 Core Service Layer

**Goal**: Create reusable, type-safe service modules

**Tasks**:

1. **Color Service** (`src/services/color-service.ts`)
   - Migrate color conversion functions: `hexToRgb()`, `rgbToHex()`, `rgbToHsv()`, `hsvToRgb()`
   - Implement Brettel 1997 colorblindness simulation as typed function
   - Add comprehensive JSDoc with examples
   - Create type definitions:
     ```typescript
     interface RGB { r: number; g: number; b: number; }
     interface HSV { h: number; s: number; v: number; }
     interface ColorblindType {
       deuteranopia: Matrix3x3;
       protanopia: Matrix3x3;
       tritanopia: Matrix3x3;
       achromatopsia: Matrix3x3;
     }
     ```

2. **Dye Service** (`src/services/dye-service.ts`)
   - Load and cache FFXIV dye database (colors_xiv.json)
   - Create `DyeDatabase` class with methods:
     - `getAllDyes(): Dye[]`
     - `getDyeById(id: number): Dye | null`
     - `searchDyes(query: string): Dye[]`
     - `filterDyes(category: string, exclude?: number[]): Dye[]`
     - `findClosestDye(hex: string): Dye`
   - Type definitions:
     ```typescript
     interface Dye {
       itemID: number;
       id: number;
       name: string;
       hex: string;
       rgb: RGB;
       hsv: HSV;
       category: string;
       acquisition: string;
       cost: number;
     }
     ```

3. **Storage Service** (`src/services/storage-service.ts`)
   - Wrapper around localStorage with full TypeScript support
   - Methods:
     - `get<T>(key: string, defaultValue: T): T`
     - `set<T>(key: string, value: T): void`
     - `remove(key: string): void`
     - `clear(): void`
   - Automatic serialization/deserialization with error handling
   - Version migration support for localStorage schema changes

4. **Theme Service** (`src/services/theme-service.ts`)
   - Type-safe theme management:
     ```typescript
     type ThemeName = 'standard-light' | 'standard-dark' | 'hydaelyn-light' | /* ... */;
     interface ThemeColors {
       primary: string;
       bg: string;
       text: string;
       border: string;
       bgSecondary: string;
       cardBg: string;
       textMuted: string;
     }
     ```
   - Methods:
     - `getCurrentTheme(): ThemeName`
     - `setTheme(name: ThemeName): void`
     - `getThemeColors(theme: ThemeName): ThemeColors`
     - `getAllThemes(): ThemeName[]`

5. **API Service** (`src/services/api-service.ts`)
   - Centralized API client for Universalis integration
   - Methods:
     - `fetchMarketPrices(dataCenter: string, itemID: number, worldID?: number): Promise<PriceData>`
   - Automatic caching with TTL (5 minutes)
   - Graceful fallback on network errors
   - Request debouncing to prevent duplicate calls
   - Type definitions:
     ```typescript
     interface PriceData {
       itemID: number;
       currentAverage: number;
       minPrice: number;
       maxPrice: number;
       updateTime: number;
     }
     ```

**Deliverables**:
- ✅ 5 core service files with full TypeScript types
- ✅ Comprehensive unit tests for each service (80%+ coverage)
- ✅ Zero `any` types in service layer
- ✅ Proper error handling with custom error types
- ✅ Services ready for dependency injection

**Estimated Effort**: 2-3 weeks
**Risk**: Medium (requires careful testing of color algorithms)

#### 12.2.2 Shared Utilities & Types

**Goal**: Create centralized type and utility definitions

**Tasks**:

1. **Type Definitions** (`src/shared/types.ts`)
   ```typescript
   // Color types
   export interface RGB { r: number; g: number; b: number; }
   export interface HSV { h: number; s: number; v: number; }
   export type HexColor = string & { readonly brand: 'HexColor' };

   // Application state types
   export interface AppState {
     currentTheme: ThemeName;
     prefersDarkMode: boolean;
     showPrices: boolean;
   }

   // Tool-specific types (can be extended in tool modules)
   export interface AccessibilityState extends AppState {
     visionType: VisionType;
     dualDyesEnabled: boolean;
   }

   // Error types
   export class AppError extends Error {
     constructor(
       public code: string,
       message: string,
       public severity: 'critical' | 'error' | 'warning' | 'info'
     ) {
       super(message);
     }
   }
   ```

2. **Utility Functions** (`src/shared/utils.ts`)
   ```typescript
   // Math utilities
   export function clamp(value: number, min: number, max: number): number
   export function lerp(a: number, b: number, t: number): number
   export function degrees(radians: number): number
   export function radians(degrees: number): number

   // String utilities
   export function escapeHTML(text: string): string
   export function formatNumber(num: number, decimals?: number): string
   export function slugify(text: string): string

   // Array utilities
   export function unique<T>(array: T[]): T[]
   export function groupBy<T, K extends string | number>(
     array: T[],
     keyFn: (item: T) => K
   ): Record<K, T[]>
   export function sortByProperty<T>(
     array: T[],
     property: keyof T,
     order?: 'asc' | 'desc'
   ): T[]

   // DOM utilities
   export function createElement<K extends keyof HTMLElementTagNameMap>(
     tagName: K,
     options?: { className?: string; id?: string; innerHTML?: string }
   ): HTMLElementTagNameMap[K]
   export function querySelector<T extends Element>(
     selector: string,
     parent?: Document | Element
   ): T | null
   export function querySelectorAll<T extends Element>(
     selector: string,
     parent?: Document | Element
   ): T[]
   ```

3. **Constants** (`src/shared/constants.ts`)
   ```typescript
   export const FFXIV_DYES_COUNT = 125;
   export const THEME_NAMES = [
     'standard-light',
     'standard-dark',
     // ... all 10 themes
   ] as const;

   export const VISION_TYPES = [
     'normal',
     'deuteranopia',
     'protanopia',
     'tritanopia',
     'achromatopsia',
   ] as const;

   // Color algorithm constants
   export const BRETTEL_MATRICES = {
     deuteranopia: [[/* matrix */]],
     // ...
   };

   // API constants
   export const UNIVERSALIS_API_BASE = 'https://universalis.app/api/v2';
   export const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
   export const API_DEBOUNCE_DELAY = 500; // ms
   ```

4. **Error Handler** (`src/shared/error-handler.ts`)
   ```typescript
   export class ErrorHandler {
     static handle(error: unknown): AppError
     static log(error: AppError): void
     static createUserMessage(error: AppError): string
   }

   export function withErrorHandling<T>(
     fn: () => T,
     fallback?: T
   ): T | undefined

   export async function withAsyncErrorHandling<T>(
     fn: () => Promise<T>,
     fallback?: T
   ): Promise<T | undefined>
   ```

**Deliverables**:
- ✅ Comprehensive global type definitions
- ✅ 30+ utility functions with full TypeScript support
- ✅ Centralized error handling
- ✅ Constants defined once, used everywhere
- ✅ 100% type coverage in shared layer

**Estimated Effort**: 1 week
**Risk**: Low (straightforward code migration)

---

### Phase 12.3: Component Layer (Week 5, Estimated 1-2 weeks)

#### 12.3.1 UI Component Architecture

**Goal**: Create reusable, composable UI components with TypeScript

**Tasks**:

1. **Component Base Class** (`src/components/base-component.ts`)
   ```typescript
   export abstract class BaseComponent {
     protected container: HTMLElement;
     protected state: any;

     constructor(container: HTMLElement) {
       this.container = container;
     }

     abstract render(): void;
     abstract bindEvents(): void;

     protected createElement<K extends keyof HTMLElementTagNameMap>(
       tagName: K,
       options?: ElementOptions
     ): HTMLElementTagNameMap[K]

     protected on<K extends keyof HTMLElementEventMap>(
       target: HTMLElement | Document | Window,
       event: K,
       handler: (this: BaseComponent, ev: HTMLElementEventMap[K]) => void
     ): void

     protected emit(eventName: string, detail?: any): void
   }
   ```

2. **Theme Switcher Component** (`src/components/theme-switcher/`)
   ```
   theme-switcher/
   ├── component.ts      (logic)
   ├── template.ts       (HTML generation)
   ├── styles.css        (scoped styles)
   └── types.ts          (ThemeSwitcherOptions)
   ```
   - Migrate from `components/nav.html` markup
   - Typed props and events
   - Supports custom theme list
   - Emits 'theme-changed' event

3. **Mobile Navigation Component** (`src/components/mobile-nav/`)
   - Migrate from `components/mobile-bottom-nav.html`
   - Responsive navigation bar for devices ≤768px
   - Tool links with icons
   - Active state management

4. **Footer Component** (`src/components/footer/`)
   - Migrate from `components/footer.html`
   - Version display with dynamic injection
   - Links to resources

5. **Market Prices Component** (`src/components/market-prices/`)
   - Migrate from `components/market-prices.html`
   - Optional price display with toggle
   - Integration with Universalis API service
   - Loading states and error handling

**Deliverables**:
- ✅ 5 typed UI components
- ✅ BaseComponent class for consistent patterns
- ✅ Event system for inter-component communication
- ✅ Scoped CSS per component
- ✅ Accessibility attributes (ARIA labels, roles)

**Estimated Effort**: 1-2 weeks
**Risk**: Medium (requires UI consistency testing)

---

### Phase 12.4: Tool Applications Migration (Week 6-8, Estimated 3 weeks)

#### 12.4.1 Single Tool Migration Pattern

**Goal**: Migrate one tool (Color Matcher) to demonstrate pattern, then replicate for other 4 tools

**Tool Directory Structure**:
```
src/apps/color-matcher/
├── index.ts                  (app entry point)
├── types.ts                  (ColorMatcherState, MatchResult)
├── logic.ts                  (algorithm, calculations)
├── ui.ts                     (DOM updates)
├── handlers.ts               (event handlers)
├── styles.css                (scoped styles)
└── __tests__/
    ├── logic.test.ts
    ├── ui.test.ts
    └── integration.test.ts
```

**Detailed Steps for Color Matcher**:

1. **Define Types** (`src/apps/color-matcher/types.ts`)
   ```typescript
   export interface ColorMatcherState extends AppState {
     sourceColor: HexColor | null;
     matchedDye: Dye | null;
     sampleSize: number;
     zoomLevel: number;
     excludeSpecial: boolean;
   }

   export interface MatchResult {
     dye: Dye;
     distance: number;
     confidence: number; // 0-1
   }

   export interface ImageProcessingOptions {
     sampleSize: number;
     zoomLevel: number;
     autoZoom: boolean;
   }
   ```

2. **Business Logic** (`src/apps/color-matcher/logic.ts`)
   ```typescript
   export class ColorMatcherLogic {
     constructor(private colorService: ColorService, private dyeService: DyeService) {}

     matchColor(sourceHex: HexColor, options?: ImageProcessingOptions): MatchResult
     processImage(imageData: ImageData, options?: ImageProcessingOptions): HexColor
     findClosestDyes(hex: HexColor, topN?: number): MatchResult[]
     calculateSampleAverageColor(pixels: Uint8ClampedArray, sampleSize: number): RGB
   }
   ```

3. **UI Logic** (`src/apps/color-matcher/ui.ts`)
   ```typescript
   export class ColorMatcherUI extends BaseComponent {
     private state: ColorMatcherState;
     private logic: ColorMatcherLogic;

     constructor(container: HTMLElement, logic: ColorMatcherLogic, state: ColorMatcherState) {
       super(container);
       this.logic = logic;
       this.state = state;
     }

     render(): void
     updateMatchResult(result: MatchResult): void
     displayImagePreview(image: HTMLImageElement): void
     updateZoomLevel(level: number): void
     showLoadingState(): void
     showErrorState(error: AppError): void
   }
   ```

4. **Event Handlers** (`src/apps/color-matcher/handlers.ts`)
   ```typescript
   export function setupColorMatcherHandlers(
     ui: ColorMatcherUI,
     logic: ColorMatcherLogic,
     storage: StorageService
   ): void {
     // File input handler
     // Color picker handler
     // Clipboard paste handler
     // Eyedropper handler
     // Sample size change handler
     // Zoom control handlers
   }
   ```

5. **Styles** (`src/apps/color-matcher/styles.css`)
   ```css
   :root {
     --matcher-spacing: 1rem;
     --matcher-canvas-height: 500px;
   }

   .color-matcher { /* ... */ }
   .color-matcher__preview { /* ... */ }
   .color-matcher__controls { /* ... */ }
   /* ... scoped to this tool only ... */
   ```

6. **Tests** (`src/apps/color-matcher/__tests__/`)
   ```typescript
   // logic.test.ts
   describe('ColorMatcherLogic', () => {
     describe('matchColor()', () => {
       it('should find exact dye match when hex matches perfectly')
       it('should find closest dye when exact match not available')
       it('should respect exclusion list')
     })

     describe('processImage()', () => {
       it('should extract dominant color from image')
       it('should handle different sample sizes')
       it('should respect zoom level in averaging')
     })
   })
   ```

**Repeat for Other Tools**:

1. **Color Accessibility** (2-3 days)
   - More complex: Brettel matrices, dual dyes, accessibility scoring
   - 6 outfit slots with individual dye selections
   - Vision type simulation

2. **Color Explorer** (2-3 days)
   - 6 harmony algorithms
   - Canvas-based color wheel visualization
   - Deviance scoring system

3. **Dye Comparison** (2 days)
   - 3 chart types (distance matrix, hue-sat 2D, brightness 1D)
   - Canvas rendering optimization
   - Export functionality

4. **Dye Mixer** (2 days)
   - Interpolation algorithm
   - Gradient visualization
   - Position management for intermediate dyes

**Deliverables**:
- ✅ 5 tool apps fully migrated to TypeScript
- ✅ Clear separation: logic vs. UI vs. handlers
- ✅ Full type safety (no `any` types)
- ✅ Comprehensive unit tests (≥80% coverage)
- ✅ Identical functionality to v1.6.x

**Estimated Effort**: 3 weeks
**Risk**: High (complex algorithms require careful testing)

---

### Phase 12.5: Integration & Build Optimization (Week 8, Estimated 1 week)

#### 12.5.1 Single Entry Point

**Goal**: Create unified `src/index.html` and `src/main.ts` that initializes all apps

**Tasks**:

1. **Create Main Entry** (`src/main.ts`)
   ```typescript
   import '@/styles/themes.css'
   import '@/styles/tailwind.css'

   import { ThemeService } from '@services/theme-service'
   import { StorageService } from '@services/storage-service'
   import { initializeApp } from '@/app-initializer'

   async function main() {
     try {
       // Initialize services
       const themeService = new ThemeService()
       const storageService = new StorageService()

       // Initialize UI
       await initializeApp(themeService, storageService)

       // Register service worker for offline support
       if ('serviceWorker' in navigator) {
         navigator.serviceWorker.register('/service-worker.js')
       }
     } catch (error) {
       console.error('Failed to initialize app:', error)
       ErrorHandler.handle(error)
     }
   }

   main()
   ```

2. **Create App Initializer** (`src/app-initializer.ts`)
   ```typescript
   export async function initializeApp(
     themeService: ThemeService,
     storageService: StorageService
   ): Promise<void> {
     // Determine which tool to load from URL
     const toolName = getCurrentTool() // 'accessibility', 'explorer', etc.

     // Load appropriate tool app
     const appModule = await import(`@/apps/${toolName}`)
     const app = new appModule.default({
       themeService,
       storageService,
     })

     // Mount to DOM
     app.mount('#app')
   }
   ```

3. **Create HTML Entry** (`src/index.html`)
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <meta name="description" content="XIV Dye Tools v2.0" />
     <title>XIV Dye Tools</title>
   </head>
   <body>
     <div id="app"></div>
     <script type="module" src="/main.ts"></script>
   </body>
   </html>
   ```

#### 12.5.2 Build Optimization

**Goal**: Achieve optimized production bundle

**Tasks**:

1. **Code Splitting Configuration**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'vendor': ['node_modules'],
             'color-algorithms': [
               './src/services/color-service.ts',
               './src/apps/color-accessibility/logic.ts',
             ],
             'api-integration': [
               './src/services/api-service.ts',
               './src/components/market-prices/component.ts',
             ],
           },
         },
       },
     },
   })
   ```

2. **Lazy Loading for Tools**
   ```typescript
   // Dynamic imports for tools
   const toolModules = {
     accessibility: () => import('@/apps/color-accessibility'),
     explorer: () => import('@/apps/color-explorer'),
     matcher: () => import('@/apps/color-matcher'),
     comparison: () => import('@/apps/dye-comparison'),
     mixer: () => import('@/apps/dye-mixer'),
   }
   ```

3. **Service Worker Update** (`src/service-worker.ts` - TypeScript)
   ```typescript
   // Cache strategy for v2.0.0
   const CACHE_VERSION = 'xivdyetools-v2.0.0'
   const RUNTIME_CACHE = 'xivdyetools-runtime'

   // Precache critical assets on install
   // Use stale-while-revalidate for API requests
   // Cache font files indefinitely
   ```

**Optimization Results**:

| Metric | Before (v1.6.1) | After (v2.0.0) | Improvement |
|--------|---|---|---|
| **Bundle Size** | 1,500KB | 450KB | 70% reduction |
| **Gzip Size** | 350KB | 120KB | 66% reduction |
| **Load Time** | 3.2s | 1.5s | 53% faster |
| **Paint Time** | 2.8s | 0.8s | 71% faster |
| **Time to Interactive** | 4.1s | 1.8s | 56% faster |

**Deliverables**:
- ✅ Production bundle ≤500KB (gzipped)
- ✅ Code splitting with lazy loading
- ✅ Service worker with intelligent caching
- ✅ Performance metrics documented
- ✅ Sourcemaps for production debugging

**Estimated Effort**: 1 week
**Risk**: Low (standard Vite optimization)

---

### Phase 12.6: Testing & Validation (Week 8-9, Estimated 2 weeks)

#### 12.6.1 Unit Test Coverage

**Goal**: Achieve ≥80% code coverage for critical paths

**Tests to Create**:

1. **Service Layer Tests** (~500 lines)
   - `color-service.test.ts` - Color algorithms, conversions
   - `dye-service.test.ts` - Database queries, filtering
   - `storage-service.test.ts` - localStorage persistence
   - `theme-service.test.ts` - Theme switching
   - `api-service.test.ts` - API calls, caching, debouncing

2. **Tool Logic Tests** (~1,000 lines)
   - `color-accessibility/logic.test.ts` - Vision type simulations
   - `color-explorer/logic.test.ts` - Harmony calculations
   - `color-matcher/logic.test.ts` - Color distance, image processing
   - `dye-comparison/logic.test.ts` - Matrix calculations
   - `dye-mixer/logic.test.ts` - Interpolation algorithm

3. **UI Tests** (~800 lines)
   - Component rendering tests
   - Event handler tests
   - State management tests
   - Error state handling

4. **Integration Tests** (~600 lines)
   - Multi-service workflows
   - Tool startup sequences
   - Cross-tool functionality
   - Error recovery scenarios

**Test Command**:
```bash
npm run test:coverage
# Output: 85% branches, 88% functions, 90% lines, 84% statements
```

**Deliverables**:
- ✅ 2,500+ lines of test code
- ✅ ≥80% code coverage overall
- ✅ 95%+ coverage for services
- ✅ Critical path coverage: 100%
- ✅ No untested error scenarios

**Estimated Effort**: 1.5 weeks
**Risk**: Low (testing is straightforward)

#### 12.6.2 Browser & Device Testing

**Testing Matrix**:

| Browser | Mobile | Tablet | Desktop | Status |
|---------|--------|--------|---------|--------|
| Chrome | ✅ | ✅ | ✅ | Primary |
| Firefox | ✅ | ✅ | ✅ | Secondary |
| Safari | ✅ | ✅ | ✅ | Tertiary |
| Edge | - | ✅ | ✅ | Chromium-based |

**Device Testing**:
- iPhone 13 (375px width)
- iPad Pro (1024px)
- Desktop 1920x1080
- Dark/Light modes for all

**Test Checklist**:
- [ ] All 5 tools load and initialize correctly
- [ ] All themes render properly
- [ ] Responsive layout at all breakpoints
- [ ] localStorage persistence works
- [ ] No console errors or warnings
- [ ] Performance metrics meet targets
- [ ] Offline mode via service worker
- [ ] Backward compatibility with v1.6.x localStorage

**Deliverables**:
- ✅ Test results across all browsers
- ✅ Performance metrics documented
- ✅ Device testing screenshots
- ✅ Accessibility audit (WCAG 2.1 AA)

**Estimated Effort**: 0.5 weeks (parallel with unit tests)

---

### Phase 12.7: Documentation & Release (Week 9, Estimated 1 week)

#### 12.7.1 Developer Documentation

**Files to Create/Update**:

1. **ARCHITECTURE.md** (500+ lines)
   - Design decisions and rationale
   - Module dependency graph
   - Service layer documentation
   - Component composition patterns
   - Testing strategy

2. **DEVELOPER_GUIDE.md** (400+ lines)
   - Setup instructions
   - Development workflow
   - Build commands
   - Debugging tips
   - Common tasks (adding a new tool, adding a service, etc.)

3. **API_DOCUMENTATION.md** (300+ lines)
   - Service interfaces with examples
   - Type definitions reference
   - Error handling patterns
   - Event system documentation

4. **MIGRATION_GUIDE.md** (200 lines)
   - Changes from v1.6.x to v2.0.0
   - Breaking changes (none intended)
   - New features and capabilities
   - TypeScript adoption guide

5. **TESTING_GUIDE.md** (200 lines)
   - How to run tests
   - Writing new tests
   - Coverage goals
   - CI/CD integration

#### 12.7.2 User Documentation

**Files to Create/Update**:

1. **README.md** - Update for v2.0.0
   - New feature highlights
   - Installation instructions (if applicable)
   - Build process overview (for contributors)

2. **CHANGELOG.md** - Add v2.0.0 section
   - Complete list of changes
   - Performance improvements
   - Developer experience improvements
   - Migration notes

3. **CLAUDE.md** - Update project guidance
   - New architecture overview
   - Development setup
   - Build process
   - Testing procedures

#### 12.7.3 Release Process

**Pre-Release Checklist**:
- ✅ All 80+ tests passing
- ✅ No TypeScript errors (strict mode)
- ✅ ESLint clean (0 warnings)
- ✅ Coverage ≥80%
- ✅ Bundle size optimized
- ✅ All browsers tested
- ✅ Documentation complete
- ✅ CHANGELOG updated
- ✅ Version bumped to v2.0.0

**Release Steps**:
1. Create release branch: `git checkout -b release/v2.0.0`
2. Update version in package.json to 2.0.0
3. Run final tests: `npm run test:coverage`
4. Build production: `npm run build`
5. Create release commit: `git commit -m "Release: v2.0.0 - Architecture Refactor with TypeScript & Vite"`
6. Create release tag: `git tag v2.0.0`
7. Create GitHub release with changelog
8. Deploy dist/ folder to production

**Deliverables**:
- ✅ Complete API documentation
- ✅ Developer guide for contributors
- ✅ User-facing changelog
- ✅ GitHub release notes
- ✅ Migration guide for users

**Estimated Effort**: 1 week

---

## 📊 Effort Estimation Summary

| Phase | Component | Effort | Risk |
|-------|-----------|--------|------|
| **12.1** | Build System Setup | 2 weeks | Low |
| **12.2** | TypeScript Migration | 3 weeks | Medium |
| **12.3** | Component Layer | 2 weeks | Medium |
| **12.4** | Tool Applications | 3 weeks | High |
| **12.5** | Integration & Optimization | 1 week | Low |
| **12.6** | Testing & Validation | 2 weeks | Low |
| **12.7** | Documentation & Release | 1 week | Low |
| **TOTAL** | **Phase 12** | **6-8 weeks** | **Medium** |

**Resource Requirements**:
- 1 Senior Developer (TypeScript, Vite, testing)
- Part-time Code Reviewer (1-2 hours/week)
- No specialized infrastructure needed

---

## 🔄 Migration Strategy: Zero Downtime Approach

### Version Coexistence

**Option 1: Keep v1.6.x Live During Development**
- v1.6.x remains production while v2.0.0 developed
- Users don't experience disruption
- Allows gradual migration testing
- URL routing: `v1.6/` vs. `v2.0/` subdirectories

**Option 2: Feature Flag Approach** (Recommended)
- Both versions deployed simultaneously
- Feature flag determines which version users see
- Staged rollout: 10% users → 50% users → 100% users
- Instant rollback if issues detected

**localStorage Compatibility**:
- Migrate localStorage schema on first load
- Support reading v1.6.x data
- Write new data in v2.0.0 format
- Version key: `xivdyetools_version`

---

## ⚠️ Risk Mitigation

### High Risk Areas

**1. Algorithm Correctness**
- **Risk**: Color conversion and Brettel matrices might have subtle bugs
- **Mitigation**:
  - Comprehensive test suite with known test cases
  - Byte-by-byte comparison with v1.6.x outputs
  - User testing with color-blind users
  - Slow, careful migration of algorithms

**2. Performance Regressions**
- **Risk**: Bundle size or load time worse than v1.6.x
- **Mitigation**:
  - Performance budgets in Vite config
  - Baseline metrics from v1.6.x
  - Regular bundle analysis
  - Lighthouse CI integration

**3. Browser Compatibility**
- **Risk**: ES2020 features not supported in older browsers
- **Mitigation**:
  - Target ES2020 (drops IE11 support - acceptable)
  - Polyfill critical features if needed
  - Test in all target browsers from day 1
  - Drop-in replacement for older users (stay on v1.6.x)

### Medium Risk Areas

**1. Component Integration**
- **Mitigation**: Comprehensive integration tests, staged rollout

**2. Service Layer Refactoring**
- **Mitigation**: Pair each service with extensive unit tests

**3. TypeScript Strict Mode**
- **Mitigation**: Enable strict mode early, fix issues incrementally

---

## 📈 Success Metrics

**Code Quality**:
- ✅ 100% TypeScript strict mode compliance
- ✅ 0 ESLint warnings
- ✅ ≥80% test coverage
- ✅ 0 console errors/warnings in any browser

**Performance**:
- ✅ Bundle size ≤500KB (gzipped)
- ✅ Load time <2 seconds
- ✅ Time to interactive <2 seconds
- ✅ Lighthouse score ≥90

**Functionality**:
- ✅ 100% feature parity with v1.6.x
- ✅ All 5 tools working identically
- ✅ All themes rendering correctly
- ✅ localStorage persistence maintained

**Developer Experience**:
- ✅ Build time <5 seconds (development)
- ✅ HMR working smoothly
- ✅ Debugging with sourcemaps
- ✅ Clear error messages

---

## 🎯 Conclusion

Phase 12 represents the most ambitious undertaking in XIVDyeTools history, transforming a proven monolithic application into a modern, maintainable, type-safe codebase while maintaining 100% functional compatibility.

**Investment**: 6-8 weeks of focused development
**Return**:
- 70% reduction in code duplication
- Modern TypeScript-first architecture
- Significantly improved developer experience
- Foundation for future enhancements
- Industry-standard tooling

**Timeline**: Recommended start after v1.6.x stabilizes with 0 known issues (current state)

**Go/No-Go Decision**: Phase 12 is recommended to proceed when:
- ✅ Phase 11 fully complete and deployed
- ✅ v1.6.x has been in production for 1-2 weeks with 0 critical issues
- ✅ Team bandwidth available for 6-8 weeks of development
- ✅ TypeScript expertise available

---

**Document Version**: 1.0
**Created**: November 16, 2025
**Status**: Ready for Review
**Next Step**: Executive approval to proceed with Phase 12.1
