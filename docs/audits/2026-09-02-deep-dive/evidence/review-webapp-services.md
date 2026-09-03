# review-webapp-services — deep-dive 2026-09-02

Unit: `webapp-services` · Deploy unit: `web-app` (Vite + Lit, Cloudflare Pages; merge to main deploys
production; beta writes to PRODUCTION preset data).
Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02` (origin/main e7ac4042).

## 1. Map

| Module | Role |
|---|---|
| `src/main.ts` | Entry: `initializeServices()` → `LanguageService` → `TelemetryService` → v4 layout; fatal overlay |
| `services/index.ts` | Barrel + `initializeServices()` boot order (theme→lang→storage→keyboard→world→camera→presets→auth) |
| `services/storage-service.ts` | localStorage wrapper, memoized availability probe, `NamespacedStorage`, TTL helpers |
| `services/indexeddb-service.ts` | IDB singleton, DB v3, stores `price_cache` / `palettes` / `settings` |
| `services/collection-service.ts` | Favorites + typed collections (`palette`/`swap`/`character`), tombstones, 4.x→stainID migration, import/export |
| `services/saved-presets-service.ts` | 8A local preset snapshots (`v5_saved_presets`), legacy dye-id migration |
| `services/config-controller.ts` | Per-tool config, lazy load, cross-tab StorageEvent sync, import sanitizer |
| `services/auth-service.ts` | Discord/XIVAuth PKCE OAuth, JWT decode, localStorage token, cross-tab logout |
| `services/market-board-service.ts` | Price cache, request versioning, consolidated-itemID fan-out |
| `services/pricing-mixin.ts` | `setupMarketBoardListeners` DOM glue |
| `services/world-service.ts` | worlds.json / data-centers.json indexes |
| `services/api-service-wrapper.ts` | core `APIService` + IndexedDB cache backend, Universalis proxy origin |
| `services/router-service.ts` | History API router, 9 routes, legacy redirects, sub-paths |
| `services/share-service.ts` | Share URL grammar (stainID), generate + `parseUrl` + hex/dye resolution |
| `services/language-service.ts` | 6 locales, dot-path `t()`, EN fallback bundle |
| `services/theme-service.ts` + `theme-switch.ts` | Light/Dark only, legacy-name migration, telemetry-recorded switch |
| `services/telemetry-service.ts` | Opt-in analytics, consent gating, dwell clock, beacon batch |
| `services/community-preset-service.ts` | Presets REST client, 5-min cache, voting |
| `services/hybrid-preset-service.ts` | Curated + community merge |
| `services/preset-submission-service.ts` | Submit/edit/delete, validation codes, preview-image upload |
| `services/camera-service.ts` | Device enumeration, stream lifecycle, frame capture |
| `services/keyboard-service.ts` | Global shortcuts (1-9, Shift+T/L/S, ?) |
| `services/modal-service.ts` / `toast-service.ts` | Modal stack (max 3) / toast queue (max 5) + timers |
| `services/tutorial-service.ts` | 5 tutorials, completion flags, prompt modal |
| `services/chara-resolve-service.ts` | `.chara` equipment resolve client (api-worker) |
| `services/harmony-generator.ts` / `mixer-blending-engine.ts` | Extracted tool math |
| `services/{dye-service-wrapper,tool-panel-builders,display-options-helper,api-worker-origin}.ts` | Wrappers/helpers |
| `shared/*` | logger, error-handler, constants, tool-config-types, format, custom-dye, example-link, palette-export, subscription-manager, utils, i18n helpers, icons |
| `functions/_middleware.ts`, `public/_headers` | Pages domain redirect + `/assets/*` HTML-fallback guard; CSP/HSTS/cache rules |

## 2. Candidates

---

### webapp-services-01 — BUG — **HIGH** — `apps/web-app/src/services/keyboard-service.ts:231`

**Claim.** The `keyboard-navigate-tool` event that the 1–9 tool shortcuts dispatch has no listener anywhere
in production code, so those nine advertised shortcuts are inert.

**Failing input → wrong outcome.** Press `3` with no modifiers and no focused text field. `handleKeyDown`
calls `preventDefault()` and dispatches `keyboard-navigate-tool` on `window`. Nothing listens →
nothing happens, and the keypress is also swallowed. `components/shortcuts-panel.ts:34` advertises
`1-9 → shortcuts.switchTool` in the help panel, so the user is told the feature exists.

**Verification.** `grep -rn "keyboard-navigate-tool" src/ index.html` returns exactly two production hits,
both inside `keyboard-service.ts` (the doc comment and the dispatch); every other hit is
`services/__tests__/keyboard-service.test.ts`. The layout's real switch path is a different event:
`components/v4-layout.ts:174` listens for `tool-change` and calls `RouterService.navigateTo(toolId)`.
The doc comment at `keyboard-service.ts:228` ("main.ts listens for 'keyboard-navigate-tool' events") is
false — `main.ts` registers no listeners. This is the same class of defect the codebase already fixed
once: `services/index.ts:191-197` records that `KeyboardService.initialize()` had never been called, so
every shortcut was inert; the call was added, which fixed Shift+T/L/S and `?` (they act directly) but
left 1–9 dispatching into the void.

**Covered by test?** No — see webapp-services-15 (the tests register their own listener).

```ts
  private static handleToolNavigation(toolId: string): void {
    const event = new CustomEvent('keyboard-navigate-tool', {
      detail: { toolId },
      bubbles: true,
    });
    window.dispatchEvent(event);           // nothing in src/ listens for this
```

**Fix direction.** Call `RouterService.navigateTo(toolId as ToolId)` directly (guarded by
`isValidToolId`), or have `v4-layout` listen for the event; then assert navigation, not the dispatch.
Sibling: `navigate-to-tool` (dispatched by extractor/mixer/swatch context menus) has no production
listener either — out of this unit's scope, worth one row in the components review.

---

### webapp-services-02 — BUG — **HIGH** — `apps/web-app/src/services/share-service.ts:400-403`

**Claim.** `parseUrl` turns a comma-free numeric param into a `number`, so a share link carrying exactly
one dye arrives as a scalar and the array-shaped consumers reject it silently.

**Failing input → wrong outcome.** In Accessibility (or Comparison) select **one** dye and press Share.
`generateUrl` writes `?dyes=102&v=1` (`addParamsToUrl:238` joins the array, and a 1-element join has no
comma). On open, `parseUrl` hits the number branch (`parseFloat('102') === 102`,
`String(102) === '102'`) and sets `params.dyes = 102`. `accessibility-tool.ts:2036` and
`comparison-tool.ts:2470` both require `Array.isArray(params.dyes)` → `loadFromShareUrl()` returns
false → the shared dye is dropped and the tool falls back to the *recipient's own* localStorage
selection, so the link looks like it worked and shows the wrong dyes. Single-dye shares are reachable:
both tools enable the Share button at `selectedDyes.length > 0`
(`accessibility-tool.ts:832`, `comparison-tool.ts:2455`).

**Why tests miss it.** `services/__tests__/share-service.test.ts` has one `parseUrl` test
(line 310, the all-digit-hex coercion) and no round-trip test for `dyes`; the two tool suites never
build a one-element share URL.

**Covered by test?** No.

```ts
      url.searchParams.forEach((value, key) => {
        if (key === 'v') return;
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && String(numValue) === value) {
          params[key] = numValue;      // "102" -> 102, never [102]
          return;
        }
```

**Fix direction.** Make the array-valued keys explicit (`dyes`, `colors` always parse as arrays via
`value.split(',')`), or normalise in the consumers with `const ids = Array.isArray(p.dyes) ? p.dyes : [p.dyes]`.

---

### webapp-services-03 — BUG — **MEDIUM** — `apps/web-app/src/services/auth-service.ts:790-791`

**Claim.** `decodeJWT` runs `JSON.parse(atob(...))` with no UTF-8 decode, so any non-ASCII Discord
username or display name is mojibake everywhere the app shows it.

**Failing input → wrong outcome.** A JWT whose payload is `{"global_name":"みかん",…}`. JWT payloads are
base64url of **UTF-8** bytes; `atob` returns a Latin-1 byte string, and the continuation bytes
(0x80–0xBF) are legal JSON string content, so `JSON.parse` succeeds and yields `"ã¿ãã"`. Verified
locally: `Buffer.from(b64,'base64').toString('binary')` → `ã¿ãã` vs `…toString('utf8')` → `みかん`.
The value is rendered as the signed-in account name at
`components/v4/config-sidebar.ts:1602` (`user.global_name || user.username || …`).

**Why tests miss it.** `services/__tests__/auth-service.test.ts` builds every fixture with
`btoa(JSON.stringify(payload))` and ASCII names (`'testuser'`, `'Test User'`) — `btoa` itself throws on
non-Latin1, so the fixture builder cannot express the failing case.

**Covered by test?** No.

```ts
      const decoded = atob(base64);
      return JSON.parse(decoded);      // Latin-1 bytes parsed as text
```

**Fix direction.** `JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0))))`.

---

### webapp-services-04 — BUG — **MEDIUM** — `apps/web-app/src/shared/logger.ts:17, 68-113`

**Claim.** `shared/logger.ts` imports `browserLogger` from `@xivdyetools/logger/browser` and never uses
it; the exported `logger` is a hand-rolled `console.*` shim, so the package's documented secret
redaction never runs in the browser and `logger.error` writes raw objects to the production console.

**Failing input → wrong outcome.** The module docblock claims "Now powered by @xivdyetools/logger/browser.
Re-exports for backward compatibility". `grep -rn "browserLogger" src/` finds the import at line 17 and
**no** reference to `_browserLogger` anywhere. The package does have redaction
(`packages/logger/src/constants.ts:14 CORE_REDACT_FIELDS`, extended by FINDING-026 of the 2026-08-21
audit); none of it is on this path. `logger.error` (line 87-89) is the one level that is *not* gated on
`isDev()`, so it runs in production with whatever object the caller passes — e.g.
`auth-service.ts:411 logger.error('Token exchange failed:', errorData)` (the OAuth worker's error body)
and `auth-service.ts:436 logger.error('Error exchanging code for token:', err)`.

**Why tests miss it.** `shared/__tests__/logger.test.ts:53-58` asserts the raw pass-through
(`expect(consoleDebugSpy).toHaveBeenCalledWith('message', { data: 123 }, [1,2,3])`), i.e. it *pins* the
non-redacting behaviour — adding redaction would turn that suite red.

**Covered by test?** No (tests enforce the drift).

```ts
import { browserLogger as _browserLogger } from '@xivdyetools/logger/browser';  // never referenced
…
  error(...args: unknown[]): void {
    console.error(...args);      // no redaction, runs in production
  },
```

**Fix direction.** Either delete the dead import and drop the false docblock claim, or actually delegate
to `browserLogger` (and update `logger.test.ts` to assert redaction). Severity is capped at MEDIUM
because console output stays on the user's own machine and `auth-service` is careful never to log the
token itself — but that discipline is the only thing holding.

---

### webapp-services-05 — BUG — **MEDIUM** — `apps/web-app/src/services/community-preset-service.ts:325`

**Claim.** `getPreset`'s 404 detection string-matches `'404'` inside an error message that
`request()` preferentially fills with the **server's** message, so a real 404 is re-thrown instead of
returning `null`.

**Failing input → wrong outcome.** `GET /api/v1/presets/<deleted-id>`. `apps/presets-api/src/handlers/presets.ts:1041`
answers `{ success:false, error:'NOT_FOUND', message:'Preset not found' }` with status 404.
`request()` (line 259-260) throws `new Error('Preset not found')` — the `API request failed: 404`
fallback is only reached when the body has no `message`. `'Preset not found'.includes('404')` is false,
so the guard never fires and the error propagates. `HybridPresetService.getPreset` (lines 364, 382)
happens to swallow it with a bare `catch { return null; }`, so today the outcome is masked; any direct
caller, or removing that catch, surfaces an exception where the contract promises `null`. The check is
also loose in the other direction — a preset whose id or error message contains "404" would be treated
as missing.

**Covered by test?** No (`community-preset-service.integration.test.ts` does not exercise a 404 body).

```ts
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;                       // never true for the real 404 body
      }
      throw error;
```

**Fix direction.** Throw a typed error carrying `response.status` from `request()` and branch on
`err.status === 404`.

---

### webapp-services-06 — BUG — **MEDIUM** — `apps/web-app/src/services/auth-service.ts:282-291, 584-590`

**Claim.** A non-numeric stored expiry parses to `NaN`, which defeats **both** expiry checks, leaving a
client-side session that never expires.

**Failing input → wrong outcome.** `localStorage['xivdyetools_auth_expires'] = 'x'` (hand-edited, a
truncated write, or a quota-failed partial write — `setItem` returns `false` silently). Then
`parseInt('x',10)` → `NaN`; `if (expiresAt < now)` is `NaN < now` → **false**, so `loadFromStorage`
keeps the session and stores `expiresAt: NaN`. `isAuthenticated()` then does
`if (this.state.expiresAt)` — `NaN` is falsy → the expiry branch is skipped entirely → returns `true`.
`getAuthHeaders()` therefore keeps attaching a stale `Bearer` token to every presets-API call forever.
The server still rejects the expired JWT, so this is a UX/state defect, not an auth bypass — the user
sees themselves as signed in while every write 401s.

**Covered by test?** No — the suite only writes well-formed numeric expiries.

```ts
      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt < now) {          // NaN < now === false
```

**Fix direction.** `if (!Number.isFinite(expiresAt) || expiresAt < now) { clearStorage(); clearState(); return; }`
and change `isAuthenticated()`'s guard to `Number.isFinite(this.state.expiresAt)`.

---

### webapp-services-07 — BUG — **MEDIUM** — `apps/web-app/src/services/harmony-generator.ts:243`

**Claim.** When a dye filter excludes a harmony companion, its replacement is chosen by **plain
Euclidean RGB distance**, not by the user's configured matching method — so one card in the panel is
ranked by a metric the app's own help text calls "not perceptual".

**Failing input → wrong outcome.** Harmony with `matchingMethod: 'ciede2000'` (the default,
`tool-config-types.ts:420`) and "Exclude metallic" on. Every kept match came from
`findClosestDyesToHue` → `ColorService.getDistanceForMethod(..., config.matchingMethod)` (line 184) or
the hue-angle path (188-189). The substitute for the excluded dye is picked at line 243 with
`ColorService.getColorDistance(targetColor, dye.hex)`, which is
`packages/core/src/services/color/ColorConverter.ts:475-484` — `Math.sqrt(dr²+dg²+db²)`, unweighted RGB.
The user therefore gets a visibly different (usually worse) companion than the same filter would give
under CIEDE2000. Compounding it, the replacement's `deviance` is re-computed as
`calculateHueDeviance(...)` (0–180 degrees, line 251) while the kept entries' `deviance` under
perceptual matching is a ΔE — the array mixes two scales, and `harmony-tool.ts:1536` renders it as
`hueDeviance`.

**Covered by test?** No — `harmony-generator.test.ts` does not assert which metric
`replaceExcludedDyes` uses. (Possibly the same root as the "harmony ΔE76" item left open by the
2026-08-08 design review; re-filed here because it is a concrete metric mismatch, not a formula choice.)

```ts
      const distance = ColorService.getColorDistance(targetColor, dye.hex);  // Euclidean RGB
      if (distance < bestDistance) { bestDistance = distance; bestAlternative = dye; }
```

**Fix direction.** Thread `matchingMethod` into `replaceExcludedDyes` and use
`calculateColorDistance(...)`; return the replacement's deviance on the same scale as the entry it replaces.

---

### webapp-services-08 — BUG — **LOW** — `apps/web-app/src/services/api-service-wrapper.ts:109-135, 137-149`

**Claim.** `persistWithRetry`'s retry/catch (and the `.catch()` on `delete`/`clear`) is unreachable:
`IndexedDBService` never rejects, so a failed IndexedDB write silently leaves memory and disk divergent.

**Failing input → wrong outcome.** `indexedDBService.set` (`indexeddb-service.ts:245-248, 231`) resolves
`false` on `request.onerror` and on a missing `db`; it never rejects. `await` on it therefore never
throws, the `catch` block never runs, the retry never happens, and the documented "remove from memory
cache to prevent false positive caching" never fires — so a price that failed to persist stays in the
memory cache and is reported as cached. The return value is discarded at line 116.

**Covered by test?** Yes, but vacuously — see webapp-services-17.

```ts
    try {
      await indexedDBService.set(STORES.PRICE_CACHE, key, value);   // resolves false, never rejects
    } catch (error) { … }                                          // unreachable
```

**Fix direction.** Branch on the boolean: `if (!(await indexedDBService.set(...))) { retry / evict }`.

---

### webapp-services-09 — BUG — **LOW** — `apps/web-app/src/services/collection-service.ts:931`

**Claim.** `importData` validates the collection name by truthiness only, so a non-string name throws
inside `createCollection` and aborts the whole import as `parseFailed` after favorites have already
been written.

**Failing input → wrong outcome.** An exported/hand-edited file
`{"type":"xivdyetools-collection","data":{"favorites":[1,2],"collections":[{"name":123,"dyes":[5]}]}}`.
`!collection.name` is false for `123`, so it reaches `createCollection(123, …)` →
`name.trim()` → `TypeError` → caught by the outer `try` at line 982 → `errors=[{code:'parseFailed'}]`
and `success:false`, while the two favorites are already persisted. The load path was hardened for
exactly this (`loadCollections:275-283`, WEB-6) but the import path was not. Same hazard for
`collection.description` (`createCollection:645`).

**Covered by test?** No — `collection-service.test.ts` imports only well-typed fixtures.

```ts
          if (!collection.name || !Array.isArray(collection.dyes)) {
            result.errors.push({ code: 'skippedInvalid', name: collection.name });
```

**Fix direction.** `typeof collection.name !== 'string' || !collection.name.trim()` (and the same for
`description`) → `skippedInvalid`, so one bad record is skipped rather than failing the batch.

---

### webapp-services-10 — BUG — **LOW** — `apps/web-app/src/services/share-service.ts:407-414`

**Claim.** The `'1'` / `'0'` boolean branch in `parseUrl` is unreachable — the number branch above it
consumes both — so a boolean share param round-trips as `1`/`0`, not `true`/`false`.

**Failing input → wrong outcome.** `addParamsToUrl:241` encodes booleans as `'1'`/`'0'`. On read,
`parseFloat('1') === 1` and `String(1) === '1'` → `params.perceptual = 1` (number). Any consumer doing
`params.perceptual === true` sees false. Latent today only because `harmony-tool.ts:433` reads
`perceptual` straight off `URLSearchParams` rather than through `parseUrl`; the declared type
(`HarmonyShareParams.perceptual?: boolean`) is a lie for anyone who does use `parseUrl`.

**Covered by test?** No.

```ts
        if (value === '1' || value === 'true') { params[key] = true; return; }   // '1' already consumed
        if (value === '0' || value === 'false') { params[key] = false; return; } // '0' already consumed
```

**Fix direction.** Move the boolean check above the numeric one, or key it off a known-boolean param list.

---

### webapp-services-11 — BUG — **LOW** — `apps/web-app/src/services/share-service.ts:417-426`

**Claim.** A comma-separated list whose every element merely *starts* with a digit is coerced with
`parseFloat`, silently mangling hex colours.

**Failing input → wrong outcome.** `?colors=012345,12abcd`. `parseFloat` returns `12345` and `12`
(neither is `NaN`), so `allNumbers` is true and `params.colors = [12345, 12]` — the leading zero is
gone and `12abcd` is truncated at the first non-digit. `normalizeHex` then rejects both (5 and 2 chars)
and the colours are dropped. Latent: nothing reads `ExtractorShareParams.colors` back
(`grep -rn "ShareService" components/extractor-tool.ts` is empty), so only og-worker consumes that URL —
but it is a trap for the next consumer.

**Covered by test?** No.

**Fix direction.** Use `Number(p)` (strict) rather than `parseFloat`, and require the round-trip
`String(n) === p` per element, exactly as the scalar branch does.

---

### webapp-services-12 — BUG — **LOW** — `apps/web-app/src/shared/tool-config-types.ts:503-505` + `services/config-controller.ts:299-303`

**Claim.** `getDefaultConfig` returns the shared module-level `DEFAULT_CONFIGS[key]` object (and its
nested `displayOptions` / `dyeFilters`), which `resetConfig` installs into the live config map and
broadcasts to every subscriber.

**Failing input → wrong outcome.** `resetConfig('harmony')` puts the *same object* that
`DEFAULT_CONFIGS.harmony` points at into `this.configs` and hands it to `notifyListeners`. Any
subscriber that mutates what it receives (`cfg.displayOptions.showHex = false`) permanently corrupts
the app's defaults for the rest of the session, including every later `resetConfig` and
`sanitizeConfigPartial` shape check. No in-place mutation exists today
(`grep -rn "displayOptions\.[a-zA-Z]* *="` is empty), so this is latent — but it is one careless
subscriber away from a "Reset settings doesn't reset" bug that is very hard to trace.

**Covered by test?** No.

```ts
export function getDefaultConfig<K extends ConfigKey>(key: K): ToolConfigMap[K] {
  return DEFAULT_CONFIGS[key];      // live shared reference, nested objects included
}
```

**Fix direction.** `return structuredClone(DEFAULT_CONFIGS[key])` (or a per-key deep-copy factory).

---

### webapp-services-13 — BUG — **LOW** — `apps/web-app/src/services/collection-service.ts:1029-1040`, `services/theme-service.ts:222`

**Claim.** Two notify loops have no per-listener try/catch, unlike every sibling service, so one
throwing subscriber aborts the remaining subscribers **and** propagates out of the mutating API.

**Failing input → wrong outcome.** A component whose favorites subscriber throws (e.g. it touches a DOM
node removed by a concurrent re-render). `notifyFavoritesListeners` → the exception escapes
`saveFavorites()` → escapes `addFavorite()` → the star-toggle click handler dies mid-way, with the
favorite already written to storage but half the UI un-notified. `ConfigController:422-428`,
`RouterService:411-417`, `AuthService:761-767`, `ModalService:151-156` and
`SavedPresetsService:107-113` all wrap the callback; these two do not.

**Covered by test?** No.

```ts
  private static notifyFavoritesListeners(): void {
    const favorites = this.getFavorites();
    this.favoritesListeners.forEach((listener) => listener(favorites));   // no guard
  }
```

**Fix direction.** Wrap each `listener(...)` in try/catch + `logger.error`, matching the sibling services.

---

### webapp-services-14 — BUG — **LOW** — `apps/web-app/src/services/saved-presets-service.ts:51-59, 82`

**Claim.** `load()` sets `loaded = true` before the dye-database readiness check, so if the shelf is
read before `dyeDatabase` is warm the legacy-itemID migration is skipped for the entire page load and
never retried.

**Failing input → wrong outcome.** Any call to `SavedPresetsService.getAll()` / `isSaved()` that lands
before the dye DB finishes initialising: `migrateLegacyDyeIds` returns `false` at line 82
(`!dyeService.isLoadedStatus()`), `loaded` is already `true`, and nothing re-enters. Pre-2026-08-28
snapshots then keep their 4.x itemIDs for the whole session, and `resolvePresetDye`
(`dye-service-wrapper.ts:231`, stainID-only) resolves every one of them to `undefined` — the saved
preset renders as an empty palette, which is precisely the failure the migration exists to prevent.
The docblock acknowledges the cold-DB skip but not that it is permanent for the load.

**Covered by test?** No — `saved-presets-service.test.ts` runs with the DB already loaded.

```ts
  private static load(): void {
    if (this.loaded) return;
    this.loaded = true;                    // latched before the readiness check
    …
    if (this.migrateLegacyDyeIds()) { … }  // no-ops while the dye DB is cold
```

**Fix direction.** Track migration separately (`private static migrated = false`) and re-attempt it on
each `getAll()` until `dyeService.isLoadedStatus()` is true.

---

### webapp-services-15 — UNTESTED — **HIGH** — `apps/web-app/src/services/__tests__/storage-service.test.ts:349-375`

**Behaviour it was supposed to catch.** WEB-BUG-004: `StorageService.setItem` must **return `false`**,
not throw, when localStorage raises `QuotaExceededError` (`storage-service.ts:107-119`). Every caller
depends on that — `ConfigController.saveToStorage:406-410` checks the boolean,
`CollectionService.saveFavorites:455` ignores it, `TelemetryService`/`ThemeService` call it bare.

**Why it cannot fail.** The assertion is inside the `try` whose `catch` swallows it:

```ts
      try {
        StorageService.setItem('test', 'value');
        expect.fail('Should have thrown an error');   // throws...
      } catch (error) {
        expect(error).toBeDefined();                  // ...and is caught here
      }
```

`setItem` returns `false` without throwing → `expect.fail` throws → the same `catch` catches it →
`expect(error).toBeDefined()` passes. The test passes whether `setItem` throws or not, and its comment
("StorageService converts QuotaExceededError to AppError") documents behaviour WEB-BUG-004 removed.
Line 350-353 is also a guarded body with no else (`if (!isAvailable()) { expect(true).toBe(true); return; }`),
and the `localStorage.setItem = originalSetItem` restore at 374 is not in a `finally`.

**Fix direction.** `expect(StorageService.setItem('test','value')).toBe(false)` plus an assertion that
no exception escaped; move the restore into `finally`.

---

### webapp-services-16 — UNTESTED — **MEDIUM** — `apps/web-app/src/services/__tests__/keyboard-service.test.ts:95-236, 420-608`

**Behaviour it was supposed to catch.** That pressing 1–9 navigates to the corresponding tool
(webapp-services-01).

**Why it cannot fail.** Each test registers its **own** `window.addEventListener('keyboard-navigate-tool', listener)`
and then asserts that listener was called. It verifies that `KeyboardService` dispatches an event —
which it does — while the application has no listener at all, so the suite is green on a feature that
does nothing for users.

**Fix direction.** Assert the observable outcome: spy on `RouterService.navigateTo` (or on the
`tool-change`/route state) rather than on a listener the test itself installed.

---

### webapp-services-17 — UNTESTED — **LOW** — `apps/web-app/src/services/__tests__/api-service-wrapper.test.ts:310-317, 349-356`

**Behaviour it was supposed to catch.** That an IndexedDB delete/clear failure degrades gracefully.

**Why it cannot fail.** Both tests do `mockDelete.mockRejectedValueOnce(new Error(...))` — a state the
real `IndexedDBService` cannot produce (it resolves `false`, see webapp-services-08) — and then assert
`expect(() => cacheBackend.delete('fail-delete')).not.toThrow()` on a **synchronous void** call whose
rejection is already absorbed by an attached `.catch()`. The assertion holds for any implementation.
`api-service-wrapper.test.ts:48-49, 132` (`expect(typeof x).toBe('function')`) and 89/435
(`resolves.not.toThrow()`) are the same shape.

**Fix direction.** Assert the boolean contract (`await expect(indexedDBService.delete(...)).resolves.toBe(false)`)
and that the memory cache was evicted.

---

### webapp-services-18 — REFACTOR — **P2** — `apps/web-app/src/services/harmony-generator.ts:176, 237`, `services/mixer-blending-engine.ts:155`

Nine `dye.category === 'Facewear'` guards survive schema v2. `packages/core/src/data/dyes.json` holds
125 entries across exactly eight categories — `Neutral, Reds, Browns, Yellows, Greens, Blues, Purples,
Special` — and **zero** with `category === 'Facewear'` (verified by loading the file). The 11 facewear
colours moved to `facewearColors` and are not `Dye`s at all. Three guards are in this unit; six more are
in components (`dye-search-box.ts:193`, `dye-selector.ts:403`, `gradient-tool.ts:1865`,
`preset-edit-form.ts:368`, `preset-submission-form.ts:462`, `v4/dye-palette-drawer.ts:728`). Harmless
today, but they read as active protection and will mislead the next schema change.

---

### webapp-services-19 — REFACTOR — **P2** — `apps/web-app/src/services/config-controller.ts:376-379`

`loadFromStorage` merges `{ ...defaults, ...stored }` and the comment promises it "handles migrations
when new config options are added" — but the merge is **shallow**, and every tool config carries a
nested `displayOptions` (11 keys) and `dyeFilters` (9 keys). A config persisted before a nested key
existed keeps its old nested object verbatim, so the new key is `undefined` rather than its default.
Today this is papered over by ~30 read sites doing `?? true` (e.g.
`accessibility-tool.ts:1134-1136`, `budget-tool.ts:386-388`) and by `DEFAULT_DYE_FILTERS` being
all-`false`; the next nested key that defaults to `true` and is read without `??` breaks for every
returning user. Fix: deep-merge one level for the two known nested objects.

---

### webapp-services-20 — REFACTOR — **P3** — `apps/web-app/src/services/pricing-mixin.ts:49-89`

`setupMarketBoardListeners` attaches three listeners (`showPricesChanged`, `server-changed`,
`refresh-requested`) and returns `void` — no teardown handle. Called from six sites, two of them twice
in the same component (`comparison-tool.ts:502` and `:2095`, `swatch-tool.ts:987` and `:2483`). The
listeners die with their container element, so there is no leak today, but a component that rebuilds
its market panel without discarding the old container would double-fire every fetch. Return an
unsubscribe closure and register it with `SubscriptionManager`.

---

### webapp-services-21 — REFACTOR — **P3** — `apps/web-app/src/services/camera-service.ts:78-83`

The BUG-010 `throw error` and `hasEnumerated = false` recovery are unreachable: `enumerateCameras`
(89-115) catches everything itself and resolves with `availableCameras = []`. So `initialize()` can
never reject, `forceRetry` can never be needed, and — helpfully — a camera failure can never take down
`initializeServices()` (which `await`s it at `services/index.ts:205`). Either propagate the failure from
`enumerateCameras` or delete the dead recovery.

---

### webapp-services-22 — REFACTOR — **P3** — `apps/web-app/src/services/preset-submission-service.ts:157-168, 502-516`

Minimum length is checked on the **trimmed** value, maximum on the **untrimmed** one. A 48-character
preset name typed with three trailing spaces fails `nameMax` (51 > 50) even though the body actually
sent is `name.trim()` (48). Same asymmetry for `description`. Trim once, then bound both ends.

---

### webapp-services-23 — OPT — **P3** — `apps/web-app/src/services/hybrid-preset-service.ts:338`

`[...allPresets].sort(() => Math.random() - 0.5)` as a shuffle for the offline featured row: an
inconsistent comparator, heavily biased toward the original order. Use Fisher–Yates (or
`slice` after a keyed sort) — cheap, and the current version makes "featured" feel static offline.

## 3. POSITIVE — do not re-file

- **Consolidated-itemID fan-out is correct.** `market-board-service.ts:319-359` builds
  `marketIdToOriginals` from `getMarketItemID(dye)` and writes the batch result back under **every**
  original dye itemID, so Budget/Swatch lookups by dye id hit. `shouldFetchPrice:277-282` uses
  `dye.itemID <= 0` (never a null check) and gates on `isConsolidationActive()`. The 2026-07-18
  BUG-010/BUG-039 fixes are intact.
- **In-flight fetch superseded by a server change is handled.** `requestVersion` is bumped on *every*
  `fetchPricesForDyes` entry and on the `server-changed` config callback (`:146`), and the version is
  re-checked after the await (`:339`) before any cache write — including the `total === 0` path that
  clears `isFetching`.
- **OAuth state round-trip and `returnTo` are fail-closed.** `handleCallbackCode:375` rejects when
  either the echoed `csrf` or the stored state is missing; `sanitizeReturnPath:115-154` blocks `//`,
  `://`, `javascript:`, `data:` and cross-origin `new URL` results; `login()` clears a stale
  `OAUTH_PROVIDER_KEY` (FINDING-032/WEB-3) and the provider marker is only honoured when a `code` is present.
- **Telemetry consent gating is airtight.** `track()` and `flush()` both return early on
  `!isEnabled()` (toggle AND `navigator.globalPrivacyControl`), `flush()` drops the queue when disabled,
  opting out calls `dropQueue()` across tabs via the ConfigController StorageEvent, `trackDyePick`
  carries only `stainID`/`via`/`tool`, and `normalizeProducer` buckets `.chara` `TypeName` to an
  allowlist rather than the raw string. Nothing is written to storage and there is no client id.
- **Persisted-shape hardening is real where it was done.** `collection-service.loadCollections:275-283`
  skips malformed records instead of crash-looping (WEB-6); `migrateDyeIds`/`toStainId` convert 4.x
  itemIDs on read only, `addFavorite`/`addDyeToCollection` reject non-stainIDs on write; tombstones stop
  an import resurrecting a deleted record; `importedCopyName:885-890` guards both loop-hang shapes.
- **The share grammar fails loudly.** `resolveSharedDye:319-339` rejects `>= 5729` legacy itemIDs and
  unknown stainIDs with a localized toast and `null` — never a fallback dye — and `normalizeHex`
  handles the number-coerced all-digit hex.
- **`keyboard-service.isUserTyping` sees through shadow DOM** via `composedPath()[0]` with an
  activeElement walk as fallback — the correct fix for the retargeting trap, with the reasoning recorded.
- **`functions/_middleware.ts:30-39`** turns an HTML fallback under `/assets/*` into a `no-store` 404,
  closing the 2026-08 cache-poisoning path; `public/_headers` CSP names only first-party hosts.

## 4. REJECTED

- *IndexedDB init latching `false` forever.* `doInitialize` caches the promise, but `onblocked` resolves
  `false` while the underlying `open` request stays live and still fires `onsuccess`, which sets
  `this.db` — subsequent `get`/`set` recover. Only a hard `onerror` latches, which is correct.
- *`CommunityPresetService.initialize` fallback timer leaks an unhandled rejection.* `Promise.race`
  attaches handlers to both promises, so the late rejection is handled; only a stray 11 s timer remains.
- *`hasVoted` cache surviving a user switch.* `logout()` does not clear the community cache, but sign-in
  ends in `window.location.reload()` (`navigateAfterAuth:550`) and `hasVoted` short-circuits while
  signed out, so no other user's vote state is observable.
- *`initializeServices` aborting before auth if the camera fails.* `cameraService.initialize()` cannot
  reject (see webapp-services-21).
- *`MarketBoardService.getPricesView` handing out a mutable Map.* Type-level `ReadonlyMap` only, but it
  is a deliberate documented OPT-027 trade and no caller mutates it.
- *`RouterService` dropping share params at boot.* `handleInitialRoute` only calls `replaceRoute` for
  `/`, `''` or an unmatched path; `/harmony?dye=…&v=1` and `/presets/<id>` are left intact.
- *`t()` returning a raw key on a locale-load failure.* `setLocale` loads the `en` bundle alongside any
  non-en locale (BUG-041, `language-service.ts:102-104`), and `loadWebAppTranslations` falls back to `en`
  on its own failure. Only a throw from core's `LocalizationService.setLocale` would leave the cache
  empty — no such throw path found.
- *Third theme path surviving.* `THEME_NAMES` is exactly `['standard-light','standard-dark']`;
  `migrateLegacyThemeName` maps every retired name onto one of the two and persists the migration.
- *`ModalService` focus trap / `ToastService` timer leak.* The trap lives in the container component
  (out of scope); toast timers are cleared on dismiss, on max-visible eviction and in `dismissAll`.
- *Auth refresh-timer leak across sign-out.* There is no refresh scheduler at all — the token simply
  expires and `isAuthenticated()` logs out. Nothing to leak.

## 5. COVERED — 46 files read

**services/ (32, all non-test files):** api-service-wrapper, api-worker-origin, auth-service,
camera-service, chara-resolve-service, collection-service, community-preset-service, config-controller,
display-options-helper, dye-service-wrapper, harmony-generator, hybrid-preset-service, index,
indexeddb-service, keyboard-service, language-service, market-board-service, mixer-blending-engine,
modal-service, preset-submission-service, pricing-mixin, router-service, saved-presets-service,
share-service, storage-service, telemetry-service, theme-service, theme-switch, toast-service,
tool-panel-builders, tutorial-service, world-service.

**src root + shared (10):** `main.ts`; `shared/`: constants, custom-dye, dye-name, error-handler,
example-link, fatal-error, format, logger, palette-export (head), preset-i18n, subscription-manager,
tool-config-types, utils.

**Non-TS / config (2):** `functions/_middleware.ts`, `public/_headers`.

**Tests sampled (7):** `services/__tests__/`: storage-service, keyboard-service, api-service-wrapper,
share-service, auth-service, config-controller, collection-service(-branches);
`shared/__tests__/logger.test.ts`.

**Cross-unit files opened to confirm a claim (5):** `components/v4-layout.ts`,
`components/v4/config-sidebar.ts`, `components/{accessibility,comparison,extractor,harmony}-tool.ts`
(share/param blocks only), `packages/core/src/services/color/ColorConverter.ts`,
`packages/core/src/data/dyes.json`, `apps/presets-api/src/handlers/presets.ts` (404 body).
