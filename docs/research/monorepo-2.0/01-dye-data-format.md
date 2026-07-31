# 01 — Dye Data Format (colors_xiv.json → schema v2)

> Part of [Monorepo 2.0 / Web-App 5.0 research](./README.md). Companion to [02 — stainID Migration](./02-stainid-migration.md).

## Summary

`colors_xiv.json` stores 136 entries × 16 fields (66,390 B raw, 6,271 B gzipped). A per-field usage audit across every package and app shows that **10 of the 16 fields are either fully derivable or functionally determined by another field** — and in three separate cases the stored copy has already drifted from the truth it duplicates (Brass `hsv`, `isMetallic` vs the game's gloss flag, `isCosmic` polluting the Ishgardian set). The proposed v2 format is a **7-field, stainID-keyed entry** that mirrors the game's own data model, with everything else derived at `initialize()` — a pattern the codebase already uses for `lab`, `nameLower`, and `categoryLower`.

The win is not wire size (gzip already flattens the redundancy) — it is **eliminating an entire class of drift bugs** and making future "dye without an itemID" entries natural instead of special-cased.

## 1. The Game's Data Model (what v2 should mirror)

Two sheets, verified against local exports (`C:\dev\ClonedProjects\Stain.csv`, `StainTransient.csv`) and the Glamourer/Penumbra source:

**`Stain`** (row ID = stainID, a **byte**; rows 1–125 populated today, 0 = "No Color"):

| Column | Content | Notes |
|--------|---------|-------|
| `Name` | "Snow White" … | The bare color name — no "Dye" prefix |
| `Color` | Packed **BGR** integer | `14999504` = Snow White `#e4dfd0`; Penumbra converts BGR→RGBA (`Penumbra.GameData/Structs/Stain.cs:51-52`) |
| `Shade` | Category group (2=greys, 4=reds, 5=browns, 6=yellows, 7=greens, 8=blues, 9=purples, 10=special) | The game's own `category` |
| `SubOrder` | Position within shade | The game's display order |
| `IsMetallic` | Gloss flag | **16 true rows** — includes Gunmetal Black (92) and Pearl White (93), which our JSON marks `false` |

**`StainTransient`** (row ID = stainID → `Item1`, `Item2`): the game's own stain→purchasable-item resolution table — precisely the role `getMarketItemID()` plays for us. The Venture Coffer specials carry a second item (8732–8751 range). **Neither Glamourer nor Penumbra ever reads this sheet** — the plugin ecosystem is stainID-only, and item↔stain bridging is entirely our toolkit's job.

Plugin ecosystem facts that anchor v2 (full detail in doc 02): `StainId` is a byte strong-type; every slot carries **two** channels (`StainIds(Stain1, Stain2)`, serialized as JSON keys `"Stain"`/`"Stain2"`); stain 0 is the "no dye" sentinel; Glamourer consumes exactly four Stain columns (`RowId`, `Name`, `Color`, `IsMetallic`→`Gloss`) and ignores `Shade`/`SubOrder`; **glasses/facewear have no stain system at all** (colored via a separate RGB "Advanced Dyes" material system).

## 2. Per-Field Verdicts (from the usage audit)

| Field | Verdict | Evidence |
|-------|---------|----------|
| `stainID` | **Keep — becomes the key** | Independent datum; Glamourer/Mare interop; `dyesByStainIdMap` |
| `name` | **Keep** | 664 read sites; also feeds `nameLower`, search |
| `hex` | **Keep — sole color source** | 406 read sites; `svg` and og-worker already call `hexToRgb(dye.hex)` instead of trusting `dye.rgb` |
| `category` | **Keep** (editorial) | Hot everywhere; `'Facewear'` is additionally a structural sentinel in 20+ places — that role disappears when Facewear moves out (§4) |
| `acquisition` | **Keep** | Only 5 distinct values; the root from which price/currency are determined |
| `consolidationType` | **Keep explicit** | Currently derivable from acquisition (136/136) but it is *game* data (which consolidated item unlocks the stain) — future dyes could break the correlation, and it is the single most important market datum |
| `itemID` | **Keep as `legacyItemID: number \| null`** | Needed for market/back-compat; null for future consolidated-only dyes |
| `rgb` | **Drop — derive** | 136/136 identical to `hexToRgb(hex)` |
| `hsv` | **Drop — derive** | 135/136 identical to `rgbToHsv` at the same 2-dp precision; the outlier (Brass, stored `h: 42.43` vs correct `43.30`) is stale stored data. ⚠️ Keep 2-dp hue — 4 dyes sit within 0.2° of a 10° hue-bucket edge and would change buckets if hue were integer-rounded |
| `isMetallic` | **Drop — source from Stain sheet** (✅ decided: gloss semantics) | JSON says 14; the game's gloss flag says 16 (adds Gunmetal Black, Pearl White) — which is why `build-locales.ts:514` hardcodes `[30122, 30123]`. Name-prefix inference reproduces the *wrong* 14 |
| `isPastel` / `isDark` | **Drop — derive** | Exactly `name.startsWith('Pastel')` (4/4) / `startsWith('Dark')` (5/5); keep a tiny override list if SE ever ships an off-pattern name |
| `isCosmic` | **Drop — derive** (✅ decided: `consolidationType === 'C'`) | Currently true for all 9 Firmament dyes too (`isIshgardian ⊂ isCosmic`), so "Exclude Cosmic" silently drops every Ishgardian dye. Deriving from `consolidationType` fixes the pollution and is robust to acquisition-source changes |
| `isIshgardian` | **Drop — derive** (✅ decided: `consolidationType === 'B'`) | Also equals `acquisition === 'The Firmament'` today (9/9), but the consolidationType definition survives if SE moves the vendor again |
| `price` / `currency` | **Drop — 5-row lookup** | Single-valued per acquisition (136/136); vendor cost is only a fallback when Universalis has no live price (`budget-tool.ts:1566-1577`; svg renders only live prices) |

No SVG generator reads any of the five booleans; their only consumers are `DyeFilter`, the web-app filter UI, and api-worker query filters — all of which can consume derived values identically.

## 3. Proposed Schema v2

### `dyes.json` — one entry per tracked Stain row, keyed by stainID

```jsonc
{
  "stainID": 1,                  // canonical key — Stain sheet row (byte)
  "name": "Snow White",          // en name; localized names via locale pipeline, keyed by stainID
  "hex": "#e4dfd0",              // lowercase 6-digit; the single color source of truth
  "category": "Neutral",         // editorial taxonomy (8 values — Facewear removed)
  "acquisition": "Dye Vendor",   // closed enum (4 values after Facewear leaves)
  "consolidationType": "A",      // 'A' | 'B' | 'C' | null (Venture Coffer specials)
  "legacyItemID": 5729           // number | null — null for post-7.5 consolidated-only dyes
}
```

A future consolidated-only dye is simply `{ stainID: 126, name, hex, category, acquisition, consolidationType: "C", legacyItemID: null }` — no special cases.

### `facewear_colors.json` — separate collection (new) — ✅ decided 2026-07-30

Facewear colors are **not stains** (confirmed by both the null/null IDs in our data and Glamourer's model — glasses have no stain support whatsoever). They leave the dye table and the synthetic-negative-ID hack dies with them:

```jsonc
{ "id": "silver", "name": "Silver", "hex": "#C0C0C0" }
```

Tools that support facewear accept a discriminated union (`Dye | FacewearColor`). The k-d tree, market board, and stainID map already exclude them, so this formalizes existing behavior. The `category === 'Facewear'` sentinel checks in 20+ places become type discrimination.

### `ACQUISITION_META` — core config (replaces per-entry price/currency)

```ts
const ACQUISITION_META = {
  'Dye Vendor':         { price: 216, currency: 'Gil' },
  'The Firmament':      { price: 100, currency: "Skybuilders' Scrips" },  // ✅ confirmed in game; consolidated-ids.ts:72 (1000, "Sky Builders' Scrips") is wrong on both value and spelling
  'Cosmic Exploration': { price: 600, currency: 'Cosmocredits' },
  'Venture Coffers':    { price: 1,   currency: 'Venture Coffer' },
} as const;
```

### Derived at `initialize()` (extending the existing `lab`/`nameLower` pattern)

`rgb`, `hsv` (2-dp), `lab`, `nameLower`, `categoryLower`, `metallic` (from a Stain-sheet-sourced gloss set), `pastel`/`dark` (name prefix + override list), `cosmic` (`consolidationType === 'C'`), `ishgardian` (`consolidationType === 'B'`), `cost`/`currency` (from `ACQUISITION_META`), `marketItemID` (from `consolidationType` / `legacyItemID`). The in-memory `Dye` object keeps its full precomputed shape — **k-d tree, hue buckets, and every consumer see identical data**; only the file shrinks.

### Validation moves to one place

`DyeDatabase.isValidDye` never checks `stainID` today (a dye without one loads silently and just vanishes from Glamourer interop — see doc 03), and the only zod schema for this data lives in the deprecated maintainer, where it is stale and destructive. v2 should ship **one** schema in core (zod or JSON Schema) + a unit test asserting: stainID present/unique/1–254, hex lowercase 6-digit, category/acquisition within the closed enums, `legacyItemID` unique-or-null. That single artifact replaces the maintainer's validation role.

## 4. Storage Format Choice

| Option | Verdict |
|--------|---------|
| **Trimmed JSON array (7 fields)** | **Recommended.** ~15 KB raw / ~2–3 KB gzipped (vs 66/6.3 today). Human-diffable, same `import` pattern everywhere, PR diffs for a new dye become 8 lines instead of 27 |
| TS `as const` module | Nice-to-have type inference, but couples data edits to code review of a .ts file and buys nothing at 136 entries; JSON keeps the maintenance workflow (doc 03) tool-agnostic |
| Columnar / packed | Rejected — 136 entries is far too small to justify losing readability |

Delete alongside: `colors_xiv.csv` (zero readers, already drifted — `Ixali Vendor`, `price 40`, phantom `itemID_consolidated` column) and the two stale 11-field copies at `apps/web-app/assets/json/colors_xiv.json` + `apps/web-app/public/json/colors_xiv.json` (referenced only by the service-worker precache list, `service-worker.js:19`).

## 5. Locale Pipeline Changes

1. **Re-key `dyeNames` by stainID** (currently keyed by itemID string — the concrete patch-day breakage for itemID-less dyes; see doc 02 risk #2).
2. **Source names from the Stain sheet, not the Item sheet.** Stain names *are* the bare color names, so the fragile "Dye"-prefix stripping (including the U+FF1A full-width-colon variant, currently trapped in the maintainer) becomes unnecessary. XIVAPI v2 serves the Stain sheet in en/ja/de/fr; ko/zh stay manually sourced.
3. **Metallic set from the Stain sheet** — deletes `identifyMetallicDyes()`'s name inference and its hardcoded `[30122, 30123]` patch (`build-locales.ts:511-525`), and ends the 14-vs-16 divergence.
4. Fix the currency key mismatch (§6 #2) and drop the dead `Crafting` acquisition key (`build-locales.ts:363-423`).

## 6. Data-Quality Bug Ledger (found during this research; fix during or before migration)

1. **Brass `hsv.h` stale** — stored `42.43`, correct `43.30` (`colors_xiv.json`; the only rgb/hsv drift in 136 entries).
2. **Three spellings of one currency** — JSON `"Skybuilders' Scrips"` vs locale key `"Skybuilders Scrips"` (`build-locales.ts:430`) vs `"Sky Builders' Scrips"` (`consolidated-ids.ts:72`). The 9 Firmament dyes currently miss their localized currency lookup.
3. **B-type price mismatch** — ✅ *Resolved 2026-07-30:* the correct price is **100 Skybuilders' Scrips**; `consolidated-ids.ts:72` (1000, `"Sky Builders' Scrips"`) is wrong on both value and spelling — fix it.
4. **`isCosmic` includes all Ishgardian dyes** — ✅ *Resolved 2026-07-30:* cosmic ≡ **C-type dyes** (`consolidationType === 'C'`), ishgardian ≡ **B-type dyes** (`'B'`). The api-worker `?cosmic=` behavior change (Firmament dyes no longer excluded) is accepted — note it in the API changelog.
5. **`isMetallic` disagrees with the game** — ✅ *Resolved 2026-07-30:* the filter means **gloss** — adopt the Stain sheet's 16-dye set. Update the mismatched UI copy (`en.json:712` "Hide dyes with \"Metallic\" in the name" → gloss/metallic-finish wording) and the derived data together.
6. **Possibly stale acquisitions** — [../patch-7.5/dye-consolidation.md](../patch-7.5/dye-consolidation.md) records items 30116–30121 as moved to Cosmic Exploration; the JSON still says The Firmament. With the flags now derived from `consolidationType` (#4), this no longer blocks anything — but the `acquisition` display value should still be verified in game.
7. **`colors_xiv.csv` + two stale web-app JSON copies** — dead, drifted, delete (§4).
8. **`DYE_CATEGORY_ORDER` in `web-app/src/components/v4/dye-palette-drawer.ts:33-45`** — an 11-value vocabulary (`White, Grey, Black, …, Pink`) matching **none** of the 9 real categories; its grouping loop matches nothing today.
9. **Locale `acquisitions` maps carry dead keys** (`Crafting`, `Cosmic Fortunes`) not present in the data.
10. **`hsv` is mandatory in validation (`CORE-BUG-004`) yet derivable** — the mandate exists only because the hue-bucket index reads it; deriving at init satisfies it structurally.

## 7. Open Questions

- **Adopt the game's `Shade`/`SubOrder` for ordering?** Our `category` is editorial (splits "Special" differently); Shade+SubOrder would give game-consistent sort order for free and survive future patches without editorial decisions. Could be carried as derived display metadata without replacing `category`.
- **Do 7.5+ Stain sheet exports change `StainTransient`?** The local export predates consolidation (A/B/C stains still map to legacy items). When a post-7.5 dump is available, check whether the game re-pointed `Item1` at the Spectrum items — if so, `StainTransient` could replace our `consolidationType` field entirely as upstream truth.
- **Two-channel awareness.** Plugins model two dye channels per slot (`Stain`/`Stain2`). Nothing in our tools models slot channels today; v5's glamour-oriented features (presets, share links) may want to — the data format doesn't block it, but worth deciding before the presets D1 backfill (doc 02 phase 2) locks a shape.
