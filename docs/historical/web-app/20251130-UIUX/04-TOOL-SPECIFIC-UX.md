# Tool-Specific UX Improvements

> **Focus**: Targeted improvements for each tool based on usage patterns
> **Priority Tools**: Harmony Generator, Color Matcher, Dye Mixer

---

## Harmony Generator (8-10 Suggestions)

The flagship tool for creating color-coordinated palettes.

### T1: SVG Harmony Type Icons (Replace Emojis)

**Priority**: P1 | **Effort**: M

#### Problem
Emoji icons for harmony types (🎨 Complementary, 🔺 Triadic, etc.) render inconsistently across platforms (Windows vs macOS vs mobile) and don't convey the color relationship visually.

#### Solution
Create custom SVG icons that visually represent each harmony type.

#### Icon Concepts

| Harmony Type | Current | Proposed SVG Concept |
|--------------|---------|---------------------|
| Complementary | 🎨 | Two circles on opposite sides of wheel |
| Analogous | 🌈 | Three adjacent wedges |
| Triadic | 🔺 | Triangle inscribed in circle |
| Split-Complementary | ✂️ | Y-shape from center |
| Tetradic | ⬛ | Rectangle inscribed in circle |
| Square | ⏹️ | Square inscribed in circle |
| Compound | 🔶 | Diamond with opposing wedges |
| Monochromatic | ⚪ | Single circle with gradient |
| Custom | ✏️ | Pencil or color dropper |

#### SVG Template Structure
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <!-- Outer circle (color wheel representation) -->
  <circle cx="12" cy="12" r="10" stroke-width="2" />

  <!-- Harmony-specific geometry -->
  <!-- Example: Triadic triangle -->
  <polygon points="12,2 22,19 2,19" stroke-width="2" />
</svg>
```

#### Implementation Notes
- Use `currentColor` for theme compatibility
- Size: 24x24 base, scale with CSS
- Store in `src/assets/icons/harmony/`
- Create a `HarmonyIcon` component for reuse
- Add smooth color transitions on selection state

---

### T2: Companion Dye Quick-Add

**Priority**: P2 | **Effort**: S

#### Problem
Users must scroll through the full dye list to find companion dyes. If they see a suggested dye they like, there's no quick way to "lock it in."

#### Solution
Add a "Use this" button on each suggested dye that adds it to the comparison or exports it directly.

#### Interaction Flow
```
┌─────────────────────────────────────────────────────┐
│  Suggested Companions (Triadic)                     │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │  [■] Rose Pink                    Deviance: 2 │  │
│  │      Closest match to 120° position           │  │
│  │      [ Use This ] [ View on Wheel ]          │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  [■] Celeste Green                Deviance: 4 │  │
│  │      Closest match to 240° position           │  │
│  │      [ Use This ] [ View on Wheel ]          │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

### T3: Harmony Preset Favorites

**Priority**: P3 | **Effort**: M

#### Problem
Users who find a great harmony can't save it for later without manually noting down the dyes.

#### Solution
Allow users to save harmonies to a "Favorites" list stored in localStorage.

#### Features
- "Save Palette" button on generated harmonies
- Name the palette (default: "Harmony - {date}")
- View saved palettes in a sidebar/modal
- Export all favorites as JSON
- Delete individual favorites

---

### T4: Expanded Harmony Card View

**Priority**: P2 | **Effort**: S

#### Problem
Harmony suggestion cards show limited information. Users want to see more context without clicking.

#### Solution
Add an expandable card view with additional details.

#### Collapsed vs Expanded

**Collapsed** (current-ish):
```
┌─────────────────────────────────┐
│ [■] Rose Pink        Dev: 2    │
└─────────────────────────────────┘
```

**Expanded** (on click or hover):
```
┌─────────────────────────────────────────────────┐
│ [■] Rose Pink                       Deviance: 2 │
├─────────────────────────────────────────────────┤
│ Hex: #E6ACB8  RGB: 230, 172, 184               │
│ Category: Pink • Tradeable                      │
│ Market: ~340 gil (Cactuar)                     │
│                                                 │
│ [ Add to Compare ] [ Copy Hex ] [ View Prices ]│
└─────────────────────────────────────────────────┘
```

---

### T5: Color Wheel Zoom/Pan (Mobile)

**Priority**: P2 | **Effort**: M

#### Problem
On mobile, the color wheel is small and hard to see precisely where dyes are positioned.

#### Solution
Make the color wheel interactive with pinch-to-zoom and pan.

#### Features
- Pinch gesture to zoom (1x to 4x)
- Pan when zoomed
- Double-tap to reset
- Touch marker to highlight position

---

### T6: Live Deviance Threshold Filter

**Priority**: P2 | **Effort**: S

#### Problem
Users may want to see only very close matches (low deviance) or don't understand the deviance scale.

#### Solution
Add a deviance slider that filters suggestions in real-time.

```
Deviance Tolerance: [====●=====] 5
                    0         10

Showing dyes with deviance ≤ 5
```

---

### T7: Harmony Type Comparison

**Priority**: P3 | **Effort**: M

#### Problem
Users don't know which harmony type to use and must try each one manually.

#### Solution
Show a comparison view of all harmony types at once for the selected base dye.

---

### T8: Color Wheel Position Indicator

**Priority**: P2 | **Effort**: S

#### Problem
When hovering over a suggested dye, it's not immediately clear where it falls on the color wheel.

#### Solution
Highlight the corresponding position on the color wheel when hovering a dye card.

---

---

## Color Matcher (6-8 Suggestions)

Tool for finding dyes that match colors from uploaded images.

### T9: Live Dye Preview Overlay

**Priority**: P1 | **Effort**: M

#### Problem
Users pick a color from an image but can't visualize how the suggested dye would look in context.

#### Solution
Show a preview overlay of the selected dye color on the picked point.

#### Interaction
1. User picks a color from image
2. Suggestions appear
3. Hovering a suggestion shows a circular overlay on the image at the sample point
4. Overlay shows: Original color vs Suggested dye color (side by side)

```
    Image with sample point
         ◯ ← Sample point
        /
┌──────┴──────────────────────┐
│  Picked    │  Rose Pink     │
│  #E5A8B4   │  #E6ACB8       │
│  (sample)  │  (dye match)   │
└─────────────────────────────┘
```

---

### T10: Recent Colors History

**Priority**: P2 | **Effort**: M

#### Problem
Users can't recall previous color picks after selecting a new point.

#### Solution
Show a history of recently picked colors (last 5-10).

```
Recent Picks:
[■] [■] [■] [■] [■]
 ↑   Current
```

- Click a history swatch to re-match against it
- Hover to see hex value
- Clear history button

---

### T11: Multi-Point Color Averaging

**Priority**: P2 | **Effort**: M

#### Problem
Single-pixel picks can be unrepresentative of textured areas.

#### Solution
Allow users to select multiple points that average together.

#### Interaction
1. Enter "multi-pick mode"
2. Click 3-5 points on the image
3. Points are averaged into a single color
4. Show the averaged result with individual contributions

---

### T12: Batch Match Mode

**Priority**: P3 | **Effort**: L

#### Problem
Users want to match multiple distinct colors from one image (e.g., outfit with 3 different colored parts).

#### Solution
Allow picking multiple colors that generate independent match sets.

---

### T13: Copy Color on Click

**Priority**: P1 | **Effort**: S

#### Problem
Users can't easily copy the picked or matched color values.

#### Solution
Add a "Copy" button next to hex values, or click-to-copy behavior.

```
Picked Color: #E5A8B4 [📋]
                       ↑ Click to copy
```

---

### T14: Image Zoom Improvements

**Priority**: P2 | **Effort**: S

#### Problem
Zoom controls are functional but could be more intuitive.

#### Solution
- Show current zoom level prominently: "150%"
- Add zoom presets: [Fit] [100%] [200%]
- Mouse wheel zoom without shift (or make configurable)
- Touch: pinch to zoom

---

---

## Dye Mixer (5-6 Suggestions)

Tool for generating gradient transitions between dyes.

### T15: Gradient Preview with Adjustable Stops

**Priority**: P2 | **Effort**: M

#### Problem
The linear gradient between dyes is fixed. Users can't adjust the distribution.

#### Solution
Add draggable stops to customize the gradient curve.

```
Start: Snow White                    End: Soot Black
        [■]━━━━━━━●━━━━━━━━●━━━━━━━━[■]
                  ↑         ↑
            Drag stops to adjust
```

---

### T16: Interpolation Method Toggle

**Priority**: P2 | **Effort**: S

#### Problem
Current HSV interpolation may not match user expectations in all cases.

#### Solution
Offer interpolation method options:
- **HSV** (current) - Perceptually smooth hue transitions
- **RGB** - Linear component mixing
- **LAB** - Perceptually uniform

Show a preview of how the gradient differs:
```
Method: ( ) HSV  (●) RGB  ( ) LAB
        [Preview gradient here]
```

---

### T17: Step Count Visualizer

**Priority**: P1 | **Effort**: S

#### Problem
Users set step count without seeing the exact intermediate colors.

#### Solution
Show discrete swatches for each step, not just the gradient.

```
Steps: [====●=====] 7

[■] → [■] → [■] → [■] → [■] → [■] → [■]
 1     2     3     4     5     6     7
```

Each swatch shows the closest dye match for that step.

---

### T18: Gradient Export Formats

**Priority**: P2 | **Effort**: S

#### Problem
Gradient exports are limited.

#### Solution
Add more export formats:
- **CSS Gradient**: `linear-gradient(to right, #FFF, #000)`
- **SVG Gradient**: For use in design tools
- **Palette File**: .ase (Adobe), .gpl (GIMP)
- **Image**: PNG strip of the gradient

---

### T19: Bi-directional Gradient

**Priority**: P3 | **Effort**: S

#### Problem
Users may want A→B→A (start and end with same color).

#### Solution
Add a "Mirror" toggle that creates a symmetrical gradient.

```
[ ] Mirror gradient
    [■] → [■] → [■] → [■] → [■] → [■] → [■]

[✓] Mirror gradient
    [■] → [■] → [■] → [■] → [■] → [■] → [■]
    A  →  B  →  C  →  D  →  C  →  B  →  A
```

---

---

## Dye Comparison (2-3 Suggestions)

### T20: Side-by-Side Swatch View

**Priority**: P2 | **Effort**: S

#### Problem
Comparing dyes requires reading charts; there's no simple visual comparison.

#### Solution
Add a large side-by-side swatch view at the top.

```
┌──────────┬──────────┬──────────┬──────────┐
│          │          │          │          │
│  Snow    │  Bone    │  Ash     │  Pearl   │
│  White   │  White   │  Grey    │  White   │
│          │          │          │          │
└──────────┴──────────┴──────────┴──────────┘
```

---

### T21: Difference Highlighting

**Priority**: P2 | **Effort**: M

#### Problem
It's hard to see which dyes are most different/similar in the matrix.

#### Solution
Add visual highlighting for the distance matrix:
- Green = very similar (low distance)
- Yellow = moderate difference
- Red = very different (high distance)

---

---

## Accessibility Checker (2-3 Suggestions)

### T22: Simplified Mode

**Priority**: P2 | **Effort**: M

#### Problem
12 dye selectors plus colorblind simulations is overwhelming for new users.

#### Solution
Offer a "Simple Mode" that guides users step-by-step:
1. Pick your outfit slot
2. Select the dye you're considering
3. View how it looks in all colorblind modes
4. See pass/fail indicator

---

### T23: Common Outfit Presets

**Priority**: P3 | **Effort**: M

#### Problem
Users must manually select each slot.

#### Solution
Add outfit presets:
- "Healer (White Mage style)" - white/green palette
- "Tank (Dark Knight style)" - dark/red palette
- "DPS (Ninja style)" - dark/purple palette

These pre-fill common dye combinations as a starting point.

---

---

## Implementation Priority Summary

| ID | Tool | Suggestion | Priority | Effort |
|----|------|------------|----------|--------|
| T1 | Harmony | SVG harmony type icons | P1 | M |
| T9 | Matcher | Live dye preview overlay | P1 | M |
| T17 | Mixer | Step count visualizer | P1 | S |
| T13 | Matcher | Copy color on click | P1 | S |
| T2 | Harmony | Companion dye quick-add | P2 | S |
| T4 | Harmony | Expanded harmony card view | P2 | S |
| T6 | Harmony | Live deviance threshold filter | P2 | S |
| T8 | Harmony | Color wheel position indicator | P2 | S |
| T10 | Matcher | Recent colors history | P2 | M |
| T11 | Matcher | Multi-point color averaging | P2 | M |
| T14 | Matcher | Image zoom improvements | P2 | S |
| T15 | Mixer | Gradient adjustable stops | P2 | M |
| T16 | Mixer | Interpolation method toggle | P2 | S |
| T18 | Mixer | Gradient export formats | P2 | S |
| T20 | Compare | Side-by-side swatch view | P2 | S |
| T21 | Compare | Difference highlighting | P2 | M |
| T22 | Access | Simplified mode | P2 | M |
| T5 | Harmony | Color wheel zoom/pan (mobile) | P2 | M |
| T3 | Harmony | Harmony preset favorites | P3 | M |
| T7 | Harmony | Harmony type comparison | P3 | M |
| T12 | Matcher | Batch match mode | P3 | L |
| T19 | Mixer | Bi-directional gradient | P3 | S |
| T23 | Access | Common outfit presets | P3 | M |

---

## Files Likely to Modify

| File | Changes |
|------|---------|
| `src/components/harmony-generator-tool.ts` | T1-T8 |
| `src/components/harmony-type.ts` | T1 icons |
| `src/components/color-matcher-tool.ts` | T9-T14 |
| `src/components/dye-mixer-tool.ts` | T15-T19 |
| `src/components/dye-comparison-tool.ts` | T20-T21 |
| `src/components/accessibility-checker-tool.ts` | T22-T23 |
| New: `src/assets/icons/harmony/*.svg` | SVG icons |
| New: `src/components/color-history.ts` | Recent colors |
