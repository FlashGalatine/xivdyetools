# Palette Extractor

**Find the closest FFXIV dye to any color in a picture**

The Palette Extractor turns a picture into dyes. Drop in a screenshot, a reference photo or a piece of art, click the exact spot you care about — or let it pull the dominant colours for you — and every colour comes back as its closest FFXIV dye.

> **Note**: In the 5.0 tool rail this is the **Extractor** chip. It has no Color Palette drawer — the picture is the input.

---

## How to Use

### 1. Bring in a Picture

The workspace opens as a dashed **Drop an image** card:

| Method | How |
|--------|-----|
| **Drop** | Drag a file anywhere onto the workspace — *PNG, JPG, WebP or GIF, up to 20 MB* |
| **Choose image** | Click the card (or the button) to browse for a file |
| **Paste from clipboard** | Press `Ctrl+V` (`Cmd+V` on Mac) after copying an image, or use the button |
| **Take a photo** | On phones the card leads with the camera; **Choose from photos** picks from your library |

Below the card a lock icon carries the promise: *"Images are read in your browser and never uploaded."* Everything happens on your device. The picture is also cached in your browser's local storage so it is still there when you come back (up to 8 MB), and **Clear image** removes that copy too.

Once a picture is loaded it fills a dark image card. Two buttons sit in its top-right corner — **Replace image** and **Clear image** — and dropping a new file onto the workspace replaces the current one. Zoom controls (in / out, **Fit**, **Width**, **Reset**) let you get close to a detail.

### 2. Sample a Colour

A small chip in the corner of the picture says it: **Click to sample · drag for the loupe** (on phones, **Tap to sample**).

- **Click or tap** any point and the colour under the cursor is sampled straight away.
- **Press and drag** and a round **loupe** follows your finger or pointer — filled with the colour beneath it, with a crosshair and a hex readout — so you can find the exact pixel before letting go. Releasing samples it.

Each sample shows a **Sampled Color** card (HEX, RGB, HSV, LAB and a **Copy Color Info** button) and fills the results with its matches. If you want a small area averaged instead of one pixel, change **Pixel Sample Area** in the settings column (1×1 up to 16×16).

### 3. The Palette Roll

Every sample lands in the **PALETTE ROLL** — a strip of little tiles under the picture (the last 20). Click a tile to bring that colour's matches back into focus. On the right of the strip:

- **Clear** empties the roll.
- **Auto-extract** reads the whole picture and fills the roll with its dominant colours in one go, each tile tagged with how much of the image it covers (for example *34%*). Set how many with **Max Colors** in the settings (3–10); **Vibrancy Boost** favours saturated colours over greys.
- The dashed **+** tile at the end of the strip commits the colour currently under the loupe without leaving the picture.

### 4. View Matches

The results header reads **Matched Dyes** for a single sample (the closest dye first, then up to nine more within range) or **Extracted palette** after Auto-extract (one card per extracted colour), with a count beside it. Each card shows the dye beside the colour you sampled, the distance between them, hue and stain readouts, the dye's colour values, source and cost. The **⋮** menu on a card offers **Inspect Dye in…** (Harmony, Budget, Accessibility, Comparison, Swatch), **Transform Dye in…** (Gradient, Mixer) and **Open in browser…**.

### 5. Export

**Export** in the results header opens the export sheet: every colour with its matched dye, as CSS custom properties, SCSS, JSON, plain HEX or a Tailwind theme, to copy or download.

---

## Settings

In the settings column (the gear icon on phones):

- **Extraction Settings** — **Vibrancy Boost**, **Max Colors** (3–10, how many Auto-extract pulls) and **Selection Sensitivity** (how far you must drag before a press becomes a loupe drag rather than a click)
- **Pixel Sample Area** — 1×1 (a single pixel), 2×2, 4×4, 8×8 or 16×16, averaged around the point you sample
- **Prevent Duplicates** — on by default; when two extracted colours resolve to the same dye, the second takes the next-closest instead
- **Matching Algorithm** — ΔE2000 is the suite default; ΔEOK, ΔE76, Weighted RGB, RGB or a 0–100 percentage
- **Display Options** — which colour values and readouts the cards show
- **Dye Filters** — exclude metallic, pastel, dark, cosmic, coffer, vendor or crafted dyes
- **Market Board** — show current prices on the cards for your data centre and world

---

## Understanding Delta E

Delta E measures perceptual color difference:

| Delta E | Meaning |
|---------|---------|
| 0-1 | Not perceptible |
| 1-2 | Perceptible through close observation |
| 2-10 | Perceptible at a glance |
| 11-49 | Colors are more similar than opposite |
| 100 | Colors are exact opposites |

Lower is always better for matching!

---

## Tips

- **Zoom in first** — at 1×1 a screenshot's anti-aliasing can land you on a stray pixel; zoom, or use a 4×4 sample area
- **Screenshot colors** may vary due to lighting/effects — sample the same piece of gear in two zones and compare
- **Auto-extract for the overall look, click for the detail** — the roll keeps both
- **Multiple matches** are often worth comparing in-game
- Send a match to **Color Harmony Explorer** afterwards to build the rest of the outfit around it

---

## Related Tools

- [Color Harmony Explorer](color-harmony.md) - Find complementary dyes
- [Dye Comparison](dye-comparison.md) - Compare your matches
- [Budget Suggestions](budget-suggestions.md) - Find affordable alternatives
