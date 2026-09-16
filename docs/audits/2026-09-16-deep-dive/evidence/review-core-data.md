# Review: core-data (@xivdyetools/core — dye/chara/localization/services/config/types/data)

## 1. Map

| Module | Role |
|---|---|
| `services/dye/DyeDatabase.ts` | Loads `dyes.json`, builds id/stainID/hue-bucket maps + k-d tree, derives schema-v2 fields |
| `services/dye/DyeSearch.ts` | `findClosestDye`/`findDyesWithinDistance` (k-d tree for `rgb`, exact linear scan for perceptual methods) |
| `services/dye/DyeFilter.ts` | Pure `isDyeExcluded`/`filterDyes`/`hasActiveFilters` |
| `services/dye/HarmonyGenerator.ts` | Legacy per-type `find*Dyes()` — published API only, no in-repo caller since PR #159 |
| `services/dye/HarmonySelector.ts` | `generateHarmonySlots` — the ONE harmony implementation every surface uses |
| `utils/kd-tree.ts` | 3D RGB k-d tree, index-based build, nearest/within-distance queries |
| `services/chara/chara-parser.ts` | `.chara` JSON → `ParsedCharaFile` (key-presence parsing, no range validation) |
| `services/chara/chara-resolver.ts` | Palette-index vs extended-float arbitration, dark/light sheet split, gear-dye stainID lookup |
| `services/chara/chara-models.ts` | `ModelMain`/`ModelSub` packing helpers (armor/weapon lanes) |
| `services/APIService.ts` | Universalis client: cache, rate limiter, batch coalescing, `fetchWithTimeout` |
| `services/localization/LocaleLoader.ts` | Returns the static-imported locale JSON module object, unmodified |
| `services/localization/LocaleRegistry.ts` | `Map<LocaleCode, LocaleData>` cache, returns stored reference |
| `services/localization/TranslationProvider.ts` | Fallback-chain translation getters, all `Object.hasOwn`-guarded |
| `services/LocalizationService.ts` | Facade + singleton over the loader/registry/translator trio |
| `services/CharacterColorService.ts` | Eager shared + lazy race-specific character-colour sheets, bounded top-k matching |
| `services/DyeService.ts` | Facade over DyeDatabase/DyeSearch/HarmonyGenerator |
| `services/ColorService.ts` | Thin static facade delegating to `services/color/*` (out of this unit's scope) |
| `services/PaletteService.ts` | K-means++ palette extraction + dye matching |
| `services/PresetService.ts` | `presets.json` lookup, resolves dye IDs via `getByStainId` |
| `config/consolidated-ids.ts` | Patch 7.5 `getMarketItemID`/`CONSOLIDATED_DYES` (52254/52255/52256) |
| `config/facewear.ts` | `facewearColors` + frozen `LEGACY_FACEWEAR_ITEM_IDS` |
| `config/dye-vocabulary.ts` | Closed category/acquisition vocab, `ACQUISITION_META`, `METALLIC_STAIN_IDS` |
| `config/band-vocabulary.ts` / `band-calibration.ts` | 5.0 tier-band cuts + the calibration algorithm that generates them |
| `config/learn-links.ts` / `product-links.ts` | Static link tables, no logic risk |
| `types/index.ts` | `MatchingMethod` vocabulary + `normalizeMatchingMethod` (proto-safe) |
| `index.ts` | Public barrel |
| `data/dyes.json`, `data/facewear_colors.json` | 125 dyes / 11 facewear colours (invariants spot-checked, see below) |

## 2. Candidates

**core-data-01** — BUG — MEDIUM — `packages/core/src/services/dye/DyeDatabase.ts:392-395,400-403,426-429`
`getAllDyes()`/`getDyeById()`/`getByStainId()` return live `DyeInternal` object references (only the outer array is copied in `getAllDyes`). Failing input: `const d = dyeService.getAllDyes()[0]; d.rgb.r = 0;` → `dyeService.getDyeById(d.id).rgb.r` is now `0` too, and the k-d tree / hue-bucket entries built from the same object are corrupted for every later `findClosestDye`/harmony call for the lifetime of the process (a Worker isolate serves many requests off one `DyeService`). Doc at `getAllDyes()` says "(defensive copy)", which overstates what it does. Tests miss it because none mutate a returned element. Covered by test: no (see core-data-02).
```ts
getAllDyes(): Dye[] {
  this.ensureLoaded();
  return [...this.dyes];       // shallow: elements are shared DyeInternal refs
}
getDyeById(id: number): Dye | null {
  return this.dyesByIdMap.get(id) || null;   // same shared object
}
```
Fix direction: freeze each `DyeInternal` after `initialize()` (`Object.freeze`), or deep-clone in the public getters.

**core-data-02** — UNTESTED — `packages/core/src/services/dye/__tests__/DyeDatabase.test.ts:195-201`
The test named `'should return defensive copy'` only asserts `dyes1 !== dyes2` (different array instances) and `toEqual` (same contents) — it never mutates an element and checks isolation, so it cannot fail against core-data-01's actual hazard (shared element references). Covered by test: no — this is the gap.
```ts
it('should return defensive copy', () => {
  const dyes1 = database.getAllDyes();
  const dyes2 = database.getAllDyes();
  expect(dyes1).not.toBe(dyes2);   // array identity only
  expect(dyes1).toEqual(dyes2);    // value equality, not isolation
});
```

**core-data-03** — BUG — MEDIUM — `packages/core/src/services/localization/LocaleLoader.ts:49-70`, `LocaleRegistry.ts:64-66`
`loadLocale()` returns `localeMap[locale]` — the literal module-scope object produced by the static `import … with { type: 'json' }` — with no clone, and `LocaleRegistry.getLocale()` returns the same stored reference on every call (the sibling test at `LocaleRegistry.test.ts:254-258` explicitly asserts `firstRetrieval).toBe(secondRetrieval)`, i.e. same-object caching is the documented contract). Failing input: two independent `LocaleLoader` instances (the trio is designed for stateless per-request use by og-worker, per the package `CLAUDE.md`) both call `loadLocale('en')`; they get the *identical* object, since it's one static import. If any caller mutates a nested field (e.g. `data.labels.dye = 'x'`) — plausible for any code that "patches" a label or does an in-place transform before use — every other caller/request in that isolate silently sees the mutated value from then on, including unrelated locales' data untouched but `en` corrupted process-wide. Covered by test: no (existing tests assert the sharing as a *feature*, never guard against mutation).
```ts
loadLocale(locale: LocaleCode): LocaleData {
  const data = localeMap[locale];
  ...
  return data as LocaleData;   // the actual imported module object, no clone
}
```
Fix direction: freeze each locale object once at module load (`Object.freeze` — shallow is enough since `TranslationProvider` only reads).

**core-data-04** — LOW — doc/code mismatch — `packages/core/src/services/CharacterColorService.ts:49` vs `:327`
`CharacterMatchOptions.matchingMethod` JSDoc says "default: 'oklab'"; `findClosestDyes` actually defaults to `'ciede2000'` (`const { count = 3, matchingMethod = 'ciede2000' } = options;`). A consumer reading only the published-API doc would expect OKLAB ranking. Not a runtime bug (behavior is internally consistent, just documented wrong). Fix: update the JSDoc to `'ciede2000'`.

**core-data-05** — LOW — doc drift — `packages/core/src/services/PresetService.ts:16-19` vs `:262`
The file-header `@example` prints `rdm.dyes // [5738, 13115, 13117, 5729]` — itemID-shaped numbers — but `getPresetWithDyes` resolves preset dye arrays via `getByStainId` (stainID 1-125) per the inline comment "presets.json 2.0.0 stores stainIDs". The top-of-file example was not updated for the 5.0 stainID migration and would mislead an API consumer about the ID space `preset.dyes` actually holds. Fix: update the example values to plausible stainIDs.

## 3. POSITIVE

- `dyes.json` invariants hold exactly: 125 entries, `stainID` sequential/unique 1-125, 125/125 `hex` match `^#[0-9A-Fa-f]{6}$`, 105/125 carry a `consolidationType` of A/B/C (matches the documented "105 of 125" consolidation figure).
- `facewear_colors.json`'s 11 slugs (`silver, gold, black, white, grey, red, blue, green, brass, purple, brown`) are exactly the 11 keys of the frozen `LEGACY_FACEWEAR_ITEM_IDS` in `config/facewear.ts` — no drift between the live data and the frozen compatibility table.
- `getMarketItemID`/`CONSOLIDATED_IDS`/`isConsolidationActive` correctly gate on all-three-IDs-present and fall back to the dye's own `itemID` pre-patch or for uncategorized/Facewear dyes.
- `APIService`: every network call (`fetchWithTimeout`, `isAPIAvailable`) uses `AbortController` + `clearTimeout` in a `finally`; batch requests chunk at 100 and filter non-positive-integer IDs before building the URL (BUG-001/BUG-012 classes stay fixed).
- `TranslationProvider`: all eleven getters (not just `getLabel`) now guard with `Object.hasOwn` against prototype-key lookups (`'constructor'`/`'toString'`), matching the BUG-105 fix note.
- `HarmonySelector.generateHarmonySlots`: own-property `HARMONY_OFFSETS` check defeats the `'toString'`-is-truthy prototype trap; deviance scoring is single-unit (ΔE xor hue-degrees) across slot/pin/companion paths (BUG-064).
- `.chara` parser/resolver: race/tribe/gender maps use `Object.hasOwn` lookups (FINDING-027), the dark/light palette split fails loudly on the 96-127 gap rather than clamping, and eye-color key crossing (`REyeColor`↔left) matches the documented measured rule.

## 4. REJECTED

- `DyeDatabase.initialize()` duplicate-ID collision only `logger.error`s then still overwrites the map entry (doesn't throw) — looks like silent data loss, but this is the deliberate 2026-07-18-audit "fail loudly via log" behavior on a path that cannot trigger against the verified-unique 125-entry dataset; not re-filed.
- `HarmonyGenerator`'s `DEFAULT_HARMONY_DELTA_E` / `colorSpace` hue rotation looking "wrong" (doesn't preserve S/V) — confirmed by the file's own comment as intentionally-unreachable published-API-only code since PR #159; per Known Context, not re-filed.
- k-d tree `searchNearest`/`searchWithinDistance` far-side pruning uses `<=` at the splitting-plane boundary — checked by hand: inclusive equality only ever widens the recursion, never causes a missed closer candidate.
- `LocalizationService.currentLocale` singleton race — present, but this is the explicitly-named Known-Context item (BUG-006, "check for regression only"); the mitigating `ensureLocaleLoaded`/explicit-locale-getter path still exists and is correctly documented; no new regression found.
- `CharacterColorService.findClosestDyes` bounded top-k loop with `count <= 0` — re-checked BUG-056's fix (`if (count <= 0) return [];`) is present and correct.

## 5. COVERED

29 non-test source files read in full + 2 test files spot-checked + 2 data JSON files verified by full-file pattern grep.

Source: `services/dye/DyeDatabase.ts`, `DyeFilter.ts`, `DyeSearch.ts`, `HarmonyGenerator.ts`, `HarmonySelector.ts`, `utils/kd-tree.ts`, `services/chara/chara-models.ts`, `chara-parser.ts`, `chara-resolver.ts`, `services/APIService.ts`, `services/localization/LocaleLoader.ts`, `LocaleRegistry.ts`, `TranslationProvider.ts`, `services/LocalizationService.ts`, `services/CharacterColorService.ts`, `services/DyeService.ts`, `services/ColorService.ts`, `services/PaletteService.ts`, `services/PresetService.ts`, `config/consolidated-ids.ts`, `facewear.ts`, `band-vocabulary.ts`, `band-calibration.ts`, `dye-vocabulary.ts`, `learn-links.ts`, `product-links.ts`, `types/index.ts`, `index.ts`.
Data: `data/dyes.json` (grep-verified: stainID count/sequence, hex format, consolidationType count), `data/facewear_colors.json` (read in full).
Tests skimmed: `services/dye/__tests__/DyeDatabase.test.ts` (partial), `services/localization/__tests__/LocaleRegistry.test.ts` (partial).
Not read this pass (lower priority / not in changed-src list): `PresetService`/`DyeFilter`/`DyeSearch`/`HarmonyGenerator`/`HarmonySelector`/chara/`config/*` test files, `types/__tests__/*`, `LocaleLoader.test.ts`, `TranslationProvider*.test.ts`, `facewear-names.test.ts`.
