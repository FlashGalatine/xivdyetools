# XIV Dye Tools v4.0 Component Migration Map

This document maps existing v3 components to their v4 counterparts, identifies new components needed, and specifies reusable components that carry forward unchanged.

---

## 1. Layout Components

### Components to Replace

| v3 Component | v4 Component | Migration Notes |
|-------------|--------------|-----------------|
| `TwoPanelShell` | `V4LayoutShell` | Complete rewrite; new layout paradigm |
| `v3-layout.ts` | `v4-layout.ts` | New initialization, different structure |
| `app-layout.ts` | Merge into `V4LayoutShell` | Header/footer logic integrated |

### New Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `V4LayoutShell` | `v4-layout-shell.ts` | Main container orchestrating header, banner, sidebar, content |
| `V4AppHeader` | `v4-app-header.ts` | 48px header with logo, theme/language/settings buttons |
| `ToolBanner` | `tool-banner.ts` | 64px horizontal tool navigation with 9 icons |
| `ConfigSidebar` | `config-sidebar.ts` | 320px glassmorphism sidebar for tool settings |

### Components to Retain (with styling updates)

| Component | Updates Needed |
|-----------|----------------|
| `MobileDrawer` | Update styling for v4 theme, reuse slide logic |
| `CollapsiblePanel` | Add glassmorphism variant styling |

---

## 2. Shared UI Components

### Components to Replace

| v3 Component | v4 Component | Migration Notes |
|-------------|--------------|-----------------|
| Various result cards | `ResultCard` | Unified 320px card with standard layout |
| Custom action menus | `ContextMenuDropdown` | Standardized dropdown with icons |
| Basic toggles | `ToggleSwitchV4` | Modern toggle with animation |

### New Shared Components

| Component | File | Description |
|-----------|------|-------------|
| `ResultCard` | `result-card.ts` | 320px unified result card (split preview, 2-col data) |
| `GlassPanel` | `glass-panel.ts` | Glassmorphism container with blur effect |
| `ContextMenuDropdown` | `context-menu-dropdown.ts` | Action menu with icons (kebab trigger) |
| `ToggleSwitchV4` | `toggle-switch-v4.ts` | Animated toggle switch |
| `RangeSliderV4` | `range-slider-v4.ts` | Enhanced range slider with v4 styling |

### Components to Retain

| Component | Updates Needed |
|-----------|----------------|
| `DyeSelector` | Minor styling, container updates |
| `DyeGrid` | Styling updates for v4 theme |
| `DyeFilters` | Move to ConfigSidebar context |
| `DyeSearchBox` | Styling updates |
| `DyeActionDropdown` | May merge with `ContextMenuDropdown` |
| `ColorDisplay` | Styling updates |
| `ColorWheelDisplay` | Container styling, keep visualization |
| `ColorPickerDisplay` | Styling updates |
| `ColorDistanceMatrix` | Styling updates |
| `MarketBoard` | Styling updates |
| `PaletteExporter` | Styling updates |

---

## 3. Tool Components

### Tool File Renames

| v3 File | v4 File | Class Rename |
|---------|---------|--------------|
| `matcher-tool.ts` | `extractor-tool.ts` | `MatcherTool` → `ExtractorTool` |
| `mixer-tool.ts` | `gradient-tool.ts` | `MixerTool` → `GradientTool` |
| `character-tool.ts` | `swatch-tool.ts` | `CharacterTool` → `SwatchTool` |

### New Tool Component

| Component | File | Description |
|-----------|------|-------------|
| `DyeMixerTool` | `dye-mixer-tool.ts` | Crafting-style mixer (slot UI, blend output) |

### Tools Retained (with updates)

| Tool | Key Updates |
|------|-------------|
| `HarmonyTool` | Use V4LayoutShell, update result cards to `ResultCard` |
| `AccessibilityTool` | Use V4LayoutShell, keep custom vision sim cards |
| `ComparisonTool` | Use V4LayoutShell, update to `ResultCard` |
| `PresetTool` | Use V4LayoutShell, update grid styling |
| `BudgetTool` | Use V4LayoutShell, update to `ResultCard` |

---

## 4. Modal Components

### Components to Update

| Component | Updates Needed |
|-----------|----------------|
| `WelcomeModal` | Glassmorphism styling, v4 button styles |
| `ChangelogModal` | Glassmorphism styling |
| `CollectionManagerModal` | Glassmorphism styling |
| `CameraPreviewModal` | Glassmorphism styling |

### New Modal Components

| Component | File | Description |
|-----------|------|-------------|
| `LoginModal` | `login-modal.ts` | Discord/XIVAuth login for Community Presets |
| `PresetDetailModal` | `preset-detail-modal.ts` | Full preset view with dye cards |

### Modal Pattern Updates

All modals should adopt:
```css
.modal-overlay {
  backdrop-filter: blur(4px);
}
.modal-content {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
}
```

---

## 5. Service-Related Components

### No Changes Needed

These components work with services but don't need structural changes:
- Toast notification rendering (via `ToastService`)
- Tooltip rendering (via `TooltipService`)
- Announcer (screen reader, via `AnnouncerService`)

---

## 6. Unified Result Card Specification

The `ResultCard` component is the most critical new shared component. It must support all tool output scenarios.

### Structure

```
ResultCard (320px fixed width)
├── CardHeader
│   ├── DyeName (left)
│   └── ContextMenuTrigger (right, kebab icon)
├── CardPreview
│   ├── LeftHalf (Original/Input color)
│   │   └── Label: "Original"
│   └── RightHalf (Matched Dye color)
│       └── Label: "Match"
├── CardDetails (2-column grid)
│   ├── TechnicalColumn
│   │   ├── ΔE value (color-coded)
│   │   ├── HEX value
│   │   ├── RGB value
│   │   └── (optional) HSV value
│   └── AcquisitionColumn
│       ├── Source (Vendor/Crafted/Retainer)
│       ├── Market server
│       └── Price (large text)
└── CardActions (optional)
    └── Primary action button
```

### Props Interface

```typescript
interface ResultCardProps {
  dyeName: string;
  originalColor: string;      // HEX
  matchedColor: string;       // HEX
  deltaE: number;
  hex: string;
  rgb: [number, number, number];
  hsv?: [number, number, number];
  source: 'Vendor' | 'Crafted' | 'Retainer' | 'Event' | 'Achievement';
  marketServer?: string;
  price?: number;
  priceUnit?: string;         // Default: 'G'
  onSelect?: () => void;
  onContextMenu?: (action: string) => void;
  showActions?: boolean;
  primaryActionLabel?: string;
}
```

### Context Menu Actions

Standard actions available in dropdown:
1. Add to Comparison
2. Add to Mixer
3. Add to Accessibility Check
4. See Color Harmonies
5. Budget Suggestions
6. Copy Hex Code

---

## 7. Tool-Specific Component Mapping

### Harmony Explorer

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Left panel config | `ConfigSidebar` section |
| Harmony ring visualization | Retain `ColorWheelDisplay` |
| Result list | Grid of `ResultCard` components |

### Palette Extractor (was Color Matcher)

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Image dropzone | Retain with glassmorphism styling |
| Zoom controls | Retain floating toolbar |
| Color extraction results | Grid of `ResultCard` components |

### Gradient Builder (was Dye Mixer)

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Start/End dye selectors | `ConfigSidebar` section |
| Interpolation track | Retain linear visualization |
| Step results | Grid of `ResultCard` components |

### Dye Mixer (NEW)

| Component | Description |
|-----------|-------------|
| `DyeSlot` | 100x100px input slot (inventory style) |
| `ResultSlot` | 120x120px result slot (larger) |
| `MixingArrow` | Visual connector between slots |
| Result suggestions | Grid of `ResultCard` components |

### Accessibility Checker

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Vision simulation cards | Retain custom cards (not `ResultCard`) |
| WCAG table | Retain with v4 table styling |
| Pairwise matrix | Retain `ColorDistanceMatrix` |

### Dye Comparison

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Comparison chart | Retain `DyeComparisonChart` |
| Side-by-side cards | Grid of `ResultCard` components |

### Community Presets

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Preset grid | Retain grid with `PresetCard` |
| Category tabs | New tab component in v4 style |
| Detail modal | New `PresetDetailModal` |
| Auth buttons | New `LoginModal` |

### Budget Suggestions

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Quick picks | Button group in `ConfigSidebar` |
| Results | Grid of `ResultCard` with savings highlight |

### Swatch Matcher (was Character Matcher)

| v3 Component/Pattern | v4 Component |
|---------------------|--------------|
| Color sheet grid | Retain 8-column swatch grid |
| Selected color info | Custom info card |
| Matching dyes | Grid of `ResultCard` components |

---

## 8. Icon Updates

### Existing Icons (Retain)

Located in `src/shared/tool-icons.ts`:
- `ICON_TOOL_HARMONY`
- `ICON_TOOL_MATCHER` (rename ref to Extractor)
- `ICON_TOOL_ACCESSIBILITY`
- `ICON_TOOL_COMPARISON`
- `ICON_TOOL_MIXER` (rename ref to Gradient)
- `ICON_TOOL_PRESETS`
- `ICON_TOOL_BUDGET`
- `ICON_TOOL_CHARACTER` (rename ref to Swatch)

### New Icon Needed

| Icon | Description |
|------|-------------|
| `ICON_TOOL_DYE_MIXER` | Crafting/mixing style icon for new Dye Mixer |

Suggested design: Two overlapping circles or beakers representing color mixing.

---

## 9. Component Dependency Graph

```
V4LayoutShell
├── V4AppHeader
│   └── (theme/language/settings buttons)
├── ToolBanner
│   └── (9 tool buttons)
├── ConfigSidebar
│   ├── GlassPanel
│   ├── ToggleSwitchV4
│   └── RangeSliderV4
└── ContentArea
    └── [Tool Component]
        ├── ResultCard
        │   └── ContextMenuDropdown
        ├── ColorWheelDisplay (Harmony)
        ├── DyeComparisonChart (Comparison)
        └── [Tool-specific components]
```

---

## 10. Migration Checklist by Component Type

### Layout Components
- [ ] Create `V4LayoutShell`
- [ ] Create `V4AppHeader`
- [ ] Create `ToolBanner`
- [ ] Create `ConfigSidebar`
- [ ] Update `MobileDrawer` styling

### Shared Components
- [ ] Create `ResultCard`
- [ ] Create `GlassPanel`
- [ ] Create `ContextMenuDropdown`
- [ ] Create `ToggleSwitchV4`
- [ ] Create `RangeSliderV4`
- [ ] Update `DyeSelector` styling
- [ ] Update `DyeGrid` styling
- [ ] Update `ColorWheelDisplay` container

### Tool Components
- [ ] Rename `matcher-tool.ts` → `extractor-tool.ts`
- [ ] Rename `mixer-tool.ts` → `gradient-tool.ts`
- [ ] Rename `character-tool.ts` → `swatch-tool.ts`
- [ ] Create `dye-mixer-tool.ts` (new)
- [ ] Update all 9 tools for V4LayoutShell

### Modal Components
- [ ] Create `LoginModal`
- [ ] Create `PresetDetailModal`
- [ ] Update existing modals with glassmorphism

### Icons
- [ ] Add `ICON_TOOL_DYE_MIXER`
- [ ] Update icon references for renamed tools
