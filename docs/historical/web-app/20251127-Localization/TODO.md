# Localization Implementation TODO

**Feature:** Multi-language support (i18n)
**Target Version:** 2.1.0
**Date Started:** 2025-11-27

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Update Core Dependency
- [x] Update `package.json`: `xivdyetools-core` from `^1.1.0` to `^1.2.0`
- [x] Run `npm install`
- [x] Verify core LocalizationService is available

### 1.2 Create Type Definitions
- [x] Create `src/shared/i18n-types.ts`
  - [x] Define `LocaleCode` type (`'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh'`)
  - [x] Define `LocaleDisplay` interface
  - [x] Define web app translation key types (optional, for strict typing)

### 1.3 Create LanguageService
- [x] Create `src/services/language-service.ts`
  - [x] Implement `initialize()` - load saved locale or detect browser
  - [x] Implement `setLocale(locale)` - set locale in core + load web translations
  - [x] Implement `getCurrentLocale()` - return current locale
  - [x] Implement `subscribe(listener)` - return unsubscribe function
  - [x] Implement `t(key)` - get web app translation with fallback
  - [x] Implement proxy methods: `getDyeName()`, `getCategory()`, `getHarmonyType()`, `getVisionType()`, `getAcquisition()`
  - [x] Implement `detectBrowserLocale()` - parse navigator.language
  - [x] Implement `loadWebAppTranslations(locale)` - dynamic import of JSON

### 1.4 Update Constants
- [x] Modify `src/shared/constants.ts`
  - [x] Add `SUPPORTED_LOCALES` array
  - [x] Add `DEFAULT_LOCALE` constant
  - [x] Add `LOCALE_DISPLAY_INFO` array with flags and names
  - [x] Add `STORAGE_KEYS.LOCALE`

### 1.5 Update Service Exports
- [x] Modify `src/services/index.ts` to export `LanguageService`

**Git Commit:** `feat(i18n): add LanguageService and localization foundation` ✅

---

## Phase 2: UI Component ✅ COMPLETE

### 2.1 Create LanguageSelector Component
- [x] Create `src/components/language-selector.ts`
  - [x] Extend `BaseComponent`
  - [x] Implement `render()` - button + dropdown with flags
  - [x] Implement `bindEvents()` - toggle, selection, outside click, ESC
  - [x] Implement `onMount()` - subscribe to LanguageService and ThemeService
  - [x] Implement `onUnmount()` - cleanup subscriptions
  - [x] Add `close-other-dropdowns` event coordination

### 2.2 Update AppLayout
- [x] Modify `src/components/app-layout.ts`
  - [x] Add `#language-selector-container` div to header right container
  - [x] Position between tools dropdown and theme switcher
  - [x] Initialize `LanguageSelector` in `onMount()`
  - [x] Destroy `LanguageSelector` in `destroy()`

### 2.3 Update Component Exports
- [x] Modify `src/components/index.ts` to export `LanguageSelector`

**Git Commit:** `feat(i18n): add LanguageSelector component to header` ✅

---

## Phase 3: Translation Files ✅ COMPLETE

### 3.1 Create English Translations (Source of Truth)
- [x] Create `src/locales/` directory
- [x] Create `src/locales/en.json` with all ~180 strings
  - [x] `app` section (title, loading, error)
  - [x] `header` section (tools, theme, language)
  - [x] `footer` section (version, createdBy, disclaimer)
  - [x] `tools` section (all 5 tools: title, shortName, description, subtitle)
  - [x] `common` section (generate, select, copy, export, etc.)
  - [x] `harmony` section (tool-specific)
  - [x] `matcher` section (tool-specific)
  - [x] `accessibility` section (tool-specific)
  - [x] `comparison` section (tool-specific)
  - [x] `mixer` section (tool-specific)
  - [x] `filters` section
  - [x] `marketBoard` section
  - [x] `export` section
  - [x] `errors` section
  - [x] `success` section
  - [x] `themes` section

### 3.2 Create Translated Versions
- [x] Create `src/locales/ja.json` (Japanese)
- [x] Create `src/locales/de.json` (German)
- [x] Create `src/locales/fr.json` (French)
- [x] Create `src/locales/ko.json` (Korean)
- [x] Create `src/locales/zh.json` (Chinese)

**Git Commit:** `feat(i18n): add translation files for 6 languages` ✅

---

## Phase 4: Component Refactoring ✅ COMPLETE

### 4.1 Core Components ✅
- [x] Update `src/main.ts`
  - [x] Import `LanguageService`
  - [x] Call `LanguageService.initialize()` before app init
  - [x] Subscribe to language changes for tool navigation updates

### 4.2 Navigation Components ✅
- [x] Update `src/components/tools-dropdown.ts`
  - [x] Replace hardcoded "Tools" label with `LanguageService.t()`
  - [x] Tool names passed from main.ts already localized
- [x] Update `src/components/mobile-bottom-nav.ts`
  - [x] Tool names passed from main.ts already localized
  - [x] Recreated on language change

### 4.3 Layout Components ✅
- [x] Update `src/components/app-layout.ts`
  - [x] Localize header title
  - [x] Localize footer text
  - [x] Subscribe to language changes
- [x] Update `src/components/theme-switcher.ts`
  - [x] Localize "Theme" button label
  - [x] Localize theme display names
  - [x] Subscribe to language changes

**Git Commit:** `feat(i18n): refactor core components to use localization` ✅

### 4.4 Tool Components ✅
- [x] Update `src/components/harmony-generator-tool.ts`
  - [x] Localize title, subtitle
  - [x] Localize harmony type names (use core `getHarmonyType()`)
  - [x] Localize all UI labels
  - [x] Subscribe to language changes
  - [x] Fixed hyphenated ID to camelCase conversion for harmony type lookups
- [x] Update `src/components/color-matcher-tool.ts`
  - [x] Localize all UI text
  - [x] Subscribe to language changes
- [x] Update `src/components/accessibility-checker-tool.ts`
  - [x] Localize vision type labels (use core `getVisionType()`)
  - [x] Localize all UI text
  - [x] Subscribe to language changes
- [x] Update `src/components/dye-comparison-tool.ts`
  - [x] Localize all UI text
  - [x] Subscribe to language changes
- [x] Update `src/components/dye-mixer-tool.ts`
  - [x] Localize all UI text
  - [x] Subscribe to language changes

### 4.5 Supporting Components ✅
- [x] Update `src/components/dye-selector.ts`
  - [x] Localize dye names (use core `getDyeName()`)
  - [x] Localize category names (use core `getCategory()`)
  - [x] Subscribe to language changes
- [x] Update `src/components/dye-filters.ts`
  - [x] Localize filter labels
  - [x] Subscribe to language changes
- [x] Update `src/components/market-board.ts`
  - [x] Localize category labels
  - [x] Localize UI text
  - [x] Subscribe to language changes
- [x] Update `src/components/palette-exporter.ts`
  - [x] Localize export options
  - [x] Subscribe to language changes

### 4.6 Display Components ✅
- [x] Update `src/components/image-upload-display.ts`
  - [x] Localize upload prompts, privacy notice, supported formats
- [x] Update `src/components/color-picker-display.ts`
  - [x] Localize color picker labels and buttons
- [x] Update `src/components/harmony-type.ts`
  - [x] Localize deviance labels and dye card content
- [x] Update `src/components/color-wheel-display.ts`
  - [x] Localize wheel labels
- [x] Update `src/components/color-display.ts`
  - [x] Localize color information labels
- [x] Update `src/components/color-interpolation-display.ts`
  - [x] Localize step labels
- [x] Update `src/components/color-distance-matrix.ts`
  - [x] Localize matrix headers
- [x] Update `src/components/dye-comparison-chart.ts`
  - [x] Localize chart title and labels

**Git Commit:** `feat(i18n): complete Phase 4 - all components localized` ✅

---

## Phase 5: Testing & Documentation

### 5.1 Unit Tests
- [ ] Create `src/services/__tests__/language-service.test.ts`
  - [ ] Test initialization
  - [ ] Test locale switching
  - [ ] Test subscriber notification
  - [ ] Test translation retrieval
  - [ ] Test fallback behavior
- [ ] Create `src/components/__tests__/language-selector.test.ts`
  - [ ] Test render
  - [ ] Test dropdown behavior
  - [ ] Test language selection

### 5.2 Documentation
- [ ] Update `package.json` version to `2.1.0`
- [ ] Update project `CLAUDE.md` with localization section
- [ ] Update `README.md` to document language support

### 5.3 Manual Testing
- [ ] Test all 6 languages
- [ ] Test browser language detection
- [ ] Test localStorage persistence
- [ ] Test mobile bottom nav
- [ ] Verify dye names use official translations
- [ ] Verify no regressions

**Git Commit:** `test(i18n): add localization tests and documentation`

---

## Post-Implementation

### Native Speaker Review
- [ ] English - self-review
- [ ] Japanese - needs review
- [ ] German - needs review
- [ ] French - needs review
- [ ] Korean - needs review
- [ ] Chinese - needs review

### Final Steps
- [ ] Address any review feedback
- [ ] Final testing pass
- [ ] Version bump and release

---

## Progress Tracking

| Phase | Status | Commits |
|-------|--------|---------|
| Phase 1: Foundation | ✅ Complete | `feat(i18n): add LanguageService foundation and English translations` |
| Phase 2: UI Component | ✅ Complete | `feat(i18n): add LanguageSelector component to header` |
| Phase 3: Translation Files | ✅ Complete | `feat(i18n): add translation files for all 6 languages` |
| Phase 4: Component Refactoring | ✅ Complete | `feat(i18n): complete Phase 4 - all components localized` |
| Phase 5: Testing & Documentation | ⏳ Pending | |

**Current State:** All UI components fully localized! 21 components refactored with proper i18n support. All 5 tools, supporting components, and display components now use `LanguageService.t()` for UI strings and core library methods (`getDyeName()`, `getCategory()`, `getHarmonyType()`, `getVisionType()`) for FFXIV terminology. Remaining: unit tests and documentation updates.
