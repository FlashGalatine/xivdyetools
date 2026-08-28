# Dye Mixer

**Blend two dyes together to create custom colors**

The Dye Mixer takes two dyes, blends them the way paint, pigment, light or a perceptual colour space would, and finds the closest FFXIV dyes to the result. In 5.0 it shows every blend at once: a **mixing field** of six models × five ratios, thirty real colours you can compare in one glance and tap to make the mix.

> **Note**: This is a completely different tool from the Gradient Builder (previously called "Dye Mixer" in v3.x). The Gradient Builder creates color *transitions*, while this tool creates color *blends*.

---

## How It Works

1. **Dye A and Dye B** - Two input slots
2. **The mixing field** - Every model at every ratio, each cell a real blend
3. **The mix** - The cell you tapped becomes the result
4. **Matching** - The closest FFXIV dyes to that result

---

## How to Use

### 1. Pick Two Dyes

Open the **Color Palette** drawer (the paint-palette button; on phones it starts closed) and click two dyes. The first fills slot **1**, the second slot **2**. Picking a third shifts the pair along — the newest dye takes slot 2, the old slot 2 moves to slot 1. The drawer's **Custom Color** section lets you enter a hex code instead of a dye for either slot; the dice picks a random dye and the broom clears both slots.

Result cards elsewhere in the app can also send a dye here — **Transform Dye in… → Dye Mixer** on any card, choosing which slot it goes into.

### 2. Read the Field

As soon as both slots are filled, the equation row shows **1 + 2 → Blend**, and below it the **Model × ratio** field appears: six rows (RYB, Spectral, OKLAB, LAB, HSL, RGB) by five columns (**10/90, 30/70, 50/50, 70/30, 90/10** — Dye A's share first). Every cell is painted with that actual blend and carries a small number: the distance to the closest FFXIV dye. Hover a cell to see its model, ratio and hex.

The **Model spread** readout in the field header says how far apart the six models land at the current ratio. A high spread means the choice of model matters a lot for this pair; a low one means it barely matters.

### 3. Tap a Cell

Tapping a cell makes it the mix: the result swatch takes its colour, the **Matching Dyes** list below re-ranks around it, and the cell keeps a highlighted ring. The default is **RYB at 50/50**. Change dyes and the same model and ratio carry over.

### 4. Matching Dyes

The closest dyes to your mix, one card each: the dye beside the blend colour, its distance in the current unit, hue and stain readouts, colour values, source and cost. The **⋮** menu on a card offers **Inspect Dye in…** (Harmony, Budget, Accessibility, Comparison, Swatch), **Transform Dye in…** (Gradient, Mixer) and **Open in browser…**.

### 5. Settings

In the settings column (the gear icon on phones):
- **Mixing Mode** - The same six models as the field rows; the field and the dropdown stay in sync
- **Max Results** - 3–8 matched dyes
- **Matching Algorithm** - ΔE2000 by default; ΔEOK, ΔE76, Weighted RGB, RGB or a percentage
- **Display options** - Which colour values and readouts the cards show
- **Dye Filters** - Exclude metallic, pastel, dark, cosmic, coffer, vendor or crafted dyes; the field cells and the results list use the same filtered pool, so a cell never quotes a distance to a dye the list can't show
- **Market Board** - Show current prices on the cards

---

## Blending Models Explained

The row headers use each model's technical name; the settings dropdown and the cell hints use plain ones.

| Row | Name | What it does | Blue + Yellow = |
|-----|------|--------------|-----------------|
| **RYB** | Paint | The traditional red-yellow-blue colour wheel — mixing like paint in art class | Olive |
| **Spectral** | Pigment | Kubelka-Munk physics — how real pigment behaves | Green |
| **OKLAB** | Perceptual | A modern, even perceptual space; no muddiness | Cyan |
| **LAB** | LAB | The older perceptual space, with a warmer bias | Pink |
| **HSL** | Hue | Sweeps around the hue wheel while keeping saturation | — |
| **RGB** | Light | Additive light mixing, the way screens blend | Grey |

**Best for**
- **RYB / Spectral** - "What would happen if I mixed these two paints?"
- **OKLAB / LAB** - Balanced middle grounds that look natural to the eye
- **HSL** - Keeping colours vivid while moving between two hues
- **RGB** - Matching how the two colours average on a screen

**Tip**: Unlike gradient interpolation, blending creates a single colour rather than a transition path. The field exists because the same two dyes can land somewhere different in every row — look at the spread before you trust any one answer.

---

## Save, Share and Export

- **Save mix** (under the field) stores Dye A, Dye B and the dye the mix currently resolves to as a palette on this device, named "A × B". Find it under **Community Presets → Saved**. Custom hex colours have no dye behind them and are skipped; a mix of two customs saves nothing.
- **Share** copies a link that reopens the same two dyes at the same model and ratio — 75/25 is a different colour from 50/50, so the ratio rides in the link. Sharing needs two real dyes in the slots.
- **Export** opens the export sheet: the two inputs and the blend (with its resolved dye and distance) as CSS custom properties, SCSS, JSON, plain HEX or a Tailwind theme, to copy or download.

---

## Use Cases

### Creating Custom Colors
Find dyes that don't exist as single colors:
1. Blend two close-but-not-quite dyes
2. Scan the field for the cell nearest what you imagined
3. Take the closest FFXIV match

### Color Experimentation
Discover unexpected combinations:
1. Try blending complementary colors and compare the rows
2. Mix warm and cool tones at 30/70 and 70/30
3. Combine metallic and non-metallic dyes

### Outfit Planning
Find "middle ground" dyes for coordinated looks:
1. Blend your two favorite outfit colors
2. Use the result as an accent color
3. **Save mix** so the recipe stays with the outfit

---

## Tips

- **Similar colors** create subtle variations in every row
- **Contrasting colors** go muddy in RGB and RYB but often look better in OKLAB or Spectral
- **The number in each cell** is the distance to the nearest dye — a low number means the blend really exists as a dye
- **Watch the spread** - when it is high, try more than one row before choosing
- **Off-centre ratios** (10/90, 90/10) are how you nudge a dye slightly toward another rather than meeting in the middle

---

## Dye Mixer vs Gradient Builder

| Feature | Dye Mixer | Gradient Builder |
|---------|-----------|------------------|
| Output | Single blended color | Multiple gradient steps |
| Method | Six blend models × five ratios | Colour-space interpolation between two dyes |
| Use case | "Mix these colors" | "Transition between colors" |
| Results | 3-8 matched dyes | One matched dye per step |

---

## Related Tools

- [Gradient Builder](gradient-builder.md) - Create color transitions
- [Palette Extractor](palette-extractor.md) - Find dyes from any color
- [Dye Comparison](dye-comparison.md) - Compare your blend results
- [Favorites & Collections](favorites-collections.md) - Where saved mixes go
