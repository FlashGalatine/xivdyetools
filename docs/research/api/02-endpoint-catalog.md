# 02 — Endpoint Catalog

Complete endpoint design for the XIV Dye Tools Public API. All endpoints are read-only (GET) unless noted. Base URL: `https://api.xivdyetools.com/v1`

---

## 1. Dye Database

Wraps `DyeService` — the 136-dye FFXIV database with category, color, and acquisition metadata.

### Dye ID Resolution

Dyes can be identified by three different ID types. Because their numeric ranges are **fully disjoint**, the API auto-detects which type was provided:

| Numeric Range | ID Type | Description | Lookup Method |
|---------------|---------|-------------|---------------|
| Negative | Facewear synthetic ID | 11 Facewear dyes with no real item ID (e.g., `-1`) | `DyeDatabase.getDyeById()` |
| 1–125 | stainID | Game's internal stain table ID, used by plugins and datamined content | `DyeDatabase.getByStainId()` |
| 5729+ | itemID | FFXIV inventory item ID, used for market board and crafting | `DyeDatabase.getDyeById()` |

IDs in the 126–5728 range do not match any dye in either system and return 404.

**Auto-detection** applies to: `GET /dyes/:id`, `GET /dyes/batch` (with `idType=auto`), `excludeIds` parameters, and `GET /locales/:locale/dye/:id`.

**Why stainID matters:** Post-Patch 7.5 (April 28, 2026), new dyes may be added to the stain table without individual inventory item IDs, since consolidated items replace individual dye items for market purposes. The `stainID` is the identifier used by Dalamud plugins (Glamourer, Mare Synchronos) and character save data. For explicit stainID-only resolution, use `GET /dyes/stain/:stainId`.

### GET `/dyes`

List all dyes with optional filtering and sorting.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `locale` | string | `en` | Localize dye names: `en`, `ja`, `de`, `fr`, `ko`, `zh` |
| `category` | string | — | Filter by category (e.g., `Red`, `Brown`, `Neutral`, `Metallic`) |
| `metallic` | boolean | — | Filter metallic dyes only (`true`) or exclude them (`false`) |
| `pastel` | boolean | — | Filter pastel dyes |
| `dark` | boolean | — | Filter dark dyes |
| `cosmic` | boolean | — | Filter cosmic dyes |
| `consolidationType` | string | — | Filter by consolidation type: `A`, `B`, `C`, or `none` (Special/unconsolidated dyes). See [Patch 7.5 note](#patch-75-dye-consolidation) |
| `ishgardian` | boolean | — | Filter Ishgardian Restoration dyes |
| `minPrice` | number | — | Minimum NPC cost |
| `maxPrice` | number | — | Maximum NPC cost |
| `excludeIds` | string | — | Comma-separated dye IDs to exclude (supports auto-detection — see [Dye ID Resolution](#dye-id-resolution)) |
| `sort` | string | `name` | Sort field: `name`, `brightness`, `saturation`, `hue`, `cost` |
| `order` | string | `asc` | Sort direction: `asc`, `desc` |
| `page` | number | `1` | Page number |
| `perPage` | number | `50` | Items per page (max 200) |

**Maps to:** `DyeService.filterDyes()`, `DyeService.getDyesSortedByBrightness()`, etc.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "itemID": 5729,
      "stainID": 1,
      "id": 5729,
      "name": "Snow White",
      "localizedName": "スノウホワイト",
      "hex": "#EFEFEF",
      "rgb": { "r": 239, "g": 239, "b": 239 },
      "hsv": { "h": 0, "s": 0, "v": 94 },
      "category": "Neutral",
      "acquisition": "NPC",
      "cost": 216,
      "isMetallic": false,
      "isPastel": false,
      "isDark": false,
      "isCosmic": false,
      "consolidationType": "A",
      "isIshgardian": false,
      "marketItemID": 99001
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 50,
    "total": 136,
    "totalPages": 3
  },
  "meta": {
    "locale": "ja",
    "requestId": "abc-123"
  }
}
```

### GET `/dyes/:id`

Get a single dye by ID. The API **auto-detects** the ID type based on the numeric range (see [Dye ID Resolution](#dye-id-resolution)).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Dye identifier — accepts itemID (5729+), stainID (1–125), or negative Facewear ID. Resolved automatically via range detection. |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `locale` | string | `en` | Localize dye name |

**Maps to:** `DyeDatabase.getDyeById()` (for itemID/Facewear) or `DyeDatabase.getByStainId()` (for stainID), then `DyeService.getLocalizedDyeById()`

> **Tip:** For explicit stainID-only resolution, use `GET /dyes/stain/:stainId` instead.

### GET `/dyes/stain/:stainId`

Get a single dye by its stain table ID. This endpoint provides **explicit stainID-only resolution**, useful when the caller knows they have a stainID and wants to avoid any ambiguity with auto-detection on `GET /dyes/:id`.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `stainId` | number | Game stain table ID (positive integer; currently 1–125, may expand post-Patch 7.5) |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `locale` | string | `en` | Localize dye name |

**Maps to:** `DyeDatabase.getByStainId()`

**Notes:**
- Returns the same dye object format as `GET /dyes/:id`
- Returns 404 for Facewear dyes (they have no stainID — `stainID: null`)
- Returns 404 for stainIDs that do not match any dye in the database

### GET `/dyes/search`

Search dyes by name (supports localized names).

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | *required* | Search query (case-insensitive partial match) |
| `locale` | string | `en` | Search in localized names too |

**Maps to:** `DyeService.searchByName()`, `DyeService.searchByLocalizedName()`

### GET `/dyes/categories`

List all dye categories.

**Maps to:** `DyeService.getCategories()`

**Response:**

```json
{
  "success": true,
  "data": ["Neutral", "Red", "Brown", "Yellow", "Green", "Blue", "Purple", "Metallic"]
}
```

### GET `/dyes/batch`

Get multiple dyes by ID in a single request.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | string | *required* — Comma-separated dye IDs (max 50). Supports itemIDs, stainIDs, and negative Facewear IDs when `idType=auto`. |
| `idType` | string | ID interpretation mode: `auto` (default — range-based detection per-ID, see [Dye ID Resolution](#dye-id-resolution)), `item` (all IDs treated as itemIDs), `stain` (all IDs treated as stainIDs) |
| `locale` | string | Localize dye names |

**Maps to:** `DyeService.getDyesByIds()` (when `idType=item`), `DyeDatabase.getByStainId()` per-ID (when `idType=stain`), or auto-resolved per-ID (when `idType=auto`)

### GET `/dyes/consolidation-groups`

List the three Patch 7.5 consolidation groups with their consolidated market item IDs and member dye counts.

**Maps to:** Derived from `DyeService.filterDyes()` grouped by `consolidationType`

**Response:**

```json
{
  "success": true,
  "data": {
    "consolidationActive": true,
    "groups": [
      {
        "type": "A",
        "label": "A Realm Reborn (2.x)",
        "marketItemID": 99001,
        "dyeCount": 85,
        "itemIDRange": "5729-5813"
      },
      {
        "type": "B",
        "label": "Ishgardian Restoration",
        "marketItemID": 99002,
        "dyeCount": 9,
        "itemIDRange": "30116-30124"
      },
      {
        "type": "C",
        "label": "Cosmic Exploration & Fortunes",
        "marketItemID": 99003,
        "dyeCount": 11,
        "itemIDRange": "48163-48172, 48227"
      }
    ],
    "unconsolidated": {
      "label": "Special / Not Consolidated",
      "dyeCount": 31,
      "note": "Pure White, Jet Black, Metallic/Dark/Pastel variants, Online Store dyes, and Facewear dyes retain individual market listings"
    }
  }
}
```

---

## Patch 7.5 Dye Consolidation

> **Effective:** Patch 7.5 (April 28, 2026)

Patch 7.5 consolidates 105 individual dye items into 3 base items. Players purchase one consolidated item and select the specific color at application time. This significantly impacts market price lookups.

**New fields on every dye object:**

| Field | Type | Description |
|-------|------|-------------|
| `consolidationType` | `"A"` \| `"B"` \| `"C"` \| `null` | Which consolidation group, or `null` for Special/unconsolidated dyes |
| `isIshgardian` | boolean | Whether the dye originated from the Ishgardian Restoration |
| `marketItemID` | number | The effective item ID for market board lookups — consolidated group ID for Type A/B/C, original `itemID` for Special dyes, negative for Facewear (not tradeable) |

**Consolidation groups:**

| Type | Count | Origin | Item ID Range |
|------|-------|--------|---------------|
| A | 85 | A Realm Reborn (2.x patches) | 5729–5813 |
| B | 9 | Ishgardian Restoration | 30116–30124 |
| C | 11 | Cosmic Exploration + Cosmic Fortunes | 48163–48172, 48227 |

**Not consolidated:** Special dyes from Venture Coffers (Pure White, Jet Black, Metallic/Dark/Pastel variants — itemIDs 13114–13723), Online Store dyes, and Facewear dyes.

**Impact on `/prices/` endpoint:** Post-consolidation, all 85 Type A dyes share a single market price, all 9 Type B dyes share a single market price, and all 11 Type C dyes share a single market price. The API uses `marketItemID` (via `getMarketItemID(dye)`) to determine which item ID to query Universalis with. This reduces Universalis API calls from ~105 individual lookups to ~20 (3 consolidated + ~17 Special).

---

## 2. Color Matching

Wraps the k-d tree nearest-neighbor search in `DyeService`.

### GET `/match/closest`

Find the closest dye to a given hex color.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex` | string | *required* | Target color (e.g., `#FF5733` or `FF5733`) |
| `method` | string | `oklab` | Matching algorithm: `rgb`, `cie76`, `ciede2000`, `oklab`, `hyab`, `oklch-weighted` |
| `excludeIds` | string | — | Comma-separated dye IDs to exclude (supports auto-detection — see [Dye ID Resolution](#dye-id-resolution)) |
| `kL` | number | `1.0` | OKLCH lightness weight (only with `oklch-weighted`) |
| `kC` | number | `1.0` | OKLCH chroma weight |
| `kH` | number | `1.0` | OKLCH hue weight |
| `locale` | string | `en` | Localize result |

**Maps to:** `DyeService.findClosestDye(hex, options: FindClosestOptions)`

**Response:**

```json
{
  "success": true,
  "data": {
    "dye": {
      "itemID": 5790,
      "name": "Dalamud Red",
      "hex": "#E74C3C",
      "rgb": { "r": 231, "g": 76, "b": 60 },
      "category": "Red"
    },
    "distance": 12.34,
    "method": "oklab"
  },
  "meta": {
    "inputHex": "#FF5733",
    "requestId": "abc-123"
  }
}
```

### GET `/match/within-distance`

Find all dyes within a color distance threshold.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex` | string | *required* | Target color |
| `maxDistance` | number | *required* | Maximum delta-E distance threshold |
| `method` | string | `oklab` | Matching algorithm |
| `limit` | number | `20` | Maximum results (max 136) |
| `kL`, `kC`, `kH` | number | `1.0` | OKLCH weights |
| `locale` | string | `en` | Localize results |

**Maps to:** `DyeService.findDyesWithinDistance(hex, options: FindWithinDistanceOptions)`

**Response:** Array of `{ dye, distance }` objects sorted by distance (ascending).

### Matching Method Reference

| Method | Algorithm | Speed | Perceptual Accuracy |
|--------|-----------|-------|---------------------|
| `rgb` | Euclidean RGB distance | Fastest | Low |
| `cie76` | CIE76 (L\*a\*b\* Euclidean) | Fast | Medium |
| `ciede2000` | CIEDE2000 (improved CIE) | Medium | High |
| `oklab` | OKLAB Euclidean | Fast | High |
| `hyab` | HyAB (hybrid absolute) | Medium | Very High |
| `oklch-weighted` | Weighted OKLCH with `kL`/`kC`/`kH` | Fast | Customizable |

**Matching Presets** (suggested `kL`/`kC`/`kH` values):

| Preset | kL | kC | kH | Best For |
|--------|-----|-----|-----|----------|
| `balanced` | 1.0 | 1.0 | 1.0 | General matching |
| `matchHue` | 0.5 | 0.8 | 2.0 | Prioritize hue similarity |
| `matchBrightness` | 2.0 | 1.0 | 0.5 | Prioritize brightness similarity |
| `matchSaturation` | 0.5 | 2.0 | 0.8 | Prioritize saturation similarity |

---

## 3. Color Harmony

Wraps `HarmonyGenerator` via `DyeService` — generates color schemes by finding dyes at specific hue relationships.

### Common Query Parameters (all harmony endpoints)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex` | string | *required* | Base color for harmony |
| `algorithm` | string | `hue` | Harmony matching: `hue` (rotate in color space) or `deltaE` (perceptual distance) |
| `colorSpace` | string | `oklch` | Color space for hue rotation: `hsv`, `oklch`, `lch`, `hsl` |
| `locale` | string | `en` | Localize results |

### GET `/harmony/complementary`

Find the complementary dye (180° opposite on the color wheel).

**Maps to:** `DyeService.findComplementaryPair(hex, options: HarmonyOptions)`

**Response:**

```json
{
  "success": true,
  "data": {
    "base": { "hex": "#FF5733" },
    "complementary": {
      "dye": { "itemID": 5802, "name": "Turquoise Green", "hex": "#33D4FF" },
      "targetHex": "#33C9FF",
      "distance": 5.2
    },
    "harmonyType": "complementary"
  }
}
```

### GET `/harmony/analogous`

Find analogous dyes (adjacent on the color wheel).

**Additional Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `angle` | number | `30` | Angle of separation in degrees (1-90) |

**Maps to:** `DyeService.findAnalogousDyes(hex, angle, options: HarmonyOptions)`

**Response:** Array of 2 dyes (one at +angle, one at -angle from base).

### GET `/harmony/triadic`

Find triadic dyes (120° spacing).

**Maps to:** `DyeService.findTriadicDyes(hex, options: HarmonyOptions)`

**Response:** Array of 2 dyes.

### GET `/harmony/square`

Find square harmony dyes (90° spacing).

**Maps to:** `DyeService.findSquareDyes(hex, options: HarmonyOptions)`

**Response:** Array of 3 dyes.

### GET `/harmony/tetradic`

Find tetradic dyes (two complementary pairs).

**Maps to:** `DyeService.findTetradicDyes(hex, options: HarmonyOptions)`

**Response:** Array of 3 dyes.

### GET `/harmony/split-complementary`

Find split-complementary dyes (±30° from complementary).

**Maps to:** `DyeService.findSplitComplementaryDyes(hex, options: HarmonyOptions)`

**Response:** Array of 2 dyes.

### GET `/harmony/monochromatic`

Find monochromatic variations (same hue, varying saturation/brightness).

**Additional Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | `6` | Maximum results (1-20) |

**Maps to:** `DyeService.findMonochromaticDyes(hex, limit, options: HarmonyOptions)`

### GET `/harmony/compound`

Find compound harmony (analogous + complementary combined).

**Maps to:** `DyeService.findCompoundDyes(hex, options: HarmonyOptions)`

### GET `/harmony/shades`

Find similar shades (±15° hue tolerance).

**Maps to:** `DyeService.findShadesDyes(hex, options: HarmonyOptions)`

---

## 4. Color Conversion

Wraps `ColorService` static methods — convert between 8 color spaces.

### GET `/color/convert`

Convert a color value from one color space to another.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | string | *required* — Source space: `hex`, `rgb`, `hsv`, `hsl`, `lab`, `lch`, `oklab`, `oklch`, `ryb` |
| `to` | string | *required* — Target space (same options as `from`) |

**Value parameters depend on `from`:**

| Source | Required Parameters |
|--------|-------------------|
| `hex` | `value` (e.g., `#FF5733`) |
| `rgb` | `r` (0-255), `g` (0-255), `b` (0-255) |
| `hsv` | `h` (0-360), `s` (0-100), `v` (0-100) |
| `hsl` | `h` (0-360), `s` (0-100), `l` (0-100) |
| `lab` | `L` (0-100), `a` (-128 to 127), `b` (-128 to 127) |
| `lch` | `L` (0-100), `C` (0-150+), `h` (0-360) |
| `oklab` | `L` (0-1), `a` (-0.5 to 0.5), `b` (-0.5 to 0.5) |
| `oklch` | `L` (0-1), `C` (0-0.5), `h` (0-360) |
| `ryb` | `r` (0-255), `y` (0-255), `b` (0-255) |

**Maps to:** `ColorService.hexToRgb()`, `ColorService.rgbToHsv()`, `ColorService.hexToOklab()`, etc. (all static conversion methods)

**Response:**

```json
{
  "success": true,
  "data": {
    "from": { "space": "hex", "value": "#FF5733" },
    "to": {
      "space": "oklab",
      "value": { "L": 0.6614, "a": 0.1239, "b": 0.1098 }
    }
  }
}
```

### GET `/color/convert/all`

Convert a color to all supported color spaces at once.

**Query Parameters:** Same `from` + value parameters as `/color/convert`.

**Response:** Object containing the color expressed in all 9 spaces.

---

## 5. Color Distance & Accessibility

### GET `/color/distance`

Calculate the perceptual distance between two colors.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex1` | string | *required* | First color |
| `hex2` | string | *required* | Second color |
| `formula` | string | `ciede2000` | Formula: `rgb`, `cie76`, `ciede2000`, `oklab`, `hyab` |

**Maps to:** `ColorService.getDeltaE(hex1, hex2, formula)` and `ColorService.getColorDistance(hex1, hex2)`

**Response:**

```json
{
  "success": true,
  "data": {
    "hex1": "#FF5733",
    "hex2": "#33FF57",
    "distance": 67.42,
    "formula": "ciede2000"
  }
}
```

### GET `/color/contrast`

Calculate WCAG contrast ratio and compliance.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hex1` | string | *required* — Foreground color |
| `hex2` | string | *required* — Background color |

**Maps to:** `ColorService.getContrastRatio()`, `.meetsWCAGAA()`, `.meetsWCAGAAA()`

**Response:**

```json
{
  "success": true,
  "data": {
    "hex1": "#FF5733",
    "hex2": "#FFFFFF",
    "contrastRatio": 3.52,
    "luminance1": 0.2126,
    "luminance2": 1.0,
    "wcag": {
      "aa": { "normal": false, "large": true },
      "aaa": { "normal": false, "large": false }
    },
    "optimalTextColor": "#000000"
  }
}
```

---

## 6. Color Mixing

Wraps `ColorService` mixing methods — blend two colors using various algorithms.

### GET `/color/mix`

Mix two colors at a given ratio.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex1` | string | *required* | First color |
| `hex2` | string | *required* | Second color |
| `ratio` | number | `0.5` | Blend ratio (0.0 = all hex1, 1.0 = all hex2) |
| `method` | string | `oklab` | Mixing method: `rgb`, `lab`, `ryb`, `oklab`, `oklch`, `lch`, `hsl`, `hsv`, `spectral` |
| `hueMethod` | string | `shorter` | Hue interpolation for polar spaces: `shorter`, `longer`, `increasing`, `decreasing` |

**Maps to:** `ColorService.mixColorsRgb()`, `.mixColorsLab()`, `.mixColorsRyb()`, `.mixColorsOklab()`, `.mixColorsOklch()`, `.mixColorsLch()`, `.mixColorsHsl()`, `.mixColorsHsv()`, `.mixColorsSpectral()`

**Response:**

```json
{
  "success": true,
  "data": {
    "hex1": "#FF0000",
    "hex2": "#0000FF",
    "ratio": 0.5,
    "method": "spectral",
    "result": "#C400C4",
    "resultRgb": { "r": 196, "g": 0, "b": 196 }
  }
}
```

### POST `/color/mix/multiple`

Mix multiple colors with optional weights (spectral mixing only).

**Request Body:**

```json
{
  "colors": ["#FF0000", "#00FF00", "#0000FF"],
  "weights": [1.0, 0.5, 0.5]
}
```

**Maps to:** `ColorService.mixMultipleSpectral(colors, weights)`

### GET `/color/gradient`

Generate a gradient between two colors.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex1` | string | *required* | Start color |
| `hex2` | string | *required* | End color |
| `steps` | number | `5` | Number of steps (2-50) |
| `method` | string | `spectral` | Mixing method (same options as `/color/mix`) |

**Maps to:** `ColorService.gradientSpectral(hex1, hex2, steps)` (and manual step interpolation for other methods)

---

## 7. Colorblind Simulation

Wraps `ColorService` colorblindness simulation using Brettel matrices.

### GET `/color/simulate`

Simulate how a color appears under a specific color vision deficiency.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex` | string | *required* | Input color |
| `type` | string | *required* | Vision type: `deuteranopia`, `protanopia`, `tritanopia`, `achromatopsia` |

**Maps to:** `ColorService.simulateColorblindnessHex(hex, visionType)`

**Response:**

```json
{
  "success": true,
  "data": {
    "original": "#FF5733",
    "simulated": "#A89E33",
    "visionType": "deuteranopia"
  }
}
```

### GET `/color/simulate/all`

Simulate all vision types at once.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hex` | string | *required* — Input color |

**Response:**

```json
{
  "success": true,
  "data": {
    "original": "#FF5733",
    "simulations": {
      "deuteranopia": "#A89E33",
      "protanopia": "#9FA033",
      "tritanopia": "#FF5060",
      "achromatopsia": "#8E8E8E"
    }
  }
}
```

---

## 8. Color Manipulation

Additional `ColorService` utilities for modifying colors.

### GET `/color/adjust`

Adjust a color's brightness, saturation, or hue.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hex` | string | *required* | Input color |
| `brightness` | number | — | Brightness adjustment (-100 to 100) |
| `saturation` | number | — | Saturation adjustment (-100 to 100) |
| `hue` | number | — | Hue rotation in degrees (-360 to 360) |

**Maps to:** `ColorService.adjustBrightness()`, `.adjustSaturation()`, `.rotateHue()`

### GET `/color/invert`

Invert a color.

**Query Parameters:** `hex` (required)

**Maps to:** `ColorService.invert(hex)`

### GET `/color/desaturate`

Desaturate a color to grayscale.

**Query Parameters:** `hex` (required)

**Maps to:** `ColorService.desaturate(hex)`

---

## 9. Character Colors

Wraps `CharacterColorService` — FFXIV character customization color palettes for all races and genders.

### GET `/character/subraces`

List all available subraces with their parent race.

**Maps to:** `CharacterColorService.getAvailableSubraces()`

**Response:**

```json
{
  "success": true,
  "data": [
    { "subrace": "Midlander", "race": "Hyur" },
    { "subrace": "Highlander", "race": "Hyur" },
    { "subrace": "Wildwood", "race": "Elezen" }
  ]
}
```

### GET `/character/colors/:category`

Get a character color palette.

**Path Parameters:**

| Parameter | Values |
|-----------|--------|
| `category` | `eyeColors`, `highlightColors`, `lipColorsDark`, `lipColorsLight`, `tattooColors`, `facePaintColorsDark`, `facePaintColorsLight`, `hairColors`, `skinColors` |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subrace` | string | For `hairColors`, `skinColors` | e.g., `Midlander`, `Miqote_Keeper` |
| `gender` | string | For `hairColors`, `skinColors` | `Male` or `Female` |

**Maps to:** `CharacterColorService.getSharedColors()` (sync) or `.getRaceSpecificColors()` (async)

**Response:**

```json
{
  "success": true,
  "data": {
    "category": "eyeColors",
    "colors": [
      { "hex": "#8B4513", "rgb": { "r": 139, "g": 69, "b": 19 }, "index": 0 },
      { "hex": "#A0522D", "rgb": { "r": 160, "g": 82, "b": 45 }, "index": 1 }
    ],
    "gridColumns": 8
  }
}
```

### GET `/character/colors/:category/:index`

Get a specific character color by palette index.

**Maps to:** `CharacterColorService.getSharedColorByIndex()` or `.getRaceSpecificColorByIndex()`

### GET `/character/match`

Find the closest dyes to a character customization color.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | *required* | Color category (same as above) |
| `index` | number | *required* | Color index within the palette |
| `subrace` | string | — | Required for race-specific categories |
| `gender` | string | — | Required for race-specific categories |
| `count` | number | `3` | Number of closest dyes to return (1-20) |
| `method` | string | `oklab` | Matching method |
| `locale` | string | `en` | Localize dye names |

**Maps to:** `CharacterColorService.findClosestDyes(color, dyeService, options: CharacterMatchOptions)`

---

## 10. Curated Presets

Wraps `PresetService` — hand-curated dye palettes organized by category.

### GET `/presets`

List all curated presets.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | — | Filter by category: `jobs`, `seasons`, `themes`, `events`, `aesthetics`, `curated` |
| `search` | string | — | Search by name, description, or tags |
| `tag` | string | — | Filter by specific tag |
| `resolve` | boolean | `false` | Include full dye objects (not just IDs) |
| `locale` | string | `en` | Localize dye names (when `resolve=true`) |

**Maps to:** `PresetService.getAllPresets()`, `.getPresetsByCategory()`, `.searchPresets()`, `.getPresetsByTag()`

### GET `/presets/:id`

Get a single preset by ID.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `resolve` | boolean | `false` | Include full dye objects |
| `locale` | string | `en` | Localize dye names |

**Maps to:** `PresetService.getPreset()`, `.getPresetWithDyes()`

### GET `/presets/categories`

List all preset categories with counts.

**Maps to:** `PresetService.getCategories()`, `.getPresetCountByCategory()`

### GET `/presets/random`

Get a random preset.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Optionally limit to a category |
| `resolve` | boolean | Include full dye objects |

**Maps to:** `PresetService.getRandomPreset()`

---

## 11. Localization

Wraps `LocalizationService` — dye names and UI strings in 6 languages.

### GET `/locales`

List all supported locales.

**Maps to:** `LocalizationService.getAvailableLocales()`

**Response:**

```json
{
  "success": true,
  "data": [
    { "code": "en", "name": "English" },
    { "code": "ja", "name": "日本語" },
    { "code": "de", "name": "Deutsch" },
    { "code": "fr", "name": "Français" },
    { "code": "ko", "name": "한국어" },
    { "code": "zh", "name": "中文" }
  ]
}
```

### GET `/locales/:locale/dyes`

Get all dye names in a specific locale.

**Maps to:** `LocalizationService.setLocale()` + `DyeService.getAllLocalizedDyes()`

**Response:**

```json
{
  "success": true,
  "data": [
    { "itemID": 5729, "stainID": 1, "name": "Snow White", "localizedName": "スノウホワイト" },
    { "itemID": 5730, "stainID": 2, "name": "Ash Grey", "localizedName": "アッシュグレイ" }
  ]
}
```

### GET `/locales/:locale/dye/:id`

Get a single localized dye name. The `:id` parameter supports the same **auto-detection** as `GET /dyes/:id` (see [Dye ID Resolution](#dye-id-resolution)) — accepts itemID, stainID, or negative Facewear ID.

**Maps to:** ID resolution via `resolveIdType()`, then `LocalizationService.getDyeName(itemID)`

---

## 12. Market Prices (Pass-Through)

Proxies to the existing `universalis-proxy` worker via Service Binding.

### GET `/prices/:datacenter/:itemIds`

Get market board prices from Universalis.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `datacenter` | string | Data center name (e.g., `Aether`, `Primal`, `Crystal`) |
| `itemIds` | string | Comma-separated item IDs (max 100, positive only) |

**Maps to:** Service Binding → `universalis-proxy` → Universalis API

**Automatic filtering:**
- Facewear dyes (negative item IDs) are excluded since they are not tradeable
- Post-Patch 7.5: consolidated dye item IDs are automatically deduplicated — if multiple Type A dye IDs are requested, only one Universalis lookup is made using the consolidated `marketItemID`, and the result is fanned out to all matching dyes in the response

### GET `/prices/:datacenter/dyes`

Get market prices for all tradeable dyes, with automatic consolidation handling.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `consolidationType` | string | — | Filter to specific type: `A`, `B`, `C`, `special`, or `all` (default) |

**Response:**

```json
{
  "success": true,
  "data": {
    "consolidationActive": true,
    "prices": [
      {
        "marketItemID": 99001,
        "consolidationType": "A",
        "label": "Consolidated Dye (Type A)",
        "currentMinPrice": 50,
        "averagePrice": 75,
        "listingCount": 234,
        "appliesTo": 85
      },
      {
        "marketItemID": 13114,
        "consolidationType": null,
        "label": "Pure White",
        "currentMinPrice": 250000,
        "averagePrice": 310000,
        "listingCount": 12,
        "appliesTo": 1
      }
    ]
  },
  "meta": {
    "datacenter": "Aether",
    "totalUniqueMarketItems": 20,
    "requestId": "abc-123"
  }
}
```

**Note:** This endpoint reduces the ~105 individual Universalis lookups needed pre-consolidation to ~20 (3 consolidated + ~17 Special), improving performance significantly.

---

## Endpoint Count Summary

| Domain | Endpoints | Methods |
|--------|-----------|---------|
| Dyes | 7 | GET |
| Matching | 2 | GET |
| Harmony | 9 | GET |
| Conversion | 2 | GET |
| Distance & Accessibility | 2 | GET |
| Mixing | 3 | GET, POST |
| Simulation | 2 | GET |
| Manipulation | 3 | GET |
| Character Colors | 4 | GET |
| Presets | 4 | GET |
| Localization | 3 | GET |
| Market Prices | 2 | GET |
| **Total** | **43** | |
