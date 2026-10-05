# Review: webapp-services (apps/web-app/src/services)

Branch preview/integration-2026-10-04 @80262a2f. Reviewer: worker. All 30 non-test files read in full; tests skimmed by name/grep only.
Paths below are relative to `apps/web-app/src/` unless absolute.

## Map

| Module | Role |
|---|---|
| auth-service | PKCE OAuth (Discord/XIVAuth), JWT in localStorage, cross-tab storage sync, memoised logout |
| storage-service | localStorage wrapper (memoised availability probe, JSON-or-raw read, TTL helpers) |
| collection-service | favourites + typed collections, 4.x->stainID migration, tombstones, import/export |
| saved-presets-service | local preset snapshots (v5_saved_presets) |
| config-controller | per-tool config singleton, cross-tab StorageEvent reload, .chara swatch pin |
| indexeddb-service / api-service-wrapper | IDB v3 wrapper; Universalis core APIService + IDB price cache backend |
| market-board-service | price fetch w/ request versioning, consolidated-ID fan-out, outcome flag |
| community-preset-service / hybrid-preset-service / preset-submission-service | presets-api client, local+API merge, submit/edit/delete/upload |
| share-service | share URL generate/parse/validate (stainID grammar) |
| router-service / keyboard-service / modal-service / toast-service / tutorial-service | navigation, shortcuts, overlays |
| language-service / theme-service / theme-switch / telemetry-service / world-service | i18n, themes, opt-in telemetry, DC/world lookups |
| mixer-blending-engine / harmony-generator / display-options-helper / pricing-mixin / tool-panel-builders / dye-service-wrapper / api-worker-origin / index | thin helpers |

Changed since 79a69d1f (priority): auth-service (BUG-025/060/063 fixes present, no regression found), collection-service (BUG-024 fix present), config-controller, keyboard-service, modal-service, router-service.

## Candidates

### webapp-services-01 BUG MEDIUM (MAIN) services/preset-submission-service.ts:471
`deletePreset()` never throws; it returns `{success:false,error}` on a non-OK response or network error. Both callers `await` it inside try/catch and ignore the result.
- Failing state: user deletes a preset and the API answers 403/404/429 or the network drops.
- Wrong outcome: "deleteSuccess" toast, confirm dialog closes, list reloads (components/v4/preset-tool.ts:984-989; components/my-submissions-modal.ts:214-217). The `catch` branches that toast `errors.deletePresetFailed` are unreachable.
- Tests miss it: both component suites only `vi.fn()` the method (preset-tool.test.ts:77, my-submissions-modal.test.ts:50); none assert a `success:false` path. Covered: no.
```ts
if (!response.ok) { ... return { success: false, error: ... }; }   // callers never read this
```
Fix: callers check `result.success` (toast + keep modal on failure), or have the service throw.

### webapp-services-02 BUG MEDIUM (MAIN) services/community-preset-service.ts:262-303, 372
`request()` caches list/detail/featured/categories for 5 min (`presets:<query>`, `preset:<id>`) and nothing outside the service invalidates it: no component calls `clearCache()` (git grep finds only the definitions). `voteForPreset`/`removeVote` delete only `preset:<id>`/`vote:<id>`, never the `presets:*` list entries that carry `vote_count`.
- Failing state: delete your preset, then `loadPresets()` (preset-tool.ts:985) hits the cached list; or edit a preset and reopen its detail (cached `preset:<id>`); or vote then return to the list.
- Wrong outcome: the deleted preset is still listed for up to 5 min, edits show old name/dyes, vote counts stale.
- Tests: integration test covers TTL only. Covered: no.
Fix: `communityPresetService.clearCache()` (or prefix delete) on delete/edit/submit/vote success.

### webapp-services-03 BUG MEDIUM (MAIN) services/collection-service.ts:190-198, 217-222, 452-457
Re-entrant `initialize()` recursion when a migration save fails. `initialize()` sets `initialized = true` only AFTER `loadFavorites()/loadCollections()`. `loadFavorites()` migrates 4.x ids, then `saveFavorites()` -> `setItem` (returns false on quota) -> unconditional `notifyFavoritesListeners()` -> `getFavorites()` -> `initialize()` (flag still false) -> `loadFavorites()` re-reads the same unmigrated data -> migrates -> saves -> ... Same for `loadCollections()` when `migrated || version !== DATA_VERSION`.
- Failing state: localStorage full (QuotaExceededError) plus stored 4.x favourites/collections (itemIDs, or version != 2.0.0).
- Wrong outcome: RangeError (stack overflow) from the first CollectionService call (favourite star, drawer, collections modal), until storage is freed. When the save succeeds the re-entry is benign (second pass finds clean data), which is why tests pass.
- Tests: collection-service tests use a working storage. Covered: no.
Fix: set `initialized = true` first (the comment at :195 already notes the palette migration re-enters), or skip notify while initializing.

### webapp-services-04 BUG MEDIUM (MAIN) services/hybrid-preset-service.ts:315-317 (+ components/v4/preset-tool.ts:595-606, 630-645)
`getPresets()` swallows a failed community fetch and returns local-only data with no signal. `preset-tool.loadPresets()` derives `offline = !isAPIAvailable()` (boot health check, still true), then `apiCount (0) < 50` and `searchQuery` empty, so `reconcileTombstones()` runs against a pool with zero live community rows.
- Failing state: one transient 5xx/timeout/429 on `GET /api/v1/presets` while the user has saved community presets.
- Wrong outcome: every saved community preset is persisted as `deletedByAuthor = true` ("Removed by its author" chip) until the next successful load restores it.
- Tests: reconcile tests use the offline path. Covered: no (BUG-020 guarded page-full and search, not fetch failure).
Fix: have `getPresets` report a failed/partial API leg (throw or return `apiOk`) and skip reconcile unless it succeeded.

### webapp-services-05 BUG LOW (MAIN) services/language-service.ts:188
`tInterpolate` passes user text as the replacement argument of `String.replace`, so `$$`, `$&`, `` $` ``, `$'` in a value are interpreted.
- Failing input: collection named `Budget $$` -> toast `collections.addedToCollection` (components/add-to-collection-menu.ts:105, :242) renders `Budget $`; dye-grid `noResults` with query `$&`; `importedCopyName` (collection-service.ts:889) mangles names.
- Tests miss it (language-service tests use plain values). Covered: no.
Fix: `translation.replace(re, () => String(value))`.

### webapp-services-06 BUG LOW (MAIN) services/market-board-service.ts:398-410
The catch block gates the event/log on `requestVersion === this.requestVersion` but sets `_lastFetchOutcome = 'error'` unconditionally (:409). A superseded request that rejects overwrites the outcome of the newer one.
- Failing state: user switches world (bumps version); the old request rejects after the new one returned 'ok'; caller reads `lastFetchOutcome` -> 'error' (harmony-tool.ts:1749-1754 sets `marketFailed = true`; budget-tool.ts:637 similar).
- Wrong outcome: "market unavailable" strip for an overtaken request, the BUG-075 scenario on the error path. Self-heals on next fetch.
- Tests: BUG-075 tests cover the success-superseded path only. Covered: partly.
Fix: in catch, if the version moved on set `'superseded'` and return an empty Map.

### webapp-services-07 BUG LOW (MAIN) services/keyboard-service.ts:184-190
Tool shortcuts require `!e.shiftKey` and match on `e.key` ('1'..'0'). On AZERTY (French audience) the digit row types `&é"'(-è_çà` unshifted and digits only with Shift, so the 1-9/0 shortcuts never fire.
- Fix: match `e.code` (`Digit1`..`Digit0`, `Numpad*`).
- Tests: keyboard tests dispatch `key: '1'` only. Covered: no.

### webapp-services-08 BUG LOW (MAIN) services/language-service.ts:83-129
`setLocale` has no sequencing. Two overlapping calls with different targets (language modal pick while Shift+L cycling; both await real loads) can finish out of order: core `LocalizationService` ends on the later call while `currentLocale`/storage/listeners end on whichever resumed last, so dye names (core) and UI strings (web bundle) disagree until the next switch. `cycleToNextLocale` also computes from the committed locale, not the pending one.
Fix: monotonically increasing token; drop results of superseded calls.

### webapp-services-09 BUG LOW (MAIN) services/collection-service.ts:938-948
The BUG-024 guard reads `collection.name` before the per-record `try`. A `null`/non-object element in `data.data.collections` (hand-edited import) throws TypeError into the outer catch: result is `parseFailed`/`success:false` although earlier records were already persisted.
Fix: `!collection || typeof collection !== 'object'` inside the guard.

### webapp-services-10 BUG LOW (MAIN) services/auth-service.ts:754-765
`performLogout` awaits the `/auth/revoke` fetch (no timeout/AbortController) before `clearStorage()/clearState()/notify`. A stalled (not failed) revoke leaves the UI signed in and the token in storage; the memoised promise (BUG-025) means retries share the hang.
Fix: clear local state first, or race the revoke against a ~3-5 s abort, then revoke best-effort.

### webapp-services-11 BUG LOW (MAIN) services/indexeddb-service.ts:56-64, 76-130
`initPromise` caches the first outcome forever. `onerror` and `onblocked` both resolve `false`; no retry, and no `db.onversionchange` handler on success, so an old tab holding an older version blocks another tab's upgrade and that tab gets `false` once. (After the blocker closes `onsuccess` still sets `this.db`, so get/set self-heal; `initialize()` callers do not.)
Fix: clear `initPromise` on false; add `db.onversionchange = () => db.close()`.

### webapp-services-12 REFACTOR LOW (MAIN) services/market-board-service.ts:17, mixer-blending-engine.ts:13, harmony-generator.ts:247, tool-panel-builders.ts:213
Services import `@services/index` while the barrel re-exports them (circular), and keyboard-service.ts:16 imports a component statically (layer violation). Works only because every reference is used at call time; a top-level use would read `undefined` depending on entry order.
Fix: import from the concrete modules.

### webapp-services-13 OPT LOW (MAIN) services/api-service-wrapper.ts:586-601
`IndexedDBCacheBackend.loadFromStorage` does `keys()` then one transaction per key, serially, at boot, and `memoryCache.set` overwrites a fresher in-memory entry written by a fetch that raced the load (and can re-add entries after `clear()` ran mid-load, e.g. a quick logout, FINDING-008). Use one `getAll`, skip keys already present.

## POSITIVE
- auth-service: OAuth `state` fail-closed (:386), provider marker honoured only with a `code` (:222-225), return path sanitised, NaN expiry handled (BUG-063), UTF-8 JWT decode (BUG-060), logout memoised (BUG-025).
- config-controller: one-level mergeWithDefaults, import sanitised to declared fields with the default's shape, wheel/matching-method normalised on load, no-op write short-circuit, listener errors isolated.
- market-board-service: consolidated-ID fan-out via `getMarketItemID` back to each dye's itemID in cache and result; stale-response discard; server change bumps the version.
- router-service: sameTool popstate notification (BUG-005); legacy redirect keys start with `/`; `initialize` sets the flag before `replaceRoute`.
- share-service: stainID grammar with loud failure, numeric round-trip keeps leading-zero hex as strings, list params array-by-key (BUG-015), extractor caps match og-worker.
- keyboard-service: `composedPath()[0]` typing guard sees through the shadow root; bare-Shift chords only.
- telemetry-service: nothing persisted, GPC honoured, queue dropped on opt-out in every tab, envelope read at send time.
- community-preset-service: build-time-only API origin (WEB-4), `PresetApiError.status` instead of message matching.

## REJECTED
- `TOOL_KEY_MAP[e.key]` / `LEGACY_ROUTE_REDIRECTS[path]` prototype lookups: keys are single characters / begin with `/`; `e.key` is never `constructor`.
- `parseUrl` writing `params['__proto__']`: only re-prototypes the local `params` object; no global pollution, consumers read named keys.
- `resolveSharedDye` accepting `dye=12abc` via `parseInt`: yields stainID 12, harmless.
- Router `replaceRoute(DEFAULT)` dropping `?code=&csrf=&state=` on `/auth/callback`: `authService.initialize()` runs inside `initializeServices` (index.ts:92-98) before the layout touches the router; no earlier RouterService call found.
- `HybridPresetService.getPresets` ignoring `search` when `category` is set (:281-288): the only caller (preset-tool.ts:593) never passes `category`; latent only.
- Tombstone vs import: imported records get fresh ids, so the tombstone only blocks re-import of the original id; documented behaviour.
- `persistWithRetry` catch unreachable, `findMatchingDyes` (service) has no non-test caller: dead-code audit owns both.
- Cross-tab `storage` event reading TOKEN before EXPIRY: both are written in one synchronous task.
- `ShareService.generateUrl` hard-coding `https://xivdyetools.app` on beta: deliberate.

## COVERED (30 files, all read in full)
api-service-wrapper, api-worker-origin, auth-service, collection-service, community-preset-service, config-controller, display-options-helper, dye-service-wrapper, harmony-generator, hybrid-preset-service, index, indexeddb-service, keyboard-service, language-service, market-board-service, mixer-blending-engine, modal-service, preset-submission-service, pricing-mixin, router-service, saved-presets-service, share-service, storage-service, telemetry-service, theme-service, theme-switch, toast-service, tool-panel-builders, tutorial-service, world-service. Cross-checked outside the slice: main.ts:80-110, components/v4/preset-tool.ts (loadPresets, reconcileTombstones, delete handler), components/my-submissions-modal.ts, components/harmony-tool.ts:1735-1775, packages/core APIService.getAPIStatus.
