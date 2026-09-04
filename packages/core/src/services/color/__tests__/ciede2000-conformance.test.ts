/**
 * CIEDE2000 conformance gate — the published Sharma-Wu-Dalal test vector.
 *
 *   Sharma, G., Wu, W. & Dalal, E.N. (2005), "The CIEDE2000 Color-Difference
 *   Formula: Implementation Notes, Supplementary Test Data, and Mathematical
 *   Observations", Color Research & Application 30(1):21-30.
 *
 * Canonical data file:
 *   https://www.hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
 *
 * WHY THIS FILE EXISTS, given the implementation already passes:
 *
 * These 34 pairs are not a sample of ordinary colours — they were constructed
 * precisely because the CIE's own worked examples "do not adequately test the
 * implementation". They stress the arctangent quadrant handling, the mean-hue
 * branch logic, and the C1'·C2' == 0 special cases, which is where Sharma et
 * al. found that "several implementations distributed on the Internet,
 * including some from reputable sources, were erroneous", and where the CIE
 * standard's own text is ambiguous.
 *
 * Nothing else in this repo's suite would catch a regression there: every
 * other ΔE2000 assertion uses real dye colours, which live nowhere near the
 * hue-wraparound discontinuity at 0°/360° or the zero-chroma degeneracies.
 * A refactor of `getDeltaE2000` could break the mean-hue branch for
 * near-neutral pairs and leave every dye-based test green.
 *
 * Ranking is what depends on this: `ciede2000` is `DEFAULT_MATCHING_METHOD`,
 * so every "closest dye" answer on every surface is this function's output.
 *
 * WHAT THIS GATE CAN AND CANNOT CATCH — established by mutating the
 * implementation and watching, not by assuming:
 *
 * - Flipping the sign of the `Rt` rotation term fails **11 of the 34 pairs**.
 *   That is the classic implementation error the paper warns about, and it is
 *   caught loudly.
 * - Deleting the `C1p·C2p === 0` mean-hue special case changes **nothing**,
 *   and the gate correctly stays green. That branch is genuinely inert for the
 *   returned value: when either chroma is zero, `dHp = 2·√(C1p·C2p)·sin(…)` is
 *   zero, so `Hp` reaches the result only through `T` (via `Sh`, dividing a
 *   zero) and `dTheta` (via `Rt`, multiplying a zero). It matters only to an
 *   implementation that also *reports* the mean hue. Two of the 34 pairs do
 *   take that branch — the gate is not blind to them, the formula is.
 * - Flipping `dhp = h2p − h1p − 360` to `+ 360` also changes nothing, for a
 *   different reason: `dhp` enters only as `sin(dhp·π/360)`, so a 720° shift
 *   is exactly one period. Four pairs take that branch.
 *
 * The lesson for anyone extending this file: a mutation that survives is not
 * automatically a coverage gap. Check whether the term is reachable in the
 * *result* before adding a pair to chase it.
 *
 * @module services/color/__tests__/ciede2000-conformance
 */

import { describe, it, expect } from 'vitest';
import { ColorConverter } from '../ColorConverter.js';

/**
 * [L1, a1, b1, L2, a2, b2, expected ΔE00] — transcribed from the paper's
 * supplementary data. Published values are quoted to 4 decimal places, which
 * is what sets the tolerance below.
 */
const SHARMA_PAIRS: ReadonlyArray<
  readonly [number, number, number, number, number, number, number]
> = [
  [50.0, 2.6772, -79.7751, 50.0, 0.0, -82.7485, 2.0425],
  [50.0, 3.1571, -77.2803, 50.0, 0.0, -82.7485, 2.8615],
  [50.0, 2.8361, -74.02, 50.0, 0.0, -82.7485, 3.4412],
  [50.0, -1.3802, -84.2814, 50.0, 0.0, -82.7485, 1.0],
  [50.0, -1.1848, -84.8006, 50.0, 0.0, -82.7485, 1.0],
  [50.0, -0.9009, -85.5211, 50.0, 0.0, -82.7485, 1.0],
  [50.0, 0.0, 0.0, 50.0, -1.0, 2.0, 2.3669],
  [50.0, -1.0, 2.0, 50.0, 0.0, 0.0, 2.3669],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0009, 7.1792],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.001, 7.1792],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0011, 7.2195],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0012, 7.2195],
  [50.0, -0.001, 2.49, 50.0, 0.0009, -2.49, 4.8045],
  [50.0, -0.001, 2.49, 50.0, 0.001, -2.49, 4.8045],
  [50.0, -0.001, 2.49, 50.0, 0.0011, -2.49, 4.7461],
  [50.0, 2.5, 0.0, 50.0, 0.0, -2.5, 4.3065],
  [50.0, 2.5, 0.0, 73.0, 25.0, -18.0, 27.1492],
  [50.0, 2.5, 0.0, 61.0, -5.0, 29.0, 22.8977],
  [50.0, 2.5, 0.0, 56.0, -27.0, -3.0, 31.903],
  [50.0, 2.5, 0.0, 58.0, 24.0, 15.0, 19.4535],
  [50.0, 2.5, 0.0, 50.0, 3.1736, 0.5854, 1.0],
  [50.0, 2.5, 0.0, 50.0, 3.2972, 0.0, 1.0],
  [50.0, 2.5, 0.0, 50.0, 1.8634, 0.5757, 1.0],
  [50.0, 2.5, 0.0, 50.0, 3.2592, 0.335, 1.0],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.248, -4.962, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  [36.4612, 47.858, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.441, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
];

/** Published data is quoted to 4 dp, so this is as tight as the source allows. */
const TOLERANCE = 1e-4;

describe('CIEDE2000 conformance — Sharma, Wu & Dalal (2005)', () => {
  it('has all 34 published pairs', () => {
    // Guards the table itself: a truncated paste would silently weaken every
    // assertion below without failing any of them.
    expect(SHARMA_PAIRS).toHaveLength(34);
  });

  it.each(
    SHARMA_PAIRS.map((pair, i) => [i + 1, ...pair] as const),
  )(
    'pair %i: ΔE00((%f, %f, %f), (%f, %f, %f)) === %f',
    (_i, L1, a1, b1, L2, a2, b2, expected) => {
      const actual = ColorConverter.getDeltaE2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
    },
  );

  it('is symmetric on every published pair', () => {
    // ΔE is a difference, not a directed quantity. Pairs 7 and 8 of the
    // published set are the same colours in both orders precisely because an
    // asymmetric mean-hue implementation gets them wrong.
    for (const [L1, a1, b1, L2, a2, b2] of SHARMA_PAIRS) {
      const forward = ColorConverter.getDeltaE2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
      const reverse = ColorConverter.getDeltaE2000({ L: L2, a: a2, b: b2 }, { L: L1, a: a1, b: b1 });
      expect(reverse).toBeCloseTo(forward, 10);
    }
  });

  it('is zero for a colour against itself', () => {
    for (const [L1, a1, b1] of SHARMA_PAIRS) {
      expect(ColorConverter.getDeltaE2000({ L: L1, a: a1, b: b1 }, { L: L1, a: a1, b: b1 })).toBe(0);
    }
  });
});
