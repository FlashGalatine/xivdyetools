/**
 * Build script to generate version.ts from package.json
 *
 * This script ensures the VERSION export in the library stays in sync
 * with package.json, addressing Issue #16.
 *
 * Run as part of the build process.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// Generate version.ts
const versionContent = `/**
 * Auto-generated version file
 * DO NOT EDIT MANUALLY - Generated from package.json during build
 * @see scripts/generate-version.ts
 */

/**
 * Current library version
 * Automatically synced with package.json version
 */
export const VERSION = '${packageJson.version}';
`;

const outputPath = join(__dirname, '..', 'src', 'version.ts');
writeFileSync(outputPath, versionContent);

console.log(`Generated version.ts with VERSION = '${packageJson.version}'`);
