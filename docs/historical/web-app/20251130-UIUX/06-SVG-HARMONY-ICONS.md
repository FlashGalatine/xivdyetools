# SVG Harmony Type Icons - Concept Sketches

> **Purpose**: Replace emoji indicators with custom SVG icons that visually represent color relationships
> **Design Principle**: Each icon shows the geometric relationship on a simplified color wheel

---

## Design Guidelines

### Sizing & Scaling
- **Base size**: 24×24px viewBox
- **Stroke width**: 1.5-2px for visibility at small sizes
- **Usage sizes**: 16px (inline), 24px (buttons), 32px (feature)

### Color Strategy
- Use `currentColor` for theme compatibility
- Icons inherit text color from parent
- Selected state: use `var(--theme-primary)`

### Accessibility
- Each SVG includes `<title>` for screen readers
- Use `aria-hidden="true"` when label text is adjacent

---

## Icon Designs

### 1. Complementary
*Two colors directly opposite on the wheel (180° apart)*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Complementary Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Two opposite dots -->
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="21" r="2.5" fill="currentColor" stroke="none" />
  <!-- Connecting line -->
  <line x1="12" y1="5.5" x2="12" y2="18.5" stroke-dasharray="2 2" />
</svg>
```

**Visual representation**:
```
        ●  ← Color A (top)
        |
        |  (180° apart)
        |
        ●  ← Color B (bottom)
```

---

### 2. Analogous
*Three adjacent colors on the wheel (30° apart)*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Analogous Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Three adjacent dots (at -30°, 0°, +30° from top) -->
  <circle cx="7" cy="4.5" r="2" fill="currentColor" stroke="none" />
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="17" cy="4.5" r="2" fill="currentColor" stroke="none" />
  <!-- Arc connecting them -->
  <path d="M 7 4.5 Q 12 2 17 4.5" fill="none" />
</svg>
```

**Visual representation**:
```
      ●─●─●  ← Three neighbors
        |
        |
```

---

### 3. Triadic
*Three colors equally spaced (120° apart) - forms a triangle*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Triadic Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Triangle -->
  <polygon points="12,3 21,18 3,18" fill="none" />
  <!-- Three dots at vertices -->
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="21" cy="18" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="3" cy="18" r="2.5" fill="currentColor" stroke="none" />
</svg>
```

**Visual representation**:
```
        ●      ← Color A (top)
       / \
      /   \
     ●─────●   ← Colors B & C (120° each)
```

---

### 4. Split-Complementary
*Base color + two colors adjacent to its complement (Y-shape)*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Split-Complementary Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Y-shape lines -->
  <line x1="12" y1="3" x2="12" y2="12" />
  <line x1="12" y1="12" x2="6" y2="20" />
  <line x1="12" y1="12" x2="18" y2="20" />
  <!-- Three dots -->
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="6" cy="20" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="18" cy="20" r="2.5" fill="currentColor" stroke="none" />
</svg>
```

**Visual representation**:
```
        ●      ← Base color
        |
        ∨
       / \
      ●   ●    ← Split from complement
```

---

### 5. Tetradic (Rectangle)
*Four colors forming a rectangle (two complementary pairs)*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Tetradic Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Rectangle -->
  <rect x="5" y="5" width="14" height="14" fill="none" rx="1" />
  <!-- Four dots at corners -->
  <circle cx="5" cy="5" r="2" fill="currentColor" stroke="none" />
  <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none" />
  <circle cx="19" cy="19" r="2" fill="currentColor" stroke="none" />
  <circle cx="5" cy="19" r="2" fill="currentColor" stroke="none" />
</svg>
```

**Visual representation**:
```
    ●───────●
    |       |
    |       |
    ●───────●
```

---

### 6. Square
*Four colors equally spaced (90° apart) - forms a square*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Square Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Diamond/rotated square -->
  <polygon points="12,3 21,12 12,21 3,12" fill="none" />
  <!-- Four dots at vertices -->
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="21" cy="12" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="21" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="3" cy="12" r="2.5" fill="currentColor" stroke="none" />
</svg>
```

**Visual representation**:
```
        ●
       / \
      /   \
     ●     ●
      \   /
       \ /
        ●
```

---

### 7. Compound
*Combines complementary with analogous (diamond with wings)*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Compound Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Main complementary line -->
  <line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="2 2" />
  <!-- Base dot -->
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <!-- Compound group at bottom (3 dots) -->
  <circle cx="12" cy="21" r="2" fill="currentColor" stroke="none" />
  <circle cx="7" cy="19" r="2" fill="currentColor" stroke="none" />
  <circle cx="17" cy="19" r="2" fill="currentColor" stroke="none" />
  <!-- Small arc connecting bottom group -->
  <path d="M 7 19 Q 12 22 17 19" fill="none" />
</svg>
```

**Visual representation**:
```
        ●          ← Base
        :
        :
     ●──●──●       ← Compound group
```

---

### 8. Monochromatic
*Single hue with varying lightness/saturation*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <title>Monochromatic Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Single position with gradient circles (concentric) -->
  <circle cx="12" cy="3" r="2" fill="currentColor" stroke="none" opacity="1" />
  <circle cx="12" cy="8" r="2" fill="currentColor" stroke="none" opacity="0.6" />
  <circle cx="12" cy="13" r="2" fill="currentColor" stroke="none" opacity="0.35" />
  <!-- Line showing single hue axis -->
  <line x1="12" y1="5" x2="12" y2="11" stroke-dasharray="1 2" opacity="0.5" />
</svg>
```

**Visual representation**:
```
        ●  ← Full saturation
        |
        ◐  ← Medium
        |
        ○  ← Light/desaturated
```

---

### 9. Shades
*Variations of same hue at different brightness levels (gradient stripes)*

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Shades Harmony</title>
  <!-- Outer wheel -->
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <!-- Gradient stripes representing different shades -->
  <rect x="5" y="4" width="4" height="16" rx="1" fill="currentColor" opacity="1" stroke="none" />
  <rect x="10" y="4" width="4" height="16" rx="1" fill="currentColor" opacity="0.6" stroke="none" />
  <rect x="15" y="4" width="4" height="16" rx="1" fill="currentColor" opacity="0.3" stroke="none" />
</svg>
```

**Visual representation**:
```
     ┌─┐ ┌─┐ ┌─┐
     │█│ │▓│ │░│  ← Dark to light shades
     │█│ │▓│ │░│
     └─┘ └─┘ └─┘
```

---

## Alternative: Minimal Geometric Style

For a cleaner, more abstract look without the wheel background:

### Minimal Triadic
```svg
<svg viewBox="0 0 24 24" fill="currentColor">
  <title>Triadic Harmony</title>
  <circle cx="12" cy="4" r="3" />
  <circle cx="20" cy="18" r="3" />
  <circle cx="4" cy="18" r="3" />
</svg>
```

### Minimal Square
```svg
<svg viewBox="0 0 24 24" fill="currentColor">
  <title>Square Harmony</title>
  <circle cx="12" cy="3" r="3" />
  <circle cx="21" cy="12" r="3" />
  <circle cx="12" cy="21" r="3" />
  <circle cx="3" cy="12" r="3" />
</svg>
```

---

## Implementation Component

```typescript
// src/components/harmony-icon.ts
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'square'
  | 'compound'
  | 'monochromatic'
  | 'shades';

@customElement('harmony-icon')
export class HarmonyIcon extends LitElement {
  @property({ type: String }) type: HarmonyType = 'triadic';
  @property({ type: Number }) size: number = 24;

  render() {
    return html`
      <svg
        viewBox="0 0 24 24"
        width="${this.size}"
        height="${this.size}"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        ${this.getIconPath()}
      </svg>
    `;
  }

  private getIconPath() {
    switch (this.type) {
      case 'triadic':
        return html`
          <circle cx="12" cy="12" r="10" opacity="0.3" />
          <polygon points="12,3 21,18 3,18" fill="none" />
          <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="21" cy="18" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="3" cy="18" r="2.5" fill="currentColor" stroke="none" />
        `;
      // ... other cases
    }
  }
}
```

---

## Usage Examples

### In Harmony Type Selector
```html
<button class="harmony-type-btn" aria-pressed="true">
  <harmony-icon type="triadic" size="20"></harmony-icon>
  <span>Triadic</span>
</button>
```

### Inline with Text
```html
<p>
  Using <harmony-icon type="complementary" size="16"></harmony-icon>
  complementary colors creates high contrast.
</p>
```

### With Selected State
```css
.harmony-type-btn[aria-pressed="true"] harmony-icon {
  color: var(--theme-primary);
}

.harmony-type-btn:hover harmony-icon {
  color: var(--theme-text-header);
}
```

---

## File Organization

```
public/
└── assets/
    └── icons/
        └── harmony/
            ├── analogous.svg
            ├── complementary.svg
            ├── compound.svg
            ├── monochromatic.svg
            ├── shades.svg
            ├── split-complementary.svg
            ├── square.svg
            ├── tetradic.svg
            └── triadic.svg

src/
└── components/
    └── harmony-type.ts  (renders icons via <img> tag)
```

> **Note**: Icons are in `public/` (not `src/`) because Vite's `publicDir` is configured
> as `../public` relative to the `src` root. Static assets in `public/` are served at `/`.

---

## Visual Preview Grid

When all icons are displayed together:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ◯●◯   ●●●   △    ⅄    ▭    ◇    ●:●   ●◐○   ▥            │
│                                                             │
│  Comp  Anal  Tri  Splt Tetr Sqr  Cmpd Mono Shds            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Review SVG designs** - Adjust geometry as needed
2. **Test at target sizes** - Ensure readability at 16px
3. **Create Lit component** - Implement `harmony-icon.ts`
4. **Integrate into harmony-type.ts** - Replace emoji usage
5. **Add hover/selected states** - Color transitions
6. **Test theme compatibility** - Verify on all 9 themes
