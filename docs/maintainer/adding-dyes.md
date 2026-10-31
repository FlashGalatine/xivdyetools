# Adding New Dyes

**How to update the dye database when FFXIV releases new dyes**

> This guide covers the process for adding new dyes after a FFXIV patch introduces them.

---

## ⚠️ Canonical Procedure (schema v2, updated 2026-08-11)

The **Dye Maintainer GUI (`apps/maintainer`) has been removed** (Monorepo 2.0; see `DEPRECATIONS.md` and `docs/research/monorepo-2.0/03-maintainer-deprecation.md`). Dyes are added by editing `packages/core/src/data/dyes.json` directly — typically in a Claude Code session working from game data. Everything the tool enforced (and several things it didn't) now lives in CI:

- **Closed vocabularies** — categories, acquisitions, and the acquisition → (price, currency) coupling are defined once in `packages/core/src/config/dye-vocabulary.ts` (`DYE_CATEGORIES` (8), `DYE_ACQUISITIONS` (4), `ACQUISITION_META`).
- **Data invariants** — `packages/core/src/config/__tests__/dye-vocabulary.test.ts` asserts vocabulary membership, price/currency coupling, unique `stainID`s, hex validity (lowercase mandated), and Facewear consistency. `pnpm turbo run test --filter=@xivdyetools/core` is the new "did I get it right?".

### Required fields per entry — seven, and only seven

Since **schema v2** (the Monorepo 2.0 consolidation, 2026-07-31) the data file stores only:

| Field | Notes |
|-------|-------|
| `stainID` | The game's Stain sheet row ID. **Canonical identifier** — this is the key |
| `name` | English name, no "Dye" prefix |
| `hex` | Lowercase 6-digit `#rrggbb`. **The single color source of truth** |
| `category` | One of the 8 in `DYE_CATEGORIES` (`Facewear` is no longer one of them) |
| `acquisition` | One of the 4 in `DYE_ACQUISITIONS` |
| `consolidationType` | `'A' \| 'B' \| 'C' \| null` — drives Patch 7.5 market resolution |
| `legacyItemID` | The pre-consolidation itemID, or `null` for consolidated-only dyes |

**Do not hand-write `rgb`, `hsv`, `lab`, `cost`, `currency`, or any `is*` flag.** They are all
**derived at `DyeDatabase.initialize()`** — color formats from `hex`, cost/currency from
`ACQUISITION_META`, `isMetallic` from `METALLIC_STAIN_IDS`, `isCosmic ≡ consolidationType 'C'`,
`isIshgardian ≡ 'B'`. Deriving them by construction is what fixed the long-standing Brass
stored-HSV drift bug; re-introducing stored copies would re-introduce that class of bug.

The runtime `Dye` object still exposes all 16 fields, so nothing downstream changes.

### Adding a Facewear color instead

Facewear colors are **not dyes** and do not go in `dyes.json`. They live in
`packages/core/src/data/facewear_colors.json` as `FacewearColor` — a string slug `id`, `name`,
and `hex`. Do not add entries to `LEGACY_FACEWEAR_ITEM_IDS`; that map is frozen for compatibility
with IDs persisted before schema v2.

### Game-data sources (preferred over scraping)

- **`Stain` sheet** (XIVAPI v2 `sheet/Stain`, or a Dalamud/Lumina export): new rows give stainID, name (no "Dye" prefix — no stripping needed), packed color (XIVAPI v2's integer reads as `0xRRGGBB`), and the gloss/metallic flag.
- **`Stain.Item[]` relationships**: stainID → purchasable item(s) — determines `itemID` and whether the dye resolves to a consolidated Spectrum item (`consolidationType`).
- **Item sheet fallback:** if you must fetch Item names (en/ja/de/fr), strip the localized "Dye" prefix — try `prefix + ":"`, then `prefix + "："` (full-width colon U+FF1A), then the bare prefix, longest first (this was BUG-081's fix in the old GUI).
- ko/zh names remain manually sourced into `dyenames.csv`.

For existing dye-name corrections, prefer a complete pinned `audit:dyes` capture and its `Stain.Name` fields over the legacy Item-name fetcher. Match rows by canonical `stainID`, then retain the existing CSV key (`legacyItemID ?? stainID`). XIVAPI wins when en/ja/de/fr names differ from our translations; retain its capitalization and the locale generator's surrounding-whitespace trim. Preserve regional ko/zh cells. See the [terminology rule](../reference/ffxiv-terminology.md#dye-names-125-dyes) and [worked adoption receipt](../research/2026-10-29-dye-name-translations/README.md).

### Discovering and comparing dyes with XIVAPI

Run the manual maintenance command from the repository root:

```powershell
pnpm --filter @xivdyetools/core run audit:dyes --latest --out docs/audits/2026-10-20-dye-refresh
pnpm --filter @xivdyetools/core run audit:dyes --version 0874aee069e1e7c4 --schema exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb --out docs/audits/2026-10-20-dye-pinned
pnpm --filter @xivdyetools/core run audit:dyes --snapshot docs/audits/2026-10-20-dye-pinned --out docs/audits/2026-10-20-dye-replay
```

Choose exactly one input mode and a new output directory whose parent exists. Relative paths are resolved against the repository root. The pins above reproduce the research version; choose explicit pins for the client revision being reviewed. `--latest` resolves canonical game/schema pins from its first response and pins every later page.

The command scans the whole Stain sheet, including lower-numbered blank rows, until an empty page. It saves exact raw pages, the local JSON/CSV/rules used, provenance/hashes, `report.json` and `REPORT.md`. Review the added candidates, missing/unnamed local rows, name/color/metallic differences and expected Item links. Row 0 is No Color; named nonzero rows are candidates, including black dyes and rows without Item links. A name alone does not establish release, acquisition or obtainability.

`--snapshot` verifies and replays **both saved upstream and saved local inputs** without HTTP. Its semantic JSON matches the saved report even when today's catalog has changed. Use a new live/pinned run to compare today's sources. Exit 0 means the report completed, including reports with differences; 1 means failure/incomplete input or output; 2 means invalid arguments. Existing destinations are refused. A failed write may leave an unsealed directory; only a bundle with a final complete manifest is replayable, and a retry needs a new destination.

The command edits no production sources and runs no generators. Maintain all six locales and compatibility IDs through the reviewed workflow below. The [2026-10-20 audit](../audits/2026-10-20-xivapi-offloading/README.md) found 22 color discrepancies and different German/French naming conventions; these need separate decisions before adoption. The [full-sheet follow-up](../audits/2026-10-20-xivapi-offloading/DYE_DISCOVERY.md) documents `Stain.Item[]`; `StainTransient` returned 404 at the tested pins, so recheck the schema when advancing revisions.

Client limits are sequential requests, 100 requested rows/page, 20 successful pages including the terminal page, 2 MiB per response/artifact, 15 seconds per attempt, three attempts/page and five minutes total. Transient failures back off and honor Retry-After. Exceeding a bound produces an incomplete error. These are local bounds, not advertised XIVAPI quotas. Normal builds, tests and runtime dye access do not run live refreshes.

### After editing the JSON

`pnpm --filter @xivdyetools/core run build:locales` (regenerates locale JSONs; also update `dyenames.csv` first for names) → `pnpm turbo run build test --filter=@xivdyetools/core` → version bump → publish per the standard flow.

The sections below cover item-ID discovery and data formats in more detail; where they mention the GUI, substitute direct JSON editing.

---

## Overview

When Square Enix releases a new FFXIV patch that includes new dyes, the `@xivdyetools/core` package needs to be updated with:

1. **Item ID** - The unique identifier for the dye item
2. **Localized Names** - Names in all 6 supported languages
3. **Color Value** - The `#rrggbb` hex of the actual dye color
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

## Step 2: Get the Color Value (hex)

The dye's color is in the game data, so no sampling is needed.

### Method: Stain sheet color

1. Read the new row from the `Stain` sheet (see [Game-data sources](#game-data-sources-preferred-over-scraping))
2. Take its `Color` integer as XIVAPI v2 serves it and write it as six lowercase, zero-padded hex
   digits, with no channel swap (Soot Black's `2828579` is `#2b2923`)
3. Record that **hex code** as the `hex` field — HSV, Lab and the other color formats are derived
   from it at `DyeDatabase.initialize()`, so never compute or store them by hand

### Fallback: Visual color picking from Lodestone

Only if the Stain sheet is not yet available for the patch:

1. Go to [FFXIV Lodestone](https://na.finalfantasyxiv.com/lodestone/)
2. Search for characters using the new dye on their public profiles
3. Find a character with the dye applied to visible gear
4. Use a color picker tool to sample the color:
   - **Windows**: [PowerToys Color Picker](https://learn.microsoft.com/en-us/windows/powertoys/color-picker) (Win+Shift+C)
   - **macOS**: Digital Color Meter (built-in)
   - **Browser**: Any eyedropper extension
5. Record the **hex code** in lowercase (e.g., `#2b2923`) and replace it with the Stain sheet value once available

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
  "stainID": 6,
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
| `itemID` | number | XIVAPI/Universalis Item ID. Always a number on the runtime `Dye` — `0` means the dye has no market item. Use `dye.itemID > 0` to test for market presence, never a null check |
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
| `Neutral` | White, gray, black dyes |
| `Reds` | Red, pink, wine dyes |
| `Browns` | Brown, orange, tan dyes |
| `Yellows` | Yellow, gold dyes |
| `Greens` | Green dyes |
| `Blues` | Blue dyes |
| `Purples` | Purple, violet dyes |
| `Special` | Metallic, pastel, dark series |

Those eight are the whole closed vocabulary (`DYE_CATEGORIES`). **`Facewear` is not a category** — the 11 Facewear colors are not dyes at all: since schema v2 they live in `facewear_colors.json` / the `facewearColors` export, with a string slug `id`, a name and a hex, and no stainID or market presence.

### File: `packages/core/src/data/locales/{lang}.json`

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

All commands run from the **monorepo root** (`xivdyetools/`).

```bash
# Build and test the core package (Turborepo respects dependency order)
pnpm turbo run build test --filter=@xivdyetools/core

# Run one test file — e.g. the closed-vocabulary invariants
pnpm --filter @xivdyetools/core exec vitest run src/config/__tests__/dye-vocabulary.test.ts
```

Then publish:

1. Bump the version in `packages/core/package.json` — **required**, since the workflow only
   publishes when the local and registry versions differ.
2. Merge to `main`.
3. Actions → **"Publish Packages to npm"** → package: `@xivdyetools/core`.

> **Never publish from a local shell.** Every package is set to *"Require two-factor authentication
> and disallow tokens"*, so an unattended local `pnpm publish` cannot succeed. Publishing runs
> through GitHub Actions with npm **trusted publishing (OIDC)** — there is no npm token anywhere in
> CI. See the root `CLAUDE.md` for the break-glass path.

---

## Step 6: Update Consumers

Inside the monorepo there is nothing to update: every app depends on `@xivdyetools/core` through the
`workspace:*` protocol, so a change is picked up as soon as the package is rebuilt.

```bash
# Rebuild everything that depends on core
pnpm turbo run build

# Or just what you need
pnpm turbo run build --filter=xivdyetools-web-app
pnpm turbo run build --filter=xivdyetools-discord-worker
```

Deploying is a separate step, and **what a bare `deploy` targets differs per worker** — check the
worker's `wrangler.toml` first, and see `docs/operations/DEPLOY_ENVIRONMENTS.md`.

```bash
pnpm --filter xivdyetools-discord-worker run deploy:production
```

---

## Checklist for New Dyes

- [ ] Item ID obtained (from Universalis or XIVAPI)
- [ ] `stainID` taken from the game's `Stain` sheet
- [ ] `hex` taken from the `Stain` sheet's `Color` (sampled only if the sheet has no row yet) and written lowercase — it is the single color source of truth
- [ ] `category` and `acquisition` are members of the closed vocabularies
- [ ] `consolidationType` reviewed against `Stain.Item[]` (`'A' | 'B' | 'C' | null`)
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
| XIVAPI v2 | https://v2.xivapi.com | Item IDs, names, `Stain` sheet colors |
| Universalis | https://universalis.app | Market data, item lists |
| Garland Tools | https://www.garlandtools.org/db/ | Acquisition data |
| FFXIV Lodestone | https://na.finalfantasyxiv.com/lodestone/ | Color sampling (fallback only) |
| Teamcraft | https://ffxivteamcraft.com | Recipe data |

---

## Related Documentation

- [Core Library Overview](../projects/core/overview.md)
- [Publishing Guide](../projects/core/publishing.md)
- [Deployment Guide](../developer-guides/deployment.md)
