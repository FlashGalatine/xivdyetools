/**
 * Verifies the font bundle the SVG → PNG pipeline depends on.
 *
 * Run with: npx tsx scripts/test-font-rendering.ts
 *
 * The stack is not interchangeable and the ORDER matters:
 * - Fragment Mono carries every hex code, ΔE and gil figure. It replaced
 *   Habibi in 5.0, which was a single-weight *display* face rather than a
 *   monospace — which is why no column of numbers in a v4 card lined up.
 * - Noto Sans JP must be present and must precede SC in the fallback chain.
 *   Without it Japanese falls through to the SC subset and a Japanese player
 *   gets Chinese letterforms for every shared kanji.
 * - Noto Sans SC has zero Hangul glyphs, so KR must come after it.
 *
 * All three CJK faces are *subsets*, built from the locale files' codepoints
 * by scripts/subset-cjk-fonts.py — a full face would not fit the Worker.
 */

import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** In fallback-chain order. Every one of these is required. */
const REQUIRED_FONTS = [
  { file: 'SpaceGrotesk-VariableFont_wght.ttf', role: 'display — card titles, the big number' },
  { file: 'Onest-VariableFont_wght.ttf', role: 'body — dye names' },
  { file: 'FragmentMono-Regular.ttf', role: 'mono — every measured value' },
  { file: 'NotoSansJP-Subset.ttf', role: 'CJK ja — MUST precede SC in the chain' },
  { file: 'NotoSansSC-Subset.ttf', role: 'CJK zh' },
  { file: 'NotoSansKR-Subset.ttf', role: 'CJK ko — MUST follow SC (SC has no Hangul)' },
];

/** Retired in 5.0 — a leftover here means a stale bundle. */
const RETIRED_FONTS = ['Habibi-Regular.ttf'];

function main(): void {
  const fontsDir = join(__dirname, '..', 'src', 'fonts');
  console.log(`Checking font bundle in ${fontsDir}\n`);

  let missing = 0;
  for (const { file, role } of REQUIRED_FONTS) {
    const path = join(fontsDir, file);
    if (existsSync(path)) {
      const kb = (statSync(path).size / 1024).toFixed(1);
      console.log(`  ✓ ${file.padEnd(34)} ${kb.padStart(8)} KB   ${role}`);
    } else {
      console.log(`  ✗ ${file.padEnd(34)} MISSING            ${role}`);
      missing++;
    }
  }

  let stale = 0;
  for (const file of RETIRED_FONTS) {
    if (existsSync(join(fontsDir, file))) {
      console.log(`\n  ⚠ ${file} is still bundled — retired in 5.0, safe to delete.`);
      stale++;
    }
  }

  if (missing > 0) {
    console.error(`\n❌ ${missing} required font(s) missing. PNG text will render as tofu.`);
    process.exit(1);
  }

  console.log('\n✓ Font bundle complete.');
  if (stale > 0) console.log('⚠ Retired fonts are still shipping weight to the Worker.');
  console.log(
    '\nA dye name introducing a glyph outside the current subsets renders as .notdef —\n' +
      'regenerate with: python scripts/subset-cjk-fonts.py'
  );
}

main();
