import { ColorConverter } from '../../../../packages/core/src/services/color/ColorConverter.ts';
import dyes from '../../../../packages/core/src/data/dyes.json' with { type: 'json' };
const hexes: string[] = (dyes as any[]).map((d) => d.hex);

const cc = ColorConverter;
function dOK(a: string, b: string, k = 1) {
  const x = cc.hexToOklab(a),
    y = cc.hexToOklab(b);
  const dL = x.L - y.L,
    da = (x.a - y.a) * k,
    db = (x.b - y.b) * k;
  return Math.sqrt(dL * dL + da * da + db * db);
}
// toe() from CSS Color 4 / Ottosson
function toe(L: number) {
  const k1 = 0.206,
    k2 = 0.03,
    k3 = (1 + k1) / (1 + k2);
  return 0.5 * (k3 * L - k1 + Math.sqrt((k3 * L - k1) ** 2 + 4 * k2 * k3 * L));
}
function dOKr2(a: string, b: string) {
  const x = cc.hexToOklab(a),
    y = cc.hexToOklab(b);
  const dL = toe(x.L) - toe(y.L),
    da = 2 * (x.a - y.a),
    db = 2 * (x.b - y.b);
  return Math.sqrt(dL * dL + da * da + db * db);
}

function nearest(hex: string, f: (a: string, b: string) => number) {
  let best = '',
    bd = Infinity;
  for (const h of hexes) {
    const d = f(hex, h);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}
const ref = (a: string, b: string) => cc.getDeltaE(a, b, 'ciede2000');
const variants: Record<string, (a: string, b: string) => number> = {
  'oklab (plain dEOK)': (a, b) => dOK(a, b, 1),
  'dEOK2  (a,b x2)': (a, b) => dOK(a, b, 2),
  'dEOKr2 (toe + x2)': dOKr2,
  cie76: (a, b) => cc.getDeltaE(a, b, 'cie76'),
};
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const N = 2000;
const counts: Record<string, number> = {};
for (let i = 0; i < N; i++) {
  const hex =
    '#' +
    [0, 1, 2]
      .map(() => Math.floor(rnd() * 256).toString(16).padStart(2, '0'))
      .join('');
  const r = nearest(hex, ref);
  for (const k of Object.keys(variants)) if (nearest(hex, variants[k]) !== r) counts[k] = (counts[k] ?? 0) + 1;
}
console.log(`Disagreement with CIEDE2000 on the winning dye (${N} random sRGB queries, 125 dyes):\n`);
for (const k of Object.keys(variants)) console.log(`  ${k.padEnd(22)} ${(((counts[k] ?? 0) / N) * 100).toFixed(1)}%`);
console.log(`\nNote: scaling a,b by 2 leaves L unscaled, so it is NOT a uniform rescale of`);
console.log(`      the whole vector - any difference between rows 1 and 2 is real re-ranking.`);
