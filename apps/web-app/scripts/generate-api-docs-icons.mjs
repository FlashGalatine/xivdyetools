/**
 * Generate the API docs favicon set (developers.xivdyetools.app) from the
 * confirmed "6B · Socketed" icon, apps/api-worker/docs/public/icons/favicon.svg.
 *
 * Lives here rather than in api-worker because this package already owns
 * `sharp` and the two sibling icon generators; api-worker has no image
 * dependency and should not gain one for three PNGs.
 *
 * One-shot: the output is committed next to the SVG and is NOT regenerated in
 * CI. Re-run only if the artwork changes. The sizes are exactly the set
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
const SOURCE = path.join(ICON_DIR, 'favicon.svg');
const SOURCE_SIZE = 512;

const SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source artwork not found: ${SOURCE}`);
  }
  const svg = fs.readFileSync(SOURCE);

  for (const { name, size } of SIZES) {
    // Rasterise at the target size rather than downscaling a 512 render, so
    // the 5/11 dashed pin rows and 6 px traces are drawn, not resampled.
    const density = (72 * size) / SOURCE_SIZE;
    await sharp(svg, { density })
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(path.join(ICON_DIR, name));
    console.log(`✓ ${name} (${size}×${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
