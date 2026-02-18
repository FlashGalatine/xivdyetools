#!/usr/bin/env node
/**
 * XIV Dye Tools - i18n Translation Key Validator
 *
 * Validates that all LanguageService.t() and LanguageService.tInterpolate() calls
 * reference keys that exist in the locale files.
 *
 * Also performs cross-locale structural comparison to detect keys missing in
 * non-English locale files.
 *
 * Usage:
 *   npm run validate:i18n
 *   node scripts/validate-i18n.js
 *   node scripts/validate-i18n.js --fix     # Shows suggested keys for typos
 *   node scripts/validate-i18n.js --strict  # Fail on cross-locale missing keys
 *
 * Exit codes:
 *   0 - All translation keys are valid
 *   1 - One or more missing keys found
 *   2 - Cross-locale keys missing (only with --strict)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const SRC_DIR = join(__dirname, '..', 'src');
const LOCALES_DIR = join(SRC_DIR, 'locales');
const PRIMARY_LOCALE = 'en.json';
const ALL_LOCALES = ['en.json', 'ja.json', 'de.json', 'fr.json', 'ko.json', 'zh.json'];

// Directories to skip
const SKIP_DIRS = ['node_modules', '__tests__', 'test', 'tests', '.git', 'dist'];

// File extensions to check
const CHECK_EXTENSIONS = ['.ts', '.tsx'];

// Regex patterns for extracting translation keys
const PATTERNS = [
  // LanguageService.t('key') or LanguageService.t("key")
  /LanguageService\.t\(\s*['"]([^'"]+)['"]\s*\)/g,
  // LanguageService.tInterpolate('key', ...) or LanguageService.tInterpolate("key", ...)
  /LanguageService\.tInterpolate\(\s*['"]([^'"]+)['"]\s*,/g,
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Flatten nested object to dot-notation keys
 * @param {object} obj - Nested object
 * @param {string} prefix - Current key prefix
 * @returns {Set<string>} Set of flattened keys
 */
function flattenKeys(obj, prefix = '') {
  const keys = new Set();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      for (const nestedKey of flattenKeys(value, fullKey)) {
        keys.add(nestedKey);
      }
    } else {
      // Leaf value
      keys.add(fullKey);
    }
  }

  return keys;
}

/**
 * Recursively get all files matching extensions
 * @param {string} dir - Directory to search
 * @param {string[]} extensions - File extensions to include
 * @returns {string[]} Array of file paths
 */
function getFiles(dir, extensions) {
  const files = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      // Skip excluded directories
      if (SKIP_DIRS.includes(entry)) continue;

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...getFiles(fullPath, extensions));
      } else if (stat.isFile() && extensions.includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Extract translation keys from a file
 * @param {string} filePath - Path to the file
 * @returns {Array<{key: string, line: number}>} Array of keys with line numbers
 */
function extractKeysFromFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const results = [];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const pattern of PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(line)) !== null) {
        results.push({
          key: match[1],
          line: lineNum + 1, // 1-indexed
        });
      }
    }
  }

  return results;
}

/**
 * Find similar keys (for typo suggestions)
 * @param {string} key - The missing key
 * @param {Set<string>} validKeys - Set of valid keys
 * @returns {string[]} Array of similar keys
 */
function findSimilarKeys(key, validKeys) {
  const similar = [];
  const keyParts = key.split('.');
  const namespace = keyParts[0];

  // Find keys in the same namespace
  for (const validKey of validKeys) {
    if (validKey.startsWith(namespace + '.')) {
      // Simple similarity: shared prefix or suffix
      const validParts = validKey.split('.');
      const lastPart = keyParts[keyParts.length - 1];
      const validLastPart = validParts[validParts.length - 1];

      // Check if last parts are similar (Levenshtein distance <= 3)
      if (levenshteinDistance(lastPart, validLastPart) <= 3) {
        similar.push(validKey);
      }
    }
  }

  return similar.slice(0, 3); // Return top 3 suggestions
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Compare all locale files against the primary locale (en.json)
 * @param {Set<string>} primaryKeys - Keys from en.json
 * @returns {{locale: string, missing: string[]}[]} Array of locales with their missing keys
 */
function compareLocales(primaryKeys) {
  const results = [];

  for (const localeFile of ALL_LOCALES) {
    if (localeFile === PRIMARY_LOCALE) continue;

    const localePath = join(LOCALES_DIR, localeFile);
    let localeData;

    try {
      const content = readFileSync(localePath, 'utf-8');
      localeData = JSON.parse(content);
    } catch (error) {
      console.error(`  ⚠️  Error loading ${localeFile}: ${error.message}`);
      continue;
    }

    const localeKeys = flattenKeys(localeData);
    const missing = [];

    for (const key of primaryKeys) {
      if (!localeKeys.has(key)) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      results.push({
        locale: localeFile.replace('.json', ''),
        file: localeFile,
        missing,
        totalKeys: localeKeys.size,
      });
    }
  }

  return results;
}

// ============================================================================
// Main
// ============================================================================

function validateI18n() {
  const showFix = process.argv.includes('--fix');
  const strictMode = process.argv.includes('--strict');

  console.log('\n🌐 i18n Translation Key Validator\n');
  console.log('='.repeat(70));

  // Load primary locale file
  const localePath = join(LOCALES_DIR, PRIMARY_LOCALE);
  let localeData;

  try {
    const content = readFileSync(localePath, 'utf-8');
    localeData = JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading locale file ${PRIMARY_LOCALE}:`, error.message);
    process.exit(1);
  }

  // Flatten keys
  const validKeys = flattenKeys(localeData);
  console.log(`📚 Loaded ${validKeys.size} translation keys from ${PRIMARY_LOCALE}\n`);

  // Get all source files
  const files = getFiles(SRC_DIR, CHECK_EXTENSIONS);
  console.log(`📁 Scanning ${files.length} source files...\n`);

  // Track results
  const missingKeys = [];
  let totalKeysChecked = 0;
  const keyUsage = new Map(); // Track which keys are used

  // Process each file
  for (const file of files) {
    const keys = extractKeysFromFile(file);
    const relativePath = relative(SRC_DIR, file);

    for (const { key, line } of keys) {
      totalKeysChecked++;

      // Track usage
      if (!keyUsage.has(key)) {
        keyUsage.set(key, []);
      }
      keyUsage.get(key).push({ file: relativePath, line });

      // Check if key exists
      if (!validKeys.has(key)) {
        missingKeys.push({
          key,
          file: relativePath,
          line,
          suggestions: showFix ? findSimilarKeys(key, validKeys) : [],
        });
      }
    }
  }

  console.log('='.repeat(70));

  // Report results
  if (missingKeys.length === 0) {
    console.log(`\n✅ All ${totalKeysChecked} translation key references are valid!\n`);

    // Show summary
    console.log('📊 Summary:');
    console.log(`   • Total keys in ${PRIMARY_LOCALE}: ${validKeys.size}`);
    console.log(`   • Keys referenced in code: ${keyUsage.size}`);
    console.log(`   • Total references checked: ${totalKeysChecked}`);

    // Find unused keys (optional info)
    const usedKeys = new Set(keyUsage.keys());
    const unusedKeys = [...validKeys].filter((k) => !usedKeys.has(k) && !k.startsWith('meta.'));
    if (unusedKeys.length > 0 && unusedKeys.length < 50) {
      console.log(`\n📋 Potentially unused keys (${unusedKeys.length}):`);
      for (const key of unusedKeys.slice(0, 10)) {
        console.log(`   • ${key}`);
      }
      if (unusedKeys.length > 10) {
        console.log(`   ... and ${unusedKeys.length - 10} more`);
      }
    }

    // Cross-locale structural comparison
    console.log('\n' + '='.repeat(70));
    console.log('\n🌍 Cross-Locale Structural Comparison\n');

    const localeIssues = compareLocales(validKeys);

    if (localeIssues.length === 0) {
      console.log('✅ All locale files have matching key structure!\n');
      console.log('📊 Locale Summary:');
      for (const localeFile of ALL_LOCALES) {
        const localePath = join(LOCALES_DIR, localeFile);
        try {
          const content = readFileSync(localePath, 'utf-8');
          const data = JSON.parse(content);
          const keys = flattenKeys(data);
          const locale = localeFile.replace('.json', '');
          const status = localeFile === PRIMARY_LOCALE ? '(reference)' : '✓';
          console.log(`   • ${locale}: ${keys.size} keys ${status}`);
        } catch {
          console.log(`   • ${localeFile.replace('.json', '')}: ⚠️ Error reading file`);
        }
      }
      console.log('');
      process.exit(0);
    } else {
      const totalMissing = localeIssues.reduce((sum, l) => sum + l.missing.length, 0);
      console.log(`⚠️  Found ${totalMissing} missing key(s) across ${localeIssues.length} locale(s):\n`);

      for (const { locale, file, missing, totalKeys } of localeIssues) {
        console.log(`📄 ${file} (${totalKeys} keys, missing ${missing.length}):`);

        // Group missing keys by namespace
        const byNamespace = new Map();
        for (const key of missing) {
          const namespace = key.split('.')[0];
          if (!byNamespace.has(namespace)) {
            byNamespace.set(namespace, []);
          }
          byNamespace.get(namespace).push(key);
        }

        for (const [namespace, keys] of byNamespace) {
          console.log(`   ${namespace}.*: ${keys.length} missing`);
          for (const key of keys.slice(0, 5)) {
            console.log(`      • ${key}`);
          }
          if (keys.length > 5) {
            console.log(`      ... and ${keys.length - 5} more in ${namespace}`);
          }
        }
        console.log('');
      }

      console.log('='.repeat(70));
      if (strictMode) {
        console.log(`\n❌ Cross-locale validation FAILED (--strict mode)`);
        console.log('   Add missing keys to the affected locale files.\n');
        process.exit(2);
      } else {
        console.log(`\n⚠️  Cross-locale keys missing (run with --strict to fail on this)`);
        console.log('   Consider adding missing keys to maintain translation parity.\n');
        process.exit(0);
      }
    }
  } else {
    console.log(`\n❌ Found ${missingKeys.length} missing translation key(s):\n`);

    // Group by file
    const byFile = new Map();
    for (const missing of missingKeys) {
      if (!byFile.has(missing.file)) {
        byFile.set(missing.file, []);
      }
      byFile.get(missing.file).push(missing);
    }

    // Print grouped results
    for (const [file, keys] of byFile) {
      console.log(`📄 ${file}`);
      for (const { key, line, suggestions } of keys) {
        console.log(`   Line ${line}: "${key}"`);
        if (showFix && suggestions.length > 0) {
          console.log(`      💡 Did you mean: ${suggestions.join(', ')}`);
        }
      }
      console.log('');
    }

    console.log('='.repeat(70));
    console.log(`\n❌ i18n validation FAILED - ${missingKeys.length} missing key(s)\n`);
    console.log('To fix:');
    console.log('  1. Add missing keys to src/locales/en.json');
    console.log('  2. Or fix typos in the translation key references');
    console.log('  3. Run with --fix flag to see suggestions: npm run validate:i18n -- --fix\n');
    process.exit(1);
  }
}

validateI18n();
