#!/usr/bin/env node
/**
 * Cross-locale parity gate for `src/locales/*.json`.
 *
 *   node scripts/i18n-parity.mjs           # human report (run by `npm run validate:i18n`)
 *   node scripts/i18n-parity.mjs --json    # machine-readable, always exits 0
 *
 * This is the JS port of the one-off Python check whose output is preserved at
 * `docs/audits/2026-08-20-web-app-i18n/evidence/locale-parity.txt`. That audit
 * found the locale files structurally sound but the *order* drifted and 87
 * values still literally English — facts nothing in CI could have told us.
 *
 * What it checks, per target locale (de/fr/ja/ko/zh) against `en.json`:
 *
 *   duplicate keys  ERROR — a duplicate key silently wins over its twin in
 *                   `JSON.parse`, so the earlier translation is dead text that
 *                   no structural key-set comparison can see. Detected by a
 *                   real tokenizer (below), because `JSON.parse` has already
 *                   collapsed the duplicate before any reviver runs.
 *   missing / extra ERROR — the key sets must be identical (the plan's rule:
 *                   every key lands in all six files in the same commit).
 *   placeholders    ERROR — `{name}` tokens must match `en` exactly, or
 *                   `LanguageService.tInterpolate()` renders a literal brace.
 *   empty           ERROR — an empty target value renders as nothing, which is
 *                   worse than showing English.
 *   identical-to-EN WARNING — reported unless allow-listed in
 *                   `scripts/i18n-identical-allowlist.json`. Legitimate cases
 *                   (brands, units, symbols, identifiers, cognates) are
 *                   enumerated there with a reason; anything else is an
 *                   untranslated string. Allow-list entries that are no longer
 *                   identical are reported as stale, so the file cannot rot.
 *   same-English    ERROR — keys that share one English value must share one
 *                   value in every other locale, unless the group is listed in
 *                   `scripts/i18n-same-english-allowlist.json` with a reason
 *                   (a verb vs an adjective, French agreement, a theme name vs
 *                   a lightness range). This is the check that would have caught
 *                   three terminology findings of the 2026-09-19 audit at PR
 *                   time; a stale allow-list entry is an error too.
 *
 * None of this ran in CI until 2026-09-20: `validate:i18n` is in no workflow.
 * `scripts/i18n-parity-gate.test.js` now runs `checkParity()` under vitest, so
 * every ERROR above — and an un-allow-listed identical value — fails `test`.
 *
 * Key ORDER and stray leading/trailing whitespace are gated by
 * `scripts/validate-i18n.js`, which runs first in `npm run validate:i18n`.
 *
 * @module scripts/i18n-parity
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(HERE, '..', 'src', 'locales');
const ALLOWLIST_FILE = join(HERE, 'i18n-identical-allowlist.json');
const SAME_ENGLISH_ALLOWLIST_FILE = join(HERE, 'i18n-same-english-allowlist.json');
const REFERENCE = 'en';
const TARGETS = ['de', 'fr', 'ja', 'ko', 'zh'];

// ============================================================================
// JSON tokenizer + parser that survives duplicate keys
// ============================================================================

/**
 * Tokenize JSON text. Only what a locale file can contain is supported.
 * @param {string} text
 * @returns {{ type: string, value?: unknown, line: number }[]}
 */
function tokenize(text) {
  const tokens = [];
  let i = 0;
  let line = 1;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      continue;
    }
    if ('{}[],:'.includes(ch)) {
      tokens.push({ type: ch, line });
      i++;
      continue;
    }
    if (ch === '"') {
      const start = i;
      i++;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === '"') break;
        if (text[i] === '\n') line++;
        i++;
      }
      if (i >= text.length) throw new SyntaxError(`Unterminated string at line ${line}`);
      i++; // closing quote
      tokens.push({ type: 'string', value: JSON.parse(text.slice(start, i)), line });
      continue;
    }
    // number / true / false / null
    const rest = text.slice(i);
    const m = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(rest);
    if (!m) throw new SyntaxError(`Unexpected character ${JSON.stringify(ch)} at line ${line}`);
    tokens.push({ type: 'literal', value: JSON.parse(m[1]), line });
    i += m[1].length;
  }

  return tokens;
}

/**
 * Parse JSON, recording every duplicate key with its dot-path and line.
 *
 * `JSON.parse(text, reviver)` cannot do this: the reviver walks an object that
 * has already lost the earlier of the two values.
 *
 * @param {string} text
 * @returns {{ value: unknown, duplicates: { path: string, line: number }[] }}
 */
export function parseJsonWithDuplicates(text) {
  const tokens = tokenize(text);
  const duplicates = [];
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (type) => {
    const token = next();
    if (!token || token.type !== type) {
      throw new SyntaxError(
        `Expected ${type} but found ${token ? token.type : 'end of input'} at line ${token ? token.line : '?'}`
      );
    }
    return token;
  };

  function parseValue(path) {
    const token = peek();
    if (!token) throw new SyntaxError('Unexpected end of input');

    if (token.type === '{') {
      next();
      /** @type {Record<string, unknown>} */
      const obj = {};
      const seen = new Set();
      if (peek() && peek().type === '}') {
        next();
        return obj;
      }
      for (;;) {
        const keyToken = expect('string');
        const key = /** @type {string} */ (keyToken.value);
        const childPath = path ? `${path}.${key}` : key;
        expect(':');
        const value = parseValue(childPath);
        if (seen.has(key)) duplicates.push({ path: childPath, line: keyToken.line });
        seen.add(key);
        obj[key] = value; // last one wins, exactly like JSON.parse
        const sep = next();
        if (!sep) throw new SyntaxError('Unexpected end of input in object');
        if (sep.type === '}') break;
        if (sep.type !== ',') throw new SyntaxError(`Expected , or } at line ${sep.line}`);
      }
      return obj;
    }

    if (token.type === '[') {
      next();
      const arr = [];
      if (peek() && peek().type === ']') {
        next();
        return arr;
      }
      for (;;) {
        arr.push(parseValue(`${path}[${arr.length}]`));
        const sep = next();
        if (!sep) throw new SyntaxError('Unexpected end of input in array');
        if (sep.type === ']') break;
        if (sep.type !== ',') throw new SyntaxError(`Expected , or ] at line ${sep.line}`);
      }
      return arr;
    }

    next();
    return token.value;
  }

  const value = parseValue('');
  if (pos !== tokens.length) throw new SyntaxError('Trailing content after JSON value');
  return { value, duplicates };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Flatten to an ordered `Map<dotPath, leafValue>` (arrays are leaves).
 * @param {unknown} obj
 * @param {string} [prefix]
 * @param {Map<string, unknown>} [out]
 * @returns {Map<string, unknown>}
 */
export function flattenEntries(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(/** @type {object} */ (obj))) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenEntries(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

/** `{name}` interpolation tokens, sorted and de-duplicated. */
export function placeholders(value) {
  if (typeof value !== 'string') return [];
  return [...new Set([...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]))].sort();
}

function loadAllowlist() {
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf-8'));
    /** @type {Record<string, Record<string, string>>} */
    const byLocale = {};
    for (const locale of TARGETS) byLocale[locale] = raw[locale] ?? {};
    return byLocale;
  } catch (error) {
    console.error(`❌ Cannot read ${ALLOWLIST_FILE}: ${error.message}`);
    process.exit(1);
  }
}

function loadSameEnglishAllowlist() {
  try {
    const raw = JSON.parse(readFileSync(SAME_ENGLISH_ALLOWLIST_FILE, 'utf-8'));
    /** @type {Record<string, Record<string, string>>} */
    const byEnglish = {};
    for (const [english, locales] of Object.entries(raw)) {
      if (english.startsWith('_')) continue; // _readme
      byEnglish[english] = /** @type {Record<string, string>} */ (locales);
    }
    return byEnglish;
  } catch (error) {
    console.error(`❌ Cannot read ${SAME_ENGLISH_ALLOWLIST_FILE}: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Same English, same translation.
 *
 * Groups the reference keys by their exact English value; a group diverges in
 * a locale when its keys do not all carry one value there. Exact match only, on
 * purpose: `Light` and `light` are usually different parts of speech, and a
 * case-folded rule would train people to allow-list by reflex.
 *
 * Pure — takes the flattened entries — so the unit tests can prove it fails.
 *
 * @param {Map<string, unknown>} refEntries
 * @param {Map<string, Map<string, unknown>>} entriesByLocale
 * @param {Record<string, Record<string, string>>} allowlist English value → { locale | '*': reason }
 */
export function findSameEnglishDivergences(refEntries, entriesByLocale, allowlist) {
  /** @type {Map<string, string[]>} */
  const byEnglish = new Map();
  for (const [key, value] of refEntries) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const keys = byEnglish.get(value);
    if (keys) keys.push(key);
    else byEnglish.set(value, [key]);
  }

  const divergences = [];
  let groups = 0;
  for (const [english, keys] of byEnglish) {
    if (keys.length < 2) continue;
    groups++;
    for (const [locale, entries] of entriesByLocale) {
      /** @type {Map<unknown, string[]>} */
      const clusters = new Map();
      for (const key of keys) {
        if (!entries.has(key)) continue; // a missing key is reported as MISSING, once
        const value = entries.get(key);
        const cluster = clusters.get(value);
        if (cluster) cluster.push(key);
        else clusters.set(value, [key]);
      }
      if (clusters.size < 2) continue;
      const entry = allowlist[english];
      divergences.push({
        english,
        locale,
        clusters: [...clusters].map(([value, clusterKeys]) => ({ value, keys: clusterKeys })),
        allowed: Boolean(entry && (locale in entry || '*' in entry)),
      });
    }
  }

  // An allow-list entry that no longer describes a divergence is dead weight,
  // and the next person to read it will believe it.
  const live = new Set(divergences.map((d) => `${d.english}\u0000${d.locale}`));
  const liveEnglish = new Set(divergences.map((d) => d.english));
  const stale = [];
  for (const [english, locales] of Object.entries(allowlist)) {
    for (const locale of Object.keys(locales)) {
      const isLive = locale === '*' ? liveEnglish.has(english) : live.has(`${english}\u0000${locale}`);
      if (!isLive) stale.push({ english, locale });
    }
  }

  return { groups, divergences, unexpected: divergences.filter((d) => !d.allowed), stale };
}

// ============================================================================
// Main
// ============================================================================

/**
 * Run every parity check.
 * @returns {{ reference: { locale: string, keys: number, duplicates: unknown[] }, locales: unknown[], sameEnglish: ReturnType<typeof findSameEnglishDivergences> }}
 */
export function checkParity() {
  const allowlist = loadAllowlist();

  const refRaw = readFileSync(join(LOCALES_DIR, `${REFERENCE}.json`), 'utf-8');
  const { value: refValue, duplicates: refDuplicates } = parseJsonWithDuplicates(refRaw);
  const refEntries = flattenEntries(refValue);

  const locales = [];
  /** @type {Map<string, Map<string, unknown>>} */
  const entriesByLocale = new Map();
  for (const locale of TARGETS) {
    const raw = readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf-8');
    const { value, duplicates } = parseJsonWithDuplicates(raw);
    const entries = flattenEntries(value);
    entriesByLocale.set(locale, entries);

    const missing = [...refEntries.keys()].filter((k) => !entries.has(k));
    const extra = [...entries.keys()].filter((k) => !refEntries.has(k));
    const placeholderMismatch = [];
    const empty = [];
    const identical = [];

    for (const [key, refText] of refEntries) {
      if (!entries.has(key)) continue;
      const text = entries.get(key);

      const refTokens = placeholders(refText);
      const tokens = placeholders(text);
      if (refTokens.join('|') !== tokens.join('|')) {
        placeholderMismatch.push({ key, expected: refTokens, actual: tokens });
      }

      if (typeof text === 'string' && text.trim() === '' && String(refText).trim() !== '') {
        empty.push(key);
      }

      if (
        typeof text === 'string' &&
        typeof refText === 'string' &&
        text === refText &&
        text !== ''
      ) {
        identical.push({ key, value: text, allowed: key in allowlist[locale] });
      }
    }

    const identicalKeys = new Set(identical.map((i) => i.key));
    const staleAllowlist = Object.keys(allowlist[locale]).filter((k) => !identicalKeys.has(k));

    locales.push({
      locale,
      keys: entries.size,
      duplicates,
      missing,
      extra,
      placeholderMismatch,
      empty,
      identical,
      identicalAllowed: identical.filter((i) => i.allowed).length,
      identicalUnexpected: identical.filter((i) => !i.allowed),
      staleAllowlist,
    });
  }

  return {
    reference: { locale: REFERENCE, keys: refEntries.size, duplicates: refDuplicates },
    locales,
    sameEnglish: findSameEnglishDivergences(refEntries, entriesByLocale, loadSameEnglishAllowlist()),
  };
}

function main() {
  const asJson = process.argv.includes('--json');
  const report = checkParity();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n🔁 i18n Locale Parity\n');
  console.log('='.repeat(70));
  console.log(`EN keys ${report.reference.keys}`);

  let errors = 0;
  let warnings = 0;

  if (report.reference.duplicates.length > 0) {
    errors += report.reference.duplicates.length;
    console.log(`\n❌ en.json has ${report.reference.duplicates.length} duplicate key(s):`);
    for (const d of report.reference.duplicates) console.log(`   • ${d.path} (line ${d.line})`);
  }

  for (const r of report.locales) {
    const counts =
      `dups=${r.duplicates.length} missing=${r.missing.length} extra=${r.extra.length} ` +
      `identical=${r.identical.length} empty=${r.empty.length} varMismatch=${r.placeholderMismatch.length}`;
    console.log(`\n== ${r.locale}: ${counts}`);

    const hard =
      r.duplicates.length +
      r.missing.length +
      r.extra.length +
      r.placeholderMismatch.length +
      r.empty.length;
    errors += hard;

    for (const d of r.duplicates) console.log(`  ❌ DUP     ${d.path} (line ${d.line})`);
    for (const k of r.missing.slice(0, 20)) console.log(`  ❌ MISSING ${k}`);
    if (r.missing.length > 20) console.log(`  … and ${r.missing.length - 20} more missing`);
    for (const k of r.extra.slice(0, 20)) console.log(`  ❌ EXTRA   ${k}`);
    if (r.extra.length > 20) console.log(`  … and ${r.extra.length - 20} more extra`);
    for (const k of r.empty) console.log(`  ❌ EMPTY   ${k}`);
    for (const m of r.placeholderMismatch) {
      console.log(
        `  ❌ VARS    ${m.key}: en {${m.expected.join(', ')}} vs ${r.locale} {${m.actual.join(', ')}}`
      );
    }

    for (const i of r.identicalUnexpected) {
      warnings++;
      console.log(`  ⚠️  SAME    ${i.key} = ${JSON.stringify(i.value)}`);
    }
    for (const k of r.staleAllowlist) {
      warnings++;
      console.log(`  ⚠️  STALE   allow-list entry no longer identical: ${k}`);
    }
    if (r.identicalAllowed > 0) {
      console.log(`  ✓ ${r.identicalAllowed} identical value(s) allow-listed as intentional`);
    }
  }

  const same = report.sameEnglish;
  console.log(
    `\n== same English, same translation: ${same.groups} groups, ` +
      `${same.divergences.length} diverge, ${same.unexpected.length} not allow-listed`
  );
  for (const d of same.unexpected) {
    errors++;
    console.log(`  ❌ SPLIT   ${d.locale}: ${JSON.stringify(d.english)} is translated ${d.clusters.length} ways`);
    for (const c of d.clusters) console.log(`             ${JSON.stringify(c.value)} ← ${c.keys.join(', ')}`);
  }
  for (const s of same.stale) {
    errors++;
    console.log(`  ❌ STALE   same-English allow-list entry no longer diverges: ${JSON.stringify(s.english)} (${s.locale})`);
  }
  if (same.unexpected.length > 0) {
    console.log(
      '   Give the keys one translation, or list the group in scripts/i18n-same-english-allowlist.json with a reason.'
    );
  }

  console.log('\n' + '='.repeat(70));
  if (errors > 0) {
    console.log(`\n❌ i18n parity FAILED — ${errors} error(s), ${warnings} warning(s)\n`);
    process.exit(1);
  }
  if (warnings > 0) {
    console.log(`\n⚠️  i18n parity passed with ${warnings} warning(s).`);
    console.log(
      '   Translate the value, or add it to scripts/i18n-identical-allowlist.json with a reason.\n'
    );
    return;
  }
  console.log('\n✅ i18n parity clean — no duplicates, no drift, no untranslated values.\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
