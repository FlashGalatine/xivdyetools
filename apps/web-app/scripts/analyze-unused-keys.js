#!/usr/bin/env node
/**
 * Orphaned i18n key detector for apps/web-app.
 *
 *   node scripts/analyze-unused-keys.js            # report, exit 1 if orphans
 *   node scripts/analyze-unused-keys.js --json     # machine-readable
 *
 * `scripts/validate-i18n.js` checks that every key the code references EXISTS;
 * this script checks the reverse — that every key the locales define is
 * REFERENCED. Both are needed: the 2026-08-16 dead-code audit found 472 keys
 * (26 % of every locale file) that nothing had read since the v3 → 5.0
 * rewrites, because only the "missing" direction was ever checked.
 *
 * `src/__tests__/i18n-orphans.test.ts` runs `findUnusedKeys()` in the unit
 * suite, so an orphan fails `pnpm test`.
 *
 * How a key counts as USED (any one is enough):
 *   1. Its full dot-path appears as a string literal anywhere in src/ (non-test):
 *      `LanguageService.t('a.b')`, `tInterpolate('a.b', …)`, `labelKey: 'a.b'`,
 *      arrays of keys, `` `a.b` `` — all the same to a literal scan.
 *   2. A template literal starts with one of its dotted prefixes followed by
 *      `${…}` — e.g. `` `harmony.types.${camel}Desc` `` marks every
 *      `harmony.types.*` reachable, `` `mixer.model${Model}` `` every
 *      `mixer.model*`. This is deliberately generous: a key under a dynamic
 *      prefix is treated as live even if the runtime value set never produces
 *      it, because the alternative (enumerating each template's value set) is
 *      what the audit had to do by hand and cannot be kept honest in a script.
 *   3. A template literal ENDS with `.${lastSegment}` … or, more precisely, a
 *      template of the shape `` `${…}.title` `` exists — the whole-prefix-is-a-
 *      variable pattern (`` `${tool.translationKey}.title` `` in
 *      v4-app-header.ts). Any key whose last segment matches such a suffix
 *      counts as reachable.
 *
 * `meta.*` (locale metadata) is never a translation key and is skipped.
 *
 * Plain JS (no build step) so it runs under bare `node`; typed for the test by
 * the sibling `analyze-unused-keys.d.ts`.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Flatten a nested locale object to dot-notation keys (arrays are leaves). */
export function flattenKeys(obj, prefix = '') {
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

/** Recursively list source files, skipping tests, locales, and build output. */
export function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', '__tests__', 'locales'].includes(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (
      stat.isFile() &&
      ['.ts', '.tsx', '.html'].includes(extname(entry)) &&
      !/\.(test|spec)\.tsx?$/.test(entry)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build the usage oracle from a corpus of source text.
 * @param {string} corpus - concatenated source
 */
export function buildUsageOracle(corpus) {
  // Rule 2: `` `dotted.prefix.${ `` — collect every prefix that precedes `${`
  // inside a template literal and looks like a key path (letters, digits, dots).
  const dynamicPrefixes = new Set();
  for (const m of corpus.matchAll(/`([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*\.?)\$\{/g)) {
    dynamicPrefixes.add(m[1]);
  }
  // Rule 3: `` `${…}.suffix` `` — a template whose static tail is `.segment`
  const dynamicSuffixes = new Set();
  for (const m of corpus.matchAll(/\}\.([a-zA-Z][a-zA-Z0-9]*)`/g)) {
    dynamicSuffixes.add(m[1]);
  }
  return {
    dynamicPrefixes,
    dynamicSuffixes,
    isUsed(key) {
      // Rule 1: exact literal
      if (new RegExp(`['"\`]${escapeRe(key)}['"\`]`).test(corpus)) return 'literal';
      // Rule 2: dynamic prefix — any prefix in the set that the key starts with
      for (const p of dynamicPrefixes) {
        if (key.startsWith(p) && key.length > p.length) return `prefix:${p}`;
      }
      // Rule 3: dynamic suffix
      const last = key.slice(key.lastIndexOf('.') + 1);
      if (key.includes('.') && dynamicSuffixes.has(last)) return `suffix:.${last}`;
      return null;
    },
  };
}

/**
 * Find locale keys nothing in src/ can reach.
 * @param {{ srcDir?: string, localesDir?: string, reference?: string }} [opts]
 * @returns {{ total: number, used: number, unused: string[], reasons: Record<string,string> }}
 */
export function findUnusedKeys(opts = {}) {
  const srcDir = opts.srcDir ?? join(HERE, '..', 'src');
  const localesDir = opts.localesDir ?? join(srcDir, 'locales');
  const reference = opts.reference ?? 'en';
  const locale = JSON.parse(readFileSync(join(localesDir, `${reference}.json`), 'utf-8'));
  const keys = flattenKeys(locale).filter((k) => !k.startsWith('meta.'));
  const corpus = listSourceFiles(srcDir)
    .map((f) => readFileSync(f, 'utf-8'))
    .join('\n');
  const oracle = buildUsageOracle(corpus);
  const unused = [];
  const reasons = {};
  for (const k of keys) {
    const why = oracle.isUsed(k);
    if (why) reasons[k] = why;
    else unused.push(k);
  }
  return { total: keys.length, used: keys.length - unused.length, unused, reasons };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = findUnusedKeys();
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify({ total: result.total, used: result.used, unused: result.unused }, null, 2)
    );
  } else {
    console.log(`\n🌍 i18n orphan check — ${result.total} keys in en.json (meta.* excluded)`);
    console.log(`   used: ${result.used}   orphaned: ${result.unused.length}\n`);
    if (result.unused.length) {
      const byNs = new Map();
      for (const k of result.unused) {
        const ns = k.split('.')[0];
        if (!byNs.has(ns)) byNs.set(ns, []);
        byNs.get(ns).push(k);
      }
      for (const [ns, list] of [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`   ${ns} (${list.length}):`);
        for (const k of list) console.log(`     • ${k}`);
      }
      console.log('\n   Remove them from ALL six locale files, or reference them.');
    } else {
      console.log('✅ No orphaned keys.');
    }
  }
  process.exit(result.unused.length ? 1 : 0);
}
