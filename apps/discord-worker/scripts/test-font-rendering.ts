/**
 * Test script to verify font rendering works with resvg-wasm.
 *
 * Run with: npx tsx scripts/test-font-rendering.ts
 *
 * This checks that all required fonts are present and reports on CJK support.
 */

import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('Testing font rendering...\n');

  const fontsDir = join(__dirname, '..', 'src', 'fonts');

  // Required fonts
  const requiredFonts = [
    'SpaceGrotesk-VariableFont_wght.ttf',
    'Onest-VariableFont_wght.ttf',
    'Habibi-Regular.ttf',
  ];

  // Optional CJK font
  const cjkFont = 'NotoSansSC-Regular.ttf';

  console.log('Checking required font files...');

  let allPresent = true;
  for (const font of requiredFonts) {
    const fontPath = join(fontsDir, font);
    if (existsSync(fontPath)) {
      const stats = statSync(fontPath);
      console.log(`  ✓ ${font} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  ✗ ${font} NOT FOUND`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    console.error('\n❌ Missing required fonts. Please ensure all fonts are in src/fonts/');
    process.exit(1);
  }

  console.log('\n✓ All required fonts present!');

  // Check CJK font
  console.log('\nChecking CJK font support...');
  const cjkPath = join(fontsDir, cjkFont);
  if (existsSync(cjkPath)) {
    const stats = statSync(cjkPath);
    console.log(`  ✓ ${cjkFont} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    console.log('\n✓ CJK font is installed! Japanese, Korean, and Chinese dye names will render correctly.');
  } else {
    console.log(`  ⚠ ${cjkFont} NOT FOUND`);
    console.log('\n⚠ CJK font not installed. Japanese, Korean, and Chinese dye names may appear as boxes.');
    console.log('\nTo enable CJK support:');
    console.log('  1. Download Noto Sans SC from: https://fonts.google.com/noto/specimen/Noto+Sans+SC');
    console.log('  2. Extract NotoSansSC-Regular.ttf from the downloaded ZIP');
    console.log('  3. Copy it to: src/fonts/NotoSansSC-Regular.ttf');
    console.log('  4. Uncomment the CJK import in src/services/fonts.ts');
    console.log('  5. Rebuild with: npm run deploy');
  }

  console.log('\n---');
  console.log('To fully test rendering, deploy to Cloudflare and test via Discord commands.');
  console.log('Or use: wrangler dev --local and interact with the bot.');
}

main().catch(console.error);
