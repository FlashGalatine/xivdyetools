# Onboarding & Discoverability Improvements

> **Focus**: Help users understand and discover features effectively
> **Target Users**: First-time visitors and returning users who haven't explored all features

---

## Current State

The app currently:
- Launches directly into the last-used tool (or Harmony Generator by default)
- Has no introduction or guidance for new users
- Relies on users exploring the interface to discover features
- Provides keyboard shortcuts (Shift+T for theme) but doesn't advertise them
- Has 6-language support but no language selection guidance

---

## O1: First-Time Welcome Modal

**Priority**: P1 | **Effort**: M

### Problem
New users land on a tool interface without understanding what the app offers or how to navigate between tools.

### Solution
Display a one-time welcome modal for first-time visitors that introduces the app's purpose and available tools.

### Implementation Concept

```
┌─────────────────────────────────────────────────────────────┐
│  ✨ Welcome to XIV Dye Tools                            [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Find the perfect dyes for your FFXIV glamours!            │
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Harmony │ │ Matcher │ │ Compare │ │  Mixer  │          │
│  │  wheel  │ │  image  │ │  dyes   │ │ gradient│          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  Quick tips:                                               │
│  • Click tool names in the header to switch               │
│  • Prices are from Universalis (live market data)         │
│  • Your settings are saved locally                        │
│                                                             │
│           [ Get Started ]    [ Show me around ]            │
│                                                             │
│  ☐ Don't show this again                                   │
└─────────────────────────────────────────────────────────────┘
```

### Technical Notes
- Store `xivdyetools_welcomed` in localStorage
- "Show me around" triggers optional interactive tour (O5)
- Modal should respect reduced motion preferences

---

## O2: Contextual Tooltips for Advanced Features

**Priority**: P1 | **Effort**: M

### Problem
Advanced features like deviance ratings, harmony types, and colorblindness simulations aren't self-explanatory.

### Solution
Add info icons (ⓘ) next to complex features that reveal explanatory tooltips on hover/tap.

### Target Features for Tooltips

| Feature | Location | Tooltip Content |
|---------|----------|-----------------|
| Deviance Rating | Harmony suggestions | "How closely the dye matches the ideal harmony color. 0 = perfect match, 10 = furthest." |
| Harmony Types | Harmony selector | Brief explanation of each (e.g., "Triadic: 3 colors equally spaced on the color wheel") |
| Sample Size | Color Matcher | "Larger samples average more pixels for better accuracy on textured areas." |
| Dual Dye Mode | Accessibility | "Compare two dyes per slot to see how they look together." |
| WCAG Contrast | Accessibility | "Web Content Accessibility Guidelines rating. AAA = excellent, AA = good, Fail = poor contrast." |

### Implementation Pattern
```html
<span class="tooltip-trigger">
  Deviance
  <span class="tooltip-icon" aria-label="More info">ⓘ</span>
  <span class="tooltip-content" role="tooltip">
    How closely the dye matches...
  </span>
</span>
```

### Technical Notes
- Use CSS-only tooltips where possible for performance
- Ensure tooltips are keyboard accessible (focus triggers)
- Position tooltips to avoid viewport overflow

---

## O3: "What's New" Changelog Modal

**Priority**: P2 | **Effort**: S

### Problem
Returning users may not notice new features or improvements after updates.

### Solution
Show a "What's New" modal after version updates highlighting recent changes.

### Implementation Concept

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 What's New in v2.1.0                               [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ★ New SVG harmony icons for better visuals               │
│  ★ Loading indicators for market prices                   │
│  ★ Improved keyboard navigation                           │
│                                                             │
│  Previous updates:                                         │
│  v2.0.7 - Bug fixes and performance improvements          │
│  v2.0.6 - Added new theme options                         │
│                                                             │
│              [ Got it! ]    [ View full changelog ]        │
└─────────────────────────────────────────────────────────────┘
```

### Technical Notes
- Store `xivdyetools_last_seen_version` in localStorage
- Only show if stored version differs from current
- "View full changelog" links to CHANGELOG.md or GitHub releases

---

## O4: Keyboard Shortcuts Reference Panel

**Priority**: P2 | **Effort**: S

### Problem
Keyboard shortcuts exist but are hidden. Power users would benefit from knowing them.

### Solution
Add a keyboard shortcuts panel accessible via "?" key or help menu.

### Known/Proposed Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift + T` | Toggle theme |
| `Shift + L` | Cycle language |
| `1-5` | Switch to tool (1=Harmony, 2=Matcher, etc.) |
| `Escape` | Close modal/dropdown |
| `?` | Show shortcuts panel |
| `Ctrl/Cmd + K` | Focus search/dye selector |

### Implementation Concept

```
┌─────────────────────────────────────────────────────────────┐
│  ⌨️ Keyboard Shortcuts                                 [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Navigation                                                │
│  ─────────────────────────────────────────                 │
│  1-5           Switch between tools                        │
│  Escape        Close modal or dropdown                     │
│                                                             │
│  Quick Actions                                             │
│  ─────────────────────────────────────────                 │
│  Shift + T     Toggle theme                                │
│  Shift + L     Cycle language                              │
│  Ctrl + K      Focus dye search                            │
│  ?             Show this panel                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## O5: Interactive Tutorial Walkthrough

**Priority**: P3 | **Effort**: L

### Problem
Complex tools like Harmony Generator have many features that users might not explore.

### Solution
Provide an optional step-by-step tutorial that highlights key features using a spotlight/coach-mark pattern.

### Tutorial Flow (Harmony Generator Example)

1. **Step 1**: "Select a base dye to start building your harmony"
   - Highlight: Dye selector component

2. **Step 2**: "Choose a harmony type to generate matching colors"
   - Highlight: Harmony type buttons

3. **Step 3**: "Use filters to exclude dyes you don't own"
   - Highlight: Filter panel

4. **Step 4**: "Check market prices for your palette"
   - Highlight: Market board section

5. **Step 5**: "Export your palette in various formats"
   - Highlight: Export button

### Implementation Approach
- Use a lightweight library like Driver.js or build custom
- Store tutorial completion per tool: `xivdyetools_tutorial_harmony`
- Allow replay from settings or help menu

### Technical Notes
- Respect reduced motion by using fade instead of zoom
- Ensure tutorial works on mobile (touch targets for "Next")
- Provide "Skip tutorial" option at all steps

---

## O6: Tool Card Descriptions on Landing

**Priority**: P2 | **Effort**: S

### Problem
Tool names in navigation don't convey what each tool does.

### Solution
On mobile bottom nav and tools dropdown, add brief subtitles or descriptions.

### Current vs Proposed

**Tools Dropdown (Current)**:
```
Harmony Generator
Color Matcher
Dye Comparison
Dye Mixer
Accessibility
```

**Tools Dropdown (Proposed)**:
```
Harmony Generator
  Create matching color palettes

Color Matcher
  Find dyes from images

Dye Comparison
  Compare dye properties side-by-side

Dye Mixer
  Generate gradient transitions

Accessibility Checker
  Test colorblind visibility
```

### Mobile Bottom Nav
For mobile, use abbreviated descriptions in the label when space allows:
- "Harmony" → "Palettes"
- "Matcher" → "From Image"
- "Compare" → "Compare"
- "Mixer" → "Gradients"
- "Access." → "Colorblind"

---

## O7: Persistent "Getting Started" Link

**Priority**: P3 | **Effort**: S

### Problem
Users who dismissed the welcome modal may want to revisit help later.

### Solution
Add a subtle "Help" or "?" link in the header/footer that opens:
- Welcome modal
- Keyboard shortcuts
- Link to documentation
- Link to Discord/GitHub for support

### Placement Options
1. Footer: "Need help? [Documentation] | [Discord]"
2. Header: Small "?" icon next to theme switcher
3. Mobile: In hamburger menu or settings

---

## Implementation Priority Order

1. **O2 - Contextual Tooltips** (immediate value, low risk)
2. **O1 - Welcome Modal** (first impressions matter)
3. **O4 - Keyboard Shortcuts** (quick win for power users)
4. **O3 - What's New Modal** (retain returning users)
5. **O6 - Tool Descriptions** (navigation clarity)
6. **O7 - Persistent Help Link** (support access)
7. **O5 - Interactive Tutorial** (larger effort, defer to later phase)

---

## Files Likely to Modify

| File | Changes |
|------|---------|
| `src/components/app-layout.ts` | Modal rendering, help link |
| `src/services/storage-service.ts` | New storage keys |
| `src/components/tools-dropdown.ts` | Tool descriptions |
| `src/components/mobile-bottom-nav.ts` | Updated labels |
| `src/styles/themes.css` | Tooltip and modal styles |
| New: `src/components/welcome-modal.ts` | Welcome modal component |
| New: `src/components/shortcuts-panel.ts` | Keyboard shortcuts panel |
