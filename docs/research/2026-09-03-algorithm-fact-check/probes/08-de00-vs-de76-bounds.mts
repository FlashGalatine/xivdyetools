/**
 * Is a Euclidean Lab coordinate difference a valid LOWER BOUND for CIEDE2000?
 *
 * This is the precondition a k-d tree's axis-aligned pruning needs. If a raw
 * per-axis difference can EXCEED the true dE00, the pruning is aggressive
 * (unsafe) and the tree can discard the branch holding the true nearest
 * neighbour.
 *
 * A tempting assumption -- and one this audit initially made -- is that
 * because S_L, S_C, S_H are all >= 1, dE00 <= dE76 always. That is FALSE in
 * both directions: the G factor rescales a* by up to 1.5x BEFORE the S
 * divisors apply, and G is largest exactly where S_C and S_H are smallest
 * (near the neutral axis). The two effects are anti-correlated.
 */
import { ColorConverter } from '../../../../packages/core/src/services/color/ColorConverter.ts';

const dE00 = (p: [number, number, number], q: [number, number, number]) =>
  ColorConverter.getDeltaE2000({ L: p[0], a: p[1], b: p[2] }, { L: q[0], a: q[1], b: q[2] });
const dE76 = (p: [number, number, number], q: [number, number, number]) =>
  Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

console.log('1) dE00 can EXCEED dE76 (low chroma, where G ~ 0.5 amplifies a*)\n');
for (const [p, q] of [
  [[50, 1, 0], [50, 6, 0]],
  [[50, 0, 0], [50, 5, 0]],
  [[50, 2, 0], [50, 7, 0]],
] as Array<[[number, number, number], [number, number, number]]>) {
  const a = dE00(p, q),
    b = dE76(p, q);
  console.log(
    `   ${JSON.stringify(p).padEnd(14)} -> ${JSON.stringify(q).padEnd(14)}  dE76 ${b.toFixed(4).padStart(8)}   dE00 ${a.toFixed(4).padStart(8)}   ratio ${(a / b).toFixed(4)}`,
  );
}

console.log('\n2) dE00 falls far BELOW the raw axis difference as chroma rises');
console.log('   (this is the direction that breaks k-d tree pruning)\n');
console.log('   chroma span   raw |da*|      dE00     raw/dE00');
for (const C of [10, 30, 50, 90, 130, 150]) {
  const p: [number, number, number] = [50, 0, 0];
  const q: [number, number, number] = [50, C, 0];
  const d = dE00(p, q);
  console.log(`   ${String(C).padStart(11)}   ${String(C).padStart(8)}   ${d.toFixed(3).padStart(8)}   ${(C / d).toFixed(2).padStart(6)}x`);
}

console.log('\n3) Random search over the Lab range for the extremes\n');
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const rp = (): [number, number, number] => [rnd() * 100, (rnd() - 0.5) * 260, (rnd() - 0.5) * 260];
let maxRatio = 0,
  minRatio = Infinity,
  maxAxis = 0;
const N = 300000;
for (let i = 0; i < N; i++) {
  const p = rp(),
    q = rp();
  const a = dE00(p, q),
    b = dE76(p, q);
  if (b < 1e-9 || a < 1e-9) continue;
  if (a / b > maxRatio) maxRatio = a / b;
  if (a / b < minRatio) minRatio = a / b;
  const axis = Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
  if (axis / a > maxAxis) maxAxis = axis / a;
}
console.log(`   over ${N.toLocaleString()} random Lab pairs:`);
console.log(`     max dE00/dE76        ${maxRatio.toFixed(4)}   (dE00 can be ${((maxRatio - 1) * 100).toFixed(0)}% LARGER)`);
console.log(`     min dE00/dE76        ${minRatio.toFixed(4)}   (dE00 can be ${(1 / minRatio).toFixed(1)}x SMALLER)`);
console.log(`     max |axis diff|/dE00 ${maxAxis.toFixed(2)}x  <-- the pruning bound overestimates by up to this much`);
console.log(`\n   A lower bound must never exceed the true distance. It does, by ${maxAxis.toFixed(1)}x.`);
console.log(`   => Euclidean axis pruning is NOT valid for CIEDE2000.`);
