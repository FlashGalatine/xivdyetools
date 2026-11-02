// Run from repository root after pnpm install --frozen-lockfile.
// Optional argument: another local repo root with the same locked resvg package.
// Only local package/fonts are read. No system fonts, network, or application writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(process.cwd());
const here = resolve(root, '.superpowers/sdd/2026-10-29-font-reproduction');
const packageRoot = process.argv[2] ? resolve(process.argv[2]) : root;
const require = createRequire(join(packageRoot, 'apps/discord-worker/package.json'));
const entry = require.resolve('@resvg/resvg-wasm');
const { Resvg, initWasm } = require(entry);
const version = JSON.parse(readFileSync(join(dirname(entry), 'package.json'))).version;
const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
if (!lock.includes(`'@resvg/resvg-wasm@${version}'`)) throw Error('resvg runtime does not match lockfile');
const wasm = readFileSync(join(dirname(entry), 'index_bg.wasm'));
await initWasm(wasm);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const must = (condition, message) => { if (!condition) throw Error(message); };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const xml = (cp) => cp === 38 ? '&amp;' : cp === 60 ? '&lt;' : cp === 62 ? '&gt;' : String.fromCodePoint(cp);
function render(buffer, family, cps, size, saveName) {
  const cell = size * 2, cols = 16, rows = Math.ceil(cps.length / cols);
  const width = cell * cols, height = Math.max(cell * rows, cell);
  const texts = cps.map((cp, i) => `<text x="${(i % cols) * cell + size / 4}" y="${Math.floor(i / cols) * cell + size * 1.4}" font-family="${family}" font-size="${size}" font-weight="400" fill="#000">${xml(cp)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${texts}</svg>`;
  const renderer = new Resvg(svg, { font: { fontBuffers: [new Uint8Array(buffer)], loadSystemFonts: false, defaultFontFamily: family } });
  const image = renderer.render();
  const pixels = new Uint8Array(image.pixels);
  if (saveName) writeFileSync(join(here, saveName), image.asPng());
  image.free(); renderer.free();
  return pixels;
}
const report = { renderer: '@resvg/resvg-wasm', version, wasm_sha256: sha(wasm), package_root: packageRoot, system_fonts: false, sizes: [9, 12, 24, 48], faces: [], production_acceptance: 'HOLD' };
for (const face of ['JP', 'SC']) {
  const inputs = JSON.parse(readFileSync(join(here, `render-input-${face}.json`)));
  const old = readFileSync(join(here, `old-${face}.ttf`));
  const after = readFileSync(join(root, `apps/discord-worker/src/fonts/NotoSans${face}-Subset.ttf`));
  const ref = readFileSync(join(here, `reference-${face}.ttf`));
  const item = { face, old_font_sha256: sha(old), output_font_sha256: sha(after), reference_font_sha256: sha(ref), old_codepoints_checked: inputs.old_codepoints.length, atlases: [], new_glyphs: [] };
  // Every old codepoint appears in an independently positioned text element.
  // Chunking avoids giant canvases; it introduces no kerning/layout ambiguity.
  for (const size of report.sizes) {
    const hashes = [];
    for (let start = 0; start < inputs.old_codepoints.length; start += 128) {
      const cps = inputs.old_codepoints.slice(start, start + 128);
      const a = render(old, inputs.family, cps, size);
      const b = render(after, inputs.family, cps, size);
      must(same(a, b), `${face} old pixels differ at size ${size} start ${start}`);
      hashes.push({ start, count: cps.length, rgba_sha256: sha(a) });
    }
    item.atlases.push({ size, old_output_rgba_equal: true, chunks: hashes });
    console.log(`${face} size ${size}: ${inputs.old_codepoints.length} old codepoints pixel-identical`);
  }
  for (const cp of inputs.new_codepoints) {
    const sizes = [];
    for (const size of report.sizes) {
      const a = render(old, inputs.family, [cp], size, size === 48 ? `${face}-${cp.toString(16)}-before.png` : undefined);
      const b = render(after, inputs.family, [cp], size, size === 48 ? `${face}-${cp.toString(16)}-after.png` : undefined);
      const r = render(ref, inputs.family, [cp], size);
      const tofu = render(old, inputs.family, [0x10ffff], size);
      must(same(a, tofu), `${face} old missing glyph is not tofu control U+${cp.toString(16)}`);
      must(!same(a, b), `${face} new glyph did not change pixels U+${cp.toString(16)}`);
      must(same(b, r), `${face} new glyph differs from reference U+${cp.toString(16)}`);
      must(b.some((v, i) => i % 4 !== 3 && v < 255), 'new glyph render is blank');
      sizes.push({ size, before_tofu_rgba_sha256: sha(a), output_rgba_sha256: sha(b), reference_rgba_sha256: sha(r), before_equals_missing_control: true, output_differs_from_tofu: true, output_equals_reference: true });
    }
    item.new_glyphs.push({ codepoint: `U+${cp.toString(16).toUpperCase()}`, sizes });
  }
  report.faces.push(item);
}
writeFileSync(join(here, 'resvg-pixel-proof.json'), JSON.stringify(report, null, 2) + '\n');
console.log('All pixel invariants passed; receipt: resvg-pixel-proof.json. Production remains HOLD.');
