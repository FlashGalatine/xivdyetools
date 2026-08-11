# Adding New Dyes

**How to update the dye database when FFXIV releases new dyes**

> This guide covers the process for adding new dyes after a FFXIV patch introduces them.

---

## ⚠️ Canonical Procedure (schema v2, updated 2026-08-11)

The **Dye Maintainer GUI (`apps/maintainer`) has been removed** (Monorepo 2.0; see `DEPRECATIONS.md` and `docs/research/monorepo-2.0/03-maintainer-deprecation.md`). Dyes are added by editing `packages/core/src/data/dyes.json` directly — typically in a Claude Code session working from game data. Everything the tool enforced (and several things it didn't) now lives in CI:

- **Closed vocabularies** — categories, acquisitions, and the acquisition → (price, currency) coupling are defined once in `packages/core/src/config/dye-vocabulary.ts` (`DYE_CATEGORIES` (8), `DYE_ACQUISITIONS` (4), `ACQUISITION_META`).
- **Data invariants** — `packages/core/src/config/__tests__/dye-vocabulary.test.ts` asserts vocabulary membership, price/currency coupling, unique `stainID`s, hex validity (lowercase mandated), and Facewear consistency. `pnpm turbo run test --filter=@xivdyetools/core` is the new "did I get it right?".

### Required fields per entry — seven, and only seven

Since **schema v2** (core v3.0.0) the data file stores only:

| Field | Notes |
|-------|-------|
| `stainID` | The game's Stain sheet row ID. **Canonical identifier** — this is the key |
| `name` | English name, no "Dye" prefix |
| `hex` | Lowercase 6-digit `#rrggbb`. **The single colour source of truth** |
| `category` | One of the 8 in `DYE_CATEGORIES` (`Facewear` is no longer one of them) |
| `acquisition` | One of the 4 in `DYE_ACQUISITIONS` |
| `consolidationType` | `'A' \| 'B' \| 'C' \| null` — drives Patch 7.5 market resolution |
| `legacyItemID` | The pre-consolidation itemID, or `null` for consolidated-only dyes |

**Do not hand-write `rgb`, `hsv`, `lab`, `cost`, `currency`, or any `is*` flag.** They are all
**derived at `DyeDatabase.initialize()`** — colour formats from `hex`, cost/currency from
`ACQUISITION_META`, `isMetallic` from `METALLIC_STAIN_IDS`, `isCosmic ≡ consolidationType 'C'`,
`isIshgardian ≡ 'B'`. Deriving them by construction is what fixed the long-standing Brass
stored-HSV drift bug; re-introducing stored copies would re-introduce that class of bug.

The runtime `Dye` object still exposes all 16 fields, so nothing downstream changes.

### Adding a Facewear colour instead

Facewear colours are **not dyes** and do not go in `dyes.json`. They live in
`packages/core/src/data/facewear_colors.json` as `FacewearColor` — a string slug `id`, `name`,
and `hex`. Do not add entries to `LEGACY_FACEWEAR_ITEM_IDS`; that map is frozen for compatibility
with IDs persisted before schema v2.

### Game-data sources (preferred over scraping)

- **`Stain` sheet** (XIVAPI v2 `sheet/Stain`, or a Dalamud/Lumina export): new rows give stainID, name (no "Dye" prefix — no stripping needed), packed **BGR** color, and the gloss/metallic flag.
- **`StainTransient` sheet**: stainID → purchasable item(s) — determines `itemID` and whether the dye resolves to a consolidated Spectrum item (`consolidationType`).
- **Item sheet fallback:** if you must fetch Item names (en/ja/de/fr), strip the localized "Dye" prefix — try `prefix + ":"`, then `prefix + "："` (full-width colon U+FF1A), then the bare prefix, longest first (this was BUG-081's fix in the old GUI).
- ko/zh names remain manually sourced into `dyenames.csv`.

### After editing the JSON

`pnpm --filter @xivdyetools/core run build:locales` (regenerates locale JSONs; also update `dyenames.csv` first for names) → `pnpm turbo run build test --filter=@xivdyetools/core` → version bump → publish per the standard flow.

The sections below cover item-ID discovery and data formats in more detail; where they mention the GUI, substitute direct JSON editing.

---

## Overview

When Square Enix releases a new FFXIV patch that includes new dyes, the `xivdyetools-core` library needs to be updated with:

1. **Item ID** - The unique identifier for the dye item
2. **Localized Names** - Names in all 6 supported languages
3. **Color Values** - RGB/HSV values for the actual dye color
4. **Acquisition Data** - How to obtain the dye (vendor, crafting, etc.)

---

## Step 1: Get Item IDs

### Method A: Scraping Universalis (Bulk)

Best for discovering all dyes in a category:

1. Go to [universalis.app](https://universalis.app)
2. Click on **"Market"**
3. Click on the **Dye bucket icon** (Dyes category)
4. Right-click on **"Dyes - X items"** and choose **"Inspect"**
5. Look for `<div class="market-category">` and copy Inner HTML
6. Un-minify the code
7. Extract the Item IDs from the list
8. **Repeat for each language** to get localized names

### Method B: XIVAPI Search (Individual)

Best for adding a specific dye by name:

**JavaScript (using ofetch):**
```javascript
import { ofetch } from 'ofetch'

const response = await ofetch('https://v2.xivapi.com/api/search', {
  query: {
    query: 'Name="Soot Black Dye"',
    sheets: 'Item',
    language: 'en'
  }
})

console.log(response.results[0].row_id) // Item ID
```

**cURL:**
```bash
curl 'https://v2.xivapi.com/api/search?query=Name%3D%22Soot%20Black%20Dye%22&sheets=Item&language=en'
```

**Example Response:**
```json
{
  "schema": "exdschema@2:rev:6a5085f56918e526c457fd3e9dfd27d3572c72a7",
  "version": "3309dd1cf84f989d",
  "results": [
    {
      "score": 1,
      "sheet": "Item",
      "row_id": 5734,
      "fields": {
        "Icon": {
          "id": 22807,
          "path": "ui/icon/022000/022807.tex",
          "path_hr1": "ui/icon/022000/022807_hr1.tex"
        },
        "Name": "Soot Black Dye",
        "Singular": "pot of soot black dye"
      }
    }
  ]
}
```

The `row_id` field is the **Item ID** (e.g., `5734` for Soot Black Dye).

### Getting All Language Names

Query XIVAPI with each language code:

```bash
# English
curl 'https://v2.xivapi.com/api/search?query=Name%3D%22Soot%20Black%20Dye%22&sheets=Item&language=en'

# Japanese
curl 'https://v2.xivapi.com/api/search?query=Name%3D%22スートブラック%22&sheets=Item&language=ja'

# German
curl 'https://v2.xivapi.com/api/search?query=Name%3D%22Rußschwarz%22&sheets=Item&language=de'

# French
curl 'https://v2.xivapi.com/api/search?query=Name%3D%22Noir%20de%20suie%22&sheets=Item&language=fr'
```

---

## Step 2: Get Color Values (RGB/HSV)

**This is the trickiest part** - FFXIV doesn't expose dye RGB values in its data files.

### Method: Visual Color Picking from Lodestone

1. Go to [FFXIV Lodestone](https://na.finalfantasyxiv.com/lodestone/)
2. Search for characters using the new dye on their public profiles
3. Find a character with the dye applied to visible gear
4. Use a color picker tool to sample the color:
   - **Windows**: [PowerToys Color Picker](https://learn.microsoft.com/en-us/windows/powertoys/color-picker) (Win+Shift+C)
   - **macOS**: Digital Color Meter (built-in)
   - **Browser**: Any eyedropper extension
5. Record the **hex code** (e.g., `#2B2B2B`)

### Converting to HSV

Once you have RGB, calculate HSV:

```javascript
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round((max === 0 ? 0 : d / max) * 100),
    v: Math.round(max * 100)
  };
}
```

Or use the core library:

```typescript
import { ColorService } from 'xivdyetools-core';
const hsv = ColorService.hexToHsv('#2B2B2B');
```

---

## Step 3: Get Acquisition Data

Use [Garland Tools](https://www.garlandtools.org/db/) or in-game resources:

1. Search for the dye by name
2. Note the acquisition method:
   - **Vendor**: NPC name, location, cost, currency
   - **Crafting**: Recipe, materials
   - **Achievement**: Achievement name
   - **Event**: Event name, availability

---

## Step 4: Update the Database

The dye data is split across two locations:

1. **`dyes.json`** — the seven stored fields per dye
2. **`locales/*.json`** — localized dye names (6 languages), generated from `dyenames.csv`

### File: `packages/core/src/data/dyes.json`

A schema-v2 entry, in full:

```json
{
  "stainID": 38,
  "name": "Soot Black",
  "hex": "#2b2923",
  "category": "Neutral",
  "acquisition": "Dye Vendor",
  "consolidationType": "A",
  "legacyItemID": 5734
}
```

That is the entire record. `rgb`, `hsv`, `lab`, `cost`, `currency`, and the five `is*` flags are
**derived at `initialize()`** and must not appear in the file.

> **Note**: the field table and JSON sample below predate schema v2 and describe the retired
> `colors_xiv.json` layout. They remain useful for understanding what each *derived* field means
> and where its value comes from, but do not hand-write them into the data file.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `itemID` | number \| null | XIVAPI/Universalis Item ID (null for Facewear) |
| `category` | string | Color category (see below) |
| `name` | string | English name (backward compat) |
| `hex` | string | Hex color code |
| `acquisition` | string | How to obtain (e.g., "Dye Vendor", "Crafting", "Cosmic Exploration") |
| `price` | number \| null | Cost (null if not purchasable) |
| `currency` | string \| null | "Gil", "Cosmocredits", or null |
| `rgb` | object | `{ r, g, b }` values (0-255) |
| `hsv` | object | `{ h, s, v }` values (h: 0-360, s/v: 0-100) |
| `isMetallic` | boolean | Has metallic sheen |
| `isPastel` | boolean | Is pastel series |
| `isDark` | boolean | Is dark series |
| `isCosmic` | boolean | Is cosmic series |

### Categories

| Category | Description |
|----------|-------------|
| `Neutral` | White, grey, black dyes |
| `Reds` | Red, pink, wine dyes |
| `Browns` | Brown, orange, tan dyes |
| `Yellows` | Yellow, gold dyes |
| `Greens` | Green dyes |
| `Blues` | Blue dyes |
| `Purples` | Purple, violet dyes |
| `Special` | Metallic, pastel, dark series |
| `Facewear` | Facewear-only colors (no itemID) |

### File: `xivdyetools-core/src/data/locales/{lang}.json`

Each locale file contains localized dye names keyed by `itemID`:

```json
{
  "locale": "ja",
  "meta": {
    "version": "1.0.0",
    "generated": "2025-12-15T01:41:03.145Z",
    "dyeCount": 125
  },
  "labels": {
    "dye": "カララント:",
    "dark": "ダーク",
    "metallic": "メタリック",
    "pastel": "パステル",
    "cosmic": "コスモ",
    "cosmicExploration": "コスモエクスプローラー",
    "cosmicFortunes": "コスモフォーチュン"
  },
  "dyeNames": {
    "5734": "スートブラック",
    "5735": "ローズピンク"
  }
}
```

### Supported Locales

| File | Language |
|------|----------|
| `en.json` | English |
| `ja.json` | Japanese (日本語) |
| `de.json` | German (Deutsch) |
| `fr.json` | French (Français) |
| `ko.json` | Korean (한국어) |
| `zh.json` | Chinese (中文) |

### Adding a New Dye

1. Add the seven-field entry to `dyes.json`
2. Add the ko/zh names to `dyenames.csv` (en/ja/de/fr come from the game sheets)
3. Run `pnpm --filter @xivdyetools/core run build:locales` — this regenerates every
   `locales/*.json` including `meta.dyeCount`. **Do not hand-edit the generated locale files**;
   edits there are overwritten on the next build.

---

## Step 5: Test and Publish

```bash
cd xivdyetools-core

# Run tests to ensure data integrity
npm test

# Verify the new dye appears in searches
npm test -- --grep "new dye name"

# Build
npm run build

# Bump version
npm version patch

# Publish
npm publish
```

---

## Step 6: Update Consumers

After publishing the core library:

```bash
# Web app
cd ../xivdyetools-web-app
npm update xivdyetools-core
npm run build

# Discord worker
cd ../xivdyetools-discord-worker
npm update xivdyetools-core
npm run deploy:production
```

---

## Checklist for New Dyes

- [ ] Item ID obtained (from Universalis or XIVAPI)
- [ ] `stainID` taken from the game's `Stain` sheet
- [ ] `hex` sampled and written lowercase — it is the single colour source of truth
- [ ] `category` and `acquisition` are members of the closed vocabularies
- [ ] `consolidationType` set from `StainTransient` (`'A' | 'B' | 'C' | null`)
- [ ] `legacyItemID` set, or `null` for a consolidated-only dye
- [ ] **No** `rgb` / `hsv` / `lab` / `cost` / `currency` / `is*` fields hand-written
- [ ] ko/zh names added to `dyenames.csv`; `build:locales` run
- [ ] `pnpm turbo run build test --filter=@xivdyetools/core` passes (the invariant tests are the gate)
- [ ] Core version bumped and `CHANGELOG.md` updated
- [ ] Core published; consumers bumped and redeployed

---

## Useful Resources

| Resource | URL | Use |
|----------|-----|-----|
| XIVAPI v2 | https://v2.xivapi.com | Item IDs, names |
| Universalis | https://universalis.app | Market data, item lists |
| Garland Tools | https://www.garlandtools.org/db/ | Acquisition data |
| FFXIV Lodestone | https://na.finalfantasyxiv.com/lodestone/ | Color sampling |
| Teamcraft | https://ffxivteamcraft.com | Recipe data |

---

## Related Documentation

- [Core Library Overview](../projects/core/overview.md)
- [Publishing Guide](../projects/core/publishing.md)
- [Deployment Guide](../developer-guides/deployment.md)
