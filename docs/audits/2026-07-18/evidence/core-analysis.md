# Deep-Dive Code Analysis: @xivdyetools/core

**Date:** 2026-07-18
**Scope:** `packages/core/src/` (all non-test sources, ~10,650 LOC)
**Method:** Full read of every source file; every finding verified against exact lines. Domain facts (synthetic negative Facewear itemIDs, `itemID > 0` market filtering, Patch 7.5 consolidation, 6 locales) treated as intended behavior, not bugs.

---

## Prior findings status (2026-05-28 deep-dive)

### BUG-001 — APIService batch methods didn't chunk >100 items: **FIXED**

`fetchBatchPriceData` now chunks recursively before building URLs:

`packages/core/src/services/APIService.ts:646-660`
```ts
// BUG-001: Universalis caps batches at 100 items. buildBatchApiUrl throws for larger
// arrays, and the call below was outside the try/catch — uncaught on cold cache with
// the full dye set (125+ tradeable). Chunk here so callers never need to know the limit.
const CHUNK_SIZE = 100;
if (itemIDs.length > CHUNK_SIZE) {
  const merged = new Map<number, PriceData>();
  for (let offset = 0; offset < itemIDs.length; offset += CHUNK_SIZE) { ... }
  return merged;
}
```

The >100 uncaught-throw path is closed. **Residual gap:** `buildBatchApiUrl` can still throw for *invalid* (non-positive) IDs from outside the try/catch — see NEW finding CORE-2607-03 below.

### k-d tree (utils/kd-tree.ts) — verified CORRECT in prior audit: **UNCHANGED**

`git log --oneline --since=2026-05-28 -- packages/core/src/utils/kd-tree.ts` returns no commits. A skim of the current file confirms the previously-verified logic (index-based construction, CORE-BUG-003 far-side pruning with `<=`, exclude-aware null-best handling) is intact. Not re-audited; prior CORRECT verdict stands.

---

## New findings

### CORE-2607-01 — ColorManipulator mutates HSV objects returned by reference from LRU caches (cache poisoning)

- **Kind:** BUG
- **Severity:** HIGH
- **Location:** `packages/core/src/services/color/ColorManipulator.ts:20-24, 30-34, 40-45` (mutation); root cause `packages/core/src/services/color/ColorConverter.ts:401-404, 407-409` and `:285-288` (caches hand out live references)

**Description.** `ColorConverter.hexToHsv()` returns the *cached object itself*, and the same object instance is stored in **two** caches (`rgbToHsvCache` via `rgbToHsv`, then `hexToHsvCache`). `ColorManipulator.adjustBrightness/adjustSaturation/rotateHue` mutate that object in place:

```ts
// ColorManipulator.ts:20-24
static adjustBrightness(hex: string, amount: number): HexColor {
  const hsv = ColorConverter.hexToHsv(hex);
  hsv.v = clamp(hsv.v + amount, 0, 100);   // ← mutates the cached object
  return ColorConverter.hsvToHex(hsv.h, hsv.s, hsv.v);
}
```

```ts
// ColorConverter.ts:401-404 — returns cached reference, no copy
const cached = this.hexToHsvCache.get(cacheKey);
if (cached) {
  return cached;
}
// ColorConverter.ts:406-409 — same object also lives in rgbToHsvCache
const rgb = this.hexToRgb(hex);
const result = this.rgbToHsv(rgb.r, rgb.g, rgb.b);  // stored in rgbToHsvCache (line 287)
this.hexToHsvCache.set(cacheKey, result);            // same reference, second cache
```

After one `adjustBrightness('#336699', 20)` call, both `hexToHsv('#336699')` and `rgbToHsv(51, 102, 153)` permanently return the *brightened* HSV to every caller sharing the default singleton. The same class of hazard applies to every conversion cache (`hexToRgb`, `rgbToHsv`, `hsvToRgb`, `rgbToLab`, `rgbToOklab`, and `ColorblindnessSimulator.colorblindCache`): any consumer that mutates a returned `RGB`/`HSV`/`LAB` object poisons a process-wide cache. `DyeSearch`, `HarmonyGenerator`, the web app, and the SVG package all funnel through these singleton caches.

**Reproduction.**
```ts
ColorService.adjustBrightness('#336699', 20);
ColorService.hexToHsv('#336699');              // v is +20 off — wrong for every future caller
ColorService.adjustBrightness('#336699', 20);  // compounds: now effectively +40 (non-idempotent)
```

**Why it evades testing.** Unit tests call each manipulation once on fresh colors and assert the return value — which is correct. Corruption only shows when the *same hex* is later converted again in the same process (long-lived browser session, warm Worker isolate), and it manifests as subtly wrong downstream colors, not an exception.

**Suggested fix (short-term, safest):** return defensive copies on cache hits *and* on first computation in `hexToRgb`, `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `rgbToLab`, `rgbToOklab`, and `ColorblindnessSimulator.simulateColorblindness`:
```ts
if (cached) return { ...cached };
...
this.hexToHsvCache.set(cacheKey, result);
return { ...result };
```
Alternatively `Object.freeze()` cached values in dev builds to surface offenders, and fix `ColorManipulator` to build a new object (`const { h, s } = ...; return ColorConverter.hsvToHex(h, s, clamp(v + amount, 0, 100))`). Copy-on-return costs one small allocation per call — negligible against the conversion math it caches.

---

### CORE-2607-02 — APIService: cache-write failure discards successfully fetched price data

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `packages/core/src/services/APIService.ts:570` (single), `:992-998` (getPricesForItems), `:1051-1057` (getPricesForDataCenter); contrast with the get-side handling at `:413-425`

**Description.** ERROR-001 made cache **reads** failure-tolerant (`getCachedPrice` catches, logs, returns null). Cache **writes** got no such treatment:

1. `getPriceData` awaits `setCachedPrice` inside the main try block:
```ts
// APIService.ts:569-574
if (data) {
  await this.setCachedPrice(cacheKey, data);   // ← throws → catch at :575
}
resolvePromise!(data);
return data;
```
If the injected backend's `set()` throws (localStorage quota exceeded, KV write error — precisely the environments `ICacheBackend` exists for), the catch at `:575-584` logs "Failed to fetch price data" and resolves **null**, even though `data` was fetched successfully. The user sees "no price" because a *cache* failed.

2. Worse in the batch paths — one failed write rejects the whole call and throws away the entire fetched batch, and neither `getPricesForItems` nor `getPricesForDataCenter` has any try/catch, so the AppError propagates uncaught to the command handler:
```ts
// APIService.ts:992-998
const cacheWrites: Promise<void>[] = [];
for (const [itemID, priceData] of batchResults) {
  ...
  cacheWrites.push(this.setCachedPrice(cacheKey, priceData));
  results.set(itemID, priceData);
}
await Promise.all(cacheWrites);   // ← one rejection loses all results + throws to caller
```

**Reproduction.** Inject a backend whose `set` throws (or fill localStorage to quota in the web app), then call `getPriceData` / `getPricesForItems` for uncached items. Fetch succeeds; the method returns `null` / throws.

**Why it evades testing.** Test cache backends (`MemoryCacheBackend`, mocks) never fail on `set`. Quota/KV-write failures happen only in production under storage pressure.

**Suggested fix.** Make writes best-effort, symmetric with ERROR-001:
```ts
private async trySetCachedPrice(cacheKey: string, data: PriceData): Promise<void> {
  try { await this.setCachedPrice(cacheKey, data); }
  catch (e) {
    this.metrics.errors++;
    this.logger.error(`Cache write failed for ${cacheKey}: ${e instanceof Error ? e.message : e}`);
  }
}
```
Use it at `:570` and replace `Promise.all(cacheWrites)` with `Promise.allSettled` (or push `trySetCachedPrice` calls).

---

### CORE-2607-03 — fetchBatchPriceData: invalid-ID validation throw escapes the never-throw contract

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `packages/core/src/services/APIService.ts:667` (call outside try at `:669`); validation throws at `:896-904`; callers without catch at `:989`, `:1048`

**Description.** `fetchBatchPriceData` is written as a never-throw method — fetch/parse failures return an empty `Map` (`:683-688`), and BUG-001's chunking removed the >100 throw. But the URL builder is still invoked **before** the try block:

```ts
// APIService.ts:666-669
// Build batch API URL — safe: itemIDs.length ≤ 100 guaranteed above
const url = this.buildBatchApiUrl(itemIDs, dataCenterID);   // ← can still throw

try {
```
`buildBatchApiUrl` throws `AppError(INVALID_INPUT)` for any non-positive-integer ID (`:896-904`). So `getPricesForItems([...ids, -1477])` — a Facewear synthetic ID leaking past a missing `itemID > 0` filter, exactly the mistake already made once in the budget command (fixed at the *caller*) — produces an **uncaught AppError** from a code path that callers reasonably treat as non-throwing, instead of "no price for that item". The length ≤ 100 comment is accurate, but it is not the only reason `buildBatchApiUrl` throws.

**Reproduction.** `await apiService.getPricesForItems([5729, -1477])` with `-1477` uncached → throws `AppError: Invalid item IDs...` instead of returning prices for 5729.

**Why it evades testing.** Tests pass valid positive IDs; the cached path never reaches URL building; only a cold cache plus an unfiltered synthetic/zero ID triggers it.

**Suggested fix.** Defense-in-depth at the library layer — filter and warn before building the URL:
```ts
const validIDs = itemIDs.filter((id) => Number.isInteger(id) && id > 0);
if (validIDs.length < itemIDs.length) {
  this.logger.warn(`Skipping ${itemIDs.length - validIDs.length} invalid item IDs in batch fetch`);
}
if (validIDs.length === 0) return new Map();
```
(or simply move the `buildBatchApiUrl` call inside the try block).

---

### CORE-2607-04 — CharacterColorService lazy loaders cache a rejected import promise forever

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `packages/core/src/services/CharacterColorService.ts:174-184` (hair), `:196-206` (skin)

**Description.** The deduplicated lazy load resets the in-flight promise only on **success**:

```ts
// CharacterColorService.ts:174-184
if (!this.hairColorsLoading) {
  this.hairColorsLoading = import(
    '../data/character_colors/race_specific/hair_colors.json'
  ).then((module) => {
    this.hairColorsData = module.default;
    this.hairColorsLoading = null;
    return this.hairColorsData;
  });
  // no .catch — a rejected promise stays cached in hairColorsLoading
}
return this.hairColorsLoading;
```

If the dynamic import rejects once (transient chunk-load failure in the browser — a routinely observed failure mode for code-split JSON/JS after deploys or on flaky mobile networks), `hairColorsLoading` remains the rejected promise. Every subsequent `getHairColors()` / `preloadRaceData()` call re-awaits the same rejection: the feature is bricked until full page reload. Also, each unhandled re-await can surface as an unhandled rejection in callers that don't catch.

**Reproduction.** Simulate one failed `import()` (offline moment, stale chunk URL); retry `getHairColors('Midlander', 'Male')` after connectivity returns — it still rejects, forever.

**Why it evades testing.** In Vitest/Node the JSON import essentially cannot fail, so the error branch is never executed; the bug needs a *transient* failure followed by a retry.

**Suggested fix.**
```ts
this.hairColorsLoading = import('...json')
  .then((m) => { this.hairColorsData = m.default; return this.hairColorsData; })
  .catch((err) => { throw err; })
  .finally(() => { this.hairColorsLoading = null; });
```
(keep the fast-path `if (this.hairColorsData)` check; clearing in `finally` makes the next call retry the import). Same change for `loadSkinColors`.

---

### CORE-2607-05 — Global mutable locale on the LocalizationService singleton races across concurrent requests

- **Kind:** BUG (state management / concurrency)
- **Severity:** MEDIUM
- **Location:** `packages/core/src/services/LocalizationService.ts:170-175` (mutable `currentLocale` on static `defaultInstance`), `:207-229` (`setLocale` with an await point at `:216`); consumed via static API by `packages/core/src/services/DyeService.ts:364-386` (`searchByLocalizedName`), `:402-414`, `:425-437`, `:454-465`, `:480-483`

**Description.** The static `LocalizationService` API is a process-global mutable `currentLocale`. `DyeService`'s localized methods hard-code that singleton:

```ts
// DyeService.ts:364-366
searchByLocalizedName(query: string): Dye[] {
  if (!LocalizationService.isLocaleLoaded()) { ... }
  // ...
  const localizedName = LocalizationService.getDyeName(dye.itemID);  // :379 — global locale
```

In a Cloudflare Worker isolate serving concurrent requests (discord-worker handles many guilds/locales), the pattern `await LocalizationService.setLocale(userLocale); ... use localized getters` interleaves: request A sets `ja`, awaits something (the `setLocale` itself awaits at `:216`, plus any I/O between set and use), request B sets `de`, then A reads German names. There is no crash — just wrong-language output attributed to "flaky localization".

**Reproduction.** Two overlapping requests in one isolate: `setLocale('ja')` → (await) → `setLocale('de')` → A's `getDyeName(...)` returns German.

**Why it evades testing.** Unit tests are sequential; the race needs genuinely concurrent requests inside one warm isolate with *different* locales — invisible locally, intermittent in production.

**Suggested fix.** The stateless trio (`LocaleLoader`/`LocaleRegistry`/`TranslationProvider`, already exported for og-worker) is the right model. Concretely: add explicit-locale variants on `DyeService` (e.g., `searchByLocalizedName(query, locale?)`, `getLocalizedDyeById(id, locale?)`) that call `TranslationProvider.getDyeName(itemID, locale)` directly, and document the static `setLocale` API as unsafe for concurrent multi-locale servers. Effort MEDIUM; keeps backward compatibility.

---

### CORE-2607-06 — PaletteService.samplePixels: division by zero / no clamping of `maxSamples`

- **Kind:** BUG (boundary condition)
- **Severity:** LOW
- **Location:** `packages/core/src/services/PaletteService.ts:321-337` (sampler), contrast clamping of the other two options at `:356-371`

**Description.** `colorCount` and `maxIterations` are clamped with warnings, but `maxSamples` is validated nowhere:

```ts
// PaletteService.ts:331-334
for (let i = 0; i < maxSamples; i++) {
  const index = Math.round((i * (pixels.length - 1)) / (maxSamples - 1)); // ← ÷0 when maxSamples === 1
  samples.push(pixels[index]);
}
```

- `maxSamples: 1` with ≥2 pixels → `(0 * n) / 0 = NaN` → `pixels[NaN]` is `undefined` → `rgbDistance(undefined, …)` throws `TypeError: Cannot read properties of undefined (reading 'r')` deep inside k-means.
- `maxSamples: 0` or negative → the `pixels.length <= maxSamples` guard is false, loop body never runs → silently returns `[]` → `extractPalette` returns `[]` with no warning, masquerading as "no colors found".

**Reproduction.** `paletteService.extractPalette(pixels, { maxSamples: 1 })` on any image with ≥2 pixels.

**Why it evades testing.** Tests use the default (10 000) or realistic values; nothing exercises the degenerate option.

**Suggested fix.** Clamp like the siblings: `const maxSamples = Math.max(2, opts.maxSamples);` with the same INPUT-003-style warning, and/or special-case `maxSamples === 1` to `[pixels[0]]`.

---

### CORE-2607-07 — getNonMetallicDyes silently returns metallic dyes when no locale was ever loaded

- **Kind:** BUG (silent misbehavior)
- **Severity:** LOW
- **Location:** `packages/core/src/services/DyeService.ts:480-483`; `packages/core/src/services/localization/TranslationProvider.ts:232-242`

**Description.**
```ts
// DyeService.ts:480-483
getNonMetallicDyes(): Dye[] {
  const metallicIds = new Set(LocalizationService.getMetallicDyeIds());
  return this.getAllDyes().filter((dye) => !metallicIds.has(dye.itemID));
}
```
If `setLocale()` was never called, the registry is empty, `TranslationProvider.getMetallicDyeIds` returns `[]` (`:240-241` — English fallback also unloaded), and the method returns **all** dyes including metallics — with no warning and no error. The method's contract ("Excludes: Metallic Silver, Metallic Brass, etc.") silently fails based on unrelated initialization order. Note the metallic ID list is locale-independent data that happens to live in locale files — a coupling smell.

**Reproduction.** Fresh process: `new DyeService(dyeDatabase).getNonMetallicDyes()` without any `LocalizationService.setLocale()` → metallic dyes present in the result.

**Why it evades testing.** Test setups (and most apps) call `setLocale` early; only a consumer that never touches localization hits it.

**Suggested fix.** Either source metallic IDs from `colors_xiv.json` (`isMetallic` flag already exists on dyes — `filter((d) => !d.isMetallic)`), which removes the localization dependency entirely, or log a warning / lazily load `en` when the registry is empty.

---

### CORE-2607-08 — DefaultRateLimiter is not concurrency-safe (burst-through)

- **Kind:** BUG (race condition)
- **Severity:** LOW
- **Location:** `packages/core/src/services/APIService.ts:77-96`; usage at `:596-597`, `:663-664`

**Description.**
```ts
// APIService.ts:86-95
async waitIfNeeded(): Promise<void> {
  const timeSinceLastRequest = Date.now() - this.lastRequestTime;
  if (timeSinceLastRequest < this.minDelay) {
    await sleep(this.minDelay - timeSinceLastRequest);
  }
}
recordRequest(): void { this.lastRequestTime = Date.now(); }
```
N concurrent callers (e.g., several `getPriceData` calls for *different* items, which don't dedupe against each other) all read the same `lastRequestTime`, all compute the same sleep, and all fire simultaneously — the intended 200 ms spacing (`API_RATE_LIMIT_DELAY`) becomes a burst of N requests. There is no slot reservation between `waitIfNeeded()` and `recordRequest()`.

**Reproduction.** `await Promise.all([getPriceData(5729), getPriceData(5730), getPriceData(5731)])` on cold cache → three Universalis requests within the same millisecond.

**Why it evades testing.** Rate limiting is disabled/mocked in tests; the burst only matters against the real upstream and looks like occasional 429s.

**Suggested fix.** Reserve the slot atomically (synchronously) before sleeping:
```ts
private nextAvailable = 0;
async waitIfNeeded(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, this.nextAvailable);
  this.nextAvailable = slot + this.minDelay;   // reserve synchronously — no interleave possible
  if (slot > now) await sleep(slot - now);
}
```
(`recordRequest` becomes a no-op or is folded in.)

---

### CORE-2607-09 — findComplementaryPair never excludes the base dye (self-match on near-neutrals)

- **Kind:** BUG (logic edge case)
- **Severity:** LOW
- **Location:** `packages/core/src/services/dye/HarmonyGenerator.ts:85-110`; contrast `findHarmonyDyesByOffsets` seeding `usedDyeIds` with `baseDye.id` at `:328-331`

**Description.** Every offset-based harmony first resolves the base dye and excludes it from matches (`:331 const usedDyeIds = new Set<number>([baseDye.id])`). `findComplementaryPair` does neither — it inverts the hex and searches with no exclusions (`:94`, `:101 new Set()`, `:105`). For near-neutral inputs the RGB inverse of a mid-gray is essentially the same color (`invert('#808080') === '#7F7F7F'`), so the returned "complementary" dye is the very dye the input maps to.

**Reproduction.** `dyeService.findComplementaryPair('#7F7F80')` → returns the same gray dye that `findClosestDye('#7F7F80')` returns.

**Why it evades testing.** Harmony tests use saturated colors where the inverse is genuinely distant.

**Suggested fix.** Resolve the base dye first and exclude it, mirroring `findHarmonyDyesByOffsets`:
```ts
const baseDye = this.search.findClosestDye(hex);
const exclude = baseDye ? [baseDye.id] : [];
return this.findClosestNonFacewearDye(complementaryHex, exclude);
```
(and pass `new Set(exclude)` on the deltaE path).

---

### CORE-2607-10 — `sortByProperty` claims "undefined sorted to end" but treats undefined as equal

- **Kind:** BUG (doc/behavior mismatch)
- **Severity:** LOW
- **Location:** `packages/core/src/utils/index.ts:492-506`

**Description.** The JSDoc says "Handles undefined properties (sorted to end)" (`:492`), but the comparator returns `0` for any comparison involving `undefined` (`aVal < bVal` and `aVal > bVal` are both false), so undefined-valued items keep their original positions interleaved with the rest — not "at the end". `sortByProperty` is part of the exported public utils (`index.ts:116`).

**Suggested fix.** Either fix the doc, or implement the promise:
```ts
if (aVal === undefined) return bVal === undefined ? 0 : 1;
if (bVal === undefined) return -1;
```

---

### CORE-2607-11 — Perceptual matching correctness silently bounded by magic RGB candidate thresholds

- **Kind:** REFACTOR (correctness-adjacent magic values)
- **Severity:** MEDIUM
- **Location:** `packages/core/src/services/dye/DyeSearch.ts:205-209` (`rgbCandidateThreshold = 100`), `:344-347` (`Math.max(maxDistance * 2, 150)`)

**Description.** For all non-RGB matching methods, candidates come from a k-d tree range query with a hard-coded RGB radius, then are re-ranked perceptually:

```ts
// DyeSearch.ts:206-209
// 100 RGB units covers most cases where perceptual distance might differ from RGB
const rgbCandidateThreshold = 100;
```

Two issues: (a) the value `100` is an unnamed constant whose correctness claim ("covers most cases") is unverified and untested — a dye that is perceptually closest (e.g., under `oklch-weighted` with `kL: 0.5`, which deliberately tolerates large lightness/RGB gaps) but >100 RGB units away is unfindable, and the failure is silent (a *different* dye is returned, not an error); (b) the same concept appears with different values/formulas in two methods. In `findDyesWithinDistance` the mapping `maxDistance * 2` conflates RGB units with DeltaE units (CIE76 tolerances of ~40 map to 80 RGB — below the 150 floor, fine; but a caller passing large perceptual distances gets an RGB radius with no principled relationship).

**Benefits of fixing.** Correctness becomes auditable; per-method calibration becomes possible (the RGB radius needed to guarantee containment differs enormously between `cie76` and `oklab` scales).

**Suggested direction.** Extract named constants per method (`CANDIDATE_RADIUS_BY_METHOD`), add a fallback that widens the radius (or falls back to linear scan over the 125 non-Facewear dyes — trivially cheap) when the perceptual best sits at the candidate-set boundary. Effort: LOW-MEDIUM. Risk: LOW (n=125 makes even full linear scans cheap; behavior can only get more correct).

---

### CORE-2607-12 — Facewear synthetic ID hash is collision-prone with no collision detection

- **Kind:** REFACTOR (latent-bug hardening)
- **Severity:** LOW
- **Location:** `packages/core/src/services/dye/DyeDatabase.ts:252-260` (hash), `:324-331` (silent map overwrite)

**Description.** Synthetic IDs are `-(1000 + Σ charCode(name))` — a sum, so any two names with equal character-code sums (all anagrams, plus many non-anagrams) collide. Verified today: the 11 current Facewear names produce 11 unique IDs (`-1629 Silver, -1390 Gold, -1477 Black, -1513 White, -1407 Grey, -1283 Red, -1392 Blue, -1497 Green, -1507 Brass, -1632 Purple, -1520 Brown`) — but note `Gold (-1390)` and `Blue (-1392)` differ by 2; the space is dense. On collision, `dyesByIdMap.set(dye.id, dye)` (`:326`) silently overwrites the earlier dye — one Facewear entry becomes unreachable by ID with no error, and downstream `getDyeById` returns the wrong dye.

**Suggested fix.** Cheap insurance in `initialize()`: after assigning a synthetic ID, `if (this.dyesByIdMap.has(dye.id)) throw / logger.error(...)`. Or switch to a real string hash (djb2 already exists in `generateChecksum`). Effort: LOW. Risk: LOW — but note published synthetic IDs are quasi-API (consumers may persist them), so changing the hash function is a breaking change; collision *detection* is the non-breaking option.

---

### CORE-2607-13 — isValidDye repeats an 8-line `idForLog` derivation six times

- **Kind:** REFACTOR (duplication)
- **Severity:** LOW
- **Location:** `packages/core/src/services/dye/DyeDatabase.ts:114-119, 126-134, 152-159, 166-174, 188-196, 199-208`

**Description.** The identical nested-ternary block
```ts
const idForLog =
  typeof dye.id === 'number' ? String(dye.id)
  : typeof dye.itemID === 'number' ? String(dye.itemID)
  : String(dye.name ?? 'unknown');
```
appears six times (with one variant) inside a single 110-line validator, accounting for roughly 40% of its length.

**Benefits.** `isValidDye` shrinks to a readable checklist; future validations stop copy-pasting the block. **Effort:** LOW (extract `private dyeIdForLog(dye): string`, compute once at function top). **Risk:** minimal — log-string only.

---

### CORE-2607-14 — hex-normalization block duplicated three times in ColorConverter

- **Kind:** REFACTOR (duplication)
- **Severity:** LOW
- **Location:** `packages/core/src/services/color/ColorConverter.ts:150-158` and `:166-173` (twice within `hexToRgb` itself — once for the cache key, once again for parsing), `:390-398` (`hexToHsv`)

**Description.** The uppercase/strip-`#`/expand-shorthand sequence is written out three times; inside `hexToRgb` the *same string* is computed twice back-to-back (the second time without `.toUpperCase()`, relying on `parseInt` case-insensitivity — a needless asymmetry).

**Suggested fix.** `private static normalizeHexKey(hex: string): string` used for both the cache key and the parse source. **Effort:** LOW. **Risk:** none (pure refactor; also removes the double `split/map/join` allocation per uncached call).

---

### CORE-2607-15 — Static-wrapper API duplication across ColorConverter / LocalizationService / ColorService

- **Kind:** REFACTOR (architecture)
- **Severity:** LOW
- **Location:** `packages/core/src/services/color/ColorConverter.ts` (~40 `static X(){ return this.getDefault().X() }` pairs across 1,486 lines), `packages/core/src/services/LocalizationService.ts` (~20 pairs, 627 lines), `packages/core/src/services/ColorService.ts` (806 lines of pure re-delegation)

**Description.** Every conversion/localization method exists three times: instance method, static wrapper, and (for conversions) a `ColorService` facade wrapper. This triples the surface to keep in sync (the facade already drifted: `ColorService.getCacheStats()` return type at `ColorService.ts:68-75` omits `rgbToLab`/`rgbToOklab` counts that `ColorConverter.getCacheStats()` returns at `ColorConverter.ts:101-119` — the spread at `:78-81` includes them at runtime but the declared type hides them, so TS consumers can't see two of the caches). Every new method requires 3 hand-written copies; the singleton static tier is also what makes CORE-2607-01/05 process-global.

**Benefits.** Smaller API to audit; type drift like the `getCacheStats` omission becomes impossible. **Effort:** HIGH (public API, all consumers). **Risk:** MEDIUM — best scheduled with the next major; short-term, at least fix the `ColorService.getCacheStats` declared type.

---

### CORE-2607-16 — Batch price paths have no request deduplication (cold-cache stampede)

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `packages/core/src/services/APIService.ts:959-1001` (`getPricesForItems`), `:1013-1060` (`getPricesForDataCenter`); contrast single-item dedupe at `:529-550`

**Description.** `getPriceData` carefully deduplicates concurrent identical requests via `pendingRequests` (CORE-BUG-001/002 fixes). The batch methods have no equivalent: two users triggering `/budget` in the same Worker isolate within the same cold-cache window each run the full cache-check + `fetchBatchPriceData` for ~125 items — 2× (or N×) identical upstream batch requests, plus duplicated cache writes. The `pendingRequests` map is also unused by the batch path, so a batch fetch and a concurrent single-item `getPriceData` for the same item both hit the API.

**Expected improvement.** On cold cache with concurrent commands: N identical Universalis batch calls → 1. Also reduces 429 exposure combined with CORE-2607-08.

**Suggested direction.** Key an in-flight map by `sorted(uncachedItemIDs).join(',') + ':' + (dc ?? 'universal')` and share the promise; or route each chunk through a `getOrCompute` on the existing `AsyncLRUCache` (utils/index.ts:155-281 — already built for exactly this and currently unused by APIService). **Trade-off:** slightly more state; must ensure the map is cleaned on failure (mirror the CORE-BUG-002 pattern).

---

### CORE-2607-17 — retry() retries deterministic 4xx failures with full backoff

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `packages/core/src/utils/index.ts:848-875` (`retry` retries every error); `packages/core/src/services/APIService.ts:706-708` (HTTP status folded into a generic `Error`)

**Description.** `fetchWithTimeout` throws `new Error("HTTP 404: Not Found")` for any non-ok status, and `retry` retries all errors with exponential backoff (`:857-872`). A 400/404 from Universalis (bad DC name, delisted item) is deterministic — retrying it 3× adds `1000 + 2000 = 3000 ms` dead latency per item (`UNIVERSALIS_API_RETRY_*`, constants/index.ts:111-112) before failing identically, and triples pointless upstream load. Only 429/5xx/network/timeout are worth retrying.

**Expected improvement.** ~3 s latency removed per deterministic failure; fewer wasted upstream calls.

**Suggested fix.** Throw a typed error carrying `status` from `fetchWithTimeout`, and give `retry` an optional `shouldRetry?: (error) => boolean` (default: current behavior, preserving compatibility); APIService passes one that returns false for `status >= 400 && status < 500 && status !== 429`.

---

### CORE-2607-18 — CharacterColorService.findClosestDyes: per-call defensive copy + full sort for top-N

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `packages/core/src/services/CharacterColorService.ts:325-361` (`getAllDyes()` copy at `:336`, full sort at `:359`); same pattern `:374-399`

**Description.** Each call copies the entire dye array (`dyeService.getAllDyes()` is a defensive copy) and sorts all ~130 scored results to slice the top 3. Matching a whole 192-color swatch sheet (the Swatch Matcher use case) makes 192 calls → 192 array copies, 192 × ~130 distance objects, and 192 full sorts, plus repeated hex conversions of the same 125 dye colors per call (`calculateDistanceWithMethod` re-converts `dye.rgb → hex` every time at `:283`, though the LRU cache absorbs most of the cost after warm-up).

**Expected improvement.** Modest but real for sheet-level operations (roughly O(n log n) → O(n·k) per color and ~200 fewer allocations per call): single-pass top-k selection (k ≤ 3) and reuse of one dye list across a batch. **Trade-off:** slightly more code; current version is simpler and fine for one-off lookups. A `findClosestDyesBatch(colors[], …)` entry point would let callers amortize.

---

## Summary counts

| Kind | CRITICAL | HIGH | MEDIUM | LOW |
|------|----------|------|--------|-----|
| BUG | 0 | 1 | 4 | 5 |
| REFACTOR | 0 | 0 | 1 | 4 |
| OPT | 0 | 0 | 1 | 2 |

Prior BUG-001: **fixed** (with residual invalid-ID gap tracked as CORE-2607-03). k-d tree: **unchanged since prior CORRECT verdict**.
