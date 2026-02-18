# Bundle Optimization Opportunities

## Overview

The web app uses Vite for bundling with tool-specific code splitting. There are opportunities to improve tree-shaking and implement lazy loading for non-critical components.

---

## 1. Current Bundle Configuration

### Vite Config (vite.config.ts)

```typescript
// Manual chunks configuration (lines 39-65)
manualChunks: {
  'vendor-lit': ['lit', 'lit-html'],
  'tool-harmony': ['./src/components/harmony-generator-tool.ts'],
  'tool-matcher': ['./src/components/color-matcher-tool.ts'],
  'tool-comparison': ['./src/components/dye-comparison-tool.ts'],
  'tool-mixer': ['./src/components/dye-mixer-tool.ts'],
  'tool-accessibility': ['./src/components/accessibility-checker-tool.ts'],
}
```

### Current Chunk Strategy

| Chunk | Contents | Loaded |
|-------|----------|--------|
| vendor-lit | Lit framework | Always |
| main | Core app, BaseComponent, services | Always |
| tool-harmony | Harmony generator | On demand |
| tool-matcher | Color matcher | On demand |
| tool-comparison | Dye comparison | On demand |
| tool-mixer | Dye mixer | On demand |
| tool-accessibility | Accessibility checker | On demand |

---

## 2. Tree-Shaking Opportunities

### 2.1 Barrel Export Analysis

**File:** `components/index.ts`

Barrel exports may prevent tree-shaking:

```typescript
// components/index.ts
export { BaseComponent } from './base-component';
export { EmptyState, createEmptyState } from './empty-state';
export { InfoTooltip, addInfoIconTo } from './info-tooltip';
export { DyePreviewOverlay } from './dye-preview-overlay';
// ... all components exported
```

**Problem:** When any file imports from `@components/index`, the bundler may include all exports.

**Current pattern in tools:**
```typescript
// Tools import from barrel:
import { BaseComponent, EmptyState } from '@components/index';
```

**Better pattern:**
```typescript
// Direct imports allow better tree-shaking:
import { BaseComponent } from '@components/base-component';
import { EmptyState } from '@components/empty-state';
```

**Investigation needed:** Check actual bundle output to confirm if this is an issue with current Vite configuration.

### 2.2 Service Index Export

**File:** `services/index.ts`

Similar barrel export pattern:

```typescript
// services/index.ts
export { ColorService, dyeService } from 'xivdyetools-core';
export { ThemeService } from './theme-service';
export { StorageService } from './storage-service';
export { LanguageService } from './language-service';
// ... all services
```

**Note:** Re-exporting from `xivdyetools-core` is fine as core is always needed.

---

## 3. Lazy Loading Opportunities

### 3.1 Modal Components

Modals are not needed on initial load:

| Modal | Usage | Lazy Load Candidate |
|-------|-------|---------------------|
| `welcome-modal.ts` | First visit only | Yes |
| `changelog-modal.ts` | After updates | Yes |
| `saved-palettes-modal.ts` | User action | Yes |
| `camera-preview-modal.ts` | Camera feature | Yes |
| `shortcuts-panel.ts` | Keyboard shortcut | Yes |

**Implementation:**

```typescript
// Instead of static import:
import { WelcomeModal } from '@components/welcome-modal';

// Use dynamic import:
async function showWelcomeModal(): Promise<void> {
  const { WelcomeModal } = await import('@components/welcome-modal');
  const modal = new WelcomeModal(container);
  modal.init();
}
```

### 3.2 Heavy Visualization Components

| Component | Size Impact | Lazy Load Candidate |
|-----------|-------------|---------------------|
| `color-wheel-display.ts` | Canvas operations | Maybe |
| `color-distance-matrix.ts` | Complex calculations | Maybe |
| `colorblindness-display.ts` | Image processing | Maybe |

**Consideration:** These are core to tool functionality, so lazy loading may add perceived latency.

### 3.3 Non-Critical UI Components

| Component | Usage | Lazy Load Candidate |
|-----------|-------|---------------------|
| `empty-state.ts` | Empty states | Low priority |
| `info-tooltip.ts` | Help icons | Low priority |
| `tutorial-spotlight.ts` | Onboarding | Yes |

---

## 4. Shared Component Analysis

### Components Used by Multiple Tools

| Component | Used By | Current Location |
|-----------|---------|------------------|
| `MarketBoard` | 4 tools | Each tool chunk |
| `DyeFilters` | 3 tools | Each tool chunk |
| `DyeSelector` | 4+ tools | Each tool chunk |
| `ColorPickerDisplay` | 2 tools | Each tool chunk |

**Current behavior:** Each tool chunk may include these shared components, potentially duplicating code.

**Investigation needed:**
1. Check actual bundle output sizes
2. Verify if shared components are deduplicated
3. Consider moving highly-shared components to main chunk

**Potential optimization:**

```typescript
// vite.config.ts
manualChunks: {
  'vendor-lit': ['lit', 'lit-html'],
  'shared-components': [
    './src/components/market-board.ts',
    './src/components/dye-filters.ts',
    './src/components/dye-selector.ts',
  ],
  // ... tool chunks
}
```

---

## 5. Bundle Analysis Commands

```bash
# Build and analyze bundle
npm run build

# Install bundle analyzer (if not present)
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts:
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
    }),
  ],
});

# Then rebuild to generate stats.html
npm run build
```

---

## 6. Size Budget Recommendations

### Suggested Budgets

| Asset | Current | Target | Status |
|-------|---------|--------|--------|
| Initial JS | TBD | <150 KB | Check |
| Initial CSS | TBD | <50 KB | Check |
| Per-tool chunk | TBD | <100 KB | Check |
| Vendor (Lit) | TBD | <30 KB | Check |

### Monitoring

Add size tracking to CI:

```json
// package.json
{
  "scripts": {
    "build:analyze": "vite build && npx source-map-explorer dist/assets/*.js"
  }
}
```

---

## 7. Action Items

### Analysis Phase (Required First)
1. Run bundle analyzer to get actual sizes
2. Check if shared components are duplicated
3. Identify largest chunks

### Low-Effort Optimizations
1. Lazy load `WelcomeModal` and `ChangelogModal`
2. Lazy load `ShortcutsPanel`
3. Lazy load `TutorialSpotlight`

### Medium-Effort Optimizations
1. Create shared-components chunk if duplication confirmed
2. Convert barrel imports to direct imports in tools
3. Add bundle size CI checks

### Investigation Items
- [ ] Actual bundle sizes per chunk
- [ ] Shared component duplication status
- [ ] Lit framework tree-shaking effectiveness
- [ ] Core library (`xivdyetools-core`) size contribution

---

## 8. Notes on Current Setup

### What's Working Well
- Tool-specific code splitting
- Separate vendor chunk for Lit
- CSS is separate (Tailwind)

### What Could Be Improved
- No bundle size monitoring in CI
- No lazy loading of modals
- Barrel exports may prevent optimal tree-shaking

### Future Considerations
- Consider module federation if app grows significantly
- Monitor Core Web Vitals (LCP, FID, CLS)
- Add performance budget alerts to CI
