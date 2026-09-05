// Cross-check of packages/core/src/data/munsell-hues.json against munsell.js
// (privet-kitty, MPL-2.0 — a DEV-ONLY oracle run from a scratch directory,
// never a dependency of this repository). Run from the scratch dir:
//   node <repo>/docs/research/2026-09-04-harmony-color-wheels/probes/munsell-crosscheck.mjs <repo>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// Resolve `require` from the CURRENT WORKING DIRECTORY, not this script's
// location in the repo — `munsell` is installed only in the scratch dir this
// is meant to be run from, never as a dependency of the repository itself.
const require = createRequire(pathToFileURL(`${process.cwd()}/`));
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
