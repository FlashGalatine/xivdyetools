# Gradient Builder

**Create smooth color gradients between two dyes**

The Gradient Builder draws a ramp from one dye to another and finds the real FFXIV dye closest to every step along it. In 5.0 the ramp is a **pin rail**: each step is a row you can read, and any middle step can be **pinned** to a dye so the gradient bends through it.

> **Note**: This tool was previously called "Dye Mixer" in v3.x. The Discord bot still uses the `/mixer` command for this functionality. The blending tool is now the [Dye Mixer](dye-mixer.md).

---

## How to Use

### 1. Select Two Dyes

The **FROM** and **TO** cards sit at the top of the flow with a swap button between them. Open the **Color Palette** drawer (the paint-palette button; on phones it starts closed) and click a dye — the first fills **FROM**, the second fills **TO**. Picking a third shifts things along: the new dye becomes FROM and the old FROM moves to TO; picking the current TO dye swaps the two ends. Click a card first to aim at it: the next dye you pick lands in that endpoint instead. The dice picks a random dye, the broom clears both.

The drawer's **Custom Color** field lets you use a hex colour as either endpoint. Result cards elsewhere can also send a dye here — **Transform Dye in… → Gradient Builder**, choosing which end it goes into. Picking the same dye for both ends is refused: *"Start and end dyes are the same. Select different dyes for a gradient."*

**Swap** (the arrows between the cards) reverses the direction. That matters: interpolation runs FROM → TO, and the reverse route through the dye database can pick different intermediate dyes.

### 2. Read the Rail

As soon as both ends are set, the **Pinned steps** rail appears:

- **Two bands** across the top — **IDEAL** over **ACHIEVABLE**. The upper band is the smooth ramp you asked for; the lower one is the same ramp built out of the closest real dyes. Where the two diverge is where the palette runs out.
- **One row per step**, showing the ideal colour on the left, then the matched dye's name and its distance from the ideal, painted in that dye. Click a row to focus it — the header switches to **STEP n** and that step's card is ringed below.
- **A pin column** down the left. The first and last rows carry a dashed anchor (*Endpoint — already an anchor*); every middle row has a pin button — **Pin this step** / **Unpin**.

### 3. Pin a Step

Pinning makes that step's matched dye a fixed waypoint. The ramp then re-interpolates in segments — FROM to the pin, pin to TO — so the steps either side bend toward the dye you chose, and the pinned step itself reads a distance of 0.0. Pin as many middle steps as you like; each new anchor splits its segment again.

Pins clear on their own when you change either endpoint or the step count, since that redraws a different ramp. **Clear pins** in the results header removes them by hand.

### 4. The Summary Row

The header above the cards carries the numbers that matter for the whole ramp:

- **avg ΔE** — the average distance between ideal and matched across the steps
- **max ΔE** — the worst single step. *The worst step in the ramp — an average hides a single lurch.*
- **Pinned steps · n** and **Clear pins**, when anything is pinned
- **Export** and **Share**

The unit follows your **Matching Algorithm** choice; ΔE2000 by default.

### 5. Result Cards

Under the header, one card per step in a grid — the endpoints included, each resolving to itself at 0.0. Each card shows the matched dye beside the ideal colour, its distance, hue and stain readouts, the dye's colour values, source and cost. **Select Dye** on a card opens a small menu — **Replace Slot 1** (FROM) or **Replace Slot 2** (TO) — to make that dye a new endpoint. The **⋮** menu offers **Inspect Dye in…** (Harmony, Budget, Accessibility, Comparison, Swatch), **Transform Dye in…** (Gradient, Mixer) and **Open in browser…**.

### 6. Settings

In the settings column (the gear icon on phones):

- **Gradient Steps → Count** — 3 to 12 steps, endpoints included
- **Prevent Duplicates** — on by default; where the ramp is flat enough that neighbouring steps would resolve to the same dye, the later step walks on to the next-closest unused dye
- **Color Space** — how the ramp is drawn between the two ends (see below)
- **Matching Algorithm** — ΔE2000 by default; ΔEOK, ΔE76, Weighted RGB, RGB or a 0–100 percentage
- **Display Options** — which colour values and readouts the cards show
- **Dye Filters** — exclude metallic, pastel, dark, cosmic, coffer, vendor or crafted dyes
- **Market Board** — show current prices on the cards

---

## Color Spaces

The same two dyes give a different ramp depending on the space the ramp is drawn in:

| Option | What it does |
|--------|--------------|
| **HSV** — Hue-based (vibrant) | Follows the colour wheel. Vibrant transitions, may shift hue. The default |
| **OKLCH** — Modern perceptual (best) | Even lightness all the way along; the best overall gradient quality |
| **LAB** — Perceptual (natural) | Natural-looking, but can go muddy in the middle |
| **LCH** — Cylindrical LAB | Keeps chroma up with perceptual lightness |
| **RGB** — Linear (gray midpoints) | Straight-line mixing; the middle of a red → blue ramp is grey |

---

## Save, Share and Export

- **Share** copies a link that reopens the same two dyes at the same step count, colour space and matching algorithm. Sharing needs two real dyes in the endpoints.
- **Export** opens the export sheet: every step as an ideal colour paired with the dye it resolved to (name, stain ID and distance), as CSS custom properties, SCSS, JSON, plain HEX or a Tailwind theme, to copy or download.

---

## Use Cases

### Ombre Effects
Create gradual color shifts across multi-piece outfits:
1. Dye hat with starting color
2. Dye chest with middle gradient color
3. Dye pants with ending color

### Finding "In-Between" Colors
When two dyes are too different:
1. Set them as endpoints
2. Find intermediate dyes that bridge the gap
3. Use for transitional pieces

### Bending the Ramp Through a Dye You Own
When one step lands on a dye you already have and the rest wander off:
1. Pin that step — its dye is now fixed
2. Watch the neighbouring steps re-settle around it
3. Check **max ΔE** — if it jumped, the dye is fighting the ramp; unpin and try a different step count or colour space

### Color Exploration
Discover dyes you might not have considered:
1. Pick two favorite dyes
2. See what's "between" them
3. Find new favorites in the gradient

---

## Tips

- **Bold gradients** work best with high-contrast endpoints
- **Subtle gradients** use similar colors for gentle transitions
- **Read the bands, not just the numbers** — a step where ACHIEVABLE lurches away from IDEAL is the one to pin or re-think
- **Try the reverse direction** with **Swap** for different intermediate dyes
- **Fewer steps** means bigger jumps but fewer repeats; more steps and Prevent Duplicates will start reaching for further-off dyes

---

## Related Tools

- [Dye Mixer](dye-mixer.md) - Blend two dyes into one colour instead of a ramp
- [Palette Extractor](palette-extractor.md) - Find specific dyes first
- [Dye Comparison](dye-comparison.md) - Compare gradient dyes
- [Budget Suggestions](budget-suggestions.md) - Find affordable options
