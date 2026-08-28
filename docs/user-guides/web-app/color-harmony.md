# Color Harmony Explorer

**Discover harmonious dye combinations for your glamours**

The Color Harmony Explorer uses color theory to suggest dyes that work beautifully together. In 5.0 it is built around a **dial**: a colour wheel whose hub is your base dye and whose pucks are the dyes for each slot — everything on it can be tapped.

> **Note**: In the 5.0 tool rail this is the **Harmony** chip; the tool menu lists it as **Color Harmony Explorer**. It is also the tool the app opens on.

---

## How to Use

### 1. Select a Base Color

Open the **Color Palette** drawer (on phones, the round palette button) and click a dye — or tap the **?** hub in the middle of the empty wheel, which opens the same drawer. The wheel and the results appear at once. To start from a colour that isn't a dye, use the drawer's **Custom Color** field and press **Apply**.

Other tools can send a dye here too: **Inspect Dye in… → Harmony Explorer** on any result card.

### 2. Choose Harmony Type

A row of icon chips sits centred above the wheel — one per harmony type, the active one outlined. Click a chip and the wheel and cards redraw. On phones the row scrolls sideways (a one-time *SWIPE FOR MORE* tag reminds you there are more past the edge). The same choice is mirrored by the **Harmony Type** dropdown in the settings column, so either control works.

| Harmony | Description | Best For |
|---------|-------------|----------|
| **Complementary** | Opposite on color wheel | Bold, high-contrast looks |
| **Analogous** | Adjacent colors | Subtle, cohesive themes |
| **Triadic** | Three evenly-spaced colors | Balanced, vibrant outfits |
| **Split-Complementary** | Base + two near-opposites | Softer contrast |
| **Tetradic** | Four colors (rectangle) | Complex, multi-piece sets |
| **Inverted Tetradic** | Four colors (mirrored rectangle) | Tetradic balance, opposite lean |
| **Square** | Four colors 90° apart | Dynamic variety |
| **Monochromatic** | Variations of one hue | Subtle, cohesive looks |
| **Compound** | Complementary + analogous mixed | Rich but grounded |
| **Shades** | Shades and tints of the base | Tonal outfits |

### 3. Read the Wheel

- The **hub** in the centre carries the base dye's colour and name (labelled **Base Color**). Tap it to open the picker and change the base.
- Each **puck** on the rim is one harmony slot, numbered, painted with the dye that slot resolved to; hover for *"Harmony 2 · Dye Name"*. **Tap a puck and the base jumps to that dye** — the quickest way to walk around a palette.
- The label under the wheel names the current harmony type.
- The wheel mirrors the cards: if you swap a slot's dye (below), the puck moves with it. Monochromatic, Compound and Shades stagger their coincident pucks inward so two dyes on one spoke still read as two.

### 4. Explore Results

Under **Results**, one card per slot in a grid — the base first, then each harmony position. Each card shows the dye beside the ideal target colour, the distance between them, hue and stain readouts, the dye's colour values, source and cost. The **⋮** menu on a card offers **Inspect Dye in…** (Harmony, Budget, Accessibility, Comparison, Swatch), **Transform Dye in…** (Gradient, Mixer) and **Open in browser…** (Universalis, GarlandTools, TeamCraft, Saddlebag). Clicking a card's **Select Dye** makes that dye the new base.

**Companion alternates.** Along the bottom of each harmony card is a row of small swatch dots — the next-closest dyes for that slot. Tap one and it swaps into the slot (card and puck both change); the rest of the grid stays put. How many dots you get is the **Additional Dyes per Harmony Color** slider in the settings column (1–5).

If prices are on and the market board doesn't answer, one strip appears above the grid — *Prices unavailable — the market board did not answer. Colour matching is unaffected — only the price lines are missing.* — instead of a dash on every card. It goes away when prices come back.

### 5. Share

**Share** (or `Shift+S`) copies a link that reopens the same base dye and harmony type, plus your matching settings. A custom-colour base is carried as its hex value instead of a dye.

---

## Settings

In the settings column (the gear icon on phones):

- **Harmony Type** — the same ten as the chip row
- **Matching Mode → Perceptual Matching** — on by default: each slot's dye is chosen by colour distance to the ideal colour, using the **Matching Algorithm** below. Off: dyes are ranked purely by hue angle, which is closer to a painter's wheel but can land on very different lightness
- **Matching Algorithm** — ΔE2000 by default; ΔEOK, ΔE76, Weighted RGB, RGB or a 0–100 percentage
- **Prevent Duplicates** — on by default; stops the same dye filling two slots (or appearing as an alternate where it is already used)
- **Additional Dyes per Harmony Color** — 1–5 alternates per card
- **Display Options** — which colour values and readouts the cards show
- **Dye Filters** — exclude metallic, pastel, dark, cosmic, coffer, vendor or crafted dyes; excluded dyes are replaced by the next-best candidate for the slot
- **Market Board** — turn on prices and pick your data centre and world

---

## Harmony Types Explained

### Complementary
Two colors opposite each other. Creates maximum contrast and visual pop.

**Example**: Dalamud Red + Celeste Green

### Triadic
Three colors equally spaced (120° apart). Balanced and visually interesting.

**Example**: Wine Red + Gobbiebag Brown + Regal Purple

### Analogous
3-4 colors next to each other on the wheel. Creates harmony and flow.

**Example**: Coral Pink + Salmon Pink + Rose Pink

### Split-Complementary
Base color + two colors adjacent to its complement. Less tension than complementary.

### Tetradic (Rectangle)
Four colors forming a rectangle. Rich possibilities but harder to balance.

### Inverted Tetradic (Mirrored Rectangle)
The same two-complementary-pairs structure as Tetradic, mirrored to the opposite side of the wheel (0°, 120°, 180°, 300°). Try it when Tetradic's palette leans the wrong way for your base color.

### Square, Monochromatic, Compound, Shades
Square spaces four colours 90° apart. Monochromatic, Compound and Shades stay close to the base hue — good when you want one colour family with a little movement rather than contrast.

---

## Tips for Glamour Design

1. **60-30-10 Rule**: Use your main color 60%, secondary 30%, accent 10%
2. **Metallic accents**: Gold/silver often work as neutral accents
3. **Walk the wheel**: Tap a puck to make it the base and see what *its* harmonies are — a few taps often lands on a palette you would not have searched for
4. **Test in-game**: Colors may look slightly different on different gear
5. **Consider lighting**: Ul'dah vs Ishgard lighting affects perception

---

## Related Tools

- [Palette Extractor](palette-extractor.md) - Match any color first
- [Dye Comparison](dye-comparison.md) - Compare harmony options
- [Community Presets](community-presets.md) - See community color combinations
- [Favorites & Collections](favorites-collections.md) - Star dyes in the drawer as you go
