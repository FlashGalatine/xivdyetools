# Selectable Harmony Colour Wheels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player choose which colour wheel the Harmony Explorer measures its angles on — RGB (unchanged default), RYB, Munsell, OKLCH hue, OKLCH lightness — with the wheels defined once in `@xivdyetools/core` and consumed identically by the web app, the Discord `/harmony` command and the OpenGraph card.

**Architecture:** A `ColorWheel` registry in core (`hueOf`, `target`, `ringStops`) built from monotone hue-warp tables for four wheels and a bespoke constant-lightness OKLCH wheel with CSS Color 4 gamut mapping. `generateHarmonySlots` gains a `wheel` config field and a `wheelHue` slot field; nothing after target construction changes, so the RGB wheel reproduces today's golden digest byte-for-byte. Each surface passes the id through (`&wheel=`, the `wheel` slash-command option, the OG `wheel` query) and draws from core: the web ring paints `ringStops(72)`, nodes sit at `wheelHue`, cards print a localised wheel name.

**Tech Stack:** TypeScript, pnpm + Turborepo, Vitest, Lit (web app), Hono (workers), `culori` as a core **devDependency** only (gamut-map oracle), `tsx` for the Munsell generator script.

**Spec:** `docs/superpowers/specs/2026-09-04-harmony-color-wheels-design.md` (research in `docs/research/2026-09-04-harmony-color-wheels/`).

## Global Constraints

- Wheel ids are the wire format everywhere and never change: `'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness'`; default `'rgb'`; absent or unknown means `rgb`. Display order is that list.
- Core is the single source of truth: no surface keeps its own list of wheels, labels or tables. Consumers import `COLOR_WHEEL_IDS`, `DEFAULT_COLOR_WHEEL`, `isColorWheelId`, `getColorWheel` from `@xivdyetools/core`.
- With `wheel` unset or `'rgb'`, `generateHarmonySlots` output is byte-identical to today: the digest `740c740a88809814774a7d37d3cb1de4d8b19c1644e95794bb6108ee958f214a` in `HarmonySelector.golden.test.ts` must not move.
- Ranking stays CIEDE2000 (or whatever `matchingMethod` says) for every wheel. Never switch the metric with the wheel.
- The UI control is called **"Color wheel"**, never "Color mode" (ja 色相環, de Farbkreis, fr Roue chromatique, ko 색상환, zh 色环).
- Every user-facing string lands in all six locales (en, ja, de, fr, ko, zh) in the same commit; the web-app parity gate (`pnpm --filter xivdyetools-web-app run validate:i18n`) and bot-logic's `locale-orphans.test.ts` must stay green.
- Never wire any UI to `HarmonyGenerator.rotateHueInSpace` / `HarmonyColorSpace` — it clips (50.6° hue error on pure blue). Mark it `@deprecated`, do not delete (published API).
- The RYB table's column 1 is the **RYB angle**, column 2 the **sRGB hue**. Assert by value: `target('#FF0000', 120).targetHue === 60` and `target('#FF0000', 180).targetHue === 138`.
- No runtime dependency is added to core. `culori` is `devDependencies` only.
- Munsell: never vendor `real.dat`; ship only the 40 derived pairs + generator; add `packages/core/NOTICE` and the trademark sentence in the UI.
- Consumers resolve `@xivdyetools/core` from `dist`: after any core change run `pnpm turbo run build --filter=@xivdyetools/core` before running web-app / bot-logic / discord-worker / og-worker tests.
- Every commit ends with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem
  ```
- Work on branch `research/harmony-color-wheels` (PR #167) in the worktree `xivdyetools/.claude/worktrees/harmony-color-wheels-research`, or a new worktree branched from it. All commands below run from the monorepo root of that checkout.

---

## File structure

**Create**

| Path | Responsibility |
|---|---|
| `packages/core/src/services/dye/wheels/types.ts` | `ColorWheel` interface, `WarpTable` type, re-export of `ColorWheelId` |
| `packages/core/src/services/dye/wheels/hue-warp.ts` | Table maths: interpolate, `normalizeWarpTable`, `assertMonotoneTable`, `hueWarpWheel()` factory |
| `packages/core/src/services/dye/wheels/rgb-ryb.ts` | `RGB_WHEEL` (identity), `RYB_TABLE`, `RYB_WHEEL` |
| `packages/core/src/services/dye/wheels/oklch-hue.ts` | `deriveOklchHueTable()`, `OKLCH_HUE_WHEEL` |
| `packages/core/src/services/dye/wheels/oklch-lightness.ts` | `OKLCH_LIGHTNESS_WHEEL` (constant L/C + gamut map) |
| `packages/core/src/services/dye/wheels/munsell.ts` | `MUNSELL_WHEEL` from the checked-in JSON |
| `packages/core/src/services/dye/wheels/ColorWheel.ts` | Registry: `COLOR_WHEEL_IDS`, `DEFAULT_COLOR_WHEEL`, `isColorWheelId`, `getColorWheel` |
| `packages/core/src/services/dye/wheels/__tests__/*.test.ts` | Contract suite (round trip, monotone, involution, value assertions, oracle) |
| `packages/core/src/data/munsell-hues.json` | 40 derived Munsell anchors + normalised table (generated) |
| `packages/core/scripts/build-munsell-hues.ts` | Generator: `real.dat` path → JSON |
| `packages/core/NOTICE` | Munsell attribution + trademark text |

**Modify**

| Path | Change |
|---|---|
| `packages/types/src/localization/index.ts`, `packages/types/src/index.ts` | `ColorWheelId` union; `LocaleData.colorWheels?` |
| `packages/core/src/services/color/ColorConverter.ts` | `oklabToLinearRgb`, `linearRgbToOklab` (refactor), `gamutMapOklch`, `maxChromaOklch` |
| `packages/core/src/services/dye/HarmonySelector.ts` | `wheel` config, `wheelHue` slot, three-line target change |
| `packages/core/src/services/dye/HarmonyGenerator.ts` | `@deprecated` tags |
| `packages/core/src/services/localization/TranslationProvider.ts`, `packages/core/src/services/LocalizationService.ts`, `packages/core/scripts/build-locales.ts`, `packages/core/src/data/locales/*.json` | Localised wheel names |
| `packages/core/src/index.ts`, `packages/core/package.json`, `packages/core/CHANGELOG.md` | Exports, devDependency, version |
| `apps/web-app/src/shared/tool-config-types.ts`, `apps/web-app/src/components/v4/config-sidebar.ts`, `apps/web-app/src/services/language-service.ts`, `apps/web-app/src/locales/*.json` | Config field, select, blurbs |
| `apps/web-app/src/components/harmony-tool.ts`, `apps/web-app/src/components/v4/v4-color-wheel.ts`, tests | Plumbing, ring, nodes, share URL |
| `packages/svg/src/harmony-card.ts` | Optional `wheelLabel` |
| `packages/bot-logic/src/commands/harmony.ts`, `packages/bot-logic/src/localization.ts`, tests | `wheel` input, card label, share URL |
| `apps/discord-worker/src/commands/schemas.ts`, `apps/discord-worker/src/handlers/commands/harmony.ts`, tests | `wheel` option; remove `color_space` plumbing |
| `apps/og-worker/src/types.ts`, `og-params.ts`, `index.ts`, `og-data-generator.ts`, `services/translator.ts`, `services/svg/harmony.ts`, tests | Allowlist, cache key, route, embed URLs, deck |
| Root, web-app and discord-worker `CHANGELOG-laymans.md`; package `CHANGELOG.md`s; `package.json` versions | Release notes and bumps |

---

### Task 1: `ColorWheelId` type and the hue-warp table maths

**Files:**
- Modify: `packages/types/src/localization/index.ts` (after `HarmonyTypeKey`, ~line 36; `LocaleData` ~line 123)
- Modify: `packages/types/src/index.ts` (~line 140, the `export type { … } from './localization/index.js'` list)
- Create: `packages/core/src/services/dye/wheels/types.ts`
- Create: `packages/core/src/services/dye/wheels/hue-warp.ts`
- Test: `packages/core/src/services/dye/wheels/__tests__/hue-warp.test.ts`

**Interfaces:**
- Produces: `type ColorWheelId` (types package); `interface ColorWheel { id; hueOf(hex): number; target(baseHex, wheelHue): { targetHex: HexColor; targetHue: number }; ringStops(count): readonly HexColor[] }`; `type WarpTable = ReadonlyArray<readonly [number, number]>`; `toWheelHue(table, hsvHue)`, `fromWheelHue(table, wheelHue)`, `normalizeWarpTable(raw, id, opts?)`, `assertMonotoneTable(table, id)`, `hueWarpWheel(id, table): ColorWheel`.

- [ ] **Step 1: Add the id union and the locale field to `@xivdyetools/types`**

In `packages/types/src/localization/index.ts`, directly after the `HarmonyTypeKey` union:

```ts
/**
 * Ids of the Harmony Explorer's selectable colour wheels. The runtime list,
 * display order and default live in `@xivdyetools/core` (`COLOR_WHEEL_IDS`);
 * the union is here so `LocaleData.colorWheels` can be typed without a
 * types → core dependency. Ids are the wire format (share URLs, the Discord
 * option, the OG query) and never change.
 */
export type ColorWheelId = 'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness';
```

In the `LocaleData` interface, after `harmonyTypes`:

```ts
  /** Colour-wheel display names for the Harmony Explorer's wheel selector */
  colorWheels?: Partial<Record<ColorWheelId, string>>;
```

In `packages/types/src/index.ts`, add `ColorWheelId,` to the `export type { … } from './localization/index.js'` list (between `HarmonyTypeKey,` and `ToolKey,`).

- [ ] **Step 2: Build types so core can see the new export**

Run: `pnpm turbo run build --filter=@xivdyetools/types`
Expected: build succeeds.

- [ ] **Step 3: Write the failing hue-warp tests**

Create `packages/core/src/services/dye/wheels/__tests__/hue-warp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  assertMonotoneTable,
  fromWheelHue,
  hueWarpWheel,
  normalizeWarpTable,
  toWheelHue,
} from '../hue-warp.js';
import type { WarpTable } from '../types.js';

const IDENTITY: WarpTable = [
  [0, 0],
  [360, 360],
];
/** A two-segment warp: the first 90° of HSV hue occupy 180° of wheel. */
const STRETCH: WarpTable = [
  [0, 0],
  [180, 90],
  [360, 360],
];

describe('interpolation', () => {
  it('identity maps every angle to itself', () => {
    for (let h = 0; h < 360; h += 0.5) {
      expect(toWheelHue(IDENTITY, h)).toBe(h);
      expect(fromWheelHue(IDENTITY, h)).toBe(h);
    }
  });

  it('interpolates linearly inside a segment, both directions', () => {
    expect(toWheelHue(STRETCH, 45)).toBeCloseTo(90, 9);
    expect(fromWheelHue(STRETCH, 90)).toBeCloseTo(45, 9);
    expect(toWheelHue(STRETCH, 225)).toBeCloseTo(270, 9);
    expect(fromWheelHue(STRETCH, 270)).toBeCloseTo(225, 9);
  });

  it('wraps: 360 and −30 are treated as 0 and 330', () => {
    expect(toWheelHue(STRETCH, 360)).toBe(0);
    expect(fromWheelHue(STRETCH, -30)).toBeCloseTo(fromWheelHue(STRETCH, 330), 9);
  });

  it('round-trips to 1e-9 over the whole circle', () => {
    for (let h = 0; h < 360; h += 0.1) {
      expect(Math.abs(fromWheelHue(STRETCH, toWheelHue(STRETCH, h)) - h)).toBeLessThan(1e-9);
    }
  });
});

describe('assertMonotoneTable', () => {
  it('accepts a strictly increasing table spanning 0→360', () => {
    expect(() => assertMonotoneTable(STRETCH, 'stretch')).not.toThrow();
  });

  it('rejects a table that does not start at [0,0] or end at [360,360]', () => {
    expect(() => assertMonotoneTable([[0, 5], [360, 360]], 'bad')).toThrow(/\[0,0\]/);
    expect(() => assertMonotoneTable([[0, 0], [350, 360]], 'bad')).toThrow(/\[360,360\]/);
  });

  it('rejects a backward step in either column', () => {
    expect(() => assertMonotoneTable([[0, 0], [100, 120], [90, 200], [360, 360]], 'w')).toThrow(/row 2/);
    expect(() => assertMonotoneTable([[0, 0], [100, 120], [200, 110], [360, 360]], 'h')).toThrow(/row 2/);
  });
});

describe('normalizeWarpTable', () => {
  it('sorts by HSV hue, unwraps the wheel column, and zeroes at HSV 0', () => {
    // Measured pairs [wheelAngle, hsvHue] handed in unsorted and un-zeroed:
    // wheel = hsv + 30 everywhere, so after zeroing it must be the identity.
    const raw: Array<[number, number]> = [
      [210, 180],
      [30, 0],
      [300, 270],
      [120, 90],
      [15, 345],
    ];
    const table = normalizeWarpTable(raw, 'shifted');
    expect(table[0]).toEqual([0, 0]);
    expect(table[table.length - 1]).toEqual([360, 360]);
    for (const [w, h] of table) expect(w).toBeCloseTo(h, 9);
  });

  it('monotonises a small dent with a running maximum and reports nothing', () => {
    const raw: Array<[number, number]> = [
      [0, 0],
      [100, 90],
      [99.9, 100], // 0.1° reversal, like OKLab hue around HSV 231–240
      [200, 180],
      [300, 270],
    ];
    const table = normalizeWarpTable(raw, 'dented');
    expect(() => assertMonotoneTable(table, 'dented')).not.toThrow();
  });

  it('throws when a dent exceeds the stated tolerance', () => {
    const raw: Array<[number, number]> = [
      [0, 0],
      [100, 90],
      [95, 100], // 5° reversal
      [200, 180],
      [300, 270],
    ];
    expect(() => normalizeWarpTable(raw, 'broken', { maxCorrectionDeg: 1 })).toThrow(/broken/);
  });
});

describe('hueWarpWheel', () => {
  const wheel = hueWarpWheel('ryb', STRETCH);

  it('reads the base hue through the table', () => {
    // #FF8000 is HSV hue 30.1176…; under STRETCH that is doubled.
    expect(wheel.hueOf('#FF8000')).toBeCloseTo(60.235, 2);
  });

  it('builds the target with the base saturation and value on the mapped hue', () => {
    // Base: pure red at half value. Wheel 180 → HSV 90 (chartreuse), V stays 50%.
    const { targetHex, targetHue } = wheel.target('#800000', 180);
    expect(targetHue).toBeCloseTo(90, 9);
    expect(targetHex).toBe('#408000');
  });

  it('paints ring stops from the mapped hue at full saturation and value', () => {
    const stops = wheel.ringStops(4); // wheel 0, 90, 180, 270 → HSV 0, 45, 90, 225
    expect(stops).toEqual(['#FF0000', '#FFBF00', '#80FF00', '#0040FF']);
  });

  it('refuses a non-monotone table at construction', () => {
    expect(() => hueWarpWheel('ryb', [[0, 0], [200, 100], [100, 200], [360, 360]])).toThrow();
  });
});
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels/__tests__/hue-warp.test.ts`
Expected: FAIL — cannot resolve `../hue-warp.js`.

- [ ] **Step 5: Create `types.ts`**

`packages/core/src/services/dye/wheels/types.ts`:

```ts
/**
 * A colour wheel for the Harmony Explorer: how a colour becomes an angle, how
 * an angle becomes a target colour, and how the ring is painted.
 *
 * Every consumer — the web app, the Discord bot, the OG card — reads wheels
 * from this package and holds no list of its own (spec §2).
 *
 * @module services/dye/wheels/types
 */

import type { ColorWheelId, HexColor } from '@xivdyetools/types';

export type { ColorWheelId };

export interface ColorWheel {
  readonly id: ColorWheelId;
  /** Where a colour sits on this wheel, 0–360. */
  hueOf(hex: string): number;
  /**
   * The ideal colour for a slot at `wheelHue`, carrying whatever this wheel
   * preserves from the base. `targetHue` is always an sRGB/HSV hue, because
   * the non-perceptual ranking branch compares dye HSV hue against it.
   */
  target(baseHex: string, wheelHue: number): { targetHex: HexColor; targetHue: number };
  /** Ring paint at `count` evenly spaced wheel angles, plain in-gamut hex. */
  ringStops(count: number): readonly HexColor[];
}

/**
 * `[wheelAngle, hsvHue]` pairs, both 0–360, first pair `[0, 0]`, last pair
 * `[360, 360]`, both columns strictly increasing. A hue-warp wheel is defined
 * entirely by one of these.
 */
export type WarpTable = ReadonlyArray<readonly [number, number]>;
```

- [ ] **Step 6: Create `hue-warp.ts`**

`packages/core/src/services/dye/wheels/hue-warp.ts`:

```ts
/**
 * Hue-warp wheels: a monotone piecewise-linear bijection between sRGB/HSV hue
 * and a wheel angle. RGB (identity), RYB, Munsell and OKLCH-hue are all this.
 *
 * The target keeps the BASE's HSV saturation and value on the mapped hue —
 * the contract the 2026-09-03 harmony convergence rests on — so on the
 * identity table this reproduces today's output bit for bit.
 *
 * @module services/dye/wheels/hue-warp
 */

import type { HexColor } from '@xivdyetools/types';
import { ColorConverter } from '../../color/ColorConverter.js';
import type { ColorWheel, ColorWheelId, WarpTable } from './types.js';

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

/**
 * Every table must be strictly increasing in both columns and run exactly
 * from `[0,0]` to `[360,360]`; otherwise the inverse is ambiguous and a
 * linear-search inverse returns a hue wrong by far more than the dent
 * (research 05 §7: a 0.16° reversal produced a 13° error, silently).
 */
export function assertMonotoneTable(table: WarpTable, id: string): void {
  if (table.length < 2) {
    throw new Error(`ColorWheel ${id}: table needs at least two pairs`);
  }
  const first = table[0];
  const last = table[table.length - 1];
  if (first[0] !== 0 || first[1] !== 0) {
    throw new Error(`ColorWheel ${id}: table must start at [0,0]`);
  }
  if (last[0] !== 360 || last[1] !== 360) {
    throw new Error(`ColorWheel ${id}: table must end at [360,360]`);
  }
  for (let i = 1; i < table.length; i++) {
    if (!(table[i][0] > table[i - 1][0]) || !(table[i][1] > table[i - 1][1])) {
      throw new Error(`ColorWheel ${id}: table is not strictly increasing at row ${i}`);
    }
  }
}

/** Piecewise-linear map of `x` from column `from` to column `to`. */
function interpolate(table: WarpTable, x: number, from: 0 | 1, to: 0 | 1): number {
  const v = mod360(x);
  let lo = 0;
  let hi = table.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][from] <= v) lo = mid;
    else hi = mid;
  }
  const a = table[lo];
  const b = table[hi];
  const t = (v - a[from]) / (b[from] - a[from]);
  return mod360(a[to] + t * (b[to] - a[to]));
}

/** sRGB/HSV hue → wheel angle. */
export function toWheelHue(table: WarpTable, hsvHue: number): number {
  return table.length === 2 ? mod360(hsvHue) : interpolate(table, hsvHue, 1, 0);
}

/** Wheel angle → sRGB/HSV hue. */
export function fromWheelHue(table: WarpTable, wheelHue: number): number {
  return table.length === 2 ? mod360(wheelHue) : interpolate(table, wheelHue, 0, 1);
}

export interface NormalizeOptions {
  /** Largest running-max correction tolerated, in degrees. Default 1. */
  maxCorrectionDeg?: number;
}

/**
 * Turn measured `[wheelAngle, hsvHue]` pairs — in any order, with the wheel
 * column wrapping wherever the measurement put its zero — into a valid
 * {@link WarpTable}: sorted by HSV hue, wheel column unwrapped, small dents
 * monotonised with a running maximum, re-zeroed so HSV 0° ↦ wheel 0°, and
 * closed with `[0,0]` and `[360,360]`.
 *
 * Every warp wheel is zeroed at sRGB red, so wheels differ in SPACING only;
 * that is what lets the ring, the nodes and the base spoke share one origin.
 */
export function normalizeWarpTable(
  raw: ReadonlyArray<readonly [number, number]>,
  id: string,
  options: NormalizeOptions = {}
): WarpTable {
  const maxCorrection = options.maxCorrectionDeg ?? 1;
  if (raw.length < 3) {
    throw new Error(`ColorWheel ${id}: need at least three measured pairs`);
  }
  const sorted = raw
    .map(([w, h]) => [mod360(w), mod360(h)] as [number, number])
    .sort((a, b) => a[1] - b[1]);

  // Unwrap the wheel column: a backward step larger than half a turn is the
  // measurement's own zero crossing, not a dent.
  const unwrapped: Array<[number, number]> = [];
  let offset = 0;
  for (let i = 0; i < sorted.length; i++) {
    let w = sorted[i][0] + offset;
    if (i > 0 && w < unwrapped[i - 1][0] - 180) {
      offset += 360;
      w += 360;
    }
    unwrapped.push([w, sorted[i][1]]);
  }

  // Monotonise small dents; refuse large ones.
  for (let i = 1; i < unwrapped.length; i++) {
    const prev = unwrapped[i - 1][0];
    if (unwrapped[i][0] <= prev) {
      const correction = prev - unwrapped[i][0];
      if (correction > maxCorrection) {
        throw new Error(
          `ColorWheel ${id}: wheel column reverses by ${correction.toFixed(3)}° at HSV ` +
            `${unwrapped[i][1].toFixed(2)}°, more than the ${maxCorrection}° tolerance`
        );
      }
      unwrapped[i][0] = prev + 1e-6;
    }
  }

  // Wheel angle at HSV 0°, by interpolating across the wrap-around segment.
  const [wFirst, hFirst] = unwrapped[0];
  const [wLast, hLast] = unwrapped[unwrapped.length - 1];
  const t = (360 - hLast) / (hFirst + 360 - hLast);
  const w0 = wLast + t * (wFirst + 360 - wLast);

  const table: Array<readonly [number, number]> = [[0, 0]];
  for (const [w, h] of unwrapped) {
    const shifted = w - w0 + 360; // wFirst ≥ w0 − 360 by construction
    if (h > 0 && shifted > 0 && shifted < 360) table.push([shifted, h]);
  }
  table.push([360, 360]);

  assertMonotoneTable(table, id);
  return table;
}

/** Build a wheel from a table. Throws at construction on a bad table. */
export function hueWarpWheel(id: ColorWheelId, table: WarpTable): ColorWheel {
  assertMonotoneTable(table, id);
  return {
    id,
    hueOf(hex: string): number {
      return toWheelHue(table, ColorConverter.hexToHsv(hex).h);
    },
    target(baseHex: string, wheelHue: number): { targetHex: HexColor; targetHue: number } {
      const base = ColorConverter.hexToHsv(baseHex);
      const targetHue = fromWheelHue(table, wheelHue);
      return { targetHex: ColorConverter.hsvToHex(targetHue, base.s, base.v), targetHue };
    },
    ringStops(count: number): readonly HexColor[] {
      const stops: HexColor[] = [];
      for (let i = 0; i < count; i++) {
        stops.push(ColorConverter.hsvToHex(fromWheelHue(table, (i * 360) / count), 100, 100));
      }
      return stops;
    },
  };
}
```

Note on the zeroing arithmetic: after unwrapping, `wFirst` is the smallest wheel value and `w0` (the wheel angle at HSV 0°) lies between `wLast − 360` and `wFirst`, so `w − w0 + 360` for `w = wFirst` is a small positive number — hence the `+ 360`. If the first run of the test "sorts by HSV hue, unwraps…" fails on that sign, print `w0` and the first shifted value; the expected identity output pins the correct form.

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels/__tests__/hue-warp.test.ts`
Expected: PASS (all four describe blocks). If `hsvToHex('#800000' → 90°)` gives `#408000` off by one channel, check `ColorConverter.hsvToHex` rounding and adjust the expected hex to what the real converter produces for HSV(90, 100, 50.196) — the intent is "V unchanged, hue mapped"; do not loosen the hue assertion.

- [ ] **Step 8: Commit**

```bash
git add packages/types/src/localization/index.ts packages/types/src/index.ts packages/core/src/services/dye/wheels
git commit -m "feat(core): ColorWheelId and hue-warp table maths for selectable wheels

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 2: RGB and RYB wheels plus the registry

**Files:**
- Create: `packages/core/src/services/dye/wheels/rgb-ryb.ts`
- Create: `packages/core/src/services/dye/wheels/ColorWheel.ts`
- Test: `packages/core/src/services/dye/wheels/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `hueWarpWheel`, `WarpTable` (Task 1).
- Produces: `RGB_WHEEL`, `RYB_TABLE`, `RYB_WHEEL`; `COLOR_WHEEL_IDS` (readonly, display order), `DEFAULT_COLOR_WHEEL = 'rgb'`, `isColorWheelId(value: unknown): value is ColorWheelId`, `getColorWheel(id: ColorWheelId): ColorWheel`. Until Tasks 3–6 land, the registry maps `munsell`, `oklch-hue` and `oklch-lightness` to placeholders that **throw** on use, so a forgotten wheel fails loudly rather than silently behaving like RGB.

- [ ] **Step 1: Write the failing registry tests**

`packages/core/src/services/dye/wheels/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  COLOR_WHEEL_IDS,
  DEFAULT_COLOR_WHEEL,
  getColorWheel,
  isColorWheelId,
} from '../ColorWheel.js';
import { RGB_WHEEL, RYB_TABLE, RYB_WHEEL } from '../rgb-ryb.js';
import { ColorConverter } from '../../../color/ColorConverter.js';

describe('registry', () => {
  it('lists the five wheels in display order with rgb first and default', () => {
    expect(COLOR_WHEEL_IDS).toEqual(['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness']);
    expect(DEFAULT_COLOR_WHEEL).toBe('rgb');
  });

  it.each(['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'])('accepts %s', (id) => {
    expect(isColorWheelId(id)).toBe(true);
  });

  it.each(['', 'RGB', 'cmyk', 'hsl', 'toString', 'constructor', 42, null, undefined])(
    'rejects %j',
    (value) => {
      expect(isColorWheelId(value)).toBe(false);
    }
  );

  it('never answers a prototype property for an unknown id', () => {
    expect(() => getColorWheel('toString' as never)).toThrow(RangeError);
    expect(() => getColorWheel('constructor' as never)).toThrow(RangeError);
  });

  it('returns a wheel whose id is the id asked for', () => {
    expect(getColorWheel('rgb').id).toBe('rgb');
    expect(getColorWheel('ryb').id).toBe('ryb');
  });
});

describe('rgb wheel (identity)', () => {
  it('reads the HSV hue unchanged and returns the HSV target unchanged', () => {
    for (const hex of ['#FF0000', '#123456', '#6D5440', '#00FFFF', '#808080']) {
      const hsv = ColorConverter.hexToHsv(hex);
      expect(RGB_WHEEL.hueOf(hex)).toBe(hsv.h);
      for (const offset of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 345]) {
        const wheelHue = (hsv.h + offset) % 360;
        const { targetHex, targetHue } = RGB_WHEEL.target(hex, wheelHue);
        expect(targetHue).toBe(wheelHue);
        expect(targetHex).toBe(ColorConverter.hsvToHex(wheelHue, hsv.s, hsv.v));
      }
    }
  });

  it('paints the plain sRGB ring', () => {
    expect(RGB_WHEEL.ringStops(6)).toEqual([
      '#FF0000',
      '#FFFF00',
      '#00FF00',
      '#00FFFF',
      '#0000FF',
      '#FF00FF',
    ]);
  });
});

describe('ryb wheel', () => {
  it('has the 25-pair table with RYB angle in column 1 and sRGB hue in column 2', () => {
    expect(RYB_TABLE).toHaveLength(25);
    expect(RYB_TABLE[8]).toEqual([120, 60]); // yellow
    expect(RYB_TABLE[12]).toEqual([180, 138]); // red's complement, a green
    expect(RYB_TABLE[16]).toEqual([240, 204]); // Itten's cyan-leaning blue
  });

  it("red's complement is green (sRGB 138°), not cyan", () => {
    expect(RYB_WHEEL.target('#FF0000', 180).targetHue).toBeCloseTo(138, 9);
  });

  it('yellow sits at RYB 120° and maps back to sRGB 60°', () => {
    expect(RYB_WHEEL.hueOf('#FFFF00')).toBeCloseTo(120, 9);
    expect(RYB_WHEEL.target('#FF0000', 120).targetHue).toBeCloseTo(60, 9);
  });

  it('round-trips and is an involution under complement', () => {
    for (let h = 0; h < 360; h += 0.1) {
      const hex = ColorConverter.hsvToHex(h, 100, 100);
      const w = RYB_WHEEL.hueOf(hex);
      const back = RYB_WHEEL.target(hex, w).targetHue;
      expect(Math.abs(back - ColorConverter.hexToHsv(hex).h) % 360).toBeLessThan(1e-6);
      const comp = RYB_WHEEL.target(hex, (w + 180) % 360).targetHex;
      const compW = RYB_WHEEL.hueOf(comp);
      const compComp = RYB_WHEEL.target(comp, (compW + 180) % 360).targetHue;
      // hsvToHex rounds to 8 bits, so allow the rounding, not the maths
      expect(Math.min(Math.abs(compComp - h), 360 - Math.abs(compComp - h))).toBeLessThan(1.5);
    }
  });

  it('keeps a grey grey', () => {
    for (const offset of [30, 120, 180, 270]) {
      expect(RYB_WHEEL.target('#808080', offset).targetHex).toBe('#808080');
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels/__tests__/registry.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `rgb-ryb.ts`**

```ts
/**
 * The RGB (identity) and RYB (artist's) wheels.
 *
 * RYB is the 25-pair NodeBox/Paletton/Adobe hue warp. **Column 1 is the RYB
 * angle, column 2 the sRGB hue** — the most-read write-up states it the other
 * way round in prose while implementing it correctly, and reversing it turns
 * red's complement from green into blue while a naïve "≠ 180°" test still
 * passes (research 01 §1a). `registry.test.ts` asserts the values.
 *
 * @module services/dye/wheels/rgb-ryb
 */

import { hueWarpWheel } from './hue-warp.js';
import type { WarpTable } from './types.js';

/** The identity: today's Harmony Explorer, bit for bit. */
export const RGB_WHEEL = hueWarpWheel('rgb', [
  [0, 0],
  [360, 360],
]);

/** `[rybAngle, srgbHue]`. Red's complement (RYB 180°) is sRGB 138°. */
export const RYB_TABLE: WarpTable = [
  [0, 0],
  [15, 8],
  [30, 17],
  [45, 26],
  [60, 34],
  [75, 41],
  [90, 48],
  [105, 54],
  [120, 60],
  [135, 81],
  [150, 103],
  [165, 123],
  [180, 138],
  [195, 155],
  [210, 171],
  [225, 187],
  [240, 204],
  [255, 219],
  [270, 234],
  [285, 251],
  [300, 267],
  [315, 282],
  [330, 298],
  [345, 329],
  [360, 360],
];

export const RYB_WHEEL = hueWarpWheel('ryb', RYB_TABLE);
```

- [ ] **Step 4: Create `ColorWheel.ts` (registry) with loud placeholders**

```ts
/**
 * The colour-wheel registry — the ONE list every surface reads.
 *
 * @module services/dye/wheels/ColorWheel
 */

import type { ColorWheelId } from '@xivdyetools/types';
import { RGB_WHEEL, RYB_WHEEL } from './rgb-ryb.js';
import type { ColorWheel } from './types.js';

export type { ColorWheel } from './types.js';

/** Display order. `rgb` first, and the default. */
export const COLOR_WHEEL_IDS = [
  'rgb',
  'ryb',
  'munsell',
  'oklch-hue',
  'oklch-lightness',
] as const satisfies readonly ColorWheelId[];

export const DEFAULT_COLOR_WHEEL: ColorWheelId = 'rgb';

export function isColorWheelId(value: unknown): value is ColorWheelId {
  return typeof value === 'string' && (COLOR_WHEEL_IDS as readonly string[]).includes(value);
}

/** A wheel that is registered but not yet implemented fails loudly, never like RGB. */
function notYet(id: ColorWheelId): ColorWheel {
  const fail = (): never => {
    throw new Error(`ColorWheel ${id} is not implemented yet`);
  };
  return { id, hueOf: fail, target: fail, ringStops: fail };
}

const WHEELS: Readonly<Record<ColorWheelId, ColorWheel>> = {
  rgb: RGB_WHEEL,
  ryb: RYB_WHEEL,
  munsell: notYet('munsell'),
  'oklch-hue': notYet('oklch-hue'),
  'oklch-lightness': notYet('oklch-lightness'),
};

/**
 * Own-property lookup: the id arrives from a share URL, and
 * `WHEELS['toString']` would be truthy under a plain index.
 */
export function getColorWheel(id: ColorWheelId): ColorWheel {
  if (!Object.hasOwn(WHEELS, id)) {
    throw new RangeError(`Unknown colour wheel: ${String(id)}`);
  }
  return WHEELS[id];
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels/__tests__/registry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/dye/wheels
git commit -m "feat(core): RGB and RYB colour wheels and the wheel registry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 3: OKLCH hue wheel (derived at module load, monotonised, pinned by value)

**Files:**
- Create: `packages/core/src/services/dye/wheels/oklch-hue.ts`
- Modify: `packages/core/src/services/dye/wheels/ColorWheel.ts` (replace the `oklch-hue` placeholder)
- Test: `packages/core/src/services/dye/wheels/__tests__/oklch-hue.test.ts`

**Interfaces:**
- Consumes: `normalizeWarpTable`, `hueWarpWheel` (Task 1); `ColorConverter.hsvToHex`, `ColorConverter.hexToOklch`.
- Produces: `deriveOklchHueTable(stepDegrees = 5): WarpTable`, `OKLCH_HUE_TABLE`, `OKLCH_HUE_WHEEL`.

Deviation from the spec, recorded here: the table is derived at module load from core's own converters and pinned by the value tests below plus the per-wheel golden (Task 7), instead of being checked in as data with a separate generator script. Same guarantees, one fewer artefact; the derivation is 72 conversions.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/services/dye/wheels/__tests__/oklch-hue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { OKLCH_HUE_TABLE, OKLCH_HUE_WHEEL, deriveOklchHueTable } from '../oklch-hue.js';
import { assertMonotoneTable } from '../hue-warp.js';
import { ColorConverter } from '../../../color/ColorConverter.js';

describe('oklch-hue wheel', () => {
  it('is a monotone table of 73 pairs (72 samples, the HSV-0° sample becomes [0,0], plus [360,360])', () => {
    expect(OKLCH_HUE_TABLE).toHaveLength(73);
    expect(() => assertMonotoneTable(OKLCH_HUE_TABLE, 'oklch-hue')).not.toThrow();
  });

  it('is what the derivation produces', () => {
    expect(deriveOklchHueTable()).toEqual(OKLCH_HUE_TABLE);
  });

  // Landmarks measured in research 05 (wheelstakes2): HSV → wheel.
  // The OKLab hue of the pure sRGB hue circle, zeroed at red.
  it.each([
    [60, 80.5],
    [120, 113.3],
    [180, 165.5],
    [240, 234.8],
    [300, 299.1],
  ])('places HSV %i° near wheel %s°', (hsvHue, wheelHue) => {
    expect(OKLCH_HUE_WHEEL.hueOf(ColorConverter.hsvToHex(hsvHue, 100, 100))).toBeCloseTo(
      wheelHue,
      0
    );
  });

  it("red's complement lands near sRGB 186°", () => {
    expect(OKLCH_HUE_WHEEL.target('#FF0000', 180).targetHue).toBeCloseTo(186.1, 0);
  });

  it('survives the OKLab dent around HSV 231–240° (round trip stays under 1e-6)', () => {
    for (let h = 225; h <= 245; h += 0.05) {
      const hex = ColorConverter.hsvToHex(h, 100, 100);
      const exactH = ColorConverter.hexToHsv(hex).h;
      const back = OKLCH_HUE_WHEEL.target(hex, OKLCH_HUE_WHEEL.hueOf(hex)).targetHue;
      expect(Math.abs(back - exactH)).toBeLessThan(1e-6);
    }
  });

  it('keeps a grey grey', () => {
    expect(OKLCH_HUE_WHEEL.target('#7F7F7F', 180).targetHex).toBe('#7F7F7F');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels/__tests__/oklch-hue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `oklch-hue.ts`**

```ts
/**
 * The OKLCH-hue wheel: the sRGB hue circle re-spaced so equal angles are equal
 * OKLab hue steps. Targets still carry the base's HSV saturation and value, so
 * it behaves like RYB (a different spacing), not like a different colour space.
 *
 * The raw OKLab hue of the pure-hue circle reverses by 0.16° across HSV
 * 231.4°–240° — invisible on the ring, a 13° inverse error if left alone
 * (research 05 §7). `normalizeWarpTable` monotonises it and the tests pin the
 * result.
 *
 * @module services/dye/wheels/oklch-hue
 */

import { ColorConverter } from '../../color/ColorConverter.js';
import { hueWarpWheel, normalizeWarpTable } from './hue-warp.js';
import type { WarpTable } from './types.js';

/** `[oklabHue, hsvHue]` for the fully saturated sRGB hue circle, normalised. */
export function deriveOklchHueTable(stepDegrees = 5): WarpTable {
  const raw: Array<readonly [number, number]> = [];
  for (let h = 0; h < 360; h += stepDegrees) {
    const hex = ColorConverter.hsvToHex(h, 100, 100);
    raw.push([ColorConverter.hexToOklch(hex).h, h]);
  }
  return normalizeWarpTable(raw, 'oklch-hue', { maxCorrectionDeg: 1 });
}

export const OKLCH_HUE_TABLE: WarpTable = deriveOklchHueTable();

export const OKLCH_HUE_WHEEL = hueWarpWheel('oklch-hue', OKLCH_HUE_TABLE);
```

- [ ] **Step 4: Register it**

In `ColorWheel.ts`, import `OKLCH_HUE_WHEEL` from `./oklch-hue.js` and replace `'oklch-hue': notYet('oklch-hue'),` with `'oklch-hue': OKLCH_HUE_WHEEL,`.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels`
Expected: PASS. If a landmark misses by more than 0.5° (the `toBeCloseTo(…, 0)` precision), print the table with `console.table(OKLCH_HUE_TABLE)` once, confirm it is monotone and zeroed, and update the expected landmark to the observed value — the numbers in the test come from an independent derivation and may differ by rounding, not by shape.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/dye/wheels
git commit -m "feat(core): OKLCH-hue wheel derived from the sRGB hue circle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 4: CSS Color 4 gamut mapping and max-chroma in `ColorConverter`, with a `culori` oracle

**Files:**
- Modify: `packages/core/src/services/color/ColorConverter.ts` (`rgbToOklab` ~line 1040–1072, `oklabToRgb` ~line 1088–1108, add new methods after `oklchToHex` ~line 1236)
- Modify: `packages/core/package.json` (`devDependencies`)
- Test: `packages/core/src/services/color/__tests__/gamut-map.test.ts` (create; check the existing test folder name with `ls packages/core/src/services/color` and use its `__tests__` if present, else create it)

**Interfaces:**
- Produces: `ColorConverter.gamutMapOklch(L: number, C: number, h: number): HexColor` (static + instance), `ColorConverter.maxChromaOklch(L: number, h: number): number` (static + instance). Private helpers `oklabToLinearRgb`, `linearRgbToOklab`, `inSrgbGamut`, `deltaEOkPlain`.

- [ ] **Step 1: Add the oracle devDependency**

Run: `pnpm --filter @xivdyetools/core add -D culori@^4.0.2 @types/culori@^2.1.1`
Expected: `packages/core/package.json` gains both under `devDependencies`; lockfile updated. (If `@types/culori` is unavailable at that version, use the latest 2.x.)

- [ ] **Step 2: Write the failing tests**

`packages/core/src/services/color/__tests__/gamut-map.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { differenceEuclidean, formatHex, toGamut } from 'culori';
import { ColorConverter } from '../ColorConverter.js';

/** culori's toGamut with the CSS Color 4 arguments: bisect chroma in OKLCH, plain ΔEOK, JND 0.02. */
const cssMap = toGamut('rgb', 'oklch', differenceEuclidean('oklab'), 0.02);

/** Deterministic LCG so the sample is the same on every run. */
function* lcg(seed: number): Generator<number> {
  let s = seed >>> 0;
  for (;;) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield s / 0x100000000;
  }
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

describe('gamutMapOklch', () => {
  it('returns in-gamut colours unchanged', () => {
    const { L, C, h } = ColorConverter.hexToOklch('#6D5440');
    expect(ColorConverter.gamutMapOklch(L, C, h)).toBe('#6D5440');
  });

  it('returns white above L=1 and black below L=0', () => {
    expect(ColorConverter.gamutMapOklch(1.2, 0.3, 40)).toBe('#FFFFFF');
    expect(ColorConverter.gamutMapOklch(-0.1, 0.3, 40)).toBe('#000000');
  });

  it("maps pure blue's 180° complement to a dark olive, not the clipped dark red", () => {
    const { L, C, h } = ColorConverter.hexToOklch('#0000FF');
    const mapped = ColorConverter.gamutMapOklch(L, C, (h + 180) % 360);
    // research 02 Table B: css-map #734F00, clip #A02000 (50.6° off)
    const [r, g, b] = channels(mapped);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(Math.abs(r - 0x73)).toBeLessThanOrEqual(3);
    expect(Math.abs(g - 0x4f)).toBeLessThanOrEqual(3);
    expect(b).toBeLessThanOrEqual(3);
  });

  it('agrees with culori.toGamut (CSS Color 4) to within one 8-bit step on 2000 random OKLCH colours', () => {
    const rand = lcg(20260904);
    let exact = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const L = 0.05 + 0.9 * rand.next().value;
      const C = 0.37 * rand.next().value;
      const h = 360 * rand.next().value;
      const ours = ColorConverter.gamutMapOklch(L, C, h);
      const theirs = formatHex(cssMap({ mode: 'oklch', l: L, c: C, h })).toUpperCase();
      const a = channels(ours);
      const b = channels(theirs);
      for (let k = 0; k < 3; k++) expect(Math.abs(a[k] - b[k])).toBeLessThanOrEqual(1);
      if (ours === theirs) exact++;
    }
    expect(exact / N).toBeGreaterThan(0.9);
  });
});

describe('maxChromaOklch', () => {
  it('finds the sRGB cusp: pure red is at max chroma for its own L and h', () => {
    const { L, C, h } = ColorConverter.hexToOklch('#FF0000');
    expect(ColorConverter.maxChromaOklch(L, h)).toBeCloseTo(C, 3);
  });

  it('is much larger for magenta than for cyan at L=0.65 (research 02 Table D: 0.296 vs 0.111)', () => {
    expect(ColorConverter.maxChromaOklch(0.65, 330)).toBeCloseTo(0.296, 2);
    expect(ColorConverter.maxChromaOklch(0.65, 195)).toBeCloseTo(0.111, 2);
  });

  it('never returns an out-of-gamut chroma near the blue ray (h ≈ 264°)', () => {
    for (let L = 0.2; L <= 0.9; L += 0.05) {
      const c = ColorConverter.maxChromaOklch(L, 264);
      const hex = ColorConverter.gamutMapOklch(L, c, 264);
      const { C } = ColorConverter.hexToOklch(hex);
      expect(C).toBeGreaterThan(c - 0.01);
    }
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/color/__tests__/gamut-map.test.ts`
Expected: FAIL — `gamutMapOklch is not a function`.

- [ ] **Step 4: Refactor the OKLab matrices into unclamped linear helpers**

In `ColorConverter.ts`, inside the class, replace the body of the instance `rgbToOklab(r, g, b)` so the matrix half is a reusable private method, and likewise for `oklabToRgb`:

```ts
  /**
   * Linear sRGB (0–1, unclamped) → OKLAB. The matrix half of `rgbToOklab`,
   * shared with the gamut mapper, which must evaluate out-of-gamut colours.
   * @internal
   */
  private linearRgbToOklab(rLin: number, gLin: number, bLin: number): OKLAB {
    const l = Math.cbrt(0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin);
    const m = Math.cbrt(0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin);
    const s = Math.cbrt(0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin);
    return {
      L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    };
  }

  /**
   * OKLAB → linear sRGB (0–1, UNCLAMPED). The matrix half of `oklabToRgb`;
   * a value outside 0–1 means "outside the sRGB gamut".
   * @internal
   */
  private oklabToLinearRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
    const lRoot = L + 0.3963377774 * a + 0.2158037573 * b;
    const mRoot = L - 0.1055613458 * a - 0.0638541728 * b;
    const sRoot = L - 0.0894841775 * a - 1.291485548 * b;
    const l = lRoot * lRoot * lRoot;
    const m = mRoot * mRoot * mRoot;
    const s = sRoot * sRoot * sRoot;
    return {
      r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    };
  }
```

Then make the existing methods call them. `rgbToOklab` keeps its `srgbToLinear` lines and returns `this.linearRgbToOklab(rLin, gLin, bLin)`; `oklabToRgb` becomes:

```ts
  oklabToRgb(L: number, a: number, b: number): RGB {
    const lin = this.oklabToLinearRgb(L, a, b);
    return {
      r: clamp(this.linearToSrgb(lin.r), RGB_MIN, RGB_MAX),
      g: clamp(this.linearToSrgb(lin.g), RGB_MIN, RGB_MAX),
      b: clamp(this.linearToSrgb(lin.b), RGB_MIN, RGB_MAX),
    };
  }
```

Check the existing matrix constants in the file match the ones above before deleting the old bodies (they should — they are Ottosson's corrected 2021 set, which the fact-check confirmed). Run the whole colour suite after this step: `pnpm --filter @xivdyetools/core exec vitest run src/services/color` — it must stay green with no digest changes.

- [ ] **Step 5: Add the gamut mapper and max-chroma**

Directly after the static `oklchToHex` in `ColorConverter.ts`:

```ts
  // ============================================================================
  // Gamut mapping (CSS Color 4 §14 — binary search with local MINDE)
  // ============================================================================

  private static readonly GAMUT_JND = 0.02;
  private static readonly GAMUT_EPSILON = 0.0001;

  /** Whether an unclamped linear-sRGB triple lies inside the display gamut. */
  private inSrgbGamut(lin: { r: number; g: number; b: number }): boolean {
    const t = 1e-6;
    return lin.r >= -t && lin.r <= 1 + t && lin.g >= -t && lin.g <= 1 + t && lin.b >= -t && lin.b <= 1 + t;
  }

  /** Plain ΔEOK (Euclidean in OKLAB), the metric CSS Color 4 uses for its JND. Not ΔEOK2. */
  private deltaEOkPlain(a: OKLAB, b: OKLAB): number {
    return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
  }

  /** Clamp a linear triple into 0–1 and encode as hex. */
  private linearToHexClipped(lin: { r: number; g: number; b: number }): HexColor {
    return this.rgbToHex(
      clamp(this.linearToSrgb(lin.r), RGB_MIN, RGB_MAX),
      clamp(this.linearToSrgb(lin.g), RGB_MIN, RGB_MAX),
      clamp(this.linearToSrgb(lin.b), RGB_MIN, RGB_MAX)
    );
  }

  /**
   * Bring an OKLCH colour into sRGB the way CSS Color 4 §14 specifies: keep L
   * and h, bisect C, and accept a per-channel clip as soon as it is within one
   * just-noticeable difference (ΔEOK 0.02) of the candidate.
   *
   * `oklchToHex` clips per channel instead, which changes HUE — the OKLCH
   * complement of #0000FF comes out #A02000 (dark red) under clipping and
   * #734F00 (dark olive) here (research 02 Table B). Every drawn or matched
   * colour produced by hue rotation in OKLCH must come through this method.
   *
   * @param L Lightness 0–1  @param C Chroma ≥ 0  @param h Hue 0–360
   */
  gamutMapOklch(L: number, C: number, h: number): HexColor {
    if (L >= 1) return '#FFFFFF' as HexColor;
    if (L <= 0) return '#000000' as HexColor;
    const JND = ColorConverter.GAMUT_JND;
    const EPS = ColorConverter.GAMUT_EPSILON;
    const hRad = h * (Math.PI / 180);
    const labAt = (c: number): OKLAB => ({ L, a: c * Math.cos(hRad), b: c * Math.sin(hRad) });
    const clipLin = (lin: { r: number; g: number; b: number }) => ({
      r: clamp(lin.r, 0, 1),
      g: clamp(lin.g, 0, 1),
      b: clamp(lin.b, 0, 1),
    });

    let lab = labAt(C);
    let current = this.oklabToLinearRgb(lab.L, lab.a, lab.b);
    if (this.inSrgbGamut(current)) return this.linearToHexClipped(current);

    let clipped = clipLin(current);
    if (this.deltaEOkPlain(this.linearRgbToOklab(clipped.r, clipped.g, clipped.b), lab) < JND) {
      return this.linearToHexClipped(clipped);
    }

    let min = 0;
    let max = C;
    let minInGamut = true;
    while (max - min > EPS) {
      const chroma = (min + max) / 2;
      lab = labAt(chroma);
      current = this.oklabToLinearRgb(lab.L, lab.a, lab.b);
      if (minInGamut && this.inSrgbGamut(current)) {
        min = chroma;
        continue;
      }
      clipped = clipLin(current);
      const E = this.deltaEOkPlain(this.linearRgbToOklab(clipped.r, clipped.g, clipped.b), lab);
      if (E < JND) {
        if (JND - E < EPS) return this.linearToHexClipped(clipped);
        minInGamut = false;
        min = chroma;
      } else {
        max = chroma;
      }
    }
    return this.linearToHexClipped(clipped);
  }

  /** Static: see the instance method. */
  static gamutMapOklch(L: number, C: number, h: number): HexColor {
    return this.getDefault().gamutMapOklch(L, C, h);
  }

  /**
   * The largest OKLCH chroma at (L, h) that is still inside sRGB, by bisection.
   * Used to paint a perceptual ring that is in gamut at every angle. The sRGB
   * solid is not star-shaped in OKLAB along the blue ray (h ≈ 264°), so the
   * search starts from 0 and only ever moves the lower bound while in gamut.
   */
  maxChromaOklch(L: number, h: number): number {
    if (L <= 0 || L >= 1) return 0;
    const hRad = h * (Math.PI / 180);
    let lo = 0;
    let hi = 0.4;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const lin = this.oklabToLinearRgb(L, mid * Math.cos(hRad), mid * Math.sin(hRad));
      if (this.inSrgbGamut(lin)) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /** Static: see the instance method. */
  static maxChromaOklch(L: number, h: number): number {
    return this.getDefault().maxChromaOklch(L, h);
  }
```

`OKLAB` is already imported in this file (used by `rgbToOklab`); `clamp`, `RGB_MIN`, `RGB_MAX`, `HexColor` likewise. If `HexColor` is imported only as a type, the two `as HexColor` casts are fine.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/color`
Expected: PASS, including the culori parity (if the exact-match rate lands between 0.85 and 0.9, lower the threshold to the observed value minus 0.02 and note the observed figure in the test comment — the ±1 channel bound is the real assertion).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/services/color packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): CSS Color 4 OKLCH gamut mapping and max-chroma, culori as dev oracle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 5: The constant-lightness OKLCH wheel

**Files:**
- Create: `packages/core/src/services/dye/wheels/oklch-lightness.ts`
- Modify: `packages/core/src/services/dye/wheels/ColorWheel.ts` (replace the placeholder)
- Test: `packages/core/src/services/dye/wheels/__tests__/oklch-lightness.test.ts`

**Interfaces:**
- Consumes: `ColorConverter.hexToOklch`, `gamutMapOklch`, `maxChromaOklch`, `hexToHsv` (Task 4).
- Produces: `OKLCH_LIGHTNESS_WHEEL: ColorWheel`, `RING_LIGHTNESS = 0.65`, `ACHROMATIC_CHROMA = 0.005`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { OKLCH_LIGHTNESS_WHEEL, RING_LIGHTNESS } from '../oklch-lightness.js';
import { ColorConverter } from '../../../color/ColorConverter.js';

describe('oklch-lightness wheel', () => {
  it('reads the OKLCH hue of the base', () => {
    expect(OKLCH_LIGHTNESS_WHEEL.hueOf('#FF0000')).toBeCloseTo(29.2, 0);
  });

  it('keeps L and C of the base and gamut-maps the rotated colour', () => {
    const base = ColorConverter.hexToOklch('#0000FF');
    const { targetHex, targetHue } = OKLCH_LIGHTNESS_WHEEL.target('#0000FF', (base.h + 180) % 360);
    const got = ColorConverter.hexToOklch(targetHex);
    expect(got.L).toBeCloseTo(base.L, 1);
    // dark olive, per research 02 Table B — and the HSV hue we report is the mapped colour's
    expect(targetHue).toBeCloseTo(ColorConverter.hexToHsv(targetHex).h, 9);
    expect(targetHue).toBeGreaterThan(30);
    expect(targetHue).toBeLessThan(60);
  });

  it('answers the same L for every partner of a saturated base (the point of this wheel)', () => {
    const base = ColorConverter.hexToOklch('#FFD700');
    for (const off of [60, 120, 180, 240, 300]) {
      const hex = OKLCH_LIGHTNESS_WHEEL.target('#FFD700', (base.h + off) % 360).targetHex;
      expect(ColorConverter.hexToOklch(hex).L).toBeCloseTo(base.L, 1);
    }
  });

  it('returns an achromatic base unchanged for every angle', () => {
    for (const hex of ['#808080', '#FFFFFF', '#000000', '#F4F5F9']) {
      for (const angle of [0, 90, 180, 270]) {
        expect(OKLCH_LIGHTNESS_WHEEL.target(hex, angle).targetHex).toBe(hex);
      }
    }
  });

  it('paints an in-gamut ring at the ring lightness, with hue advancing around the circle', () => {
    const stops = OKLCH_LIGHTNESS_WHEEL.ringStops(36);
    expect(stops).toHaveLength(36);
    let prev = -1;
    for (const [i, hex] of stops.entries()) {
      const { L, h } = ColorConverter.hexToOklch(hex);
      expect(L).toBeCloseTo(RING_LIGHTNESS, 1);
      const expected = (i * 10) % 360;
      const diff = Math.min(Math.abs(h - expected), 360 - Math.abs(h - expected));
      expect(diff).toBeLessThan(4); // 8-bit rounding of a max-chroma colour
      if (i > 0 && i < 35) expect(h).toBeGreaterThan(prev - 4);
      prev = h;
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels/__tests__/oklch-lightness.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `oklch-lightness.ts`**

```ts
/**
 * The constant-lightness OKLCH wheel: rotate hue at the base's OKLab L and C,
 * then gamut-map. Unlike the warp wheels this abandons the base's HSV S/V, so
 * a light base yields light partners and palettes lean toward mid-tones —
 * a deliberate product decision (spec §2.2), not a side effect.
 *
 * @module services/dye/wheels/oklch-lightness
 */

import type { HexColor } from '@xivdyetools/types';
import { ColorConverter } from '../../color/ColorConverter.js';
import type { ColorWheel } from './types.js';

/** Ring stops are painted at this L, at the maximum in-gamut chroma per hue. */
export const RING_LIGHTNESS = 0.65;

/** Below this OKLCH chroma a colour is treated as grey: no hue, no rotation. */
export const ACHROMATIC_CHROMA = 0.005;

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

let ringCache: { count: number; stops: readonly HexColor[] } | null = null;

export const OKLCH_LIGHTNESS_WHEEL: ColorWheel = {
  id: 'oklch-lightness',

  hueOf(hex: string): number {
    return mod360(ColorConverter.hexToOklch(hex).h);
  },

  target(baseHex: string, wheelHue: number): { targetHex: HexColor; targetHue: number } {
    const base = ColorConverter.hexToOklch(baseHex);
    if (base.C < ACHROMATIC_CHROMA) {
      // A grey has no hue to rotate; every partner of a grey is that grey.
      const hex = ColorConverter.rgbToHex(...Object.values(ColorConverter.hexToRgb(baseHex)) as [number, number, number]);
      return { targetHex: hex, targetHue: ColorConverter.hexToHsv(hex).h };
    }
    const targetHex = ColorConverter.gamutMapOklch(base.L, base.C, mod360(wheelHue));
    return { targetHex, targetHue: ColorConverter.hexToHsv(targetHex).h };
  },

  ringStops(count: number): readonly HexColor[] {
    if (ringCache && ringCache.count === count) return ringCache.stops;
    const stops: HexColor[] = [];
    for (let i = 0; i < count; i++) {
      const h = (i * 360) / count;
      const c = ColorConverter.maxChromaOklch(RING_LIGHTNESS, h);
      stops.push(ColorConverter.gamutMapOklch(RING_LIGHTNESS, c, h));
    }
    ringCache = { count, stops };
    return stops;
  },
};
```

If `ColorConverter.hexToRgb` returns `{ r, g, b }` in that key order the spread works; otherwise write `const { r, g, b } = ColorConverter.hexToRgb(baseHex); const hex = ColorConverter.rgbToHex(r, g, b);` — the intent is only to normalise the hex's case.

- [ ] **Step 4: Register it**

In `ColorWheel.ts`, import `OKLCH_LIGHTNESS_WHEEL` from `./oklch-lightness.js` and replace the placeholder entry.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/dye/wheels
git commit -m "feat(core): constant-lightness OKLCH wheel with gamut-mapped targets and ring

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 6: Munsell wheel — generator script, checked-in table, NOTICE, cross-check

**Files:**
- Create: `packages/core/scripts/build-munsell-hues.ts`
- Create: `packages/core/src/data/munsell-hues.json` (generated by the script)
- Create: `packages/core/src/services/dye/wheels/munsell.ts`
- Create: `packages/core/NOTICE`
- Modify: `packages/core/package.json` (`scripts.build:munsell`, `files` if it has an allowlist — add `NOTICE`)
- Modify: `packages/core/README.md` (one line under "## License" pointing at NOTICE)
- Modify: `packages/core/src/services/dye/wheels/ColorWheel.ts` (replace the placeholder)
- Create: `docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.mjs` + `.output.txt`
- Test: `packages/core/src/services/dye/wheels/__tests__/munsell.test.ts`

**Interfaces:**
- Consumes: `normalizeWarpTable`, `hueWarpWheel` (Task 1).
- Produces: `MUNSELL_TABLE: WarpTable`, `MUNSELL_ANCHORS: ReadonlyArray<{ notation: string; astm: number; wheelAngle: number; hsvHue: number }>`, `MUNSELL_WHEEL`.

- [ ] **Step 1: Download the renotation data (one-time, outside the repo)**

```bash
mkdir -p "$TMPDIR/munsell" 2>/dev/null || mkdir -p /tmp/munsell
curl -fsSL -o /tmp/munsell/real.dat http://www.rit-mcsl.org/MunsellRenotation/real.dat
head -3 /tmp/munsell/real.dat
```

Expected: header line `h V C x y Y`, then rows like `2.5R 1 2 0.3910 0.2790 1.210`. Do **not** copy this file into the repository.

- [ ] **Step 2: Write the generator script**

`packages/core/scripts/build-munsell-hues.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Derives `src/data/munsell-hues.json` — the Munsell hue wheel's 40 anchors —
 * from the Munsell renotation data, which is NOT vendored in this repository.
 *
 *   curl -fsSL -o /tmp/munsell/real.dat http://www.rit-mcsl.org/MunsellRenotation/real.dat
 *   pnpm --filter @xivdyetools/core run build:munsell -- /tmp/munsell/real.dat
 *
 * Provenance, licence reasoning and attribution: `packages/core/NOTICE` and
 * `docs/research/2026-09-04-harmony-color-wheels/07-munsell-licence-check.md`.
 *
 * Method (spec §2.1 / §2.3): for each of the 40 principal hues take the row at
 * VALUE 6 / CHROMA 8 (the one sample point present for all 40), convert its
 * xyY (Illuminant C, Y in 0–100) → XYZ → Bradford C→D65 → linear sRGB →
 * gamma-encoded sRGB WITHOUT clipping → HSV hue. The wheel angle is the ASTM
 * hue number × 3.6°. `normalizeWarpTable` then sorts, unwraps, monotonises
 * and re-zeroes so sRGB 0° ↦ wheel 0°, like every other warp wheel.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWarpTable } from '../src/services/dye/wheels/hue-warp.js';

const VALUE = 6;
const CHROMA = 8;

/** ASTM D1535 hue-family codes: R=7 YR=6 Y=5 GY=4 G=3 BG=2 B=1 PB=10 P=9 RP=8. */
const HUE_CODES: Record<string, number> = { R: 7, YR: 6, Y: 5, GY: 4, G: 3, BG: 2, B: 1, PB: 10, P: 9, RP: 8 };

/** 5R → 5, 5Y → 25, 5G → 45, 5B → 65, 5P → 85, 10RP → 100 (≡ 0). */
function astmHue(step: number, family: string): number {
  const code = HUE_CODES[family];
  if (code === undefined) throw new Error(`Unknown Munsell hue family: ${family}`);
  return 10 * ((((7 - code) % 10) + 10) % 10) + step;
}

// Bradford chromatic adaptation, Illuminant C → D65 (Lindbloom,
// http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html). Verified
// indirectly by the cross-check in Step 7: a wrong matrix moves hues by
// degrees, and the gate there is 1°.
const BRADFORD_C_TO_D65 = [
  [0.9904476, -0.0071683, -0.0116156],
  [-0.0123712, 1.015595, -0.0029282],
  [-0.0035635, 0.0067263, 0.9218669],
];
// XYZ (D65) → linear sRGB (IEC 61966-2-1).
const XYZ_TO_LINEAR_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
];

function mul(m: number[][], v: [number, number, number]): [number, number, number] {
  return [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as [number, number, number];
}

/** sRGB transfer function extended to negative and >1 values (no clipping). */
function encode(c: number): number {
  const a = Math.abs(c);
  const e = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055;
  return Math.sign(c) * e;
}

function hsvHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function main(): void {
  const src = process.argv[2];
  if (!src) {
    console.error('usage: build-munsell-hues.ts <path to real.dat>');
    process.exit(2);
  }
  const lines = readFileSync(src, 'utf-8').split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].trim().split(/\s+/);
  if (header.join(' ') !== 'h V C x y Y') {
    throw new Error(`Unexpected header: ${header.join(' ')}`);
  }

  const anchors: Array<{ notation: string; astm: number; hsvHue: number; inGamut: boolean }> = [];
  for (const line of lines.slice(1)) {
    const [h, V, C, x, y, Y] = line.trim().split(/\s+/);
    if (Number(V) !== VALUE || Number(C) !== CHROMA) continue;
    const m = /^([\d.]+)([A-Z]+)$/.exec(h);
    if (!m) throw new Error(`Cannot parse hue notation: ${h}`);
    const step = Number(m[1]);
    const family = m[2];
    const xx = Number(x);
    const yy = Number(y);
    const YY = Number(Y) / 100;
    const xyz: [number, number, number] = [(xx * YY) / yy, YY, ((1 - xx - yy) * YY) / yy];
    const lin = mul(XYZ_TO_LINEAR_SRGB, mul(BRADFORD_C_TO_D65, xyz));
    const enc = lin.map(encode) as [number, number, number];
    anchors.push({
      notation: h,
      astm: astmHue(step, family),
      hsvHue: hsvHue(...enc),
      inGamut: lin.every((v) => v >= -1e-6 && v <= 1 + 1e-6),
    });
  }

  if (anchors.length !== 40) {
    throw new Error(`Expected 40 rows at V=${VALUE} C=${CHROMA}, found ${anchors.length}`);
  }

  const raw = anchors.map((a) => [a.astm * 3.6, a.hsvHue] as const);
  const table = normalizeWarpTable(raw, 'munsell', { maxCorrectionDeg: 1 });

  // Recover each anchor's wheel angle from the normalised table: the pair whose
  // HSV column equals the anchor's hue.
  const withWheel = anchors
    .map((a) => {
      const row = table.find(([, hsv]) => Math.abs(hsv - a.hsvHue) < 1e-9);
      if (!row) throw new Error(`Anchor ${a.notation} not found in the normalised table`);
      return { notation: a.notation, astm: a.astm, wheelAngle: row[0], hsvHue: a.hsvHue, inGamut: a.inGamut };
    })
    .sort((a, b) => a.wheelAngle - b.wheelAngle);

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/munsell-hues.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        $comment:
          'Generated by scripts/build-munsell-hues.ts from the Munsell renotation data (RIT MCSL real.dat, ' +
          'Newhall, Nickerson & Judd 1943) at Value 6 / Chroma 8. Attribution: packages/core/NOTICE. Do not edit by hand.',
        value: VALUE,
        chroma: CHROMA,
        anchors: withWheel,
        table,
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );

  const outOfGamut = withWheel.filter((a) => !a.inGamut).map((a) => a.notation);
  console.log(`Wrote ${withWheel.length} anchors to ${outPath}`);
  console.log(`Outside sRGB at V${VALUE}/C${CHROMA} (hue still valid): ${outOfGamut.join(', ') || 'none'}`);
  console.table(withWheel.map(({ notation, astm, wheelAngle, hsvHue }) => ({ notation, astm, wheelAngle: +wheelAngle.toFixed(3), hsvHue: +hsvHue.toFixed(3) })));
}

main();
```

Add to `packages/core/package.json` scripts: `"build:munsell": "tsx scripts/build-munsell-hues.ts"`. Do **not** add it to `build` — it needs a file that is not in the repo.

- [ ] **Step 3: Run the generator**

Run: `pnpm --filter @xivdyetools/core run build:munsell -- /tmp/munsell/real.dat`
Expected: `Wrote 40 anchors …`, a table of 40 rows with `wheelAngle` values 9° apart, and the JSON file created. Paste the printed table into the commit message body of Step 9 so the derivation is in history.

- [ ] **Step 4: Write the failing wheel tests**

`packages/core/src/services/dye/wheels/__tests__/munsell.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MUNSELL_ANCHORS, MUNSELL_TABLE, MUNSELL_WHEEL } from '../munsell.js';
import { assertMonotoneTable } from '../hue-warp.js';

const anchor = (notation: string) => {
  const a = MUNSELL_ANCHORS.find((x) => x.notation === notation);
  if (!a) throw new Error(`no anchor ${notation}`);
  return a;
};

describe('munsell wheel', () => {
  it('has 40 anchors, one per principal hue, and a valid 42-pair table', () => {
    expect(MUNSELL_ANCHORS).toHaveLength(40);
    expect(new Set(MUNSELL_ANCHORS.map((a) => a.notation)).size).toBe(40);
    expect(MUNSELL_TABLE).toHaveLength(42);
    expect(() => assertMonotoneTable(MUNSELL_TABLE, 'munsell')).not.toThrow();
  });

  it('spaces consecutive anchors 9° apart on the wheel (2.5 Munsell steps × 3.6°)', () => {
    const sorted = [...MUNSELL_ANCHORS].sort((a, b) => a.wheelAngle - b.wheelAngle);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].wheelAngle - sorted[i - 1].wheelAngle).toBeCloseTo(9, 6);
    }
  });

  it('keeps the principal hues in spectral order with plausible sRGB hues', () => {
    // Ranges, not exact values: the exact numbers are pinned by the golden
    // digest (HarmonySelector.golden.test.ts) once the wheel is wired in.
    expect(anchor('5R').hsvHue).toBeGreaterThanOrEqual(345);
    expect(anchor('5Y').hsvHue).toBeGreaterThan(50);
    expect(anchor('5Y').hsvHue).toBeLessThan(75);
    expect(anchor('5G').hsvHue).toBeGreaterThan(145);
    expect(anchor('5G').hsvHue).toBeLessThan(175);
    expect(anchor('5B').hsvHue).toBeGreaterThan(190);
    expect(anchor('5B').hsvHue).toBeLessThan(220);
    expect(anchor('5P').hsvHue).toBeGreaterThan(270);
    expect(anchor('5P').hsvHue).toBeLessThan(305);
  });

  it("red's complement is a blue-green (5BG), between sRGB 160° and 195°", () => {
    const hue = MUNSELL_WHEEL.target('#FF0000', 180).targetHue;
    expect(hue).toBeGreaterThan(160);
    expect(hue).toBeLessThan(195);
  });

  it('keeps a grey grey', () => {
    expect(MUNSELL_WHEEL.target('#808080', 180).targetHex).toBe('#808080');
  });
});
```

- [ ] **Step 5: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels/__tests__/munsell.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Create `munsell.ts` and register it**

```ts
/**
 * The Munsell hue wheel: 40 principal hues at 3.6° per ASTM step, anchored
 * to sRGB by the renotation data at Value 6 / Chroma 8 (see NOTICE).
 * Red's complement is 5BG, a blue-green — the third answer after RGB (cyan)
 * and RYB (green), and the one Japan's JIS Z 8721 teaches.
 *
 * @module services/dye/wheels/munsell
 */

import munsellData from '../../../data/munsell-hues.json' with { type: 'json' };
import { hueWarpWheel } from './hue-warp.js';
import type { WarpTable } from './types.js';

export interface MunsellAnchor {
  notation: string;
  astm: number;
  wheelAngle: number;
  hsvHue: number;
}

export const MUNSELL_ANCHORS: ReadonlyArray<MunsellAnchor> = munsellData.anchors;

export const MUNSELL_TABLE: WarpTable = munsellData.table as unknown as WarpTable;

export const MUNSELL_WHEEL = hueWarpWheel('munsell', MUNSELL_TABLE);
```

In `ColorWheel.ts`, import `MUNSELL_WHEEL` from `./munsell.js`, replace the placeholder, and delete the now-unused `notYet` helper.

- [ ] **Step 7: Cross-check the anchors against an independent conversion**

In a throwaway directory (never in the repo): `mkdir -p /tmp/munsell-xcheck && cd /tmp/munsell-xcheck && npm init -y >/dev/null && npm i munsell@latest`. Then create `docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.mjs` in the repo:

```js
// Cross-check of packages/core/src/data/munsell-hues.json against munsell.js
// (privet-kitty, MPL-2.0 — a DEV-ONLY oracle run from a scratch directory,
// never a dependency of this repository). Run from the scratch dir:
//   node <repo>/docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.mjs <repo>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { munsellToHex } = require('munsell');
const repo = process.argv[2];
const data = JSON.parse(readFileSync(`${repo}/packages/core/src/data/munsell-hues.json`, 'utf-8'));
const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return NaN;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};
const rows = data.anchors.map((a) => {
  const hex = munsellToHex(`${a.notation} ${data.value}/${data.chroma}`);
  const theirs = hue(hex);
  const delta = Math.min(Math.abs(theirs - a.hsvHue), 360 - Math.abs(theirs - a.hsvHue));
  return { notation: a.notation, ours: +a.hsvHue.toFixed(2), munselljs: +theirs.toFixed(2), delta: +delta.toFixed(2) };
});
console.table(rows);
const worst = Math.max(...rows.map((r) => r.delta));
console.log(`max |Δhue| = ${worst.toFixed(2)}°  (gate: 1.00°)`);
process.exit(worst <= 1 ? 0 : 1);
```

Run it from the scratch directory and save the output:

```bash
cd /tmp/munsell-xcheck && node <repo>/docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.mjs <repo> | tee <repo>/docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.output.txt
```

Expected: exit 0, `max |Δhue|` ≤ 1.00°. If `munsellToHex` is not the export name, run `node -e "console.log(Object.keys(require('munsell')))"` in the scratch dir and use the Munsell-string-to-hex function it lists. If any row exceeds 1°, the Bradford or XYZ→sRGB matrix in the script is wrong — fix the matrix, regenerate, re-run; do not widen the gate. (munsell.js clips to sRGB, so anchors the generator reported as out-of-gamut may differ by up to ~2°; list those separately and gate the in-gamut rows at 1°.)

- [ ] **Step 8: Write `packages/core/NOTICE` and reference it**

`packages/core/NOTICE`:

```
Third-party data notices for @xivdyetools/core
==============================================

Munsell hue-wheel data
----------------------
The Munsell hue-angle table in src/data/munsell-hues.json is derived from
the Munsell renotation data (real.dat) published by the Munsell Color
Science Laboratory / Program of Color Science, Rochester Institute of
Technology:
  https://www.rit.edu/science/munsell-color-science-lab-educational-resources
which in turn reproduces the tables of Newhall, S. M., Nickerson, D., &
Judd, D. B. (1943). "Final Report of the O.S.A. Subcommittee on the
Spacing of the Munsell Colors." JOSA 33(7), 385-418.
doi:10.1364/JOSA.33.000385

Only 40 derived hue-angle pairs (Value 6 / Chroma 8) are shipped; the
renotation dataset itself is not redistributed. sRGB values were
cross-checked against the R package `munsell`
(https://github.com/cwickham/munsell), Copyright (c) 2016 Charlotte
Wickham, MIT licence, and against munsell.js (MPL-2.0) as a development-time
oracle.

These values are computed colorimetric renotations, not measurements of
any physical Munsell Book of Color, and are not endorsed by or affiliated
with X-Rite, Pantone or Amazys Holding GmbH. MUNSELL is a registered
trademark (USPTO Reg. No. 1570854) of Amazys Holding GmbH.
```

In `packages/core/README.md`, under `## License`, add: `Third-party data attributions (the Munsell hue wheel) are in [NOTICE](./NOTICE).` If `package.json` has a `files` allowlist, add `"NOTICE"` to it.

- [ ] **Step 9: Run the wheel suite and commit**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/wheels`
Expected: PASS.

```bash
git add packages/core/scripts/build-munsell-hues.ts packages/core/src/data/munsell-hues.json packages/core/src/services/dye/wheels packages/core/NOTICE packages/core/README.md packages/core/package.json docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.mjs docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.output.txt
git commit -F - <<'EOF'
feat(core): Munsell (JIS) colour wheel from 40 renotation anchors

Generated by scripts/build-munsell-hues.ts from RIT real.dat at V6/C8;
cross-checked against munsell.js (max |Δhue| printed in the probe output).
Attribution and trademark notice in packages/core/NOTICE.

<paste the console.table from Step 3 here>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem
EOF
```

---

### Task 7: Wire wheels into `generateHarmonySlots`, extend the golden, export from core, deprecate the old API

**Files:**
- Modify: `packages/core/src/services/dye/HarmonySelector.ts` (config ~line 36, slot ~line 52, body ~lines 168–215)
- Modify: `packages/core/src/services/dye/__tests__/HarmonySelector.test.ts` (append)
- Modify: `packages/core/src/services/dye/__tests__/HarmonySelector.golden.test.ts` (`CONFIGS`, ~line 49; a second `describe`)
- Modify: `packages/core/src/services/dye/HarmonyGenerator.ts` (`HarmonyColorSpace` ~line 97, `HarmonyOptions.colorSpace` ~line 113, `rotateHueInSpace` ~line 456)
- Modify: `packages/core/src/index.ts` (after the `HarmonySelector` export block, ~line 71)

**Interfaces:**
- Produces: `HarmonySelectionConfig.wheel?: ColorWheelId`; `HarmonySlot.wheelHue: number`; core root exports `COLOR_WHEEL_IDS`, `DEFAULT_COLOR_WHEEL`, `isColorWheelId`, `getColorWheel`, `type ColorWheel`, `type ColorWheelId`.

- [ ] **Step 1: Write the failing selector tests**

Append to `HarmonySelector.test.ts`:

```ts
describe('colour wheel', () => {
  const ALL_DYES = svc.getAllDyes();
  const base = (config: Partial<HarmonySelectionConfig> = {}) =>
    generateHarmonySlots(RED.hex, 'complementary', ALL_DYES, { ...PERCEPTUAL, preventDuplicates: true, ...config }, {
      excludeItemIDs: [RED.itemID],
    });

  it('defaults to the RGB wheel: unset and rgb answer identically, with wheelHue = targetHue', () => {
    const unset = base();
    const rgb = base({ wheel: 'rgb' });
    expect(rgb.map((s) => s.dye?.itemID)).toEqual(unset.map((s) => s.dye?.itemID));
    for (const s of unset) expect(s.wheelHue).toBe(s.targetHue);
  });

  it('exposes the ring angle separately from the sRGB hue on a warped wheel', () => {
    const [slot] = base({ wheel: 'ryb' });
    const baseWheelHue = ColorService.hexToHsv(RED.hex).h; // Dalamud Red is near sRGB 0°, so ≈ RYB 0°
    expect(Math.abs(slot.wheelHue - ((baseWheelHue + 180) % 360))).toBeLessThan(5);
    expect(slot.targetHue).not.toBeCloseTo(slot.wheelHue, 0);
  });

  it("chooses a different complement for a saturated red on RYB than on RGB", () => {
    expect(base({ wheel: 'ryb' })[0].dye?.itemID).not.toBe(base()[0].dye?.itemID);
  });

  it.each(['ryb', 'munsell', 'oklch-hue', 'oklch-lightness'] as const)(
    'keeps a near-grey base near-grey on %s',
    (wheel) => {
      const slots = generateHarmonySlots(WHITE.hex, 'triadic', ALL_DYES, { ...PERCEPTUAL, wheel }, {
        excludeItemIDs: [WHITE.itemID],
      });
      for (const s of slots) expect(ColorService.hexToHsv(s.targetHex).s).toBeLessThan(6);
    }
  );

  it('rejects an unknown wheel loudly rather than falling back to RGB', () => {
    expect(() => base({ wheel: 'cmyk' as never })).toThrow(RangeError);
  });
});
```

Add `import type { HarmonySelectionConfig } from '../HarmonySelector.js';` to the file's imports if it is not already imported.

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/__tests__/HarmonySelector.test.ts`
Expected: FAIL — `wheelHue` undefined / unknown wheel not thrown.

- [ ] **Step 3: Change the selector**

In `HarmonySelector.ts`:

1. Imports: add `import type { ColorWheelId } from '@xivdyetools/types';` and `import { DEFAULT_COLOR_WHEEL, getColorWheel } from './wheels/ColorWheel.js';`.
2. `HarmonySelectionConfig`: add after `preventDuplicates`:
   ```ts
     /**
      * Which colour wheel the offsets are measured on. Default `'rgb'`, which is
      * today's behaviour bit for bit. See `wheels/ColorWheel.ts`.
      */
     wheel?: ColorWheelId;
   ```
3. `HarmonySlot`: add after `targetHue`:
   ```ts
     /**
      * The slot's angle on the SELECTED wheel's ring, 0–359 — where a node is
      * drawn. Equals `targetHue` on the RGB wheel and differs on every other.
      */
     wheelHue: number;
   ```
4. In `generateHarmonySlots`, replace
   ```ts
     const baseHsv = ColorService.hexToHsv(baseHex);
   ```
   with
   ```ts
     const wheel = getColorWheel(config.wheel ?? DEFAULT_COLOR_WHEEL);
     const baseWheelHue = wheel.hueOf(baseHex);
   ```
   and inside the `offsets.forEach`, replace
   ```ts
       const targetHue = (baseHsv.h + normalisedOffset) % 360;
       // The ideal carries the BASE's saturation and value onto the rotated hue. …
       const targetHex = ColorService.hsvToHex(targetHue, baseHsv.s, baseHsv.v);
   ```
   with
   ```ts
       const wheelHue = (baseWheelHue + normalisedOffset) % 360;
       // The wheel builds the ideal. Warp wheels carry the BASE's saturation and
       // value onto the mapped hue — the whole reason a desaturated base finds
       // desaturated dyes; the constant-lightness wheel carries L and C instead.
       const { targetHex, targetHue } = wheel.target(baseHex, wheelHue);
   ```
   and add `wheelHue,` to the pushed slot object after `targetHue,`. Keep the comment about the S/V carry (moved into the wheel factory) accurate; remove `baseHsv` if nothing else reads it (noUnusedLocals). `ColorService` stays imported for `devianceFor`.

- [ ] **Step 4: Run the selector tests and the untouched golden**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/__tests__/HarmonySelector.test.ts src/services/dye/__tests__/HarmonySelector.golden.test.ts`
Expected: both PASS. The golden digest must be **unchanged** — if it moved, the RGB wheel is not the identity; stop and fix Task 1's identity short-circuit before anything else.

- [ ] **Step 5: Extend the golden with a frozen digest per wheel**

In `HarmonySelector.golden.test.ts`, after the existing `CONFIGS`, add:

```ts
/**
 * One config per non-RGB wheel, page defaults otherwise. A change to a wheel
 * table is a deliberate re-baseline with the reason in the commit; the named
 * samples print dye names first so the diff says WHAT moved.
 */
const WHEEL_CONFIGS: Array<[string, HarmonySelectionConfig]> = (
  ['ryb', 'munsell', 'oklch-hue', 'oklch-lightness'] as const
).map((wheel) => [
  wheel,
  { usePerceptualMatching: true, matchingMethod: 'ciede2000', preventDuplicates: true, companionCount: 3, wheel },
]);

/** Captured on first run (Task 7 step 6); see the commit that added each. */
const WHEEL_DIGESTS: Record<string, string> = {
  ryb: '',
  munsell: '',
  'oklch-hue': '',
  'oklch-lightness': '',
};

/** Dalamud Red's complementary and triadic partners per wheel — the sample that names dyes. */
const WHEEL_SAMPLE: Record<string, { complementary: Array<string | null>; triadic: Array<string | null> }> = {
  ryb: { complementary: [], triadic: [] },
  munsell: { complementary: [], triadic: [] },
  'oklch-hue': { complementary: [], triadic: [] },
  'oklch-lightness': { complementary: [], triadic: [] },
};

describe('generateHarmonySlots golden output per colour wheel', () => {
  const red = ALL.find((d) => d.name === 'Dalamud Red')!;

  it.each(WHEEL_CONFIGS)('names the same dyes for Dalamud Red on %s', (wheel, config) => {
    const actual = {
      complementary: generateHarmonySlots(red.hex, 'complementary', ALL, config, { excludeItemIDs: [red.itemID] }).map(
        (s) => s.dye?.name ?? null
      ),
      triadic: generateHarmonySlots(red.hex, 'triadic', ALL, config, { excludeItemIDs: [red.itemID] }).map(
        (s) => s.dye?.name ?? null
      ),
    };
    expect(actual).toEqual(WHEEL_SAMPLE[wheel]);
  });

  it.each(WHEEL_CONFIGS)('answers unchanged across every dye and type on %s', (wheel, config) => {
    const lines: string[] = [];
    for (const type of TYPES) {
      for (const base of [...ALL].sort((a, b) => a.itemID - b.itemID)) {
        const encoded = generateHarmonySlots(base.hex, type, ALL, config, { excludeItemIDs: [base.itemID] })
          .map((s) => `${s.offset}:${s.dye ? s.dye.itemID : '-'}[${s.companions.map((d) => d.itemID).join(',')}]`)
          .join('|');
        lines.push(`${type}|${base.itemID}|${encoded}`);
      }
    }
    const digest = createHash('sha256').update(lines.join('\n')).digest('hex');
    expect(digest).toBe(WHEEL_DIGESTS[wheel]);
  });

  it('RGB and RYB disagree on the complement for most saturated dyes (the feature is not cosmetic)', () => {
    const rgbCfg = { ...WHEEL_CONFIGS[0][1], wheel: 'rgb' as const };
    const rybCfg = WHEEL_CONFIGS[0][1];
    let changed = 0;
    for (const base of ALL) {
      const a = generateHarmonySlots(base.hex, 'complementary', ALL, rgbCfg, { excludeItemIDs: [base.itemID] })[0]?.dye?.itemID;
      const b = generateHarmonySlots(base.hex, 'complementary', ALL, rybCfg, { excludeItemIDs: [base.itemID] })[0]?.dye?.itemID;
      if (a !== b) changed++;
    }
    // research 05 §6 measured 63/125 with a 124-dye pool; allow for pool and companion differences
    expect(changed / ALL.length).toBeGreaterThan(0.3);
  });
});
```

Check what the file's existing digest loop uses for the encoding string and mirror it exactly (the existing loop is at ~line 205; the shape above is copied from it — keep them identical).

- [ ] **Step 6: Capture the digests and samples, once**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/dye/__tests__/HarmonySelector.golden.test.ts`
Expected: the four per-wheel tests FAIL, each printing the actual digest / dye names. Copy each printed digest into `WHEEL_DIGESTS` and each printed name list into `WHEEL_SAMPLE`, re-run, expect PASS. Sanity-check before pasting: the RYB complementary sample for Dalamud Red must be a green-family dye (not Metallic Cobalt Green, which is the RGB answer), and `oklch-lightness`'s must be visibly closer to Dalamud Red's own darkness than RGB's. If either sanity check fails, the wheel is wrong, not the fixture.

- [ ] **Step 7: Deprecate the clipping rotation API**

In `HarmonyGenerator.ts`, add to the JSDoc of `HarmonyColorSpace`, `HarmonyOptions.colorSpace` and `rotateHueInSpace`:

```ts
 * @deprecated Since 5.2.0. Rotates OKLCH/LCH at fixed L/C and then CLIPS per
 * channel, which changes hue (the OKLCH complement of #0000FF comes out
 * #A02000 instead of #734F00). Use `generateHarmonySlots(…, { wheel })` and
 * `getColorWheel(id)` instead. Kept for published-API compatibility only.
```

- [ ] **Step 8: Export from the package root**

In `packages/core/src/index.ts`, after the `HarmonySelector` export block:

```ts
/**
 * Selectable colour wheels — the ONE list every surface reads. Ids are the
 * wire format (share URL `wheel=`, the `/harmony wheel` option, the OG query).
 */
export type { ColorWheel } from './services/dye/wheels/ColorWheel.js';
export type { ColorWheelId } from '@xivdyetools/types';
export {
  COLOR_WHEEL_IDS,
  DEFAULT_COLOR_WHEEL,
  getColorWheel,
  isColorWheelId,
} from './services/dye/wheels/ColorWheel.js';
```

- [ ] **Step 9: Full core gates**

Run: `pnpm turbo run build test lint type-check --filter=@xivdyetools/core`
Expected: all green. If `knip` flags `RING_LIGHTNESS`, `ACHROMATIC_CHROMA`, `MUNSELL_ANCHORS`, `RYB_TABLE`, `OKLCH_HUE_TABLE` or `deriveOklchHueTable` as unused exports, they are test-observation points: either add them to core's knip `ignoreExportsUsedInFile`/entry config the way the repo already handles such exports (see `knip.jsonc` and the 2026-09-01 guardrails plan), or make them non-exported and test through the wheel's public behaviour. Do not delete the assertions.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): generateHarmonySlots takes a colour wheel; per-wheel goldens; deprecate rotateHueInSpace

RGB digest unchanged (740c740a…); RYB/Munsell/OKLCH digests captured.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 8: Localised wheel names in core (the shared vocabulary)

**Files:**
- Modify: `packages/core/scripts/build-locales.ts` (add `buildColorWheels`, ~line 525; assembly ~line 205)
- Modify: `packages/core/src/services/localization/TranslationProvider.ts` (after `getHarmonyType`, ~line 255)
- Modify: `packages/core/src/services/LocalizationService.ts` (after `getHarmonyType`, ~line 441)
- Regenerate: `packages/core/src/data/locales/{en,ja,de,fr,ko,zh}.json`
- Test: `packages/core/src/services/__tests__/LocalizationService.test.ts` (append; if that path is wrong, `ls packages/core/src/services/__tests__ | grep Localization`)

**Interfaces:**
- Produces: `TranslationProvider.getColorWheelName(id: ColorWheelId, locale: LocaleCode): string`; `LocalizationService.getColorWheelName(id, locale?)` instance + static. Locale JSON gains `colorWheels: { rgb, ryb, munsell, "oklch-hue", "oklch-lightness" }`.

Why core and not each surface: harmony-type names moved to core on 2026-09-03 (TERM-001) because three surfaces had three translations of "Split-Complementary". Wheel names take the same path from day one. Web-app blurbs (Task 9) stay web-only because only the web shows them.

- [ ] **Step 1: Write the failing test**

Append to the LocalizationService test file:

```ts
describe('getColorWheelName', () => {
  const ids = ['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'] as const;

  it.each(['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const)('names every wheel in %s', (locale) => {
    for (const id of ids) {
      const name = LocalizationService.getColorWheelName(id, locale);
      expect(name).toBeTruthy();
      expect(name).not.toBe(id);
    }
  });

  it('uses the Japanese term for Munsell and the JIS tag', () => {
    expect(LocalizationService.getColorWheelName('munsell', 'ja')).toBe('マンセル（JIS）');
    expect(LocalizationService.getColorWheelName('munsell', 'en')).toBe('Munsell (JIS)');
  });

  it('falls back to English for a locale it has never loaded', () => {
    expect(LocalizationService.getColorWheelName('ryb', 'xx' as never)).toBe("RYB (artist's)");
  });
});
```

Import `LocalizationService` the way the file already does.

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/__tests__/LocalizationService.test.ts`
Expected: FAIL — `getColorWheelName is not a function`.

- [ ] **Step 3: Add the translations to the locale builder**

In `build-locales.ts`, next to `buildHarmonyTypes`:

```ts
/** Colour-wheel names for the Harmony Explorer's wheel selector (spec §1). */
function buildColorWheels(locale: LocaleCode): Record<string, string> {
  const translations: Record<LocaleCode, Record<string, string>> = {
    en: {
      rgb: 'RGB (screen)',
      ryb: "RYB (artist's)",
      munsell: 'Munsell (JIS)',
      'oklch-hue': 'OKLCH hue (perceptual spacing)',
      'oklch-lightness': 'OKLCH lightness (keeps brightness)',
    },
    ja: {
      rgb: 'RGB（画面）',
      ryb: 'RYB（画家の色相環）',
      munsell: 'マンセル（JIS）',
      'oklch-hue': 'OKLCH 色相（知覚的な間隔）',
      'oklch-lightness': 'OKLCH 明度（明るさを保持）',
    },
    de: {
      rgb: 'RGB (Bildschirm)',
      ryb: 'RYB (Malerfarbkreis)',
      munsell: 'Munsell (JIS)',
      'oklch-hue': 'OKLCH-Farbton (wahrnehmungsgleiche Abstände)',
      'oklch-lightness': 'OKLCH-Helligkeit (behält die Helligkeit)',
    },
    fr: {
      rgb: 'RVB (écran)',
      ryb: 'RJB (roue des peintres)',
      munsell: 'Munsell (JIS)',
      'oklch-hue': 'Teinte OKLCH (espacement perceptuel)',
      'oklch-lightness': 'Luminosité OKLCH (conserve la luminosité)',
    },
    ko: {
      rgb: 'RGB (화면)',
      ryb: 'RYB (화가의 색상환)',
      munsell: '먼셀 (JIS)',
      'oklch-hue': 'OKLCH 색상 (지각적 간격)',
      'oklch-lightness': 'OKLCH 명도 (밝기 유지)',
    },
    zh: {
      rgb: 'RGB（屏幕）',
      ryb: 'RYB（画家色环）',
      munsell: '孟塞尔（JIS）',
      'oklch-hue': 'OKLCH 色相（感知均匀间距）',
      'oklch-lightness': 'OKLCH 明度（保持亮度）',
    },
  };
  return translations[locale];
}
```

In the locale-object assembly (the block containing `harmonyTypes: buildHarmonyTypes(locale),`), add `colorWheels: buildColorWheels(locale),` on the next line.

- [ ] **Step 4: Add the accessors**

`TranslationProvider.ts`, after `getHarmonyType`:

```ts
  /**
   * Localised display name of a Harmony Explorer colour wheel, with English
   * fallback and finally the id itself, mirroring {@link getHarmonyType}.
   */
  getColorWheelName(id: ColorWheelId, locale: LocaleCode): string {
    const pick = (data: LocaleData | undefined): string | undefined =>
      data?.colorWheels && Object.hasOwn(data.colorWheels, id) ? data.colorWheels[id] : undefined;
    return pick(this.registry.getLocale(locale)) ?? pick(this.registry.getLocale('en')) ?? id;
  }
```

Add `ColorWheelId` (and `LocaleData` if not already) to the file's `@xivdyetools/types` type import. Use whatever the file already calls the registry accessor (`this.registry.getLocale` per line 238).

`LocalizationService.ts`, after the static `getHarmonyType`:

```ts
  /** Localised colour-wheel name (Harmony Explorer wheel selector). */
  getColorWheelName(id: ColorWheelId, locale?: LocaleCode): string {
    return this.translator.getColorWheelName(id, locale ?? this.currentLocale);
  }

  /** Static: see the instance method. */
  static getColorWheelName(id: ColorWheelId, locale?: LocaleCode): string {
    return this.getDefault().getColorWheelName(id, locale);
  }
```

- [ ] **Step 5: Regenerate the locale JSON and run the tests**

Run: `pnpm --filter @xivdyetools/core run build:locales`
Expected: the six JSON files under `packages/core/src/data/locales/` now contain a `colorWheels` block; `git diff --stat packages/core/src/data/locales` shows six files. If the diff also churns `meta.generated`, that is the existing behaviour of the builder — commit it.

Run: `pnpm --filter @xivdyetools/core exec vitest run src/services/__tests__/LocalizationService.test.ts src/services/localization`
Expected: PASS (the loader validation does not require `colorWheels`, so older locale data still loads).

- [ ] **Step 6: Commit**

```bash
git add packages/core/scripts/build-locales.ts packages/core/src/services packages/core/src/data/locales
git commit -m "feat(core): localised colour-wheel names in the shared vocabulary

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

Then rebuild core for the consumers: `pnpm turbo run build --filter=@xivdyetools/core`.

---

### Task 9: Web app — config field, sidebar "Color wheel" select, strings in six locales

**Files:**
- Modify: `apps/web-app/src/shared/tool-config-types.ts` (`HarmonyConfig` ~line 44; defaults block ~line 417)
- Modify: `apps/web-app/src/components/v4/config-sidebar.ts` (state init ~line 145; `renderHarmonyConfig` ~line 900; a `getWheelDescription()` next to `getColorSpaceDescription()` ~line 1486)
- Modify: `apps/web-app/src/services/language-service.ts` (after `getHarmonyType`, ~line 244)
- Modify: `apps/web-app/src/locales/{en,ja,de,fr,ko,zh}.json` (the `config` block, after `"colorSpace"`)
- Test: `apps/web-app/src/components/__tests__/config-sidebar.wheel.test.ts` (create)

**Interfaces:**
- Consumes: `COLOR_WHEEL_IDS`, `DEFAULT_COLOR_WHEEL`, `isColorWheelId`, `type ColorWheelId` from `@xivdyetools/core`; `LocalizationService.getColorWheelName` (Task 8).
- Produces: `HarmonyConfig.wheel: ColorWheelId`; `LanguageService.getColorWheelName(id)`; locale keys `config.colorWheel`, `config.wheelRgbDesc`, `config.wheelRybDesc`, `config.wheelMunsellDesc`, `config.wheelOklchHueDesc`, `config.wheelOklchLightnessDesc`, `config.wheelMunsellTrademark`.

- [ ] **Step 1: Add the strings to all six locale files**

Insert after the `"colorSpace": …` line inside the `config` block of each file (same position in all six — the parity gate checks key sets, and the order gate checks order):

`en.json`:
```json
    "colorWheel": "Color wheel",
    "wheelRgbDesc": "The screen wheel, and also the CMY print wheel — same circle, different names. Today's behavior.",
    "wheelRybDesc": "The painter's wheel the harmony rules were written for. Red's complement is green.",
    "wheelMunsellDesc": "The evenly spaced perceptual hue circle behind Japan's JIS color standard. Red's complement is blue-green.",
    "wheelOklchHueDesc": "The screen wheel re-spaced so equal angles are equal perceived hue steps. Keeps the base's vividness and brightness.",
    "wheelOklchLightnessDesc": "Rotates hue at constant perceived lightness and colorfulness. Partners match the base's brightness; palettes lean toward mid-tones.",
    "wheelMunsellTrademark": "MUNSELL is a registered trademark of Amazys Holding GmbH. This wheel is computed from published renotation data and is not affiliated with or endorsed by X-Rite or Pantone.",
```

`ja.json`:
```json
    "colorWheel": "色相環",
    "wheelRgbDesc": "画面用の色相環で、CMY の印刷用色相環とも同じ円です。従来どおりの動作。",
    "wheelRybDesc": "配色理論の元になった画家の色相環。赤の補色は緑になります。",
    "wheelMunsellDesc": "日本の JIS 色規格の基礎となる、知覚的に等間隔なマンセル色相環。赤の補色は青緑になります。",
    "wheelOklchHueDesc": "等しい角度が等しい知覚的な色相差になるよう配置し直した画面用色相環。基準色の鮮やかさと明るさを保ちます。",
    "wheelOklchLightnessDesc": "知覚的な明度と彩度を一定に保って色相を回転します。相手の色は基準色の明るさに揃い、配色は中間調に寄ります。",
    "wheelMunsellTrademark": "MUNSELL は Amazys Holding GmbH の登録商標です。この色相環は公開されている再表記データから計算したもので、X-Rite および Pantone とは提携・承認関係にありません。",
```

`de.json`:
```json
    "colorWheel": "Farbkreis",
    "wheelRgbDesc": "Der Bildschirm-Farbkreis, zugleich der CMY-Druckfarbkreis – derselbe Kreis, andere Namen. Bisheriges Verhalten.",
    "wheelRybDesc": "Der Malerfarbkreis, für den die Harmonieregeln geschrieben wurden. Die Komplementärfarbe von Rot ist Grün.",
    "wheelMunsellDesc": "Der gleichmäßig geteilte, wahrnehmungsbasierte Farbtonkreis hinter Japans JIS-Farbnorm. Die Komplementärfarbe von Rot ist Blaugrün.",
    "wheelOklchHueDesc": "Der Bildschirm-Farbkreis, neu geteilt, sodass gleiche Winkel gleich große wahrgenommene Farbtonschritte sind. Behält Sättigung und Helligkeit der Basisfarbe.",
    "wheelOklchLightnessDesc": "Dreht den Farbton bei konstanter wahrgenommener Helligkeit und Buntheit. Die Partner passen zur Helligkeit der Basisfarbe; Paletten tendieren zu Mitteltönen.",
    "wheelMunsellTrademark": "MUNSELL ist eine eingetragene Marke der Amazys Holding GmbH. Dieser Farbkreis wird aus veröffentlichten Renotationsdaten berechnet und steht in keiner Verbindung zu X-Rite oder Pantone.",
```

`fr.json`:
```json
    "colorWheel": "Roue chromatique",
    "wheelRgbDesc": "La roue de l'écran, qui est aussi la roue d'impression CMJ : même cercle, autres noms. Comportement actuel.",
    "wheelRybDesc": "La roue des peintres pour laquelle les règles d'harmonie ont été écrites. Le complémentaire du rouge est le vert.",
    "wheelMunsellDesc": "Le cercle de teintes perceptuel à espacement régulier qui fonde la norme japonaise JIS. Le complémentaire du rouge est le bleu-vert.",
    "wheelOklchHueDesc": "La roue de l'écran ré-espacée pour que des angles égaux soient des écarts de teinte perçus égaux. Conserve la vivacité et la luminosité de la couleur de base.",
    "wheelOklchLightnessDesc": "Fait tourner la teinte à luminosité et chromaticité perçues constantes. Les partenaires suivent la luminosité de la base ; les palettes tendent vers les tons moyens.",
    "wheelMunsellTrademark": "MUNSELL est une marque déposée d'Amazys Holding GmbH. Cette roue est calculée à partir des données de renotation publiées et n'est ni affiliée à X-Rite ou Pantone, ni approuvée par eux.",
```

`ko.json`:
```json
    "colorWheel": "색상환",
    "wheelRgbDesc": "화면용 색상환이며 CMY 인쇄 색상환과 같은 원입니다. 지금까지의 동작.",
    "wheelRybDesc": "배색 규칙의 바탕이 된 화가의 색상환. 빨강의 보색은 초록입니다.",
    "wheelMunsellDesc": "일본 JIS 색 규격의 바탕이 되는, 지각적으로 균등한 먼셀 색상환. 빨강의 보색은 청록입니다.",
    "wheelOklchHueDesc": "같은 각도가 같은 지각적 색상 차이가 되도록 다시 배치한 화면용 색상환. 기준색의 선명함과 밝기를 유지합니다.",
    "wheelOklchLightnessDesc": "지각적 명도와 채도를 일정하게 유지하며 색상을 회전합니다. 상대 색은 기준색의 밝기를 따르고, 배색은 중간 톤으로 기웁니다.",
    "wheelMunsellTrademark": "MUNSELL은 Amazys Holding GmbH의 등록 상표입니다. 이 색상환은 공개된 재표기 데이터로 계산한 것이며 X-Rite 또는 Pantone과 제휴하거나 승인을 받은 것이 아닙니다.",
```

`zh.json`:
```json
    "colorWheel": "色环",
    "wheelRgbDesc": "屏幕色环，也就是 CMY 印刷色环——同一个圆，不同的名字。沿用现有行为。",
    "wheelRybDesc": "配色规则最初依据的画家色环。红色的补色是绿色。",
    "wheelMunsellDesc": "日本 JIS 颜色标准所依据的、感知上均匀分布的孟塞尔色相环。红色的补色是蓝绿色。",
    "wheelOklchHueDesc": "重新排布后的屏幕色环，使相等的角度对应相等的感知色相差。保留基准色的鲜艳度和明度。",
    "wheelOklchLightnessDesc": "在感知明度和彩度恒定的情况下旋转色相。搭配色与基准色的明度一致，配色偏向中间调。",
    "wheelMunsellTrademark": "MUNSELL 是 Amazys Holding GmbH 的注册商标。本色环由公开的重标定数据计算得出，与 X-Rite 或 Pantone 无关联，亦未获其认可。",
```

Run the gate now: `pnpm --filter xivdyetools-web-app run validate:i18n`. Expected: no ERROR lines; the only WARNINGs may be identical-to-EN, which do not apply to these strings.

- [ ] **Step 2: Add the config field and default**

`tool-config-types.ts`: add `import type { ColorWheelId } from '@xivdyetools/core';` (or extend the existing core import), and in `HarmonyConfig` after `harmonyType`:

```ts
  /** Colour wheel the harmony angles are measured on (core `ColorWheelId`); default `rgb` */
  wheel: ColorWheelId;
```

In the defaults object (`harmony: { harmonyType: 'complementary', …`), add `wheel: 'rgb',` after `harmonyType`. In `config-sidebar.ts`'s initial `harmonyConfig` state (~line 145), add `wheel: 'rgb',` likewise. Run `pnpm --filter xivdyetools-web-app run type-check` and fix any other object literal typed as `HarmonyConfig` that the compiler now reports (tests included) by adding `wheel: 'rgb'`.

- [ ] **Step 3: Add the LanguageService accessor**

`language-service.ts`, after `getHarmonyType`:

```ts
  /** Localised colour-wheel name, from the core library's shared vocabulary. */
  static getColorWheelName(id: ColorWheelId): string {
    return LocalizationService.getColorWheelName(id);
  }
```

with `import type { ColorWheelId } from '@xivdyetools/core';`.

- [ ] **Step 4: Write the failing sidebar test**

`apps/web-app/src/components/__tests__/config-sidebar.wheel.test.ts`:

```ts
/**
 * The "Color wheel" select renders every wheel core knows, in core's order,
 * and writes the chosen id to the harmony config. The option list comes from
 * COLOR_WHEEL_IDS, so a wheel added in core appears here with no edit.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { COLOR_WHEEL_IDS } from '@xivdyetools/core';
import '@components/v4/config-sidebar';
import { ConfigController } from '@services/config-controller';

describe('config-sidebar colour wheel select', () => {
  let el: HTMLElement & { activeTool: string; updateComplete: Promise<unknown> };

  beforeEach(async () => {
    ConfigController.getInstance().setConfig('harmony', { wheel: 'rgb' });
    el = document.createElement('config-sidebar') as typeof el;
    el.activeTool = 'harmony';
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
  });

  const select = () =>
    el.shadowRoot!.querySelector<HTMLSelectElement>('select[data-config="harmony.wheel"]')!;

  it('lists the wheels in core order with rgb selected by default', () => {
    const options = [...select().options].map((o) => o.value);
    expect(options).toEqual([...COLOR_WHEEL_IDS]);
    expect(select().value).toBe('rgb');
  });

  it('writes the chosen wheel to the harmony config', async () => {
    select().value = 'ryb';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(ConfigController.getInstance().getConfig('harmony').wheel).toBe('ryb');
  });

  it('shows the trademark line only for munsell', async () => {
    const text = () => el.shadowRoot!.textContent ?? '';
    expect(text()).not.toContain('MUNSELL is a registered trademark');
    select().value = 'munsell';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(text()).toContain('MUNSELL is a registered trademark');
  });
});
```

If the sidebar element is registered under a different tag, `grep -n "customElement('" apps/web-app/src/components/v4/config-sidebar.ts` and use that tag; if it needs the `V4LayoutShell` context or mocks that other sidebar tests set up, copy that setup from an existing `config-sidebar*.test.ts` (`ls apps/web-app/src/components/**/__tests__ | grep -i sidebar`).

- [ ] **Step 5: Run to confirm failure**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/config-sidebar.wheel.test.ts`
Expected: FAIL — no `select[data-config="harmony.wheel"]`.

- [ ] **Step 6: Render the select**

In `config-sidebar.ts`, imports: `import { COLOR_WHEEL_IDS, DEFAULT_COLOR_WHEEL, isColorWheelId } from '@xivdyetools/core';` (and `type ColorWheelId`). In `renderHarmonyConfig()`, directly after the harmony-type `</select></div>` block, add:

```ts
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.colorWheel')}</div>
          <select
            class="config-select"
            data-config="harmony.wheel"
            .value=${this.harmonyConfig.wheel ?? DEFAULT_COLOR_WHEEL}
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              this.handleConfigChange('harmony', 'wheel', isColorWheelId(value) ? value : DEFAULT_COLOR_WHEEL);
            }}
          >
            ${COLOR_WHEEL_IDS.map(
              (id) => html`<option value=${id}>${LanguageService.getColorWheelName(id)}</option>`
            )}
          </select>
          <div class="config-description">${this.getWheelDescription()}</div>
          ${
            (this.harmonyConfig.wheel ?? DEFAULT_COLOR_WHEEL) === 'munsell'
              ? html`<div class="config-description">${LanguageService.t('config.wheelMunsellTrademark')}</div>`
              : ''
          }
        </div>
```

Next to `getColorSpaceDescription()`:

```ts
  /** One line per wheel, the Krita pattern: the selected option explains itself. */
  private getWheelDescription(): string {
    switch (this.harmonyConfig.wheel ?? DEFAULT_COLOR_WHEEL) {
      case 'ryb':
        return LanguageService.t('config.wheelRybDesc');
      case 'munsell':
        return LanguageService.t('config.wheelMunsellDesc');
      case 'oklch-hue':
        return LanguageService.t('config.wheelOklchHueDesc');
      case 'oklch-lightness':
        return LanguageService.t('config.wheelOklchLightnessDesc');
      case 'rgb':
      default:
        return LanguageService.t('config.wheelRgbDesc');
    }
  }
```

The sidebar renders inside V4LayoutShell's shadow root: `config-select` and `config-description` are its own classes, so no new CSS is needed.

- [ ] **Step 7: Run the tests and the string lints**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/config-sidebar.wheel.test.ts && pnpm --filter xivdyetools-web-app run lint && pnpm --filter xivdyetools-web-app run validate:i18n`
Expected: PASS; no hard-coded-string lint findings (every visible string goes through `LanguageService`); parity clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web-app/src/shared/tool-config-types.ts apps/web-app/src/components/v4/config-sidebar.ts apps/web-app/src/services/language-service.ts apps/web-app/src/locales apps/web-app/src/components/__tests__/config-sidebar.wheel.test.ts
git commit -m "feat(web-app): Color wheel selector in Harmony settings, six locales

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 10: Web app — harmony tool plumbing, share URL, ring paint and node angles from core

**Files:**
- Modify: `apps/web-app/src/components/v4/v4-color-wheel.ts` (props ~line 60–100; CSS `.harmony-ring` ~line 120; `getHarmonyAngles` ~line 282; `renderConnectionLines` / `renderHarmonyNodes` ~line 392–500; `render` ~line 510)
- Modify: `apps/web-app/src/components/harmony-tool.ts` (fields ~line 163; `handleDeepLink` ~line 435; onMount config read ~line 326 and subscription ~line 340; `generateHarmonies` ~line 1410–1435; `renderColorWheel` ~line 1082; `getShareParams` ~line 1776)
- Modify: `apps/web-app/src/components/__tests__/v4-color-wheel.test.ts` (rewrite)
- Modify: `apps/web-app/src/components/__tests__/harmony-tool.test.ts` (append two tests)

**Interfaces:**
- Consumes: `HarmonySlot.wheelHue`, `getColorWheel(id).ringStops(72)` / `.hueOf(hex)`, `isColorWheelId`, `DEFAULT_COLOR_WHEEL`, `HARMONY_OFFSETS` from `@xivdyetools/core`.
- Produces: `V4ColorWheel.ringStops: string[]`, `V4ColorWheel.nodeAngles: number[]`; `HarmonyTool` share param `wheel` (only when not `rgb`); URL param `wheel=`.

- [ ] **Step 1: Rewrite the wheel component test**

Replace `apps/web-app/src/components/__tests__/v4-color-wheel.test.ts` with:

```ts
/**
 * The ring and the nodes come from core: `ringStops` paints the conic
 * gradient, `nodeAngles` places the base and each slot at its wheel angle.
 * With neither set (the empty state) the component falls back to
 * HARMONY_OFFSETS — the RGB geometry at base 0° — so the placeholder still
 * shows the right formation.
 */
import { describe, it, expect } from 'vitest';
import { HARMONY_OFFSETS } from '@xivdyetools/core';
import '@components/v4/v4-color-wheel';
import type { V4ColorWheel } from '@components/v4/v4-color-wheel';

type Exposed = V4ColorWheel & { angles(): number[]; ringStyle(): string };

function make(props: Partial<V4ColorWheel> = {}): Exposed {
  const el = document.createElement('v4-color-wheel') as Exposed;
  Object.assign(el, props);
  return el;
}

describe('V4ColorWheel angles', () => {
  it.each(Object.entries(HARMONY_OFFSETS))(
    'falls back to core offsets for %s when no node angles are given',
    (type, offsets) => {
      const el = make({ harmonyType: type as V4ColorWheel['harmonyType'] });
      expect(el.angles()).toEqual([0, ...offsets.map((o) => ((o % 360) + 360) % 360)]);
    }
  );

  it('shifts the fallback by the base hue when a base colour is set but no angles are', () => {
    const el = make({ harmonyType: 'complementary', baseColor: '#00FFFF' }); // HSV 180
    expect(el.angles()).toEqual([180, 0]);
  });

  it('uses the given node angles verbatim when present (a warped wheel)', () => {
    const el = make({ harmonyType: 'complementary', baseColor: '#FF0000', nodeAngles: [0, 180] });
    expect(el.angles()).toEqual([0, 180]);
  });

  it('tetradic, inverted-tetradic and square remain distinct formations', () => {
    const a = make({ harmonyType: 'tetradic' }).angles();
    const b = make({ harmonyType: 'inverted-tetradic' }).angles();
    const c = make({ harmonyType: 'square' }).angles();
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a).not.toEqual(c);
  });
});

describe('V4ColorWheel ring', () => {
  it('paints the class default (no inline background) when no stops are given', () => {
    expect(make().ringStyle()).toBe('');
  });

  it('builds a conic gradient from the stops, closing the circle with the first stop', () => {
    const el = make({ ringStops: ['#FF0000', '#00FF00', '#0000FF', '#FF00FF'] });
    expect(el.ringStyle()).toBe(
      'background: conic-gradient(from 0deg, #FF0000 0.00deg, #00FF00 90.00deg, #0000FF 180.00deg, #FF00FF 270.00deg, #FF0000 360deg)'
    );
  });

  it('places the complementary node where the ring is green on an RYB-shaped wheel', async () => {
    // A 4-stop "RYB-ish" ring: green at 180°, not cyan.
    const el = make({
      harmonyType: 'complementary',
      baseColor: '#FF0000',
      harmonyColors: ['#00FF9C'],
      ringStops: ['#FF0000', '#FFFF00', '#00FF9C', '#0000FF'],
      nodeAngles: [0, 180],
    });
    document.body.appendChild(el);
    await el.updateComplete;
    const nodes = el.shadowRoot!.querySelectorAll<HTMLElement>('.harmony-node:not(.main)');
    expect(nodes).toHaveLength(1);
    // hueToPosition(180): top = 50 + 42·sin(90°) = 92%
    expect(nodes[0].style.top).toBe('92%');
    el.remove();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4-color-wheel.test.ts`
Expected: FAIL — `angles is not a function`.

- [ ] **Step 3: Rework the component**

In `v4-color-wheel.ts`:

1. Import: `import { HARMONY_OFFSETS } from '@xivdyetools/core';`
2. Add two properties after `harmonyDyes`:
   ```ts
     /**
      * Ring paint: evenly spaced in-gamut hex stops from `getColorWheel(id).ringStops(n)`.
      * Empty → the class's plain sRGB gradient (empty state / legacy callers).
      */
     @property({ attribute: false })
     ringStops: string[] = [];

     /**
      * Node angles on the ring: the base first, then one per harmony slot
      * (`HarmonySlot.wheelHue`). Empty → derived from HARMONY_OFFSETS, which is
      * only right on the RGB wheel — fine for the empty state, never for a
      * warped wheel, so the tool always passes them once a dye is chosen.
      */
     @property({ attribute: false })
     nodeAngles: number[] = [];
   ```
3. Delete the private `getHarmonyAngles()` switch and add:
   ```ts
     /** The formation on the RGB wheel, from core's table, at base 0°. */
     private defaultAngles(): number[] {
       const offsets = HARMONY_OFFSETS[this.harmonyType] ?? [];
       return [0, ...offsets.map((o) => ((o % 360) + 360) % 360)];
     }

     /** Absolute node angles: the tool's `wheelHue`s when given, else RGB defaults shifted to the base hue. */
     angles(): number[] {
       if (this.nodeAngles.length > 0) return this.nodeAngles;
       const shift = this.baseColor ? this.hexToHue(this.baseColor) : 0;
       return this.defaultAngles().map((a) => (a + shift) % 360);
     }

     /** Inline background for the ring, or '' to keep the class default. */
     ringStyle(): string {
       const n = this.ringStops.length;
       if (n === 0) return '';
       const stops = this.ringStops.map((hex, i) => `${hex} ${((i * 360) / n).toFixed(2)}deg`);
       return `background: conic-gradient(from 0deg, ${stops.join(', ')}, ${this.ringStops[0]} 360deg)`;
     }
   ```
   (`HARMONY_OFFSETS['monochromatic']` is `[0]`, so the monochromatic pair `[0, 0]` still shares its spoke and the existing `depthFor` staggers it.)
4. `renderConnectionLines()`: both branches use `this.angles()` directly — `angles.map((angle) => rotate(angle - 90))`; delete the `baseHue + offset` arithmetic.
5. `renderHarmonyNodes()`: `const angles = this.angles();` empty branch unchanged but over `angles`; non-empty branch: `const baseAngle = angles[0]; const basePos = this.hueToPosition(baseAngle, depthFor(baseAngle));` and `@click=${() => this.handleNodeClick(this.baseColor, baseAngle)}`; then `angles.slice(1).forEach((angle, index) => { const pos = this.hueToPosition(angle, depthFor(angle)); … @click=${() => this.handleNodeClick(color, angle)} })`.
6. `render()`: `<div class="harmony-ring" style=${this.ringStyle()}></div>`.
7. Keep `hexToHue` (used by the fallback) and the `.harmony-ring` class CSS as the default paint.

- [ ] **Step 4: Run the component test**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4-color-wheel.test.ts`
Expected: PASS. If the `top: 92%` assertion fails by a rounding hair, read the actual value and match `hueToPosition`'s arithmetic exactly; do not change the geometry.

- [ ] **Step 5: Write the failing harmony-tool tests**

Append to `harmony-tool.test.ts`, inside its main `describe`, using the file's existing `createTestContainer` / mount pattern (copy the `beforeEach` the other tests use to get a mounted `tool`):

```ts
  describe('colour wheel', () => {
    it('omits wheel from share params on the default and includes it otherwise', () => {
      const tool = mountTool(); // the helper the surrounding tests use to mount HarmonyTool with a selected dye
      const params = () =>
        (tool as unknown as { getShareParams(): Record<string, unknown> }).getShareParams();
      expect(params()).not.toHaveProperty('wheel');
      ConfigController.getInstance().setConfig('harmony', { wheel: 'ryb' });
      expect(params().wheel).toBe('ryb');
      ConfigController.getInstance().setConfig('harmony', { wheel: 'rgb' });
      expect(params()).not.toHaveProperty('wheel');
    });

    it('reads ?wheel= from a share URL, normalising unknown values to rgb', () => {
      window.history.replaceState({}, '', '/harmony?dye=5771&harmony=complementary&wheel=MUNSELL');
      mountTool();
      expect(ConfigController.getInstance().getConfig('harmony').wheel).toBe('munsell');

      window.history.replaceState({}, '', '/harmony?dye=5771&harmony=complementary&wheel=cmyk');
      mountTool();
      expect(ConfigController.getInstance().getConfig('harmony').wheel).toBe('rgb');
      window.history.replaceState({}, '', '/');
    });

    it('feeds the ring 72 stops and one node angle per slot plus the base', () => {
      ConfigController.getInstance().setConfig('harmony', { wheel: 'ryb', harmonyType: 'triadic' });
      const tool = mountTool();
      const wheel = tool.container.querySelector('v4-color-wheel') as unknown as {
        ringStops: string[];
        nodeAngles: number[];
      };
      expect(wheel.ringStops).toHaveLength(72);
      expect(wheel.nodeAngles).toHaveLength(3);
      // RYB: the two triadic partners of a red base do NOT sit 120° apart in sRGB terms,
      // but on the wheel they do — nodeAngles are wheel angles.
      const [b, n1, n2] = wheel.nodeAngles;
      expect(((n1 - b + 360) % 360)).toBeCloseTo(120, 6);
      expect(((n2 - b + 360) % 360)).toBeCloseTo(240, 6);
    });
  });
```

Replace `mountTool()` with the file's real mount helper name and `tool.container` with however the file reaches the tool's root element (read the first passing test in the file and mirror it exactly). Import `ConfigController` from `@services/config-controller` if the file does not already.

- [ ] **Step 6: Run to confirm failure**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/harmony-tool.test.ts -t "colour wheel"`
Expected: FAIL on all three.

- [ ] **Step 7: Plumb the wheel through the tool**

In `harmony-tool.ts`:

1. Imports from `@xivdyetools/core`: add `DEFAULT_COLOR_WHEEL, getColorWheel, isColorWheelId` and `type ColorWheelId`.
2. Field next to `matchingMethod`:
   ```ts
     private wheel: ColorWheelId = DEFAULT_COLOR_WHEEL;
     /** Wheel angles the ring draws: the base first, then each slot's `wheelHue`. */
     private slotAngles: number[] = [];
   ```
3. onMount config read (next to `this.matchingMethod = …`):
   ```ts
       this.wheel = isColorWheelId(harmonyConfig.wheel) ? harmonyConfig.wheel : DEFAULT_COLOR_WHEEL;
   ```
4. Subscription: extend `algorithmChanged` with
   ```ts
           (config.wheel !== undefined && this.wheel !== config.wheel) ||
   ```
   and after `this.preventDuplicates = …` add
   ```ts
           this.wheel = isColorWheelId(config.wheel) ? config.wheel : DEFAULT_COLOR_WHEEL;
   ```
5. `handleDeepLink`: read `const wheelParam = params.get('wheel');` (log it with the others) and after the perceptual block:
   ```ts
       // Which wheel the palette was generated on travels with the link — a card
       // that ignored it would show dyes the page never shows (45% of palettes).
       if (wheelParam !== null) {
         const normalised = wheelParam.toLowerCase();
         const wheel = isColorWheelId(normalised) ? normalised : DEFAULT_COLOR_WHEEL;
         if (wheel !== normalised) logger.warn(`[HarmonyTool] Unknown colour wheel in URL: ${wheelParam}`);
         this.wheel = wheel;
         configController.setConfig('harmony', { wheel });
       }
   ```
6. `generateHarmonies`: add `wheel: this.wheel,` to `selectionConfig`; after `const slots = generateHarmonySlots(…)`:
   ```ts
       this.slotAngles = [getColorWheel(this.wheel).hueOf(this.selectedDye.hex), ...slots.map((s) => s.wheelHue)];
   ```
7. `renderColorWheel`: after `wheel.harmonyDyes = matchedDyes;`:
   ```ts
         wheel.ringStops = [...getColorWheel(this.wheel).ringStops(72)];
         wheel.nodeAngles = this.slotAngles;
   ```
   (In the empty-state branch leave both unset so the component falls back.)
8. `getShareParams`: spread `...(this.wheel !== DEFAULT_COLOR_WHEEL ? { wheel: this.wheel } : {})` into the returned object.
9. `setConfig(config)`: if the method's parameter type is a closed literal, add `wheel?: ColorWheelId` and log it like `strictMatching` (the subscription does the work).

- [ ] **Step 8: Run the web-app suites and gates**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/harmony-tool.test.ts src/components/__tests__/v4-color-wheel.test.ts && pnpm turbo run lint type-check test --filter=xivdyetools-web-app`
Expected: PASS. Then the size gate: `pnpm --filter xivdyetools-web-app run build` — expected within budget (the new core code is a few KB; the Munsell JSON is ~3 KB).

- [ ] **Step 9: Look at it once**

Run `pnpm --filter xivdyetools-web-app run dev`, open `http://localhost:5173/harmony?dye=5771&harmony=complementary&wheel=ryb`, and confirm: the ring's 180° point is green, not cyan; the complementary node sits on that green; switching the sidebar's Color wheel to `OKLCH lightness` re-paints the ring with a visibly even, in-gamut band and changes the dyes; switching back to RGB restores today's picture. Stop the dev server.

- [ ] **Step 10: Commit**

```bash
git add apps/web-app/src/components/harmony-tool.ts apps/web-app/src/components/v4/v4-color-wheel.ts apps/web-app/src/components/__tests__/v4-color-wheel.test.ts apps/web-app/src/components/__tests__/harmony-tool.test.ts
git commit -m "feat(web-app): harmony ring and nodes drawn from the selected core wheel; wheel in share URLs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 11: Discord — card token in `@xivdyetools/svg`, `wheel` through bot-logic, slash-command option and handler

**Files:**
- Modify: `packages/svg/src/harmony-card.ts` (`HarmonyCardOptions` ~line 92–120; header block ~line 166–176)
- Create: `packages/svg/src/harmony-card.wheel.test.ts`
- Modify: `packages/bot-logic/src/localization.ts` (after `getLocalizedHarmonyType`, ~line 131)
- Modify: `packages/bot-logic/src/commands/harmony.ts` (`HarmonyInput` ~line 73; `executeHarmony` destructuring ~line 158; the `generateHarmonySlots` call ~line 203; card options ~line 298; share URL ~line 321)
- Modify: `packages/bot-logic/src/commands/harmony.test.ts` (append)
- Modify: `apps/discord-worker/src/commands/schemas.ts` (imports ~line 10; after `HARMONY_TYPE_CHOICES` ~line 44; the `harmony` command's options after `type`, ~line 153)
- Modify: `apps/discord-worker/src/handlers/commands/harmony.ts` (imports ~line 8; option parsing ~line 33–46; `processHarmonyCommand` signature ~line 101 and call ~line 78; `executeHarmony` call ~line 120)
- Modify: `apps/discord-worker/src/handlers/commands/harmony.test.ts` (append)

**Interfaces:**
- Consumes: `generateHarmonySlots(…, { wheel })`, `COLOR_WHEEL_IDS`, `DEFAULT_COLOR_WHEEL`, `isColorWheelId`, `LocalizationService.getColorWheelName` from core (Tasks 7–8).
- Produces: `HarmonyCardOptions.wheelLabel?: string | null`; `HarmonyInput.wheel?: ColorWheelId`; bot-logic `getLocalizedColorWheelName(id, locale)`; Discord option `wheel` with `COLOR_WHEEL_CHOICES`.

Analytics: none. Tier A logs command + outcome only and never option values; nothing changes here.

- [ ] **Step 1: Rebuild core so the consumers see it, then write the failing svg test**

Run: `pnpm turbo run build --filter=@xivdyetools/core`

`packages/svg/src/harmony-card.wheel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateHarmonyCard, type HarmonyCardOptions } from './harmony-card.js';

const base: HarmonyCardOptions = {
  typeLabel: 'Complementary',
  baseHex: '#B02020',
  baseName: 'Dalamud Red',
  slots: [
    {
      idealHex: '#20B0B0',
      hex: '#1E9E9E',
      localizedName: 'Turquoise Green',
      subText: '#1E9E9E · Stain 42',
      deltaE: 4.2,
      angleLabel: '180°',
    },
  ],
  labels: { base: 'BASE', ideal: 'IDEAL HUE', found: 'NEAREST DYE', bandKey: 'KEY', derivedNote: null },
  tierWords: ['EXACT', 'CLOSE', 'LOOSE', 'UNREACHABLE'],
  lang: 'en',
};

describe('harmony card wheel token', () => {
  it('prints nothing extra on the default wheel', () => {
    const svg = generateHarmonyCard(base);
    expect(svg).not.toContain('RYB');
  });

  it('prints the wheel name, uppercased, under the harmony type when given', () => {
    const svg = generateHarmonyCard({ ...base, wheelLabel: "RYB (artist's)" });
    expect(svg).toContain('RYB (ARTIST&#39;S)');
  });
});
```

Adjust the escaped apostrophe to whatever `cardText` emits for `'` (see `base-escape.test.ts`); the point is that the label is present and uppercased.

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/svg exec vitest run src/harmony-card.wheel.test.ts`
Expected: FAIL — the second test (no wheel token rendered; TypeScript may also reject `wheelLabel`).

- [ ] **Step 3: Add the token to the card**

`harmony-card.ts` — in `HarmonyCardOptions` after `typeLabel`:

```ts
  /**
   * Localised name of a NON-default colour wheel, printed under the harmony
   * type so two players comparing cards can see why their dyes differ. Null or
   * absent (the RGB wheel) prints nothing — the default stays invisible.
   */
  wheelLabel?: string | null;
```

In the generator, after the `typeLabel` `cardText(…)` push:

```ts
  if (options.wheelLabel) {
    parts.push(
      cardText(CARD_WIDTH - PAD_X, 14 + 15 + 12, options.wheelLabel.toUpperCase(), {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
        letterSpacing: 1.1,
        anchor: 'end',
      })
    );
  }
```

The base block starts at y = 46; the token's baseline is 41 with an 11 px face, so it clears the swatch. Prove it by rendering, not by reading the string: `pnpm --filter @xivdyetools/svg exec vitest run src/frame-budget.test.ts src/harmony-card.wheel.test.ts` and, once bot-logic is wired (Step 8), a real PNG.

- [ ] **Step 4: Run the svg tests, bump nothing yet, commit**

Run: `pnpm turbo run test lint type-check --filter=@xivdyetools/svg`
Expected: PASS.

```bash
git add packages/svg/src/harmony-card.ts packages/svg/src/harmony-card.wheel.test.ts
git commit -m "feat(svg): optional wheel token on the harmony card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

Then `pnpm turbo run build --filter=@xivdyetools/svg`.

- [ ] **Step 5: Write the failing bot-logic tests**

Append to `packages/bot-logic/src/commands/harmony.test.ts`:

```ts
describe('colour wheel', () => {
  const run = (wheel?: 'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness') =>
    executeHarmony({ baseHex: '#B02020', baseName: 'Dalamud Red', harmonyType: 'complementary', locale: 'en', wheel });

  it('defaults to RGB: no wheel in the share URL and no token on the card', async () => {
    const r = await run();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.embed.description).not.toContain('wheel=');
    expect(r.svgString).not.toContain('RYB');
  });

  it('passes wheel=ryb through: different dyes, token on the card, wheel in the share URL', async () => {
    const rgb = await run('rgb');
    const ryb = await run('ryb');
    expect(rgb.ok && ryb.ok).toBe(true);
    if (!rgb.ok || !ryb.ok) return;
    expect(ryb.harmonyDyes[0]?.itemID).not.toBe(rgb.harmonyDyes[0]?.itemID);
    expect(ryb.svgString).toContain('RYB');
    expect(ryb.embed.description).toContain('&wheel=ryb');
    expect(rgb.embed.description).not.toContain('wheel=');
  });

  it('localises the token', async () => {
    const r = await executeHarmony({ baseHex: '#B02020', harmonyType: 'triadic', locale: 'ja', wheel: 'munsell' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.svgString).toContain('マンセル');
  });
});
```

The share-URL assertion needs a base with a stainID; if `#B02020` does not resolve to a dye in this harness, pass `baseId`/`baseItemID` the way the file's other `executeHarmony` tests do, or assert on a run that uses a real dye hex from `dyeService.getAllDyes()[0]`.

- [ ] **Step 6: Run to confirm failure**

Run: `pnpm --filter @xivdyetools/bot-logic exec vitest run src/commands/harmony.test.ts -t "colour wheel"`
Expected: FAIL (TypeScript: `wheel` not in `HarmonyInput`; or runtime: token absent).

- [ ] **Step 7: Wire bot-logic**

`packages/bot-logic/src/localization.ts`, after `getLocalizedHarmonyType`:

```ts
/** Localised colour-wheel name from core's shared vocabulary; the id if the locale is not loaded. */
export function getLocalizedColorWheelName(id: ColorWheelId, locale: LocaleCode = 'en'): string {
  try {
    const instance = localeInstances.get(locale);
    if (!instance) return id;
    return instance.getColorWheelName(id);
  } catch {
    return id;
  }
}
```

(`import type { ColorWheelId } from '@xivdyetools/core';`.)

`packages/bot-logic/src/commands/harmony.ts`:

1. Imports: add `DEFAULT_COLOR_WHEEL` to the `@xivdyetools/core` value import, `type ColorWheelId` to the type import, and `getLocalizedColorWheelName` to the `../localization.js` import.
2. `HarmonyInput`: after `harmonyType`:
   ```ts
     /** Colour wheel the offsets are measured on (core `ColorWheelId`). Default `rgb`. */
     wheel?: ColorWheelId;
   ```
   and on `harmonyOptions` add `@deprecated Ignored since PR #159; the wheel is `wheel`.` to its JSDoc (keep the field — bot-logic is published).
3. In `executeHarmony`'s destructuring add `wheel = DEFAULT_COLOR_WHEEL,`.
4. In the `generateHarmonySlots` config object add `wheel,`.
5. Card options: add `wheelLabel: wheel === DEFAULT_COLOR_WHEEL ? null : getLocalizedColorWheelName(wheel, locale),` after `typeLabel`.
6. Share URL:
   ```ts
       const wheelParam = wheel === DEFAULT_COLOR_WHEEL ? '' : `&wheel=${wheel}`;
       const shareUrl =
         baseDye?.stainID != null
           ? `https://xivdyetools.app/harmony?dye=${baseDye.stainID}&harmony=${harmonyType}${wheelParam}`
           : 'https://xivdyetools.app/harmony';
   ```

- [ ] **Step 8: Run bot-logic gates and render one card**

Run: `pnpm turbo run test lint type-check --filter=@xivdyetools/bot-logic`
Expected: PASS, including `locale-orphans.test.ts` (no bot locale keys were added; the token comes from core).

Render proof: from `apps/discord-worker`, the existing render harness (`grep -rn "renderSvgToPng\|resvg" apps/discord-worker/src/services/svg/renderer.ts`) — run a one-off script or the renderer test with `wheelLabel: 'RYB (artist\'s)'` and open the PNG; the token must sit right-aligned under the harmony type and clear the base swatch. Then `pnpm turbo run build --filter=@xivdyetools/bot-logic`.

Commit:

```bash
git add packages/bot-logic/src
git commit -m "feat(bot-logic): /harmony takes a colour wheel; card token and share URL carry it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

- [ ] **Step 9: Write the failing discord-worker test**

Append to `apps/discord-worker/src/handlers/commands/harmony.test.ts`, inside the describe that owns the `interaction`/`env`/`ctx` fixtures (~line 165):

```ts
  describe('wheel option', () => {
    const svg = () => import('@xivdyetools/svg').then((m) => m.generateHarmonyCard as unknown as ReturnType<typeof vi.fn>);

    it('names the wheel on the card when given', async () => {
      const mock = await svg();
      mock.mockClear();
      const withWheel = {
        ...interaction,
        data: { options: [{ name: 'color', value: 'red' }, { name: 'wheel', value: 'ryb' }] },
      } as unknown as DiscordInteraction;
      await handleHarmonyCommand(withWheel, env, ctx);
      await flush(); // the file's helper that awaits ctx.waitUntil work; use its real name
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({ wheelLabel: expect.stringMatching(/RYB/) }));
    });

    it('prints no token on the default and ignores an invalid wheel value', async () => {
      const mock = await svg();
      for (const options of [
        [{ name: 'color', value: 'red' }],
        [{ name: 'color', value: 'red' }, { name: 'wheel', value: 'cmyk' }],
      ]) {
        mock.mockClear();
        const i = { ...interaction, data: { options } } as unknown as DiscordInteraction;
        await handleHarmonyCommand(i, env, ctx);
        await flush();
        expect(mock).toHaveBeenCalledWith(expect.objectContaining({ wheelLabel: null }));
      }
    });
  });
```

Use the file's existing way of awaiting the deferred work (look for how other tests observe `generateHarmonyCard` after `ctx.waitUntil`).

- [ ] **Step 10: Run to confirm failure**

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/handlers/commands/harmony.test.ts -t "wheel option"`
Expected: FAIL — `wheelLabel` never passed.

- [ ] **Step 11: Schema and handler**

`apps/discord-worker/src/commands/schemas.ts`:

```ts
import { COLOR_WHEEL_IDS, type ColorWheelId } from '@xivdyetools/core';

/**
 * English choice names for `/harmony wheel`, typed against core's id union so
 * a wheel added in core without a label here is a compile error. Localised
 * names on the card come from core (`getColorWheelName`); Discord choice
 * names follow the English-only convention `matching` already uses.
 */
const COLOR_WHEEL_LABELS: Record<ColorWheelId, string> = {
  rgb: 'RGB (screen) — default',
  ryb: "RYB (artist's wheel)",
  munsell: 'Munsell (JIS)',
  'oklch-hue': 'OKLCH hue (perceptual spacing)',
  'oklch-lightness': 'OKLCH lightness (keeps brightness)',
};

/** Derived from core's list so it cannot go stale. */
const COLOR_WHEEL_CHOICES: ReadonlyArray<{ name: string; value: ColorWheelId }> = COLOR_WHEEL_IDS.map(
  (value) => ({ name: COLOR_WHEEL_LABELS[value], value })
);
```

and in the `harmony` command's `options`, after the `type` option:

```ts
      {
        name: 'wheel',
        description: 'Colour wheel the harmony angles are measured on (default: RGB)',
        type: OptionType.STRING,
        required: false,
        choices: COLOR_WHEEL_CHOICES,
      },
```

`apps/discord-worker/src/handlers/commands/harmony.ts`:

1. Replace `import type { HarmonyColorSpace, MatchingMethod } from '@xivdyetools/core';` with `import { isColorWheelId, type ColorWheelId, type MatchingMethod } from '@xivdyetools/core';`.
2. Delete `colorSpaceOption`, `colorSpace`, and `const harmonyOptions = colorSpace ? { colorSpace } : undefined;`. Add:
   ```ts
     const wheelOption = options.find((opt) => opt.name === 'wheel');
     // Validated here so a stale registered choice can never reach the selector as a string.
     const wheel: ColorWheelId | undefined = isColorWheelId(wheelOption?.value) ? wheelOption.value : undefined;
   ```
3. In the `processHarmonyCommand(...)` call, replace the `harmonyOptions` argument with `wheel`; in the function signature replace `harmonyOptions?: { colorSpace?: HarmonyColorSpace }` with `wheel?: ColorWheelId`; in the `executeHarmony({ … })` call replace `harmonyOptions,` with `wheel,`.

- [ ] **Step 12: Run discord-worker gates**

Run: `pnpm turbo run test lint type-check --filter=xivdyetools-discord-worker`
Expected: PASS. Also confirm the schema test that checks option counts (if any, `grep -rn "options).toHaveLength" apps/discord-worker/src/commands`) is updated for the new option.

Registration note for the PR body: the new option reaches Discord only after `pnpm --filter xivdyetools-discord-worker run register-commands` is run against the target application after deploy (the maintainer's step, per the existing release checklist).

- [ ] **Step 13: Commit**

```bash
git add apps/discord-worker/src
git commit -m "feat(discord-worker): /harmony wheel option derived from core; drop dead color_space plumbing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 12: OG worker — allowlisted `wheel` query, cache key, harmony route, embed URLs, deck token

**Files:**
- Modify: `apps/og-worker/src/types.ts` (`HarmonyParams` ~line 81)
- Modify: `apps/og-worker/src/og-params.ts` (after `parseAlgo`, ~line 108)
- Modify: `apps/og-worker/src/index.ts` (`OG_ALLOWED_QUERY_KEYS` ~line 207; the `/og/*` guard ~line 257; `ogCacheKey` ~line 315; the harmony route ~line 708–745)
- Modify: `apps/og-worker/src/services/translator.ts` (after `getLocalizedHarmonyName`, ~line 46)
- Modify: `apps/og-worker/src/services/svg/harmony.ts` (`HarmonyOGOptions` ~line 15; `getHarmonyMatches` ~line 68; `generateHarmonyOG` deck ~line 172)
- Modify: `apps/og-worker/src/og-data-generator.ts` (`withAlgo` neighbourhood ~line 91; `generateHarmonyOGData` ~line 234–266; `case 'harmony'` ~line 791)
- Modify tests: `apps/og-worker/src/index.test.ts`, `apps/og-worker/src/og-data-generator.test.ts`, `apps/og-worker/src/services/svg/harmony.test.ts`

**Interfaces:**
- Consumes: `isColorWheelId`, `DEFAULT_COLOR_WHEEL`, `type ColorWheelId`, `generateHarmonySlots(…, { wheel })`, `TranslationProvider.getColorWheelName`.
- Produces: `parseWheel(raw: string | null): ColorWheelId | undefined`; `HarmonyParams.wheel?`; `HarmonyOGOptions.wheel?`; `getLocalizedColorWheelName(id, locale)`.

Cache-key ruling to record in the PR: `wheel` is a validated five-value enum, the same class as `algo` (six values) and `mode`; the default is elided from the key so `wheel=rgb` and absent share one entry. Unlike `perceptual`, it cannot be defaulted away — a card that ignored it would show dyes the page it opens never shows.

- [ ] **Step 1: Write the failing tests**

`index.test.ts`, next to the `?mode=` describe:

```ts
  describe('?wheel= (the Harmony Explorer\'s colour wheel)', () => {
    it.each(['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'])('renders for wheel=%s', async (wheel) => {
      const res = await app.request(`/og/harmony/43/complementary?wheel=${wheel}`, {}, TEST_ENV);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
    });

    it('rejects an unknown wheel without echoing it back', async () => {
      const res = await app.request('/og/harmony/43/complementary?wheel=cmyk', {}, TEST_ENV);
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Invalid color wheel');
      expect(JSON.stringify(body)).not.toContain('cmyk');
    });

    it('treats an empty wheel as absent, like algo', async () => {
      const res = await app.request('/og/harmony/43/complementary?wheel=', {}, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it('is an allowed key on every /og/* route, like mode', async () => {
      const res = await app.request('/og/gradient/43/44/5?wheel=ryb', {}, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it('keys the edge cache on the wheel, with the default elided', () => {
      // Whatever helper the file already uses to read the canonical cache key for a request
      // (look for the `?mode=` cache-key assertion and mirror it): rgb and absent produce the
      // same key; ryb produces a different one.
    });
  });
```

For the last test, find the existing cache-key assertion for `mode` in this file (`grep -n "cacheKey\|caches" apps/og-worker/src/index.test.ts`) and copy its mechanism; the expectations are: key(`?wheel=rgb`) === key(no query), key(`?wheel=ryb`) !== key(no query).

`og-data-generator.test.ts`, inside `describe('generateHarmonyOGData')`:

```ts
    it('carries a non-default wheel into both the page URL and the image URL', () => {
      const r = generateHarmonyOGData({ dye: 43, harmony: 'complementary', wheel: 'ryb' }, mockEnv);
      expect(r.url).toContain('wheel=ryb');
      expect(r.imageUrl).toContain('wheel=ryb');
    });

    it('omits the default wheel from both URLs', () => {
      const r = generateHarmonyOGData({ dye: 43, harmony: 'complementary', wheel: 'rgb' }, mockEnv);
      expect(r.url).not.toContain('wheel=');
      expect(r.imageUrl).not.toContain('wheel=');
    });

    it('parses ?wheel= from a page share URL through generateOGDataForTool', async () => {
      const params = new URLSearchParams('dye=43&harmony=complementary&wheel=munsell');
      const r = await generateOGDataForTool('harmony' as ToolId, params, mockEnv, 'en');
      expect(r.imageUrl).toContain('wheel=munsell');
    });
```

`services/svg/harmony.test.ts`:

```ts
  it('names a non-default wheel in the deck and changes the matches', () => {
    const rgb = generateHarmonyOG({ dyeId: 43, harmonyType: 'complementary' });
    const ryb = generateHarmonyOG({ dyeId: 43, harmonyType: 'complementary', wheel: 'ryb' });
    expect(ryb).toContain('RYB');
    expect(rgb).not.toContain('RYB');
    expect(ryb).not.toBe(rgb);
  });
```

(`generateHarmonyOG` is imported the way the file already imports it; dye 43 is Mud Green, a saturated enough base that RGB and RYB differ.)

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter xivdyetools-og-worker exec vitest run src/index.test.ts src/og-data-generator.test.ts src/services/svg/harmony.test.ts`
Expected: the new tests FAIL (404 "Unknown query parameter" for `wheel`, missing `wheel` in URLs, no deck token).

- [ ] **Step 3: Types, params, translator**

`types.ts`: add `import type { ColorWheelId } from '@xivdyetools/core';` and `wheel?: ColorWheelId;` to `HarmonyParams`.

`og-params.ts`, after `parseAlgo`:

```ts
/** `?wheel=` → a core wheel id, or undefined for absent/empty/unknown (the guard already 400s unknown). */
export function parseWheel(raw: string | null): ColorWheelId | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  return isColorWheelId(v) ? v : undefined;
}
```

with `import { isColorWheelId, type ColorWheelId } from '@xivdyetools/core';`.

`services/translator.ts`, after `getLocalizedHarmonyName`:

```ts
/** Localised colour-wheel name, the same core key the web app and the bot print. */
export function getLocalizedColorWheelName(id: ColorWheelId, locale: LocaleCode): string {
  return ogTranslator.getColorWheelName(id, locale);
}
```

- [ ] **Step 4: Guard, cache key, route**

`index.ts`:

1. `const OG_ALLOWED_QUERY_KEYS = new Set(['lang', 'frame', 'algo', 'mode', 'wheel']);`
2. In the `/og/*` guard, after the `mode` check:
   ```ts
     // `wheel` picks the harmony card's GEOMETRY — five validated ids, the same
     // class as `algo`; an unknown value is a malformed request, never echoed.
     const wheel = searchParams.get('wheel');
     if (wheel && !isColorWheelId(wheel)) {
       return c.json({ error: 'Invalid color wheel' }, 400);
     }
   ```
   (`import { DEFAULT_COLOR_WHEEL, isColorWheelId } from '@xivdyetools/core';` — extend the existing core import.)
3. In `ogCacheKey`, after the `mode` block:
   ```ts
     // The default is elided so `wheel=rgb` and absent share one cache entry —
     // the same rule `withMode` applies to `ryb` and `withAlgo` to ΔE2000.
     const wheel = url.searchParams.get('wheel');
     if (wheel && wheel !== DEFAULT_COLOR_WHEEL) {
       params.set('wheel', wheel);
     }
   ```
4. Harmony route: `const wheel = parseWheel(c.req.query('wheel') ?? null);` (import `parseWheel` from `./og-params`) and pass `wheel,` into `generateHarmonyOG({ … })`.

- [ ] **Step 5: The card**

`services/svg/harmony.ts`:

1. `HarmonyOGOptions`: add `/** Colour wheel the offsets are measured on; default rgb */ wheel?: ColorWheelId;`.
2. `getHarmonyMatches(dye, harmonyType, algorithm = DEFAULT_MATCHING_METHOD, wheel: ColorWheelId = DEFAULT_COLOR_WHEEL)`: add `wheel,` to the `generateHarmonySlots` config object.
3. In `generateHarmonyOG`: destructure `wheel = DEFAULT_COLOR_WHEEL`; call `getHarmonyMatches(dye, harmonyType, algorithm, wheel)`; deck:
   ```ts
       deck:
         wheel === DEFAULT_COLOR_WHEEL
           ? `${baseName} · ${harmonyName}`
           : `${baseName} · ${harmonyName} · ${getLocalizedColorWheelName(wheel, locale)}`,
   ```
   Imports: `DEFAULT_COLOR_WHEEL`, `type ColorWheelId` from core; `getLocalizedColorWheelName` from `../translator`.

- [ ] **Step 6: Embed URLs**

`og-data-generator.ts`:

1. Next to `withAlgo`:
   ```ts
   /** Append a non-default colour wheel to an emitted URL; absent and `rgb` stay off it. */
   function withWheel(url: string, wheel: ColorWheelId | undefined): string {
     if (!wheel || wheel === DEFAULT_COLOR_WHEEL) return url;
     return `${url}${url.includes('?') ? '&' : '?'}wheel=${wheel}`;
   }
   ```
2. In `generateHarmonyOGData`, the page URL becomes
   ```ts
       url: appUrl(
         withWheel(`${env.APP_BASE_URL}/harmony/?dye=${params.dye}&harmony=${encodeURIComponent(params.harmony)}`, params.wheel) + '&v=1',
         locale,
         params.algo
       ),
   ```
   and the image URL `withLang(withWheel(withAlgo(\`…/harmony/${params.dye}/${encodeURIComponent(params.harmony)}.png\`, params.algo), params.wheel), locale)`.
3. In `case 'harmony'` of `generateOGDataForTool`, add `wheel: parseWheel(searchParams.get('wheel')),` (import `parseWheel` from `./og-params`).

- [ ] **Step 7: Run og-worker gates**

Run: `pnpm turbo run test lint type-check --filter=xivdyetools-og-worker`
Expected: PASS, including the FINDING-024 allowlist tests already in `index.test.ts` and `og-guards.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add apps/og-worker/src
git commit -m "feat(og-worker): harmony card honours ?wheel= (allowlisted, cache-keyed, default elided)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
```

---

### Task 13: Versions, changelogs, whole-tree gates, PR

**Files:**
- Modify: `packages/types/package.json` (3.1.0 → 3.2.0), `packages/core/package.json` (5.1.0 → 5.2.0), `packages/svg/package.json` (4.0.0 → 4.1.0), `packages/bot-logic/package.json` (4.1.0 → 4.2.0), `apps/web-app/package.json` (5.6.1 → 5.7.0), `apps/discord-worker/package.json` (5.4.0 → 5.5.0), `apps/og-worker/package.json` (2.9.0 → 2.10.0; `CARD_VERSION` follows it and retires cached cards)
- Modify: each of those packages' `CHANGELOG.md` (new top section)
- Modify: `CHANGELOG-laymans.md` (root), `apps/web-app/CHANGELOG-laymans.md`, `apps/discord-worker/CHANGELOG-laymans.md`
- Modify: `docs/superpowers/specs/2026-09-04-harmony-color-wheels-design.md` header `Status:` → `implemented <date> (this plan)`

- [ ] **Step 1: Bump versions**

Edit the seven `package.json` `version` fields to the values above. Workspace deps use `workspace:*`, so nothing else changes.

- [ ] **Step 2: Package changelogs (Keep a Changelog style, match each file's existing voice)**

`packages/core/CHANGELOG.md` — `## [5.2.0] - <date>` / `### Added`:
- `COLOR_WHEEL_IDS`, `DEFAULT_COLOR_WHEEL`, `isColorWheelId`, `getColorWheel`, `ColorWheel`, `ColorWheelId`: five selectable harmony colour wheels (`rgb`, `ryb`, `munsell`, `oklch-hue`, `oklch-lightness`) as pure hue maps with ring paint.
- `HarmonySelectionConfig.wheel` and `HarmonySlot.wheelHue`. With `wheel` unset the output is byte-identical to 5.1.0 (golden digest unchanged).
- `ColorConverter.gamutMapOklch` (CSS Color 4 §14 binary search with local MINDE) and `ColorConverter.maxChromaOklch`.
- `LocalizationService.getColorWheelName` / `TranslationProvider.getColorWheelName`; locale data gains `colorWheels`.
- `NOTICE`: attribution for the Munsell renotation-derived hue table; `scripts/build-munsell-hues.ts`.
`### Deprecated`: `HarmonyColorSpace`, `HarmonyOptions.colorSpace`, `HarmonyGenerator.rotateHueInSpace` (they clip; 50.6° hue error on pure blue).
`### Dev`: `culori` as a devDependency oracle for the gamut mapper.

`packages/types/CHANGELOG.md` — `[3.2.0]` `### Added`: `ColorWheelId`; `LocaleData.colorWheels?`.
`packages/svg/CHANGELOG.md` — `[4.1.0]` `### Added`: `HarmonyCardOptions.wheelLabel`.
`packages/bot-logic/CHANGELOG.md` — `[4.2.0]` `### Added`: `HarmonyInput.wheel`, `getLocalizedColorWheelName`; share URL carries `&wheel=`. `### Deprecated`: `HarmonyInput.harmonyOptions`.
`apps/discord-worker/CHANGELOG.md` — `[5.5.0]` `### Added`: `/harmony wheel` option (five choices derived from core). `### Removed`: dead `color_space` option parsing.
`apps/og-worker/CHANGELOG.md` — `[2.10.0]` `### Added`: `?wheel=` on `/og/harmony/*` and on page share URLs (allowlisted, validated, cache-keyed, default elided); deck names a non-default wheel.
`apps/web-app/CHANGELOG.md` — `[5.7.0]` `### Added`: Color wheel selector in Harmony settings; ring and nodes drawn from the selected wheel; `?wheel=` in share URLs.

- [ ] **Step 3: Layman's changelogs (the strict grammar: `## [x.y.z] - YYYY-MM-DD`, `### Title`, `- bullet`)**

Root `CHANGELOG-laymans.md`, new top entry:

```markdown
## [5.7.0] - <date>
### 🎨 Choose your colour wheel in the Harmony Explorer
- Web app: a new **Color wheel** setting in Harmony's options lets you pick which wheel the harmony angles are measured on: RGB (the screen wheel, unchanged default), RYB (the painter's wheel, where red's complement is green), Munsell (the perceptual wheel behind Japan's JIS colour standard), OKLCH hue (perceptually even spacing) or OKLCH lightness (keeps every partner at the base dye's brightness).
- Web app: the ring repaints for the wheel you pick and the harmony dots sit on it, so what you see matches the dyes suggested. Share links remember the wheel.
- Discord bot: `/harmony` gains a `wheel` option with the same five choices; the card names the wheel when it is not the default and its link opens the same wheel on the web.
- Link previews: a shared harmony link previews with the wheel it was made on.
- Nothing changes unless you choose a wheel — the default is exactly what the tools did before.
```

`apps/web-app/CHANGELOG-laymans.md`, new top section (`### ` headings are load-bearing for the What's New modal):

```markdown
## Web-App Version 5.7.0 — <Month D, YYYY>

### Pick the colour wheel your harmonies use
- **A new "Color wheel" setting in Harmony's options.** RGB is the screen wheel you have always had. RYB is the painter's wheel that colour theory was written for, where red's complement is green rather than cyan. Munsell is the evenly spaced perceptual wheel behind Japan's JIS colour standard. OKLCH hue keeps the screen colours but spaces them by how different they look. OKLCH lightness keeps every partner at your base dye's brightness.
- **The ring changes with the wheel, and the dots sit on it.** On the RYB wheel the point opposite red is green, and that is where the complementary dot lands — the picture and the dye list finally say the same thing.
- **Share links remember the wheel**, and a link without one opens on RGB exactly as before. Nothing about your existing palettes changes until you choose a different wheel.
- Changing the wheel changes the suggested dyes for most saturated base colours, sometimes a lot; muted and grey bases are barely affected.
```

`apps/discord-worker/CHANGELOG-laymans.md`, new top entry (no Unreleased block; the parser checks the file):

```markdown
## [5.5.0] - <date>
### 🎨 /harmony can use a different colour wheel
- `/harmony` has a new `wheel` option: RGB (default), RYB (the painter's wheel — red's complement is green), Munsell (JIS), OKLCH hue, or OKLCH lightness. The dyes it suggests change with the wheel.
- The card names the wheel under the harmony type when it is not the default, and its link opens the web app on the same wheel.
- Leave the option out and nothing changes.
```

Run the bot changelog parser test: `pnpm --filter xivdyetools-discord-worker exec vitest run src/services/changelog-parser.test.ts`. Expected: PASS.

- [ ] **Step 4: Mark the spec implemented and run every gate on the whole tree**

Edit the spec header's `**Status:**` to `implemented <date> (plan docs/superpowers/plans/2026-09-04-harmony-color-wheels.md)`.

Run, from the monorepo root:

```bash
pnpm turbo run build --filter='./packages/*'
pnpm turbo run lint type-check test --filter=@xivdyetools/types --filter=@xivdyetools/core --filter=@xivdyetools/svg --filter=@xivdyetools/bot-logic --filter=xivdyetools-web-app --filter=xivdyetools-discord-worker --filter=xivdyetools-og-worker
pnpm --filter xivdyetools-web-app run validate:i18n
pnpm --filter xivdyetools-web-app run build
pnpm --filter xivdyetools-discord-worker exec wrangler deploy --dry-run --outdir /tmp/dw-dry 2>&1 | tail -5
```

Expected: all green; the web-app size gate passes; the discord-worker dry-run reports a gzip size under 3,072 KiB (it was 2,632 KiB; this change adds on the order of 10 KiB). If the dead-code check (`scripts/check-dead-code.ts`, run by CI) is runnable locally, run it too.

- [ ] **Step 5: Commit and push, update the PR**

```bash
git add -A
git commit -m "chore(release): selectable harmony colour wheels — core 5.2.0, web-app 5.7.0, discord-worker 5.5.0, og-worker 2.10.0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QxcD6YJJamN5Sx7FNCbKem"
git push origin research/harmony-color-wheels
```

Then edit PR #167's description: title `feat: selectable colour wheels for the Harmony Explorer (RGB, RYB, Munsell, OKLCH ×2)`, keep the research summary, add a "What ships" section listing the five wheels and the surfaces, the cache-key ruling for `wheel` (Task 12), the command-registration step for the maintainer (`pnpm --filter xivdyetools-discord-worker run register-commands` after deploy), and the publish order (types → core → svg → bot-logic, each via the "Publish Packages to npm" workflow, before the workers deploy). Mark the PR ready for review.

---

## Self-review (done while writing; re-run after execution)

- **Spec coverage:** §1 ids/labels → Tasks 2, 8, 9, 11; §2.1 warp wheels → Tasks 1, 2, 3, 6; §2.2 lightness wheel → Tasks 4, 5; §2.3 Munsell provenance + NOTICE → Task 6; §2.4 public API → Task 7 step 8; §2.5 deprecations → Task 7 step 7 and Task 11 (bot `color_space`); §3 selector → Task 7; §4 web app → Tasks 9, 10; §5 Discord + OG → Tasks 11, 12; §6 tests: round trip (T1, T2, T3), monotone (T1, T3, T6), involution (T2), golden unchanged (T7 step 4), golden per wheel (T7 step 5), RYB by value (T2), Munsell landmarks (T6), grey stability (T2, T3, T5, T7), oracle (T4), registry safety (T2), surface tests (T9–T12); §7 rollout → Task 13. Mutation check (§6 item 7): run once during Task 7 step 6 — perturb `RYB_TABLE[12]` to `[180, 139]` in a scratch edit and confirm `registry.test.ts` and the RYB golden go red; revert.
- **Deviations from the spec, all recorded inline:** the OKLCH-hue table is derived at module load and pinned by tests instead of checked in with a generator (T3); the web app persists `wheel` through `ConfigController` rather than a separate storage key (T10); Munsell cross-check oracle is munsell.js in a scratch dir (the R package remains the licence anchor) (T6); analytics is untouched because Tier A never logs option values (T11).
- **Type consistency:** `ColorWheel { id; hueOf(hex); target(baseHex, wheelHue) → { targetHex, targetHue }; ringStops(count) }` is used identically in T1–T7, T10, T12; `HarmonySlot.wheelHue` in T7, T10; `parseWheel`/`withWheel` only in T12; `getColorWheelName` on `TranslationProvider`, `LocalizationService`, web `LanguageService`, bot `getLocalizedColorWheelName`, og `getLocalizedColorWheelName` (T8, T9, T11, T12).
- **Placeholders:** the only values not written down in advance are the four per-wheel golden digests/samples (captured once in T7 step 6, the repo's established golden workflow), the Munsell generator's printed table (pasted into the T6 commit), and harness helper names in T10/T11 tests that must be copied from the surrounding test files (named as such, with the grep to find them).
