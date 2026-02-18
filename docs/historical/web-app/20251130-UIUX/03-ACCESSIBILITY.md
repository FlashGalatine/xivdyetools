# Accessibility Enhancements

> **Focus**: Make XIV Dye Tools usable by everyone, regardless of ability
> **Standards**: WCAG 2.1 AA as baseline, AAA where practical

---

## Current State

The app currently has:
- Semantic HTML structure (`<header>`, `<nav>`, `<main>`, `<footer>`)
- Basic ARIA labels on interactive elements
- Keyboard support for theme switcher dropdown
- Built-in Accessibility Checker tool for colorblind simulation
- WCAG contrast scoring in the Accessibility Checker
- 9 themes with varying contrast levels

### Areas for Improvement
- Focus indicators are inconsistent across components
- Screen reader announcements for dynamic content are limited
- Reduced motion preferences not consistently respected
- Complex components (color wheel, canvas charts) lack keyboard navigation
- Form controls missing consistent labeling

---

## A1: Keyboard Navigation for Dye Selector

**Priority**: P1 | **Effort**: M

### Problem
The dye selector is mouse-centric. Users can't efficiently navigate the 136-dye list with keyboard alone.

### Solution
Implement comprehensive keyboard navigation for the dye selector grid.

### Keyboard Mappings

| Key | Action |
|-----|--------|
| `Tab` | Focus dye selector container |
| `Arrow Keys` | Navigate between dye swatches |
| `Enter` / `Space` | Select focused dye |
| `Escape` | Clear selection / close dropdown |
| `Home` | Jump to first dye |
| `End` | Jump to last dye |
| `Page Up/Down` | Jump by row (8-10 items) |
| `/` or `Ctrl+F` | Focus search input |

### Grid Navigation Logic
```
Current: [Snow White]  →  Arrow Right  →  [Ash Grey]
                       ↓  Arrow Down   ↓
                      [Bone White]
```

### Implementation Pattern
```typescript
// Roving tabindex for grid navigation
class DyeSelector {
  private focusedIndex = 0;

  handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowRight':
        this.focusedIndex = Math.min(this.focusedIndex + 1, this.dyes.length - 1);
        break;
      case 'ArrowDown':
        this.focusedIndex = Math.min(this.focusedIndex + this.columnsPerRow, this.dyes.length - 1);
        break;
      // ... etc
    }
    this.updateFocus();
  }
}
```

### ARIA Requirements
```html
<div role="grid" aria-label="Dye color selection">
  <div role="row">
    <div role="gridcell" tabindex="0" aria-selected="true">Snow White</div>
    <div role="gridcell" tabindex="-1">Ash Grey</div>
  </div>
</div>
```

---

## A2: Focus Ring Visibility Improvements

**Priority**: P2 | **Effort**: S

### Problem
Focus indicators are inconsistent - some elements have subtle or missing focus rings.

### Solution
Implement a consistent, high-visibility focus ring system.

### Focus Ring Design

```css
/* Global focus-visible style */
:focus-visible {
  outline: 2px solid var(--theme-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove default outline, keep focus-visible */
:focus:not(:focus-visible) {
  outline: none;
}

/* High contrast mode enhancement */
@media (prefers-contrast: more) {
  :focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 3px;
  }
}
```

### Focus Ring on Themed Backgrounds
```css
/* Ensure visibility on all backgrounds */
.dark-theme :focus-visible {
  outline-color: var(--theme-text);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
}
```

### Elements Needing Attention
- [ ] Dye swatches in grids
- [ ] Theme switcher buttons
- [ ] Language selector options
- [ ] Harmony type radio buttons
- [ ] Filter checkboxes
- [ ] Export buttons

---

## A3: Screen Reader Announcements

**Priority**: P2 | **Effort**: M

### Problem
Dynamic content changes (results loading, selections, errors) aren't announced to screen readers.

### Solution
Use ARIA live regions to announce important updates.

### Live Region Patterns

**Results Update**:
```html
<div aria-live="polite" aria-atomic="true" class="sr-only">
  <!-- Dynamically updated -->
  Found 12 matching dyes for triadic harmony
</div>
```

**Selection Confirmation**:
```html
<div aria-live="assertive" class="sr-only">
  Snow White selected as base dye
</div>
```

**Error Announcement**:
```html
<div role="alert" aria-live="assertive">
  Failed to load market prices. Please try again.
</div>
```

### Implementation: Announcer Service

```typescript
class ScreenReaderAnnouncer {
  private liveRegion: HTMLElement;

  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;
  }

  announceResults(count: number, context: string) {
    this.announce(`Found ${count} ${context}`);
  }

  announceSelection(item: string) {
    this.announce(`${item} selected`, 'assertive');
  }
}
```

### Announcement Triggers

| Event | Message | Priority |
|-------|---------|----------|
| Harmony generated | "Generated 5 harmony suggestions" | polite |
| Dye selected | "{Dye name} selected" | assertive |
| Price loaded | "Prices updated for {server}" | polite |
| Error occurred | "Error: {message}" | assertive |
| Filter applied | "{N} dyes visible after filtering" | polite |

---

## A4: Reduced Motion Preferences

**Priority**: P2 | **Effort**: S

### Problem
Animations (color transitions, hover effects, loading spinners) may cause issues for users with vestibular disorders.

### Solution
Respect `prefers-reduced-motion` media query throughout the app.

### CSS Implementation

```css
/* Base animations */
.color-transition {
  transition: background-color 0.3s ease;
}

.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Keep essential state changes instant */
  .color-transition,
  .card-hover {
    transition: none;
  }
}
```

### Affected Components

| Component | Default Animation | Reduced Motion |
|-----------|------------------|----------------|
| Theme switch | Color fade 300ms | Instant |
| Card hover | Transform + shadow | Background only |
| Loading spinner | Rotating | Pulsing opacity |
| Color wheel | Smooth rotation | Instant position |
| Toast appear | Slide in | Fade in |
| Modal open | Scale up | Instant |

### JavaScript Check
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Use in animations
const animationDuration = prefersReducedMotion ? 0 : 300;
```

---

## A5: High Contrast Mode Support

**Priority**: P3 | **Effort**: M

### Problem
Users with low vision may need higher contrast than standard themes provide.

### Solution
Create a high contrast theme option and respect system high contrast mode.

### High Contrast Theme Values

```typescript
const highContrastTheme: ThemePalette = {
  primary: '#FFFFFF',
  background: '#000000',
  cardBackground: '#1A1A1A',
  cardHover: '#333333',
  text: '#FFFFFF',
  textHeader: '#FFFFFF',
  textMuted: '#CCCCCC',
  border: '#FFFFFF',
  backgroundSecondary: '#0A0A0A',
};
```

### Windows High Contrast Mode
```css
@media (forced-colors: active) {
  /* Reset colors to system defaults */
  .dye-swatch {
    border: 2px solid CanvasText;
  }

  .button {
    border: 2px solid ButtonText;
    background: ButtonFace;
    color: ButtonText;
  }

  :focus-visible {
    outline: 3px solid Highlight;
  }
}
```

---

## A6: Form Control Labeling

**Priority**: P1 | **Effort**: S

### Problem
Some form controls lack explicit labels or have ambiguous labels.

### Solution
Audit and fix all form control labeling.

### Labeling Patterns

**Explicit Labels** (preferred):
```html
<label for="sample-size">Sample Size</label>
<input type="range" id="sample-size" min="1" max="64" value="16" />
```

**Visually Hidden Labels** (when visual label not needed):
```html
<label for="dye-search" class="sr-only">Search dyes</label>
<input type="search" id="dye-search" placeholder="Search dyes..." />
```

**ARIA Labels** (for icon-only buttons):
```html
<button aria-label="Clear selection" title="Clear selection">
  <svg><!-- X icon --></svg>
</button>
```

### Controls Needing Review

| Control | Current State | Fix Needed |
|---------|---------------|------------|
| Sample size slider | Label visible | Add `for` attribute |
| Zoom slider | Label visible | Add `for` attribute |
| Dye search input | Placeholder only | Add visually hidden label |
| Theme toggle button | Icon only | Add aria-label |
| Clear button | Icon only | Add aria-label |
| Filter checkboxes | Label visible | Verify association |

---

## A7: Color Wheel Accessibility

**Priority**: P2 | **Effort**: M

### Problem
The SVG color wheel in Harmony Generator is visual-only and inaccessible to screen readers.

### Solution
Add accessible alternatives for color wheel information.

### Approach 1: Text Alternative
```html
<figure>
  <svg class="color-wheel" aria-hidden="true">
    <!-- Visual color wheel -->
  </svg>
  <figcaption class="sr-only">
    Color wheel showing triadic harmony: Base color Snow White at 0°,
    Companion 1 at 120° (closest match: Rose Pink),
    Companion 2 at 240° (closest match: Celeste Green)
  </figcaption>
</figure>
```

### Approach 2: Data Table Alternative
```html
<details class="color-wheel-table">
  <summary>View harmony as text</summary>
  <table>
    <tr><th>Position</th><th>Angle</th><th>Suggested Dye</th></tr>
    <tr><td>Base</td><td>0°</td><td>Snow White</td></tr>
    <tr><td>Companion 1</td><td>120°</td><td>Rose Pink</td></tr>
    <tr><td>Companion 2</td><td>240°</td><td>Celeste Green</td></tr>
  </table>
</details>
```

---

## A8: Skip Links

**Priority**: P2 | **Effort**: S

### Problem
Keyboard users must tab through header/navigation repeatedly to reach main content.

### Solution
Add skip links at the top of the page.

### Implementation

```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <a href="#tool-nav" class="skip-link">Skip to tool navigation</a>

  <header>...</header>

  <main id="main-content" tabindex="-1">
    ...
  </main>
</body>
```

### Skip Link Styles
```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  background: var(--theme-primary);
  color: white;
  padding: 0.5rem 1rem;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
}
```

---

## Implementation Priority Order

1. **A6 - Form Labeling** (quick fix, immediate compliance benefit)
2. **A1 - Keyboard Navigation** (major usability improvement)
3. **A2 - Focus Rings** (supports keyboard navigation)
4. **A4 - Reduced Motion** (low effort, wide benefit)
5. **A8 - Skip Links** (small change, big impact for keyboard users)
6. **A3 - Screen Reader Announcements** (enhances all interactions)
7. **A7 - Color Wheel Accessibility** (complex tool needs attention)
8. **A5 - High Contrast Mode** (advanced, defer to later phase)

---

## Testing Recommendations

### Screen Readers
- **NVDA** (Windows, free) - Primary testing
- **VoiceOver** (macOS/iOS) - Secondary testing
- **JAWS** (Windows, commercial) - Optional validation

### Testing Checklist
- [ ] Navigate entire app using keyboard only
- [ ] Complete a full workflow with screen reader
- [ ] Test with 200% browser zoom
- [ ] Test with `prefers-reduced-motion: reduce`
- [ ] Test with Windows High Contrast Mode
- [ ] Verify all images have alt text
- [ ] Check color contrast with browser dev tools

---

## Files Likely to Modify

| File | Changes |
|------|---------|
| `src/styles/themes.css` | Focus rings, skip links, high contrast |
| `src/styles/accessibility.css` | New file for a11y-specific styles |
| `src/components/dye-selector.ts` | Keyboard navigation, ARIA |
| `src/components/color-wheel-display.ts` | Text alternatives |
| `src/components/app-layout.ts` | Skip links |
| New: `src/services/announcer-service.ts` | Screen reader announcements |
| All form components | Label associations |
