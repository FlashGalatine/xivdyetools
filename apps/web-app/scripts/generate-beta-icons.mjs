/**
 * Generate the beta favicon set from the beta bot avatar.
 *
 * One-shot: the output is committed to public/assets/icons/beta/ and is NOT
 * regenerated in CI. Re-run only if the source artwork changes.
 *
 * Usage: node scripts/generate-beta-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE = path.join(__dirname, 'assets/bot-avatar-beta-1024.png');
const OUTPUT_DIR = path.join(__dirname, '../public/assets/icons/beta');

// Must match the seven icon links in src/index.html exactly — the beta build
// rewrites those hrefs into this directory, so a missing name is a 404.
const SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source artwork not found: ${SOURCE}`);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const { name, size } of SIZES) {
    await sharp(SOURCE).resize(size, size, { fit: 'cover' }).png().toFile(path.join(OUTPUT_DIR, name));
    console.log(`+ ${name} (${size}x${size})`);
  }

  // favicon.ico is a copy of the 32px PNG. Every browser this app targets
  // accepts a PNG served as .ico, and scripts/generate-icons.mjs already takes
  // the same approach for the production set.
  fs.copyFileSync(path.join(OUTPUT_DIR, 'favicon-32x32.png'), path.join(OUTPUT_DIR, 'favicon.ico'));
  console.log('+ favicon.ico (copy of 32x32)');

  console.log(`\nDone: ${SIZES.length + 1} files in public/assets/icons/beta/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
