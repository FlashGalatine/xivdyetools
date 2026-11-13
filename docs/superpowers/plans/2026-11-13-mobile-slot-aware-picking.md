# Slot-Aware Dye Picking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the web app, a tapped dye slot becomes the target of the next palette pick, the palette closes after that pick on a phone, and the palette shows which dyes the active tool holds.

**Architecture:** The layout shell owns one palette target and the "a slot tap opened me" flag, and stamps the target onto every pick it re-emits. `v4-layout.ts` stays stateless: it reads the active tool's slots through a small duck-typed contract, pushes them to the shell (which binds them to the palette), and routes each pick through one pure function that decides add / place / remove. Each tool implements the contract and turns its slots into buttons.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), Lit 3 for the shell and palette, `BaseComponent` classes for the tools, Vitest (jsdom), Playwright (`mobile-chrome` project).

**Spec:** `docs/superpowers/specs/2026-11-13-mobile-slot-aware-picking-design.md`. Read it first. Its "the maintainer decided" lines are rulings; its "Call" lines may be revisited with a reason.

## Global Constraints

- All paths below are relative to `apps/web-app/` unless they start with `docs/` or `CHANGELOG`.
- Phone means the shell's existing `(max-width: 768px)` check (`isMobile`). Add no second breakpoint.
- Theme tokens only: `--theme-*` / `--v4-*` variables, never a hardcoded color. The ring's gap color is the palette's own background.
- Every new string goes through `LanguageService` and exists in all six locales (`src/locales/{en,ja,de,fr,ko,zh}.json`). The parity gate (`scripts/i18n-parity-gate.test.js`) and the `xivdyetools-i18n/no-hardcoded-ui-strings` rule apply. Interpolation uses `{name}`-style placeholders with `LanguageService.tInterpolate`.
- Type-only imports use `import type`.
- Single test file: `pnpm --filter xivdyetools-web-app exec vitest run <file> --coverage.enabled=false` from the repository root. Never `npm test <path>`.
- This worktree needs `pnpm install --frozen-lockfile` and `pnpm turbo run build --filter=xivdyetools-web-app^...` once before any test runs.
- Commit with `git commit --only -- <paths>`; never `git stash`; never switch branches in another checkout.
- No new telemetry events. `TelemetryService.trackDyePick` keeps firing exactly when it does today (a non-random pick a tool consumed), and not for a remove.
- `npm run build:check` must pass (layout shell chunk ≤ 218 KB).
- Do not change the palette's width or position, the untargeted "tool is full" rules, or Extractor / Community Presets / Glamour Reader.

## Review Focus

1. **Stale target after the slots change underneath it.** Target slot 3, then "clear all", remove a dye from a result card, or switch tools: the header line and the red chip must not point at a slot that no longer means the same thing. Expected: the target clears. (Tests: Task 2 step 1, Task 4 step 1.)
2. **Palette closed by something other than the pick.** Slot tap opens it, the user closes it with ✕ or the scrim, then opens it from the round button: picks must now leave it open and fill the next free slot. (Test: Task 2 step 1.)
3. **Saved or shared Dye Mixer state with the same dye twice.** Expected: loads with slot A filled, slot B empty, no error. (Test: Task 5 step 1.)
4. **Custom color while a dye in the tool is a custom color.** A custom dye has a negative id and no swatch: it must never be marked, never be matched as "already held" against a palette dye, and a targeted custom color must land in the target. (Tests: Task 1 step 1, Task 4 step 1.)
5. **Rotating or resizing across 768 px with a target set.** The shell already closes the palette when it becomes a phone layout. Expected: target and slot-tap flag reset, no pick lands in a slot the user can no longer see named. (Test: Task 2 step 1.)

---

## File Structure

| File | Responsibility |
|---|---|
| Create `src/components/palette-slots.ts` | The slot contract types, the type guard, and the pure pick-resolution function. No DOM, no services. |
| Create `src/components/__tests__/palette-slots.test.ts` | Unit tests for the above. |
| Modify `src/components/v4/v4-layout-shell.ts` | Owns `paletteTarget` and the slot-tap flag; close rule; passes slots/target to the palette; focus return. |
| Modify `src/components/v4/dye-palette-drawer.ts` | Swatch marks, slot strip, header line, random-dye exclusion. |
| Modify `src/components/v4-layout.ts` | Reads the tool's slots, pushes them to the shell, routes picks with `resolvePick`, forwards the target to the tool. |
| Modify `src/components/{mixer,gradient,comparison,accessibility,harmony,budget,swatch}-tool.ts` | Implement the contract; make slots real buttons that open the palette. |
| Modify `src/locales/*.json` | New `colorPalette.*` keys. |
| Create `e2e/slot-aware-picking.spec.ts` | Phone flows end to end. |

---

### Task 1: Slot contract and pick resolution

**Files:**
- Create: `src/components/palette-slots.ts`
- Test: `src/components/__tests__/palette-slots.test.ts`

**Interfaces:**
- Produces:

```ts
import type { Dye } from '@xivdyetools/types';

export type PaletteSlotMode = 'single' | 'multi';

export interface PaletteSlot {
  /** Short chip label: "1".."4", "A"/"B", or the localized FROM/TO label. '' for single-input tools. */
  label: string;
  /** Full localized header line for this slot, e.g. "Choosing dye 2 of 4". '' for single-input tools. */
  targetLabel: string;
  dye: Dye | null;
  /** True when the slot cannot be targeted yet (Gradient Builder's TO before FROM). */
  disabled?: boolean;
}

/** Every palette tool implements this. */
export interface PaletteSlotSource {
  readonly paletteSlotMode: PaletteSlotMode;
  getPaletteSlots(): PaletteSlot[];
}

/** Multi-input tools implement this as well. */
export interface PaletteSlotHost extends PaletteSlotSource {
  readonly paletteSlotMode: 'multi';
  /** True when the slots are a dense list (Dye Comparison, Accessibility Checker): every empty slot means "the next one". */
  readonly paletteSlotsDense?: boolean;
  /** Put `dye` in slot `index`. If the dye is in another slot, the two slots swap. */
  placeDyeAt(index: number, dye: Dye): void;
  removeDyeAt(index: number): void;
  /** Draw (or clear, with null) the accent border on the targeted slot in the tool. */
  setPaletteTarget(index: number | null): void;
}

export const PALETTE_SLOTS_CHANGED = 'palette-slots-changed';
export const OPEN_PALETTE_DRAWER = 'open-palette-drawer';
export interface OpenPaletteDrawerDetail { slot?: number }

export function isPaletteSlotSource(tool: unknown): tool is PaletteSlotSource;
export function isPaletteSlotHost(tool: unknown): tool is PaletteSlotHost;

/** Index of the slot holding this dye id, or -1. Custom dyes (isCustomDye) never match. */
export function findHeldSlot(slots: readonly PaletteSlot[], dye: Pick<Dye, 'id' | 'category'>): number;

/** Disabled or out-of-range → null. When `dense`, any empty slot index collapses to the first empty one. */
export function normalizeTarget(slots: readonly PaletteSlot[], target: number | null, dense: boolean): number | null;

/** The accent border of a targeted slot in a tool (Gradient Builder's former ACCENT_BORDER value). */
export const SLOT_TARGET_BORDER = 'color-mix(in srgb, var(--theme-primary) 45%, transparent)';

export type PickAction =
  | { kind: 'add' }                    // use the tool's existing selectDye/addDye
  | { kind: 'place'; index: number }
  | { kind: 'remove'; index: number }
  | { kind: 'none' };

export function resolvePick(input: {
  mode: PaletteSlotMode;
  slots: readonly PaletteSlot[];
  target: number | null;
  dye: Pick<Dye, 'id' | 'category'>;
  random?: boolean;
}): PickAction;
```

`resolvePick` rules (from the spec's "What a pick does"):

| mode | target | dye is… | result |
|---|---|---|---|
| single | any | anything | `add` |
| multi | null | not held | `add` |
| multi | null | held in slot i, `random` false | `remove i` |
| multi | null | held, `random` true | `none` |
| multi | t | held in slot t | `none` |
| multi | t | anything else (held elsewhere or not) | `place t` |

- [ ] **Step 1: Write the failing tests**

One `it` per table row above, plus:

```ts
it('never matches a custom dye as held', () => {
  const custom = makeCustomDye('#123456');
  const slots = [slot('1', custom), slot('2', null)];
  expect(findHeldSlot(slots, makeCustomDye('#123456'))).toBe(-1);
  expect(resolvePick({ mode: 'multi', slots, target: null, dye: makeCustomDye('#123456') }))
    .toEqual({ kind: 'add' });
});
it('normalizeTarget collapses an empty slot to the first empty one', () => {
  const slots = [slot('1', dyeA), slot('2', null), slot('3', null), slot('4', null)];
  expect(normalizeTarget(slots, 3, true)).toBe(1);
  expect(normalizeTarget(slots, 0, true)).toBe(0);
  expect(normalizeTarget(slots, 3, false)).toBe(3);   // Dye Mixer / Gradient Builder keep fixed positions
});
it('normalizeTarget rejects a disabled or out-of-range slot', () => {
  const slots = [slot('FROM', null), { ...slot('TO', null), disabled: true }];
  expect(normalizeTarget(slots, 1, false)).toBeNull();
  expect(normalizeTarget(slots, 7, false)).toBeNull();
});
it('isPaletteSlotHost needs the four required members and multi mode', () => { /* object with and without each */ });
```

Confirm `SLOT_TARGET_BORDER` equals `ACCENT_BORDER` in `gradient-tool.ts` (line ~174) before relying on it; if they differ, copy that file's value.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/palette-slots.test.ts --coverage.enabled=false`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/components/palette-slots.ts`** with the signatures above. Use `isCustomDye` from `@shared/custom-dye`.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat(web-app): palette slot contract and pick resolution`

---

### Task 2: Shell owns the target and the close rule

**Files:**
- Modify: `src/components/v4/v4-layout-shell.ts` (handlers around lines 518-610, template around 759-781)
- Test: `src/components/__tests__/v4/v4-layout-shell.test.ts`

**Interfaces:**
- Consumes: `PaletteSlot`, `PaletteSlotMode`, `OpenPaletteDrawerDetail`, `normalizeTarget` from Task 1.
- Produces, on `<v4-layout-shell>`:
  - `@property({ attribute: false }) paletteSlots: PaletteSlot[] = []`
  - `@property({ attribute: false }) paletteSlotMode: PaletteSlotMode | null = null`
  - `@property({ attribute: false }) paletteSlotsDense = false`
  - read-only getter `paletteTarget: number | null`
  - public `clearPaletteTarget(): void`
  - re-emitted `dye-selected` detail becomes `{ dye, random?, target: number | null }`
  - re-emitted `custom-color-selected` detail becomes `{ hex, target: number | null }`
  - new event `palette-target-change`, detail `{ index: number | null }`, emitted whenever the target changes
  - binds to the palette: `.slots`, `.slotMode`, `.slotTarget` (Task 3), and listens for its `slot-target-change`

Behavior to implement:

- `handleOpenPaletteDrawer(e: CustomEvent<OpenPaletteDrawerDetail | undefined>)`: open the palette, dismiss the hint, set the private flag `openedBySlotTap = true`, and if `e.detail?.slot` is a number and `paletteSlotMode === 'multi'`, set the target to `normalizeTarget(paletteSlots, slot, paletteSlotsDense)`. A bare event (Harmony Explorer today) sets the flag and no target.
- `handleDyeSelected` and `handleCustomColorSelected`: re-emit with the current target, then clear the target, then if `isMobile && openedBySlotTap` close the palette and return focus (below).
- The round button (`togglePaletteDrawer`), the palette's ✕, the scrim, a tool change, a breakpoint change and `clear-all-dyes`: set `openedBySlotTap = false`. All of them except the round button opening the palette also clear the target. On desktop the target otherwise persists until a pick.
- `slot-target-change` from the palette: set the target (same normalization; `null` clears). Does not touch `openedBySlotTap`.
- Focus return after a pick closes the palette: `await this.updateComplete`, then on the next animation frame focus `this.querySelector('[data-palette-slot="<index>"]')` (tool content is slotted light DOM), falling back to `[data-palette-slot]`, then to the palette FAB. Remember the slot index from the opening event; a bare event uses the fallbacks.
- Focus on open: when a slot tap opens the palette on a phone, move focus to the palette's close button after `updateComplete`.

- [ ] **Step 1: Write the failing tests** in the existing file, using its helpers for mounting the shell and faking `matchMedia`:

```ts
describe('slot-aware palette', () => {
  it('a slot tap opens the palette, sets the target and announces it');
  // dispatch open-palette-drawer {slot: 2} from slotted content with paletteSlotMode 'multi'
  // expect paletteDrawerOpen, paletteTarget === 2, one palette-target-change {index: 2}
  it('stamps the target on the re-emitted dye-selected and then clears it');
  it('closes after a pick on a phone when a slot tap opened it');
  it('stays open after a pick on a phone when the round button opened it');
  it('never closes after a pick on desktop');
  it('a bare open-palette-drawer sets no target but still closes after the pick on a phone');
  it('closing with ✕ or the scrim clears the target and the slot-tap flag');
  // then open from the FAB, pick: stays open, detail.target === null   (Review Focus 2)
  it('a tool change clears the target');                                   // Review Focus 1
  it('crossing into the phone layout clears the target');                  // Review Focus 5
  it('clear-all-dyes clears the target');                                  // Review Focus 1
  it('slot-target-change from the palette sets and clears the target without changing the close rule');
  it('ignores a slot index for a single-input tool');
  it('returns focus to the tapped slot after the palette closes');
});
```

- [ ] **Step 2: Run to verify failure.** `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4/v4-layout-shell.test.ts --coverage.enabled=false`. Expected: the new tests FAIL, the existing ones PASS.

- [ ] **Step 3: Implement** the behavior list above. Keep `handleOpenPaletteDrawer` bound on `<main>` as it is.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat(web-app): shell tracks the palette target and closes after a slot-tap pick`

---

### Task 3: Palette marks, slot strip and header line

**Files:**
- Modify: `src/components/v4/dye-palette-drawer.ts` (`renderSwatch` ~1311, header ~1103, `handleRandomDye` ~975, styles ~463-620)
- Modify: `src/locales/{en,ja,de,fr,ko,zh}.json` (`colorPalette` block)
- Test: `src/components/__tests__/v4/dye-palette-drawer.test.ts`

**Interfaces:**
- Consumes: `PaletteSlot`, `PaletteSlotMode`, `findHeldSlot` from Task 1.
- Produces, on `<dye-palette-drawer>`:
  - `@property({ attribute: false }) slots: PaletteSlot[] = []`
  - `@property({ attribute: false }) slotMode: PaletteSlotMode | null = null`
  - `@property({ attribute: false }) slotTarget: number | null = null`
  - event `slot-target-change`, detail `{ index: number | null }` (bubbles, composed)
  - CSS hooks other tasks and the E2E spec rely on: `.swatch.in-use`, `.swatch.is-target`, `.swatch-mark`, `.slot-strip`, `.slot-chip`, `.slot-chip.is-target`, `.drawer-target-line`

New locale keys (English values; translate the other five, do not leave them in English):

| Key | English |
|---|---|
| `colorPalette.slotStripLabel` | `Dye slots` |
| `colorPalette.slotChipEmpty` | `Slot {slot}, empty` |
| `colorPalette.slotChipFilled` | `Slot {slot}: {name}` |
| `colorPalette.swatchInSlot` | `{name}, in slot {slot}` |
| `colorPalette.swatchInUse` | `{name}, in use` |
| `colorPalette.choosingDyeOf` | `Choosing dye {current} of {total}` |
| `colorPalette.choosingDyeNamed` | `Choosing dye {slot}` |
| `colorPalette.choosingEndpoint` | `Choosing the {slot} color` |

The three `choosing…` keys are used by the tools (Tasks 5 to 8) to build `PaletteSlot.targetLabel`; they are added here so one task owns the locale files.

What to render:

- **Swatch mark.** For a swatch whose dye is held (`findHeldSlot(...) >= 0`): add `in-use` to `.swatch`, plus `is-target` when that slot is `slotTarget`. Add a `<span class="swatch-mark" aria-hidden="true">` holding a check glyph, positioned bottom-left (the star owns top-right). Ring: `box-shadow: 0 0 0 2px <palette background>, 0 0 0 4px var(--theme-text)`; `is-target` uses `var(--theme-primary)` for the ring and the mark's fill. The `.swatch-pick` button's `aria-label` becomes `swatchInSlot` (multi) or `swatchInUse` (single), and it gets `aria-pressed="true"` in multi mode. Both the favorites row and the main grid go through `renderSwatch`, so both copies are marked.
- **Pulse.** When `handleDyeClick` fires, add a `just-picked` class to that swatch for one animation (about 300 ms), removed on `animationend`. Wrap the keyframes in `@media (prefers-reduced-motion: no-preference)`.
- **Slot strip.** When `slotMode === 'multi'`, render `<div class="slot-strip" role="group" aria-label=slotStripLabel>` as the first child of the scrolling content, one `<button class="slot-chip" type="button">` per slot: a small swatch of the dye (or a dashed empty box), then `slot.label`. `aria-pressed` reflects the target; `aria-label` is `slotChipFilled` / `slotChipEmpty`; `disabled` follows `slot.disabled`. Click emits `slot-target-change` with the chip's index, or `null` if it is already the target. Chips are about 34 px tall and share the row equally.
- **Header line.** When `slotTarget !== null` and that slot exists, render `<span class="drawer-target-line" aria-live="polite">` with `slots[slotTarget].targetLabel` under `.drawer-title`, in `var(--theme-primary)`. Absent otherwise.
- **Random dye.** In multi mode, `handleRandomDye` chooses only among dyes with `findHeldSlot(...) === -1`. If none remain, show the existing `colorPalette.noDyesAvailable` warning.
- **Tutorial.** `tutorial-service.ts` targets elements inside this component by selector. After adding the strip, confirm each selector it uses still resolves to the same element.

- [ ] **Step 1: Write the failing tests**

```ts
it('marks a held dye in both the favorites row and the main grid');
it('gives the target slot’s dye the is-target class');
it('labels a marked swatch with its slot and sets aria-pressed in multi mode');
it('labels a marked swatch as in use, without aria-pressed, in single mode');
it('renders one chip per slot in multi mode and none in single mode');
it('emits slot-target-change with the index, and null when the target chip is clicked again');
it('disables a chip whose slot is disabled');
it('shows the target line only while a target is set');
it('random dye never returns a held dye in multi mode');      // stub Math.random across the held index
it('does not mark a swatch for a custom dye held by the tool'); // Review Focus 4
```

- [ ] **Step 2: Run to verify failure.** `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4/dye-palette-drawer.test.ts --coverage.enabled=false`

- [ ] **Step 3: Implement** rendering, styles and the eight keys in all six locale files (keep each file's key order as the i18n order check expects).

- [ ] **Step 4: Run to verify pass**, then the i18n gates:

Run: `pnpm --filter xivdyetools-web-app exec vitest run scripts/i18n-parity-gate.test.js --coverage.enabled=false`
Expected: PASS. If a `choosing…` key is reported unused, that is expected until Task 5; do not delete the key, and leave the i18n-unused failure to be cleared by Tasks 5 to 8 (run the full gate only in Task 11).

- [ ] **Step 5: Commit** `feat(web-app): palette marks held dyes and shows a slot strip`

---

### Task 4: Layout routes picks through the contract

**Files:**
- Modify: `src/components/v4-layout.ts` (listeners at ~197-259; tool mount at ~558)
- Test: `src/components/__tests__/v4-layout.test.ts` (mock tools at ~170, `dropPick` at ~398)

**Interfaces:**
- Consumes: Task 1's guards and `resolvePick`; Task 2's shell properties and events; `makeCustomDye` from `@shared/custom-dye`.
- Produces: nothing new for later tasks. Tools only need to implement Task 1's contract and dispatch `PALETTE_SLOTS_CHANGED` (bubbling) from their container when their held dyes change.

Add one helper, `syncPaletteSlots(): void`, that sets on the shell `paletteSlotMode` (the tool's mode, or `null` if the tool is not a `PaletteSlotSource`), `paletteSlots` (`getPaletteSlots()` or `[]`) and `paletteSlotsDense` (the host's `paletteSlotsDense === true`). Call it after a tool mounts, after every routed pick / custom color / clear, and from a `palette-slots-changed` listener on the layout element. If a `palette-slots-changed` arrives while the shell has a target, call `shell.clearPaletteTarget()` first only when it did not come from a routed pick (set a local flag around routed calls).

`dye-selected` routing (detail now carries `target`):

```
if tool is a PaletteSlotHost:
  action = resolvePick({ mode, slots: tool.getPaletteSlots(), target, dye, random })
  place  → tool.placeDyeAt(index, dye)
  remove → tool.removeDyeAt(index)
  add    → existing selectDye / addDye path
  none   → nothing
else: existing path, unchanged
```

`consumed` is true for `place` and `add`, false for `remove` and `none`, so `trackDyePick` keeps its meaning.

`custom-color-selected` (detail now carries `target`): for a `PaletteSlotHost` with a non-null target, call `tool.placeDyeAt(target, makeCustomDye(hex))`; otherwise the existing `selectCustomColor` path.

`palette-target-change` from the shell: if the tool is a `PaletteSlotHost`, call `tool.setPaletteTarget(index)`.

- [ ] **Step 1: Write the failing tests**, adding a mock multi-input tool that records calls:

```ts
it('pushes the mounted tool’s slots and mode to the shell');
it('routes an untargeted pick of an unheld dye to selectDye');
it('routes an untargeted pick of a held dye to removeDyeAt and does not record a dye pick');
it('routes a targeted pick to placeDyeAt with the target index');
it('does nothing for a targeted pick of the target slot’s own dye');
it('never removes on a random pick');
it('routes a targeted custom color to placeDyeAt with a custom dye');        // Review Focus 4
it('forwards palette-target-change to setPaletteTarget');
it('re-syncs slots on palette-slots-changed and clears a target the pick did not cause'); // Review Focus 1
it('leaves a tool without the contract on the old selectDye path');
```

- [ ] **Step 2: Run to verify failure.** `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4-layout.test.ts --coverage.enabled=false`

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** `feat(web-app): route palette picks by slot target`

---

### Task 5: Dye Mixer

**Files:**
- Modify: `src/components/mixer-tool.ts` (`selectDye` ~860-912, `handleSlotRemove` ~1167, `createDyeSlot` ~1720-1815, `loadSelectedDyes` ~252, `loadFromShareUrl` ~739)
- Test: `src/components/__tests__/mixer-tool.test.ts` (duplicate tests at ~622-644)

**Interfaces:**
- Consumes: Task 1's `PaletteSlotHost`, `PALETTE_SLOTS_CHANGED`, `OPEN_PALETTE_DRAWER`; key `colorPalette.choosingDyeNamed`.
- Produces: `MixerTool implements PaletteSlotHost`, mode `'multi'`, not dense, two slots labelled with the letters the slot boxes already show.

- [ ] **Step 1: Write the failing tests.** Replace the three duplicate tests with:

```ts
it('does not accept the same dye in both slots through selectDye');   // slot B stays empty
it('loads saved state holding the same dye twice with only slot A filled');   // Review Focus 3
it('loads a share link holding the same dye twice with only slot A filled');  // Review Focus 3
```

and add:

```ts
it('getPaletteSlots returns A and B with their dyes and a targetLabel');
it('placeDyeAt(1, dye) fills B and leaves A');
it('placeDyeAt(0, dyeInB) swaps A and B');
it('placeDyeAt(1, dyeInA) with B empty moves the dye to B');
it('removeDyeAt(0) empties A in place and keeps B');
it('a click on an empty or a filled slot box dispatches open-palette-drawer with its slot');
it('slot boxes are buttons carrying data-palette-slot');
it('setPaletteTarget(1) puts the accent border on B and null removes it');
it('dispatches palette-slots-changed after select, place, remove and clear');
```

- [ ] **Step 2: Run to verify failure.** `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/mixer-tool.test.ts --coverage.enabled=false`

- [ ] **Step 3: Implement.** `selectDye` ignores a dye already held (the layout turns that tap into a remove before it gets here; this is the guard for other callers). Both load paths drop a second copy. `createDyeSlot` produces a `<button type="button" data-palette-slot="<index>">` with the existing look. The accent border is `SLOT_TARGET_BORDER` from Task 1.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** `feat(web-app): Dye Mixer slots open the palette; no duplicate dyes`

---

### Task 6: Gradient Builder

**Files:**
- Modify: `src/components/gradient-tool.ts` (`activeEndpoint` 259, `buildEndpointCard` ~926-996, `setEndpoint` ~1761, `selectDye` ~1904-1950, `clearDyes` ~1880)
- Test: `src/components/__tests__/gradient-tool.test.ts`

**Interfaces:**
- Consumes: Task 1 (replace the local `ACCENT_BORDER` with `SLOT_TARGET_BORDER`); key `colorPalette.choosingEndpoint`; existing `gradient.fromLabel` / `gradient.toLabel`.
- Produces: `GradientTool implements PaletteSlotHost`, mode `'multi'`, not dense, slots FROM and TO; TO has `disabled: true` while FROM is empty.

`activeEndpoint` stops being the source of truth for where a pick lands: it becomes purely the drawn state set by `setPaletteTarget`. `selectDye` loses its armed-endpoint branch (the layout calls `placeDyeAt` for targeted picks). `placeDyeAt` delegates to `setEndpoint`, which already swaps on a duplicate.

- [ ] **Step 1: Write the failing tests**

```ts
it('getPaletteSlots returns FROM and TO; TO is disabled until FROM is set');
it('clicking an endpoint card dispatches open-palette-drawer with its slot');
it('clicking the disabled TO card dispatches nothing');
it('setPaletteTarget draws the accent border, and null clears it');
it('placeDyeAt(1, dyeInFrom) swaps the endpoints');
it('removeDyeAt(1) empties TO');
it('removeDyeAt(0) with TO set moves TO’s dye to FROM');
it('removeDyeAt(0) with only FROM set leaves the tool empty');
it('selectDye no longer consults an armed endpoint');
it('dispatches palette-slots-changed after every endpoint change');
```

Update any existing test that relied on arming persisting after a pick: the target now clears after each pick (spec, "Target slot in the tool").

- [ ] **Step 2: Run to verify failure.** `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/gradient-tool.test.ts --coverage.enabled=false`

- [ ] **Step 3: Implement.** Cards get `data-palette-slot`.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** `feat(web-app): Gradient Builder endpoints open the palette and share the slot target`

---

### Task 7: Dye Comparison

**Files:**
- Modify: `src/components/comparison-tool.ts` (`renderEmptyState` ~1027-1230, `renderSelectedDyesCards` ~2030, `removeDye` ~2094, `addDye` ~2449)
- Test: `src/components/__tests__/comparison-tool.test.ts`

**Interfaces:**
- Consumes: Task 1; key `colorPalette.choosingDyeOf`; the existing "Add Dye" string the placeholders use.
- Produces: `ComparisonTool implements PaletteSlotHost`, mode `'multi'`, `paletteSlotsDense = true`, always four slots labelled `1`..`4`, `targetLabel` = `choosingDyeOf` with `{current}` = slot number and `{total}` = 4.

- [ ] **Step 1: Write the failing tests**

```ts
it('getPaletteSlots always returns four slots, filled first');
it('each empty-state placeholder is a button that dispatches open-palette-drawer with slot 0');
it('shows one Add dye tile after the cards when holding 1, 2 or 3 dyes');
it('shows no Add dye tile when holding 0 or 4 dyes');
it('the Add dye tile dispatches open-palette-drawer with the next free slot');
it('placeDyeAt(1, newDye) replaces the second dye and keeps order');
it('placeDyeAt(0, thirdDye) swaps the first and third dyes');
it('placeDyeAt(index >= count, newDye) appends');
it('placeDyeAt(index >= count, heldDye) moves that dye to the end');
it('removeDyeAt(1) removes the second dye and closes the gap');
it('setPaletteTarget on the next free slot highlights the Add dye tile');
it('dispatches palette-slots-changed after add, place, remove and clear');
```

- [ ] **Step 2: Run to verify failure.** `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/comparison-tool.test.ts --coverage.enabled=false`

- [ ] **Step 3: Implement.** All four placeholders carry `data-palette-slot="0"`; the tile carries the next free index. The tile reuses the placeholder's look at the size of one result card's row on a phone; filled result cards get no new control.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** `feat(web-app): Dye Comparison slots and Add dye tile open the palette`

---

### Task 8: Accessibility Checker

**Files:**
- Modify: `src/components/accessibility-tool.ts` (`selectDye` ~381, `renderEmptyState` ~957-1130, `renderSelectedDyeCards` ~1136, `removeDyeFromSelection` ~1200)
- Test: `src/components/__tests__/accessibility-tool.test.ts`

**Interfaces:** identical in shape to Task 7 (`paletteSlotsDense = true`, four slots, `choosingDyeOf`).

- [ ] **Step 1: Write the failing tests.** The same twelve as Task 7, against this tool, plus:

```ts
it('placeDyeAt on a full tool replaces the target and drops nothing else');
// the untargeted fifth pick still drops the oldest dye (unchanged rule); the targeted one must not
```

- [ ] **Step 2: Run to verify failure.** `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/accessibility-tool.test.ts --coverage.enabled=false`

- [ ] **Step 3: Implement.** The placeholder markup is a copy of Dye Comparison's. Do not extract a shared helper in this plan unless both copies would otherwise change in the same way in more than the button conversion; if you do extract, put it in `palette-slots.ts`'s sibling `palette-slot-tiles.ts` and say so in the commit.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit** `feat(web-app): Accessibility Checker slots and Add dye tile open the palette`

---

### Task 9: Single-input tools

**Files:**
- Modify: `src/components/harmony-tool.ts` (`selectedDye` 129), `src/components/budget-tool.ts` (`buildTargetDyeCard` ~887, empty state ~1208-1223), `src/components/swatch-tool.ts` (`selectDye` ~739, source card ~872-947, `clearReverseMatch`)
- Test: the three tools' test files under `src/components/__tests__/`

**Interfaces:**
- Consumes: Task 1's `PaletteSlotSource`, `PALETTE_SLOTS_CHANGED`, `OPEN_PALETTE_DRAWER`.
- Produces: each tool `implements PaletteSlotSource` with mode `'single'` and one slot (`label: ''`, `targetLabel: ''`).

- [ ] **Step 1: Write the failing tests**

```ts
// each tool
it('getPaletteSlots returns one slot holding the current dye, or null');
it('dispatches palette-slots-changed when the dye changes or is cleared');
// harmony: a custom base dye is returned as-is (the palette skips custom dyes itself)
// budget
it('the empty-state card is a button that dispatches open-palette-drawer');
it('the target dye card is a button that dispatches open-palette-drawer');
// swatch
it('the source card is a button that dispatches open-palette-drawer');
it('the empty-state card is not a button and dispatches nothing');
it('remembers the Dye object of the last reverse match and forgets it on clearReverseMatch');
```

- [ ] **Step 2: Run to verify failure** for each of the three files.

- [ ] **Step 3: Implement.** Harmony Explorer's two existing dispatches stay bare. Swatch Matcher gains a private `reverseDye: Dye | null` set in `selectDye`; if a reverse match can start from something that is not a palette dye, return `dye: null` for it. Budget Suggestions keeps its quick picks and ledger rows as they are.

- [ ] **Step 4: Run to verify pass**, then the i18n gates, which now see every `choosing…` key used:

Run: `pnpm --filter xivdyetools-web-app exec vitest run scripts/i18n-parity-gate.test.js --coverage.enabled=false` and `pnpm --filter xivdyetools-web-app run i18n:unused`
Expected: both PASS.

- [ ] **Step 5: Commit** `feat(web-app): single-input tools report their dye to the palette`

---

### Task 10: End-to-end on a phone

**Files:**
- Create: `e2e/slot-aware-picking.spec.ts`

**Interfaces:**
- Consumes: the CSS hooks from Task 3 and `data-palette-slot` from Tasks 5 to 9. Follow `e2e/dye-comparison.spec.ts` for navigation and for dismissing the welcome / What's New modal.

- [ ] **Step 1: Write the spec** (runs in `mobile-chrome`; add one desktop case in `chromium`):

```ts
test('Dye Comparison: tap an empty slot, pick, palette closes, slot filled');
test('Dye Comparison: Add dye tile adds the second dye and the palette closes');
test('Dye Comparison: round button, two picks, palette stays open, marks show in-use');
test('Dye Comparison: target chip 1 in the strip, pick, first dye replaced, header line gone');
test('Dye Comparison: tapping a marked swatch removes that dye');
test('Dye Mixer: tap slot B first, pick, B is filled and A is still empty');
test('Gradient Builder: tap FROM, pick, palette closes; TO chip is enabled afterwards');
test('Harmony Explorer: hub tap, pick, palette closes, swatch is marked in use');
test('desktop: a slot click sets the target and the docked palette stays open after the pick');
```

- [ ] **Step 2: Run.** Port 5173 must be free first (the Playwright config reuses an existing server). `pnpm --filter xivdyetools-web-app exec playwright test e2e/slot-aware-picking.spec.ts --project=mobile-chrome --reporter=list`, then the desktop case with `--project=chromium`. Expected: PASS. Do not edit source while it runs.

- [ ] **Step 3: Run the existing specs these tools own**, since slots changed element type: `e2e/dye-mixer.spec.ts`, `e2e/gradient-builder.spec.ts`, `e2e/dye-comparison.spec.ts`, `e2e/accessibility-checker.spec.ts`, `e2e/budget-tool.spec.ts`, `e2e/harmony-generator.spec.ts`, `e2e/tool-narrow-pane.spec.ts`, both projects. Fix selectors that assumed a `div`.

- [ ] **Step 4: Commit** `test(web-app): phone flows for slot-aware picking`

---

### Task 11: Release and gate

**Files:**
- Modify: `package.json` (version), `CHANGELOG.md` of the web app, root `CHANGELOG-laymans.md`, `docs/versions.md`, root `README.md` version table, `docs/projects/web-app/components.md` and `tools.md` where they describe the palette or these tools

- [ ] **Step 1: Claim the version.** List every open pull request's `apps/web-app/package.json` version (`gh pr list --state open --json number,headRefName` then read each branch's file). Take the next free minor above all of them. Record the number and the scan in the pull request body.

- [ ] **Step 2: Write both changelogs.** Technical entry in the web app's `CHANGELOG.md`. Player-facing entry in `CHANGELOG-laymans.md` (it feeds What's New): what tapping a slot now does, that the palette closes by itself on phones after such a pick, the marks and the slot strip, tap-again-to-remove in the multi-dye tools, and that Dye Mixer no longer takes the same dye twice. Use the tool names as the app shows them.

- [ ] **Step 3: Update the living docs** named above and both version tables.

- [ ] **Step 4: Run the full gate** from the repository root:

`pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm test:scripts && pnpm dead-code:check && pnpm docs:check-versions && pnpm docs:check-links && pnpm workers:check-logs`
then `pnpm --filter xivdyetools-web-app run build:check`.
Expected: all PASS. A dead-code finding on a contract method reached only through the duck-typed guard is a real call path: tag it `@entrypoint` naming `v4-layout.ts`'s routed call, never a neighboring symbol.

- [ ] **Step 5: Commit** `chore(web-app): release notes and version for slot-aware picking`, then open a pull request against `main` that references issue 422 without closing it. Do not merge.
