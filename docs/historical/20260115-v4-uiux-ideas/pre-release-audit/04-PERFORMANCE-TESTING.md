# Performance & Testing Analysis

**Version:** 4.0.0
**Date:** January 2026
**Overall Status:** PASS

---

## Bundle Size Analysis

### Size Limits

File: `scripts/check-bundle-size.js`

| Category | Limit | Status |
|----------|-------|--------|
| **Total JS** | 300 KB | ENFORCED |
| **Total CSS** | 40 KB | ENFORCED |

### Individual Chunk Limits

| Chunk | Limit | Purpose |
|-------|-------|---------|
| index- | 35 KB | Main entry bundle |
| vendor | 55 KB | Shared dependencies |
| vendor-lit | 5 KB | Lit framework (separate caching) |
| tool-harmony | 45 KB | Harmony Explorer tool |
| tool-mixer | 30 KB | Dye Mixer tool |
| tool-matcher | 40 KB | Color Matcher tool |
| tool-comparison | 35 KB | Dye Comparison tool |
| tool-accessibility | 50 KB | Accessibility Checker tool |

### Enforcement

```bash
# Runs automatically during build:check
npm run build:check

# Exit code 1 if any limit exceeded
# Output shows current vs. limit for each chunk
```

### Build Output Verification

```
dist/
├── assets/
│   ├── index-[hash].js       # Main bundle
│   ├── vendor-[hash].js      # Dependencies
│   ├── vendor-lit-[hash].js  # Lit framework
│   ├── modals-[hash].js      # Lazy-loaded modals
│   └── *.css                 # Stylesheets
└── index.html                # Entry point
```

---

## Code Splitting Strategy

### Lazy-Loaded Chunks

| Chunk | Trigger | Method |
|-------|---------|--------|
| Tool components | Route change | Dynamic import |
| Welcome modal | First visit | Dynamic import |
| Changelog modal | Version update | Dynamic import |

### Implementation

File: `src/main.ts`

```typescript
// Lazy-load modals after initial render
void (async () => {
  const { showWelcomeIfFirstVisit } = await import('@components/welcome-modal');
  const { showChangelogIfUpdated } = await import('@components/changelog-modal');
  showWelcomeIfFirstVisit();
  showChangelogIfUpdated();
})();
```

### Eager-Loaded (Main Bundle)

| Module | Reason |
|--------|--------|
| BaseComponent | Required for all tools |
| Service singletons | Immediate initialization |
| Theme/Language services | UI rendering |
| Router service | Navigation |
| V4 Layout shell | Page structure |

---

## Test Coverage

### Coverage Thresholds

File: `vitest.config.ts`

| Metric | Threshold | Status |
|--------|-----------|--------|
| Lines | 80% | ENFORCED |
| Functions | 80% | ENFORCED |
| Branches | 77% | ENFORCED |
| Statements | 80% | ENFORCED |

### Test File Distribution

| Location | Count | Purpose |
|----------|-------|---------|
| `src/components/__tests__/` | 45+ | UI component tests |
| `src/services/__tests__/` | 25+ | Service layer tests |
| `src/shared/__tests__/` | 5+ | Utility tests |
| **Total** | **79** | |

### Excluded from Coverage

File: `vitest.config.ts` (lines 14-31)

The following files are intentionally excluded (`/* istanbul ignore file */`):

| File | Reason |
|------|--------|
| `community-preset-service.ts` | Backend integration, mocked in tests |
| `hybrid-preset-service.ts` | Backend integration |
| `preset-submission-service.ts` | Backend integration |
| `add-to-collection-menu.ts` | UI-only, visual testing |
| `collection-manager-modal.ts` | Modal, E2E tested |
| `preset-edit-form.ts` | Form, E2E tested |
| `my-submissions-panel.ts` | Backend-dependent |
| `dye-comparison-chart.ts` | Canvas-based, visual testing |
| `welcome-modal.ts` | One-time display |
| `browser-api-types.ts` | Type definitions only |

### Testing Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.0.15 | Unit test runner |
| @testing-library/dom | 10.4.1 | DOM testing utilities |
| @testing-library/user-event | 14.6.1 | User interaction simulation |
| MSW | 2.12.4 | Mock Service Worker for API |
| Playwright | 1.57.0 | E2E browser testing |

### Test Setup

File: `src/__tests__/setup.ts`

```typescript
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock window.matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
```

### Test Commands

| Command | Purpose |
|---------|---------|
| `npm run test` | Watch mode (development) |
| `npm run test -- --run` | Single run (CI) |
| `npm run test:ui` | Visual test UI |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Playwright E2E tests |

---

## Accessibility Coverage

### ARIA Pattern Distribution

**Total occurrences:** 1212+ across 93 files

| Pattern | Count | Purpose |
|---------|-------|---------|
| `aria-label` | 400+ | Element labels |
| `role=` | 200+ | Semantic roles |
| `aria-hidden` | 150+ | Decorative elements |
| `aria-labelledby` | 100+ | Grouped controls |
| `aria-live` | 50+ | Dynamic updates |
| `tabindex` | 200+ | Focus management |

### Key Accessibility Features

#### 1. AnnouncerService

File: `src/services/announcer-service.ts`

```typescript
// Screen reader announcements
AnnouncerService.announce('Dye selected: Pure White');
AnnouncerService.announce('Theme changed to Dark Mode', 'polite');
AnnouncerService.announce('Error: Invalid file type', 'assertive');
```

#### 2. Keyboard Navigation

File: `src/services/keyboard-service.ts`

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate between elements |
| `Enter` | Activate focused element |
| `Escape` | Close modals/drawers |
| `Arrow keys` | Navigate within grids |

#### 3. Focus Management

- Modals trap focus within
- Focus returns to trigger on close
- Visible focus indicators in all themes
- Skip links for main content

#### 4. Color Contrast

- All themes designed for WCAG AA compliance
- Accessibility Checker tool validates dye combinations
- High contrast theme available

### Accessibility Testing

| Method | Status |
|--------|--------|
| Manual screen reader testing | Documented |
| Keyboard-only navigation | Verified |
| Color contrast checks | Theme variables compliant |
| ARIA pattern audit | 1212+ occurrences |

---

## Memory Leak Prevention

### BaseComponent Patterns

File: `src/components/base-component.ts`

#### Timer Tracking

```typescript
private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

protected safeTimeout(callback: () => void, delay: number): void {
  const id = setTimeout(() => {
    this.pendingTimeouts.delete(id);
    callback();
  }, delay);
  this.pendingTimeouts.add(id);
}

private clearAllTimeouts(): void {
  this.pendingTimeouts.forEach(id => clearTimeout(id));
  this.pendingTimeouts.clear();
}
```

#### Event Listener Tracking

```typescript
protected listeners: Map<string, {
  target: EventTarget;
  event: string;
  handler: EventListener;
}> = new Map();

protected bindEvent(
  target: EventTarget,
  event: string,
  handler: EventListener,
  key?: string
): void {
  const listenerKey = key || `${event}_${this.listenerCounter++}`;
  target.addEventListener(event, handler);
  this.listeners.set(listenerKey, { target, event, handler });
}

protected unbindAllEvents(): void {
  this.listeners.forEach(({ target, event, handler }) => {
    target.removeEventListener(event, handler);
  });
  this.listeners.clear();
}
```

#### Cleanup on Destroy

```typescript
destroy(): void {
  if (this.isDestroyed) return;

  try {
    this.unbindAllEvents();      // Remove all listeners
    this.clearAllTimeouts();      // Clear all timers
    this.onUnmount?.();           // Custom cleanup hook
    this.isDestroyed = true;
    this.element?.remove();       // Remove DOM node
  } catch (error) {
    ErrorHandler.log(error);
  }
}
```

---

## Performance Optimizations (from xivdyetools-core)

### Active Optimizations

| Optimization | Location | Impact |
|--------------|----------|--------|
| LRU Caching | ColorConverter | 60-80% faster conversions |
| Hue-indexed lookups | HarmonyGenerator | 70-90% faster harmony |
| k-d Tree | DyeSearch | O(log n) color matching |
| Pre-computed tables | ColorBlindness | Instant simulation |

### Caching Strategy

```typescript
// LRU cache with configurable size
const colorCache = new LRUCache<string, ConvertedColor>(1000);

function convertColor(input: string): ConvertedColor {
  const cached = colorCache.get(input);
  if (cached) return cached;

  const result = performConversion(input);
  colorCache.set(input, result);
  return result;
}
```

---

## Asset Optimization

### Optimization Opportunity: opengraph.png

| Property | Current | Target |
|----------|---------|--------|
| File | `assets/icons/opengraph.png` | Same |
| Size | 678 KB | ~50-80 KB |
| Format | PNG | WebP |
| Dimensions | 1200x630 | Same (OG standard) |

**Impact:** Faster social media preview loading

**Priority:** LOW (only affects crawlers, not users)

**Action:**
```bash
# Using sharp (already a devDependency)
npx sharp assets/icons/opengraph.png -o assets/icons/opengraph.webp --webp -q 85
```

### Other Assets

| Asset | Status | Notes |
|-------|--------|-------|
| Logo images | Optimized | WebP format |
| Favicon | Optimized | Proper sizes |
| Font files | Preload hints | Async loading |

---

## CSS Performance

### Tailwind Configuration

File: `tailwind.config.js`

```javascript
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,html}',
  ],
  // v4 defaults used
}
```

### CSS Loading Strategy

| Phase | Files | Method |
|-------|-------|--------|
| Critical | `tailwind.css` | Synchronous (render-blocking) |
| Deferred | `themes.css` | Async via plugin |
| Component | Scoped styles | Shadow DOM encapsulation |

### Async CSS Loading

File: `scripts/vite-plugin-async-css.ts`

Converts CSS link tags to async loading with fallback:
```html
<link rel="preload" as="style" href="styles.css" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="styles.css"></noscript>
```

---

## Build Configuration

### Vite Production Settings

File: `vite.config.ts`

```typescript
build: {
  minify: 'esbuild',           // Fast minification
  sourcemap: true,              // For production debugging
  target: 'ES2020',             // Modern browsers
  reportCompressedSize: true,    // Gzip size reporting
  cssCodeSplit: true,           // Separate CSS per chunk
  chunkSizeWarningLimit: 1000,   // Warn at 1MB chunks
}
```

### Production Optimizations

| Optimization | Enabled | Notes |
|--------------|---------|-------|
| Minification | Yes | esbuild (fast) |
| Tree shaking | Yes | Vite default |
| Code splitting | Yes | Manual chunks configured |
| CSS minification | Yes | PostCSS |
| Asset hashing | Yes | Cache busting |

---

## Performance Monitoring

### Recommended Metrics

| Metric | Target | Tool |
|--------|--------|------|
| LCP | < 2.5s | PageSpeed Insights |
| FID | < 100ms | PageSpeed Insights |
| CLS | < 0.1 | PageSpeed Insights |
| Lighthouse Performance | > 85 | Chrome DevTools |
| Bundle size regression | Within limits | CI check-bundle-size |

### CI Integration

```yaml
# Example CI step
- name: Check bundle size
  run: npm run build:check
  # Fails if limits exceeded
```

---

## Summary

| Category | Status | Details |
|----------|--------|---------|
| Bundle Size | PASS | 300 KB JS limit enforced |
| Code Splitting | PASS | Tools/modals lazy-loaded |
| Test Coverage | PASS | 80% threshold enforced |
| Accessibility | EXCELLENT | 1212+ a11y patterns |
| Memory Leaks | PREVENTED | Automatic cleanup patterns |
| Asset Optimization | 1 ITEM | opengraph.png (non-blocking) |
| CSS Performance | PASS | Async loading configured |
| Build Config | OPTIMAL | Production-ready settings |

**Overall Performance Status: PASS**
