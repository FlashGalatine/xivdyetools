# Slot-aware dye picking and picked-dye feedback (web-app)

- Date: 2026-11-13
- Issue: FlashGalatine/xivdyetools#422 ("Improve the mobile version's functionality")
- Unit: `apps/web-app` only
- Status: design, awaiting the maintainer's approval

In this document, "the maintainer decided" marks a ruling made in the design
conversation. "Call" marks a choice the author made that the maintainer has
not ruled on; a builder may revisit a call with a reason, but not a ruling.

## Intent

The first thing anyone does in a dye tool is choose a dye. On a phone that is
harder than it should be:

- The palette starts closed below 768 px, and outside Harmony Explorer the only
  way to open it is the round button at the bottom right.
- The empty "+" / "Add Dye" slots in Dye Mixer, Dye Comparison and
  Accessibility Checker have a pointer cursor and hover styling but no tap
  handler.
- Gradient Builder's FROM/TO cards mark a target for the next pick but do not
  open the palette.
- The palette cannot be told which slot a pick is for, so there is no way to
  replace one specific dye.
- The palette stays open after a pick and covers the result. It is 320 px wide
  on a 375 px screen, so only a 55 px sliver of the tool is visible behind it.
- A swatch looks the same before and after it is picked, so nothing confirms
  that a pick landed.

This change makes a slot the thing you tap to fill it, tells the palette which
slot it is filling, and shows in the palette which dyes the tool holds.

## Goals

1. Tapping an empty slot or empty-state card opens the palette for that slot.
2. Tapping a filled slot lets the next pick replace that dye.
3. On a phone, a palette opened by a slot tap closes after the pick.
4. The palette marks every dye the active tool holds, and shows which slot is
   being filled.
5. In multi-input tools, tapping a marked dye removes it.

## Non-goals

- Extractor, Community Presets and Glamour Reader. They have no palette
  (`TOOLS_WITHOUT_PALETTE` in `v4-layout-shell.ts`).
- Unifying what an untargeted pick does when a tool is full. Dye Comparison
  ignores it, Accessibility Checker drops the oldest dye, Dye Mixer and
  Gradient Builder shift. These stay as they are. The maintainer decided this.
- Opening the palette automatically when an empty tool loads.
- New telemetry events.
- Any change to the palette's width or position on a phone.
- The rest of issue 422. This is its first slice; the issue stays open.

## Anti-goals

- A pick must never land somewhere other than what the palette says it is
  filling.
- A phone user must never have to close the palette by hand to see the result
  of a pick they started from a slot.
- Desktop must not gain open/close behavior. The palette is docked there.
- No slot may look tappable and do nothing.

## Behavior

### Vocabulary

- **Single-input tools:** Harmony Explorer (base dye), Budget Suggestions
  (target dye), Swatch Matcher (reverse match).
- **Multi-input tools:** Dye Comparison (up to 4), Accessibility Checker (up
  to 4), Dye Mixer (A and B), Gradient Builder (FROM and TO).
- **Target:** the slot the next pick will fill. At most one at a time. None by
  default.
- **Slot tap:** a tap on a slot or empty-state card inside the tool.
- **Phone:** the existing `(max-width: 768px)` check.

### Opening the palette

| How it was opened | Target | After a pick on a phone |
|---|---|---|
| Slot tap in the tool | That slot | Palette closes |
| Round palette button | None | Palette stays open |

The maintainer decided both rows. The rule to implement is: the palette closes
after a pick only when a slot tap opened it. Call: this holds even if the user
changes the target from the slot strip while it is open.

On desktop a slot tap sets the target and nothing closes. Call: if the user
had closed the docked palette, a slot tap reopens it, since otherwise the tap
does nothing visible.

### What counts as a slot tap, per tool

| Tool | Empty | Filled |
|---|---|---|
| Harmony Explorer | Wheel hub and empty-state button (both exist today) | Wheel hub (exists today) |
| Budget Suggestions | The empty-state card | The target dye card |
| Swatch Matcher | None (see below) | The source card |
| Dye Mixer | Slot A / slot B box | Slot A / slot B box |
| Gradient Builder | FROM / TO card (exists; add the palette opening) | Same |
| Dye Comparison | The 4 "Add Dye" placeholders at zero dyes; one "Add dye" tile at 1 to 3 | None in the tool; use the slot strip |
| Accessibility Checker | The 4 "Add Dye" placeholders at zero dyes; one "Add dye" tile at 1 to 3 | None in the tool; use the slot strip |

Dye Comparison and Accessibility Checker show their four placeholders only
while they hold no dyes; the placeholders belong to the empty-state container,
which hides at the first pick. Two additions follow from that:

- **One "Add dye" tile.** While the tool holds one to three dyes, a single
  "Add dye" tile follows the filled result cards. Tapping it is a slot tap for
  the next free slot. It is absent at zero dyes (the placeholders cover that)
  and at four. The maintainer decided this. Its look follows the existing
  placeholders; its size and place in each tool's phone and desktop layout are
  the builder's.
- **At zero dyes, every placeholder means "add the first dye".** Tapping any
  of the four targets slot 1, and the header line reads "Choosing dye 1 of 4".
  Call.

Swatch Matcher's empty-state card is not a slot tap. Call, flagged to the
maintainer: the card asks for a color from the character grid, which is the
tool's main input, and a palette pick runs a separate reverse match that does
not replace the card. Wiring it would leave the card on screen, still asking
for a grid color, after the pick. Swatch Matcher's slot tap is its source
card, which appears once a reverse match exists.

In Dye Comparison and Accessibility Checker a picked dye becomes a result card
whose controls are buttons. Those cards get no new tap target: the slot strip
in the palette is how a filled slot is targeted there. The maintainer decided
this by choosing the slot strip.

Gradient Builder keeps its existing rule that TO is unavailable until FROM is
set.

Everything a slot tap is attached to must be a real button or have button
semantics, reachable by keyboard.

### What a pick does

Single-input tools: a pick always means "use this dye", as today. Picking the
dye already held changes nothing. The maintainer decided this.

Multi-input tools, no target:

- An unmarked dye is added by the tool's existing untargeted rule.
- A marked dye is removed from its slot. The maintainer decided this.

Multi-input tools, with a target:

- An unmarked dye goes into the target slot, replacing what was there.
- A dye already in another slot swaps with the target slot's dye. If the
  target slot was empty, the dye moves there.
- The target slot's own dye changes nothing.
- A targeted pick never removes.
- The target clears after the pick. Call.

Removing: Dye Comparison and Accessibility Checker close the gap, as their own
Remove buttons do today, so later slots renumber. Dye Mixer and Gradient
Builder empty the slot in place. Call: removing FROM in Gradient Builder while
TO is set moves TO's dye to FROM, because the tool stores its endpoints as a
dense list and already requires FROM first.

Random dye and custom color fill the target if there is one, and otherwise
add by the tool's untargeted rule. Call: random never removes. In a
multi-input tool it rolls only among dyes the tool does not hold, so the dice
button cannot delete a dye. A custom color cannot be removed by tapping, since
it has no swatch.

The existing "clear all" control clears the target as well as the dyes.
Switching tools clears the target.

### Dye Mixer: no duplicates

Dye Mixer can no longer hold the same dye in both slots. The maintainer
decided this: blending a dye with itself gives the same dye back, and
tap-again-to-remove cannot coexist with duplicates.

- `selectDye` no longer accepts a second copy.
- Saved state and share links that contain the same dye twice load with only
  slot A filled.
- The tool's own `DyeSelector` is not rendered in the v4 layout (Dye Mixer
  skips `renderLeftPanel` there), so the palette and the load paths are the
  only ways a dye gets in. If that selector is ever rendered again it must
  follow the same rule.
- The three tests in `mixer-tool.test.ts` that assert duplicates (around lines
  622 to 644) are replaced by tests of the new rule.

### The palette: marks, strip and header line

The maintainer chose mockup C. The mockup file is
`.superpowers/brainstorm/765-1794576235/content/picked-swatch-mark.html` in
the design worktree (git-ignored, so not in the repository); the description
below is complete without it.

**Swatch mark.** A swatch whose dye the active tool holds gets:

- a double ring: a gap in the palette's background color, then a line in the
  theme's text color, so it reads on any dye color;
- a small check badge on the bottom-left corner. The favorite star owns the
  top-right corner and is always visible on touch screens.

The mark of the target slot's dye uses the theme's primary color for the ring
and the badge. A favorited dye appears in both the favorites row and the main
grid; both copies are marked. A brief pulse plays on the swatch when a pick
lands, and is skipped under `prefers-reduced-motion`.

**Slot strip.** In multi-input tools, a row of chips sits at the top of the
palette's content, one chip per slot, in slot order:

- each chip shows the slot's label and a small swatch of its dye, or a dashed
  empty box;
- labels: 1 to 4 in Dye Comparison and Accessibility Checker, A and B in Dye
  Mixer, the existing FROM and TO labels in Gradient Builder;
- tapping a chip makes that slot the target; tapping the target chip again
  clears the target;
- the target chip takes the primary color;
- Gradient Builder's TO chip is disabled until FROM is set;
- Call: in Dye Comparison and Accessibility Checker, where dyes are a dense
  list, targeting any empty chip means "add the next dye".

Single-input tools show no strip.

Call: the strip appears on desktop too. It is the same palette component, and
it is the only way to target a filled slot in Dye Comparison and Accessibility
Checker on any screen size.

**Header line.** While a target is set, a line under the palette title names
it: "Choosing dye 2 of 4", "Choosing dye A", "Choosing the FROM color". With
no target the line is absent. It is announced politely to screen readers when
it changes.

**Target slot in the tool.** The targeted slot in the tool takes the accent
border Gradient Builder already uses for its armed endpoint card
(`ACCENT_BORDER`). Gradient Builder's armed state now clears after a pick,
like every other target; today it persists until "clear all".

**Dye identity.** A mark matches on `dye.id`. Custom colors are never marked.
Swatch Matcher stores only a color value, so its mark matches the swatch whose
dye was last picked; if that cannot be done cleanly, Swatch Matcher ships
without a mark and the builder says so in the pull request. Call.

### Accessibility

- Marked swatches expose their state: the pick button's accessible name
  includes the slot label, and it is `aria-pressed` in multi-input tools.
- Chips are buttons with `aria-pressed` for the target.
- When a slot tap opens the palette on a phone, focus moves into the palette;
  when the palette closes after the pick, focus returns to the slot that was
  tapped, or to its replacement element if the slot re-rendered.
- State is never conveyed by color alone: the ring has a badge, and the target
  has the header line.

## Approaches

Four directions were laid out for the first decision:

1. **Wire the taps.** Every empty slot opens the palette; picks fill the next
   free slot. Smallest; fixes only the dead taps.
2. **Wire the taps and close after picking.** Adds the phone close rule.
3. **Slot-aware picking.** A tapped slot is the target; filled slots can be
   replaced. Needs new routing between palette and tools.
4. **Open the palette on arrival.** Removes the first tap but hides the tool
   the user just chose.

The maintainer picked 2 and 3 together. Direction 1 is contained in them and
direction 4 was dropped.

Three ways to show a picked dye were mocked up:

- **A, ring and corner number.** Smallest mark; filled result cards would have
  needed a new Replace action.
- **B, ring and center number.** Easiest to spot; covers part of the color.
- **C, check marks plus a slot strip.** The strip shows what is where and is
  the tap target for filled slots.

The maintainer picked C. The deciding fact was that the open palette hides the
tool on a phone, so the palette has to carry the slots itself.

## How it fits the code today

Findings from the survey, for the builder's orientation. Line numbers are as
of `main` at `ee4dd0b6` and will drift.

- The shell (`components/v4/v4-layout-shell.ts`) owns `paletteDrawerOpen` and
  already handles a bubbling `open-palette-drawer` event on `<main>`
  (`handleOpenPaletteDrawer`). The event carries no detail and is not gated to
  phones. Harmony Explorer is its only sender.
- The palette (`components/v4/dye-palette-drawer.ts`) is a Lit element with
  `is-open` and `active-tool` properties. It emits `dye-selected`,
  `custom-color-selected` and `clear-all-dyes`. `renderSwatch` draws one
  swatch for both the favorites row and the main grid.
- `components/v4-layout.ts` routes those events to the active tool by duck
  typing: `selectDye`, else `addDye`; `clearDyes`, else `clearSelection`;
  `selectCustomColor`. There is no tool interface.
- No tool announces selection changes. Each keeps its own state and storage
  key.
- Gradient Builder's `activeEndpoint` and `setEndpoint` (which already swaps
  on a duplicate) are the one existing implementation of a target.
- Only Dye Mixer's private `handleSlotRemove` removes by index. Dye
  Comparison and Accessibility Checker remove by dye.

## Recommended shape (builder's to refine)

This is a suggestion, not a ruling. Any shape that produces the behavior above
is acceptable.

- **One owner for the target.** Keep the target in the layout layer
  (`v4-layout.ts` with the shell), not in each tool, so the palette, the
  header line and the close rule read one value. Gradient Builder's
  `activeEndpoint` moves under it.
- **An optional slot contract on tools,** duck-typed like the existing
  methods:
  - a way to read the slots: label, dye or empty, disabled;
  - place a dye at a slot index (with the swap rule);
  - remove the dye at a slot index;
  - a bubbling event when the slots change, so the layout can refresh the
    palette.
- **The palette gets properties** for the slots, the target and whether the
  tool is multi-input, bound by the shell, and emits a target-change event
  from the strip.
- **`open-palette-drawer` gains an optional slot index** in its detail.
  Harmony Explorer's existing bare event keeps working.
- **The shell records whether a slot tap opened the palette** and applies the
  close rule in its `dye-selected` handler, on phones only.

## Constraints

- **Theme tokens only.** No hardcoded colors; use the `--theme-*` variables.
  The gap color of the ring is the palette's own background.
- **Strings.** Every new string goes through `LanguageService` and exists in
  all six locales (en, ja, de, fr, ko, zh). The parity gates
  (`scripts/i18n-parity-gate.test.js`) and the no-hardcoded-UI-strings ESLint
  rule apply. Reuse `gradient.fromLabel`, `gradient.toLabel` and
  `common.remove` where they fit.
- **Bundle budgets.** `npm run build:check` must pass; the layout shell chunk
  is capped at 218 KB.
- **Tutorial.** `tutorial-service.ts` and `tutorial-spotlight.ts` point at
  elements inside the palette. The strip must not displace or break those
  targets.
- **Tests.** Unit tests beside the existing ones
  (`__tests__/v4/v4-layout-shell.test.ts`, `__tests__/v4-layout.test.ts`,
  `__tests__/v4/dye-palette-drawer.test.ts`, each tool's test file), plus a
  Playwright spec in the `mobile-chrome` project covering: tap an empty slot,
  pick, palette closes, slot filled; open from the round button, pick twice,
  palette stays open; add a second dye from the "Add dye" tile and see the
  palette close; target a filled slot from the strip and replace it; tap
  a marked dye to remove it.
- **Gate.** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`
  plus the repository-wide checks named in the root `CLAUDE.md`.
- **Release.** This is a feature, so a minor version of the web app. The
  number is claimed at implementation time after scanning every open pull
  request, since several already claim 5.16.x and 5.17.0. Both changelogs and
  the What's New entry are part of done. The work ends as a pull request
  against `main`; merging is the maintainer's.

## Left to the builder

- The exact contract names and event names.
- Chip and badge dimensions, within the mockup's proportions (chips about
  34 px tall; badge about 20 px).
- The wording of the new strings and their five translations.
- Whether the strip scrolls with the swatch grid or stays pinned under the
  search and filter controls.
- How to split the work into commits or stacked pull requests.
- Whether Swatch Matcher gets a mark (see Dye identity).
