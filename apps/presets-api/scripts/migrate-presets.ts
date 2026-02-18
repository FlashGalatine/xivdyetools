/**
 * Migration Script: Import existing presets from xivdyetools-core
 *
 * This script reads the presets.json from the core library and generates
 * SQL statements to seed the D1 database with curated presets.
 *
 * Usage:
 *   npm run db:migrate:local   # Apply schema
 *   npx tsx scripts/migrate-presets.ts > seed.sql
 *   wrangler d1 execute xivdyetools-presets --local --file=./seed.sql
 *
 * For production:
 *   wrangler d1 execute xivdyetools-presets --file=./seed.sql
 */

import * as fs from 'fs';
import * as path from 'path';

// Path to the presets.json in xivdyetools-core
const PRESETS_PATH = path.resolve(
  __dirname,
  '../../xivdyetools-core/src/data/presets.json'
);

interface PresetPalette {
  id: string;
  name: string;
  category: string;
  description: string;
  dyes: number[];
  tags: string[];
  author?: string;
  version?: string;
}

interface CategoryMeta {
  name: string;
  description: string;
  icon: string;
}

interface PresetData {
  version: string;
  lastUpdated: string;
  categories: Record<string, CategoryMeta>;
  palettes: PresetPalette[];
}

/**
 * Generate dye signature for duplicate detection
 */
function generateDyeSignature(dyes: number[]): string {
  const sorted = [...dyes].sort((a, b) => a - b);
  return JSON.stringify(sorted);
}

/**
 * Escape string for SQL
 */
function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Main migration function
 */
async function migrate(): Promise<void> {
  // Read presets data
  const rawData = fs.readFileSync(PRESETS_PATH, 'utf-8');
  const data: PresetData = JSON.parse(rawData);

  console.log('-- XIV Dye Tools: Curated Presets Migration');
  console.log('-- Generated:', new Date().toISOString());
  console.log(`-- Source: presets.json v${data.version}`);
  console.log('-- Total presets:', data.palettes.length);
  console.log('');

  // Generate category updates (in case icons differ from schema.sql)
  console.log('-- Update category metadata from source');
  for (const [id, meta] of Object.entries(data.categories)) {
    const isCurated = id !== 'community' ? 1 : 0;
    console.log(
      `UPDATE categories SET name = '${escapeSQL(meta.name)}', ` +
        `description = '${escapeSQL(meta.description)}', ` +
        `icon = '${escapeSQL(meta.icon)}', ` +
        `is_curated = ${isCurated} ` +
        `WHERE id = '${id}';`
    );
  }
  console.log('');

  // Generate preset inserts
  console.log('-- Insert curated presets');
  for (const preset of data.palettes) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dyeSignature = generateDyeSignature(preset.dyes);

    console.log(
      `INSERT OR IGNORE INTO presets (` +
        `id, name, description, category_id, dyes, tags, ` +
        `author_discord_id, author_name, vote_count, status, is_curated, ` +
        `created_at, updated_at, dye_signature` +
        `) VALUES (` +
        `'${id}', ` +
        `'${escapeSQL(preset.name)}', ` +
        `'${escapeSQL(preset.description)}', ` +
        `'${preset.category}', ` +
        `'${JSON.stringify(preset.dyes)}', ` +
        `'${JSON.stringify(preset.tags)}', ` +
        `NULL, ` + // author_discord_id
        `NULL, ` + // author_name
        `0, ` + // vote_count
        `'approved', ` +
        `1, ` + // is_curated = true
        `'${now}', ` +
        `'${now}', ` +
        `'${dyeSignature}'` +
        `);`
    );
  }

  console.log('');
  console.log('-- Migration complete');
}

// Run migration
migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
