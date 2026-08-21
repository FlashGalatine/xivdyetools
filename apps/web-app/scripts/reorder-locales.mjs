#!/usr/bin/env node
/**
 * Rewrite the non-English locale files so their key order matches `en.json`
 * recursively. **Values are never touched** — this is a pure permutation.
 *
 *   node scripts/reorder-locales.mjs            # rewrite de/fr/ja/ko/zh
 *   node scripts/reorder-locales.mjs --check    # report only, exit 1 if drift
 *
 * Why this exists: the six locale files are edited by hand, and an appended
 * key lands wherever the editor put it. Once the order drifts, every review
 * diff between two locales is noise and "insert at the same position in all
 * six files" (the plan's locale rule) stops being checkable by eye. The
 * 2026-08-20 i18n audit found all five targets out of order.
 *
 * The permutation is order-only and provably value-preserving: run
 * `--check` before and after, or diff a sorted `key\tvalue` dump of each file
 * across the rewrite — it must be empty. `scripts/validate-i18n.js` gates the
 * result so the order cannot drift again silently.
 *
 * Keys present in a target but absent from `en.json` keep their relative order
 * and are appended after the `en`-ordered ones inside their parent object;
 * they are also reported, because `scripts/i18n-parity.mjs` fails on them.
 *
 * @module scripts/reorder-locales
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(HERE, '..', 'src', 'locales');
const REFERENCE = 'en';
export const TARGET_LOCALES = ['de', 'fr', 'ja', 'ko', 'zh'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Rebuild `target` with `reference`'s key order, recursively.
 * Values (including whole arrays) are copied by reference — never rewritten.
 *
 * @param {unknown} reference - the `en` node
 * @param {unknown} target - the same node in the locale being reordered
 * @param {string[]} extras - collects dot-paths present only in `target`
 * @param {string} path - current dot-path (for `extras`)
 * @returns {unknown} the reordered node
 */
export function reorderNode(reference, target, extras = [], path = '') {
  if (!isPlainObject(reference) || !isPlainObject(target)) return target;

  const out = {};
  for (const key of Object.keys(reference)) {
    if (!(key in target)) continue; // missing keys are parity's problem, not ours
    const childPath = path ? `${path}.${key}` : key;
    out[key] = reorderNode(reference[key], target[key], extras, childPath);
  }
  // Anything `en` does not know about, in its original relative order.
  for (const key of Object.keys(target)) {
    if (key in out) continue;
    const childPath = path ? `${path}.${key}` : key;
    extras.push(childPath);
    out[key] = target[key];
  }
  return out;
}

/** Serialize exactly the way the locale files are stored: 2-space, LF, trailing newline. */
export function serializeLocale(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const reference = JSON.parse(readFileSync(join(LOCALES_DIR, `${REFERENCE}.json`), 'utf-8'));

  let drift = 0;
  for (const locale of TARGET_LOCALES) {
    const file = join(LOCALES_DIR, `${locale}.json`);
    const before = readFileSync(file, 'utf-8');
    const parsed = JSON.parse(before);
    const extras = [];
    const after = serializeLocale(reorderNode(reference, parsed, extras));

    if (extras.length > 0) {
      console.log(`  ⚠️  ${locale}: ${extras.length} key(s) not in en.json: ${extras.join(', ')}`);
    }

    if (after === before) {
      console.log(`  ✓ ${locale}.json already matches en.json key order`);
      continue;
    }

    drift++;
    if (checkOnly) {
      console.log(`  ✗ ${locale}.json key order differs from en.json`);
    } else {
      writeFileSync(file, after, 'utf-8');
      console.log(`  ↻ ${locale}.json reordered to match en.json`);
    }
  }

  if (checkOnly && drift > 0) {
    console.log(
      `\n❌ ${drift} locale file(s) out of order — run: node scripts/reorder-locales.mjs\n`
    );
    process.exit(1);
  }
  console.log('');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
