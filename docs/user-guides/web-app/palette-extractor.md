# Palette Extractor

**Find the closest FFXIV dye to any color in a picture**

The Palette Extractor turns a picture into dyes. Drop in a screenshot, a reference photo or a piece of art: its dominant colours appear as a bar under the image, each matched to its closest FFXIV dye, and a loupe lets you read the exact spot you care about and add it as a pick.

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

Below the card a lock icon carries the promise: *"Images are read in your browser and never uploaded."* Everything happens on your device. The picture is held in memory for this session only — it is never written to browser storage — so reloading the page or coming back later means loading it again, and the picks you made go with it.

Once a picture is loaded it fills a dark image card and its palette is extracted straight away. Two buttons sit in the card's top-right corner — **Replace image** and **Clear image** — and dropping a new file onto the workspace replaces the current one. Zoom controls (in / out, **Fit**, **Width**, **Reset**; on phones just in / out) let you get close to a detail.

### 2. The Bar

A colour bar sits directly under the picture. Each colour the extractor found is a segment as wide as its share of the picture, with the percentage printed on it — so a screenshot that is mostly one blue shows one long blue segment. Tap a segment and its dye card lights up in the sheet below. Set how many colours are pulled with **Max Colors** in the settings (3–10); **Vibrancy Boost** orders the bar so a small vivid accent can lead a large dull field (the widths still show the real shares).

Under the bar a legend reads **IMAGE SHARE**, and the section header counts what you have: *4 of 4* for the extracted colours alone, or *4 + 2* once you have added two picks — never *6 of 4*.

### 3. Read a Colour with the Loupe

A small chip in the corner of the picture says it: **Click to sample · drag for the loupe** (on phones, **Tap to sample**).

- **Click or tap** any point and a round **loupe** parks there, filled with the colour it read and showing its hex; the chip names that hex and the closest dye.
- **Press and drag** and the loupe follows your finger or pointer, reading the pixel beneath it as it goes, so you can find the exact spot before letting go. It stays where you release it.

Reading a colour changes nothing on the bar yet. If you want a small area averaged instead of one pixel, change **Pixel Sample Area** in the settings column (1×1 up to 16×16).

### 4. Add Picks

The **+** tile at the right end of the bar holds whatever the loupe is reading. Tap it and that colour joins the bar as a **pick** — a fixed-width block after a small gap, numbered rather than given a percentage, because a colour you picked by hand is not part of the picture's share. Each pick gets its own dye card. You can hold up to six; **Clear picks** (beside the legend) removes them all, and tapping **+** on a colour you already picked just focuses that pick.

Changing **Max Colors** pulls the colours again; changing the matching method, the dye filters or **Prevent Duplicates** only changes which dye each colour resolves to. Your picks survive both.

### 5. View Matches

The sheet shows one card per bar segment — the extracted colours first, then your picks, in bar order. Each card shows the dye beside the colour it came from, the distance between them, hue and stain readouts, the dye's colour values, source and cost. The **⋮** menu on a card offers **Inspect Dye in…** (Harmony, Budget, Accessibility, Comparison, Swatch), **Transform Dye in…** (Gradient, Mixer) and **Open in browser…**. With **Prevent Duplicates** on, a colour whose nearest dye an earlier segment already holds takes the next-closest; when your filters leave no unique dye it keeps the nearest as a repeat, and when they leave no dye at all the sheet says so.

### 6. Export

**Export** in the section header opens the export sheet: every bar segment — extracted colours and picks — with its matched dye, as CSS custom properties, SCSS, JSON, plain HEX or a Tailwind theme, to copy or download.

---

## Settings

In the settings column (the gear icon on phones):

- **Extraction Settings** — **Vibrancy Boost**, **Max Colors** (3–10, how many colours the bar holds) and **Selection Sensitivity** (how far you must drag before a press becomes a loupe drag rather than a click)
- **Pixel Sample Area** — 1×1 (a single pixel), 2×2, 4×4, 8×8 or 16×16, averaged around the point you sample
- **Prevent Duplicates** — on by default; when two extracted colours resolve to the same dye, the second takes the next-closest instead
- **Matching Algorithm** — ΔE2000 is the suite default; ΔEOK2, ΔE76, Weighted RGB, RGB or a 0–100 percentage
- **Display Options** — which colour values and readouts the cards show
- **Dye Filters** — exclude metallic, pastel, dark, cosmic, coffer, vendor or crafted dyes
- **Market Board** — show current prices on the cards for your data centre and world

---

## Understanding Delta E

Delta E measures perceptual color difference — lower is always better. On the default method
(ΔE2000), match results are labelled with four bands:

| ΔE2000 | Band | Meaning |
|--------|------|---------|
| under 5 | SAME | You would not tell them apart |
| 5 to 10 | CLOSE | A very good stand-in |
| 10 to 20 | NEAR | In the same family, but visibly different |
| 20 and up | FAR | A different colour |

Every other matching method has its own calibrated cut-offs on its own scale, so compare the band,
never the raw number, across methods. See the [Glossary](../../reference/glossary.md) for more.

---

## Tips

- **Zoom in first** — at 1×1 a screenshot's anti-aliasing can land you on a stray pixel; zoom, or use a 4×4 sample area
- **Screenshot colors** may vary due to lighting/effects — read the same piece of gear in two zones and compare
- **The bar for the overall look, picks for the detail** — the sheet keeps both, and the count tells them apart
- **Multiple matches** are often worth comparing in-game
- Send a match to **Color Harmony Explorer** afterwards to build the rest of the outfit around it

---

## Related Tools

- [Color Harmony Explorer](color-harmony.md) - Find complementary dyes
- [Dye Comparison](dye-comparison.md) - Compare your matches
- [Budget Suggestions](budget-suggestions.md) - Find affordable alternatives
