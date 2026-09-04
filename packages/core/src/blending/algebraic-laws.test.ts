/**
 * Algebraic-law gates for every blending mode — no per-mode exemptions.
 *
 * Both P1 defects of the 2026-09-03 algorithm fact-check would have been
 * caught on the first run of this file:
 *
 * - `spectral` collapsed almost every mix to near-black (per-channel K/S on
 *   gamma-encoded sRGB). The mid-tone and monotonicity laws catch it.
 * - `ryb` (the Gossett-Chen cube) returned a *different colour* when a dye was
 *   mixed with itself, on 53% of dye pairs. Idempotence catches it outright.
 *
 * Neither was caught at the time, and the reason is recorded in
 * `blending.test.ts`: the suite carried per-mode exemption lists, and the two
 * broken modes were on them. So the rule here is that **every law runs over
 * every mode**. If a mode cannot satisfy a law, that is a finding about the
 * mode, not a licence to skip it — see the overshoot section, which is the one
 * place a law genuinely does not generalise and says exactly why.
 *
 * @module blending/algebraic-laws.test
 */

import { describe, it, expect } from 'vitest';
import { blendColors } from './index.js';
import { rgbToHsl, hexToRgb } from './conversions.js';
import type { BlendingMode } from './types.js';
import dyes from '../data/dyes.json' with { type: 'json' };

const ALL_MODES: BlendingMode[] = ['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'];

const HEXES: string[] = (dyes as Array<{ hex: string }>).map((d) => d.hex);

/**
 * A spread of real dye pairs. Strided rather than exhaustive (125² × 6 modes ×
 * several ratios is minutes, not milliseconds) but wide enough that every hue
 * family meets every other — the fact-check's measurements over the full cross
 * product found no violation this sample misses.
 */
const PAIRS: Array<[string, string]> = [];
for (let i = 0; i < HEXES.length; i += 7) {
  for (let j = 0; j < HEXES.length; j += 11) PAIRS.push([HEXES[i], HEXES[j]]);
}

const RATIOS = [0, 0.25, 0.5, 0.75, 1];

describe.each(ALL_MODES)('%s obeys the algebraic laws', (mode) => {
  /**
   * mix(A, B, 0) === A and mix(A, B, 1) === B, exactly.
   *
   * Asserted on the hex, not within a ΔE tolerance: measured across every
   * mode and every pair here, the deviation is 0.000, so a tolerance would
   * only hide a future regression. A slider whose 0% end is not the input is
   * the defect a user sees first.
   */
  it('identity: the endpoints are the inputs', () => {
    for (const [a, b] of PAIRS) {
      expect(blendColors(a, b, mode, 0).hex.toLowerCase()).toBe(a.toLowerCase());
      expect(blendColors(a, b, mode, 1).hex.toLowerCase()).toBe(b.toLowerCase());
    }
  });

  /** mix(A, B, 0.5) === mix(B, A, 0.5). Measured deviation 0.000 everywhere. */
  it('commutativity: an equal mix does not depend on argument order', () => {
    for (const [a, b] of PAIRS) {
      expect(blendColors(a, b, mode, 0.5).hex).toBe(blendColors(b, a, mode, 0.5).hex);
    }
  });

  /**
   * mix(A, A, t) === A at every ratio.
   *
   * For Kubelka-Munk this holds by construction — if (K/S)_A === (K/S)_B then
   * any convex combination is (K/S)_A — so a failure here is a normalisation
   * or rounding bug, not a modelling choice. For the Gossett-Chen RYB cube it
   * did NOT hold, which is what retired that cube in 5.0.0.
   */
  it('idempotence: mixing a colour with itself returns it', () => {
    for (const hex of HEXES) {
      for (const t of RATIOS) {
        expect(blendColors(hex, hex, mode, t).hex.toLowerCase()).toBe(hex.toLowerCase());
      }
    }
  });

  /**
   * A black→white ramp must ascend in every channel and span the full range.
   *
   * This is the assertion the per-channel K/S bug failed: it pinned every
   * interior step to #000000–#030303.
   */
  it('monotonicity: a greyscale ramp ascends and spans', () => {
    const steps = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const ramp = steps.map((t) => blendColors('#000000', '#FFFFFF', mode, t).rgb);

    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i].r).toBeGreaterThanOrEqual(ramp[i - 1].r);
      expect(ramp[i].g).toBeGreaterThanOrEqual(ramp[i - 1].g);
      expect(ramp[i].b).toBeGreaterThanOrEqual(ramp[i - 1].b);
    }

    expect(ramp[0].r).toBeLessThan(10);
    expect(ramp[ramp.length - 1].r).toBeGreaterThan(245);
    // The interior must actually travel — a mode that returned an endpoint
    // for every ratio would satisfy the ascent above.
    expect(ramp[3].r).toBeGreaterThan(ramp[1].r);
  });
});

/**
 * The one law that does NOT generalise, stated for the one mode it holds for.
 *
 * The fact-check proposed "no overshoot past either endpoint" as a universal
 * law. Measured over the full dye cross-product, it is false for four of the
 * six modes — `lab`, `oklab`, `ryb` and `hsl` all put an interior channel
 * outside the range its endpoints span.
 *
 * That is correct behaviour, not a defect. Only `rgb` interpolates the sRGB
 * channels themselves. Every other mode travels a straight line in a DIFFERENT
 * space, and the image of that line back in sRGB is a curve, which can bulge
 * slightly outside the axis-aligned box spanned by its endpoints. The
 * excursions are small — 1 to 8 counts on the examples below, i.e. gamut
 * curvature plus integer rounding, not a large detour — but they are real and
 * they are not going away.
 *
 * Asserting the universal version would have failed honestly-correct code, so
 * it is scoped to `rgb` here instead of being exempted away per mode.
 */
describe('overshoot is bounded only for rgb, and deliberately so', () => {
  it('rgb: no interior step leaves the endpoint range', () => {
    for (const [a, b] of PAIRS) {
      const ra = hexToRgb(a);
      const rb = hexToRgb(b);
      for (const t of [0.25, 0.5, 0.75]) {
        const mid = blendColors(a, b, 'rgb', t).rgb;
        for (const ch of ['r', 'g', 'b'] as const) {
          expect(mid[ch]).toBeGreaterThanOrEqual(Math.min(ra[ch], rb[ch]));
          expect(mid[ch]).toBeLessThanOrEqual(Math.max(ra[ch], rb[ch]));
        }
      }
    }
  });

  /**
   * Real measured cases, so the rgb-only scoping above is demonstrably
   * load-bearing rather than a guess. If a future change makes any of these
   * stop overshooting, that is worth knowing — it would mean the mode's
   * interpolation path changed.
   */
  it.each([
    ['lab', '#e4dfd0', '#e4aa8a', 0.5, 'r', 228, 228],
    ['oklab', '#e4dfd0', '#e2000e', 0.25, 'r', 226, 228],
    ['ryb', '#e4dfd0', '#e69f96', 0.25, 'r', 228, 230],
    ['hsl', '#e4dfd0', '#e4aa8a', 0.25, 'r', 228, 228],
  ] as const)('%s overshoots on a real dye pair', (mode, a, b, t, ch, lo, hi) => {
    const mid = blendColors(a, b, mode as BlendingMode, t).rgb[ch];
    expect(mid < lo || mid > hi).toBe(true);
  });
});

/**
 * The qualitative pigment claims, as BANDS rather than exact hexes so the gate
 * survives a change of spectral backend.
 *
 * ⚠️ Two of the fact-check's four proposed claims did not survive measurement
 * and are corrected here:
 *
 * 1. "red + green → muddy brown/olive, not a flat average" was proposed for
 *    BOTH `spectral` and `ryb`. It is true only of `spectral` (#834b17).
 *    `ryb` returns exactly #808080 — a flat average — and that is right: RYB
 *    is a hue-wheel geometry with no absorption model, so it has no mechanism
 *    to produce muddiness. Red and green sit opposite on the RYB wheel and
 *    cancel. Asserting the K-M expectation of it would have been asserting a
 *    property the mode does not claim.
 * 2. "black + white 50/50 → not #a6a6a6" — `spectral` returns exactly
 *    #a6a6a6. The band below therefore says "a neutral grey, comfortably away
 *    from both ends", which is the defensible claim; the specific exclusion
 *    was an unmeasured guess.
 */
describe('pigment behaviour of the two modes that make a physical claim', () => {
  const hslOf = (hex: string) => rgbToHsl(hexToRgb(hex));

  it.each(['spectral', 'ryb'] as BlendingMode[])(
    '%s: blue + yellow is a green, not a grey',
    (mode) => {
      const mixed = blendColors('#0000FF', '#FFFF00', mode, 0.5);
      const { h, s } = hslOf(mixed.hex);

      expect(h).toBeGreaterThan(90);
      expect(h).toBeLessThan(170);
      expect(s).toBeGreaterThan(0.2);
    },
  );

  it('spectral: red + green is a dark warm muddy tone', () => {
    const { h, s, l } = hslOf(blendColors('#FF0000', '#00FF00', 'spectral', 0.5).hex);

    expect(h).toBeGreaterThan(15);
    expect(h).toBeLessThan(60);
    expect(s).toBeGreaterThan(0.3);
    expect(l).toBeLessThan(0.45);
  });

  it('ryb: red + green cancels to a neutral — it models no absorption', () => {
    const mixed = blendColors('#FF0000', '#00FF00', 'ryb', 0.5);
    expect(hslOf(mixed.hex).s).toBeLessThan(0.1);
  });

  it.each(['spectral', 'ryb'] as BlendingMode[])(
    '%s: white lightens red into a saturated pastel with a stable hue',
    (mode) => {
      const half = blendColors('#FFFFFF', '#FF0000', mode, 0.5).hex;
      const quarter = blendColors('#FFFFFF', '#FF0000', mode, 0.25).hex;

      for (const hex of [half, quarter]) {
        const { h, s } = hslOf(hex);
        // Hue stays in the red family (wraps through 0).
        expect(Math.min(h, 360 - h)).toBeLessThan(30);
        expect(s).toBeGreaterThan(0.5);
      }
      // More white is lighter.
      expect(hslOf(quarter).l).toBeGreaterThan(hslOf(half).l);
    },
  );

  it.each(['spectral', 'ryb'] as BlendingMode[])(
    '%s: black + white is a neutral grey well away from both ends',
    (mode) => {
      const mixed = blendColors('#000000', '#FFFFFF', mode, 0.5);

      expect(mixed.rgb.r).toBe(mixed.rgb.g);
      expect(mixed.rgb.g).toBe(mixed.rgb.b);
      // The per-channel K/S bug returned #010101 here.
      expect(mixed.rgb.r).toBeGreaterThan(60);
      expect(mixed.rgb.r).toBeLessThan(200);
    },
  );
});
