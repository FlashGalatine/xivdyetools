# v3.0.0 CSS Theme System

## Overview

XIV Dye Tools uses CSS custom properties (variables) for theming, allowing seamless theme switching between light, dark, and custom themes. All v3.0 mockup components use these variables for consistent styling.

## Core Theme Variables

### Text Colors

| Variable | Purpose | Light Theme | Dark Theme |
|----------|---------|-------------|------------|
| `--theme-text` | Primary body text | Dark gray | Light gray |
| `--theme-text-muted` | Secondary/helper text | Medium gray | Muted gray |
| `--theme-text-header` | Headers, important labels | Near black / White | White / Theme accent |

### Background Colors

| Variable | Purpose | Light Theme | Dark Theme |
|----------|---------|-------------|------------|
| `--theme-background` | Page background | Light gray | Dark gray |
| `--theme-background-secondary` | Alternate sections | Slightly darker | Slightly lighter |
| `--theme-card-background` | Card surfaces | White | Dark surface |
| `--theme-card-hover` | Card hover state | Light gray | Lighter surface |

### Accent & Brand Colors

| Variable | Purpose |
|----------|---------|
| `--theme-primary` | Primary brand color (burgundy/red) |
| `--theme-border` | Borders, dividers |

## Layout Variables

```css
:root {
  --panel-left-width: 280px;
  --panel-collapsed-width: 64px;
  --drawer-transition: 0.3s ease-out;
}
```

## Usage Patterns

### Inline Styles

Most theming is done via inline `style` attributes:

```typescript
const card = this.createElement('div', {
  className: 'p-4 rounded-lg',
  attributes: {
    style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
  },
});
```

### Text Styling

```html
<!-- Primary text -->
<p style="color: var(--theme-text);">Main content</p>

<!-- Secondary text -->
<span style="color: var(--theme-text-muted);">Helper text</span>

<!-- Header text (high contrast) -->
<h1 style="color: var(--theme-text-header);">Title</h1>
```

### Interactive Elements

```html
<!-- Primary button -->
<button style="background: var(--theme-primary); color: var(--theme-text-header);">
  Primary Action
</button>

<!-- Secondary button -->
<button style="background: var(--theme-background-secondary);
               color: var(--theme-text);
               border: 1px solid var(--theme-border);">
  Secondary Action
</button>

<!-- Ghost/transparent button -->
<button style="background: transparent; color: var(--theme-text);">
  Ghost Action
</button>
```

### Cards and Containers

```html
<!-- Standard card -->
<div style="background: var(--theme-card-background);
            border: 1px solid var(--theme-border);">
  Card content
</div>

<!-- Section with border -->
<div class="p-4 border-b" style="border-color: var(--theme-border);">
  Section content
</div>

<!-- Highlighted/selected state -->
<div style="background: var(--theme-primary); color: var(--theme-text-header);">
  Selected item
</div>
```

## CSS Specificity Issues

### The `!important` Problem

Some global CSS rules use `!important`, which can override inline styles:

```css
/* Global rule in app CSS */
p {
  color: var(--theme-text) !important;
}
```

**Solution**: Add `!important` to inline styles that need to override:

```typescript
<p style="color: var(--theme-text-header) !important;">${dye.name}</p>
```

### When to Use `!important`

Use `!important` in inline styles when:
1. Styling `<p>` elements with non-default colors
2. Overriding inherited colors from parent containers
3. Any case where DevTools shows your style being overridden

### Specificity Hierarchy (Low to High)

1. Element selectors (`p`, `div`)
2. Class selectors (`.foo`)
3. ID selectors (`#bar`)
4. Inline styles (`style="..."`)
5. `!important` declarations

When both have `!important`, inline wins.

## Tailwind CSS Integration

### Using Tailwind with Theme Variables

Tailwind utility classes can be combined with CSS variables:

```html
<!-- Tailwind for layout, variables for colors -->
<div class="p-4 rounded-lg flex items-center gap-3"
     style="background: var(--theme-card-background); border: 1px solid var(--theme-border);">
```

### Common Tailwind Patterns

```html
<!-- Spacing -->
<div class="p-4">Padding 1rem</div>
<div class="px-4 py-2">Padding x:1rem, y:0.5rem</div>
<div class="mb-6">Margin bottom 1.5rem</div>
<div class="gap-3">Flex/grid gap 0.75rem</div>

<!-- Layout -->
<div class="flex items-center justify-between">Flexbox row</div>
<div class="flex flex-col">Flexbox column</div>
<div class="grid gap-4 md:grid-cols-2">Responsive grid</div>

<!-- Sizing -->
<div class="w-full">Full width</div>
<div class="w-10 h-10">40px × 40px</div>
<div class="flex-1">Fill remaining space</div>

<!-- Typography -->
<p class="text-sm">Small text (0.875rem)</p>
<p class="text-xs">Extra small (0.75rem)</p>
<p class="font-medium">Medium weight</p>
<p class="font-mono">Monospace</p>
<p class="truncate">Truncate with ellipsis</p>
<p class="uppercase tracking-wider">UPPERCASE SPACED</p>

<!-- Borders -->
<div class="rounded-lg">Large radius</div>
<div class="border">1px border (needs color)</div>
<div class="border-b">Bottom border only</div>
```

## SVG Theming

SVG elements can use CSS variables for fill and stroke:

```html
<svg viewBox="0 0 100 100">
  <!-- Background -->
  <rect fill="var(--theme-background-secondary)" />

  <!-- Border/grid -->
  <line stroke="var(--theme-border)" stroke-dasharray="2" />

  <!-- Text -->
  <text fill="var(--theme-text-muted)" font-size="5">Label</text>
  <text fill="var(--theme-text)" font-size="6">Title</text>
</svg>
```

## Theme-Aware Patterns

### Section Headers

```typescript
private createSection(label: string): HTMLElement {
  const section = this.createElement('div', {
    className: 'p-4 border-b',
    attributes: { style: 'border-color: var(--theme-border);' },
  });
  section.appendChild(this.createElement('h3', {
    className: 'text-sm font-semibold uppercase tracking-wider mb-3',
    textContent: label,
    attributes: { style: 'color: var(--theme-text-muted);' },
  }));
  return section;
}
```

### Active/Selected States

```typescript
// Button in nav - active state
const isActive = this.activeToolId === tool.id;
btn.setAttribute('style', isActive
  ? 'background: var(--theme-primary); color: var(--theme-text-header);'
  : 'background: transparent; color: var(--theme-text);'
);
```

### Form Inputs

```html
<select style="background: var(--theme-background-secondary);
               color: var(--theme-text);
               border: 1px solid var(--theme-border);">

<input type="text"
       style="background: var(--theme-card-background);
              color: var(--theme-text);
              border: 1px solid var(--theme-border);">
```

### Dye Swatches

```html
<!-- Swatch with theme-aware border -->
<div class="w-8 h-8 rounded border"
     style="background: ${dye.hex}; border-color: var(--theme-border);">
</div>

<!-- Swatch with white border (on colored background) -->
<div class="w-10 h-10 rounded border-2 border-white/30"
     style="background: ${dye.hex};">
</div>
```

## Gradient Support for Theme Variables

CSS custom properties can store gradient values, enabling rich visual themes. However, there are important limitations and patterns to follow.

### The Challenge

Gradients stored in CSS variables have **context-dependent limitations**:

| CSS Property | Solid Color | Gradient | Notes |
|--------------|-------------|----------|-------|
| `color` | ✅ | ❌ | Text cannot use gradients directly |
| `background-color` | ✅ | ❌ | Only accepts solid colors |
| `background` | ✅ | ✅ | Accepts both! |
| `background-image` | ❌ | ✅ | Gradients only |
| `border-color` | ✅ | ❌ | No gradient support |
| `border-image` | ❌ | ✅ | Workaround for gradient borders |
| `fill` (SVG) | ✅ | ❌* | Requires `<linearGradient>` defs |

### Recommended Variable Structure

To support both solid colors and gradients, use **paired variables**:

```css
:root {
  /* Solid colors - for text, borders, SVG fills */
  --theme-primary: #8B2942;
  --theme-primary-light: #A83A56;
  --theme-primary-dark: #6B1F32;

  /* Gradient variants - for backgrounds only */
  --theme-primary-gradient: linear-gradient(135deg, #8B2942, #A83A56);
  --theme-primary-gradient-hover: linear-gradient(135deg, #A83A56, #C04A66);

  /* Border handling */
  --theme-border: #3A3A3A;
  --theme-border-gradient: linear-gradient(90deg, #3A3A3A, #5A5A5A);
}
```

### Usage Patterns

#### Primary Button with Gradient Background

```html
<!-- Solid fallback with gradient enhancement -->
<button style="
  background: var(--theme-primary);
  background: var(--theme-primary-gradient);
  color: var(--theme-text-header);
">
  Primary Action
</button>
```

The second `background` declaration overrides the first in supporting browsers, while the solid color remains as a fallback.

#### Gradient Borders (Advanced)

CSS `border-color` doesn't support gradients, but there are workarounds:

**Method 1: `border-image`**
```css
.gradient-border {
  border: 2px solid transparent;
  border-image: var(--theme-border-gradient) 1;
  border-radius: 0; /* border-image doesn't support border-radius! */
}
```

**Method 2: Pseudo-element (supports border-radius)**
```css
.gradient-border-rounded {
  position: relative;
  background: var(--theme-card-background);
  border-radius: 8px;
}

.gradient-border-rounded::before {
  content: '';
  position: absolute;
  inset: -2px; /* border width */
  border-radius: 10px; /* slightly larger */
  background: var(--theme-border-gradient);
  z-index: -1;
}
```

**Method 3: Background gradient with padding (simplest)**
```css
.gradient-border-simple {
  background:
    linear-gradient(var(--theme-card-background), var(--theme-card-background)) padding-box,
    var(--theme-border-gradient) border-box;
  border: 2px solid transparent;
  border-radius: 8px;
}
```

### Theme Ideas with Gradients

#### Sunset Theme
```css
.theme-sunset {
  --theme-primary: #E85A5A;
  --theme-primary-gradient: linear-gradient(135deg, #E85A5A 0%, #F5A623 50%, #E8C44A 100%);
  --theme-border-gradient: linear-gradient(90deg, #E85A5A33, #F5A62333);
}
```

#### Ocean Theme
```css
.theme-ocean {
  --theme-primary: #0EA5E9;
  --theme-primary-gradient: linear-gradient(135deg, #0EA5E9, #06B6D4, #14B8A6);
  --theme-border-gradient: linear-gradient(90deg, #0EA5E933, #14B8A633);
}
```

#### Aurora Theme (animated!)
```css
.theme-aurora {
  --theme-primary: #7C3AED;
  --theme-primary-gradient: linear-gradient(
    135deg,
    #7C3AED 0%,
    #06B6D4 25%,
    #22C55E 50%,
    #F59E0B 75%,
    #EF4444 100%
  );
  background-size: 400% 400%;
  animation: aurora-shift 15s ease infinite;
}

@keyframes aurora-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

#### Metallic Theme
```css
.theme-metallic {
  --theme-primary: #9CA3AF;
  --theme-primary-gradient: linear-gradient(
    135deg,
    #6B7280 0%,
    #D1D5DB 40%,
    #9CA3AF 60%,
    #4B5563 100%
  );
}
```

### Gradient Text (Special Case)

To apply gradients to text, use `background-clip`:

```css
.gradient-text {
  background: var(--theme-primary-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

```html
<h1 class="gradient-text">XIV Dye Tools</h1>
```

**Caution**: Gradient text has accessibility concerns - ensure sufficient contrast and don't use for body text.

### SVG Gradient Support

SVG requires explicit gradient definitions:

```html
<svg viewBox="0 0 100 100">
  <defs>
    <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--theme-primary)" />
      <stop offset="100%" stop-color="var(--theme-primary-light)" />
    </linearGradient>
  </defs>

  <!-- Use the gradient -->
  <rect fill="url(#primaryGradient)" width="100" height="100" />
</svg>
```

### Implementation Recommendations

1. **Always provide solid fallbacks** - gradients are enhancements
2. **Use `background` not `background-color`** for gradient support
3. **Pair solid + gradient variables** for flexibility
4. **Test performance** - complex gradients can impact rendering
5. **Consider reduced motion** - skip animated gradients for users who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .theme-aurora {
    animation: none;
    background-position: 0% 50%;
  }
}
```

---

## Migration Tips

1. **Replace hardcoded colors** with CSS variables
2. **Test in both themes** after styling changes
3. **Watch for specificity issues** in DevTools
4. **Use `!important` sparingly** but when needed
5. **Keep Tailwind for layout**, CSS vars for colors
6. **Document any `!important` usage** for future reference
7. **Add gradient variants** as progressive enhancement
8. **Respect motion preferences** for animated themes
