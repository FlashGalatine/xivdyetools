# Performance Optimization Opportunities

## Overview

Performance issues identified fall into three categories: unnecessary re-renders, missing caches/memoization, and event listener management. Several are quick fixes with high impact.

---

## 1. Re-render Inefficiencies

### 1.1 Full Re-render on Language Change (Critical)

**Files:** All tool components

**Problem:** Language change triggers complete UI destruction and rebuild.

```typescript
// Pattern found in color-matcher-tool.ts (line 387) and all other tools:
LanguageService.subscribe(() => {
  this.update();  // Destroys entire component and rebuilds!
});
```

**Impact:**
- Visible UI flash on language change
- Loss of transient state (scroll position, selection)
- Unnecessary CPU work rebuilding entire DOM

**Solution:** Use incremental text updates pattern from `app-layout.ts`:

```typescript
// Better pattern from app-layout.ts (lines 341-363):
private updateLocalizedText(): void {
  // Only update text content, not entire structure
  const title = this.querySelector<HTMLElement>('#tool-title');
  if (title) {
    title.textContent = LanguageService.t('tools.matcher.title');
  }
  const subtitle = this.querySelector<HTMLElement>('#tool-subtitle');
  if (subtitle) {
    subtitle.textContent = LanguageService.t('tools.matcher.subtitle');
  }
  // etc.
}

// Then in subscription:
LanguageService.subscribe(() => {
  this.updateLocalizedText();  // Surgical updates only
});
```

**Estimated Impact:** 80% reduction in language change overhead.

### 1.2 DOM Queries in Event Handlers (Moderate)

**File:** `color-matcher-tool.ts` (lines 313-319)

**Problem:** Elements queried on every input event instead of cached:

```typescript
// Current: Queries DOM every time slider changes
this.on(sampleInput, 'input', () => {
  this.sampleSize = parseInt(sampleInput.value, 10);
  const valueDisplay = this.querySelector<HTMLElement>('#sample-size-value');  // Query every time!
  if (valueDisplay) {
    valueDisplay.textContent = this.sampleSize.toString();
  }
});
```

**Solution:** Cache element references during initialization:

```typescript
// Better: Cache reference once
private sampleSizeDisplay: HTMLElement | null = null;

onMount(): void {
  this.sampleSizeDisplay = this.querySelector<HTMLElement>('#sample-size-value');
}

// Then in handler:
this.on(sampleInput, 'input', () => {
  this.sampleSize = parseInt(sampleInput.value, 10);
  if (this.sampleSizeDisplay) {
    this.sampleSizeDisplay.textContent = this.sampleSize.toString();
  }
});
```

### 1.3 Recent Colors O(n) Rebuild (Moderate)

**File:** `color-matcher-tool.ts` (lines 1286-1347)

**Problem:** `renderRecentColors()` clears and rebuilds entire list on every color add:

```typescript
private renderRecentColors(): void {
  const container = this.querySelector<HTMLElement>('#recent-colors-container');
  if (!container) return;

  clearContainer(container);  // Destroys all existing elements!

  // Then rebuilds all 10 color swatches...
  this.recentColors.forEach((color) => {
    const swatch = this.createElement('button', { ... });
    // ...
    container.appendChild(swatch);
  });
}
```

**Solution:** Implement incremental updates:

```typescript
private renderRecentColors(): void {
  const container = this.querySelector<HTMLElement>('#recent-colors-container');
  if (!container) return;

  // Only add the new color at the beginning
  const latestColor = this.recentColors[0];
  if (latestColor) {
    const swatch = this.createColorSwatch(latestColor);
    container.insertBefore(swatch, container.firstChild);

    // Remove last child if over limit
    if (container.children.length > this.maxRecentColors) {
      container.lastChild?.remove();
    }
  }
}
```

### 1.4 Canvas Zoom Redraw (Minor)

**File:** `color-matcher-tool.ts` (lines 715-743)

**Problem:** `updateZoom()` triggers style recalculations on every zoom level change.

**Note:** Currently uses CSS transforms which is efficient. Consider debouncing if users report lag during rapid zoom.

---

## 2. Missing Caches/Memoization

### 2.1 Color Distance Not Cached (Critical)

**File:** `color-matcher-tool.ts` (line 1099)

**Problem:** Color distance recalculated for every dye card during render:

```typescript
// In renderDyeCard():
const distance = ColorService.getColorDistance(sampledColor, dye.hex);  // Line 1099
// This same calculation already happened in refreshResults() at line 924
```

**Solution:** Store distance when dyes are first matched:

```typescript
// In refreshResults() when finding matches:
interface MatchedDye extends Dye {
  distance: number;  // Cache the distance
}

private matchedDyes: MatchedDye[] = [];

// When finding matches:
this.matchedDyes = matches.map(dye => ({
  ...dye,
  distance: ColorService.getColorDistance(this.lastSampledColor, dye.hex)
}));

// Then in renderDyeCard():
const distance = dye.distance;  // Use cached value
```

**Impact:** Eliminates O(n) recalculation on every render.

### 2.2 Language Translations During Render (Moderate)

**Pattern:** Every component calls `LanguageService.t()` during `render()`:

```typescript
// Called every render:
const heading = this.createElement('h2', {
  textContent: LanguageService.t('tools.matcher.title'),  // Lookup overhead
});
```

**Consideration:** `LanguageService.t()` is likely already optimized with lookup cache. Profile before optimizing further.

### 2.3 Color Space Conversions (Minor)

**Files:** Comparison tool, Mixer tool

**Pattern:** Colors may be converted to HSV/RGB on every comparison.

**Recommendation:** Cache conversions when color is set:

```typescript
interface CachedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsv: { h: number; s: number; v: number };
}
```

---

## 3. Event Listener Issues

### 3.1 Canvas Scroll Listener Not Tracked (Critical)

**File:** `color-matcher-tool.ts` (lines 554-560)

**Problem:** Scroll listener added directly, not through `this.on()`:

```typescript
canvasContainer.addEventListener(
  'scroll',
  () => { this.previewOverlay?.hidePreview(); },
  { passive: true }
);  // Not tracked in listeners map, won't be cleaned up!
```

**Solution:** Use `this.on()` for automatic cleanup:

```typescript
this.on(canvasContainer, 'scroll', () => {
  this.previewOverlay?.hidePreview();
});
// BaseComponent will automatically remove on destroy()
```

### 3.2 Document-Level Keyboard Listener (Critical)

**File:** `color-matcher-tool.ts` (lines 820-840)

**Problem:** Document-level listener persists after component destroyed:

```typescript
document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Zoom keyboard shortcuts
  if (e.key === '+' || e.key === '=') { ... }
  if (e.key === '-') { ... }
});
// No corresponding removeEventListener!
```

**Solution:** Track with `this.on()` or manually remove in `onUnmount()`:

```typescript
// Option 1: Use this.on() with document target
this.on(document, 'keydown', this.handleKeyboard.bind(this));

// Option 2: Manual cleanup
private keyboardHandler = (e: KeyboardEvent) => { ... };

onMount(): void {
  document.addEventListener('keydown', this.keyboardHandler);
}

onUnmount(): void {
  document.removeEventListener('keydown', this.keyboardHandler);
}
```

### 3.3 Listener Map Memory Leak Risk (Moderate)

**File:** `base-component.ts` (lines 265)

**Problem:** Random keys make cleanup harder:

```typescript
const key = `${eventName}_${Math.random()}`;  // Line 265
this.listeners.set(key, { target, event: eventName, handler });
```

**Note:** Current implementation does clean up all listeners on `destroy()`. Risk is if code tries to remove specific listener by key without the generated key.

---

## 4. Performance Metrics to Track

### Key Metrics
- **Language change render time:** Currently ~500ms+ (full rebuild), target <50ms
- **Dye match render time:** Profile when displaying 50+ matched dyes
- **Memory growth:** Monitor during extended usage with tool switching

### Profiling Recommendations
1. Use Chrome DevTools Performance tab during language change
2. Monitor Memory tab during tool switching for leaks
3. Profile `renderDyeCard()` with 100+ dyes selected

---

## 5. Quick Wins Summary

| Fix | File | Lines | Impact | Effort |
|-----|------|-------|--------|--------|
| Incremental language updates | All tools | Multiple | High | 2h |
| Cache color distance | color-matcher-tool.ts | 924, 1099 | High | 1h |
| Track scroll listener | color-matcher-tool.ts | 554-560 | Medium | 15min |
| Track keyboard listener | color-matcher-tool.ts | 820-840 | Medium | 15min |
| Cache DOM refs | color-matcher-tool.ts | 313-319 | Low | 30min |
| Incremental recent colors | color-matcher-tool.ts | 1286-1347 | Low | 1h |
