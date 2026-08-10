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

## Closing these

Rewrite against the 5.0 DOM the way `ed8f477` did for `ui-interactions.spec.ts` — that commit is
the worked example. Prefer role- and text-based locators over DOM IDs, which is what made the
originals brittle enough to be skipped in the first place. Delete each section here as its
coverage returns.
