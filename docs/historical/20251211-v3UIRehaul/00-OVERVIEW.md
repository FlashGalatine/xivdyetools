# XIV Dye Tools v3.0.0 UI Redesign Overview

## Introduction

This document provides a high-level overview of the v3.0.0 UI redesign for XIV Dye Tools. The redesign introduces a **two-panel layout architecture** that separates configuration (inputs) from results (outputs), providing a cleaner and more efficient user experience on both desktop and mobile devices.

## Key Design Goals

1. **Separation of Concerns** - Clear distinction between configuration controls (left) and results display (right)
2. **Responsive Design** - Optimized experiences for desktop (≥768px) and mobile (<768px)
3. **Consistent Theming** - CSS custom properties for seamless theme switching
4. **Collapsible Sidebar** - Desktop users can collapse the left panel for more content space
5. **Mobile-First Navigation** - Bottom navigation bar + slide-out drawer for mobile

## Layout Architecture

### Desktop View (≥768px)

```
┌─────────────────────────────────────────────────────────────┐
│                    Header (existing)                        │
├────────────────────┬────────────────────────────────────────┤
│   LEFT PANEL       │           RIGHT PANEL                  │
│   (280px default)  │           (flex-1)                     │
│                    │                                        │
│  ┌──────────────┐  │   ┌──────────────────────────────────┐ │
│  │ Tool Nav     │  │   │                                  │ │
│  │ - Harmony    │  │   │                                  │ │
│  │ - Matcher    │  │   │     Results / Visualizations     │ │
│  │ - Access.    │  │   │                                  │ │
│  │ - Compare    │  │   │     (Charts, Grids, Swatches)    │ │
│  │ - Mixer      │  │   │                                  │ │
│  │ - Presets    │  │   │                                  │ │
│  │ - Budget     │  │   │                                  │ │
│  └──────────────┘  │   │                                  │ │
│                    │   └──────────────────────────────────┘ │
│  ┌──────────────┐  │                                        │
│  │ Config Area  │  │                                        │
│  │              │  │                                        │
│  │ - Dye Select │  │                                        │
│  │ - Options    │  │                                        │
│  │ - Filters    │  │                                        │
│  └──────────────┘  │                                        │
│                    │                                        │
│  [< Collapse]      │                                        │
├────────────────────┴────────────────────────────────────────┤
│                    Footer (existing)                        │
└─────────────────────────────────────────────────────────────┘
```

### Mobile View (<768px)

```
┌───────────────────────────────────┐
│          Mobile Header            │
│  [☰]  Current Tool Name           │
├───────────────────────────────────┤
│                                   │
│                                   │
│    Results / Visualizations       │
│    (Full Width)                   │
│                                   │
│                                   │
│                                   │
│                                   │
├───────────────────────────────────┤
│ [🎨] [🔍] [♿] [📊] [🧪] [📁] [💰]│
│  Bottom Navigation (Fixed)        │
└───────────────────────────────────┘

    Mobile Drawer (slides from left)
┌───────────────────────────────────┐
│  Configuration  [✕]               │
├───────────────────────────────────┤
│  Tool Navigation                  │
│  ─────────────────                │
│  Tool-Specific Config             │
│  - Options                        │
│  - Filters                        │
│  - Market Board                   │
└───────────────────────────────────┘
```

## Tool Suite

| Tool | ID | Description |
|------|-----|-------------|
| **Color Harmony Explorer** | `harmony` | Generate color harmonies from a base dye |
| **Color Matcher** | `matcher` | Match image colors to in-game dyes |
| **Accessibility Checker** | `accessibility` | Check color visibility for color vision types |
| **Dye Comparison** | `comparison` | Compare multiple dyes side-by-side |
| **Dye Mixer** | `mixer` | Interpolate between two dyes |
| **Preset Palettes** | `presets` | Browse and share community presets |
| **Budget Suggestions** | `budget` | Find affordable alternatives to expensive dyes |

## CSS Custom Panel Widths

```css
:root {
  --panel-left-width: 280px;
  --panel-collapsed-width: 64px;
  --drawer-transition: 0.3s ease-out;
}
```

## File Structure

```
src/mockups/
├── index.ts                 # Exports all mockup components
├── MockupShell.ts           # Main two-panel shell component
├── MockupNav.ts             # Tool navigation helpers
├── MobileDrawer.ts          # Slide-out drawer for mobile
├── CollapsiblePanel.ts      # Reusable collapsible section
├── IconRail.ts              # Icon-only navigation rail
└── tools/
    ├── HarmonyMockup.ts     # Color Harmony Explorer
    ├── MatcherMockup.ts     # Color Matcher
    ├── AccessibilityMockup.ts # Accessibility Checker
    ├── ComparisonMockup.ts  # Dye Comparison
    ├── MixerMockup.ts       # Dye Mixer
    ├── PresetsMockup.ts     # Preset Browser
    └── BudgetMockup.ts      # Budget Suggestions
```

## Technology Stack

- **Framework**: Vanilla TypeScript with BaseComponent pattern
- **Styling**: Tailwind CSS v4 + CSS Custom Properties
- **Build**: Vite 7
- **State**: LocalStorage via StorageService for persistence
- **i18n**: LanguageService for localization

## Next Steps

See the following documents for detailed implementation guidance:

1. [01-ARCHITECTURE.md](./01-ARCHITECTURE.md) - Component architecture deep-dive
2. [02-COMPONENTS.md](./02-COMPONENTS.md) - Reusable component reference
3. [03-TOOL-MOCKUPS.md](./03-TOOL-MOCKUPS.md) - Tool-specific mockup specs
4. [04-THEME-SYSTEM.md](./04-THEME-SYSTEM.md) - CSS theming guide
5. [05-MIGRATION-CHECKLIST.md](./05-MIGRATION-CHECKLIST.md) - Step-by-step migration plan
