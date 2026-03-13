# Web App Tools (v4.3.1)

The XIV Dye Tools web app provides 9 interactive tools for working with FFXIV dye colors. Each tool is accessible via its own route and rendered as a Lit component.

---

## 1. Harmony Explorer

**Route:** `/harmony`

Generate harmonious dye combinations using color theory algorithms.

- **Harmony modes:** Complementary, Analogous, Triadic, Split-Complementary, Tetradic, Monochromatic
- Uses `HarmonyGenerator` service to compute color relationships against the 136-dye database
- Select a base dye, choose a harmony mode, and view matching dyes with color swatches

**What's new in v4.x:**

- v4.2.0: Added "Prevent Duplicate Results" toggle to filter out repeated dyes across harmony groups

---

## 2. Palette Extractor

**Route:** `/extractor`

Extract colors from uploaded images and match them to the closest FFXIV dyes.

- Upload an image or paste from clipboard; K-means++ clustering extracts dominant colors
- Each extracted color is matched to the nearest dye via k-d tree search in LAB color space
- **Pixel Sampling (Shift+Click):** Sample a specific region of the image with a configurable NxN area (1x1 to 16x16 pixels)
- **Canvas Panning (Ctrl/Cmd+Drag):** Pan around large or zoomed images
- **Sample Area size config:** Adjust the pixel sampling region size

**What's new in v4.x:**

- v4.2.0: Added Paste from Clipboard support and "Prevent Duplicate Results" toggle
- v4.3.0: Added Pixel Sampling (Shift+Click), Canvas Panning (Ctrl/Cmd+Drag), and Sample Area size configuration

> **Legacy name:** "Color Matcher" in v3.

---

## 3. Gradient Builder

**Route:** `/gradient`

Create smooth color gradients between two dyes.

- Select a start dye and end dye, then configure the number of intermediate steps
- **Interpolation modes:** RGB, HSV, LAB, OKLCH, LCH
- Each step in the gradient is matched to the closest available dye
- Useful for planning gear sets with gradual color transitions

**What's new in v4.x:**

- Renamed from "Dye Mixer" (v3) to avoid confusion with the new Dye Mixer tool

> **Legacy name:** "Dye Mixer" in v3.

---

## 4. Dye Mixer

**Route:** `/mixer`

Blend two dyes together using multiple blending algorithms. New in v4.

- Select two dyes and a blending algorithm to produce a blended result color
- **Blending algorithms:** RGB, LAB, OkLAB, RYB, HSL, Spectral
- Uses the `@xivdyetools/color-blending` package
- The blended color is matched to the nearest available dye

**What's new in v4.x:**

- New tool introduced in v4.0.0

---

## 5. Swatch Matcher

**Route:** `/swatches`

Match character customization colors (skin tones, hair colors) to the closest FFXIV dyes.

- Select a clan and gender to load the corresponding customization color palette
- Supports all 6 clans (Hyur Midlander, Hyur Highlander, Miqo'te, Lalafell, Roegadyn, Au Ra) and both genders
- Click any skin tone or hair color swatch to find the closest matching dye

**What's new in v4.x:**

- Renamed from "Character Colors" (v3)

> **Legacy name:** "Character Colors" in v3.

---

## 6. Budget Finder

**Route:** `/budget`

Find affordable dye alternatives using Universalis market board data. New in v4.

- Search for cheap alternatives to a target dye color, ranked by price and color distance
- Fetches real-time market board prices via the `universalis-proxy` worker
- **Dye categories:** Base, Craft, Allied Society, Cosmic, Special
- Filter by category, set a max price, and sort by price or color accuracy
- Facewear dyes (synthetic negative IDs) are excluded since they are not tradeable

**What's new in v4.x:**

- New tool introduced in v4.0.0

---

## 7. Dye Comparison

**Route:** `/compare`

Compare 2 to 4 dyes side by side.

- View color swatches, hex values, RGB/LAB/HSL components, and metadata for each selected dye
- **DeltaE distances** calculated between all selected dyes for perceptual difference measurement
- Displays dye category, item ID, and localized names

---

## 8. Accessibility Checker

**Route:** `/accessibility`

Simulate how dyes appear under various forms of colorblindness.

- **Simulation types:** Deuteranopia (red-green, most common), Protanopia (red-green), Tritanopia (blue-yellow), Achromatopsia (total color blindness)
- Uses Brettel 1997 matrices for perceptually accurate simulation
- Select a dye and view simulated color swatches for each condition
- Helpful for ensuring gear color choices are distinguishable for colorblind players

---

## 9. Preset Browser

**Route:** `/presets`

Browse, vote on, and submit community dye presets.

- View community-submitted dye presets with color swatches and descriptions
- Vote on presets (requires authentication)
- Submit new presets with dye selections and descriptions
- Integrates with `presets-api` worker for CRUD operations
- OAuth authentication via the `oauth` worker (Discord login)

---

## Tool ID to Route Mapping

The following table shows current routes and their v3 legacy equivalents. Legacy routes redirect to the current paths.

| Tool | Current Route | Legacy v3 Route | Legacy v3 Name |
|------|---------------|-----------------|----------------|
| Harmony Explorer | `/harmony` | `/harmony` | Harmony Explorer |
| Palette Extractor | `/extractor` | `/matcher` | Color Matcher |
| Gradient Builder | `/gradient` | `/mixer` | Dye Mixer |
| Dye Mixer | `/mixer` | — | — (new in v4) |
| Swatch Matcher | `/swatches` | `/characters` | Character Colors |
| Budget Finder | `/budget` | — | — (new in v4) |
| Dye Comparison | `/compare` | `/compare` | Dye Comparison |
| Accessibility Checker | `/accessibility` | `/accessibility` | Accessibility Checker |
| Preset Browser | `/presets` | `/presets` | Preset Browser |

---

## Related Documentation

- [Components](components.md) - Lit component architecture
- [Theming](theming.md) - Theme system
- [Overview](overview.md) - Web app overview
