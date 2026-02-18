# XIV Dye Tools - SVG Icon Documentation

> **Generated:** 2024-12-14
> **Purpose:** Comprehensive documentation of all SVG icons used in the XIV Dye Tools web application for redesign reference.

---

## Table of Contents

1. [Overview](#overview)
2. [Icon Categories](#icon-categories)
3. [UI Icons](#ui-icons)
4. [Tool Navigation Icons](#tool-navigation-icons)
5. [Harmony Type Icons](#harmony-type-icons)
6. [Social Media Icons](#social-media-icons)
7. [Category Icons](#category-icons)
8. [Empty State Icons](#empty-state-icons)
9. [Component Icons](#component-icons)
10. [App Logo](#app-logo)
11. [Design Guidelines](#design-guidelines)
12. [Source File References](#source-file-references)

---

## Overview

The XIV Dye Tools web application uses **72+ SVG icons** across various categories. All icons are designed to:

- Use `currentColor` for theme adaptation (dark/light mode support)
- Maintain consistent stroke widths (typically 1.5-2px)
- Use a 24x24 viewBox standard (with some exceptions)
- Support accessibility with `<title>` elements

### Icon Storage Methods

1. **Inline SVG Strings** - Stored as TypeScript template literals in `src/shared/` modules
2. **External SVG Files** - Static files in `public/assets/icons/` (duplicated in `dist/`)
3. **Component-Embedded** - Inline SVGs directly in component files

---

## Icon Categories

| Category | Count | Location | Purpose |
|----------|-------|----------|---------|
| UI Icons | 13 | `icons/ui/` | General UI actions (save, share, upload, etc.) |
| Tool Icons | 8 | `icons/tools/` | Navigation between tools |
| Harmony Icons | 9 | `icons/harmony/` | Color harmony type indicators |
| Social Icons | 6 | `icons/social/` | External social media links |
| Category Icons | 8 | `icons/categories/` | Preset palette categories |
| Empty State Icons | 8 | `icons/empty-states/` | Placeholder/error states |
| Component Icons | 20 | `icons/components/` | Action buttons & feedback |
| Logo | 1 | `icons/logo/` | App branding |

**Total: 73 icons**

---

## UI Icons

General user interface action icons used throughout the application.

| Icon | Filename | Description | Used In |
|------|----------|-------------|---------|
| 🎨 Theme | `theme.svg` | Paint palette for theme switcher | Header, settings |
| 📷 Camera | `camera.svg` | Camera for photo capture | Image upload |
| 💧 Eyedropper | `eyedropper.svg` | Color picker tool | Color matching |
| 💾 Save | `save.svg` | Floppy disk for save actions | Palette saving |
| 🔗 Share | `share.svg` | Chain link for sharing | URL sharing |
| 💡 Hint | `hint.svg` | Light bulb for tips | Tooltips, help |
| 📐 Zoom Fit | `zoom-fit.svg` | Fit content to viewport | Image viewer |
| ↔️ Zoom Width | `zoom-width.svg` | Fit to width | Image viewer |
| 💎 Crystal | `crystal.svg` | FFXIV-style gem crystal | FFXIV branding |
| 📁 Upload | `upload.svg` | Folder with arrow | File upload |
| ⚠️ Warning | `warning.svg` | Triangle with exclamation | Error alerts |
| 🎲 Dice | `dice.svg` | Random selection | Random color |
| 💰 Coins | `coins.svg` | Stacked coins (Gil) | Budget/pricing |

### Source File
- `src/shared/ui-icons.ts`

---

## Tool Navigation Icons

Icons representing the main tools in the application.

| Icon | Filename | Description | Tool |
|------|----------|-------------|------|
| 🌈 Harmony | `harmony.svg` | Triadic points on color wheel | Harmony Explorer |
| 🎯 Matcher | `matcher.svg` | Bullseye/target circles | Color Matcher |
| 👁️ Accessibility | `accessibility.svg` | Eye shape | Accessibility Checker |
| ⬜ Comparison | `comparison.svg` | Overlapping color swatches | Dye Comparison |
| 🎨 Mixer | `mixer.svg` | Palette with brush | Dye Mixer |
| 📑 Presets | `presets.svg` | Color swatches with bookmark | Preset Palettes |
| 💵 Budget | `budget.svg` | Coin with dollar sign | Budget Suggestions |
| 🧰 Tools Menu | `tools-menu.svg` | Toolbox | Tools dropdown |

### Source File
- `src/shared/tool-icons.ts`

---

## Harmony Type Icons

Visual representations of color harmony relationships on a color wheel.

| Icon | Filename | Description | Colors Used |
|------|----------|-------------|-------------|
| ◐ Complementary | `complementary.svg` | Two points opposite on wheel | 2 |
| ≋ Analogous | `analogous.svg` | Three adjacent points | 3 |
| △ Triadic | `triadic.svg` | Triangle on wheel | 3 |
| Y Split-Comp | `split-complementary.svg` | Y-shape from base | 3 |
| ▢ Tetradic | `tetradic.svg` | Rectangle on wheel | 4 |
| ◇ Square | `square.svg` | Diamond/square on wheel | 4 |
| ● Monochromatic | `monochromatic.svg` | Vertical dots (same hue) | 3+ |
| ⊕ Compound | `compound.svg` | Complementary + analogous | 4 |
| ▼ Shades | `shades.svg` | Vertical dots (light to dark) | 3+ |

### Source File
- `src/shared/harmony-icons.ts`

---

## Social Media Icons

Brand icons for external social links in footer/header.

| Icon | Filename | Platform | ViewBox |
|------|----------|----------|---------|
| 🐙 GitHub | `github.svg` | GitHub | 24x24 |
| 𝕏 Twitter | `twitter.svg` | Twitter/X | 24x24 |
| 📺 Twitch | `twitch.svg` | Twitch | 24x24 |
| 🦋 Bluesky | `bluesky.svg` | Bluesky | 64x57 |
| 💬 Discord | `discord.svg` | Discord | 24x24 |
| ❤️ Patreon | `patreon.svg` | Patreon | 24x24 |

### Source File
- `src/shared/social-icons.ts`

---

## Category Icons

Icons representing preset palette categories (FFXIV-themed).

| Icon | Filename | Category | Description |
|------|----------|----------|-------------|
| ⚔️ Jobs | `jobs.svg` | Jobs | Crossed sword & staff |
| 🚩 Grand Companies | `grand-companies.svg` | Grand Companies | Banner/flag |
| ☀️❄️ Seasons | `seasons.svg` | Seasons | Sun + snowflake |
| ✨ Events | `events.svg` | Events | Star burst |
| 💎 Aesthetics | `aesthetics.svg` | Aesthetics | Diamond/gem |
| 👥 Community | `community.svg` | Community | People silhouettes |
| 🎨 Default | `default.svg` | Fallback | Color palette dots |
| ← Arrow Back | `arrow-back.svg` | Navigation | Left chevron |

### Source File
- `src/shared/category-icons.ts`

---

## Empty State Icons

Icons displayed when content is empty or loading.

| Icon | Filename | State | Message Example |
|------|----------|-------|-----------------|
| 🔍 Search | `search.svg` | No results | "No dyes match your search" |
| 🎨 Palette | `palette.svg` | No selection | "Select a dye to begin" |
| 💰 Coins | `coins.svg` | No prices | "Price data unavailable" |
| 🎵 Harmony | `harmony.svg` | No harmonies | "No harmonies found" |
| 🖼️ Image | `image.svg` | No image | "Upload an image" |
| ⚠️ Warning | `warning.svg` | Error | "Something went wrong" |
| ⏳ Loading | `loading.svg` | Loading | "Loading..." |
| 📁 Folder | `folder.svg` | Empty saved | "No saved palettes" |

### Source File
- `src/shared/empty-state-icons.ts`

---

## Component Icons

Action and feedback icons embedded in specific components.

### Action Icons

| Icon | Filename | Action | Components Using |
|------|----------|--------|------------------|
| ➕ Plus | `plus.svg` | Add item | Collection menu, presets |
| ✓ Checkmark | `checkmark.svg` | Confirm/selected | Collection menu |
| ✏️ Edit | `edit.svg` | Edit item | Collection manager |
| 🗑️ Delete | `delete.svg` | Remove item | Collections, palettes |
| ⬇️ Download | `download.svg` | Export data | Collection export |
| 🔖 Bookmark | `bookmark.svg` | Save/favorite | Harmony, palettes |
| ⭐ Star Filled | `star-filled.svg` | Favorited | Dye grid |
| ☆ Star Outline | `star-outline.svg` | Not favorited | Dye grid |

### Navigation Icons

| Icon | Filename | Action | Components Using |
|------|----------|--------|------------------|
| ▼ Chevron Down | `chevron-down.svg` | Expand | Dropdowns, accordions |
| ◀ Chevron Left | `chevron-left.svg` | Previous/back | Panel toggle |
| ▶ Chevron Right | `chevron-right.svg` | Next/forward | Panel toggle |
| ✕ Close | `close.svg` | Close/dismiss | Modals, toasts |
| ☰ Menu | `menu.svg` | Toggle menu | Mobile nav |
| 🔄 Refresh | `refresh.svg` | Reload data | Submissions panel |

### Feedback Icons

| Icon | Filename | State | Components Using |
|------|----------|-------|------------------|
| ⟳ Spinner | `spinner.svg` | Loading | Market board, buttons |
| ✓ Success | `toast-success.svg` | Success toast | Toast container |
| ✕ Error | `toast-error.svg` | Error toast | Toast container |
| ⚠ Warning | `toast-warning.svg` | Warning toast | Toast container |
| ℹ Info | `toast-info.svg` | Info toast | Toast container |

### Source Files
- `src/components/add-to-collection-menu.ts`
- `src/components/collection-manager-modal.ts`
- `src/components/dye-grid.ts`
- `src/components/toast-container.ts`
- `src/components/two-panel-shell.ts`
- And others...

---

## App Logo

| Icon | Filename | Description |
|------|----------|-------------|
| ✨🎨💎 Sparkles Logo | `sparkles-logo.svg` | Rainbow crystal + paintbrush + sparkles |

### Design Elements
- **Crystal**: 6-faceted gem with rainbow gradient fills
- **Paintbrush**: Angled brush with rainbow bristle tip
- **Sparkles**: Decorative 5-point stars and dots
- **ViewBox**: 138.77 × 192.24 (portrait orientation)

### Color Gradients Used
- `rainbowGradient`: Full spectrum (red → violet)
- `rainbowHighlight`: Lighter pastel accents
- `rainbowShadow`: Darker shadow tones

### Source File
- `src/shared/app-logo.ts`

---

## Design Guidelines

### Consistent Styling

```svg
<!-- Standard icon template -->
<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  xmlns="http://www.w3.org/2000/svg">
  <title>Icon Name</title>
  <!-- paths here -->
</svg>
```

### Key Principles

1. **ViewBox**: Standard 24×24, exceptions noted
2. **Stroke Width**: 1.5-2 for most icons
3. **Color**: Use `currentColor` for theme support
4. **Opacity**: Use for depth (0.3-0.7 for secondary elements)
5. **Fill vs Stroke**:
   - Outline icons: `stroke` only
   - Solid icons: `fill="currentColor"`
   - Mixed: Filled centers with stroked outlines

### Theme Adaptation

All icons automatically adapt to the current theme by using `currentColor`:

```css
/* Icons inherit text color */
.icon { color: var(--text-primary); }
.icon-muted { color: var(--text-secondary); }
```

---

## Source File References

### Centralized Icon Modules

| File | Icons | Description |
|------|-------|-------------|
| `src/shared/ui-icons.ts` | 13 | General UI actions |
| `src/shared/tool-icons.ts` | 8 | Tool navigation |
| `src/shared/harmony-icons.ts` | 9 | Harmony types |
| `src/shared/social-icons.ts` | 6 | Social platforms |
| `src/shared/category-icons.ts` | 8 | Preset categories |
| `src/shared/empty-state-icons.ts` | 8 | Empty/error states |
| `src/shared/app-logo.ts` | 1 | App branding |

### Static Icon Files

```
public/assets/icons/
├── harmony/          # 9 harmony type SVGs
├── tools/            # 6 tool SVGs
├── social/           # 7 social SVGs
├── camera.svg
├── crystal.svg
├── eyedropper.svg
├── hint.svg
├── info.svg
├── save.svg
├── share.svg
├── sparkles.svg
├── theme.svg
├── upload.svg
├── zoom-fit.svg
└── zoom-width.svg
```

### Component-Embedded Icons

Found inline in various component files under `src/components/`:
- `auth-button.ts` - Discord, XIVAuth icons
- `dye-grid.ts` - Star, folder icons
- `toast-container.ts` - Success, error, warning, info icons
- `two-panel-shell.ts` - Chevron navigation icons
- And others...

---

## Notes for Redesign

### Current Issues to Address

1. **Inconsistent Storage**: Icons split between inline strings and external files
2. **Duplicate Icons**: Same icon defined in multiple places (e.g., warning icon)
3. **Mixed ViewBoxes**: Most are 24×24, but some differ (Bluesky 64×57)
4. **No Icon System**: Consider implementing an icon sprite or component library

### Recommendations

1. **Consolidate**: Move all icons to a single icon system
2. **Standardize**: Ensure all icons use consistent viewBox and stroke weights
3. **Document**: Keep this documentation updated with any changes
4. **Optimize**: Consider using SVG sprites for production builds
5. **Accessibility**: Ensure all icons have proper `<title>` elements

---

*Documentation generated for XIV Dye Tools SVG Redesign Initiative*
