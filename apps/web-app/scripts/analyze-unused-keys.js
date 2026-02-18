#!/usr/bin/env node
/**
 * Analyze unused translation keys in the codebase
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = join(__dirname, '..', 'src');
const LOCALES_DIR = join(SRC_DIR, 'locales');

// Flatten nested object to dot-notation keys
function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Recursively get all TypeScript files
function getFiles(dir) {
  const files = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (['node_modules', 'dist', '.git', '__tests__'].includes(entry)) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else if (stat.isFile() && ['.ts', '.tsx'].includes(extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

// Extract used keys from source files
function extractUsedKeys(files) {
  const usedKeys = new Set();
  const dynamicPrefixes = new Set();

  const patterns = [
    /LanguageService\.t\(\s*['"]([^'"]+)['"]\s*\)/g,
    /LanguageService\.tInterpolate\(\s*['"]([^'"]+)['"]\s*,/g,
  ];

  // Pattern for labelKey references (keys stored in objects)
  const labelKeyPattern = /labelKey:\s*['"]([^'"]+)['"]/g;

  // Pattern for dynamic keys with template literals
  const dynamicPattern = /LanguageService\.t\(`([^`$]+)\$/g;

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');

    // Direct LanguageService.t() calls
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        usedKeys.add(match[1]);
      }
    }

    // labelKey references
    labelKeyPattern.lastIndex = 0;
    let match;
    while ((match = labelKeyPattern.exec(content)) !== null) {
      usedKeys.add(match[1]);
    }

    // Dynamic prefixes (e.g., `themes.${var}` -> themes.*)
    dynamicPattern.lastIndex = 0;
    while ((match = dynamicPattern.exec(content)) !== null) {
      dynamicPrefixes.add(match[1]);
    }
  }

  return { usedKeys, dynamicPrefixes };
}

// Main
const enJson = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf-8'));
const allKeys = flattenKeys(enJson);
const files = getFiles(SRC_DIR);
const { usedKeys, dynamicPrefixes } = extractUsedKeys(files);

// Check if a key matches any dynamic prefix
function matchesDynamicPrefix(key) {
  for (const prefix of dynamicPrefixes) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

// Find unused keys (excluding meta.* and dynamically referenced)
const unusedKeys = allKeys.filter(k =>
  !usedKeys.has(k) &&
  !k.startsWith('meta.') &&
  !matchesDynamicPrefix(k)
);

// Keys matched by dynamic prefixes
const dynamicallyReferenced = allKeys.filter(k =>
  !usedKeys.has(k) &&
  !k.startsWith('meta.') &&
  matchesDynamicPrefix(k)
);

// Group by namespace
const byNamespace = new Map();
for (const key of unusedKeys) {
  const namespace = key.split('.')[0];
  if (!byNamespace.has(namespace)) byNamespace.set(namespace, []);
  byNamespace.get(namespace).push(key);
}

console.log('\n📊 UNUSED TRANSLATION KEYS ANALYSIS\n');
console.log('='.repeat(70));
console.log(`\nTotal keys defined: ${allKeys.length}`);
console.log(`Keys directly referenced: ${usedKeys.size}`);
console.log(`Keys dynamically referenced: ${dynamicallyReferenced.length}`);
console.log(`Truly unused keys: ${unusedKeys.length}`);
console.log(`Effective usage rate: ${((allKeys.length - unusedKeys.length) / allKeys.length * 100).toFixed(1)}%\n`);

if (dynamicPrefixes.size > 0) {
  console.log('🔄 Dynamic prefixes detected:');
  for (const prefix of dynamicPrefixes) {
    const matchCount = allKeys.filter(k => k.startsWith(prefix)).length;
    console.log(`   • "${prefix}*" (${matchCount} keys)`);
  }
  console.log('');
}

console.log('='.repeat(70));

// Sort namespaces by count (descending)
const sorted = [...byNamespace.entries()].sort((a, b) => b[1].length - a[1].length);

console.log('\n📁 UNUSED KEYS BY NAMESPACE\n');

for (const [namespace, keys] of sorted) {
  console.log(`\n## ${namespace} (${keys.length} unused)`);

  // Show first 10 keys
  for (const key of keys.slice(0, 10)) {
    // Get the value for context
    const parts = key.split('.');
    let value = enJson;
    for (const part of parts) {
      value = value?.[part];
    }
    const preview = typeof value === 'string' ? value.substring(0, 50) : '(object)';
    console.log(`   • ${key}`);
    console.log(`     "${preview}${value?.length > 50 ? '...' : ''}"`);
  }
  if (keys.length > 10) {
    console.log(`   ... and ${keys.length - 10} more`);
  }
}

// Categorize likely reasons
console.log('\n' + '='.repeat(70));
console.log('\n📋 ANALYSIS & RECOMMENDATIONS\n');

// Categorize unused keys
const tutorialKeys = unusedKeys.filter(k => k.startsWith('tutorial.'));
const featureKeys = unusedKeys.filter(k =>
  k.startsWith('mixer.') ||
  k.startsWith('matcher.') ||
  k.startsWith('welcome.') ||
  k.startsWith('export.')
);
const commonKeys = unusedKeys.filter(k => k.startsWith('common.'));
const otherKeys = unusedKeys.filter(k =>
  !k.startsWith('tutorial.') &&
  !k.startsWith('mixer.') &&
  !k.startsWith('matcher.') &&
  !k.startsWith('welcome.') &&
  !k.startsWith('export.') &&
  !k.startsWith('common.')
);

console.log('📚 CATEGORIZATION:\n');

console.log(`   🎓 Tutorial keys: ${tutorialKeys.length}`);
console.log('      These may be for planned/removed tutorial features\n');

console.log(`   🛠️  Feature-specific keys: ${featureKeys.length}`);
console.log('      (mixer, matcher, welcome, export namespaces)');
console.log('      Review if these features have been refactored\n');

console.log(`   🔧 Common utility keys: ${commonKeys.length}`);
console.log('      Generic labels that may be used in future features\n');

console.log(`   ❓ Other unused keys: ${otherKeys.length}`);
console.log('      May be safe to remove after manual review\n');

console.log('='.repeat(70));
console.log('\n💡 RECOMMENDATIONS:\n');

console.log('1. KEEP: Tutorial keys (36) - may be re-enabled in future');
console.log('2. REVIEW: Feature keys - check if features were removed');
console.log('3. CONSIDER KEEPING: Common utility keys for future use');
console.log('4. SAFE TO REMOVE: Keys for deprecated features\n');

// Potential bundle size impact
const avgKeySize = 50; // Average bytes per key (key + value + JSON overhead)
const potentialSavings = unusedKeys.length * avgKeySize * 6; // 6 locales
console.log(`📦 Potential bundle size reduction: ~${(potentialSavings / 1024).toFixed(1)} KB`);
console.log('   (if all unused keys were removed from all 6 locales)\n');

// Show orphaned keys grouped
console.log('Unused keys by namespace:');
for (const [namespace, keys] of sorted.slice(0, 15)) {
  console.log(`   • ${namespace}: ${keys.length} keys`);
}
