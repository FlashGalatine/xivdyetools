# Multi-Language Support Implementation Plan

**Date:** 2025-11-27
**Version Target:** 2.1.0
**Feature:** Internationalization (i18n) / Multi-language support

## Overview

Add multi-language support to xivdyetools-web-app using the LocalizationService from xivdyetools-core v1.2.0.

### Supported Languages

| Code | Language | Native Name | Flag |
|------|----------|-------------|------|
| `en` | English | English | 🇬🇧 |
| `ja` | Japanese | 日本語 | 🇯🇵 |
| `de` | German | Deutsch | 🇩🇪 |
| `fr` | French | Français | 🇫🇷 |
| `ko` | Korean | 한국어 | 🇰🇷 |
| `zh` | Chinese | 中文 | 🇨🇳 |

### Key Decisions

- **Translations**: Claude will provide initial translations for all 6 languages; native speakers will review for accuracy
- **Language Detection**: Auto-detect browser language on first visit (fallback to English if unsupported)
- **Implementation Scope**: Full implementation in one pass (all components refactored)
- **In-game Terminology**: Use official FFXIV translations from xivdyetools-core for dye names, categories, etc.

---

## Architecture

### Core Library Integration

The `xivdyetools-core` v1.2.0 `LocalizationService` provides:

```typescript
// Locale management
LocalizationService.setLocale(locale: LocaleCode): Promise<void>
LocalizationService.getCurrentLocale(): LocaleCode

// Translation retrieval (FFXIV in-game terminology)
LocalizationService.getDyeName(itemID: number): string | null
LocalizationService.getCategory(category: string): string
LocalizationService.getAcquisition(acquisition: string): string
LocalizationService.getHarmonyType(key: HarmonyTypeKey): string
LocalizationService.getVisionType(key: VisionType): string
LocalizationService.getLabel(key: TranslationKey): string
```

### Web App LanguageService

A new `LanguageService` wraps the core library and manages web-app-specific translations:

```typescript
// Initialization
LanguageService.initialize(): Promise<void>  // Load saved locale or detect browser

// Locale management
LanguageService.setLocale(locale: LocaleCode): Promise<void>
LanguageService.getCurrentLocale(): LocaleCode
LanguageService.getAvailableLocales(): LocaleDisplay[]

// Subscription (for component re-rendering)
LanguageService.subscribe(listener: (locale: LocaleCode) => void): () => void

// Web app translations
LanguageService.t(key: string): string  // Get web app UI string

// Proxy to core library (for convenience)
LanguageService.getDyeName(itemID: number): string | null
LanguageService.getCategory(category: string): string
LanguageService.getHarmonyType(key: string): string
LanguageService.getVisionType(key: string): string
LanguageService.getAcquisition(acquisition: string): string
```

### Pattern: Following ThemeService

The implementation follows the established `ThemeService` pattern:

1. **Singleton Service** - Static methods, single source of truth
2. **Subscription Model** - Components subscribe to changes and re-render
3. **Persistent Storage** - Preference saved to localStorage via `StorageService`
4. **Lazy Loading** - Translation files loaded on demand

---

## File Structure

### New Files to Create

```
src/
├── shared/
│   └── i18n-types.ts              # Type definitions
├── services/
│   └── language-service.ts        # Main service
├── components/
│   └── language-selector.ts       # UI dropdown component
└── locales/
    ├── en.json                    # English (source of truth)
    ├── ja.json                    # Japanese
    ├── de.json                    # German
    ├── fr.json                    # French
    ├── ko.json                    # Korean
    └── zh.json                    # Chinese
```

### Files to Modify

```
src/
├── shared/
│   └── constants.ts               # Add locale constants
├── services/
│   └── index.ts                   # Export LanguageService
├── components/
│   ├── app-layout.ts              # Add language selector to header
│   ├── tools-dropdown.ts          # Localize tool names
│   ├── mobile-bottom-nav.ts       # Localize short names
│   ├── theme-switcher.ts          # Localize theme names
│   ├── harmony-generator-tool.ts  # Localize all UI text
│   ├── color-matcher-tool.ts      # Localize all UI text
│   ├── accessibility-checker-tool.ts
│   ├── dye-comparison-tool.ts
│   ├── dye-mixer-tool.ts
│   ├── dye-selector.ts
│   ├── dye-filters.ts
│   ├── market-board.ts
│   ├── palette-exporter.ts
│   └── index.ts                   # Export LanguageSelector
└── main.ts                        # Initialize LanguageService
```

---

## Translation Key Structure

### Hierarchical Organization

```json
{
  "meta": {
    "locale": "en",
    "version": "1.0.0"
  },
  "app": {
    "title": "XIV Dye Tools",
    "loading": "Loading...",
    "error": "An error occurred"
  },
  "header": {
    "tools": "Tools",
    "theme": "Theme",
    "language": "Language"
  },
  "footer": {
    "version": "Version",
    "createdBy": "Created by {author} for the FFXIV community",
    "disclaimer": "FINAL FANTASY XIV © SQUARE ENIX..."
  },
  "tools": {
    "harmony": {
      "title": "Color Harmony Explorer",
      "shortName": "Harmony",
      "description": "Generate harmonious color palettes",
      "subtitle": "Discover harmonious color combinations..."
    },
    "matcher": { /* ... */ },
    "accessibility": { /* ... */ },
    "comparison": { /* ... */ },
    "mixer": { /* ... */ }
  },
  "common": {
    "generate": "Generate",
    "select": "Select",
    "copy": "Copy",
    "export": "Export",
    "clear": "Clear",
    "reset": "Reset",
    "save": "Save",
    "cancel": "Cancel",
    "close": "Close",
    "search": "Search",
    "filter": "Filter",
    "or": "or",
    "baseColor": "Base Color",
    "targetColor": "Target Color"
  },
  "harmony": { /* tool-specific strings */ },
  "matcher": { /* tool-specific strings */ },
  "accessibility": { /* tool-specific strings */ },
  "comparison": { /* tool-specific strings */ },
  "mixer": { /* tool-specific strings */ },
  "filters": { /* filter UI strings */ },
  "marketBoard": { /* market board strings */ },
  "export": { /* export dialog strings */ },
  "errors": { /* error messages */ },
  "success": { /* success messages */ },
  "themes": { /* theme display names */ }
}
```

---

## UI Component: LanguageSelector

### Placement

Located in the header's right container, between Tools dropdown and Theme switcher:

```
Header
├── Left: Logo + "XIV Dye Tools" + Version
└── Right container
    ├── Tools Dropdown (🛠️ Tools)
    ├── Language Selector (🇬🇧 English)  ← NEW
    └── Theme Switcher (🎨 Theme)
```

### Behavior

1. **Button Display**: Shows current language flag + native name
2. **Dropdown**: Lists all 6 languages with flags
3. **Selection**: Changes language immediately, persists to localStorage
4. **Coordination**: Dispatches `close-other-dropdowns` event to close Tools/Theme dropdowns
5. **Theme Awareness**: Updates styling when theme changes

---

## Component Re-rendering Strategy

When language changes, components need to re-render with new translations:

### Subscription Pattern

```typescript
// In component onMount()
this.languageUnsubscribe = LanguageService.subscribe(() => {
  this.update();  // Re-render with new translations
});

// In component onUnmount()
if (this.languageUnsubscribe) {
  this.languageUnsubscribe();
}
```

### Translation Usage

```typescript
// Before (hardcoded)
const heading = this.createElement('h2', {
  textContent: 'Color Harmony Explorer',
});

// After (localized)
const heading = this.createElement('h2', {
  textContent: LanguageService.t('tools.harmony.title'),
});

// For dye names (from core library)
const dyeName = LanguageService.getDyeName(dye.itemID);
```

---

## Implementation Phases

### Phase 1: Foundation
1. Update xivdyetools-core to v1.2.0
2. Create `src/shared/i18n-types.ts`
3. Create `src/services/language-service.ts`
4. Update `src/shared/constants.ts` with locale metadata
5. **Git commit**

### Phase 2: UI Component
1. Create `src/components/language-selector.ts`
2. Update `src/components/app-layout.ts` to include selector
3. Update component exports
4. **Git commit**

### Phase 3: Translation Files
1. Create `src/locales/` directory
2. Create `en.json` (source of truth with all ~250 strings)
3. Create translated versions: `ja.json`, `de.json`, `fr.json`, `ko.json`, `zh.json`
4. **Git commit**

### Phase 4: Component Refactoring
1. Update `app-layout.ts` - header/footer text
2. Update `tools-dropdown.ts` - tool names
3. Update `mobile-bottom-nav.ts` - short names
4. Update `theme-switcher.ts` - theme names
5. Update tool components (harmony, matcher, accessibility, comparison, mixer)
6. Update supporting components (dye-selector, dye-filters, market-board, etc.)
7. Update `main.ts` - initialize LanguageService
8. **Git commit**

### Phase 5: Testing & Documentation
1. Create `src/services/__tests__/language-service.test.ts`
2. Create `src/components/__tests__/language-selector.test.ts`
3. Update project documentation
4. **Git commit**

---

## Estimated String Counts

| Category | Estimated Count |
|----------|-----------------|
| Tool titles & descriptions | ~25 |
| Common UI labels | ~40 |
| Harmony tool specific | ~20 |
| Matcher tool specific | ~25 |
| Accessibility tool specific | ~15 |
| Comparison tool specific | ~20 |
| Mixer tool specific | ~15 |
| Market board | ~25 |
| Filters | ~15 |
| Export | ~10 |
| Errors & success messages | ~20 |
| Theme names | ~10 |
| Header/Footer | ~15 |
| **Total** | **~250** |

---

## Testing Strategy

### Unit Tests

1. **LanguageService**
   - Initialization with default locale
   - Locale switching
   - Subscriber notification
   - Translation retrieval
   - Fallback behavior

2. **LanguageSelector**
   - Renders correctly
   - Dropdown toggle behavior
   - Language selection
   - Theme-aware styling

### Manual Testing

1. Switch between all 6 languages
2. Verify all UI text updates
3. Verify dye names use official translations
4. Test browser language detection
5. Test localStorage persistence
6. Test on mobile (bottom nav)

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Translation quality | Native speaker review |
| Missing translations | Fallback to English |
| Performance (re-renders) | Lazy load translations, minimal DOM updates |
| Breaking existing functionality | Comprehensive testing |
| Flag emoji rendering | Some systems may not render flags; language name is always visible |

---

## Success Criteria

1. Language selector visible in header between Tools and Theme
2. All 6 languages selectable and functional
3. All UI text updates when language changes
4. Dye names use official FFXIV translations
5. Preference persists across sessions
6. Browser language auto-detected on first visit
7. No regression in existing functionality
8. Native speaker approval of translations
