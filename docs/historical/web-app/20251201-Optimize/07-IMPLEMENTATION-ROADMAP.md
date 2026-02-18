# Implementation Roadmap

## Overview

This roadmap prioritizes optimizations by impact and effort. Quick wins are listed first, followed by progressively larger refactors.

---

## Phase 1: Quick Wins (1-2 hours each)

### 1.1 Move showToast() to ToastService

**File:** `color-matcher-tool.ts`
**Lines:** 1379-1445
**Effort:** 30 minutes

**Current:**
```typescript
// Inline toast implementation (66 lines)
private showToast(message: string, type: 'success' | 'error' = 'success'): void {
  // Custom toast rendering...
}
```

**Change to:**
```typescript
import { ToastService } from '@services/toast-service';

// Replace all showToast calls:
ToastService.success(LanguageService.t('matcher.colorCopied'));
ToastService.error(LanguageService.t('matcher.error'));
```

**Impact:** Removes 66 lines, ensures consistent toast styling.

---

### 1.2 Implement Incremental Language Updates

**Files:** All tool components
**Effort:** 2 hours total

**Pattern to copy from** `app-layout.ts` (lines 341-363):

```typescript
private updateLocalizedText(): void {
  const title = this.querySelector<HTMLElement>('#tool-title');
  if (title) {
    title.textContent = LanguageService.t('tools.XXX.title');
  }
  // Update other text elements...
}

onMount(): void {
  LanguageService.subscribe(() => {
    this.updateLocalizedText();  // Not this.update()!
  });
}
```

**Apply to:**
- [ ] `color-matcher-tool.ts`
- [ ] `harmony-generator-tool.ts`
- [ ] `dye-mixer-tool.ts`
- [ ] `dye-comparison-tool.ts`
- [ ] `accessibility-checker-tool.ts`

**Impact:** 80% reduction in language change overhead.

---

### 1.3 Fix Event Listener Cleanup

**File:** `color-matcher-tool.ts`
**Effort:** 30 minutes

**Fix scroll listener (lines 554-560):**
```typescript
// Before:
canvasContainer.addEventListener('scroll', () => { ... }, { passive: true });

// After:
this.on(canvasContainer, 'scroll', () => {
  this.previewOverlay?.hidePreview();
});
```

**Fix keyboard listener (lines 820-840):**
```typescript
// Before:
document.addEventListener('keydown', (e) => { ... });

// After:
this.on(document, 'keydown', this.handleKeyboardShortcuts.bind(this));
```

**Impact:** Prevents memory leaks during tool switching.

---

### 1.4 Add Card Styling Constant

**File:** `shared/constants.ts` (new or existing)
**Effort:** 30 minutes

```typescript
// Add constant:
export const CARD_CLASSES =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6';

export const CARD_CLASSES_COMPACT =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4';
```

**Update usages across components via find/replace.**

**Impact:** Single source of truth, easier theme updates.

---

### 1.5 Cache Color Distance Calculations

**File:** `color-matcher-tool.ts`
**Effort:** 1 hour

```typescript
// Define cached type:
interface MatchedDye extends Dye {
  distance: number;
}

// In refreshResults() when finding matches:
this.matchedDyes = matches.map(dye => ({
  ...dye,
  distance: ColorService.getColorDistance(this.lastSampledColor, dye.hex)
}));

// In renderDyeCard(), use cached value:
const distance = dye.distance;  // Instead of recalculating
```

**Impact:** Eliminates O(n) recalculation on render.

---

## Phase 2: Medium Effort (4-6 hours each)

### 2.1 Extract MarketBoard Initialization Pattern

**Create:** `services/pricing-mixin.ts`
**Effort:** 4 hours

**Implementation:**
```typescript
export interface PricingState {
  showPrices: boolean;
  priceData: Map<number, PriceData>;
  marketBoard: MarketBoard | null;
}

export const PricingMixin = {
  initMarketBoard(this: BaseComponent & PricingState, container: HTMLElement): void {
    if (!this.marketBoard) {
      this.marketBoard = new MarketBoard(container);
      this.setupMarketBoardListeners();
    }
  },

  setupMarketBoardListeners(this: BaseComponent & PricingState): void {
    this.marketBoard?.on('server-changed', () => { ... });
    this.marketBoard?.on('prices-loaded', (e) => {
      this.priceData = e.detail.prices;
      this.showPrices = true;
      this.onPricesLoaded?.();
    });
    // etc.
  },

  cleanupMarketBoard(this: BaseComponent & PricingState): void {
    this.marketBoard?.destroy();
    this.marketBoard = null;
  }
};
```

**Update tools to use mixin.**

**Impact:** Removes ~150 lines of duplicate code across 4 tools.

---

### 2.2 Create ToolHeader Component

**Create:** `components/tool-header.ts`
**Effort:** 2 hours

```typescript
export class ToolHeader extends BaseComponent {
  constructor(
    container: HTMLElement,
    private titleKey: string,
    private subtitleKey: string
  ) {
    super(container);
  }

  render(): void {
    const wrapper = this.createElement('div', { className: 'space-y-2 text-center' });

    const heading = this.createElement('h2', {
      id: 'tool-title',
      textContent: LanguageService.t(this.titleKey),
      className: 'text-3xl font-bold',
      attributes: { style: 'color: var(--theme-text);' },
    });

    const subtitle = this.createElement('p', {
      id: 'tool-subtitle',
      textContent: LanguageService.t(this.subtitleKey),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    wrapper.appendChild(heading);
    wrapper.appendChild(subtitle);
    this.container.appendChild(wrapper);
  }

  updateText(): void {
    const title = this.querySelector<HTMLElement>('#tool-title');
    const subtitle = this.querySelector<HTMLElement>('#tool-subtitle');
    if (title) title.textContent = LanguageService.t(this.titleKey);
    if (subtitle) subtitle.textContent = LanguageService.t(this.subtitleKey);
  }
}
```

**Update tools to use:**
```typescript
this.header = new ToolHeader(headerContainer, 'tools.matcher.title', 'tools.matcher.subtitle');
this.header.init();
```

**Impact:** Reduces ~100 lines, ensures consistent headers.

---

### 2.3 Add Browser API Type Declarations

**Create:** `shared/browser-api-types.ts`
**Effort:** 1 hour

See [03-TYPE-SAFETY.md](./03-TYPE-SAFETY.md#4-recommended-type-declarations-file) for full implementation.

**Impact:** Removes `as any` casts, improves type safety.

---

### 2.4 Create DyeCardRenderer Component

**Create:** `components/dye-card-renderer.ts`
**Effort:** 3 hours

Extract dye card rendering from ColorMatcherTool for reuse across tools.

**Impact:** Consistent dye card display, shared styling.

---

## Phase 3: Larger Refactors (8-12 hours each)

### 3.1 Split ColorMatcherTool

**Effort:** 8-10 hours

**Extract:**
1. `ImageZoomController` (~180 lines)
2. `RecentColorsPanel` (~130 lines)

**Result:**
```
color-matcher-tool.ts (~1,100 lines, down from 1,446)
├── Uses: ImageZoomController
├── Uses: RecentColorsPanel
├── Uses: ToolHeader
└── Uses: ToastService
```

---

### 3.2 Create DyeSelectionContext

**Create:** `services/dye-selection-context.ts`
**Effort:** 6 hours

See [04-DESIGN-PATTERNS.md](./04-DESIGN-PATTERNS.md#21-no-unified-dye-selection-context) for full implementation.

**Impact:** Enables cross-tool features like "compare from harmony".

---

### 3.3 Refactor DyeSelector

**Effort:** 8 hours

Split into:
- `DyeSearchBox` - Search input
- `DyeGrid` - Display grid
- `DyeSelector` - Orchestrator

---

## Phase 4: Long-term (Multi-session)

### 4.1 Fix 93 Failing Tests

**Effort:** 4-6 hours

1. Run tests to identify failures
2. Categorize by cause
3. Update assertions and mocks

---

### 4.2 Add Missing Test Coverage

**Effort:** 22-30 hours total

Priority order:
1. `modal-container.ts` (2h)
2. `dye-action-dropdown.ts` (2h)
3. `palette-exporter.ts` (2h)
4. `camera-preview-modal.ts` (3h)
5. Remaining 12 components (8-12h)

---

### 4.3 Bundle Size Optimization

**Effort:** 4-6 hours

1. Run bundle analyzer
2. Lazy load modal components
3. Create shared-components chunk if needed
4. Add bundle size CI checks

---

## Summary by Priority

### P0 - Do First (High Impact, Low Effort)
| Task | Effort | Impact |
|------|--------|--------|
| Incremental language updates | 2h | High |
| Cache color distance | 1h | High |
| Fix event listener cleanup | 30min | Medium |

### P1 - Important (High Impact, Medium Effort)
| Task | Effort | Impact |
|------|--------|--------|
| Extract MarketBoard mixin | 4h | High |
| Create ToolHeader | 2h | Medium |
| Add browser API types | 1h | Medium |

### P2 - Nice to Have (Medium Impact, High Effort)
| Task | Effort | Impact |
|------|--------|--------|
| Split ColorMatcherTool | 8-10h | Medium |
| Create DyeSelectionContext | 6h | Medium |
| Add missing tests | 22-30h | Medium |

### P3 - Future (Lower Priority)
| Task | Effort | Impact |
|------|--------|--------|
| Bundle optimization | 4-6h | Low |
| Refactor DyeSelector | 8h | Low |

---

## Tracking Template

Use this template to track progress:

```markdown
## Optimization Progress

### Phase 1: Quick Wins
- [x] Move showToast to ToastService
- [x] Implement incremental language updates (5 tools)
- [x] Fix event listener cleanup
- [x] Add card styling constant
- [x] Cache color distance calculations

### Phase 2: Medium Effort
- [x] Extract MarketBoard mixin
- [x] Create ToolHeader component
- [x] Add browser API types
- [x] Create DyeCardRenderer

### Phase 3: Larger Refactors
- [x] Split ColorMatcherTool
- [x] Create DyeSelectionContext
- [x] Refactor DyeSelector

### Phase 4: Long-term
- [ ] Fix 93 failing tests
- [ ] Add missing test coverage (16 components)
- [ ] Bundle size optimization
```
