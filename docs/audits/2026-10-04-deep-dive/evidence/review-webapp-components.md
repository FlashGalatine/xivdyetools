# Review: webapp-components (22 files, apps/web-app/src/components)

## Map
| Module | Role |
|---|---|
| base-component.ts | BaseComponent lifecycle, error boundary, listener/timer tracking |
| v4-layout.ts | shell bootstrap, lazy tool load (navigationSeq guard), tutorial prompt, telemetry hooks |
| modal-container.ts / toast-container.ts | 16A modal shell (stack, focus trap, sheet drag) / toast host |
| tutorial-spotlight.ts | coach-mark overlay (NO test file) |
| collection-manager-modal.ts, add-to-collection-menu.ts | collections CRUD modal, dye->collection menu |
| my-submissions-modal.ts, preset-submission-form.ts, preset-category-selector.ts, signin-modal.ts | community-preset flows |
| about/changelog/welcome/shortcuts/advanced-options/export-sheet | informational + settings modals |
| market-board.ts, metric-help.ts, empty-state.ts, collapsible-panel.ts, offline-banner.ts | shared widgets |

## Candidates

### webapp-components-01 BUG MEDIUM tutorial-spotlight.ts:170 (also :257-267) - origin MAIN
Claim: the BUG-086 "reposition on scroll" fix listens on `window`, but tools scroll inside the shell's shadow DOM (`.v4-layout-content-scroll`, overflow-y:auto, v4-layout-shell.ts:169-171; host is height:100vh overflow:hidden, :90-100; `.v4-tool-main` also overflow-y:auto, v4-layout.ts:589). Scroll events do not bubble and never reach window, so the spotlight never follows content scrolling. `showStep` also calls `scrollIntoView({behavior:'smooth'})` (:534) then measures at a fixed 100 ms (:264-267) while the smooth scroll is mid-flight; ResizeObserver does not fire for it.
Failing state: tutorial step whose target is within 100 px of the viewport edge (rect.top<100 or bottom>vh-100) -> container smooth-scrolls -> spotlight/tooltip placed at the pre-scroll/mid-scroll rect and stay there; user scrolls content -> highlight detached from target.
Tests: none; covered: no.
Excerpt: `this.on(window as unknown as HTMLElement, 'scroll' ..., () => { if (this.currentStep) this.updatePositions(); })` (:170-174); the comment at :162-169 admits capture-phase ancestors are "left alone".
Fix: attach a scroll listener to the target's scrollable ancestors (walk parentElement / getRootNode().host and add/remove manually), and re-run updatePositions after scroll settles (scrollend, or rAF poll ~600 ms after scrollIntoView). Non-composed scroll events cannot be caught from a document capture listener across the shadow boundary.

### webapp-components-02 UNTESTED MEDIUM tutorial-spotlight.ts:1 - origin MAIN
No test file exists for the component (git ls-files has only the source). Untested behaviours: scroll/resize repositioning (01), `showStep` missing-target skip (:249-254, leaves a stale `currentTarget` from the previous step so resize repositions to the old element), `hide()` 300 ms display:none timeout (:580-587) that is not cancelled by a following `show()` (a tutorial started <300 ms after one ended would be hidden while active), `bindEvents` re-subscribing `TutorialService.subscribe` without clearing `unsubscribe` (:133) if `update()`/retry ever runs.
Fix: add a jsdom test with a scrollable ancestor in a shadow root; cancel the hide timer in show().

### webapp-components-03 BUG MEDIUM collection-manager-modal.ts:68-70 - origin MAIN
Claim: "New collection" in the manager calls `showCreateCollectionDialog()` with no callback. On create it only `dismissTop()`s itself (:328); the manager list beneath is built once (:101-110) and never refreshed, unlike edit/delete (`onRefresh`) and import (:591-592).
Failing: open manager -> New collection -> Create -> toast "created" -> manager still shows the old list/count/empty state; the new collection is invisible until reopen; the Create button's `canCreateCollection()` disabled-state is also stale (can click past the limit and get a saveFailed toast).
Tests: collection-manager-modal.test.ts only calls the dialog directly (:151,:166); covered: no.
Fix: pass a callback that does `ModalService.dismissTop(); showCollectionManagerModal();` mirroring the other refresh paths (the create handler dismisses the dialog itself before calling it, so the callback dismisses the manager).

### webapp-components-04 BUG MEDIUM my-submissions-modal.ts:206-222 - origin MAIN
Claim: delete flow leaves the My Submissions modal showing the deleted row. ModalContainer's confirm click runs `onConfirm()` (async, unawaited) and then immediately `ModalService.dismiss(modal.id)` (modal-container.ts:347-350), so the confirm closes at once; on success the handler calls `onChanged?.()` which only reloads the preset tool list beneath (preset-tool.ts:1081-1084). The modal's rows/stat tiles are static HTML built once (:89-176).
Failing: Delete -> confirm -> success toast -> the row, "published/awaiting" tiles and votes subtitle are unchanged; clicking Delete again hits the API for a gone preset -> `errors.deletePresetFailed` toast. The extra `ModalService.dismiss(confirmId)` at :216 also logs "Modal not found" (modal-service.ts:209).
Tests: my-submissions-modal.test.ts asserts only that buttons render (:110); covered: no.
Fix: after a successful delete remove the row (or dismiss and re-open `showMySubmissionsModal(onChanged)`); drop the redundant dismiss.

### webapp-components-05 BUG LOW empty-state.ts:55 - origin MAIN
`LanguageService.t(...).replace('{query}', query)` passes the user's search text as a replacement STRING, so `$&`, `$'`, `` $` ``, `$1` in the query are expanded. Query `$&` -> title reads "No results for {query}"; `a$'b` splices the tail of the template into the title. Fix: `.replace('{query}', () => query)` or `tInterpolate`. Not tested (no `$` case).

### webapp-components-06 BUG LOW modal-container.ts:265-292 - origin MAIN
Mobile sheet drag engages whenever the modal BODY is at scrollTop 0, ignoring inner scrollers. Collection manager (`max-h-96 overflow-y-auto`, collection-manager-modal.ts:99), the dye grid (`max-h-48`, preset-submission-form.ts:457) and the export `<pre>` (`overflow:auto`) are inner scrollers. Dragging down to scroll an inner list that is scrolled away from its top translates the whole sheet; a >90 px pull dismisses the modal (and with it an unsent submission form). `touchcancel` is not handled, so a system-cancelled gesture leaves `transform: translateY(..)` and `transition:none` stuck until the next touchstart. Fix: skip engagement when the touch target has a scrollable ancestor below `body` with scrollTop>0; add touchcancel -> reset.

### webapp-components-07 BUG LOW toast-container.ts:168-203 - origin MAIN
Every ToastService notification clears and rebuilds ALL toasts (`clearContainer` then `createToastElement`), re-adding `toast-animate-in` to survivors and re-inserting `role="alert"`/`aria-live="assertive"` nodes. Failing: an error toast is on screen, a second toast arrives (or one is dismissed) -> the first replays its entrance animation and screen readers re-announce it. Fix: keep a `Map<id, HTMLElement>` and diff. Also Escape dismisses a toast and closes the top modal in one keypress (toast :72-77 vs modal-container.ts:204-209, both on `document`).

### webapp-components-08 BUG LOW preset-submission-form.ts:725,729-731,758 - origin MAIN
(a) `ModalService.dismissTop()` runs after `await submitPreset()` and, in the success path, after `await uploadPreviewImage()` (:751-758): the BUG-088 pattern fixed in my-submissions-modal but not here, and `showPresetSubmissionForm` discards the modal id (:104). If the user closes the form (Esc/backdrop are enabled) or opens another modal during the upload, the later `dismissTop()` closes a different modal. (b) `sessionStorage.setItem('pendingPresetId', ...)` (:730) sits inside the same `try`; if storage throws (blocked/private mode) the catch shows `errors.submitPresetFailed` after a duplicate/vote success was already toasted and the modal dismissed. Fix: capture the id from `ModalService.show` and `dismiss(id)`; wrap the storage write.

### webapp-components-09 BUG LOW advanced-options-panel.ts:320-327 - origin MAIN
Settings import applies the file's `advanced` block via `importConfigs`, including `analyticsEnabled` (config-controller.ts:409-419 sanitizes shape, not intent). A settings JSON obtained elsewhere with `"analyticsEnabled": true` silently opts the user into telemetry, which is documented as default-off opt-in. Fix: strip `analyticsEnabled` on import (or confirm). The failure path also uses native `alert()` (:327), the pattern REFACTOR-005 removed for `confirm()`; use ToastService.

### webapp-components-10 BUG LOW collapsible-panel.ts:96-99 - origin MAIN
Collapsed state is `max-height:0; opacity:0; overflow:hidden` only: the hidden panel's inputs/buttons stay in the tab order and accessibility tree (no `inert`/`hidden`/`visibility`). Open state is capped at `max-height:1000px` with overflow hidden, so content taller than 1000 px is clipped. Fix: set `inert` when closed; use `grid-template-rows` or `max-height: none` after the transition.

### webapp-components-11 BUG LOW collection-manager-modal.ts:535,575-606 - origin MAIN
(a) Export filename `collection.name.replace(/[^a-z0-9]/gi,'-')` turns an all-CJK collection name (ja/ko/zh, 6-locale app) into `xivdyetools-----.json`; two such exports collide. (b) `triggerImport` appends the file input, `click()`s, then `remove()`s it synchronously (:604-606); a detached `<input type=file>` still fires `change` in Chromium/Firefox but not reliably in Safari, where import may silently do nothing. Fix: sanitize with `\p{L}\p{N}` or fall back to the id; keep the input attached until `change`.

## POSITIVE
- v4-layout.ts: navigationSeq guards after every await, bootEntry consumed before the first await, tutorial timer cleared/validated (BUG-040/065/078 hold; welcome-modal exemption intact).
- modal-container.ts re-binds listeners for surviving modals each render (BUG-009) and restores prior body overflow (:595).
- my-submissions-modal.ts escapes `preset.name` and `rejection_reason` (FINDING-011); only code-controlled values are interpolated.
- market-board.ts clears the dropdown before repopulating (BUG-076) and unsubscribes service events and the language subscription in destroy.
- changelog-modal.ts generation counter + catch on the dynamic import (BUG-090) are correct; about-modal/shortcuts/welcome have no unsafe innerHTML of remote data.
- base-component.ts unbinds before every re-render/retry/reset and `safeTimeout` is destroy-safe.
- metric-help.ts band cuts match core's `BAND_VOCABULARY.separation` ordering (ascending cuts reversed to descending UI bands).

## REJECTED
- MarketBoard double `server-changed` emit (service relay at market-board.ts:445-457 plus the local emit at :300/:544): no component listens to the DOM event (git grep of components/), tools read ConfigController instead; harmless.
- offline-banner `body.style.paddingTop` with a 100vh host and Tailwind `z-50` possibly under shell chrome (offline-banner.ts:86,146): could not confirm layering without a browser run; not filed.
- collection delete confirm double-dismiss (collection-manager-modal.ts:190-195 vs container dismiss): second dismiss is a logged no-op; ordering works (confirm closed first, so `dismissTop` in onRefresh targets the manager).
- `dye.stainID ?? 0` in add-to-collection-menu.ts:68,103: dead defence at worst; not demonstrated to add a bogus dye.
- changelog popup (new instance) plus header modal (singleton) can both open: requires clicking within 1 s of an auto popup; cosmetic.
- signin-modal double click starting two OAuth redirects: handled by authService state (outside slice); not verifiable here.

## COVERED
22 files read in full: about-modal, add-to-collection-menu, advanced-options-panel, base-component, changelog-modal, collapsible-panel, collection-manager-modal, empty-state, export-sheet, market-board, metric-help, modal-container, my-submissions-modal, offline-banner, preset-category-selector, preset-submission-form, shortcuts-panel, signin-modal, toast-container, tutorial-spotlight, v4-layout, welcome-modal. Tests skimmed by grep only (my-submissions, collection-manager, absence of a tutorial-spotlight test). Supporting reads: modal-service.ts, market-board-service.ts, config-controller.ts (importConfigs), v4-layout-shell.ts CSS, core band-vocabulary.ts.
