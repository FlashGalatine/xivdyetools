/**
 * Generate the API docs icon set (developers.xivdyetools.app) from the
 * confirmed "6B · Socketed" icon, apps/api-worker/docs/public/icons/docs-icon.svg.
 *
 * Two variants, per the design's small-size note ("small sizes should ship
 * board-free"): the full icon — socket board and can — for the 180 px touch
 * icon, and a board-free variant — the steel can alone on the dark tile, drawn
 * at ×0.9 — for everything a browser shows at tab size: favicon.svg and the
 * 16 / 32 px PNGs. The small SVG is DERIVED here from the full one so the two
 * cannot drift; do not hand-edit it.
 *
 * Lives here rather than in api-worker because this package already owns
 * `sharp` and the two sibling icon generators; api-worker has no image
 * dependency and should not gain one for three PNGs.
 *
 * One-shot: the output is committed next to the source and is NOT regenerated
 * in CI. Re-run only if the artwork changes. The files are exactly the set
 * api-worker/docs/.vitepress/config.ts links — regenerating must not add
 * orphans.
 *
 * Usage: node scripts/generate-api-docs-icons.mjs   (from apps/web-app)
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ICON_DIR = path.join(__dirname, '../../api-worker/docs/public/icons');
const SOURCE = path.join(ICON_DIR, 'docs-icon.svg');
const SMALL_SVG = path.join(ICON_DIR, 'favicon.svg');
const SOURCE_SIZE = 512;

const FULL_SIZES = [{ name: 'apple-touch-icon.png', size: 180 }];
const SMALL_SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
];

const BOARD_USE = '<use href="#d-board"/>';
const CAN_TRANSFORM = 'translate(256,252) scale(0.8) translate(-256,-256)';
const SMALL_CAN_TRANSFORM = 'translate(256,252) scale(0.9) translate(-256,-256)';
// The board group's own close tag sits at 4-space indent; its children close at
// 6, so the lazy match must be pinned to the indent or it stops one level early.
const BOARD_DEF = /\n {4}<!-- 6B board:[^\n]*\n {4}<g id="d-board">[\s\S]*?\n {4}<\/g>\n/;

/** The board-free variant: same tile, glow and can; no board; can at ×0.9. */
function deriveSmall(full) {
  for (const needle of [BOARD_USE, CAN_TRANSFORM]) {
    if (!full.includes(needle)) throw new Error(`docs-icon.svg no longer contains ${needle}`);
  }
  if (!BOARD_DEF.test(full)) throw new Error('docs-icon.svg no longer contains the d-board definition');
  return full
    .replace(/<!--[\s\S]*?-->\n/, [
      '<!--',
      '    DERIVED by apps/web-app/scripts/generate-api-docs-icons.mjs from docs-icon.svg — do not',
      '    hand-edit. The board-free small variant of "6B · Socketed": the same tile, glow and',
      '    steel can, no socket board, can at ×0.9 — for tab-size rendering (this file is the',
      '    <link rel="icon"> SVG; favicon-16x16 / 32x32 are rasterised from it).',
      '  -->',
      '',
    ].join('\n'))
    .replace(BOARD_DEF, '\n')
    .replace(`  ${BOARD_USE}\n`, '')
    .replace(CAN_TRANSFORM, SMALL_CAN_TRANSFORM);
}

async function rasterise(svg, name, size) {
  // Rasterise at the target size rather than downscaling a 512 render, so the
  // strokes are drawn at that size, not resampled.
  const density = (72 * size) / SOURCE_SIZE;
  await sharp(svg, { density })
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(path.join(ICON_DIR, name));
  console.log(`✓ ${name} (${size}×${size})`);
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source artwork not found: ${SOURCE}`);
  }
  const full = fs.readFileSync(SOURCE, 'utf8');
  const small = deriveSmall(full);
  fs.writeFileSync(SMALL_SVG, small);
  console.log('✓ favicon.svg (board-free, derived)');

  for (const { name, size } of FULL_SIZES) await rasterise(Buffer.from(full), name, size);
  for (const { name, size } of SMALL_SIZES) await rasterise(Buffer.from(small), name, size);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
