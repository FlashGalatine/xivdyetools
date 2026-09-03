/**
 * CIEDE2000 conformance check against the supplementary test data from
 *
 *   Sharma, G., Wu, W. & Dalal, E.N. (2005), "The CIEDE2000 Color-Difference
 *   Formula: Implementation Notes, Supplementary Test Data, and Mathematical
 *   Observations", Color Research & Application 30(1):21-30.
 *
 * Canonical data file:
 *   https://www.hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
 *
 * These 34 pairs exist precisely because the CIE's own worked examples "do not
 * adequately test the implementation" -- they are chosen to stress the
 * arctangent quadrant handling, the mean-hue branch logic, and the
 * C1'*C2' == 0 special cases, which is where Sharma et al. found that
 * "several implementations distributed on the Internet, including some from
 * reputable sources, were erroneous".
 *
 * Published dE00 values are quoted to 4 decimal places, so the tolerance below
 * is set accordingly.
 */
import { ColorConverter } from '../../../../packages/core/src/services/color/ColorConverter.ts';

// L1, a1, b1, L2, a2, b2, expected dE00
const SHARMA: Array<[number, number, number, number, number, number, number]> = [
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

const TOL = 1e-4;
let worst = 0;
let worstIdx = -1;
let failures = 0;

console.log('CIEDE2000 conformance — Sharma, Wu & Dalal (2005), 34 supplementary pairs\n');
console.log('  #   expected     actual      |diff|');
console.log('  ' + '-'.repeat(44));

SHARMA.forEach(([L1, a1, b1, L2, a2, b2, expected], i) => {
  const actual = ColorConverter.getDeltaE2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
  const diff = Math.abs(actual - expected);
  if (diff > worst) {
    worst = diff;
    worstIdx = i + 1;
  }
  const bad = diff > TOL;
  if (bad) failures++;
  if (bad || i < 3 || i >= SHARMA.length - 2) {
    console.log(
      `  ${String(i + 1).padStart(2)}  ${expected.toFixed(4).padStart(9)}  ${actual.toFixed(4).padStart(9)}  ${diff.toExponential(2).padStart(9)}${bad ? '   <-- FAIL' : ''}`,
    );
  }
});

console.log('  ' + '-'.repeat(44));
console.log(`\n  pairs:        ${SHARMA.length}`);
console.log(`  tolerance:    ${TOL} (published values are quoted to 4 dp)`);
console.log(`  failures:     ${failures}`);
console.log(`  max |diff|:   ${worst.toExponential(3)}  (pair ${worstIdx})`);
console.log(`\n  ${failures === 0 ? 'PASS — implementation conforms to the published test vector.' : 'FAIL'}`);
