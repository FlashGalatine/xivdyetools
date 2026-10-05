# Review: core-data (packages/core data, dye, localization, Universalis, locale generator)

Branch preview/integration-2026-10-04 @80262a2f. No open PR touches `packages/core`, so every candidate is origin MAIN.

## 1. Map

| Module | Role |
|---|---|
| `services/dye/DyeDatabase.ts` | normalises `dyes.json` (schema v2), indexes by id / stainID / hue bucket, builds the k-d tree, freezes records |
| `services/dye/DyeSearch.ts`, `utils/kd-tree.ts` | name/category/filter search; `findClosestDye` / `findDyesWithinDistance` (k-d tree for `rgb`, exact linear scan otherwise) |
| `services/dye/DyeFilter.ts` | type / acquisition exclusion predicates |
| `services/DyeService.ts` | facade, plus `searchByLocalizedName` |
| `services/LocalizationService.ts` + `localization/{LocaleLoader,LocaleRegistry,TranslationProvider}.ts` | static-singleton + injectable locale stack, `Object.hasOwn`-guarded lookups |
| `services/APIService.ts` | Universalis client: cache, pending dedupe, batch chunking, retry |
| `services/PresetService.ts` + `data/presets.json` | 15 curated 3-dye palettes, stainID-keyed |
| `services/PaletteService.ts` | k-means++ palette extraction and dye matching |
| `services/ColorService.ts` | static facade (blending half belongs to the color slice) |
| `config/{consolidated-ids,dye-vocabulary,facewear,band-*,learn-links,product-links}.ts`, `constants`, `types` | closed vocabularies and frozen tables |
| `utils/index.ts` | `LRUCache`, `retry`, `foldForSearch`, `generateChecksum`, validators |
| `scripts/build-locales.ts` and the other generators | `localize.yaml` + `dyenames.csv` + `facewear-names.csv` to `src/data/locales/*.json` |

## 2. Candidates

### core-data-01 BUG MEDIUM: `extractPalette` returns empty clusters, and the bot invents rows for them
- Location: `packages/core/src/services/PaletteService.ts:271-275` (the "unique pixels" comment is not implemented; `effectiveK = min(k, pixels.length)`), and `:166-168` (duplicate centroids). The consumer is `apps/discord-worker/src/handlers/commands/extractor.ts:525-541` and `:111-157`.
- Claim: k is capped by the pixel count, not the number of distinct colours. A flat image asked for 4 colours returns 2 real clusters plus 2 duplicate-centroid clusters with `pixelCount: 0` and `dominance: 0`.
- Failing input: a 2-colour logo (all red or blue pixels after the alpha filter), `colorCount` 4 or 5. Run against built core: `[{255,0,0,50%},{0,0,255,50%},{255,0,0,0%},{255,0,0,0%}]`.
- Wrong outcome:
  - web-app filters `pixelCount > 0` (`extractor-tool.ts:2157`).
  - discord `/extractor` does not. With the default `prevent_duplicates`, `deduplicatePaletteResults` swaps each 0% clone to "next best unique dye", so the card shows fabricated 0% rows with dyes the image never contained.
  - The band uses floored slices, so each 0% entry also gets a visible segment.
- Tests miss it: `PaletteService.test.ts:70-77` ("single-color images") only asserts `length > 0` and `<= 3`. Covered: no.
- Origin: MAIN.
- Excerpt: `const effectiveK = Math.min(k, pixels.length);`
- Fix direction: drop zero-pixel clusters inside core `extractPalette` (or cap k at the distinct-colour count) and assert the exact result in the test. Both consumers then drop their special cases.

### core-data-02 UNTESTED LOW: DyeSearch tests that cannot fail on `null`
- Location: `packages/core/src/services/dye/__tests__/DyeSearch.test.ts:332-336` (3-digit hex), `:320-325` (Facewear exclusion), `:314-318` (excludeIds), `:507-513` and `:628-634` (`if (results.length > 0)` with no else), `:637-645` (`Array.isArray` only), `:515-522` (`limit: 0` asserts `<= 2`).
- Behaviour they should catch: `findClosestDye` returning `null` (for example 3-digit hex rejected) or a sort or limit regression.
- Why: `expect(null).toBeDefined()` passes, and `closest?.x` is `undefined` on null, so `not.toBe(...)` passes. The guarded bodies simply skip when the result is empty. The same file already fixed this pattern at `:423-456`; these were missed.
- Origin: MAIN.
- Fix direction: `toBeNull`-guards or `expect(closest).not.toBeNull()`, with unconditional asserts.

### core-data-03 BUG LOW (latent): `searchByLocalizedName('')` returns all 125 dyes
- Location: `packages/core/src/services/DyeService.ts:350-355`.
- Claim: `searchByName` returns `[]` for an empty or whitespace query (`DyeSearch.ts:83-89`). With a locale loaded, the localized path folds `''` and `nameLower.includes('')` is true for every dye.
- Failing input: `dyeService.searchByLocalizedName('  ', 'de')` returns 125 dyes. With the locale not loaded it returns `[]`.
- api-worker guards empty `q` (`routes/dyes.ts:49`), so this is unreachable today, but the method is published API.
- Tests miss it: `DyeService.test.ts:357-445` has no empty-query case. Covered: no.
- Origin: MAIN.
- Excerpt: `const lowerQuery = foldForSearch(query.trim());` then `dye.nameLower.includes(lowerQuery)`.
- Fix direction: `if (!lowerQuery) return [];`.

### core-data-04 BUG LOW: `DyeDatabase.initialize` does not fail on an all-invalid payload, and duplicate ids are silent under the default logger
- Location: `DyeDatabase.ts:186-190` (the emptiness check runs before the validity filter at `:286`) and `:325-329`.
- Failing inputs:
  - 125 entries that all fail `isValidDye` (for example a hex-less legacy payload) leave `this.dyes = []`, `isLoaded = true`, an empty k-d tree, and log "loaded: 0 dyes". The result is a silently empty database instead of `DATABASE_LOAD_FAILED`.
  - Two dyes with equal `legacyItemID` only call `logger.error`; the comment says "fail loudly", but `DyeService` defaults to `NoOpLogger`, so one dye silently shadows the other in `dyesByIdMap`.
- Defended today: the bundled JSON is guarded by `dye-vocabulary.test.ts`, and I checked all 125 `legacyItemID` and `stainID` values are unique.
- Tests miss it: no "all invalid" or "duplicate id throws" test in `DyeDatabase.test.ts`. Covered: no.
- Origin: MAIN.
- Fix direction: after the filter, throw if the result is empty. Make a duplicate id throw, matching the comment.

### core-data-05 BUG LOW (data): the English dye name is spelled two ways
- Location: `packages/core/src/data/dyes.json:211` ("Opo-Opo Brown") against `src/data/locales/en.json:41`, `dyenames.csv:25` ("Opo-opo Brown"). It is the only one of 125 that differs (checked programmatically).
- Wrong outcome: API `name` and the `en` localized name for stainID 20 (itemID 5752) differ in case. og-worker renders the en-locale form (`og-worker swatch.test.ts:79` pins "Opo-opo"), while search, cards and `dye.name` use the other form.
- Tests miss it: nothing cross-checks `dyes.json` names against the `en` locale. Covered: no.
- Origin: MAIN.
- Fix direction: pick the in-game spelling for both, and add a core test that `dyeNames[itemID] === dye.name` for `en`.

### core-data-06 BUG LOW: `build-locales.ts` writes the files before it fails, and never checks dye coverage
- Location: `packages/core/scripts/build-locales.ts:114-133` (the write loop) against `:138-152` (`process.exit(1)` on missing cells), and `:319-333` (`buildDyeNames` iterates CSV rows only).
- Claim 1: on a missing translation cell the build exits 1, but every locale JSON, now carrying English fallbacks, has already been overwritten. `build` is `build:locales && tsc`, so tsc is skipped, but the dirty tree remains.
- Claim 2: a dye added to `dyes.json` with no `dyenames.csv` row is not in `missingCells` (only present rows are tracked). The generator silently emits a locale with 124 names, and `getDyeName` returns `null` for it.
- Failing input: add stainID 126 to `dyes.json` without a CSV row, then run `pnpm build`. It succeeds with 125 dyeNames.
- Tests miss it: no test asserts that every `dyes.json` `legacyItemID` has a name in each of the six locales. LocaleLoader tests spot-check two ids. Covered: no.
- Origin: MAIN.
- Fix direction: collect all output and write only when there are no missing cells (or `--allow-missing`). Cross-check `dyes.json` ids against the CSV and add the coverage test.

### core-data-07 OPT LOW: `getPriceData` drops the in-flight entry before the cache write completes
- Location: `packages/core/src/services/APIService.ts:536-544`.
- Claim: `pendingRequests.delete(cacheKey)` runs before `await trySetCachedPrice(...)`. A caller arriving during an async cache write (web-app's IndexedDB backend) sees neither a pending entry nor a cache hit, so it refetches upstream.
- Failing input: two `getPriceData(id, undefined, 'Crystal')` calls, the second issued while the first awaits the IDB `set`. That is two upstream requests.
- Tests miss it: the dedupe tests use the sync `MemoryCacheBackend`. Covered: no.
- Origin: MAIN.
- Fix direction: delete from the map after the cache write, in a `finally`.

### core-data-08 BUG LOW: k-means++ uses `Math.random`, so the same image gives different palettes
- Location: `packages/core/src/services/PaletteService.ts:146` and `:170`.
- Claim: re-running extraction on identical pixels can change which clusters win. The web-app re-extracts on `paletteColorCount` changes (`extractor-tool.ts:530`, `:2183`), and discord `/extractor` re-runs per invocation, so results shuffle between runs.
- No seed option exists.
- Tests miss it: asserts are loose (see core-data-01). Covered: no.
- Origin: MAIN.
- Fix direction: a seeded PRNG (for example seeded from the pixel count and sum) behind an option.

## 3. POSITIVE

- The committed `src/data/locales/*.json` are exactly what `build-locales.ts` generates. I ran the generator on copies of `localize.yaml`, `dyenames.csv` and `facewear-names.csv` in a scratch directory and compared all six files ignoring `meta.generated`: identical. There are no empty strings, no duplicate dye names within a locale, and 125 of 125 ids in every locale.
- Schema-v2 data is internally consistent:
  - 125 unique stainIDs (1..125) and unique `legacyItemID`s.
  - The consolidation groups match the id ranges (A 85, B 9, C 11, 20 un-consolidated).
  - The 16 `METALLIC_STAIN_IDS` resolve to the expected names.
  - `LEGACY_FACEWEAR_ITEM_IDS` equals `-(1000 + Σ charCodes)` for all 11 names.
  - All 15 presets reference existing stainIDs, with no duplicate ids or in-palette duplicates.
- `TranslationProvider` guards every lookup with `Object.hasOwn`. `LocaleLoader` rejects `localeMap['constructor']` and `'__proto__'` because they fail `isValidLocaleData`.
- `DyeSearch` falls back to the exact linear scan for perceptual methods, and `findDyesWithinDistance` returns the full set. The REFACTOR-003 radius-cap regression is not present. The k-d tree `<=` far-side test handles ties.
- BUG-010 (freeze) holds: `initialize` freezes `rgb`, `hsv`, `lab` and the record after all indexes are built.
- The DefaultRateLimiter slot reservation is synchronous. `isAPIAvailable` has a timeout. Batch fetch chunks at 100 and filters non-positive ids before the URL builder.
- `normalizeMatchingMethod` uses `Object.hasOwn`. The ΔE alias `cie2000` is folded in a single place (`ColorConverter.normalizeDeltaEFormula`).

## 4. REJECTED

- **Negative `limit` in `findDyesWithinDistance`** (`DyeSearch.ts:311` does `splice(-n)` while the k-d path guards `> 0`): a real inconsistency, but api-worker validates `limit` in 1..125 (`match.ts:80`) and the other caller passes 20.
- **`getDistanceForMethod` returns `undefined` for an unnormalised legacy method** (`ColorService.ts:180-198`): already filed by the og-worker review with the same root cause. `normalizeMatchingMethod` is the intended ingress guard.
- **`extractLocaleCode('zh-TW')` returns `zh`** (`LocalizationService.ts:57`): documented ("the prefix is supported"); only Simplified Chinese data exists.
- **`getColorWheelName` treats an empty string as a hit, unlike the sibling getters** (`TranslationProvider.ts:263-269`): no empty strings exist in any locale (checked), so it is latent only.
- **`getPriceData(itemID, worldID)` builds a world cache key but queries `universal`** (`APIService.ts:854-859`, `:915-927`): documented "reserved"; no caller passes a world id (`api-service-wrapper.ts:258` is unused).
- **Region price returned for a DC query** (`APIService.ts:272`): documented design.
- **`getPricesForDataCenter` does not dedupe its input ids**: the sole caller (`market-board-service.ts:347`) dedupes by market id.
- **`generateChecksum` uses `Math.abs(hash)`**: cache-integrity only; collisions are negligible.
- **`calibrate-bands.ts` filters `category !== 'Facewear'`**: harmless dead filter, which the dead-code audit owns.
- **`DyeFilter` ids and acquisitions**: verified against the data (13114 = Pure White, 13115 = Jet Black; the acquisition strings match).
- **kd-tree**: median split with ties on both sides is searched correctly (`<=` far-side).

## 5. COVERED

36 files read: `scripts/{build-locales, build-character-colors, build-munsell-hues, build-oklch-hue-table, calibrate-bands, copy-locales}.ts`, `scripts/fetch_dye_names.py` (partial: fetch and load), and `src/config/{band-calibration (first 120 lines), band-vocabulary, consolidated-ids, dye-vocabulary, facewear, learn-links, product-links}.ts`.

Also read:
- `src/constants/index.ts`, `src/index.ts` (barrel, partial), `src/types/index.ts`, `src/utils/{index, kd-tree}.ts`;
- `src/services/{APIService, ColorService (conversion and distance half), DyeService, LocalizationService, PaletteService, PresetService}.ts`, `src/services/dye/{DyeDatabase, DyeFilter, DyeSearch}.ts`, `src/services/localization/{LocaleLoader, LocaleRegistry, TranslationProvider}.ts`;
- `package.json`, `CLAUDE.md`, `localize.yaml`, `dyenames.csv`, `facewear-names.csv`, `src/data/{dyes, presets, facewear_colors, locales/*}.json` (checked programmatically).

Not read in depth: `scripts/lib/oklch-hue-table.ts`, the `ColorService` blending half (color slice), `build-locales.ts` hardcoded translation tables (checked via the generator parity run rather than by eye).

Tests skimmed: `PaletteService`, `DyeSearch`, `DyeService`, `DyeDatabase`, `APIService` (grep), `localization/*`, `PresetService`.
