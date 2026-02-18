# v3.0.0 Tool Mockup Specifications

This document details the UI layout and components for each tool in the v3.0 redesign.

---

## 1. Color Harmony Explorer (`harmony`)

**Purpose**: Generate color harmonies from a base dye.

### Left Panel (Configuration)

| Section | Components |
|---------|------------|
| **Base Dye** | Current dye display (swatch + name) + 6-dye grid selector |
| **Harmony Type** | Scrollable list of 9 harmony types (Complementary, Analogous, Triadic, etc.) |
| **Companion Dyes** | Slider (3-8) for number of matched dyes per harmony color |
| **Dye Filters** | Collapsible - checkboxes: Exclude Metallic, Pastel, Expensive |
| **Market Board** | Collapsible - Data Center selector + Show Prices toggle |

### Right Panel (Results)

| Section | Components |
|---------|------------|
| **Color Wheel** | SVG visualization showing base color + harmony points |
| **Results Header** | "Harmony Results" label + Export button |
| **Harmony Cards** | Grid of cards (1-3 cols responsive), each with: swatch, hex badge, matched dyes row |

### Harmony Types Supported

```typescript
const HARMONY_TYPES = [
  { id: 'complementary', name: 'Complementary', degrees: [180] },
  { id: 'analogous', name: 'Analogous', degrees: [30, 330] },
  { id: 'triadic', name: 'Triadic', degrees: [120, 240] },
  { id: 'split-complementary', name: 'Split Complementary', degrees: [150, 210] },
  { id: 'tetradic', name: 'Tetradic', degrees: [60, 180, 240] },
  { id: 'square', name: 'Square', degrees: [90, 180, 270] },
  { id: 'monochromatic', name: 'Monochromatic', degrees: [0] },
  { id: 'compound', name: 'Compound', degrees: [30, 180, 330] },
  { id: 'shades', name: 'Shades', degrees: [15, 345] },
];
```

---

## 2. Color Matcher (`matcher`)

**Purpose**: Match image colors to in-game dyes.

### Left Panel (Configuration)

| Section | Components |
|---------|------------|
| **Image Source** | Drag-drop zone + Camera/Paste buttons |
| **Color Selection** | Current color swatch + hex display + Hex input field + Eyedropper button |
| **Options** | Sample Size slider (1-10px) + Extract Palette toggle |
| **Dye Filters** | Collapsible - checkboxes |
| **Market Board** | Collapsible - DC selector + prices toggle |

### Right Panel (Results)

| Section | Components |
|---------|------------|
| **Image Canvas** | Zoom controls (-, %, +, Fit, 1:1) + Image display area (aspect-video) |
| **Matched Dyes** | 2-column grid of ranked matches (rank badge, swatch, name, distance) |
| **Recent Colors** | Row of 5 recent color swatches |

### Features

- Image upload via drag-drop, file picker, camera, or clipboard
- Click-to-sample from image
- Color distance calculation for best matches

---

## 3. Accessibility Checker (`accessibility`)

**Purpose**: Check color visibility for different color vision types.

### Left Panel (Configuration)

| Section | Components |
|---------|------------|
| **Dye Palette** | 4-dye selected palette with swatches + names |
| **CVD Simulation** | Radio group: Normal Vision, Protanopia, Deuteranopia, Tritanopia |
| **Dye Filters** | Collapsible - checkboxes |
| **Market Board** | Collapsible - DC selector |

### Right Panel (Results)

| Section | Components |
|---------|------------|
| **Color Preview** | Grid showing original vs simulated colors |
| **Contrast Matrix** | Table comparing all dye pairs with pass/fail indicators |
| **Distinguishability Matrix** | Table with percentage scores (green/yellow/red color coding) |

### CVD Types

```typescript
const CVD_TYPES = [
  { id: 'normal', label: 'Normal Vision' },
  { id: 'protanopia', label: 'Protanopia (Red-Blind)' },
  { id: 'deuteranopia', label: 'Deuteranopia (Green-Blind)' },
  { id: 'tritanopia', label: 'Tritanopia (Blue-Blind)' },
];
```

---

## 4. Dye Comparison (`comparison`)

**Purpose**: Compare multiple dyes side-by-side with analytical charts.

### Left Panel (Configuration)

| Section | Components |
|---------|------------|
| **Selected Dyes** | List of 4 dyes with swatches + names |
| **Add Dyes** | Button to add more dyes |
| **Market Board** | Collapsible - DC selector |

### Right Panel (Results)

| Section | Components |
|---------|------------|
| **Comparison Charts** | 2-column grid: |
|  | - Hue-Saturation Plot (SVG scatter with axis labels) |
|  | - Brightness Distribution (bar chart, fills available height) |
| **Distance Matrix** | Table showing color distance between all dye pairs |

### Chart Details

#### Hue-Saturation Plot
- SVG viewBox: `0 0 130 120`
- X-axis: Hue (0° to 360°)
- Y-axis: Saturation (0% to 100%)
- Grid lines at 25% intervals
- Data points as colored circles

#### Brightness Distribution
- Flexbox container with `flex-1 h-full` for expansion
- Bars use percentage heights based on brightness value
- Labels at bottom with dye name + percentage

---

## 5. Dye Mixer (`mixer`)

**Purpose**: Interpolate between two dyes to find intermediate matches.

### Left Panel (Configuration)

| Section | Components |
|---------|------------|
| **Start Dye** | Dye display card (swatch + name + hex) with primary background, Change button |
| **End Dye** | Same as Start Dye |
| **Interpolation** | Steps slider (2-10) + Color Space toggle (RGB/HSV) |
| **Dye Filters** | Collapsible - checkboxes |
| **Market Board** | Collapsible - DC selector |

### Right Panel (Results)

| Section | Components |
|---------|------------|
| **Interpolation Preview** | Gradient bar (start → end) + step markers with indices |
| **Intermediate Dye Matches** | List of match rows (index, target swatch, arrow, match swatch, name, distance) |
| **Export Palette** | Card with Copy and Download buttons |

### Interpolation Settings

```typescript
private steps = 5;
private colorSpace: 'rgb' | 'hsv' = 'rgb';

// RGB interpolation
private interpolateColor(start: string, end: string, t: number): string {
  // Linear interpolation in RGB space
  const r = Math.round(r1 + (r2 - r1) * t);
  // ... g, b
}
```

### Important Styling Note

Dye names in the Start/End Dye sections must use `!important` to override global styles:

```typescript
<p style="color: var(--theme-text-header) !important;">${dye.name}</p>
```

---

## 6. Preset Browser (`presets`)

**Purpose**: Browse and share community preset palettes.

### Left Panel (Configuration)

| Section | Components |
|---------|------------|
| **Categories** | Button list: All, Jobs, Grand Companies, Seasons, Events, Aesthetics, Community |
| **Sort By** | Radio group: Most Popular, Most Recent, Alphabetical |
| **Account** | Login state display - logged out: Discord login button; logged in: avatar, username, submissions count, My Submissions + Submit Preset buttons |

### Right Panel (Results)

| Section | Components |
|---------|------------|
| **Featured Presets** | 2-column grid of large cards with gradient backgrounds, Featured badge |
| **All Presets** | 3-column grid of preset cards (color strip, name, author, vote count) |

### Preset Card Structure

```typescript
const preset = {
  name: 'Warrior of Light',
  author: 'Hydaelyn',
  votes: 1234,
  colors: ['#4A90D9', '#F5A623', '#7ED321', '#D0021B'],
};
```

### Authentication States

1. **Logged Out**: Shows Discord login button with explanation text
2. **Logged In**: Shows user avatar, username, submission count, action buttons

---

## 7. Budget Aware Suggestions (`budget`)

**Purpose**: Find affordable dye alternatives that are similar to expensive dyes.

### Left Panel (Configuration)

| Section | Components |
|---------|------------|
| **Target Dye** | Dye display card (swatch + name + hex) with current market price display |
| **Quick Picks** | Button row for common expensive dyes: Jet Black, Pure White, Metallic Gold, etc. |
| **Budget Limit** | Slider with logarithmic scale (0 gil → 1M gil) + current value display |
| **Sort By** | Radio group: Best Match, Lowest Price, Best Value |
| **Dye Filters** | Collapsible - checkboxes: Exclude Metallic, Pastel, Stainable-only |
| **Data Center** | Dropdown selector for price lookup |

### Right Panel (Results)

| Section | Components |
|---------|------------|
| **Target Overview** | Large card showing target dye with swatch, name, hex, current price |
| **Alternatives Header** | "X alternatives within budget" + sort indicator |
| **Alternatives List** | Scrollable list of alternative dyes, each showing: |
|  | - Color swatch (side-by-side comparison with target) |
|  | - Dye name + hex |
|  | - Color distance indicator (Δ value with visual bar) |
|  | - Market price |
|  | - Savings badge (green, e.g., "Save 199,500 gil") |
|  | - Value score (optional, shown when sorting by value) |
| **No Results State** | Message when no dyes within budget + closest affordable option suggestion |

### Value Score Calculation

```typescript
// Lower is better for both distance and price
// Normalize to 0-100 scale for comparison
const normalizedDistance = (distance / maxPossibleDistance) * 100;
const normalizedPrice = (price / maxPrice) * 100;

// Weight: 70% color match, 30% price (adjustable)
const valueScore = (normalizedDistance * 0.7) + (normalizedPrice * 0.3);
```

### Sort Options

| Sort | Behavior |
|------|----------|
| **Best Match** | Sort by color distance ascending (closest color first) |
| **Lowest Price** | Sort by market price ascending (cheapest first) |
| **Best Value** | Sort by value score ascending (best balance of match + price) |

### Popular Target Dyes

```typescript
const POPULAR_EXPENSIVE_DYES = [
  { name: 'Jet Black', avgPrice: 200000 },
  { name: 'Pure White', avgPrice: 180000 },
  { name: 'Metallic Gold', avgPrice: 150000 },
  { name: 'Metallic Silver', avgPrice: 120000 },
  { name: 'Gunmetal Black', avgPrice: 80000 },
  { name: 'Snow White', avgPrice: 60000 },
];
```

### Budget Slider Scale

```typescript
// Logarithmic scale for better UX at low price ranges
const BUDGET_TICKS = [
  { value: 0, label: '0' },
  { value: 1000, label: '1K' },
  { value: 10000, label: '10K' },
  { value: 50000, label: '50K' },
  { value: 100000, label: '100K' },
  { value: 500000, label: '500K' },
  { value: 1000000, label: '1M' },
];
```

### Alternative Card Structure

```html
<div class="flex items-center gap-3 p-3 rounded-lg"
     style="background: var(--theme-card-background); border: 1px solid var(--theme-border);">
  <!-- Color comparison -->
  <div class="flex gap-1">
    <div class="w-8 h-8 rounded" style="background: ${targetHex};"></div>
    <div class="w-8 h-8 rounded" style="background: ${alternativeHex};"></div>
  </div>

  <!-- Dye info -->
  <div class="flex-1">
    <p class="font-medium" style="color: var(--theme-text);">${dyeName}</p>
    <p class="text-xs" style="color: var(--theme-text-muted);">Δ ${distance.toFixed(1)}</p>
  </div>

  <!-- Price + savings -->
  <div class="text-right">
    <p class="font-medium" style="color: var(--theme-text);">${price.toLocaleString()} gil</p>
    <p class="text-xs font-bold" style="color: #22C55E;">Save ${savings.toLocaleString()}</p>
  </div>
</div>
```

### Integration Points

This tool integrates with existing features:

1. **Color Matcher**: "Find Cheaper" button on matched dye cards opens Budget tool with that dye
2. **Harmony Explorer**: "Find Budget Options" action for harmony results
3. **Comparison Tool**: Price column when Market Board is enabled

---

## Common Patterns Across Tools

### CollapsiblePanel Usage

Most tools have these collapsible panels:

```typescript
// Dye Filters panel
const filtersPanel = new CollapsiblePanel(container, {
  title: 'Dye Filters',
  storageKey: '<tool>_mockup_filters',
  defaultOpen: false,
  icon: ICON_FILTER,
});

// Market Board panel
const marketPanel = new CollapsiblePanel(container, {
  title: 'Market Board',
  storageKey: '<tool>_mockup_market',
  defaultOpen: false,
  icon: ICON_MARKET,
});
```

### Filters Content

```typescript
private createFiltersContent(): HTMLElement {
  const container = this.createElement('div', { className: 'space-y-2' });
  ['Exclude Metallic', 'Exclude Pastel', 'Exclude Expensive'].forEach(filter => {
    const label = this.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' });
    label.innerHTML = `
      <input type="checkbox" class="w-4 h-4 rounded">
      <span class="text-sm" style="color: var(--theme-text);">${filter}</span>
    `;
    container.appendChild(label);
  });
  return container;
}
```

### Market Content

```typescript
private createMarketContent(): HTMLElement {
  const container = this.createElement('div', { className: 'space-y-3' });
  container.innerHTML = `
    <select class="w-full p-2 rounded text-sm"
            style="background: var(--theme-background-secondary);
                   color: var(--theme-text);
                   border: 1px solid var(--theme-border);">
      <option>Aether</option>
      <option>Primal</option>
      <option>Crystal</option>
    </select>
  `;
  return container;
}
```

### Mobile Drawer Content

Each tool renders a simplified summary for the mobile drawer:

```typescript
private renderDrawerContent(): void {
  if (!this.options.drawerContent) return;
  clearContainer(this.options.drawerContent);

  const content = this.createElement('div', { className: 'p-4 space-y-3' });
  // Add quick summary of current state
  this.options.drawerContent.appendChild(content);
}
```
