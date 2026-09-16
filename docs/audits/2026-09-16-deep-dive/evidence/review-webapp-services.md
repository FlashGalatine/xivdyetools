# Review: webapp-services (apps/web-app/src/services/)

Unit: `webapp-services`. Scope: every non-test file under `apps/web-app/src/services/`
EXCEPT `mixer-blending-engine.ts`, `chara-resolve-service.ts`, `harmony-generator.ts`,
`market-board-service.ts`, `world-service.ts`, `pricing-mixin.ts`, `tool-panel-builders.ts`,
`config-controller.ts` (owned by other reviewers). `camera-service.ts` does not exist in this
worktree (listed in the assignment but not present).

## 1. Map

| File | Lines | Role |
|---|---|---|
| `auth-service.ts` | 849 | OAuth (Discord/XIVAuth) PKCE login, JWT decode/storage, cross-tab sync |
| `collection-service.ts` | 1105 | Favorites/collections store, 4.x→5.0 stainID migration, import/export |
| `share-service.ts` | 663 | Share-URL generate/parse, stainID/hex grammar, clipboard |
| `preset-submission-service.ts` | 657 | Submit/edit/delete community presets, client validation |
| `tutorial-service.ts` | 627 | Spotlight tutorial state machine + prompt modal |
| `theme-service.ts` | 384 | Theme palette apply, legacy-name migration |
| `language-service.ts` | 387 | Locale load/cache, `t()` fallback chain |
| `indexeddb-service.ts` | 428 | IDB wrapper (price_cache/palettes/settings), v3 schema upgrade |
| `hybrid-preset-service.ts` | 465 | Local+community preset merge |
| `community-preset-service.ts` | 540 | presets-api HTTP client, cache, voting |
| `router-service.ts` | 420 | History API router, `ROUTES`, legacy redirects |
| `storage-service.ts` | 344 | localStorage wrapper (JSON parse guarded, TTL) |
| `toast-service.ts` | 232 | Toast queue + timers |
| `telemetry-service.ts` | 273 | Opt-in analytics, dwell clock, beacon/fetch send |
| `modal-service.ts` | 301 | Modal stack (max 3), subscribe |
| `keyboard-service.ts` | 268 | Global shortcuts, shadow-DOM-aware typing guard |
| `api-service-wrapper.ts` | 266 | Core APIService + IndexedDB cache backend |
| `saved-presets-service.ts` | 168 | Saved-preset snapshots, legacy dye-id migration |
| `display-options-helper.ts` | 143 | Shared display-options diff/apply |
| `dye-service-wrapper.ts` | 92 | DyeService singleton, `resolvePresetDye`/`toStainId` |
| `theme-switch.ts` | 33 | The one path that records `theme_change` telemetry |
| `api-worker-origin.ts` | 19 | `data.xivdyetools.app` base-URL resolution |
| `index.ts` | 128 | Barrel: `initializeServices()`, re-exports |

## 2. Candidates

### webapp-services-01 — BUG — MEDIUM
`apps/web-app/src/services/collection-service.ts:931` (guard) and `:626` (crash site)

**Claim:** `CollectionService.importData()` validates an imported collection's `name`
with `!collection.name` (falsy check only, not a type check), then passes it straight
into `createCollection(name, …)`, which unconditionally calls `name.trim()`.

**Failing input → wrong outcome:** Import a JSON export whose 2nd collection has
`"name": 42` (any truthy non-string — a plausible product of a future schema version
or a hand-edited file) with a 1st and 3rd collection that are well-formed. `!42` is
`false`, so validation passes; `createCollection(42, …)` throws
`TypeError: name.trim is not a function`. The exception propagates out of the
`for` loop inside the outer `try`, is caught by `importData`'s own `catch`, which
pushes `{code:'parseFailed'}` and returns. Collection 1 (processed before the crash)
was already `saveCollections()`-written to storage, but the 3rd collection is never
processed, and the caller sees `success:false` — a misleading result: partial
persisted writes reported as total failure, silently dropping every subsequent
record in the file.

**Why tests miss it:** `collection-service-branches.test.ts` covers "name missing"
(`undefined`, falsy) and "dyes not an array", never "name present but non-string".
`loadCollections()` (own-storage path) *does* check `typeof collection.name === 'string'`
(line 278) — `importData` (foreign-file path) does not, an inconsistency with the
file's own WEB-6 philosophy ("skip malformed records, don't crash the whole op").

**Covered by test:** No.

```ts
// collection-service.ts:930-935
if (!collection.name || !Array.isArray(collection.dyes)) {
  result.errors.push({ code: 'skippedInvalid', name: collection.name });
  continue;
}
// ...later: this.createCollection(name, collection.description, {...})
// createCollection: const trimmedName = name.trim();  // throws if name is a number
```

**Fix direction:** Add `typeof collection.name === 'string'` (and `typeof
collection.description === 'string' | undefined`) to the same guard `loadCollections()`
already uses, so one malformed record is skipped (`skippedInvalid`) instead of
aborting the whole import.

---

### webapp-services-02 — BUG — MEDIUM
`apps/web-app/src/services/auth-service.ts:589-603`

**Claim:** `isAuthenticated()` fire-and-forgets a full `logout()` (server revoke
fetch + `clearStorage` + `clearState` + `notifyListeners`) every time it is called
while the stored token is expired, with no in-flight guard.

**Failing input → wrong outcome:** Token expired, then any render pass that calls
`authService.isAuthenticated()` from more than one place synchronously (real call
sites: `preset-detail.ts` ×3, `community-preset-service.ts` ×3,
`preset-submission-service.ts` ×5, `config-sidebar.ts`, `preset-tool.ts` — several of
these run together on the Presets tool's initial render/vote-check pass). Each call
sees `this.state.isAuthenticated === true` and `expiresAt` still stale (state isn't
cleared until the *first* `logout()`'s `await fetch(...)` resolves), so each one
independently calls `void this.logout()`: N concurrent `POST /auth/revoke` requests
and N `notifyListeners()` broadcasts instead of one.

**Why tests miss it:** `auth-service.test.ts` calls `isAuthenticated()` in isolation;
no test exercises multiple simultaneous callers against one expired token.

**Covered by test:** No.

```ts
// auth-service.ts:594-601
if (this.state.expiresAt !== null) {
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(this.state.expiresAt) || this.state.expiresAt < now) {
    void this.logout();   // no re-entrancy guard
    return false;
  }
}
```

**Fix direction:** Track an in-flight logout promise (`private loggingOut:
Promise<void> | null`) and return it / no-op on a second call while it is pending,
mirroring the pattern already used for `AuthService.initialize()`'s own guard.

---

### webapp-services-03 — UNTESTED — MEDIUM
`apps/web-app/src/services/router-service.ts` (mechanism, in scope) /
`apps/web-app/src/components/gradient-tool.ts:23` +
`apps/web-app/src/components/__tests__/gradient-tool.test.ts:201-205` (violation site,
adjacent — components/ is owned by another reviewer, flagged here because it is this
unit's named emphasis: "`RouterService` imported from the `@services/index` barrel").

**Claim:** `router-service.ts`'s `RouterService` is reachable through two import
specifiers that resolve to the same module (`@services/router-service` directly, and
`@services/index` which re-exports it). `gradient-tool.ts` imports it via the direct
path; `gradient-tool.test.ts` only mocks the barrel path. The two are never the same
mock, so the mocked `RouterService.navigateTo` spy at test lines 201-205 is dead code —
`gradient-tool.ts`'s five `RouterService.navigateTo(...)` call sites (lines 2061-2103)
run against the real, un-mocked singleton inside the jsdom test environment instead.

**Failing input → wrong outcome:** Click a hand-off action in `GradientTool` under
test (e.g. the "compare these" button) — the assertion a future test author writes
against the mocked spy (`expect(RouterService.navigateTo).toHaveBeenCalledWith(...)`)
would never see the call, because the code path that actually ran mutated the real
`window.location`/`history` state instead. No current test asserts on this mock, so
today it's a silent no-op rather than a red test, but the mock block is misleading
cover and the real singleton's mutated `history`/`currentToolId` state is not reset
between tests in that file.

**Why tests miss it:** The mock exists (looks like coverage) but is never wired to
the import path the component actually uses — indistinguishable from real coverage
without checking both files side by side. `v4-layout.test.ts` gets this right (mocks
*both* `@services/router-service` and `@services/index`); `gradient-tool.test.ts` and
`welcome-modal.ts` (no test file at all) do not.

**Covered by test:** No (mock present but inert).

```ts
// gradient-tool.ts:23
import { RouterService } from '@services/router-service';   // bypasses the barrel
// gradient-tool.test.ts:201-205
vi.mock('@services/index', () => ({
  RouterService: { subscribe: vi.fn(...), navigateTo: vi.fn() },  // never hit
}));
```

**Fix direction:** Either import `RouterService` from `@services/index` in
`gradient-tool.ts` (consistent with `keyboard-service.ts`/`share-service.ts`'s own
convention documented in memory), or add a second `vi.mock('@services/router-service',
...)` in the test so the mock actually intercepts what the component imports.

## 3. POSITIVE

- `auth-service.ts`'s OAuth PKCE flow is thoroughly hardened against its own prior
  incidents: UTF-8-safe JWT decode (BUG-060), NaN/ms-vs-s expiry guards (BUG-063),
  provider-spoofing via `?provider=` (FINDING-032/WEB-3), and open-redirect-safe
  `sanitizeReturnPath()` — do not re-file any of these.
- `share-service.ts`'s stainID-vs-legacy-itemID grammar (`resolveSharedDye` rejects
  anything ≥ 5729 loudly, never silently resolves) and the `LIST_PARAMS` arity fix
  (BUG-015) are correct and well-tested.
- `CollectionService`'s load-time migration (`migrateDyeIds`/`toStainId`) correctly
  drops unresolvable refs, dedupes post-migration collisions, and persists once —
  solid outside the `importData` gap above.
- `TelemetryService`'s opt-in gating is correctly end-to-end: `isEnabled()` re-checked
  on every `track()`/`flush()`, `dropQueue()` on toggle-off, GPC honored, and the
  `theme_change`-flushes-first-so-old-events-keep-the-old-theme ordering in
  `theme-switch.ts` matches the documented contract.
- `KeyboardService`'s shadow-DOM-aware `isUserTyping()` (via `composedPath()[0]`) and
  `isBareShift()` modifier guard correctly fix the two documented real incidents
  (typing in a shadow-DOM input firing shortcuts; Ctrl+Shift+T flipping the theme).

## 4. REJECTED

- `auth-service.ts` `initialize()` sets `this.initialized = true` only after its async
  body completes, which looks like a double-`addEventListener('storage', …)` race if
  called twice concurrently — but its one call site (`services/index.ts:99`) never
  does that, so it is not reachable in production.
- `saved-presets-service.ts`'s `migrateLegacyDyeIds()` "skip while dye DB cold" branch
  looked like a load-order race against `dyeService.isLoadedStatus()` — but
  `DyeService`'s constructor calls `database.initialize()` synchronously
  (`packages/core/src/services/DyeService.ts:78-86`) and `dyeService` is a
  module-level singleton evaluated at import time, so `isLoadedStatus()` is always
  `true` by the time any caller can reach `load()`. No async gap exists.
- `indexeddb-service.ts`'s cached `initPromise` never rejects (every internal branch
  resolves, even on error) — does not reproduce the "poisoned rejected promise"
  pattern flagged elsewhere in the codebase; a failed open just permanently reports
  `false` for that page session, which is the intended degrade-to-memory-only design.
- `preset-submission-service.ts` `editPreset()`'s inline dye validation checks range
  before type (`>= LEGACY_ITEM_ID_FLOOR` / `> MAX_STAIN_ID` before the `typeof ===
  'number'` check), unlike `validateSubmission()`'s order — a `null` entry would be
  coerced to `0` and reported as `dyesRange` instead of `dyesInvalid`. Cosmetically
  wrong error code, but still rejected either way, no crash; not worth a separate
  finding.
- `ShareService.SHARE_URL_VERSION` stays `1` across the 5.0 stainID-grammar rewrite —
  looked like a missed version bump, but `resolveSharedDye`'s own `>= 5729` range
  check is what actually disambiguates old vs. new links, not the `v=` param; the
  version field was never load-bearing for that distinction.

## 5. COVERED

23 files read in full (entire assigned scope, `camera-service.ts` absent from the
worktree):

`auth-service.ts`, `index.ts`, `share-service.ts`, `indexeddb-service.ts`,
`storage-service.ts`, `theme-service.ts`, `theme-switch.ts`, `telemetry-service.ts`,
`router-service.ts`, `language-service.ts`, `keyboard-service.ts`, `modal-service.ts`,
`toast-service.ts`, `display-options-helper.ts`, `dye-service-wrapper.ts`,
`collection-service.ts`, `saved-presets-service.ts`, `api-service-wrapper.ts`,
`api-worker-origin.ts`, `hybrid-preset-service.ts`, `community-preset-service.ts`,
`preset-submission-service.ts`, `tutorial-service.ts`.

Supporting reads (entry points / tests, to confirm claims — not owned by this unit):
`apps/web-app/src/services/__tests__/collection-service-branches.test.ts`,
`apps/web-app/src/services/__tests__/dye-service-wrapper.test.ts`,
`apps/web-app/src/services/__tests__/saved-presets-service.test.ts`,
`apps/web-app/src/components/gradient-tool.ts` (grep + targeted read),
`apps/web-app/src/components/__tests__/gradient-tool.test.ts`,
`apps/web-app/src/components/__tests__/v4-layout.test.ts` (grep),
`packages/core/src/services/DyeService.ts`,
`packages/core/src/services/dye/DyeDatabase.ts` (partial).
