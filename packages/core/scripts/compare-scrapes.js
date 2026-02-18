/**
 * Compare HTML scrape files with locale JSON files
 * Generates a diff report of any discrepancies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const scrapesDir = path.join(__dirname, '..', 'scrapes');
const localesDir = path.join(__dirname, '..', 'src', 'data', 'locales');

// Language mappings (scrape filename -> locale filename)
const langMappings = {
  'en': 'en',
  'ja': 'ja',
  'de': 'de',
  'fr': 'fr',
  'kr': 'ko', // Note: scrape uses 'kr', locale uses 'ko'
  'zh': 'zh'
};

/**
 * Extract dye names from HTML scrape file
 * The HTML structure is: href="/market/{ID}" ... <span class="item-level">30</span> {Name}</div>
 */
function extractDyeNamesFromHtml(html) {
  const dyeNames = new Map();

  // Primary pattern: href="/market/{ID}" ... item-level ... {Name}</div>
  // Example: href="/market/5729">...<span class="item-level">30</span> Snow White Dye</div>
  const marketPattern = /href="\/market\/(\d+)"[^>]*>.*?<span class="item-level">\d+<\/span>\s*([^<]+)<\/div>/gs;
  let match;
  while ((match = marketPattern.exec(html)) !== null) {
    const id = match[1];
    let name = match[2].trim();
    // Remove " Dye" suffix if present (some languages include it, some don't)
    // We'll keep the full name for comparison
    if (isLikelyDyeId(id) && name.length > 0) {
      dyeNames.set(id, name);
    }
  }

  // Secondary pattern for Japanese/other formats that might differ slightly
  // href="/market/{ID}">...<div>...<span class="item-level">X</span> {Name}</div>
  const altPattern = /href="\/market\/(\d+)"[^>]*>[^<]*(?:<[^>]+>[^<]*)*<span[^>]*class="item-level"[^>]*>\d+<\/span>\s*([^<]+)/g;
  while ((match = altPattern.exec(html)) !== null) {
    const id = match[1];
    const name = match[2].trim();
    if (isLikelyDyeId(id) && name.length > 0 && !dyeNames.has(id)) {
      dyeNames.set(id, name);
    }
  }

  return dyeNames;
}

/**
 * Check if an ID is likely a dye item ID
 * Dye IDs are in specific ranges based on FFXIV game data
 */
function isLikelyDyeId(id) {
  const numId = parseInt(id, 10);
  // Known dye ID ranges
  return (numId >= 5729 && numId <= 5813) ||  // Base dyes
         (numId >= 13114 && numId <= 13117) || // Pure White, Jet Black, Metallic Silver/Gold
         (numId >= 13708 && numId <= 13723) || // Pastel/Dark/Metallic dyes
         (numId >= 30116 && numId <= 30124) || // Ruby Red to Metallic Brass
         (numId >= 48163 && numId <= 48172) || // Neon dyes
         numId === 48227;                       // Carmine Red
}

/**
 * Load locale JSON file
 */
function loadLocale(lang) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Locale file not found: ${filePath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Compare scrape data with locale data
 */
function compareData(scrapeLang, localeLang) {
  const scrapeFile = path.join(scrapesDir, `${scrapeLang}.html`);

  if (!fs.existsSync(scrapeFile)) {
    console.log(`Scrape file not found: ${scrapeFile}`);
    return null;
  }

  console.log(`\nProcessing ${scrapeLang}.html -> ${localeLang}.json...`);

  const html = fs.readFileSync(scrapeFile, 'utf8');
  const scraped = extractDyeNamesFromHtml(html);
  const locale = loadLocale(localeLang);

  if (!locale) return null;

  const localeNames = locale.dyeNames || {};
  const differences = [];
  const missing = [];
  const extra = [];

  // Check for differences and missing in locale
  for (const [id, scrapedName] of scraped.entries()) {
    const localeName = localeNames[id];
    if (!localeName) {
      missing.push({ id, scraped: scrapedName });
    } else if (localeName !== scrapedName) {
      differences.push({ id, scraped: scrapedName, locale: localeName });
    }
  }

  // Check for extra in locale (not in scrape)
  for (const id of Object.keys(localeNames)) {
    if (!scraped.has(id)) {
      extra.push({ id, locale: localeNames[id] });
    }
  }

  return {
    lang: localeLang,
    scrapedCount: scraped.size,
    localeCount: Object.keys(localeNames).length,
    differences,
    missing,
    extra
  };
}

/**
 * Main execution
 */
function main() {
  console.log('='.repeat(60));
  console.log('FFXIV Dye Localization Scrape Comparison Report');
  console.log('='.repeat(60));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('');

  const results = [];

  for (const [scrapeLang, localeLang] of Object.entries(langMappings)) {
    const result = compareData(scrapeLang, localeLang);
    if (result) {
      results.push(result);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    console.log(`\n[${result.lang.toUpperCase()}]`);
    console.log(`  Scraped items: ${result.scrapedCount}`);
    console.log(`  Locale items: ${result.localeCount}`);
    console.log(`  Differences: ${result.differences.length}`);
    console.log(`  Missing in locale: ${result.missing.length}`);
    console.log(`  Extra in locale: ${result.extra.length}`);

    if (result.differences.length > 0) {
      console.log('\n  Differences found:');
      for (const diff of result.differences.slice(0, 10)) {
        console.log(`    ID ${diff.id}:`);
        console.log(`      Scraped: "${diff.scraped}"`);
        console.log(`      Locale:  "${diff.locale}"`);
      }
      if (result.differences.length > 10) {
        console.log(`    ... and ${result.differences.length - 10} more`);
      }
    }

    if (result.missing.length > 0) {
      console.log('\n  Missing in locale (first 5):');
      for (const item of result.missing.slice(0, 5)) {
        console.log(`    ID ${item.id}: "${item.scraped}"`);
      }
      if (result.missing.length > 5) {
        console.log(`    ... and ${result.missing.length - 5} more`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('END OF REPORT');
  console.log('='.repeat(60));
}

main();
