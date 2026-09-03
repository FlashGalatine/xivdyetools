/**
 * FONT-001 render proof.
 *
 * The SVG string is not evidence — it already said font-weight="700" while the
 * glyphs came out Thin. Render the same Japanese text through the real
 * resvg-wasm with (a) the OLD committed fonts and (b) the NEW ones, and compare
 * the PNGs. Different bytes = the weight actually changed on screen.
 *
 * Run from the repo root with the worker's own tsx/node:
 *   node docs/audits/2026-09-03-i18n/evidence/scripts/render-weight-proof.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const REPO = process.cwd();
const WORKER = join(REPO, 'apps', 'discord-worker');
const FONTS = join(WORKER, 'src', 'fonts');
const require = createRequire(join(WORKER, 'package.json'));
const { Resvg, initWasm } = require('@resvg/resvg-wasm');
await initWasm(readFileSync(join(require.resolve('@resvg/resvg-wasm'), '..', 'index_bg.wasm')));

const files = readdirSync(FONTS).filter((f) => f.endsWith('.ttf'));
const newBufs = files.map((f) => new Uint8Array(readFileSync(join(FONTS, f))));

// The same faces as committed BEFORE this sprint (variable, wght default 100).
const oldBufs = files.map((f) => {
  const out = execFileSync('git', ['show', `HEAD:apps/discord-worker/src/fonts/${f}`], {
    cwd: REPO,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  return new Uint8Array(out);
});

// Japanese present in the subsets: 単色 (monochromatic), 正常視覚 (normal vision).
const svg = (weight) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="60">` +
  `<rect width="360" height="60" fill="#fff"/>` +
  `<text x="8" y="42" font-family="Noto Sans JP" font-size="30" font-weight="${weight}" fill="#000">単色 正常視覚</text>` +
  `</svg>`;

const png = (fontBuffers, weight) =>
  new Resvg(svg(weight), {
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'Noto Sans JP' },
  })
    .render()
    .asPng();

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const oldW400 = png(oldBufs, 400);
const newW400 = png(newBufs, 400);
const newW700 = png(newBufs, 700);

console.log(`faces compared: ${files.length}`);
console.log(`old fonts @400 vs new fonts @400 : ${same(oldW400, newW400) ? 'IDENTICAL' : 'DIFFERENT'}`);
console.log(`  -> DIFFERENT proves the pinned instance changed what is drawn (Thin 100 -> Regular 400).`);
console.log(`new fonts @400 vs @700           : ${same(newW400, newW700) ? 'IDENTICAL' : 'DIFFERENT'}`);
console.log(`  -> IDENTICAL is EXPECTED and deliberate: one static CJK instance per family,`);
console.log(`     because three weights each would not fit the 3 MiB gzipped Worker budget.`);
if (!existsSync(FONTS)) process.exit(1);
