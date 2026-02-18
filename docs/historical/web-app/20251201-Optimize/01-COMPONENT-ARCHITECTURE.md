# Component Architecture Issues

## Overview

The web app has grown to 30 component files with several showing signs of needing refactoring. Three main tool components exceed 1,000 lines, and multiple patterns are duplicated across tools.

---

## 1. Large Components Requiring Split

### 1.1 ColorMatcherTool (1,446 lines)

**File:** `src/components/color-matcher-tool.ts`

This component handles too many responsibilities:

| Lines | Responsibility | Recommendation |
|-------|---------------|----------------|
| 66-100 | Title rendering | Shared ToolHeader component |
| 397-579 | Image overlay rendering | Keep (core functionality) |
| 661-841 | Zoom controls | Extract ImageZoomController |
| 584-656 | Image interaction handlers | Keep with zoom controller |
| 1218-1347 | Recent colors history | Extract RecentColorsPanel |
| 1379-1445 | Toast notifications | Use ToastService instead |
| 845-933 | Price fetching | Extract via PricingMixin |

**Recommended Split:**

```
color-matcher-tool.ts (core orchestration)
├── image-zoom-controller.ts (~180 lines)
├── recent-colors-panel.ts (~130 lines)
└── Uses: ToolHeader, ToastService, PricingMixin
```

**Current Structure Issues:**
```typescript
// Lines 41-56: 16 private fields indicate too many responsibilities
export class ColorMatcherTool extends BaseComponent {
  private imageUpload: ImageUploadDisplay | null = null;
  private colorPicker: ColorPickerDisplay | null = null;
  private marketBoard: MarketBoard | null = null;
  private dyeFilters: DyeFilters | null = null;
  private matchedDyes: Dye[] = [];
  private priceData: Map<number, PriceData> = new Map();
  private showPrices: boolean = false;
  private sampleSize: number = 5;
  private zoomLevel: number = 100;
  private currentImage: HTMLImageElement | null = null;
  private lastSampledColor: string = '';
  private previewOverlay: DyePreviewOverlay | null = null;
  private samplePosition: { x: number; y: number } = { x: 0, y: 0 };
  private canvasContainerRef: HTMLElement | null = null;
  private canvasRef: HTMLCanvasElement | null = null;
  private recentColors: RecentColor[] = [];
  // ...
}
```

### 1.2 HarmonyGeneratorTool (1,291 lines)

**File:** `src/components/harmony-generator-tool.ts`

| Lines | Responsibility | Recommendation |
|-------|---------------|----------------|
| 107-350+ | Title and card rendering | Shared ToolHeader |
| 400+ | Harmony generation logic | Keep |
| 500+ | Event binding | Keep |
| Multiple | Market board handling | PricingMixin |

**Recommended Split:**

```
harmony-generator-tool.ts (orchestration)
├── harmony-results-display.ts (results rendering)
└── Uses: ToolHeader, PricingMixin
```

### 1.3 DyeMixerTool (1,004 lines)

**File:** `src/components/dye-mixer-tool.ts`

| Responsibility | Recommendation |
|----------------|----------------|
| Interpolation settings | Extract InterpolationSettingsPanel |
| Gradient visualization | Keep (core) |
| Palette export | Keep (delegates to PaletteExporter) |

---

## 2. Code Duplication Patterns

### 2.1 MarketBoard Initialization (Critical)

**Found in:** 4+ tool components

Each tool duplicates ~30 lines of MarketBoard setup:

```typescript
// Pattern repeated in:
// - color-matcher-tool.ts (lines 340-378)
// - harmony-generator-tool.ts
// - dye-comparison-tool.ts (lines 169-200+)
// - dye-mixer-tool.ts

if (marketBoardContainer && !this.marketBoard) {
  this.marketBoard = new MarketBoard(marketBoardContainer);
  await this.marketBoard.loadServerData();
  this.marketBoard.init();

  // Then 5-6 identical event listeners:
  this.marketBoard.on('server-changed', (e) => { ... });
  this.marketBoard.on('prices-loaded', (e) => { ... });
  this.marketBoard.on('prices-cleared', (e) => { ... });
  // etc.
}
```

**Recommendation:** Create `PricingMixin` or `ToolWithPricingBase`:

```typescript
// services/pricing-mixin.ts
export interface PricingState {
  showPrices: boolean;
  priceData: Map<number, PriceData>;
  marketBoard: MarketBoard | null;
}

export function withPricing<T extends BaseComponent>(
  Base: new (...args: any[]) => T
) {
  return class extends Base implements PricingState {
    showPrices = false;
    priceData = new Map<number, PriceData>();
    marketBoard: MarketBoard | null = null;

    initMarketBoard(container: HTMLElement): void { ... }
    handlePricesLoaded(data: Map<number, PriceData>): void { ... }
    cleanupMarketBoard(): void { ... }
  };
}
```

**Impact:** Reduces ~150 lines of duplicate code across 4+ tools.

### 2.2 Title Section Rendering (Moderate)

**Found in:** All 5 main tools

Each tool duplicates title/subtitle rendering:

```typescript
// Duplicated pattern in all tools:
const title = this.createElement('div', { className: 'space-y-2 text-center' });
const heading = this.createElement('h2', {
  textContent: LanguageService.t('tools.XXX.title'),
  className: 'text-3xl font-bold',
  attributes: { style: 'color: var(--theme-text);' },
});
const subtitle = this.createElement('p', {
  textContent: LanguageService.t('tools.XXX.subtitle'),
  attributes: { style: 'color: var(--theme-text-muted);' },
});
title.appendChild(heading);
title.appendChild(subtitle);
```

**Recommendation:** Create `ToolHeader` component:

```typescript
// components/tool-header.ts
export class ToolHeader extends BaseComponent {
  constructor(
    container: HTMLElement,
    private titleKey: string,
    private subtitleKey: string
  ) {
    super(container);
  }

  render(): void {
    // Centralized title rendering
  }
}
```

**Impact:** Reduces ~100 lines, ensures consistent styling.

### 2.3 Card Section Styling (Moderate)

**Found in:** 10+ components

The same card styling pattern appears throughout:

```typescript
// Repeated string in many components:
'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'
```

**Recommendation:** Add utility constant:

```typescript
// shared/constants.ts
export const CARD_CLASSES =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6';

export const CARD_CLASSES_COMPACT =
  'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4';
```

### 2.4 Toast Notification Pattern (Minor)

**File:** `color-matcher-tool.ts` lines 1379-1445

ColorMatcherTool has its own `showToast()` implementation instead of using `ToastService`:

```typescript
// Inline toast implementation (should use ToastService)
private showToast(message: string, type: 'success' | 'error' = 'success'): void {
  // ~66 lines of toast rendering logic
}
```

**Recommendation:** Use `ToastService.success()` / `ToastService.error()` consistently.

---

## 3. Component Complexity Analysis

### Components by Line Count

| Component | Lines | Status |
|-----------|-------|--------|
| color-matcher-tool.ts | 1,446 | Needs split |
| harmony-generator-tool.ts | 1,291 | Needs split |
| dye-mixer-tool.ts | 1,004 | Needs split |
| dye-selector.ts | ~700 | Monitor |
| app-layout.ts | ~600 | OK (root component) |
| base-component.ts | ~400 | OK (base class) |
| market-board.ts | ~350 | OK |
| Others | <300 | OK |

### Ideal Component Size Guidelines

- **Tool Components:** 300-500 lines max
- **Display Components:** 100-200 lines
- **Utility Components:** 50-100 lines
- **Base Classes:** Up to 400 lines acceptable

---

## 4. Action Items

### Immediate (1-2 sessions)
1. Move `showToast()` to use `ToastService` in ColorMatcherTool
2. Create `CARD_CLASSES` constant and update usages
3. Create `ToolHeader` component for title/subtitle

### Medium-term (3-4 sessions)
1. Extract `ImageZoomController` from ColorMatcherTool
2. Extract `RecentColorsPanel` from ColorMatcherTool
3. Create `PricingMixin` for MarketBoard initialization

### Long-term (5+ sessions)
1. Split HarmonyGeneratorTool into focused components
2. Review DyeMixerTool for extraction opportunities
3. Refactor DyeSelector into micro-components
