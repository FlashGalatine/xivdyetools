# XIV Dye Tools Web App - Optimization Opportunities

**Date:** December 24, 2025
**Version Audited:** 3.1.0

---

## Table of Contents

1. [Duplicate Code Patterns](#1-duplicate-code-patterns)
2. [Performance Issues](#2-performance-issues)
3. [Complex Logic to Simplify](#3-complex-logic-to-simplify)
4. [Code Simplification Opportunities](#4-code-simplification-opportunities)
5. [Implementation Recommendations](#5-implementation-recommendations)

---

## 1. Duplicate Code Patterns

### 1.1 SVG Icon Definition Duplication

**Issue:** Multiple SVG icon definitions are duplicated across components.

| Icon | Occurrences | Files |
|------|-------------|-------|
| `ICON_FILTER` | 4 | harmony-tool.ts, matcher-tool.ts, mixer-tool.ts, budget-tool.ts |
| `ICON_MARKET` | 4 | harmony-tool.ts, matcher-tool.ts, mixer-tool.ts, budget-tool.ts |
| `ICON_COINS` | 3 | matcher-tool.ts, mixer-tool.ts, budget-tool.ts |
| `ICON_BEAKER` | 3 | Multiple tool files |
| `ICON_SETTINGS` | 2 | matcher-tool.ts, others |
| `ICON_PALETTE` | 2 | matcher-tool.ts, others |
| `ICON_EXPORT` | 2 | harmony-tool.ts, others |

**Impact:** ~100+ bytes per icon × multiple occurrences = 5-10KB wasted

**Recommendation:** Create centralized `src/shared/ui-icons.ts`:

```typescript
// src/shared/ui-icons.ts
export const UI_ICONS = {
  FILTER: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ...>...</svg>`,
  MARKET: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ...>...</svg>`,
  COINS: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ...>...</svg>`,
  // ... etc
} as const;
```

---

### 1.2 Subscription Management Pattern Duplication

**Issue:** 21+ components have identical subscription cleanup patterns with multiple null-initialized fields.

**Example pattern appearing in each component:**

```typescript
private unsubscribeFavorites: (() => void) | null = null;
private languageUnsubscribe: (() => void) | null = null;
private unsubscribeTheme: (() => void) | null = null;
private routerUnsubscribe: (() => void) | null = null;
// ... often 5-25 such fields per component
```

**Affected Files:**
- `dye-selector.ts` (5+ subscriptions)
- `dye-grid.ts` (5+ subscriptions)
- `dye-filters.ts` (5+ subscriptions)
- `harmony-tool.ts` (25 subscriptions)
- `matcher-tool.ts` (37 subscriptions)
- `mixer-tool.ts` (23 subscriptions)
- 15+ other components

**Recommendation:** Extract a `SubscriptionManager` utility:

```typescript
// src/shared/subscription-manager.ts
export class SubscriptionManager {
  private subscriptions: Array<() => void> = [];

  add(unsubscribe: () => void): void {
    this.subscriptions.push(unsubscribe);
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach(fn => fn());
    this.subscriptions = [];
  }
}

// Usage in components:
private subs = new SubscriptionManager();

constructor() {
  this.subs.add(ThemeService.subscribe(this.onThemeChange));
  this.subs.add(LanguageService.subscribe(this.onLanguageChange));
}

destroy(): void {
  this.subs.unsubscribeAll();
}
```

---

### 1.3 clearContainer() Pattern Repetition

**Issue:** 53 occurrences of the same 3-line pattern:

```typescript
clearContainer(this.container);
this.element = wrapper;
this.container.appendChild(this.element);
```

**Recommendation:** Add helper to `BaseComponent`:

```typescript
// In base-component.ts
protected renderToContainer(element: HTMLElement): void {
  clearContainer(this.container);
  this.element = element;
  this.container.appendChild(element);
}

// Usage:
renderContent(): void {
  const wrapper = this.createElement('div');
  // ... build wrapper
  this.renderToContainer(wrapper);  // Single line instead of 3
}
```

---

### 1.4 Try-Catch Error Handling Duplication

**Issue:** StorageService has 14 methods with nearly identical try-catch patterns:

```typescript
static getItem<T>(key: string, defaultValue: T): T {
  try {
    if (!this.isAvailable()) return defaultValue;
    const value = localStorage.getItem(this.prefix + key);
    if (value === null) return defaultValue;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.warn(`Failed to get ${key}`, error);
    return defaultValue;
  }
}
```

**Recommendation:** Extract safety wrapper:

```typescript
private static safeExecute<T>(
  operation: string,
  fn: () => T,
  errorDefault: T
): T {
  try {
    if (!this.isAvailable()) return errorDefault;
    return fn();
  } catch (error) {
    logger.warn(`Storage operation failed: ${operation}`, error);
    return errorDefault;
  }
}

// Usage:
static getItem<T>(key: string, defaultValue: T): T {
  return this.safeExecute(`get(${key})`, () => {
    const value = localStorage.getItem(this.prefix + key);
    return value ? JSON.parse(value) as T : defaultValue;
  }, defaultValue);
}
```

---

### 1.5 Options Normalization Pattern

**Issue:** 15+ components repeat the same options defaults pattern:

```typescript
// In DyeSelector
this.options = {
  maxSelections: options.maxSelections ?? 4,
  allowMultiple: options.allowMultiple ?? true,
  allowDuplicates: options.allowDuplicates ?? false,
  showCategories: options.showCategories ?? true,
  // ... 5+ more lines
};
```

**Recommendation:** Create generic utility:

```typescript
// src/shared/utils.ts
export function normalizeOptions<T extends Record<string, unknown>>(
  provided: Partial<T>,
  defaults: T
): T {
  return { ...defaults, ...provided };
}

// Define defaults once
const DYE_SELECTOR_DEFAULTS: DyeSelectorOptions = {
  maxSelections: 4,
  allowMultiple: true,
  allowDuplicates: false,
  showCategories: true,
};

// Usage
this.options = normalizeOptions(options, DYE_SELECTOR_DEFAULTS);
```

---

## 2. Performance Issues

### 2.1 Unnecessary Re-renders in BaseComponent

**Issue:** `update()` unbinds and rebinds ALL events on every state change:

```typescript
update(): void {
  this.unbindAllEvents();  // Removes ALL listeners
  this.render();
  this.bindEvents();       // Reattaches ALL listeners
}
```

**Impact:** Components with frequent updates (dye-grid with 136+ cards) have unnecessary overhead.

**Recommendation:** Implement selective rebinding:

```typescript
update(affectedSelectors?: string[]): void {
  if (affectedSelectors) {
    this.unbindEventsForSelectors(affectedSelectors);
  } else {
    this.unbindAllEvents();
  }
  this.render();
  this.bindEvents();
}
```

---

### 2.2 Missing Memoization for Expensive Operations

**Issue:** ColorService methods called repeatedly without caching:

**Example in harmony-tool.ts:**

```typescript
// Called on every render with same inputs
const harmonies = HARMONY_TYPE_IDS.map(({ id }) => ({
  id,
  colors: ColorService.getColorHarmony(this.selectedColor, id)  // No cache
}));
```

**Recommendation:** Add simple memoization:

```typescript
private harmonyCache = new Map<string, Color[]>();

private getCachedHarmony(color: string, type: string): Color[] {
  const key = `${color}:${type}`;
  if (!this.harmonyCache.has(key)) {
    this.harmonyCache.set(key, ColorService.getColorHarmony(color, type));
  }
  return this.harmonyCache.get(key)!;
}

// Clear cache when color changes
private onColorChange(): void {
  this.harmonyCache.clear();
}
```

---

### 2.3 StorageService.getSize() is O(n)

**Issue:** `getSize()` iterates through all localStorage items:

```typescript
static getSize(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  }
  return total;
}
```

**Impact:** If called frequently or in loops, performance degrades.

**Recommendation:** Cache the size and update incrementally on set/remove operations.

---

## 3. Complex Logic to Simplify

### 3.1 SecureStorage Class (280+ lines)

**File:** `storage-service.ts` lines 456-738

**Issue:** Complex LRU eviction, size index caching, and integrity checks all in one class.

**Current Structure:**
- 4 async methods
- 8 static helper methods
- 1 inner class
- Complex state management

**Recommendation:** Split into focused classes:
- `SecureStorageCore` - Basic encrypted storage
- `LRUEvictionPolicy` - Reusable LRU cache logic
- `IntegrityChecker` - Checksum validation

---

### 3.2 HarmonyTool Complexity (1700+ lines)

**File:** `harmony-tool.ts`

**Issues:**
- 25+ private null fields tracking state
- Mixed concerns (selection, calculation, pricing, filtering, exporting)
- Complex panel management

**Recommendation:** Extract focused components:
- `HarmonyTypeSelector` - Harmony type selection
- `HarmonyVisualization` - Color wheel + cards
- `HarmonyPricing` - Market board integration
- `HarmonyStateManager` - Centralized state

---

### 3.3 MatcherTool State Scatter

**File:** `matcher-tool.ts`

**Issue:** State scattered across many fields:

```typescript
private selectedColor: string | null = null;
private currentImage: HTMLImageElement | null = null;
private imageDataUrl: string | null = null;
private matchedDyes: DyeWithDistance[] = [];
private recentColors: string[] = [];
private filteredDyes: Dye[] = [];
// ... more fields
```

**Recommendation:** Consolidate into single state object:

```typescript
interface MatcherState {
  selectedColor: string | null;
  image: { dataUrl: string | null; element: HTMLImageElement | null };
  results: { matched: DyeWithDistance[]; recent: string[] };
  filters: DyeFilterConfig;
}

private state: MatcherState = { /* defaults */ };
```

---

## 4. Code Simplification Opportunities

### 4.1 Theme Service Repetition

**Issue:** 11 theme definitions with repetitive structure:

```typescript
'standard-light': { primary: '#8B1A1A', background: '#D3D3D3', ... },
'standard-dark': { primary: '#E85A5A', background: '#2D2D2D', ... },
// ... 9 more with same structure
```

**Recommendation:** Use theme builder or factory:

```typescript
function createTheme(
  name: string,
  primary: string,
  background: string,
  overrides?: Partial<ThemePalette>
): ThemePalette {
  return {
    primary,
    background,
    text: contrastColor(background),
    // ... derive other values
    ...overrides
  };
}
```

---

### 4.2 Validation Functions

**Issue:** 6 nearly identical validation functions in `utils.ts`:

```typescript
export function isValidHexColor(hex: string): boolean {
  return PATTERNS.HEX_COLOR.test(hex);
}
export function isValidEmail(email: string): boolean {
  return PATTERNS.EMAIL.test(email);
}
// ... 4 more identical patterns
```

**Recommendation:** Use factory function:

```typescript
const createValidator = (pattern: RegExp) => (value: string) => pattern.test(value);

export const isValidHexColor = createValidator(PATTERNS.HEX_COLOR);
export const isValidEmail = createValidator(PATTERNS.EMAIL);
export const isValidURL = createValidator(PATTERNS.URL);
```

---

## 5. Implementation Recommendations

### Priority Matrix

| Change | Bundle Impact | Effort | Risk | Priority |
|--------|--------------|--------|------|----------|
| Consolidate icons | -5-10KB | Low | Low | **High** |
| SubscriptionManager | Maintainability | Medium | Low | **High** |
| clearContainer helper | -2-3KB | Low | Low | **Medium** |
| Try-catch wrapper | -3KB | Medium | Low | **Medium** |
| Add memoization | Performance | Medium | Low | **High** |
| Split HarmonyTool | Maintainability | High | Medium | **Low** |

### Suggested Implementation Order

1. **Phase 1 (Quick Wins)**
   - Create `ui-icons.ts` and update imports
   - Add `SubscriptionManager` utility
   - Add `renderToContainer()` to BaseComponent

2. **Phase 2 (Moderate Changes)**
   - Add memoization to expensive operations
   - Extract `safeExecute` wrapper in StorageService
   - Add `normalizeOptions` utility

3. **Phase 3 (Larger Refactors)**
   - Split complex tools into focused components
   - Refactor theme definitions
   - Extract LRU cache to utility

---

*Generated by Claude Code audit on December 24, 2025*
