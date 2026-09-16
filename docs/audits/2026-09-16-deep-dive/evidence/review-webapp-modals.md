# Review: webapp-modals

Unit: `webapp-modals` — app `apps/web-app`, deploy unit web-app.
Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-16` (origin/main 79a69d1f).

## 1. Map

| Module | Role |
|---|---|
| `components/modal-container.ts` | Modal stack host (16A shell): listener rebinding, z-order, body-overflow restore |
| `components/base-component.ts` | Abstract lifecycle base every non-Lit component extends (init/update/destroy, error boundary) |
| `components/preset-submission-form.ts` | New community-preset form (imperative DOM) |
| `components/preset-edit-form.ts` | Owner-only preset edit form (imperative DOM) |
| `components/preset-category-selector.ts` | Shared primary/secondary category chip control |
| `components/changelog-modal.ts` + `vite-plugin-changelog-parser.ts` | "What's New" — build-time CHANGELOG-laymans.md parser + runtime modal |
| `components/welcome-modal.ts` / `about-modal.ts` / `signin-modal.ts` | First-visit / info / auth-gate modals |
| `components/my-submissions-modal.ts` | Author's own preset list, status chips, delete/edit actions |
| `components/collection-manager-modal.ts` | Collections CRUD + JSON import/export (no test file) |
| `components/add-to-collection-menu.ts` | Floating quick-add menu (no test file) |
| `components/toast-container.ts` | ToastService host, swipe-to-dismiss |
| `components/tutorial-spotlight.ts` | Coach-mark overlay, shadow-DOM-aware target lookup |
| `components/offline-banner.ts` | online/offline banner singleton |
| `components/empty-state.ts` / `collapsible-panel.ts` / `shortcuts-panel.ts` | Reusable UI pieces |
| `main.ts` | Bootstrap: services → v4 layout → welcome/changelog → offline banner |
| `shared/*.ts` | escapeHtml, error mapping, logger façade, preset i18n, example-link allowlist, custom-dye factory, constants, method-tag mirror |
| `scripts/check-bundle-size.js`, `public/_headers` | Deploy-gating bundle budget; Pages CSP/cache headers |

## 2. Candidates

**webapp-modals-01** — BUG, MEDIUM (latent — no current caller) — `apps/web-app/src/components/base-component.ts:306-323,419-432` vs `:148-163,437-446`
`handleRenderError()`/`renderError()` and `handleRetry()` never call `unbindAllEvents()`, unlike `update()` and `handleReset()`, which both do.
Failing input → wrong outcome: a subclass whose handler calls `this.safeAsync(op)` after an initial successful render (real `this.on()` listeners bound) — if `op` rejects, `renderError()` wipes the content DOM without releasing those listener-map entries; a later successful `handleRetry()` calls `bindEvents()` again, stacking a fresh set on top of the still-present stale ones (now pointing at detached nodes). Repeated fail→retry cycles grow `this.listeners` unboundedly; only `destroy()`/`update()` ever clear it.
Why tests miss it: `base-component.test.ts`'s `safeAsync` tests assert only the return value and `hasErrorState()`, never `getListenerCount()` post-failure.
Covered by test: no.
```ts
protected handleRetry(): void {
  if (this.isDestroyed) return;
  this.errorState.retryCount++;
  this.errorState.hasError = false;
  this.render();                       // no unbindAllEvents() first
  if (!this.errorState.hasError) {
    this.bindEvents();                 // stacks onto whatever survived
  }
}
```
Fix direction: call `this.unbindAllEvents()` at the top of `handleRenderError()` (or `renderError()`), mirroring `handleReset()`.
Caveat: `grep -r safeAsync apps/web-app/src` finds only `base-component.ts` and its own test — no shipped component calls it today, so this cannot fire in production yet; filed because it's a real, provable defect in shared lifecycle code that the next `safeAsync` caller will inherit silently.

**webapp-modals-02** — UNTESTED — `apps/web-app/src/components/collection-manager-modal.ts:5`
Whole 640-line file (`/* istanbul ignore file */`) has no matching test file (`Glob apps/web-app/src/components/**/collection-manager-modal*` → source only) and is excluded from the coverage gate rather than merely under-tested. It carries real logic: JSON import/export via Blob URLs, a destructive-delete confirm flow, per-dye removal that re-opens the dialog by re-fetching `CollectionService.getCollection(id)!` with a non-null assertion. A regression here (e.g. the delete confirm never calling `onRefresh`, or the `!` throwing if the collection vanished mid-edit) would not fail any gate.
Covered by test: no (file has none).
Fix direction: add a unit suite, or at minimum drop the coverage-ignore pragma so the ratchet can see the gap.

**webapp-modals-03** — UNTESTED — `apps/web-app/src/components/add-to-collection-menu.ts:1`
Same pattern: `/* istanbul ignore file */`, no test file, real logic (OPT-004 pending-timeout tracking, positioning math, add/remove).
Covered by test: no.

**webapp-modals-04** — BUG, LOW — `apps/web-app/src/components/add-to-collection-menu.ts:53,61-66`
`menuWidth = 200` is the constant used for the right-edge off-screen check, but the menu's actual rendered width is CSS `min-w-48 max-w-64` (192–256px depending on the longest collection name). For a viewport where `rect.left + 200 <= window.innerWidth` but the real (up to 256px-wide) menu would overflow, the check passes and the menu renders with its right edge up to 56px past the viewport edge.
```ts
const menuWidth = 200;
...
if (left + menuWidth > window.innerWidth) {
  left = window.innerWidth - menuWidth - 8;
}
```
Why tests miss it: no test file for this component at all (see -03).
Covered by test: no.
Fix direction: measure the actual element (`menu.offsetWidth` after an initial off-screen append, or match `menuWidth` to the CSS max) instead of a hardcoded 200.

**webapp-modals-05** — BUG, LOW — `apps/web-app/src/components/preset-edit-form.ts:117-119,698`
Load: `preset.dyes.map(dyeId => resolvePresetDye(dyeId) ?? null).filter(d => d !== null)` — `resolvePresetDye` (dye-service-wrapper.ts) returns `undefined` for any id outside 1-254 or not present in the current dye table (a plausible state for a preset stored before a catalog change). Any such id is silently dropped from `state.selectedDyes` at load time.
Save: `if (dyes.join(',') !== preset.dyes.join(',')) updates.dyes = dyes;` (dyes = the current `state.selectedDyes` stainIDs). Because the load step already shrank the array, this comparison differs from the stored value even when the user changed nothing else, so opening the form and clicking Save with a completely untouched dye list still sends a `dyes` patch that permanently drops the unresolvable id from the live preset — silent data loss with no toast/warning that a dye was removed.
Why tests miss it: would need a `resolvePresetDye`-returns-`undefined` fixture; `preset-edit-form.test.ts` (not read in full for time) was not checked for this scenario — flagged as a plausible gap, not confirmed absent.
Covered by test: not verified either way.
Fix direction: warn the user (or refuse silently-lossy saves) when `preset.dyes.length !== dyeObjects.length` at load time, the same way `preset-submission-form.ts`'s stainID filter is a no-op today only because Facewear dyes are pre-excluded.

## 3. POSITIVE

- `modal-container.ts` — BUG-009 (listener loss on incremental modal re-render) is correctly fixed: `bindModalListeners()` is idempotent and re-run from `renderContent()` for every surviving modal, independent of `bindEvents()` (which only owns the document `keydown` listener). Verified by reading both the render path and `onUpdate()`.
- `modal-container.ts:584-599` — the body-overflow restore bug (blanking `overflow` on the very first render because `priorBodyOverflow` was still `null`) is correctly fixed with the `this.priorBodyOverflow !== null` guard; a dedicated regression test (`modal-container.test.ts`) exists for it.
- `my-submissions-modal.ts` correctly `escapeHtml()`s every remote/author-controlled string (preset name, moderation rejection reason) before interpolating into an `innerHTML` template, per FINDING-011; all other interpolations in that file are code-controlled.
- `example-link.ts` mirrors the presets-api host allowlist client-side and applies the identical policy on both the write path (`exampleLinkError`) and the read path (`sanitizeExampleLink`), closing the WEB-14 gap where a stored value could bypass the write-time check.
- `preset-category-selector.ts`'s rank-by-selection-order design (primary = first pick, removing primary promotes the next) is clean, has no off-by-one, and correctly refuses to let a preset go category-less.
- `preset-submission-form.ts` never sources its prefillable `name` from a character identity itself — it only accepts whatever string a caller passes; the character-name privacy rule is the caller's (`swatch-tool.ts`, out of scope) responsibility, and this file adds no violation of its own.

## 4. REJECTED

- Suspected `dye.id`/`dye.itemID` collision across dyes sharing a consolidated market itemID (would break `selectedDyes.some(d => d.id === dye.id)` dedup in the submission/edit dye pickers) — checked `packages/core/src/services/dye/DyeDatabase.ts:200-217,325-336`: `itemID` is the per-dye `legacyItemID` (e.g. 5729), never the consolidated 52254/52255/52256 market id; consolidation is a separate `getMarketItemID()` lookup that doesn't touch `Dye.itemID`. No collision.
- `preset-submission-form.ts:683` `.filter(id => id !== null)` on `d.stainID` silently dropping dyes without a stainID — the dye picker already filters `category !== 'Facewear'` (the only class that lacks one), so this is dead code today, not a reachable bug.
- `offline-banner.ts` unconditionally blanking `document.body.style.paddingTop` on hide (same shape as the historical modal-container overflow bug) — grepped the whole app; `offline-banner.ts` is the sole writer of `body.style.paddingTop`, so there is nothing else to clobber.
- `collection-manager-modal.ts:605-607` `input.click(); input.remove();` immediately after triggering a native file picker — standard, cross-browser-safe idiom; the `change` listener still fires on the detached node when the user picks a file.
- `changelog-modal.ts` / `vite-plugin-changelog-parser.ts` — read in full looking for a regression of BUG-090 (unhandled `import()` rejection) and BUG-043 (empty-header `??` vs `||` short-circuit); both fixes are intact and well-covered by inline reasoning matching the current code.

## 5. COVERED

34 files read in full or to the relevant section:
`components/modal-container.ts`, `components/base-component.ts`, `components/__tests__/base-component.test.ts`, `components/__tests__/modal-container.test.ts` (partial), `components/preset-submission-form.ts`, `components/preset-edit-form.ts`, `components/preset-category-selector.ts`, `components/changelog-modal.ts`, `vite-plugin-changelog-parser.ts`, `components/toast-container.ts`, `components/tutorial-spotlight.ts`, `components/collection-manager-modal.ts`, `components/signin-modal.ts`, `components/welcome-modal.ts`, `components/about-modal.ts`, `components/my-submissions-modal.ts`, `components/offline-banner.ts`, `components/add-to-collection-menu.ts`, `components/empty-state.ts`, `components/collapsible-panel.ts`, `components/shortcuts-panel.ts`, `main.ts`, `shared/utils.ts`, `shared/example-link.ts`, `shared/error-handler.ts`, `shared/subscription-manager.ts`, `shared/preset-i18n.ts`, `shared/custom-dye.ts`, `shared/dye-name.ts`, `shared/constants.ts`, `shared/browser-api-types.ts`, `shared/method-tags.ts`, `shared/logger.ts`, `shared/ui-icons.ts` (header + sample), `shared/fatal-error.ts`, `shared/format.ts`, `scripts/check-bundle-size.js`, `public/_headers`.

Read for cross-file verification (out of scope, not separately findable): `packages/types/src/dye/dye.ts` (Dye.stainID/itemID contract), `packages/core/src/services/dye/DyeDatabase.ts` (itemID normalisation), `apps/web-app/src/components/swatch-tool.ts:1510-1553` (name-prefill call site, owned by another reviewer), `apps/web-app/src/services/dye-service-wrapper.ts:57-63` (`resolvePresetDye`).

Not read (lower-risk, static-constant or type-only, budget-limited): `shared/beta-branding.ts`, `shared/app-logo.ts`, `shared/state-icons.ts`, `shared/social-icons.ts`, `shared/tool-icons.ts`, `shared/category-icons.ts`, `shared/glyph-accent.ts`, `shared/i18n-types.ts`, `shared/region-name.ts`, `shared/types.ts`, `vite-env.d.ts`, `preset-submission-form.test.ts` / `preset-edit-form.test.ts` (full bodies).
