# Accessibility Checker

**Simulate how colors appear with different types of color vision**

The Accessibility Checker shows how a set of dyes looks to players with the four common forms of colour blindness, and — the question that actually matters — whether the dyes can still be told apart. In 5.0 it works as a **lens**: pick a vision type and the whole workspace is repainted through it.

> **Note**: In the 5.0 tool rail this is the **Vision** chip; the tool menu lists it as **Accessibility Checker**.

---

## How to Use

### 1. Load up to four colours

Open the **Color Palette** drawer (the palette button; on phones it starts closed) and click dyes. Up to **four** slots fill; a fifth pick pushes the oldest one out. The **Custom Color** section in the drawer lets you add an arbitrary hex — useful for checking a dye against an armour base colour or a UI tint. Other tools' **Inspect Dye in… → Accessibility** and the **SEND TO** rows land dyes here too.

Until you add something, four dashed **Add Dye** slots wait with *"Select dyes to see accessibility analysis"*.

### 2. Pick a lens

The **LENS** row is a set of tabs, one per vision type, each with a prevalence figure and a small dot:

| Lens | Prevalence shown | What it is |
|------|------------------|------------|
| **Normal** | ~92% | *"Standard colour perception — the palette as you painted it."* |
| **Deuteranopia** | ~6% males | *"Red-green. The most common form, and about one man in twelve."* |
| **Protanopia** | ~2% males | *"Red-green, with reds darkened as well as shifted."* |
| **Tritanopia** | ~0.01% | *"Blue-yellow. Rare, and it hits teals and yellows hardest."* |
| **Achromatopsia** | ~0.003% | *"No colour at all — only lightness separates two dyes."* |

**The dot is the worst pair under that lens** — its colour is the tier (see below) of the two dyes that come closest together when seen that way, so you can spot the problem lens without clicking through them all. Selecting a tab repaints everything below it, and the lens you leave selected is remembered.

The **Vision Types** toggles in the settings column (the gear icon on phones) hide lenses you don't care about; the tabs only show the ones switched on.

### 3. Read the repainted grid

Under the tabs, one cell per loaded dye, painted in the colour that lens actually sees. Each cell carries a small chip of the original colour in one corner and a **ΔE** badge — how far the lens has shifted this dye from how you designed it, tinted on a 5 / 10 / 20 / 35 ramp. Under **Normal** every shift is zero.

### 4. Can you tell them apart?

The pair readout lists every pair of loaded dyes (one pair for two dyes, six for four), each with the two simulated swatches, a note showing the change from normal vision (e.g. **34% NRM → 11% DEU**), and the pair's value in the current unit. The value is coloured by tier:

**Clear · Fine · Tight · Collapsed**

Press the **ⓘ** beside the heading to open the metric help. It shows the current unit's definition, its caveat, a **NOT A STANDARD** badge where that applies, the four-tier legend with the number ranges for that unit, chips to switch unit, and — for the contrast ratio — a link labelled **Read WCAG 1.4.11 Non-text Contrast**.

The three units:

| Unit | Short label | What it measures |
|------|-------------|------------------|
| **Distinguishability** | Distinguishability % | *"The app's own measure: straight-line RGB distance between the two simulated colours, over the 441.67 diagonal of the colour cube."* Not a WCAG rating and not perceptual — reads high for dark colours. Good for ranking. |
| **Contrast ratio** | Contrast ratio · WCAG 1.4.11 | WCAG relative-luminance contrast. Success Criterion 1.4.11 asks for at least 3:1 between adjacent meaningful colours. *"The only readout here backed by a published standard — but it only sees lightness."* |
| **Perceptual distance** | ΔE2000 | The same colour-difference formula the other tools use for match quality. Perceptually honest, but *"no standard defines a pass mark — the cuts here are the app's calibrated separation bands."* |

The tier cut-offs are fixed per unit — for the ratio they are the WCAG 7 / 4.5 / 3 lines; for the other two they are the app's calibrated bands, shared with the Comparison tool. Values are rounded to the displayed precision before they are scored, so a number never prints in one tier and colours as another.

### 5. As designed → as perceived

At the bottom, one result card per dye. Under **Normal** the two swatches on the card are the same. Under any other lens the left swatch is the dye as designed, the right is the dye as that lens perceives it, and the card's ΔE is the shift between them. **Remove** takes a dye out; the **⋮** menu sends it to other tools (Harmony, Budget, Comparison, Swatch, Gradient, Mixer, or the market sites).

**Display options** in the settings column choose which colour values the cards print (hex, RGB, HSV, LAB, CMYK, hue, stain, spectrum). Prices and sources are kept off these cards on purpose.

---

## Sharing

The **Share as:** dropdown in the cards' header picks which lens the link opens on (Deuteranopia, Protanopia, Tritanopia or Achromatopsia); **Share** copies a link carrying the loaded dyes. Custom hex colours have no dye behind them and are left out of the link.

---

## Understanding Color Blindness

### Red-Green Color Blindness (Most Common)
- Deuteranopia and protanopia: red and green move together
- Roughly 8% of men and 0.5% of women
- Many reds, oranges, greens and browns become hard to distinguish

### Blue-Yellow Color Blindness (Tritanopia)
- Blue and yellow move together
- Much rarer than red-green
- Hits teals, purples and yellows hardest

### Complete Color Blindness (Achromatopsia)
- Sees only lightness
- Extremely rare
- Two dyes of the same brightness collapse into one

---

## Why This Matters

When designing glamours or housing:
- **Party coordination** - Make sure teammates can distinguish roles by colour
- **FC events** - Colour-coded teams should stay distinct
- **Accessibility** - Be inclusive of players with colour blindness
- **Contrast** - Lightness differences survive every lens

---

## Tips for Accessible Color Choices

1. **Don't rely on colour alone** - Use pattern and texture differences too
2. **Check the dots first** - A red or amber dot on a lens tab tells you where the problem is
3. **Watch the arrow** - a pair that goes **Clear → Collapsed** from NRM to DEU is your red-green trap
4. **Blue + orange** - Often survives better than red + green
5. **Switch to ΔE2000** - if you want the number to mean the same thing it means in the Extractor and Comparison
6. **Achromatopsia is the lightness test** - if two dyes hold up there, they hold up everywhere

---

## Related Tools

- [Palette Extractor](palette-extractor.md) - Find alternative dyes
- [Color Harmony Explorer](color-harmony.md) - Build the palette you are checking
- [Dye Comparison](dye-comparison.md) - Same units, one pair at a time
- [Community Presets](community-presets.md) - **TAKE THIS PALETTE INTO → Accessibility Checker** checks a whole preset
