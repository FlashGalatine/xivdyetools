# XIV Dye Tools v4.0 Theme Variable Matrix

This document provides a comprehensive mapping of theme variables from v3 to v4, plus computed values for all 11 themes.

---

## 1. Variable Naming Migration

### v3 → v4 Property Mapping

| v3 Property (ThemePalette) | v4 CSS Variable | Notes |
|---------------------------|-----------------|-------|
| `primary` | `--accent-primary` | Renamed for clarity |
| `background` | `--bg-app` | Main app background |
| `text` | `--text-primary` | Primary text color |
| `textHeader` | `--text-header` | Header text (on colored bg) |
| `border` | `--border-subtle` | May need opacity adjustment |
| `backgroundSecondary` | `--bg-panel` | Secondary/panel background |
| `cardBackground` | `--bg-panel` | Cards use panel bg in v4 |
| `cardHover` | (computed) | Not explicit in v4, use filter |
| `textMuted` | `--text-secondary` | Renamed for clarity |

### New v4 Variables (Not in v3)

| v4 Variable | Purpose | Derivation Strategy |
|-------------|---------|---------------------|
| `--bg-header` | Header background | Use `primary` or darker variant |
| `--bg-glass` | Glassmorphism panels | `rgba(panel, 0.7-0.9)` |
| `--text-header-muted` | Muted header text | `rgba(textHeader, 0.7)` |
| `--accent-hover` | Hover state for accent | Lighten/darken `primary` by 10% |
| `--accent-blue` | Secondary accent | Fixed `#4a90e2` or theme-specific |
| `--shadow-soft` | Soft drop shadow | Theme-aware rgba |
| `--shadow-glow` | Accent glow effect | `rgba(primary, 0.2)` |
| `--bg-gradient-start` | Gradient start | Lighter than `bg-app` |
| `--bg-gradient-end` | Gradient end | Same as `bg-app` |
| `--card-gradient-end` | Card gradient | Darker than `bg-panel` |
| `--accent-rgb` | RGB triplet | For `rgba()` usage |

---

## 2. Complete Theme Matrix

### Theme 1: Standard Light

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#D3D3D3` | `#D3D3D3` | `background` |
| `--bg-panel` | `#F5F5F5` | `#F5F5F5` | `cardBackground` |
| `--bg-header` | `#8B1A1A` | `#8B1A1A` | `primary` |
| `--bg-glass` | — | `rgba(245, 245, 245, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#1A1A1A` | `#1A1A1A` | `text` |
| `--text-secondary` | `#4A4A4A` | `#4A4A4A` | `textMuted` |
| `--text-header` | `#FFFFFF` | `#FFFFFF` | `textHeader` |
| `--text-header-muted` | — | `rgba(255, 255, 255, 0.7)` | Computed |
| `--accent-primary` | `#8B1A1A` | `#8B1A1A` | `primary` |
| `--accent-hover` | — | `#6B1515` | Darken 10% |
| `--accent-blue` | — | `#4a90e2` | Fixed |
| `--accent-rgb` | — | `139, 26, 26` | RGB of primary |
| `--border-subtle` | `#6B1515` | `#6B1515` | `border` |
| `--shadow-soft` | — | `0 4px 6px rgba(0, 0, 0, 0.1)` | Light theme |
| `--shadow-glow` | — | `0 0 10px rgba(139, 26, 26, 0.2)` | Primary glow |
| `--bg-gradient-start` | — | `#E8E8E8` | Lighten bg-app |
| `--bg-gradient-end` | — | `#D3D3D3` | bg-app |
| `--card-gradient-end` | — | `#E0E0E0` | Lighter than panel |

---

### Theme 2: Standard Dark

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#2D2D2D` | `#2D2D2D` | `background` |
| `--bg-panel` | `#1F1F1F` | `#1F1F1F` | `cardBackground` |
| `--bg-header` | `#E85A5A` | `#E85A5A` | `primary` |
| `--bg-glass` | — | `rgba(31, 31, 31, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#F5F5F5` | `#F5F5F5` | `text` |
| `--text-secondary` | `#B0B0B0` | `#B0B0B0` | `textMuted` |
| `--text-header` | `#1A1A1A` | `#1A1A1A` | `textHeader` (dark on light header) |
| `--text-header-muted` | — | `rgba(26, 26, 26, 0.7)` | Computed |
| `--accent-primary` | `#E85A5A` | `#E85A5A` | `primary` |
| `--accent-hover` | — | `#F08080` | Lighten 10% |
| `--accent-blue` | — | `#4a90e2` | Fixed |
| `--accent-rgb` | — | `232, 90, 90` | RGB of primary |
| `--border-subtle` | `#F08080` | `#F08080` | `border` |
| `--shadow-soft` | — | `0 4px 6px rgba(0, 0, 0, 0.3)` | Dark theme |
| `--shadow-glow` | — | `0 0 10px rgba(232, 90, 90, 0.2)` | Primary glow |
| `--bg-gradient-start` | — | `#444444` | Lighten bg-app |
| `--bg-gradient-end` | — | `#2D2D2D` | bg-app |
| `--card-gradient-end` | — | `#151515` | Darker than panel |

---

### Theme 3: Hydaelyn Light

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#B2C4CE` | `#B2C4CE` | `background` |
| `--bg-panel` | `#F9F8F4` | `#F9F8F4` | `cardBackground` |
| `--bg-header` | `#4056A4` | `#4056A4` | `primary` |
| `--bg-glass` | — | `rgba(249, 248, 244, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#312D57` | `#312D57` | `text` |
| `--text-secondary` | `#0C4A6E` | `#0C4A6E` | `textMuted` |
| `--text-header` | `#F9F8F4` | `#FFFFFF` | White for contrast |
| `--text-header-muted` | — | `rgba(255, 255, 255, 0.8)` | Computed |
| `--accent-primary` | `#4056A4` | `#4056A4` | `primary` |
| `--accent-hover` | — | `#314488` | Darken 10% |
| `--accent-blue` | — | `#4056A4` | Same as primary |
| `--accent-rgb` | — | `64, 86, 164` | RGB of primary |
| `--border-subtle` | `#4056A4` | `#4056A4` | `border` |
| `--shadow-soft` | — | `0 4px 6px rgba(49, 45, 87, 0.1)` | Light theme |
| `--shadow-glow` | — | `0 0 10px rgba(64, 86, 164, 0.2)` | Primary glow |
| `--bg-gradient-start` | — | `#F9F8F4` | panel color |
| `--bg-gradient-end` | — | `#B2C4CE` | bg-app |
| `--card-gradient-end` | — | `#E4E5E8` | Slightly darker |

---

### Theme 4: OG Classic Dark

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#181820` | `#181820` | `background` |
| `--bg-panel` | `#000B9D` | `#000B9D` | `cardBackground` |
| `--bg-header` | `#1E40AF` | `#1E40AF` | `primary` |
| `--bg-glass` | — | `rgba(0, 11, 157, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#F9F8F4` | `#F9F8F4` | `text` |
| `--text-secondary` | `#E4DFD0` | `#E4DFD0` | `textMuted` |
| `--text-header` | `#F9F8F4` | `#F9F8F4` | `textHeader` |
| `--text-header-muted` | — | `rgba(249, 248, 244, 0.7)` | Computed |
| `--accent-primary` | `#1E40AF` | `#1E40AF` | `primary` |
| `--accent-hover` | — | `#153290` | Darken 10% |
| `--accent-blue` | — | `#1E40AF` | Same as primary |
| `--accent-rgb` | — | `30, 64, 175` | RGB of primary |
| `--border-subtle` | `#E4DFD0` | `#E4DFD0` | `border` (cream) |
| `--shadow-soft` | — | `0 4px 6px rgba(0, 0, 0, 0.3)` | Dark theme |
| `--shadow-glow` | — | `0 0 10px rgba(30, 64, 175, 0.2)` | Primary glow |
| `--bg-gradient-start` | — | `#2A2A35` | Lighter than bg-app |
| `--bg-gradient-end` | — | `#181820` | bg-app |
| `--card-gradient-end` | — | `#000550` | Deep blue |

---

### Theme 5: Parchment Light

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#FEF3C7` | `#FEF3C7` | `background` |
| `--bg-panel` | `#FEF3C7` | `#FEF9E7` | `backgroundSecondary` |
| `--bg-header` | `#D97706` | `#D97706` | `primary` |
| `--bg-glass` | — | `rgba(254, 249, 231, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#78350F` | `#78350F` | `text` |
| `--text-secondary` | `#92400E` | `#92400E` | `textMuted` |
| `--text-header` | `#78350F` | `#78350F` | `textHeader` (brown on orange) |
| `--text-header-muted` | — | `rgba(120, 53, 15, 0.7)` | Computed |
| `--accent-primary` | `#D97706` | `#D97706` | `primary` |
| `--accent-hover` | — | `#B45309` | Darken 10% |
| `--accent-blue` | — | `#4a90e2` | Fixed |
| `--accent-rgb` | — | `217, 119, 6` | RGB of primary |
| `--border-subtle` | `#FCD34D` | `#FCD34D` | `border` |
| `--shadow-soft` | — | `0 4px 6px rgba(120, 53, 15, 0.1)` | Light theme |
| `--shadow-glow` | — | `0 0 10px rgba(217, 119, 6, 0.2)` | Primary glow |
| `--bg-gradient-start` | — | `#FEF9E7` | panel |
| `--bg-gradient-end` | — | `#FEF3C7` | bg-app |
| `--card-gradient-end` | — | `#FDEFC1` | Slightly darker |

---

### Theme 6: Cotton Candy

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#FFF5F9` | `#FFF5F9` | `background` |
| `--bg-panel` | `#FFFFFF` | `#FFFFFF` | `cardBackground` |
| `--bg-header` | `#FFB6D9` | `#FFB6D9` | `primary` |
| `--bg-glass` | — | `rgba(255, 255, 255, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#8B1A4A` | `#8B1A4A` | `text` |
| `--text-secondary` | `#A0526D` | `#A0526D` | `textMuted` |
| `--text-header` | `#8B1A4A` | `#8B1A4A` | `textHeader` |
| `--text-header-muted` | — | `rgba(139, 26, 74, 0.7)` | Computed |
| `--accent-primary` | `#FFB6D9` | `#FFB6D9` | `primary` |
| `--accent-hover` | — | `#FF9BC9` | Darken 10% |
| `--accent-blue` | — | `#4a90e2` | Fixed |
| `--accent-rgb` | — | `255, 182, 217` | RGB of primary |
| `--border-subtle` | `#FFC0E0` | `#FFC0E0` | `border` |
| `--shadow-soft` | — | `0 4px 6px rgba(139, 26, 74, 0.1)` | Light theme |
| `--shadow-glow` | — | `0 0 10px rgba(255, 182, 217, 0.3)` | Primary glow |
| `--bg-gradient-start` | — | `#FFFFFF` | white |
| `--bg-gradient-end` | — | `#FFF5F9` | bg-app |
| `--card-gradient-end` | — | `#FFF0F6` | Slightly pink |

---

### Theme 7: Sugar Riot (Dark)

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#0A0A0A` | `#0A0A0A` | `background` |
| `--bg-panel` | `#1A0A1A` | `#1A0A1A` | `cardBackground` |
| `--bg-header` | `#FF1493` | `#FF1493` | `primary` |
| `--bg-glass` | — | `rgba(26, 10, 26, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#FFFFFF` | `#FFFFFF` | `text` |
| `--text-secondary` | `#FFB6FF` | `#FFB6FF` | `textMuted` |
| `--text-header` | `#0A0A0A` | `#0A0A0A` | `textHeader` |
| `--text-header-muted` | — | `rgba(10, 10, 10, 0.7)` | Computed |
| `--accent-primary` | `#FF1493` | `#FF1493` | `primary` |
| `--accent-hover` | — | `#FF69B4` | Lighten 10% |
| `--accent-blue` | — | `#FF00FF` | Magenta |
| `--accent-rgb` | — | `255, 20, 147` | RGB of primary |
| `--border-subtle` | `#FF00FF` | `#FF00FF` | `border` |
| `--shadow-soft` | — | `0 4px 6px rgba(0, 0, 0, 0.5)` | Dark theme |
| `--shadow-glow` | — | `0 0 15px rgba(255, 20, 147, 0.4)` | Strong glow |
| `--bg-gradient-start` | — | `#2A1A2A` | Lighter than bg-app |
| `--bg-gradient-end` | — | `#0A0A0A` | bg-app |
| `--card-gradient-end` | — | `#150515` | Deep purple-black |

---

### Theme 8: Grayscale Light

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#FFFFFF` | `#FFFFFF` | `background` |
| `--bg-panel` | `#FFFFFF` | `#FFFFFF` | `cardBackground` |
| `--bg-header` | `#404040` | `#404040` | `primary` |
| `--bg-glass` | — | `rgba(255, 255, 255, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#000000` | `#000000` | `text` |
| `--text-secondary` | `#6B7280` | `#6B7280` | `textMuted` |
| `--text-header` | `#FFFFFF` | `#FFFFFF` | White on dark |
| `--text-header-muted` | — | `rgba(255, 255, 255, 0.7)` | Computed |
| `--accent-primary` | `#404040` | `#404040` | `primary` |
| `--accent-hover` | — | `#333333` | Darken 10% |
| `--accent-blue` | — | `#6B7280` | Gray |
| `--accent-rgb` | — | `64, 64, 64` | RGB of primary |
| `--border-subtle` | `#404040` | `#D1D5DB` | Lighter for contrast |
| `--shadow-soft` | — | `0 4px 6px rgba(0, 0, 0, 0.1)` | Light theme |
| `--shadow-glow` | — | `0 0 10px rgba(64, 64, 64, 0.2)` | Subtle |
| `--bg-gradient-start` | — | `#F3F4F6` | Slight gray |
| `--bg-gradient-end` | — | `#FFFFFF` | bg-app |
| `--card-gradient-end` | — | `#F9FAFB` | Near white |

---

### Theme 9: Grayscale Dark

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#111827` | `#111827` | `background` |
| `--bg-panel` | `#111827` | `#1F2937` | `backgroundSecondary` |
| `--bg-header` | `#6B7280` | `#6B7280` | `primary` |
| `--bg-glass` | — | `rgba(31, 41, 55, 0.9)` | `panel + 0.9 alpha` |
| `--text-primary` | `#F3F4F6` | `#F3F4F6` | `text` |
| `--text-secondary` | `#9CA3AF` | `#9CA3AF` | `textMuted` |
| `--text-header` | `#F3F4F6` | `#F3F4F6` | Light on gray |
| `--text-header-muted` | — | `rgba(243, 244, 246, 0.7)` | Computed |
| `--accent-primary` | `#6B7280` | `#6B7280` | `primary` |
| `--accent-hover` | — | `#9CA3AF` | Lighten 10% |
| `--accent-blue` | — | `#9CA3AF` | Light gray |
| `--accent-rgb` | — | `107, 114, 128` | RGB of primary |
| `--border-subtle` | `#9CA3AF` | `#374151` | Darker for dark bg |
| `--shadow-soft` | — | `0 4px 6px rgba(0, 0, 0, 0.3)` | Dark theme |
| `--shadow-glow` | — | `0 0 10px rgba(107, 114, 128, 0.2)` | Subtle |
| `--bg-gradient-start` | — | `#1F2937` | Lighter |
| `--bg-gradient-end` | — | `#111827` | bg-app |
| `--card-gradient-end` | — | `#0D1117` | Near black |

---

### Theme 10: High Contrast Light (WCAG AAA)

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#FFFFFF` | `#FFFFFF` | `background` |
| `--bg-panel` | `#FFFFFF` | `#FFFFFF` | `cardBackground` |
| `--bg-header` | `#0000CC` | `#0000CC` | `primary` |
| `--bg-glass` | — | `rgba(255, 255, 255, 0.95)` | Higher opacity |
| `--text-primary` | `#000000` | `#000000` | `text` |
| `--text-secondary` | `#333333` | `#333333` | `textMuted` |
| `--text-header` | `#FFFFFF` | `#FFFFFF` | High contrast |
| `--text-header-muted` | — | `rgba(255, 255, 255, 0.9)` | Less muted |
| `--accent-primary` | `#0000CC` | `#0000CC` | `primary` |
| `--accent-hover` | — | `#0000AA` | Darken 10% |
| `--accent-blue` | — | `#0000CC` | Same as primary |
| `--accent-rgb` | — | `0, 0, 204` | RGB of primary |
| `--border-subtle` | `#000000` | `#000000` | Maximum contrast |
| `--shadow-soft` | — | `0 4px 6px rgba(0, 0, 0, 0.2)` | Visible shadow |
| `--shadow-glow` | — | `none` | No glow (clarity) |
| `--bg-gradient-start` | — | `#FFFFFF` | No gradient |
| `--bg-gradient-end` | — | `#FFFFFF` | Solid |
| `--card-gradient-end` | — | `#F0F0F0` | Slight distinction |

**Note**: High contrast themes should disable `backdrop-filter: blur()` for clarity.

---

### Theme 11: High Contrast Dark (WCAG AAA)

| Variable | v3 Value | v4 Value | Computed From |
|----------|----------|----------|---------------|
| `--bg-app` | `#000000` | `#000000` | `background` |
| `--bg-panel` | `#000000` | `#000000` | `cardBackground` |
| `--bg-header` | `#FFFF00` | `#FFFF00` | `primary` (yellow) |
| `--bg-glass` | — | `rgba(0, 0, 0, 0.95)` | Higher opacity |
| `--text-primary` | `#FFFFFF` | `#FFFFFF` | `text` |
| `--text-secondary` | `#CCCCCC` | `#CCCCCC` | `textMuted` |
| `--text-header` | `#000000` | `#000000` | Black on yellow |
| `--text-header-muted` | — | `rgba(0, 0, 0, 0.8)` | Less muted |
| `--accent-primary` | `#FFFF00` | `#FFFF00` | `primary` |
| `--accent-hover` | — | `#FFFF66` | Lighten 10% |
| `--accent-blue` | — | `#00FFFF` | Cyan for visibility |
| `--accent-rgb` | — | `255, 255, 0` | RGB of primary |
| `--border-subtle` | `#FFFF00` | `#FFFF00` | Maximum contrast |
| `--shadow-soft` | — | `0 4px 6px rgba(255, 255, 0, 0.2)` | Yellow shadow |
| `--shadow-glow` | — | `none` | No glow (clarity) |
| `--bg-gradient-start` | — | `#000000` | No gradient |
| `--bg-gradient-end` | — | `#000000` | Solid |
| `--card-gradient-end` | — | `#1A1A1A` | Slight distinction |

**Note**: High contrast themes should disable `backdrop-filter: blur()` for clarity.

---

## 3. CSS Generation Template

Use this template to generate v4 CSS variables for each theme:

```css
body.theme-{THEME_NAME} {
    /* Backgrounds */
    --bg-app: {BG_APP};
    --bg-panel: {BG_PANEL};
    --bg-header: {BG_HEADER};
    --bg-glass: rgba({BG_PANEL_RGB}, {GLASS_ALPHA});

    /* Text */
    --text-primary: {TEXT_PRIMARY};
    --text-secondary: {TEXT_SECONDARY};
    --text-header: {TEXT_HEADER};
    --text-header-muted: rgba({TEXT_HEADER_RGB}, 0.7);

    /* Accents */
    --accent-primary: {ACCENT_PRIMARY};
    --accent-hover: {ACCENT_HOVER};
    --accent-blue: {ACCENT_BLUE};
    --accent-rgb: {ACCENT_RGB};

    /* Borders & Shadows */
    --border-subtle: {BORDER_SUBTLE};
    --shadow-soft: 0 4px 6px rgba(0, 0, 0, {SHADOW_OPACITY});
    --shadow-glow: 0 0 10px rgba({ACCENT_RGB}, 0.2);

    /* Gradients */
    --bg-gradient-start: {GRADIENT_START};
    --bg-gradient-end: {GRADIENT_END};
    --card-gradient-end: {CARD_GRADIENT_END};
}
```

### Variables to compute:
- `{BG_PANEL_RGB}` = RGB values of `--bg-panel`
- `{GLASS_ALPHA}` = 0.9 for most themes, 0.95 for high contrast
- `{TEXT_HEADER_RGB}` = RGB values of `--text-header`
- `{ACCENT_RGB}` = RGB values of `--accent-primary`
- `{SHADOW_OPACITY}` = 0.1 for light, 0.3 for dark themes

---

## 4. ThemePalette Interface Update

### Current v3 Interface

```typescript
interface ThemePalette {
  primary: string;
  background: string;
  text: string;
  textHeader: string;
  border: string;
  backgroundSecondary: string;
  cardBackground: string;
  cardHover: string;
  textMuted: string;
}
```

### Proposed v4 Interface

```typescript
interface ThemePaletteV4 extends ThemePalette {
  // New v4 properties
  bgGlass: string;           // e.g., "rgba(245, 245, 245, 0.9)"
  textHeaderMuted: string;   // e.g., "rgba(255, 255, 255, 0.7)"
  accentHover: string;       // Hover state color
  accentBlue: string;        // Secondary accent
  accentRgb: string;         // "139, 26, 26" for rgba() usage
  shadowSoft: string;        // Full shadow value
  shadowGlow: string;        // Glow effect
  gradientStart: string;     // Gradient start color
  gradientEnd: string;       // Gradient end color
  cardGradientEnd: string;   // Card-specific gradient

  // Feature flags
  disableBlur?: boolean;     // For high contrast themes
}
```

---

## 5. Migration Checklist

### Per-Theme Tasks

For each of the 11 themes:
- [ ] Compute all 18 v4 variable values
- [ ] Add to `styles.css` under `body.theme-{name}`
- [ ] Update `ThemePalette` object in `theme-service.ts`
- [ ] Test glassmorphism rendering
- [ ] Verify text contrast ratios
- [ ] Test glow effects visibility

### Validation Tests

- [ ] All themes render correctly in Chrome, Firefox, Safari
- [ ] High contrast themes pass WCAG AAA validation
- [ ] Glassmorphism blur works (or gracefully degrades)
- [ ] No color variable conflicts between v3 and v4
- [ ] Theme switcher cycles through all 11 correctly
