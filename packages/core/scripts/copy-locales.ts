#!/usr/bin/env node
/**
 * Copy locale JSON files from src/data/locales to dist/data/locales
 *
 * This is needed because TypeScript's tsc doesn't copy JSON files
 * that are dynamically imported (with variable paths).
 *
 * Usage: npm run copy:locales
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const workingDir = process.cwd();
  const srcDir = path.join(workingDir, 'src', 'data', 'locales');
  const distDir = path.join(workingDir, 'dist', 'data', 'locales');

  // Check if source directory exists
  if (!fs.existsSync(srcDir)) {
    console.error(`❌ Source directory not found: ${srcDir}`);
    console.error('   Run "npm run build:locales" first.');
    process.exit(1);
  }

  // Check if dist directory exists (tsc should have created it)
  const distDataDir = path.join(workingDir, 'dist', 'data');
  if (!fs.existsSync(distDataDir)) {
    console.error(`❌ Dist directory not found: ${distDataDir}`);
    console.error('   Run "tsc" first.');
    process.exit(1);
  }

  // Create locales directory in dist
  fs.mkdirSync(distDir, { recursive: true });

  // Copy all JSON files
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.json'));

  console.log(`📦 Copying ${files.length} locale files to dist...`);

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const distPath = path.join(distDir, file);
    fs.copyFileSync(srcPath, distPath);
    console.log(`   ✓ ${file}`);
  }

  console.log(`✅ Locale files copied to ${distDir}`);
}

main().catch((error) => {
  console.error('❌ Error copying locales:', error);
  process.exit(1);
});
