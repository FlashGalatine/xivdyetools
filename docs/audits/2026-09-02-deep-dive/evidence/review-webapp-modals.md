# review — `webapp-modals` (deploy unit: `web-app`)

Worktree `origin/main` e7ac4042. Read-only review of the 19 in-scope modal / overlay / form modules
under `apps/web-app/src/components/`, plus the entry points needed to confirm claims
(`base-component.ts`, `services/modal-service.ts`, `services/keyboard-service.ts`,
`services/preset-submission-service.ts`, `packages/types/src/preset/*`, `tailwind.config.js`).

## 1. Map

| Module | Kind | Entry point | Host / stack |
|---|---|---|---|
| `modal-container.ts` | `BaseComponent` | `new ModalContainer(modalRoot)` (`v4-layout.ts:301`) | light DOM; renders the whole `ModalService` stack (max 3) |
| `services/modal-service.ts` | static singleton | `show / showConfirm / dismiss / dismissTop` | subscription model, `MAX_MODALS = 3` |
| `preset-submission-form.ts` | fn → modal | `showPresetSubmissionForm(onSubmit, initial?)` | `type:'custom'`, `panelWidth:560` |
| `preset-edit-form.ts` | fn → modal | `showPresetEditForm(preset, onEdit?)` | `type:'custom'`, `size:'lg'` |
| `preset-category-selector.ts` | fn → element | `createCategorySelector(sel, onChange?)` | embedded by both forms |
| `my-submissions-modal.ts` | async fn → modal | `showMySubmissionsModal(onChanged?)` | `panelWidth:620`; stacks a `showConfirm` for delete |
| `collection-manager-modal.ts` | fn → modal | `showCollectionManagerModal()` (`dye-selector.ts:543`) | stacks create/edit dialogs; `/* istanbul ignore file */` |
| `add-to-collection-menu.ts` | fn → popover | `showAddToCollectionMenu()` (`dye-grid.ts:305`) | `document.body` popover, not a modal; `/* istanbul ignore file */` |
| `signin-modal.ts` | fn → modal | `showSignInModal()` | `panelWidth:460`; Discord + XIVAuth OAuth redirect |
| `changelog-modal.ts` | class + fns | `showChangelogIfUpdated()`, `showChangelogModal()` (`v4-layout.ts:264`) | lazy `import('virtual:changelog')` |
| `welcome-modal.ts` | class + fn | `showWelcomeIfFirstVisit()` | footer confirm = Get started, cancel = Take the tour |
| `about-modal.ts` | class + fn | `showAboutModal()` (`v4-layout.ts:276`) | singleton |
| `shortcuts-panel.ts` | fn → modal | `showShortcutsPanel()` (`keyboard-service` `?`) | documents the global shortcuts |
| `export-sheet.ts` | fn → modal | `openExportSheet(payload)` | Extractor / Gradient / Comparison / Mixer; footer Copy |
| `tutorial-spotlight.ts` | `BaseComponent` | `initializeTutorialSpotlight()` → `document.body` | overlay + spotlight + tooltip, shadow-piercing target lookup |
| `toast-container.ts` | `BaseComponent` | `ToastService.subscribe` | full re-render per update |
| `offline-banner.ts` | singleton class | `offlineBanner` (module eval) + `initialize()` | `window` online/offline |
| `metric-help.ts` | fns → element | `createMetricHelp` / `createMethodHelp` | rendered **inside** the shell shadow root (inline styles only) |
| `empty-state.ts` | `BaseComponent` + fns | `createEmptyState`, `getEmptyStateHTML` | shared zero-result surface |
| `collapsible-panel.ts` | `BaseComponent` | `new CollapsiblePanel(container, opts)` | accessibility-tool ×4, comparison-tool ×3 |

## 2. Candidates

---

### `webapp-modals-01` — BUG — **HIGH** — `apps/web-app/src/components/modal-container.ts:493-498` (with `base-component.ts:156-158`)

**Claim.** Every change to the modal stack runs `BaseComponent.update()`, which calls
`unbindAllEvents()` and then *skips re-rendering modals it has already rendered* — so every
previously-open modal permanently loses its close-✕, backdrop-click, footer Cancel/Confirm and
sheet-drag listeners.

**Failing input → wrong outcome.** Open My Submissions → press **Delete** on a row
(`my-submissions-modal.ts:202` pushes a `showConfirm` on top) → press **Cancel**. The My
Submissions modal is top again but its ✕ and backdrop no longer close it (only Escape does).
The severe case is the inverse ordering: a `ModalService.showConfirm` defaults to
`closable:false` **and** `closeOnBackdrop:false` (`modal-service.ts:186-187`), and
`handleKeyDown` gates Escape on `topModal.closable` (`modal-container.ts:206`) — so a confirm
modal that has had any modal opened over it and closed again has **no** working exit at all and
needs a page reload.

**Why tests miss it.** `modal-container.test.ts:484-521` stacks two modals but only asserts
`data-under` / `inert` attributes and Escape; no test clicks a *lower* modal's button after a
stack change.

**Covered by test:** no.

```ts
// base-component.ts:154-159 (update)
this.unbindAllEvents();          // removes EVERY this.on(...) listener, incl. per-modal ones
this.render();                   // -> renderContent()
this.bindEvents();               // re-registers ONLY the document keydown

// modal-container.ts:493-498 (renderContent) — already-rendered modals are skipped
this.modals.forEach((modal, index) => {
  if (!this.renderedModalIds.has(modal.id)) { /* createModalElement -> this.on(...) */ }
});
```

**Fix direction.** Re-attach the per-modal listeners on every `renderContent()` (or register them
with raw `addEventListener` on elements the container owns and drops wholesale), instead of
letting `unbindAllEvents()` strip listeners the incremental renderer will never re-create.

---

### `webapp-modals-02` — BUG — **MEDIUM** — `apps/web-app/src/components/preset-edit-form.ts:377`

**Claim.** The edit form's dye picker renders only the first 100 available dyes, so 25 of the 125
dyes are unreachable unless the user guesses a search term.

**Failing input → wrong outcome.** Open the edit form with 0–3 dyes selected; `filteredDyes` is all
125 (`dyes.json` has 125 entries, categories `Neutral | Reds | Browns | Yellows | Greens | Blues |
Purples | Special`), `availableDyes` is 122–125, and `.slice(0, 100)` drops the tail. The
submission form has no such cap (`preset-submission-form.ts:468` iterates `filteredDyes` in full),
so the two forms disagree about which dyes exist.

**Why tests miss it.** `preset-edit-form.test.ts` mocks `dyeService.getAllDyes()` with 4 fixtures,
so the cap never binds.

**Covered by test:** no.

```ts
// preset-edit-form.ts:373-377
const availableDyes = filteredDyes.filter((d) => !state.selectedDyes.some((s) => s.id === d.id));
for (const dye of availableDyes.slice(0, 100)) {   // 125 - selected > 100
```

**Fix direction.** Drop the slice (the submission form already renders all 125 with no perf issue),
or paginate visibly.

---

### `webapp-modals-03` — BUG — **MEDIUM** — `apps/web-app/src/components/my-submissions-modal.ts:75-81`

**Claim.** `getMySubmissions()` never rejects, so the modal's error path is dead code and an API
outage renders the empty state instead of an error.

**Failing input → wrong outcome.** presets-api returns 500 (or the fetch aborts on the
`REQUEST_TIMEOUT`): `preset-submission-service.ts:387-390` returns `{presets: [], total: 0}` on
`!response.ok`, and `:397-400` returns the same from its `catch`. The modal's `try/catch` therefore
never fires; an author with 12 presets sees "no submissions yet" and `0 / 0 / 0` stat cells, which
reads as *your presets are gone*.

**Why tests miss it.** `my-submissions-modal.test.ts` only ever resolves a populated list; no test
drives a service failure.

**Covered by test:** no.

```ts
// my-submissions-modal.ts:75-81 — unreachable catch
try { const response = await presetSubmissionService.getMySubmissions(); presets = response.presets; }
catch { ToastService.error(t('errors.apiFailed')); return; }
// preset-submission-service.ts:387-390
if (!response.ok) { logger.error(...); return { presets: [], total: 0 }; }
```

**Fix direction.** Give `MySubmissionsResponse` an explicit failure arm (or let the service throw)
so the modal can distinguish "you have none" from "we could not ask".

---

### `webapp-modals-04` — BUG — **MEDIUM** — `apps/web-app/src/components/preset-edit-form.ts:70-71, 505-508, 673-741`

**Claim.** The edit form prints the tag limits it never enforces, and never re-checks the example
link at submit — both rules the submission path does enforce.

**Failing input → wrong outcome.** Type 15 comma-separated tags (or one 60 characters long): the
hint says "max 10 / 30 chars" (`preset.fieldTagsLimit`), the submit handler's `errors` list checks
only name / description / dye count, and the PATCH goes out and comes back 400 with a generic
"couldn't save" toast. Same for `example_link`: `exampleLinkError()` is wired to `blur` only
(`:469-473`), so a disallowed host typed and submitted without blurring is sent. The submission
form runs `validateSubmission()` (`preset-submission-service.ts:153`, which checks tags, category
enum, name/desc max **and** the stainID range guard) plus an explicit
`exampleLinkError` check at `preset-submission-form.ts:702-706`.

**Why tests miss it.** `preset-edit-form.test.ts` exercises only the three hand-rolled minimums.

**Covered by test:** no.

```ts
// preset-edit-form.ts:70-71 — declared, then used ONLY in the hint string at :505-508
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;
// :705-721 — the whole client-side rule set for an edit
if (name.length < MIN_NAME_LENGTH) ... if (description.length < MIN_DESC_LENGTH) ...
if (state.selectedDyes.length < MIN_DYES) ... if (state.selectedDyes.length > MAX_DYES) ...
```

**Fix direction.** Route the edit form through the same `validateSubmission`-shaped rule set (or
share one validator), and call `exampleLinkError()` in the submit handler.

---

### `webapp-modals-05` — BUG — **MEDIUM** — `apps/web-app/src/services/keyboard-service.ts:143, 150, 157` (surfaced by `shortcuts-panel.ts:47-58`)

**Claim.** The Shift+T / Shift+L / Shift+S branches do not exclude `ctrlKey` / `metaKey` /
`altKey`, unlike the tool-navigation branch immediately below them, so browser and OS chords fire
app shortcuts.

**Failing input → wrong outcome.** `Ctrl+Shift+T` (reopen closed tab) flips the theme *and*
reopens the tab (a browser-level accelerator is not cancelled by `preventDefault()`);
`Ctrl/Cmd+Shift+S` (Save As / Firefox screenshot) triggers the share action;
`Ctrl+Shift+L` cycles the UI language. The shortcuts panel documents these as bare
"Shift + T / L / S", so the panel is also wrong about what is bound.

**Why tests miss it.** `shortcuts-panel.test.ts` asserts only the rendered list; no keyboard test
dispatches a modified chord.

**Covered by test:** no.

```ts
// keyboard-service.ts:143-159 — no modifier exclusion
if (e.shiftKey && e.key.toUpperCase() === 'T') { e.preventDefault(); this.handleToggleTheme(); return; }
...
// :164 — the 1-9 branch gets it right
if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) { ... }
```

**Fix direction.** Add `&& !e.ctrlKey && !e.altKey && !e.metaKey` to the three Shift branches
(and to the `?` branch at `:130`).

---

### `webapp-modals-06` — BUG — **MEDIUM** — `apps/web-app/src/components/tutorial-spotlight.ts:238-241`

**Claim.** The tooltip is positioned from a measurement taken *before* its content is written, so
every step is placed using the previous step's box — a 0×0 box on step 1.

**Failing input → wrong outcome.** `positionTooltip()` (called from `updatePositions()`) reads
`this.tooltip.getBoundingClientRect()` at `:272` and uses `tooltipRect.height` / `.width` for the
top/left maths and the viewport clamp at `:317-318`. On the first step the tooltip is still empty,
so height/width are 0 and a `position: 'top'` step lands the tooltip flush against the target
instead of above it; on later steps it is off by the delta between consecutive steps' text
lengths — worst in de/fr/ja, where the copy is longest.

**Why tests miss it.** There is no `tutorial-spotlight.test.ts` at all, and jsdom returns 0 for
every `getBoundingClientRect()` anyway.

**Covered by test:** no.

```ts
// tutorial-spotlight.ts:238-241
setTimeout(() => {
  this.updatePositions();                                     // measures the EMPTY tooltip
  this.updateTooltipContent(step, stepIndex, totalSteps);     // then fills it
}, 100);
```

**Fix direction.** Swap the two calls (content first, then position), or call `updatePositions()`
again at the end of `updateTooltipContent()`.

---

### `webapp-modals-07` — BUG — **MEDIUM** — `apps/web-app/src/components/tutorial-spotlight.ts:148-152`

**Claim.** The spotlight tracks `resize` but not `scroll`, and a `ResizeObserver` does not fire on
scroll — so a `position: fixed` cut-out computed from `getBoundingClientRect()` drifts off its
target the moment the page moves.

**Failing input → wrong outcome.** Start a tour, scroll the tool panel (or let the momentum of the
`scrollIntoView` at `:501` settle after the 100 ms timer has already fired): the dark overlay's
hole and the tooltip stay at the old viewport coordinates, highlighting empty space while the real
target sits elsewhere. The tour then instructs the user to click something that is not lit.

**Why tests miss it.** No test file for this component.

**Covered by test:** no.

```ts
// tutorial-spotlight.ts:147-152 — resize only
this.on(window as unknown as HTMLElement, 'resize' as keyof HTMLElementEventMap, () => {
  if (this.currentStep) { this.updatePositions(); }
});
```

**Fix direction.** Add a passive, capturing `scroll` listener on `document` (capture catches
scrolls inside the shell's scroll containers too) that calls `updatePositions()`.

---

### `webapp-modals-08` — BUG — **MEDIUM** — `apps/web-app/src/components/collection-manager-modal.ts:30, 33, 89, 141, 255, 262, 294, 303` and `add-to-collection-menu.ts:47, 74, 84, 109, 185, 202, 211`

**Claim.** Both collection surfaces are painted with hardcoded Tailwind `dark:` utilities, which in
this project key off the **OS** preference, not the app's Light/Dark theme.

**Failing input → wrong outcome.** `tailwind.config.js` deliberately sets no `darkMode` key, so
v4 emits `dark:` under `@media (prefers-color-scheme: dark)`, while the app's themes are
`html.theme-*` classes plus `--theme-*` variables (the config comment says exactly this). App
theme = Dark, OS = light → the manager renders `bg-white` / `text-gray-900` islands and
`text-gray-600` body copy inside a `var(--theme-background)` dark dialog; App = Light, OS = dark →
`dark:text-white` labels on a white panel. Both combinations are common (OS on auto/light with the
app pinned to Dark), and both are unreadable.

**Why tests miss it.** jsdom applies no stylesheet; `collection-manager-modal.ts` additionally
carries `/* istanbul ignore file */` (`:5`) and has no test file.

**Covered by test:** no.

```ts
// collection-manager-modal.ts:29-33
header.className = 'flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700';
countText.className = 'text-sm text-gray-600 dark:text-gray-400';
// add-to-collection-menu.ts:46-47
menu.className = 'add-to-collection-menu fixed z-50 bg-white dark:bg-gray-800 ... border-gray-200 dark:border-gray-700';
```

**Fix direction.** Replace every `*-gray-*` / `bg-white` / `dark:*` pair with the `--theme-*`
tokens the 16A shell already uses (as `signin-modal.ts` and `my-submissions-modal.ts` do).

---

### `webapp-modals-09` — BUG — **MEDIUM** — `apps/web-app/src/components/my-submissions-modal.ts:208-217`

**Claim.** `ModalService.dismissTop()` inside an un-awaited async `onConfirm` dismisses whatever
modal happens to be on top when the network call resolves.

**Failing input → wrong outcome.** `modal-container.ts:436-439` calls `modal.onConfirm()` and then
`ModalService.dismiss(modal.id)` synchronously — it does not await. So the confirm modal is already
gone by the time `deletePreset` resolves, and the `dismissTop()` at `:212` lands on the My
Submissions modal. If the DELETE is slow and the user has meanwhile opened another modal (Sign in,
About, the edit form via another row) that modal is closed instead, apparently at random.

**Why tests miss it.** `my-submissions-modal.test.ts` covers only rendering and HTML escaping; no
test drives the delete confirm.

**Covered by test:** no.

```ts
// my-submissions-modal.ts:208-217
onConfirm: async () => {
  try { await presetSubmissionService.deletePreset(preset.id);
        ToastService.success(t('preset.deleteSuccess'));
        ModalService.dismissTop();      // the confirm is long gone by now
        onChanged?.(); } catch { ... }
}
```

**Fix direction.** Capture the id you intend to close (`const listId = ModalService.getTopModal()?.id`
before showing the confirm) and call `ModalService.dismiss(listId)`, or drop the call and let
`onChanged` re-render.

---

### `webapp-modals-10` — BUG — **MEDIUM** — `apps/web-app/src/components/modal-container.ts:520-525`

**Claim.** The focus trap is a one-shot snapshot of the dialog's focusable elements; any modal whose
content re-renders (i.e. both preset forms) detaches the snapshot and the trap stops trapping.

**Failing input → wrong outcome.** Open the submission form (its dye grid contributes ~125 buttons
to `focusTrapElements`), type one character in the dye search: `renderDyeGrid()` does
`dyeGrid.innerHTML = ''` (`preset-submission-form.ts:466`) and rebuilds. `focusTrapElements[last]`
now points at a detached node, so `document.activeElement === lastElement` in `handleFocusTrap`
(`:227`) can never be true and Tab walks out of the dialog into the page behind it — the exact
failure `aria-modal` promises will not happen.

**Why tests miss it.** No test dispatches Tab at all.

**Covered by test:** no.

```ts
// modal-container.ts:520-525 — computed once per renderContent, never refreshed
if (topDialog) {
  this.focusTrapElements = this.getFocusableElements(topDialog);
  this.safeTimeout(() => { (this.focusTrapElements[0] ?? topDialog).focus(); }, 50);
}
```

**Fix direction.** Recompute `getFocusableElements(topDialog)` inside `handleFocusTrap` on each Tab
(cheap, once per keystroke), instead of caching at render time.

---

### `webapp-modals-11` — BUG — **MEDIUM** — `apps/web-app/src/components/changelog-modal.ts:108` via `v4-layout.ts:264`

**Claim.** A failed lazy `import('virtual:changelog')` becomes an unhandled rejection that nothing
reports, so the header's "What's New" button silently does nothing.

**Failing input → wrong outcome.** After a Cloudflare Pages deploy an open tab still holds the old
`index.html`; the hashed `modals` chunk it references is gone, so `import('virtual:changelog')`
rejects. `showChangelogModal()` returns that rejected promise, `v4-layout.ts:264` discards it with
`void`, and `grep -rn unhandledrejection apps/web-app/src` finds **no** global handler — no toast,
no error boundary, nothing. Same for the auto-popup (`showChangelogIfUpdated` → `void modal.show()`
at `:376`), which additionally leaves `markAsViewed()` uncalled so the popup retries every visit.

**Why tests miss it.** `changelog-modal.test.ts` mocks `virtual:changelog` as an always-resolving
module.

**Covered by test:** no.

```ts
// changelog-modal.ts:104-110
async show(opts: { mode?: ChangelogMode } = {}): Promise<void> {
  if (this.modalId) return;
  const generation = ++this.generation;
  const { changelogEntries } = await import('virtual:changelog');   // no catch anywhere upstream
```

**Fix direction.** `try/catch` the dynamic import and surface `ToastService.error` (and reset
`this.generation` so a retry can succeed).

---

### `webapp-modals-12` — BUG — **LOW** — `apps/web-app/src/components/welcome-modal.ts:123-131`

**Claim.** "Take the tour" starts the tutorial for the router's **default** tool without navigating
there, so a first visit on a deep link runs a tour whose every target is missing.

**Failing input → wrong outcome.** First visit via a shared `/budget` or `/swatch` link:
`showWelcomeIfFirstVisit()` fires, the user presses Take the tour, `TutorialService.start(
RouterService.getDefaultTool())` runs while the Budget tool is mounted. Every step's selector then
misses, and `tutorial-spotlight.ts:227-231` logs `Tutorial target not found` and
`setTimeout(() => TutorialService.next(), 100)` — so the tour flickers through all its steps in
~1 s and ends with nothing shown. The sibling "Get started" button *does* navigate (`:136`).

**Why tests miss it.** No welcome-modal test file.

**Covered by test:** no.

```ts
// welcome-modal.ts:123-131 — no navigateTo, unlike onConfirm at :133-137
onCancel: () => {
  setTimeout(() => { TutorialService.start(RouterService.getDefaultTool() as TutorialTool); }, 350);
},
```

**Fix direction.** Call `RouterService.navigateTo(RouterService.getDefaultTool())` before
`TutorialService.start(...)` (or start the tour for the *currently mounted* tool).

---

### `webapp-modals-13` — BUG — **LOW** — `apps/web-app/src/components/add-to-collection-menu.ts:255`

**Claim.** `closeAddToCollectionMenu()` is module-private, so nothing outside the file can close the
popover; it and its two `document` listeners survive the destruction of the tool that opened it.

**Failing input → wrong outcome.** Open the ⋯ → Add to collection menu from the dye grid, then
switch tools with a `1`-`9` shortcut or the sidebar. `v4-layout` destroys the tool, but the menu was
appended to `document.body` (`:137`) and only `closeAddToCollectionMenu()` removes it — which only
the menu's own handlers call. The popover stays floating over the new tool, still holding
`click`/`keydown` listeners on `document`, and its "add" handlers still reference the old dye.

**Why tests miss it.** `/* istanbul ignore file */` at `:1`; no test file.

**Covered by test:** no.

```ts
// add-to-collection-menu.ts:255 — not exported
function closeAddToCollectionMenu(): void { ... }
```

**Fix direction.** Export it and call it from the tool's `destroy()` (or from a
`RouterService` navigation subscription).

---

### `webapp-modals-14` — BUG — **LOW** — `apps/web-app/src/components/my-submissions-modal.ts:24-35`

**Claim.** `statusKind()` funnels the `hidden` status (ban suppression) through `default` into
`review`, so a suppressed preset advertises itself as under review forever.

**Failing input → wrong outcome.** `PresetStatus` is
`'pending' | 'approved' | 'rejected' | 'flagged' | 'hidden'`
(`packages/types/src/preset/core.ts:37`; `hidden` = "Hidden due to user ban (restored on unban)").
A banned author's rows render the amber IN REVIEW chip with the `preset.reviewNote` copy and are
offered **Edit** and **Delete** — actions the API will refuse — with no hint that the state is
terminal until unban.

**Why tests miss it.** `my-submissions-modal.test.ts` covers `approved` and `rejected` only.

**Covered by test:** no.

```ts
// my-submissions-modal.ts:26-34
case 'approved': return 'live';
case 'rejected': return 'rejected';
case 'pending':
case 'flagged':
default:         return 'review';   // 'hidden' lands here
```

**Fix direction.** Either add a fourth kind for `hidden` with its own note, or comment the deliberate
conflation so the next reader does not read it as an oversight.

---

### `webapp-modals-15` — BUG — **LOW** — `apps/web-app/src/components/preset-edit-form.ts:681 vs :716`

**Claim.** The edit form validates the *unfiltered* selection but sends the *null-filtered* stainID
array, so the two can disagree by the number of dyes with a null `stainID`.

**Failing input → wrong outcome.** `Dye.stainID` is `number | null`
(`packages/types/src/dye/dye.ts:48` — the null arm survives for legacy fixture shapes the loader
falls back on). With three selected dyes one of which has `stainID === null`, `dyes` is length 2
while `state.selectedDyes.length` is 3, the client MIN_DYES check passes, and the PATCH carries two
dyes for a 400. `preset-submission-form.ts:683,692` gets this right — it validates the array it is
about to send.

**Why tests miss it.** Every fixture in `preset-edit-form.test.ts` has a numeric `stainID`.

**Covered by test:** no.

```ts
// preset-edit-form.ts:681 — payload
const dyes = state.selectedDyes.map((d) => d.stainID).filter((id): id is number => id !== null);
// :716 — validation reads a different array
if (state.selectedDyes.length < MIN_DYES) { errors.push(...); }
```

**Fix direction.** Validate `dyes.length`, not `state.selectedDyes.length`.

---

### `webapp-modals-16` — BUG — **LOW** — `apps/web-app/src/components/preset-category-selector.ts:31-40, 138` with `preset-edit-form.ts:125-128`

**Claim.** A stored `category_id` outside `SELECTABLE_CATEGORIES` renders with no chip selected and
can never be corrected through the UI.

**Failing input → wrong outcome.** The edit form seeds `ordered = [preset.category_id, ...]`. If the
stored value is the retired `community` (or any legacy string D1 still holds), `render()` iterates
`SELECTABLE_CATEGORIES` only, so no chip shows rank 1; the user picks another category, which
becomes rank 2, `state.categories.primary` stays `community`, and the diff at
`preset-edit-form.ts:696` therefore never sets `updates.category_id`. `toggle()` cannot remove the
stale primary because it has no chip to click. The preset is stuck in a category the gallery rail
does not list.

**Why tests miss it.** `preset-category-selector.test.ts` only uses valid categories.

**Covered by test:** no.

```ts
// preset-category-selector.ts:137-140 — only known categories get a chip
for (const category of SELECTABLE_CATEGORIES) {
  const rank = ordered.indexOf(category);          // a stale primary is never found here
```

**Fix direction.** Drop any entry not in `SELECTABLE_CATEGORIES` while seeding `ordered` (and
promote the next), so an unknown primary self-heals on first edit.

---

### `webapp-modals-17` — BUG — **LOW** — `apps/web-app/src/components/collapsible-panel.ts:98, 184`

**Claim.** The open state is a magic `max-height: 1000px` on an `overflow: hidden` box, which
silently clips taller content.

**Failing input → wrong outcome.** `accessibility-tool.ts:488/1600` puts the dye panel in a
`CollapsiblePanel`; a dye list plus filter chips exceeds 1000 px on a narrow viewport, and the
overflow is cut with no scrollbar and no visual cue — the last rows simply are not there.

**Why tests miss it.** jsdom has no layout; `collapsible-panel.test.ts` asserts the literal
`max-height` strings, which is exactly the value that is wrong.

**Covered by test:** no.

```ts
// collapsible-panel.ts:98
style: this.isOpen ? 'max-height: 1000px; opacity: 1;' : 'max-height: 0; opacity: 0;',
```

**Fix direction.** Use `max-height: none` (or `scrollHeight`) for the open state, keeping the
0 → measured transition only for the animation.

---

### `webapp-modals-18` — BUG — **LOW** — `apps/web-app/src/components/empty-state.ts:55`

**Claim.** The user's search query goes into `String.prototype.replace`'s *replacement* position,
where `$&`, `` $` ``, `$'` and `$n` are substitution patterns.

**Failing input → wrong outcome.** Search for `$&` in the dye grid: the "No results for {query}"
line renders `No results for {query}` (the matched text re-inserted). `$'` yields the rest of the
string. Cosmetic but visible, and it is the one user-controlled string in this module.

**Why tests miss it.** `empty-state.test.ts` uses only plain queries.

**Covered by test:** no.

```ts
// empty-state.ts:55
title: LanguageService.t('emptyStates.noSearchResults.title').replace('{query}', query),
```

**Fix direction.** Use `.replace('{query}', () => query)` or the app's own
`LanguageService.tInterpolate`.

---

### `webapp-modals-19` — BUG — **LOW** — `apps/web-app/src/components/about-modal.ts:48-64`

**Claim.** The comment promises a loud failure on a renamed social label; the code does the
opposite.

**Failing input → wrong outcome.** Rename any entry in
`packages/core/src/config/product-links.ts:31-37` (today all seven match) and the About modal
renders a 44 px empty box with a working link and an `aria-label` but no glyph — silently, with no
gate anywhere to catch it.

**Why tests miss it.** `about-modal.test.ts:44` mocks `@shared/social-icons` wholesale, so the
key-matching against core's real labels is never exercised.

**Covered by test:** no.

```ts
// about-modal.ts:48 (comment) "…a renamed entry fails loudly rather than silently losing its icon."
// about-modal.ts:60-64 (code)
const SOCIAL_LINKS: SocialLink[] = CORE_SOCIAL_LINKS.map(({ label, url }) => ({
  label, url, icon: SOCIAL_ICONS[label] ?? '',       // silent
}));
```

**Fix direction.** Add a unit test asserting every `CORE_SOCIAL_LINKS.label` has a non-empty icon
(that makes the comment true), or throw in dev builds.

---

### `webapp-modals-20` — UNTESTED — **HIGH** — `apps/web-app/src/components/__tests__/preset-submission-form.test.ts:199, 211`

**Behaviour the test was supposed to catch.** That the submission payload carries **stainIDs**, not
legacy itemIDs (`preset-submission-form.ts:683`) — the single most consequential line in the module
after the 5.0 stainID migration.

Every assertion is `expect(mockSubmitPreset).toHaveBeenCalled()`; the call *arguments* are never
inspected in the file. Changing `d.stainID` back to `d.itemID` (or dropping the
`filter(id => id !== null)`) leaves all four tests green. The same file's
`expect(fileInput.value).toBe('')` at `:194` asserts a value that was already `''` before the
action (the helper sets `files` via `defineProperty` and never touches `value`), so it cannot fail
either.

**Fix direction.** Assert
`expect(mockSubmitPreset).toHaveBeenCalledWith(expect.objectContaining({ dyes: [1, 2, 3] }))`, and
add a case whose fixture has `stainID !== itemID` so the two cannot be confused.

---

### `webapp-modals-21` — UNTESTED — **MEDIUM** — `apps/web-app/src/components/__tests__/changelog-modal.test.ts:36-61`

**Behaviour the test was supposed to catch.** The BUG-043 rework at `changelog-modal.ts:168-172`:
when `APP_VERSION` is absent from the parsed changelog, expand the *newest* release rather than
opening an empty modal.

The mocked `virtual:changelog` always contains an entry for the mocked `APP_VERSION` `'4.0.0'`, so
`currentIndex` is never `-1` and the fallback branch never executes. Deleting the
`currentIndex === -1 ? 0 : currentIndex` guard keeps the suite green — which is how the original
MEDIUM shipped.

**Fix direction.** Add a popup-mode case whose `changelogEntries` omits `APP_VERSION` and assert the
newest version's sections are the expanded ones.

---

### `webapp-modals-22` — UNTESTED — **MEDIUM** — `apps/web-app/src/components/__tests__/modal-container.test.ts:537-547`

**Behaviour the test was supposed to catch.** The register fix at `modal-container.ts:532-534`:
restore `document.body.style.overflow` to its **prior** value, never blank it.

`beforeEach` sets `document.body.style.overflow = ''`, so `priorBodyOverflow` is captured as `''`
and the final `expect(...).toBe('')` passes identically whether the code restores the saved value or
hardcodes `''`. The regression the fix exists to prevent is invisible to the suite.

**Fix direction.** Set `document.body.style.overflow = 'scroll'` before showing the modal and assert
it comes back as `'scroll'`.

---

### `webapp-modals-23` — UNTESTED — **LOW** — `modal-container.test.ts:577-585`, `about-modal.test.ts:89-101, 222`, `changelog-modal.test.ts:88-124, 194`

**Behaviour the tests were supposed to catch.** Teardown and API surface.
`it('should unsubscribe on destroy')` only asserts
`expect(() => ModalService.show(...)).not.toThrow()` — it never checks that the container stayed
empty, so a leaked subscription (the exact failure named in the title) passes. `about-modal.ts` and
`changelog-modal.ts` contribute nine `expect(typeof x).toBe('function')` / `toBeDefined()` bodies
plus two bare `not.toThrow()` closes. This is the house pattern the 2026-08 "vacuous assertions"
finding recorded; it is still the majority of the `about-modal` and `changelog-modal` "Basic
Functionality" blocks.

**Fix direction.** For the unsubscribe test, assert
`expect(query(container, '#modal-container')).toBeNull()` *after* the post-destroy `show()`; delete
the `typeof` bodies (TypeScript already proves them).

---

### `webapp-modals-24` — REFACTOR — **MEDIUM** — `apps/web-app/src/components/collection-manager-modal.ts:178-185`

Collection delete uses the native blocking `window.confirm()` while every other destructive action
in 5.0 goes through `ModalService.showConfirm({ destructive: true })` — the shell's documented
convention (outlined accent, wide Cancel thumb target, `role="alertdialog"`, focus trap, theme
tokens). The native dialog is untranslatable chrome, ignores the modal stack, is unstyleable, and is
the reason this file carries `/* istanbul ignore file */` (`:5`) and has no tests at all.

```ts
// collection-manager-modal.ts:178-185
deleteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirm(LanguageService.t('collections.confirmDelete'))) { ... }
});
```

**Fix direction.** Port to `ModalService.showConfirm` (as `my-submissions-modal.ts:202` already
does), which also makes the module testable and lets the `istanbul ignore` come off.

---

### `webapp-modals-25` — REFACTOR — **LOW** — `preset-submission-form.ts:462`, `preset-edit-form.ts:368`

`.filter((dye) => dye.category !== 'Facewear')` is dead in both forms: schema v2 moved the 11
facewear colours out of `dyes.json` into the separate `facewearColors` export, and the file's
categories are `Neutral | Reds | Browns | Yellows | Greens | Blues | Purples | Special` — no
`Facewear` row exists to filter. The comment above each line ("Facewear dyes — they shouldn't be in
presets") is now misleading about where the guarantee comes from.

**Fix direction.** Delete both filters and re-point the comment at the schema-v2 split.

---

### `webapp-modals-26` — OPT — **LOW** — `apps/web-app/src/components/tutorial-spotlight.ts:36-64, 513-517`

`querySelectorDeep()` falls back to `searchShadowRoots()`, which does `root.querySelectorAll('*')`
and recurses into every element with a `shadowRoot` — a full-document walk. It is called from
`updatePositions()`, which the per-target `ResizeObserver` fires on every observed frame (and again
on every `resize`). During a window drag that is a whole-document `*` query per frame, on the main
thread, behind a full-screen overlay.

**Fix direction.** Resolve the target once in `showStep()` and hold the element reference for the
step's lifetime; `updatePositions()` then only needs `getBoundingClientRect()`.

---

### `webapp-modals-27` — BUG — **LOW** — `apps/web-app/src/components/toast-container.ts:168-201, 246`

`renderContent()` clears the container and rebuilds **every** toast on each service update, so a
still-visible `role="alert"` toast is removed and re-inserted whenever any other toast appears or is
dismissed — screen readers re-announce it, and it re-runs `toast-animate-in` (`:193`). The
swipe-dismiss timer at `:246` is a raw `setTimeout`, outside `BaseComponent.safeTimeout`'s
`clearAllTimeouts()` teardown, so it can fire after `destroy()`.

**Fix direction.** Render incrementally by `data-toast-id` (as `ModalContainer` already does), and
route the 150 ms swipe timer through `this.safeTimeout`.

---

## 3. POSITIVE — do not re-file

- **The changelog generation guard is real and tested.** `changelog-modal.ts:63, 107-110, 141` plus
  `changelog-modal.test.ts:152-176` cover both races (a second `show()` in flight, and a `close()`
  during the load). This is the right shape for a lazy-import modal.
- **`metric-help.ts` is the best-tested module in scope.** `metric-help.test.ts` pins the bands to
  core's `BAND_VOCABULARY`, checks both tier ramps, and — twice — asserts the *absent* state for
  learn links (never the English URL) rather than only the happy path.
- **`my-submissions-modal.ts:106-113` escapes the two remote strings** (moderator `rejection_reason`,
  author `name`) before they reach the innerHTML template, names FINDING-011 in the comment, and has
  two dedicated "never as markup" tests.
- **`preset-submission-service.validateSubmission` (`:153-190`) carries a real stainID range guard**
  (`LEGACY_ITEM_ID_FLOOR` / `MAX_STAIN_ID`) that fails a half-migrated caller loudly — exactly the
  5.0 hazard. Do not weaken it; the gap is that the *edit* path does not use it (candidate 04).
- **`preset-edit-form.ts:673-741` builds a minimal PATCH from what actually changed**, with the
  Perspective-cost reasoning written down, and records what *succeeded* (`imageUploaded` /
  `imageCleared`) rather than re-reading the intent flags — the toast-stacking trap is already handled.
- **`escapeHtml` / `textContent` discipline holds across the unit.** Every user-controlled string
  (dye names, preset names, search queries, moderator reasons) reaches the DOM through `textContent`
  or `escapeHtml`; `innerHTML` is used only for compile-time SVG constants and app-owned locale
  strings.
- **The privacy rule is respected.** No `.chara` nickname or attachment filename is pre-filled
  anywhere in the submission form — `SubmissionFormInitial` (`preset-submission-form.ts:70-73`)
  accepts a name only from an explicit caller, and 10A hands it the palette's dyes.
- **`modal-container.ts` gets the 16A register fixes right in code** — `inert` on background modals,
  styles injected into `<head>` (with the reason for *not* putting them in the cleared container),
  `previousActiveElement.isConnected` before refocus, `priorBodyOverflow` rather than a blanked value.

## 4. REJECTED

- **`export-sheet.ts` Blob-URL revoke / clipboard fallback** — `downloadText` revokes after
  `link.click()` (standard, works in Chromium/Firefox) and `copyText` has a real `execCommand`
  fallback with its own try/catch and error toast. CSV/JSON escaping lives in
  `@shared/palette-export`, which is pure and has its own test file — out of this unit.
- **`my-submissions-modal.ts` pagination** — `GET /api/v1/presets/mine`
  (`apps/presets-api/src/handlers/presets.ts:272-291`) returns every row with no LIMIT and no cursor,
  so there is nothing for the modal to page through. The stat cells are correct.
- **IME composition in `keyboard-service`** — `isUserTyping()` (`:109-118`) pierces the shadow root
  via `composedPath()[0]`, so composing inside any input already suppresses the shortcuts; an
  `isComposing` check would be redundant.
- **`preset-edit-form.ts:831-840` `getContrastColor` NaN on a 3-digit hex** — every hex in
  `dyes.json` is 6-digit `#RRGGBB` and the only caller passes `dye.hex`; unreachable today.
- **`add-to-collection-menu.ts:89,124` `dye.stainID ?? 0`** — would write dye id `0` into a
  collection, but `getAllDyes()` is fed from schema-v2 `dyes.json` where every row has a stainID;
  latent, not reachable.
- **`metric-help.ts:49-52` `separationBands` destructuring** — `BAND_VOCABULARY.separation[m].cuts`
  is a fixed 3-tuple (`band-calibration.ts:66-71, 89-91`), so `[fail, tight, good]` cannot come up
  short.
- **`offline-banner.ts` initial state** — `isOnline` is seeded from `navigator.onLine` at module
  eval and both listeners are registered in the constructor before `initialize()` renders, so a
  transition between the two cannot be lost.
- **`signin-modal.ts:66,69` `returnTo` drops query/hash** — `authService.login(returnPath)` stores
  `returnPath || window.location.pathname` (`auth-service.ts:639`); passing `pathname` explicitly is
  the same value the default would use, and the app's share state lives in the path, so nothing is
  actually lost.
- **`collection-manager-modal.ts:593-595` detached file input** — `input.remove()` immediately after
  `click()` is fine: the change listener is on the element, which the closure keeps alive.
- **`modal-container.ts` `innerHTML` of user strings** — the only `innerHTML` in the shell is the
  static close-icon SVG at `:387`; titles/subtitles/eyebrows all go through `textContent`.

## 5. COVERED

**19 in-scope source files (all read in full):**
`apps/web-app/src/components/` — `preset-edit-form.ts`, `preset-submission-form.ts`,
`collection-manager-modal.ts`, `tutorial-spotlight.ts`, `modal-container.ts`, `about-modal.ts`,
`changelog-modal.ts`, `metric-help.ts`, `welcome-modal.ts`, `add-to-collection-menu.ts`,
`toast-container.ts`, `empty-state.ts`, `my-submissions-modal.ts`, `offline-banner.ts`,
`collapsible-panel.ts`, `export-sheet.ts`, `preset-category-selector.ts`, `shortcuts-panel.ts`,
`signin-modal.ts`.

**8 supporting files read to confirm claims:**
`components/base-component.ts`, `services/modal-service.ts`, `services/keyboard-service.ts`
(handler block), `services/preset-submission-service.ts` (validation + `getMySubmissions`),
`apps/web-app/tailwind.config.js`, `packages/types/src/preset/core.ts`,
`packages/types/src/preset/community.ts`, `packages/core/src/config/product-links.ts`.

**12 test files skimmed:**
`components/__tests__/` — `modal-container.test.ts`, `preset-submission-form.test.ts`,
`preset-edit-form.test.ts`, `changelog-modal.test.ts`, `about-modal.test.ts`,
`my-submissions-modal.test.ts`, `toast-container.test.ts`, `offline-banner.test.ts`,
`metric-help.test.ts`, `shortcuts-panel.test.ts`, `collapsible-panel.test.ts`,
`empty-state.test.ts`, `preset-category-selector.test.ts`.

**No test file exists for 6 in-scope modules:** `collection-manager-modal.ts`,
`add-to-collection-menu.ts`, `tutorial-spotlight.ts`, `welcome-modal.ts`, `export-sheet.ts`,
`signin-modal.ts` (the first two additionally carry `/* istanbul ignore file */`).
