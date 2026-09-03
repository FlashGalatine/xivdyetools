# review — core-data (`@xivdyetools/core`: dye · localization · chara · config · top-level services)

Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02` (origin/main e7ac4042).
Deploy unit: `@xivdyetools/core` — npm publish, consumed by every app. A defect here ships everywhere.

---

## 1. Map

| Module | Role | Notes |
|---|---|---|
| `services/dye/DyeDatabase.ts` (542) | Loader + derivation + indexes (id / stainID / hue bucket / k-d tree) | schema-v2 derivation happens here |
| `services/dye/DyeSearch.ts` (325) | name/category/filter search, `findClosestDye`, `findDyesWithinDistance` | k-d tree only for `rgb`; exact scan otherwise |
| `services/dye/DyeFilter.ts` (80) | `isDyeExcluded` / `filterDyes` / `hasActiveFilters` | pure, contract-tested against `dyes.json` |
| `services/dye/HarmonyGenerator.ts` (491) | complementary/analogous/triadic/square/tetradic/mono/split | hue-bucket + ΔE + oklch/lch/hsl rotation paths |
| `services/localization/LocaleLoader.ts` (97) | 6 static JSON imports + shape validation | no I/O |
| `services/localization/LocaleRegistry.ts` (89) | Map cache of `LocaleData` | |
| `services/localization/TranslationProvider.ts` (470) | 12 getters, locale → en → formatKey chain | consolidated-dye name fallback lives here |
| `services/LocalizationService.ts` (614) | facade + process singleton + `resolveLocaleFromPreference` | `setLocale` mutates shared state (documented) |
| `services/DyeService.ts` (327) | facade over DyeDatabase/DyeSearch/HarmonyGenerator + `searchByLocalizedName` | |
| `services/CharacterColorService.ts` (416) | 7 eager shared sheets + lazy hair/skin (16 tribes × 2 genders × 192) + top-k dye match | |
| `services/APIService.ts` (1062) | Universalis client: cache backend, rate limiter, retry, single + batch, in-flight coalescing | |
| `services/PaletteService.ts` (504) | K-means++ palette extraction + dye matching | |
| `services/PresetService.ts` (266) | 15 built-in palettes, stainID-keyed | |
| `services/chara/chara-parser.ts` (436) | `.chara` JSON → indices, floats, gear dyes, gear models, glasses | |
| `services/chara/chara-resolver.ts` (371) | index vs float arbitration, sheet resolution, lip blend | |
| `services/chara/chara-models.ts` (112) | ModelMain/ModelSub lane packing | |
| `config/consolidated-ids.ts` (127) | `CONSOLIDATED_IDS` A/B/C = 52254/52255/52256, `getMarketItemID` | |
| `config/facewear.ts` (45) | 11 facewear colours + frozen `LEGACY_FACEWEAR_ITEM_IDS` | |
| `config/dye-vocabulary.ts` (72) | 8 categories, 4 acquisitions, `ACQUISITION_META`, 16 metallic stainIDs | |
| `config/band-vocabulary.ts` (156) + `band-calibration.ts` (261) | calibrated tier cuts + the generator behind them | |
| `config/learn-links.ts` (210), `config/product-links.ts` (51) | `/manual` roster, Lodestone by region, social links | |

**Data verified against the loader (schema only, no bodies read):** `dyes.json` = 125 entries, every entry carries exactly the 7 v2 fields; stainID 1–125 unique; legacyItemID 5729–48227 unique, zero nulls; categories = exactly the 8 in `DYE_CATEGORIES`; acquisitions = exactly the 4 in `DYE_ACQUISITIONS`; consolidationType A=85 / B=9 / C=11 / null=20 (105 consolidated, matching the doc). `facewear_colors.json` = 11 `{id,name,hex}`; all 11 char-code sums reproduce `LEGACY_FACEWEAR_ITEM_IDS` exactly. `presets.json` v2.0.0 = 15 palettes, dye ids 1–113 (stainIDs). All 6 locales: 125 dyeNames keyed by legacy itemID, zero empty strings, identical key sets.

---

## 2. Candidates

### core-data-01 · BUG · **HIGH** · `packages/core/src/services/PaletteService.ts:456-463`
`extractAndMatchPalette` picks the match with `options.matchingMethod` but always reports `distance` as **RGB Euclidean**, so the number is in a different metric (and scale) from the one that chose it.

Failing input → wrong outcome: web-app Extractor, default settings. `extractor-tool.ts:2391` calls it with no `matchingMethod` (→ core default ΔE2000 picks the dye), then `extractor-tool.ts:2673` sets `deltaE: match.distance, matchingMethod: this.matchingMethod`. `result-card.ts:999` accepts `deltaE` verbatim when `matchingMethod === 'ciede2000'` (the default), prints `deltaE.toFixed(2)` and colours the badge with `classifyBandTier(v,'ciede2000','match')` whose cuts are 5/10/20. An RGB distance of ~25 for a pair whose true ΔE2000 is ~3 prints "25.00" in the worst tier colour. Every palette card is affected.

Why tests miss it: `PaletteService.test.ts` asserts `distance` is a number ≥ 0 and that ordering is by dominance; nothing asserts the metric matches `matchingMethod`. The discord card sidesteps it by recomputing (`extractor.ts:557 deltaE: ColorService.getDistanceForMethod(...)`) — which is itself evidence that the field is not trusted.

Covered by test: **no**.

```ts
const matchedDye = dyeService.findClosestDye(
  hex,
  options.matchingMethod ? { matchingMethod: options.matchingMethod } : undefined,
);
if (matchedDye) {
  // Calculate distance between extracted and matched colors
  const distance = rgbDistance(ex.color, matchedDye.rgb);   // ← always RGB
```

Fix: compute `distance` with the same method (`ColorService.getDistanceForMethod(hex, matchedDye.hex, options.matchingMethod ?? DEFAULT_MATCHING_METHOD)`); have web-app pass its `matchingMethod` through.

---

### core-data-02 · BUG · MEDIUM · `packages/core/src/services/CharacterColorService.ts:343-346`
`findClosestDyes` throws `TypeError` instead of returning `[]` when `count <= 0`.

Failing input → wrong outcome: `findClosestDyes(color, dyeService, { count: 0 })` — first iteration takes the `else if` branch and dereferences `best[-1]` → *"Cannot read properties of undefined (reading 'distance')"*. Reachable in-repo: `swatch-tool.ts:2795` passes `this.maxResults`, seeded at `:314` from `StorageService.getItem<number>(STORAGE_KEYS.maxResults) ?? DEFAULTS.matchCount` — `??` does not catch a stored `0` or a negative, and `StorageService.getItem` (`storage-service.ts:65-89`) JSON-parses without validation. A corrupted/tampered `v3_character_max_results` crashes the Swatch Matcher. (The share-link path *is* guarded: `swatch-tool.ts:3006` checks `> 0 && <= 20`.)

Why tests miss it: `CharacterColorService.test.ts` only ever passes `count: 2/3/5`.

Covered by test: **no**.

```ts
if (best.length < count) {
  best.push({ dye, distance });
  best.sort((a, b) => a.distance - b.distance);
} else if (distance < best[best.length - 1].distance) {   // best[-1] when count <= 0
```

Fix: clamp at entry (`const k = Math.max(0, Math.floor(count)); if (k === 0) return [];`).

---

### core-data-03 · BUG · MEDIUM · `packages/core/src/services/APIService.ts:1021-1028`
`isAPIAvailable()` calls `fetchClient.fetch()` with **no timeout and no AbortSignal** — the only fetch in the file that skips `fetchWithTimeout`.

Failing input → wrong outcome: a hung Universalis/proxy connection leaves the promise pending indefinitely. `getAPIStatus()` (`:1033`) awaits it, and `apps/web-app/src/services/index.ts:142` awaits `getAPIStatus()` during service init — a stalled connection stalls that step with no upper bound. Every other request path is bounded by `UNIVERSALIS_API_TIMEOUT`.

Why tests miss it: the two `isAPIAvailable` tests (`APIService.test.ts:1114`, `:1124`) mock a fetch that resolves immediately; no test drives a never-settling fetch.

Covered by test: **no**.

```ts
async isAPIAvailable(): Promise<boolean> {
  try {
    const response = await this.fetchClient.fetch(`${this.baseUrl}/data-centers`);
    return response.ok;
  } catch { return false; }
}
```

Fix: route it through `fetchWithTimeout`, or pass `{ signal: AbortSignal.timeout(UNIVERSALIS_API_TIMEOUT) }`.

---

### core-data-04 · BUG · MEDIUM · `packages/core/src/services/LocalizationService.ts:569-571`
`preloadLocales()` is implemented with `setLocale`, so "preload" silently **changes the active locale** to the last entry of the array.

Failing input → wrong outcome: `service.setLocale('ja'); await service.preloadLocales(['en','de','fr']);` leaves `getCurrentLocale() === 'fr'`; every subsequent implicit-locale getter (`getLabel(key)`, `getDyeName(id)`, …) then answers in French. The race-safe primitive `ensureLocaleLoaded` (`:244`) exists precisely for this and is not used.

Why tests miss it: `LocalizationService.test.ts:620-627` calls `preloadLocales(['en','ja'])` and then immediately `setLocale(...)` before asserting — the side effect is overwritten before it is observed. `:711` asserts only `isLocaleLoaded()`.

Covered by test: **no**.

```ts
async preloadLocales(locales: LocaleCode[]): Promise<void> {
  await Promise.all(locales.map((locale) => this.setLocale(locale)));
}
```

Fix: `locales.map((l) => this.ensureLocaleLoaded(l))`.

---

### core-data-05 · BUG · MEDIUM · `packages/core/src/services/dye/HarmonyGenerator.ts:239-242` and `:434-437`
The ΔE dispatch in `HarmonyGenerator` is a two-way ternary, so `deltaEFormula: 'oklab'` **silently computes CIE76**.

Failing input → wrong outcome: `findTriadicDyes(hex, { algorithm:'deltaE', deltaEFormula:'oklab' })`. `DeltaEFormula` is `'cie76' | 'cie2000' | 'ciede2000' | 'oklab'` (`ColorConverter.ts:21`) and `ColorConverter.getDeltaE` handles all four (`:877-895`), but here anything that is not `'ciede2000'` after normalisation falls to `getDeltaE76`. The default tolerance also degrades: `options.deltaETolerance ?? (formula === 'ciede2000' ? 25 : 40)` gives 40, which on the real ΔE-OK scale (0–1) would accept the whole database — so the bug is currently masked by a second bug of the same shape. Today's only caller passes `'cie2000'` (`bot-logic/src/commands/harmony.ts:184`), so this is latent, not live — but it is exactly the ΔE-alias trap the checklist names, and `deltaEFormula` is a public option.

Why tests miss it: `HarmonyGenerator.test.ts` exercises only the default and `cie2000`.

Covered by test: **no**.

```ts
const deltaE =
  formula === 'ciede2000'
    ? ColorConverter.getDeltaE2000(targetLab, dyeLab)
    : ColorConverter.getDeltaE76(targetLab, dyeLab);   // 'oklab' lands here
```

Fix: delegate to `ColorConverter.getDeltaE(hexA, hexB, formula)` (or add the `oklab` arm) and give `oklab` its own tolerance default.

---

### core-data-06 · BUG · LOW · `packages/core/src/services/localization/TranslationProvider.ts:137, 170, 203, 236, 269, 305, 338, 371, 402, 435`
FINDING-027 (own-property lookup) was applied to `getLabel` only (`:60-69`); the other ten getters still index the locale sub-objects directly, so a key that exists on `Object.prototype` resolves through the prototype chain.

Failing input → wrong outcome: `provider.getCategory('constructor', 'en')` returns `Object` (a **function**) where the signature promises `string`; a consumer doing `.toLowerCase()` or embedding it in a template gets a `TypeError` or `"function Object() { [native code] }"`. Only `getCategory` / `getAcquisition` / `getCurrency` take a bare `string`; I could not find a live caller that reaches them with unvalidated input (`discord-worker/src/handlers/commands/dye.ts:302` rejects any category that matches no dye before calling), so this is defence-in-depth, not a live hole — but it is the same class the audit already closed one door on.

Why tests miss it: `TranslationProvider.test.ts` tests only real vocabulary keys.

Covered by test: **no**.

```ts
if (localeData?.categories[category]) {     // vs getLabel's Object.hasOwn(...) guard
  return localeData.categories[category];
```

Fix: apply the `Object.hasOwn` guard uniformly (or build the tables with `Object.create(null)` at registration).

---

### core-data-07 · BUG · LOW · `packages/core/src/services/LocalizationService.ts:244-251` vs `:325-332`
`ensureLocaleLoaded()` never sets `isInitialized`, so the no-argument `isLocaleLoaded()` reports `false` forever in any consumer that uses only the race-safe path.

Failing input → wrong outcome: api-worker's middleware calls only `ensureLocaleLoaded` (`apps/api-worker/src/middleware/locale.ts:22`). `DyeService.searchByLocalizedName(query)` (`DyeService.ts:301-305`) guards on `LocalizationService.isLocaleLoaded(locale)`; called **without** an explicit locale it therefore always takes the "fallback to English-only" branch even though six locales are registered. api-worker's live caller does pass the locale (`routes/dyes.ts:68`), so the degradation is latent — but the guard is unsound for any consumer that omits it.

Related, same file: `extractLocaleCode`'s JSDoc (`:52`) claims `'zh-CN' → null (not supported)`; `zh` is in `SUPPORTED_LOCALES` so it returns `'zh'`.

Covered by test: **no** (`LocalizationService.explicit-locale.test.ts` covers the explicit-locale form only).

Fix: set `isInitialized` in `ensureLocaleLoaded`, or make the no-arg form mean "any locale registered" (`registry.size > 0`).

---

### core-data-08 · BUG · LOW · `packages/core/src/services/APIService.ts:815-835` + `:990-998`
`parseBatchApiResponse` accepts every `itemId` the upstream returns without checking it against the requested set, and `getPricesForDataCenter` then **caches** each of them.

Failing input → wrong outcome: a proxy/upstream response carrying `results: [{itemId: 9999, nq:{minListing:{dc:{price:1}}}}]` for a request that never asked for 9999 writes `9999:dc:Crystal → 1 gil` into the shared cache backend and returns it to the caller. `parseApiResponse` (single-item) does validate (`:764 result.itemId !== itemID → null`); the batch path is the asymmetry.

Why tests miss it: every batch fixture echoes exactly the requested ids.

Covered by test: **no**.

Fix: pass the requested-id `Set` into `parseBatchApiResponse` and skip unknown ids (log once).

---

### core-data-09 · BUG · LOW · `packages/core/src/services/chara/chara-parser.ts:202-209`
`parseFloatColor` claims to "throw loudly on a malformed value" but `Number('')` is `0`, so empty components parse silently.

Failing input → wrong outcome: `SkinColor: "0.5,,0.3"` yields `[0.5, 0, 0.3]` — a wrong-but-plausible colour, which the module docstring explicitly says is worse than a failure. `"1e999,0,0"` → `Infinity`, clamped to `1` → a white channel. Both bypass the `Number.isNaN` guard.

Why tests miss it: `chara-parser.test.ts:204` only tests `"red, green, blue"` (all-NaN).

Covered by test: **no**.

```ts
const parts = value.split(',').map((p) => Number(p.trim()));
if ((parts.length !== 3 && parts.length !== 4) || parts.some((n) => Number.isNaN(n))) { throw ... }
```

Fix: reject empty/blank components and require `Number.isFinite` on every part.

---

### core-data-10 · BUG · LOW · `packages/core/src/services/dye/DyeDatabase.ts:370-377`
A failed `initialize()` sets `isLoaded = false` on an instance that was already serving, permanently bricking it.

Failing input → wrong outcome: `db.initialize(goodData); db.initialize(null)` → the second call throws, and from then on every `getAllDyes()/getDyeById()/getDyesInternal()` throws `DATABASE_LOAD_FAILED` even though good data was loaded a moment earlier. All in-repo consumers initialise exactly once at module scope, so this is latent for the apps and live for library consumers who reload data. (The happy-path double-init *is* idempotent — `this.dyes` is reassigned and all four indexes are cleared and rebuilt at `:312-365`.)

Covered by test: **no** (`DyeDatabase.test.ts:912` tests the throw, not the surviving state).

Fix: build into locals and swap in only on success; leave `isLoaded` untouched on failure.

---

### core-data-11 · BUG · LOW · `packages/core/src/services/dye/DyeSearch.ts:311-313`
A negative `limit` silently trims the *farthest* matches instead of being ignored, and the two code paths disagree.

Failing input → wrong outcome: `findDyesWithinDistance('#FF0000', { maxDistance: 50, limit: -2 })` → `results.splice(-2)` drops the last two entries and returns `n-2` dyes; the same call with `matchingMethod:'rgb'` returns all `n` because that branch guards `resultLimit > 0` (`:274`). api-worker validates `limit` `min:1` (`routes/match.ts:88`), so this is a published-API defect only.

Covered by test: **no**.

Fix: `if (resultLimit && resultLimit > 0) results.length = Math.min(results.length, resultLimit);`

---

### core-data-12 · BUG · LOW · `packages/core/src/services/dye/DyeDatabase.ts:511-514`
`getDyesByHueBucket()` returns the **live internal array**, typed as `Dye[]`, while its sibling `getAllDyes()` (`:392`) returns a defensive copy and `getDyesInternal()` (`:538`) is `readonly` + `@internal`. A caller that sorts or splices the result corrupts the hue index for the process. `HarmonyGenerator.findClosestDyeByHue` (`:465`) only reads it, so nothing breaks today.

Covered by test: **no**.

Fix: return a copy, or mark it `readonly`/`@internal` like `getDyesInternal`.

---

### core-data-13 · BUG (doc) · LOW · three sites
Stale JSDoc that would mislead a caller into the wrong id space or the wrong default:
- `services/CharacterColorService.ts:48` — `matchingMethod` "*(default: 'oklab')*" but `:324` defaults to `'ciede2000'`.
- `services/PresetService.ts:148` — `rdm.dyes // [5738, 13115, 13117, 5729]` (legacy itemIDs) and a `'job-rdm'` preset that no longer exists; `presets.json` 2.0.0 stores **stainIDs** (verified: ids 1–113) and `:263` correctly resolves via `getByStainId`. This is the exact stainID-vs-itemID confusion the 5.0 register keeps warning about.
- `services/LocalizationService.ts:52` — `extractLocaleCode('zh-CN') // null (not supported)`; returns `'zh'`.

Covered by test: **no** (docs).

---

### core-data-14 · UNTESTED · `packages/core/src/services/dye/__tests__/DyeSearch.test.ts:422-426, 428-432, 439-442`
`expect(x).toBeDefined()` passes on `null`, and these methods return `Dye | null` — so three tests in the linear-search-fallback block cannot fail.

`:439-442` is fully vacuous: its only assertion is `expect(closest).toBeDefined()`, so "3-digit hex colours resolve in the linear scan" is asserted by nothing. `:422-426` and `:428-432` add `expect(closest?.id).not.toBe(5729)` / `expect(closest?.category).not.toBe('Facewear')`, both of which also pass when `closest` is `null` — so "excludeIds is honoured in the linear scan" and "Facewear is excluded in the linear scan" would both stay green if `findClosestDye` started returning `null` for every input.

Behaviour that should have been caught: a regression making the linear-scan fallback return `null` (e.g. the `try/catch` at `:231` swallowing a new throw from `calculateDistance`).

Fix: `expect(closest).not.toBeNull()` plus a positive assertion on the winner's name.

---

### core-data-15 · UNTESTED · `services/__tests__/APIService.test.ts:1437-1449`
The `getAPIStatus` catch block (`APIService.ts:1041-1043`, `latency: -1`) is unreachable in production because `isAPIAvailable` already has a catch-all. The only test that reaches it does so by `vi.spyOn(service,'isAPIAvailable').mockRejectedValue(...)` — it proves the dead branch works, not that anything can reach it. The test comment even says so ("To trigger the catch block ... we need isAPIAvailable to throw").

Fix: delete the branch (and the test), or drop the inner catch so a real failure surfaces the `-1`.

---

### core-data-16 · UNTESTED · `services/__tests__/LocalizationService.test.ts:716`, `services/__tests__/APIService.test.ts:290, 1506`
`expect(typeof X).toBe('function')` — three assertions that cannot fail while the symbol exists. Behaviour intended: that `LocalizationService.clear` actually clears, and that the injected fetch client is actually used.

---

### core-data-17 · REFACTOR · `packages/core/src/services/dye/DyeDatabase.ts:322-336`
The duplicate-ID guard's comment says "**Fail loudly**", but the code only `logger.error(...)` and then overwrites the map entry, making one dye permanently unreachable by id. With a NoOpLogger (the default) the collision is completely silent. Either throw, or reword the comment to "log and last-write-wins".

---

### core-data-18 · REFACTOR · `packages/core/src/services/CharacterColorService.ts:293` vs `packages/core/src/constants/index.ts:35`
The `'distinguish'` scaling constant is hard-coded as `/ 4.416729559` here while `DyeSearch.ts:65` derives the same value from `COLOR_DISTANCE_MAX`. Two spellings of one constant, one of them un-greppable — the second copy will not follow if the first ever changes.

---

### core-data-19 · OPT · `packages/core/src/services/CharacterColorService.ts:326`
`findClosestDyes` calls `dyeService.getAllDyes()` — a fresh 125-element defensive copy — on **every** invocation. `swatch-tool.ts` calls it per selected colour, and any "match a whole sheet" flow runs it 192 times (192 × 125 element copies, plus a `getAllDyes()` call again in `findDyesWithinDistance`). The OPT-015 comment above it already removed the per-dye match-object allocation; the array copy is what is left. Hoisting the dye list to a parameter (or using an internal read-only accessor) removes it.

---

### core-data-20 · OPT / LOW · locale vocabulary drift — `data/locales/*.json`
Every locale's `acquisitions` map carries `Crafting`, `Cosmic Fortunes`, `Facewear Collection` and its `categories` map carries `Facewear` — four keys that **no dye uses** under schema v2 (`dye-vocabulary.ts` closes the vocabulary at 4 acquisitions / 8 categories, and `config/__tests__/dye-vocabulary.test.ts` enforces that against `dyes.json`). 4 orphan keys × 6 locales = 24 dead translated strings shipped in every bundle. The contract test only checks the JSON→constants direction, never locale→constants.

---

## 3. POSITIVE — do not re-file

- **The frozen facewear map is genuinely frozen and genuinely tested.** `config/__tests__/facewear.test.ts:62-122` pins all 11 entries literally, asserts coverage in both directions, and has an explicit "never recompute from the formula" case. All 11 values reproduce `-(1000 + Σ charCode(name))` exactly.
- **Consolidation is applied where it belongs and nowhere else.** Every *price/market* site goes through `getMarketItemID` (`api-worker/lib/dye-serializer.ts:53`, `discord-worker/services/budget/budget-calculator.ts:168-169`, `web-app/services/market-board-service.ts:322`, `web-app/components/v4/result-card.ts:1156-1165`); every *display* site uses the original `dye.itemID` (all 15 `getLocalizedDyeName(dye.itemID, …)` call sites). `market-board-service.ts:344-357` correctly fans the 3 consolidated prices back out to the 105 original ids.
- **`Dye.itemID` really is always a number.** `DyeDatabase.initialize` derives it from `legacyItemID`, falling back to `stainID`; no `itemID == null` check survives anywhere in scope, and `getMarketItemID` uses `< 0`, not a null check.
- **Schema-v2 derivation is airtight.** Validation and derivation use the *same* anchored hex regex, so every surviving dye is guaranteed to carry `rgb`/`hsv`/`lab` — `dye.hsv.h` at `:345` and `dye.rgb.r` at `:355` cannot throw.
- **The k-d-tree/linear-scan divergence is guarded by a real parity test** (`services/__tests__/DyeSearch.parity.test.ts`), and `pointsWithinDistance` *does* sort by distance before `limit` is applied (`utils/kd-tree.ts:196`) — the "filter after limit" shape is not present here.
- **The BUG-013 lazy-load pattern is correct**: both `loadHairColors`/`loadSkinColors` null out the in-flight promise on rejection, so a failed import does not poison the isolate.
- **`DefaultRateLimiter` reserves its slot synchronously** (`APIService.ts:116-124`), so N concurrent callers space out rather than bursting — the BUG-046 fix has not regressed.
- **The chara resolver's loud-failure discipline is real**: 96-127 mid-range indices, missing tribe/gender, and out-of-sheet indices all produce a typed `error` verdict rather than a clamp, and each has a test.

---

## 4. REJECTED

- *`findDyesWithinDistance` rgb path returns unsorted results before `limit`* — `KDTree.pointsWithinDistance` sorts by distance at `utils/kd-tree.ts:196`.
- *`DyeDatabase.initialize` double-call leaves stale index entries* — all four indexes are `.clear()`ed and the k-d tree is rebuilt (`:312-365`); happy-path re-init is idempotent.
- *`getDyeById` returns `null` while callers filter `undefined`* — checked all 20 call sites; every one uses `?.`, `|| null`, `?? null`, or a truthiness test. No mismatch.
- *`getNonMetallicDyes` unsafe before a locale loads* — no such method exists anywhere in the repo.
- *`getCategories()` can emit `undefined`* — validation permits a missing `category`, but all 125 shipped dyes have one; only reachable from hand-built fixtures.
- *`EXPENSIVE_DYE_IDS` broken by consolidation* — Pure White (13114) and Jet Black (13115) are `consolidationType: null` (Venture Coffers), so `dye.itemID` still equals the literal ids the filter checks.
- *`safeClone` null-prototype dye objects break consumers* — real behavioural difference (`String(dye)` would throw), but I could find no consumer that stringifies or `instanceof`-checks a whole `Dye`. Latent only.
- *`buildApiUrl` ignores `worldID` so world-scoped prices silently degrade to region* — real, but explicitly documented as "reserved for future use" (`APIService.ts:855-856`) and there is no live caller: the only `getPriceData(itemID, worldID, …)` path is the web-app wrapper (`api-service-wrapper.ts:253`), which nothing calls.
- *`PaletteService.extractPalette` sorts on the rounded `dominance` integer rather than `pixelCount`* — ties only occur where the displayed percentages are genuinely equal; a stable sort keeps centroid order. Cosmetic at most.
- *`CRAFT_ACQUISITIONS` includes `'Venture Coffers'` (a drop, not a craft) and excludes `'Cosmic Exploration'`* — a labelling judgement, and `excludeCosmic` covers the gap; the contract test pins both lists against the data.
- *`getLodestoneLink` returns `undefined` for an unknown region* — typed `LodestoneRegion`, and its only caller (`discord-worker/handlers/commands/manual.ts:272`) passes a value already mapped through a closed table.
- *api-worker's locale middleware loads only the request locale, so the en fallback is unavailable* — true in principle, but all six locale files are complete (verified: zero empty strings, identical key sets), so no fallback ever fires.
- *`LEGACY_FACEWEAR_ITEM_IDS` is `Readonly<>` but not `Object.freeze`d* — compile-time only, but the literal-pinning test catches any source change; runtime mutation by a consumer is not a threat model here.
- *`getPricesForDataCenter` does not de-duplicate the incoming `itemIDs`* — a duplicate would ride the batch URL twice; every caller de-duplicates first (`market-board-service.ts:329` uses `Map.keys()`, `budget-calculator.ts:167` uses a `Set`).

---

## 5. COVERED — 33 files

**Scope, read in full (23):** `packages/core/src/` → `services/dye/DyeDatabase.ts`, `services/dye/DyeFilter.ts`, `services/dye/DyeSearch.ts`, `services/dye/HarmonyGenerator.ts`, `services/localization/LocaleLoader.ts`, `services/localization/LocaleRegistry.ts`, `services/localization/TranslationProvider.ts`, `services/chara/chara-models.ts`, `services/chara/chara-parser.ts`, `services/chara/chara-resolver.ts`, `config/band-calibration.ts`, `config/band-vocabulary.ts`, `config/consolidated-ids.ts`, `config/dye-vocabulary.ts`, `config/facewear.ts`, `config/learn-links.ts`, `config/product-links.ts`, `services/APIService.ts`, `services/CharacterColorService.ts`, `services/DyeService.ts`, `services/LocalizationService.ts`, `services/PaletteService.ts`, `services/PresetService.ts`.

**Supporting, read in part to confirm a claim (5):** `utils/kd-tree.ts`, `utils/index.ts` (`retry`/`sleep`/`generateChecksum`), `constants/index.ts`, `services/color/ColorConverter.ts` (`DeltaEFormula`, `normalizeDeltaEFormula`, `getDeltaE`, `hexToRgb`), `index.ts`.

**Data, schema/heads only (5 groups):** `data/dyes.json`, `data/facewear_colors.json`, `data/presets.json`, `data/locales/{en,ja,de,fr,ko,zh}.json`, `data/character_colors/{shared,race_specific}/*.json`.

**Tests skimmed (14):** `dye/__tests__/{DyeDatabase,DyeSearch,DyeFilter,DyeFilter.contract,HarmonyGenerator}.test.ts`, `localization/__tests__/{LocaleLoader,LocaleRegistry,TranslationProvider}.test.ts`, `chara/__tests__/{chara-parser,chara-resolver}.test.ts`, `config/__tests__/{facewear,dye-vocabulary,learn-links}.test.ts`, `services/__tests__/{APIService,CharacterColorService,LocalizationService,PaletteService,PresetService,DyeService,DyeSearch.parity}.test.ts`.

**Cross-unit files opened only to confirm reachability (not reviewed):** `web-app/{services/market-board-service.ts, services/api-service-wrapper.ts, services/storage-service.ts, services/language-service.ts, services/index.ts, components/extractor-tool.ts, components/swatch-tool.ts, components/v4/result-card.ts}`, `discord-worker/{handlers/commands/extractor.ts, handlers/commands/dye.ts, commands/localize.ts, services/budget/budget-calculator.ts}`, `api-worker/{middleware/locale.ts, routes/match.ts, routes/dyes.ts, index.ts, lib/dye-serializer.ts}`, `bot-logic/src/commands/harmony.ts`.
