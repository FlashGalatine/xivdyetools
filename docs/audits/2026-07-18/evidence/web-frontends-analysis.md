# Web Frontends Deep-Dive Analysis — web-app & maintainer

- **Date:** 2026-07-18
- **Scope:** `apps/web-app` (Vite + Lit + Tailwind, 9 tools) and `apps/maintainer` (Vue 3, light pass)
- **Method:** Read-only source analysis. Every finding verified against actual code with file:line citations. Dead-code findings excluded (covered by the DEAD-XXX registry).
- **Domain facts assumed (not bugs):** `Dye.itemID` is always a number; Facewear entries use synthetic negative itemIDs; market filtering uses `itemID > 0`; Patch 7.5 consolidation maps 105 dyes to itemIDs 52254/52255/52256 via `getMarketItemID()`.

---

## Findings Index

| # | Kind | Severity | Title |
|---|------|----------|-------|
| F-01 | BUG | HIGH | Budget & Swatch tools key prices by consolidated market itemID but look up by original dye itemID |
| F-02 | BUG | MEDIUM | Server change does not invalidate in-flight price fetch (stale-cache repopulation race) |
| F-03 | BUG | MEDIUM | `loadToolContent` race on rapid navigation leaks orphaned tool instances |
| F-04 | BUG | MEDIUM | LanguageService English fallback never loads for non-English users |
| F-05 | BUG | MEDIUM | Comparison tool persisted-dye restore filters `undefined` but `getDyeById` returns `null` |
| F-06 | BUG | MEDIUM | Changelog modal misrenders when `APP_VERSION` is missing from CHANGELOG-laymans.md |
| F-07 | BUG | LOW | StorageService falsy-default handling drops legitimate `0`/`''`/`false` values |
| F-08 | BUG | LOW | Welcome modal contradicts "shows only once" and permanently suppresses the changelog auto-popup |
| F-09 | BUG | LOW | Tutorial prompt can fire for the previous tool after navigating away |
| F-10 | BUG | LOW | SecureStorage size-index mutex is bypassed by two of three writers (BUG-007 fix incomplete) |
| F-11 | BUG | LOW | DyeSearchBox renders "All" category button as active even when a category filter is set |
| F-12 | BUG | LOW | maintainer: `stripDyePrefix` full-width-colon handling is a no-op |
| F-13 | REFACTOR | HIGH | Nine tool components duplicate the same lifecycle/pricing/panel scaffolding |
| F-14 | REFACTOR | MEDIUM | `fetchPricesForDyes` return-value contract invites mis-keyed lookups (root cause of F-01) |
| F-15 | REFACTOR | LOW | ConfigController valid-key list duplicated three times |
| F-16 | OPT | MEDIUM | `StorageService.isAvailable()` performs a localStorage write probe on every access |
| F-17 | OPT | MEDIUM | Palette extraction runs K-means synchronously on the main thread (loading state never paints) |
| F-18 | OPT | MEDIUM | Extractor persists up to 2 MB image data-URL into localStorage, risking global quota exhaustion |
| F-19 | OPT | LOW | `priceData` getter clones the entire price Map on every access inside per-card loops |
| F-20 | OPT | LOW | DyeSearchBox search input has no debounce |
| F-21 | OPT | LOW | maintainer: XIVAPI locale fetches run sequentially (worst case 40 s) |

---

## F-01 — Budget & Swatch tools key prices by consolidated market itemID but look up by original dye itemID

- **Kind:** BUG
- **Severity:** HIGH
- **Location:**
  - `apps/web-app/src/services/market-board-service.ts:327-376` (return value)
  - `apps/web-app/src/components/budget-tool.ts:1589-1595` (write), `1253`, `1399`, `1490-1497` (reads)
  - `apps/web-app/src/components/swatch-tool.ts:2296-2299` (write), `1809` (read)

**Description.** `MarketBoardService.fetchPricesForDyes()` deduplicates consolidated dyes to their market itemIDs before hitting Universalis, then fans results back out to the original dye itemIDs — but **only into its internal `this.priceData` cache**. The map it *returns* is `batchResults`, keyed by the deduplicated **market** itemIDs (52254/52255/52256 for the 105 consolidated dyes):

```ts
// market-board-service.ts:342-345, 355-361, 376
const batchResults = await this.apiService.getPricesForDataCenter(itemIDs, this.selectedServer);
...
for (const [marketId, priceData] of batchResults) {
  const originalIds = marketIdToOriginals.get(marketId) ?? [marketId];
  for (const originalId of originalIds) {
    this.priceData.set(originalId, priceData);   // fan-out happens HERE only
  }
}
...
return batchResults;                              // still keyed by market IDs
```

Budget tool copies the **returned** map into its private cache and then reads it with **original** dye itemIDs:

```ts
// budget-tool.ts:1589-1595
const prices = await this.marketBoard.fetchPricesForDyes(dyes, ...);
prices.forEach((data, itemId) => {
  this.priceData.set(itemId, data);   // keys are 52254/52255/52256 for 105 dyes
});

// budget-tool.ts:1490-1497
const targetPriceData = this.priceData.get(this.targetDye.itemID);  // original ID → miss
...
const priceData = this.priceData.get(dye.itemID);                    // original ID → miss
const price = this.getBudgetComparablePrice(dye, priceData);         // falls back to vendor cost / Infinity
```

Swatch tool has the identical pattern (`swatch-tool.ts:2296-2299` write, `1809` read: `this.priceData.get(match.dye.itemID)`).

Since Patch 7.5 consolidation is active, 105 of 125 standard dyes miss their market price in these two tools. Budget then substitutes vendor cost or `Infinity` (`getBudgetComparablePrice`, budget-tool.ts:1565-1576), so the affordability filter, savings figures, and value scores are computed from wrong prices for most dyes. Swatch cards silently show no market price for consolidated dyes.

Harmony/extractor/gradient/mixer are unaffected because their `priceData` is a getter delegating to `marketBoardService.getAllPrices()` (fanned-out cache) — e.g. `harmony-tool.ts:140`, `extractor-tool.ts:113-115`. `preset-detail.ts` also copies the mis-keyed return (`:524-529`) but is rescued by its `prices-updated` event subscription (`:455-464`), which carries the fanned-out cache.

**Reproduction.** Enable Market Board prices, open Budget tool, pick any consolidated dye (e.g. Wine Red) as target with a budget: the target's "market price" falls back to vendor cost; alternatives that are consolidated show vendor-cost or drop out with `Infinity`. Only the ~20 unconsolidated dyes (Pure White, Jet Black, Special dyes, etc.) show real market prices.

**Why it evades testing.** Unit tests mock `fetchPricesForDyes` and typically return maps keyed by the same dye IDs passed in; the mis-keying only appears when `getMarketItemID()` actually collapses IDs — i.e. with the real consolidation table active — and the symptom is "vendor fallback price shown", which looks plausible on screen.

**Suggested fix.** Preferred: change `fetchPricesForDyes` to build and return a fanned-out map (`originalId → PriceData`) — the same loop at `:356-361` can populate a `result` map alongside the service cache; also makes `fetchedCount` in the `prices-updated`/`fetch-completed` events (`:368-374`) mean "dyes" rather than "market IDs". Minimal alternative: change budget/swatch to read via `this.marketBoardService.getPriceForDye(dye.itemID)` or `getAllPrices()` like the other four tools and stop copying the return value. See F-14.

---

## F-02 — Server change does not invalidate in-flight price fetch (stale-cache repopulation race)

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/services/market-board-service.ts:165-192` (config subscription), `:304-390` (`fetchPricesForDyes`)

**Description.** The service's request-versioning only bumps `requestVersion` when a **new fetch starts** (`:310-311`). The server-change subscription clears the cache but does not bump the version:

```ts
// market-board-service.ts:169-181
if (serverChanged) {
  const previousServer = this.selectedServer;
  this.selectedServer = config.selectedServer;
  this.priceData.clear();                       // ← cache cleared…
  this.emitEvent('server-changed', {...});      // ← …but requestVersion NOT incremented
}
```

If a fetch for the old server is in flight when the user switches servers, and no tool immediately issues a new fetch (e.g. the active tool has no results displayed, or its re-fetch is gated behind `showPrices`/`matchedDyes` checks like `swatch-tool.ts:470-473`), the in-flight response still passes the `requestVersion === this.requestVersion` check at `:348` and writes **old-server prices** into the just-cleared cache (`:356-361`), then emits `prices-updated`. Every consumer now renders prices labeled with the new server name (`getWorldNameForPrice` falls back to `this.selectedServer`, `:267-272`) but priced from the old server.

Secondary issue in the same function: the `total === 0` early return (`:317-320`) and the stale-response returns (`:348-353`, error path `:379`) never reset `this.isFetching`, so `getIsFetching()` (`:215-217`) can be stuck `true` forever after a superseding call had nothing to fetch. Currently no component consumes `getIsFetching()`, so this is latent.

**Reproduction.** Throttle network; open Comparison with 4 dyes and prices on (fetch starts); immediately switch server in ConfigSidebar; the comparison tool's own re-fetch races — if the old fetch resolves after the config event but before/without a new fetch being versioned first, old prices land in the cache attributed to the new server.

**Why it evades testing.** Requires a slow in-flight request crossing a config change; unit tests resolve mocks instantly and E2E rarely switches servers mid-fetch.

**Suggested fix.** In the `serverChanged` branch, also do `this.requestVersion++` (and reset `this.isFetching = false`). Move the `isFetching = false` reset into a `finally` keyed to "am I the newest request".

---

## F-03 — `loadToolContent` race on rapid navigation leaks orphaned tool instances

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/components/v4-layout.ts:266-272` (subscription), `:310-478` (`loadToolContent`)

**Description.** Route changes call `void loadToolContent(state.toolId)` with no serialization or cancellation token:

```ts
// v4-layout.ts:266-272
RouterService.subscribe((state) => {
  ...
  void loadToolContent(state.toolId);   // fire-and-forget, unserialized
});
```

`loadToolContent` destroys the current tool and clears the container **before** its `await import(...)` (`:319-335`), then instantiates and appends **after** the import resolves (`:352-459`). Two overlapping invocations interleave:

1. Nav A (harmony): destroys old tool, clears container, awaits `import('@components/harmony-tool')` (slow first load).
2. Nav B (budget): `activeTool` is already `null`, clears container, awaits its own import.
3. A's import resolves: sets `activeTool = new HarmonyTool(...)`, `init()`, clears container, appends harmony.
4. B's import resolves: sets `activeTool = new BudgetTool(...)` **without destroying A's instance** (B captured the cleanup phase in step 2), clears container, appends budget.

A's `HarmonyTool` instance is orphaned: never `destroy()`ed, so its `LanguageService`/`ConfigController`/`RouterService` subscriptions (`harmony-tool.ts:299-382`) stay live for the page lifetime — every subsequent language or config change re-runs `generateHarmonies()` on a detached DOM tree (wasted work, duplicate price fetches). If the imports resolve in the opposite order, the finally-rendered tool can also mismatch the current route until the next navigation.

**Reproduction.** Cold cache + slow network (or CPU-throttled dev tools): click two different tools in the tool banner within ~1 s on first visit. Watch duplicate `[V4 Layout] ... tool loaded` logs and config-change side effects firing twice afterwards.

**Why it evades testing.** After the first visit each dynamic import is cached and resolves in a microtask, making the window practically unhittable in tests; only first-load slow-network users hit it.

**Suggested fix.** Add a module-level `navigationSeq` counter: capture `const seq = ++navigationSeq` at entry; after each `await`, bail out if `seq !== navigationSeq` (destroying any instance just created). Alternatively serialize through a promise chain (`pending = pending.then(() => load(...))`).

---

## F-04 — LanguageService English fallback never loads for non-English users

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/services/language-service.ts:159-178` (`t()`), `:311-331` (`loadWebAppTranslations`), `:356-362` (`preloadLocales`, uncalled)

**Description.** `t()` is designed to fall back to English for keys missing from the active locale:

```ts
// language-service.ts:160-169
const translations = webAppTranslations.get(this.currentLocale);
const englishTranslations = webAppTranslations.get('en');
let value = this.getNestedValue(translations, key);
if (value === undefined && this.currentLocale !== 'en') {
  value = this.getNestedValue(englishTranslations, key);   // ← 'en' map is never loaded
}
```

But `en` is only ever inserted into `webAppTranslations` when (a) the current locale *is* `en`, or (b) the current locale's file **failed to load** (`:320-329`). For a Japanese/German/etc. user whose locale file loads fine, `webAppTranslations.get('en')` is `undefined`, so any key that exists in `en.json` but not yet in `ja.json` renders as the raw dot-path key (`return key`, `:172-175`) instead of the English string. `preloadLocales` exists (`:356`) but has no callers in `src/` (verified by grep).

**Reproduction.** Set locale to `ja`, add a new UI string translated only in `en.json` (the normal state right after adding a feature): the UI shows `tools.newthing.title` literally instead of the English text.

**Why it evades testing.** Tests and dev usage run in `en`, where the fallback path is unreachable; i18n validation (`validate:i18n`) checks file completeness at release time, masking the mid-development window — but any locale gap that slips through ships raw keys instead of English.

**Suggested fix.** In `setLocale` (`:106-108`), when `locale !== 'en'`, also ensure `en` is loaded: `if (!webAppTranslations.has('en')) await this.loadWebAppTranslations('en');` (or call `preloadLocales(['en'])` from `initialize`). Cost: one extra lazy JSON chunk for non-en users.

---

## F-05 — Comparison tool persisted-dye restore filters `undefined` but `getDyeById` returns `null`

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/components/comparison-tool.ts:249-272` (`loadPersistedDyes`, esp. `:253-255`); contract at `packages/core/src/services/DyeService.ts:103-105`

**Description.**

```ts
// comparison-tool.ts:253-255
const dyes = savedIds
  .map((id) => dyeService.getDyeById(id))
  .filter((d): d is Dye => d !== undefined);   // ← getDyeById returns Dye | null
```

`DyeService.getDyeById` returns `Dye | null` (`DyeService.ts:103`, backed by `dyesByIdMap.get(id) || null`). `null !== undefined` is `true`, so stale IDs pass the filter as `null` values that the type predicate then blesses as `Dye`. The very next calls (`this.dyeSelector.setSelectedDyes(dyes)`, `this.calculateHSVValues()` at `:258-260`) dereference `.hex`/`.itemID` on `null` and throw, which the error boundary converts into the component-level error UI — the comparison tool becomes unusable until localStorage is cleared, on **every** load (the bad IDs stay persisted).

Contrast with the correct pattern elsewhere: `dye-palette-drawer.ts:779-781` filters `dye !== null`.

**Reproduction.** Persist a comparison containing a Facewear entry (synthetic itemID is a hash of the entry's *name characters*), then change the entry's name upstream in `colors_xiv.json` — the hash changes, the stored ID no longer resolves. Or simply hand-edit the stored `v3_comparison_dyes` array to include a retired ID.

**Why it evades testing.** Requires previously-persisted IDs that no longer resolve — a cross-version scenario no fresh-profile test reproduces; the dye DB is stable within any one test run.

**Suggested fix.** `filter((d): d is Dye => d !== null)` — and re-persist the cleaned list so bad IDs self-heal (`saveSelectedDyes()` after load).

---

## F-06 — Changelog modal misrenders when `APP_VERSION` is missing from CHANGELOG-laymans.md

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/components/changelog-modal.ts:83-102` (`getRelevantEntries`), `:182-217` (non-full render), `:203-212` (highlights line); parser at `apps/web-app/vite-plugin-changelog-parser.ts:82-133`

**Description.** The auto-popup path assumes the current version exists in the parsed changelog:

```ts
// changelog-modal.ts:89-101
const currentEntry = changelogEntries.find((e) => e.version === APP_VERSION);
const currentIndex = changelogEntries.findIndex((e) => e.version === APP_VERSION);
const previousEntries = changelogEntries.slice(currentIndex + 1, currentIndex + 3);
const entries: ChangelogEntry[] = [];
if (currentEntry) entries.push(currentEntry);
entries.push(...previousEntries);
```

If a release bumps `APP_VERSION` but the laymans changelog entry is missing or its header doesn't match the parser regex (`vite-plugin-changelog-parser.ts:88-89` — e.g. wrong dash character before the version, or a section-less entry dropped by the `sections.length > 0` guard at `:122`), then `currentIndex === -1` and `slice(0, 2)` returns the **two newest old releases**. The non-full renderer then presents `entries[0]` — an *old* release — as the current version **with no version heading** (`:184-188` renders sections only), and lists the second-newest as "Previous updates". The user is told the wrong release notes are "what's new". Additionally, `entry.highlights[0]` is interpolated unchecked at `:211` (`` ` — ${entry.highlights[0]}` ``); the parser can produce `sections.length > 0` with **empty** `highlights` (every `###` header shorter than 3 chars is skipped, `extractHighlights` at parser `:142-158`), rendering the literal string "— undefined".

Minor related note: the auto-popup (`showChangelogIfUpdated`, `:352-360`) and the header singleton (`showChangelogModal`, `:372-377`) are independent instances with independent `modalId` guards, so the full-history modal can stack on top of the auto-popup.

**Reproduction.** Bump `APP_VERSION` to 4.12.0 without adding a `## Web-App Version 4.12.0 — …` block (or typo the header, e.g. `Version 4.12` or a colon instead of a dash); returning users get the v4.11.0 notes presented unlabeled as the new release.

**Why it evades testing.** The changelog-modal unit tests mock `virtual:changelog` with entries that include the current version; the mismatch only occurs from a release-process slip, exactly when nobody is looking at the modal.

**Suggested fix.** In `getRelevantEntries`, when `currentEntry` is undefined, either return `[]` (fall through to the existing `changelog.noChanges` fallback at `:154-159`) or render entries with explicit version headings (reuse the `full` layout). Guard the highlights line: `entry.highlights[0] ?? entry.sections[0]?.header ?? ''`. Optionally add a CI assertion that `APP_VERSION` parses out of CHANGELOG-laymans.md.

---

## F-07 — StorageService falsy-default handling drops legitimate `0`/`''`/`false` values

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/web-app/src/services/storage-service.ts:38-62` (`getItem`: `return defaultValue || null` ×3), `:285-303` (`getItemWithTTL`: `return data.value || defaultValue || null`)

**Description.** All default returns use `||` instead of `??`:

```ts
// storage-service.ts:40-48
if (!this.isAvailable()) return defaultValue || null;   // getItem(k, false) → null, not false
...
// storage-service.ts:298
return data.value || defaultValue || null;              // stored 0 / '' / false → dropped
```

`getItem<T>(key, 0)`, `getItem(key, '')`, `getItem(key, false)` all return `null` instead of the given default; worse, `getItemWithTTL` discards a **stored** falsy value even when unexpired and returns the default instead. Current callers happen to survive (e.g. `WelcomeModal.shouldShow` at `welcome-modal.ts:110` treats `null` and `false` alike; `v4-layout.ts:71` patches over it with `?? false`), so this is a latent contract bug that will bite the next caller storing a counter, empty string, or boolean toggle via TTL.

**Why it evades testing.** Tests exercise truthy round-trips; falsy-value round-trips through the TTL path have no callers yet.

**Suggested fix.** Replace `defaultValue || null` with `defaultValue ?? null` throughout, and `data.value || defaultValue || null` with `data.value ?? defaultValue ?? null`.

---

## F-08 — Welcome modal contradicts "shows only once" and permanently suppresses the changelog auto-popup

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/web-app/src/components/welcome-modal.ts:104` (`dontShowAgain = false`), `:144-149` (`onClose`), `:116-120` (`markAsSeen`); interplay with `changelog-modal.ts:51-61` (`shouldShow`)

**Description.** The file header says "Shows only once unless reset by user" (`:5`), but `onClose` only marks the modal seen when `dontShowAgain` is true:

```ts
// welcome-modal.ts:144-149
onClose: () => {
  if (this.dontShowAgain) {
    WelcomeModal.markAsSeen();
  }
  ...
}
```

Closing via the X button, backdrop, or Escape (all enabled, `:141-143`) leaves `WELCOME_SEEN` unset, so the welcome modal reappears on **every** visit. Because `markAsSeen()` is also the only first-time writer of `LAST_VERSION_VIEWED` (`:119`), such users additionally never satisfy `ChangelogModal.shouldShow()` (`changelog-modal.ts:54-57` returns false when no last version) — the "What's New" auto-popup is permanently suppressed for them across all future updates, while paradoxically the welcome modal nags forever.

**Reproduction.** Fresh profile → welcome modal appears → press Escape → reload: welcome modal again. Deploy a new version: no changelog popup, welcome modal instead.

**Why it evades testing.** Tests close the modal through the buttons; humans routinely press Escape.

**Suggested fix.** Decide the intent and encode it: either always `markAsSeen()` in `onClose` (checkbox then only controls a hypothetical "show again" setting), or at minimum write `LAST_VERSION_VIEWED` unconditionally on close so the changelog logic has a baseline.

---

## F-09 — Tutorial prompt can fire for the previous tool after navigating away

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/web-app/src/components/v4-layout.ts:111-118` (`promptTutorialIfFirstVisit`), invoked at `:461-465`

**Description.**

```ts
// v4-layout.ts:112-117
markTutorialOffered(tool);
setTimeout(() => {
  TutorialService.promptStart(tool);
}, 800);
```

The 800 ms timer is raw (never stored/cleared) and captures the tool at schedule time. First-visit to Harmony followed by an immediate click to Budget within 800 ms pops the *Harmony* tutorial prompt while the Budget tool is on screen; accepting it spotlights selectors that don't exist in the current DOM. The pre-marking (`markTutorialOffered` before the delay) also burns the one-time offer even if the prompt is suppressed by the modal/tutorial-active checks inside the timeout window.

**Suggested fix.** Keep the timer id module-level, clear it at the top of `loadToolContent`; or re-validate `RouterService.getCurrentToolId()` inside the callback before prompting.

---

## F-10 — SecureStorage size-index mutex is bypassed by two of three writers (BUG-007 fix incomplete)

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/web-app/src/services/storage-service.ts:459-495` (mutexed `updateSizeIndex`), `:500-505` (`removeFromSizeIndex` — no mutex), `:608-651` (`enforceSizeLimit` — no mutex)

**Description.** BUG-007 introduced `sizeIndexMutex` so concurrent `setItem` calls serialize their index writes (`:488-495`). But `removeFromSizeIndex` (`:500-505`) and `enforceSizeLimit` (`:617-646`) load/mutate/save the same index synchronously outside the mutex. Interleaving: `setItem(A)` queues an index update on the mutex; before the microtask runs, `removeItem(A)` executes `removeFromSizeIndex(A)` synchronously; the queued closure then re-adds A's entry — the index now tracks a deleted key, permanently inflating `getCachedTotalSize()` and triggering premature LRU evictions at the 5 MB check (`:611-615`). Same lost-update shape between `enforceSizeLimit`'s deletes and queued updates.

**Why it evades testing.** Needs an interleaving of a queued mutex callback with a synchronous writer in the same tick — deterministic tests don't produce it, and the symptom (slightly-off size accounting) is invisible until eviction misbehaves.

**Suggested fix.** Route all three writers through the same mutex chain (make `removeFromSizeIndex` and the index mutation in `enforceSizeLimit` `.then()` continuations of `sizeIndexMutex`), or drop the async mutex entirely — every operation here is synchronous, so a plain synchronous read-modify-write discipline (no cached `this.sizeIndexCache` aliasing across await points) would suffice.

---

## F-11 — DyeSearchBox renders "All" category button as active even when a category filter is set

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/web-app/src/components/dye-search-box.ts:170`

**Description.**

```ts
// dye-search-box.ts:170
const isActive = cat === 'all' || cat === this.currentCategory;
```

The "All" chip is unconditionally styled active. When the component is constructed with `initialCategory` (restored filter state, `:33-37`), both "All" **and** the actual category render highlighted until the user clicks something (the click handler at `:248-279` fixes the visuals). Misleading filter state on restore.

**Suggested fix.** `const isActive = this.currentCategory === null ? cat === 'all' : cat === this.currentCategory;`

---

## F-12 — maintainer: `stripDyePrefix` full-width-colon handling is a no-op

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/maintainer/src/services/xivapiService.ts:79-104` (esp. `:81-84`, `:91-95`)

**Description.** Byte-level inspection confirms lines 81 and 94 contain **only ASCII** — there is no U+FF1A anywhere in the function:

```ts
// xivapiService.ts:81-84 — both branches return `prefix`; condition tests ':' twice
const prefixWithColon = prefix.endsWith(':') || prefix.endsWith(':')
  ? prefix
  : prefix

// xivapiService.ts:91-95 — the "full-width colon" variant is the same ASCII colon
const prefixVariants = [
  prefix,
  `${prefix}:`,
  `${prefix}:`, // full-width colon   ← comment lies; it's ASCII ':' again
]
```

The ternary is dead (`? prefix : prefix`), and the intended full-width-colon variant (`カララント：`) is never tried. If the `dyePrefixes.ja` config value omits the colon, Japanese names fetched from XIVAPI keep the `カララント：` prefix and get written into the locale JSON un-stripped. It currently works only if the configured prefix already includes the exact colon character.

**Why it evades testing.** No test/lint in maintainer (type-check only), and ASCII vs U+FF1A colons are visually identical in most editors.

**Suggested fix.** `const prefixVariants = [prefix, prefix + ':', prefix + '：'];` and delete the dead `prefixWithColon` ternary (fold its `startsWith` check into the variant loop).

(Prior known issue — XIVAPI fetches without timeout — is confirmed **fixed**: `fetchItemNames` uses `fetchWithTimeout(..., 10000)` at `xivapiService.ts:37-41`; `fetchWithTimeout` correctly aborts and clears its timer, `apps/maintainer/src/utils/fetchWithTimeout.ts:36-68`.)

---

## F-13 — Nine tool components duplicate the same lifecycle/pricing/panel scaffolding

- **Kind:** REFACTOR
- **Severity:** HIGH (maintenance priority)
- **Location:** `apps/web-app/src/components/{extractor,swatch,gradient,comparison,accessibility,budget,harmony,mixer}-tool.ts` (3555 / 2567 / 2519 / 2484 / 2448 / 2308 / 1888 / 1874 lines)

**Description.** Each BaseComponent tool re-implements, with drift, the same ~6 concerns:

1. **Subscription plumbing** — `languageUnsubscribe` / `configUnsubscribe` / `marketConfigUnsubscribe` fields + onMount subscribe + destroy cleanup, in six tools (`accessibility-tool.ts:225-298`, `comparison-tool.ts:157-284`, `budget-tool.ts:193-277`, `extractor-tool.ts:189-459`, `gradient-tool.ts:165-393`, `swatch-tool.ts:212-302`, `mixer-tool.ts:165-676`), while harmony alone uses the `subs` SubscriptionManager (`harmony-tool.ts:301-401`) that exists precisely for this (`shared/subscription-manager.ts`).
2. **Price wiring** — two divergent patterns: the getter-delegation pattern (`extractor-tool.ts:110-115`, `harmony-tool.ts:136-141`, `gradient-tool.ts:117-122`, `mixer-tool.ts:125-130`) vs the local-map-copy pattern (budget/swatch) that produced F-01.
3. **`fetchPrices*` + "update result cards with prices"** — near-identical methods per tool (`harmony-tool.ts:1644-1684`, `extractor-tool.ts:2858-2890` + `:2950-2970`, `swatch-tool.ts:2283-2303`, `budget-tool.ts:1581-1599`, etc.).
4. **v4-result-card construction loops** — the same `document.createElement('v4-result-card')`; set `data`; copy 7 `show*` display options; attach `context-action` listener block appears in at least extractor (`:2805-2849`), swatch (`:1805-1822`), budget (`:1249-1260`, `:1395-1410`), harmony, gradient, mixer.
5. **Market panel/drawer assembly** — `buildMarketPanel` exists (`extractor-tool.ts:29`) but drawer variants still hand-roll `new MarketBoard(...)` + `setupMarketBoardListeners` (`swatch-tool.ts:895-925`, `mixer-tool.ts:516`, `comparison-tool.ts:439`).
6. **Mobile drawer CollapsiblePanel stacks** — e.g. `budget-tool.ts:1605-1660` repeats the create-panel/init/setContent triple per section, mirrored in every tool's `renderDrawerContent`.

**Benefits.** One corrected implementation of price keying (F-01 class of bug becomes impossible), listener hygiene, and card rendering; each tool shrinks by an estimated 300-600 lines; new tools become mostly declarative.

**Effort/Risk.** Medium-high effort (touch all nine tools), but mechanical; risk contained by the existing per-tool unit tests + E2E. Recommended increments: (a) adopt `SubscriptionManager` everywhere; (b) extract a `PricedResultsMixin`/helper owning `fetchPrices` + card-price refresh on top of `MarketBoardService`; (c) extract a `renderResultCards(dyes, opts)` helper; (d) fold drawer panel assembly into `tool-panel-builders`.

---

## F-14 — `fetchPricesForDyes` return-value contract invites mis-keyed lookups

- **Kind:** REFACTOR
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/services/market-board-service.ts:296-390` (doc comment `:296-303` vs return `:376`)

**Description.** The method's doc says "`getMarketItemID` collapses consolidated dyes to the 3 shared market IDs **inside** `fetchPricesForDyes`" — implying callers are insulated from consolidation — yet the returned map re-exposes market IDs (see F-01). Seven call sites use the return value; five only read `.size` for logging (`harmony-tool.ts:1646-1652`, `extractor-tool.ts:2879-2880`, `gradient-tool.ts:2356`, `mixer-tool.ts:1863`, `comparison-tool.ts:239` ignores it), two consume the keys and are wrong (budget, swatch), one is redundantly double-fed (preset-detail `:524-531`).

**Benefits.** Returning the fanned-out per-dye map (or `Promise<void>` + relying solely on `getPriceForDye`/`prices-updated`) makes the API impossible to misuse and fixes F-01 at the source. **Effort:** small (build the result map in the existing fan-out loop). **Risk:** low — no current caller depends on market-ID keys; only log lines change meaning (`prices.size` becomes dye-count, arguably more accurate).

---

## F-15 — ConfigController valid-key list duplicated three times

- **Kind:** REFACTOR
- **Severity:** LOW
- **Location:** `apps/web-app/src/services/config-controller.ts:220-239` (`resetAllConfigs`), `:274-297` (`importConfigs`), `:302-318` (`isValidConfigKey`); also enumerated a fourth time in `getAllConfigs` `:244-259`

**Description.** The 12-key list (`'global'…'swatch'`) is copied in three methods plus the object literal in `getAllConfigs`. Adding a tenth tool requires four coordinated edits; missing one silently exempts the new tool from reset/import/validation (no compile error — `isValidConfigKey`'s array is `string[]`).

**Suggested fix.** `const CONFIG_KEYS = [...] as const satisfies readonly ConfigKey[];` at module scope; derive all four uses from it (and `getAllConfigs` via `Object.fromEntries(CONFIG_KEYS.map(k => [k, this.getConfig(k)]))`). Effort: trivial; risk: none.

---

## F-16 — `StorageService.isAvailable()` performs a localStorage write probe on every access

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/services/storage-service.ts:24-33`; called from every public method (`:40`, `:71`, `:100`, `:117`, `:134`, `:159`, `:187`, `:204`, `:229`, `:246`, `:520`…)

**Description.** Every `getItem`/`setItem`/`hasItem`/`removeItem`/`getKeys`/… first runs:

```ts
// storage-service.ts:24-33
static isAvailable(): boolean {
  const test = `${STORAGE_PREFIX}_test`;
  localStorage.setItem(test, 'test');   // synchronous disk-backed write
  localStorage.removeItem(test);        // + a second write
  ...
}
```

Two synchronous localStorage **writes** per read. localStorage writes are the slow path (synchronous, disk-backed, and they fire cross-tab `storage` events — n.b. `auth-service.ts:207` listens to `storage`, so every config read makes other tabs run that filter). Hot paths multiply this: `ConfigController.getConfig` on lazy loads, per-keystroke persistence, collection/favorite reads, tool init bursts (a single tool mount performs dozens of storage reads).

**Expected improvement.** Cache the probe: check once, memoize, and invalidate only on a caught quota/security error. Eliminates ~2 writes per storage access (hundreds per navigation) and the cross-tab event noise. **Trade-off:** a storage backend that *becomes* unavailable mid-session (private-mode quirks) would be detected on the next failed write instead of pre-flight — the existing try/catch paths already handle that.

---

## F-17 — Palette extraction runs K-means synchronously on the main thread (loading state never paints)

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/components/extractor-tool.ts:3085-3165` (`extractPalette`), `:3171-3200+` (`findColorPositions` full-image scan), auto-run on init at `:437-441` (`restoreSavedImage` → `void this.extractPalette()`)

**Description.** `extractPalette` is `async` but contains **no await**: it sets the button to "Extracting…" (`:3101-3105`) and then immediately runs `ctx.getImageData` over the full canvas (`:3109`), `PaletteService.pixelDataToRGBFiltered` (per-pixel array build), `extractAndMatchPalette` (K-means++ from `@xivdyetools/core`), and `findColorPositions` (another full-image scan, `:3171+`) — all synchronously. Consequences: (1) the "Extracting…" state and disabled button **never paint** — the browser has no chance to render between the DOM write and the blocking work; (2) on large images the tab freezes for the duration; (3) this also runs unprompted during tool init when a saved image is restored (`:441`), blocking first paint of the tool.

**Expected improvement.** Either yield before the heavy section (`await new Promise(r => requestAnimationFrame(() => r(null)))` — makes the loading state actually visible) as a 2-line stopgap, or move pixel filtering + K-means into a Web Worker (transfer the `ImageData` buffer) for a fully responsive UI. Downsampling the pixel array before K-means (sample every Nth pixel like `findColorPositions` already does at `:3183`) would cut the work by an order of magnitude with negligible palette quality loss.

**Trade-offs.** Worker adds a build artifact + message protocol; the rAF-yield stopgap keeps the freeze but restores feedback honesty.

---

## F-18 — Extractor persists up to 2 MB image data-URL into localStorage, risking global quota exhaustion

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/web-app/src/components/extractor-tool.ts:80-81` (limit), `:236-243` and `:1328-1334` (writes), `:365-368` (read)

**Description.** Images up to `MAX_IMAGE_STORAGE_SIZE = 2 * 1024 * 1024` **string characters** are stored as a base64 data-URL under `v3_matcher_image`. localStorage quota is ~5 MB and commonly accounted in UTF-16 code units — a 2 MB-char string can consume ~4 MB of the budget, i.e. up to ~80 % of the entire app's storage, shared with configs, collections, auth token, palettes, and the SecureStorage cache (whose own limit is 5 MB, `storage-service.ts:378`). When quota trips, every other `setItem` starts failing with only a `logger.warn` (`storage-service.ts:82-92`) — silently losing config/collection writes. The app already ships an IndexedDB wrapper (`services/indexeddb-service.ts`) used for price caching.

**Expected improvement.** Move image persistence to an IndexedDB store (Blob, not base64 — also ~33 % smaller). Frees the localStorage budget for the small structured data it suits, removes the quota failure mode, and drops a 2 MB synchronous string write from the image-load path.

**Trade-off.** IndexedDB restore is async — the init path at `:365-368` becomes `await`-based (it already tolerates async image decode via `img.onload`).

---

## F-19 — `priceData` getter clones the entire price Map on every access inside per-card loops

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/web-app/src/services/market-board-service.ts:222-224` (`getAllPrices` returns `new Map(...)`); getters at `extractor-tool.ts:113-115`, `harmony-tool.ts:136-141`, `gradient-tool.ts:117-122`, `mixer-tool.ts:125-130`; loop usages e.g. `extractor-tool.ts:2817-2818` (two getter hits per dye: `.has` then `.get`), `harmony-tool.ts:1663-1667` (per result card), `mixer-tool.ts:1637`, `gradient-tool.ts:1601`, `:2376`

**Description.** `getAllPrices()` defensively copies the full price map (136+ entries). Four tools expose it as a property getter, then call `this.priceData.get(...)` inside per-card render loops — e.g. `extractor-tool.ts:2817-2818` does `this.priceData.has(id)` **and** `this.priceData.get(id)`, i.e. two full map copies per dye per render. For 8-16 cards that's ~30 map allocations per price refresh, on every prices-updated/render cycle.

**Expected improvement.** Snapshot once per render (`const prices = this.priceData;` at the top of the loop) — one-line change per site — or add a `getPriceForDye()` pass-through (already exists on the service, `:259-261`) and use it directly. Micro-level win, but free and it removes GC churn during render bursts.

---

## F-20 — DyeSearchBox search input has no debounce

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/web-app/src/components/dye-search-box.ts:215-219`; consumers re-filter/re-render the grid per event (e.g. `dye-selector.ts`, `dye-grid.ts`)

**Description.**

```ts
// dye-search-box.ts:216-219
this.on(searchInput, 'input', () => {
  this.searchQuery = searchInput.value;
  this.emit('search-changed', this.searchQuery);
});
```

Every keystroke emits and triggers the parent's full filter + DOM rebuild of the dye grid (136 entries with swatches). Fast typers pay several full re-renders per word. Contrast: `v4/preset-tool.ts:635` already debounces its search via `_searchDebounce`.

**Expected improvement.** 120-150 ms debounce (using a `safeTimeout` so destroy clears it) reduces grid rebuilds ~5-10× while typing, imperceptible latency. **Trade-off:** none meaningful; keep the clear-button path immediate.

---

## F-21 — maintainer: XIVAPI locale fetches run sequentially (worst case 40 s)

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/maintainer/src/services/xivapiService.ts:34-68`

**Description.** `fetchItemNames` awaits each of the four locale requests (`en, ja, de, fr`) in a `for` loop, each with a 10 s timeout — a slow/unreachable XIVAPI stalls the form for up to 40 s, and even the happy path pays 4× RTT. The requests are independent.

**Expected improvement.** `Promise.allSettled(SUPPORTED_LANGUAGES.map(lang => fetchOne(lang)))` — total latency = max(single request) instead of sum; error collection semantics preserved via `allSettled`. **Trade-off:** 4 parallel hits to XIVAPI, which is fine for a local dev tool doing one item at a time.

---

## Verified non-findings (checked, OK)

- `result-card.ts` document-level `click`/`keydown` listeners are correctly paired in `connectedCallback`/`disconnectedCallback` (`:1291-1300`); same for `v4-layout-shell` media-query listener (`:710-726`), `config-sidebar` (`:704-725`), `dye-palette-drawer` (`:719-737`), `preset-tool` (`:322-375`), `tool-banner` (`:68-78`).
- `RouterService` popstate listener removed in `destroy()` (`router-service.ts:314-318`); same-tool re-navigation is guarded in the shell (`v4-layout-shell.ts:742-745`).
- `MarketBoardService` request versioning correctly discards stale responses for the *re-fetch* case (`market-board-service.ts:347-353`) — the gap is only the server-change-without-refetch path (F-02).
- All seven BaseComponent tools unsubscribe language/config listeners in `destroy()` (verified per-tool, see F-13 list); `BaseComponent` tracks and clears its own listeners and timeouts (`base-component.ts:160-218`, `:639-648`).
- Auth cross-tab `storage` sync registers exactly once and is correctly guarded (`auth-service.ts:200-220`); return-path sanitization is thorough (`:140-179`).
- Share analytics storage is bounded to 100 events (`share-service.ts:556`, `:577-591`).
- ModalService `onClose` callbacks are exception-guarded everywhere (`modal-service.ts:107-116`, `:154-171`, `:187-202`).
- maintainer `fetchWithTimeout` correctly aborts and clears its timer (`fetchWithTimeout.ts:36-68`) — the previously-known "XIVAPI fetch without timeout" issue class is resolved.
