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

## `mobile-chrome`: green since 2026-11-13, and not yet in CI

This section used to record a standing failure: 28 `mobile-chrome` tests red because
`v4-layout-shell` rendered `''` in place of `<v4-config-sidebar>` at phone width, so every
Options control was unreachable on a phone. It said not to fix the tests, and that was right
while the product bug stood.

The shell has since been fixed. `<v4-config-sidebar>` is rendered at every width; at 768px and
under it starts `collapsed` (parked off-screen, `visibility: hidden`) behind the bottom-left
Options button, and the palette starts closed behind the bottom-right button. The 17 failures
left on `main` at `ee4dd0b6` (11 in `accessibility-checker.spec.ts`, 6 in
`gradient-builder.spec.ts`) were tests reaching for a panel without opening it, which is the
test-side change this document always expected once there was something to open.

- `openOptionsPanel(page)` and `openPaletteDrawer(page)` in `e2e/fixtures/navigation.ts` press
  the app's own buttons, and do nothing where the panel is already open. Use them in any test
  that needs a control inside either panel.
- A test that states a desktop-only fact (a docked panel visible on load) pins its viewport with
  `test.use({ viewport })` and does not look at the project name.

Measured 2026-11-13, local, default workers: `chromium` 252/252 in about 90 s, `mobile-chrome`
252/252 in about 125 s. CI still runs `--project=chromium` only; whether it should run
`mobile-chrome` too is the maintainer's call, and the comment above the `e2e` job in
`.github/workflows/ci.yml` still describes the old product bug.

## Closing these

Rewrite against the 5.0 DOM the way `ed8f477` did for `ui-interactions.spec.ts` — that commit is
the worked example. Prefer role- and text-based locators over DOM IDs, which is what made the
originals brittle enough to be skipped in the first place. Delete each section here as its
coverage returns.

---

## 2026-09-03 — measured, not guessed

`npm run test:e2e:coverage` was run against the whole suite and the per-module
function coverage read off `e2e-coverage/coverage-final.json`. That turns the
question "what does E2E actually reach?" from an argument into a table.

**Mapping caveat, so the next person does not repeat it:** Vite serves with
`root: 'src'`, so a module's coverage URL is `/services/x.ts`, **not**
`/src/services/x.ts`. A naive `/src\//` match over those URLs returns zero rows
for every file and reads exactly like "E2E covers nothing".

### The thirteen modules `vitest.config.ts` drops from unit coverage

Before / after the two specs added on 2026-09-03, as covered-functions:

| Module | before | after |
|---|---|---|
| `v4/dye-palette-drawer.ts` | 38/54 (70%) | unchanged |
| `v4/preset-tool.ts` | 28/75 (37%) | **36/75 (48%)** |
| `v4/preset-detail.ts` | 2/22 (9%) | **24/42 (57%)** |
| `v4/v4-layout-shell.ts` | 14/26 (54%) | unchanged |
| `v4/display-options-v4.ts` | 10/28 (36%) | unchanged |
| `preset-edit-form.ts` | never loaded | **still never loaded** |
| `collection-manager-modal.ts` | 1/11 (9%) | unchanged |
| `add-to-collection-menu.ts` | 1/4 (25%) | unchanged |
| `welcome-modal.ts` | 3/12 (25%) | **12/15 (80%)** |
| `share-service.ts` | 5/18 (28%) | unchanged |
| `community-preset-service.ts` | 8/25 (32%) | **13/25 (52%)** |
| `hybrid-preset-service.ts` | 9/19 (47%) | **10/19 (53%)** |
| `recent-colors-panel.ts` | — | **file does not exist** (stale exclude, removed) |

Suite total: 1248/2914 (42.8%) -> 1313/2941 (44.6%) functions.

### What the two new specs do

- **`welcome-modal.spec.ts`** — the only spec that does *not* call
  `seedStartupStorage()`. Every other file seeds `welcome_seen` so the modal
  keeps out of the way, which is exactly why nothing ever exercised it. Carries
  the BUG-077 block: `markAsSeen()` runs from `onClose`, so the Get-started
  button, the X, Escape and a backdrop tap must *each* persist both
  `welcome_seen` and `last_version_viewed`, verified across a page reload.
- **`preset-gallery-api.spec.ts`** — stands the presets-api up with
  `page.route()`. TESTING.md excludes the preset services from unit coverage
  because they "make real HTTP requests"; the E2E run had no network either, so
  the tool only ever rendered its offline state. Route-stubbing runs the real
  service code, the real fetch stack and the real render path against a
  deterministic payload.

### Still dark, and why

- **`preset-edit-form.ts`** — reached only from `preset-tool`'s *Mine* tab and
  `my-submissions-modal`, both of which need a signed-in Discord session. Needs
  an auth fixture (a seeded JWT in localStorage plus a stubbed oauth worker)
  before a spec can get to it.
- **`collection-manager-modal.ts` / `add-to-collection-menu.ts`** — opened from
  `dye-selector`'s `#manage-collections-btn` and `dye-grid`'s per-dye
  collection button. Neither element was found in the rendered DOM at 1440x900
  on harmony/comparison/accessibility/budget. Whether that is a routing
  question or the same left-panel gap the `mobile-chrome` section above
  describes is **not yet established** — do not write a spec against them until
  someone has confirmed which, because a spec that cannot find its trigger will
  be "fixed" into a guarded no-op.
- **`share-service.ts`** — the share button exists (one `v4-share-button`,
  title "Share") but its inner button did not become actionable within 8s in a
  probe. Clipboard assertions also need `context.grantPermissions`.

### Fixture assumptions that were wrong, and the product was right

Recorded because each one *looked* like a bug for a while:

- An API preset with `is_curated: true` does not appear on the gallery's
  default **Community** tab — the tabs are Community / Official / Saved / Mine
  and `is_curated` belongs to Official.
- A preset card's `.band-seg` colour strip is only drawn when the card has a
  preview shot; the unconditional proof that `dyes[]` arrived is the dye-count
  line.
- A tab button's accessible name is its label plus its count ("Official 1"), so
  an anchored `/^Official$/` never matches.

