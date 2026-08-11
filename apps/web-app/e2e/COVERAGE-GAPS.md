# E2E Coverage Gaps

Behaviours that had a Playwright test written against the **pre-5.0 DOM**, were skipped when
the v4 rewrite changed the selectors, and were deleted rather than left skipped.

**Why deleted rather than left in place:** a `describe.skip` block is worse than no file. It
looks like coverage in the tree, reports zero failures, and costs nothing to keep — so it never
gets rewritten. Deleting converts an invisible gap into a written one. Nothing here lost
*actual* coverage: every block below had been skipped, and therefore contributing nothing, since
the 5.0 DOM landed.

Recorded as `DEAD-007` of the 2026-08-09 pre-release audit, whose recommendation was
*"either rewrite each against the 5.0 DOM (as `ui-interactions.spec.ts` was) or delete it and
note the coverage gap."* This file is that note.

The four `(v4 rewrite)` suites that remain are **smoke-depth** — they assert that controls exist
and that the tool survives a reload. They do not assert the behaviours below.

---

## Harmony Generator — `harmony-generator.spec.ts`

Deleted: `Harmony Generator Tool (legacy DOM IDs pending v4 rewrite)` and
`Harmony Generator - Dye Selector Integration (…)`.

- All 10 harmony types render for a generated palette
- Hex input ↔ colour picker two-way sync
- Generate button produces harmonies; empty state before a colour is chosen
- Simple / Expanded suggestions mode: default is Simple, Expanded reveals the companion-dyes
  slider, switching back hides it
- Companion-dyes slider updates its count display
- Suggestions mode **and** companion count persist to `localStorage` and restore on reload
- Saved-palettes modal opens; its badge shows the palette count
- Dye-selector categories render and their items are clickable

## Dye Comparison — `dye-comparison.spec.ts`

Deleted: `Dye Comparison Tool (legacy DOM ID assertions)`.

- Deselecting a dye by clicking it a second time
- Analysis sections appear once 2+ dyes are selected; distance matrix renders for multiple dyes
- Summary / matrix / hue-saturation / brightness / export containers present
- Display-option checkbox state persists after toggle; `showHex` visibly changes output
- Market board: server dropdown present and changing the server takes effect
- Removing an individual dye via its result card (distinct from Clear All)
- Charts laid out in a grid; hover on hue-saturation points and brightness bars
- **Mobile viewport**: drawer content shows, dyes selectable, options toggleable
- **Keyboard**: tab through interactive elements, activate a checkbox with Space

## Dye Mixer — `dye-mixer.spec.ts`

Deleted: `Dye Mixer Tool (legacy DOM IDs pending v4 rewrite)` and
`Dye Mixer - UI Interaction (…)`.

- Step-count slider updates its value display
- Colour-space radios: default is HSV, switching to RGB works
- Interpolation display empty state when fewer than 2 dyes are selected
- Save-gradient and copy-URL quick actions present
- Saved-gradients panel: toggle visibility, empty-state hint
- Responsive quick-action button layout

## Colour Matcher / Extractor — `color-matcher.spec.ts` (whole file deleted)

The file's own describe title said its coverage had moved to the v4 extractor suite, and
`extractor-tool.spec.ts` (532 lines) does cover the tool. These specific assertions did not
carry over:

- Sample-size slider updates its value display
- Extraction mode: default Single Color, Palette mode reveals palette options, switching back
  hides them
- Colour-count slider updates its display; extract-palette button present
- Recent-colours wrapper, dye-filters, market-board and results containers present

---

## Deleted: `dye-comparison-coverage.spec.ts` (2026-08-11) — no assurance lost

A near-duplicate of `dye-comparison.spec.ts` that existed only because it was the one file
importing `./fixtures/coverage`. Every spec now imports that fixture, so a duplicate has no
reason to exist.

Nothing of assurance value went with it. Its tests were coverage-farming: each body was guarded
by `if ((await dyeButtons.count()) >= 2)` with no `else`, so on a render where the locator
missed, the test clicked nothing, asserted nothing, and still passed — inflating the coverage
number without testing anything. `dye-comparison.spec.ts` covers load, select-to-four, option
toggling and clear with real assertions.

The one behaviour it reached that the survivor does not is **chart interaction** (hover on the
hue-saturation scatter and the brightness bars). That is already listed under *Dye Comparison*
above as a v4-rewrite gap, and stays listed.

---

## Separately: the `mobile-chrome` project is red — and it is right to be

Not a deletion — a standing failure, recorded here because Sprint 4 of the 2026-08-09 audit was
the first time `playwright test` was run as a release gate and it needs to be honest about what
it reports.

As of 2026-08-09: **`chromium` 142/142 green; `mobile-chrome` 114 passed, 28 failed.**

```
waiting for getByRole('switch', { name: /deuteranopia/i })   → element(s) not found
waiting for getByText('Vision Types').first()                → element(s) not found
```

Affected: `accessibility-checker.spec.ts` (9), `gradient-builder.spec.ts` (9),
`budget-tool.spec.ts` (7), plus the reload/load smoke tests in `dye-comparison.spec.ts` and
`dye-mixer.spec.ts` (2 each).

### CORRECTED DIAGNOSIS (2026-08-11) — this is a product bug, not a test bug

This section previously read *"at the Pixel 5 viewport the config sidebar collapses into a
drawer, and these tests reach straight for controls inside it without opening it first"*, and
prescribed *"one shared helper — open the drawer in `beforeEach`"*.

**That is wrong, and acting on it would have hidden a live regression.** The sidebar does not
collapse into a drawer on mobile. `v4-layout-shell.render()` emits `''` in place of
`<v4-config-sidebar>` when `isMobile`:

```ts
${this.isMobile ? '' : html`<v4-config-sidebar …></v4-config-sidebar>`}
```

Tools render their controls into `options.leftPanel` (`accessibility-tool.ts:493
renderLeftPanel()`), so at phone width that content is written into an element the shell never
mounts. Measured on the running app at 393×727 versus 1280×720:

| | desktop (1280×720) | mobile (393×727) |
|---|---|---|
| elements with `role="switch"` | **153** | **0** |
| vision-type control | switches | absent (only the share `<select>` remains) |

The palette drawer is present and `is-open` on mobile, and toggling it via `.v4-palette-toggle`
does not change the count — it is 0 in both states. So the vision-type toggles, and every other
left-panel control, are **unreachable on a phone**. `accessibility-tool.ts:1743` has a
`Render collapsible Vision Types panel for mobile drawer` path, but nothing on the observed
mobile render reaches it.

**Do not "fix" these 28 tests.** They are the only thing currently reporting the gap. The fix
belongs in the shell or the tools — either mount the left-panel content somewhere on mobile, or
route it into the palette drawer as line 1743 intends. When that lands, these tests should go
green without being touched.

Until then `--project=chromium` is the meaningful gate and a full `playwright test` exits
non-zero — which is the correct signal, not a nuisance.

## Closing these

Rewrite against the 5.0 DOM the way `ed8f477` did for `ui-interactions.spec.ts` — that commit is
the worked example. Prefer role- and text-based locators over DOM IDs, which is what made the
originals brittle enough to be skipped in the first place. Delete each section here as its
coverage returns.
