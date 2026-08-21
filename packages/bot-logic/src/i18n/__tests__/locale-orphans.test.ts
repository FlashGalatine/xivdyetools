/**
 * bot-logic i18n Orphan Gate (DEAD-011)
 *
 * Mirrors the web-app's orphan gate (`apps/web-app/src/__tests__/i18n-orphans.test.ts`)
 * but stays self-contained here — no shared script, no new deps, just Node
 * `fs` + vitest. It runs the reverse check of `translator.t()` usage: instead
 * of asking "does every key the code references exist in the locale?", it
 * asks "does every key the locale defines get read by something?".
 *
 * The 2026-08-18 dead-code audit (DEAD-011) found 211 of 621 keys (34%) were
 * never read by any of the four consumer trees, plus 38 more read only from
 * test mock tables. Both sets were deleted from all six locale files in the
 * same change that added this gate — see CHANGELOG.md and
 * `docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-011.md`.
 *
 * A key counts as reachable if either is true:
 *   1. Its full dot-path appears as a quoted string literal ('a.b', "a.b", or
 *      `a.b`) anywhere in a non-test .ts/.tsx file under one of the four
 *      consumer trees: packages/bot-logic/src, packages/svg/src,
 *      apps/discord-worker/src, apps/stoat-worker/src.
 *   2. It is one of the ENUMERATED keys below — namespaces built from a
 *      runtime value rather than a literal, so a plain text scan can never
 *      see the reference. These are enumerated EXACTLY (not by prefix), so a
 *      future dead key added under the same namespace (e.g.
 *      `accessibility.someUnusedKey`, `preferences.keys.deadPref`) still
 *      fails the gate instead of riding along on the namespace:
 *        - `accessibility.${lens}` for each of bot-logic's own `VISION_TYPES`
 *          (imported directly — same package, so it can never drift silently).
 *        - `preferences.keys.${key}` for each of discord-worker's
 *          `PREFERENCE_ORDER` plus the separate `filters` key
 *          (`apps/discord-worker/src/handlers/commands/preferences.ts`).
 *        - `manual5.topics.${topic}.name` / `.body` for each value in
 *          discord-worker's `TOPIC_KEYS`
 *          (`apps/discord-worker/src/handlers/commands/manual.ts`).
 *        - `preferences.filters.labels.${option}` for each `option` in
 *          discord-worker's `FILTER_OPTION_KEYS` (preferences.ts), and
 *          `preferences.methods.${method}` / `preferences.blendingModes.${mode}`
 *          for core's `MATCHING_METHOD_TAGS` keys / `BLENDING_MODES` values
 *          (2026-08-20 i18n audit, F-05 — rendered via template keys).
 *        - `meta.locale` / `meta.name` — never read via `t()` (only
 *          `Translator.getLocale()` reads the constructor-stored locale
 *          directly), but the block is a structural part of every locale
 *          file (see `../locales.test.ts`'s "valid meta block" check).
 *          `meta.flag` / `meta.nativeName` fed the now-deleted
 *          `Translator.getMeta()` (DEAD-013 / Task 7) and were removed from
 *          `LocaleData` and all six locale files in the same change.
 *
 *      bot-logic must not import discord-worker, so the two discord-worker
 *      lists are extracted at test time by reading the source file and
 *      regex-matching the array/object literal. If discord-worker reshapes
 *      either declaration enough that the regex stops matching, extraction
 *      throws — this gate fails loudly instead of silently treating a whole
 *      namespace as reachable.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VISION_TYPES } from '../../commands/accessibility.js';
import { MATCHING_METHOD_TAGS } from '@xivdyetools/core';
import { BLENDING_MODES } from '@xivdyetools/core/blending';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/bot-logic/src/i18n/__tests__ -> packages/bot-logic/src
const BOT_LOGIC_SRC = join(HERE, '..', '..');
// packages/bot-logic/src -> packages
const PACKAGES_DIR = join(BOT_LOGIC_SRC, '..', '..');
// packages -> repo root
const REPO_ROOT = join(PACKAGES_DIR, '..');

const LOCALES_DIR = join(HERE, '..', 'locales');
const LOCALE_CODES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;

const DISCORD_WORKER_SRC = join(REPO_ROOT, 'apps', 'discord-worker', 'src');
const PREFERENCES_TS = join(DISCORD_WORKER_SRC, 'handlers', 'commands', 'preferences.ts');
const MANUAL_TS = join(DISCORD_WORKER_SRC, 'handlers', 'commands', 'manual.ts');

/** The four consumer trees the DEAD-011 finding scanned. */
const CONSUMER_DIRS = [
  BOT_LOGIC_SRC,
  join(PACKAGES_DIR, 'svg', 'src'),
  DISCORD_WORKER_SRC,
  join(REPO_ROOT, 'apps', 'stoat-worker', 'src'),
];

/** The two surviving `meta.*` keys — kept structurally, never read via `t()`. */
const META_KEYS = ['meta.locale', 'meta.name'];

/** Flatten a nested locale object to dot-notation leaf keys. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/** Recursively list non-test .ts/.tsx files under a directory. Missing dirs are skipped. */
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files; // e.g. stoat-worker/src may not exist in every checkout state
  }
  for (const entry of entries) {
    if (['node_modules', 'dist', '.git', 'coverage', 'locales'].includes(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (
      stat.isFile() &&
      ['.ts', '.tsx'].includes(extname(entry)) &&
      !/\.(test|spec)\.tsx?$/.test(entry)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildCorpus(): string {
  return CONSUMER_DIRS.flatMap(listSourceFiles)
    .map((f) => readFileSync(f, 'utf-8'))
    .join('\n');
}

/**
 * Extract every quoted string inside the FIRST capture group of `regex`
 * matched against `source`. Throws if `regex` finds no match at all, so a
 * shape change in the watched declaration fails the gate loudly rather than
 * silently yielding an empty (or stale) list.
 */
function extractQuotedList(source: string, regex: RegExp, label: string): string[] {
  const match = regex.exec(source);
  if (!match || !match[1]) {
    throw new Error(
      `locale-orphans gate: could not find ${label} — the source shape changed. ` +
        `Update the regex in locale-orphans.test.ts to match.`,
    );
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** discord-worker's `PREFERENCE_ORDER` (+ the separate `filters` key), read from source. */
function readPreferenceKeys(): string[] {
  const source = readFileSync(PREFERENCES_TS, 'utf-8');
  const order = extractQuotedList(
    source,
    /const PREFERENCE_ORDER: PreferenceKey\[\] = \[([\s\S]*?)\];/,
    'PREFERENCE_ORDER in handlers/commands/preferences.ts',
  );
  if (!source.includes('preferences.keys.filters')) {
    throw new Error(
      "locale-orphans gate: expected 'preferences.keys.filters' to still be built in " +
        'preferences.ts — update the gate if it moved.',
    );
  }
  return [...order, 'filters'];
}

/** discord-worker's `FILTER_OPTION_KEYS` option names, read from source. */
function readFilterOptions(): string[] {
  const source = readFileSync(PREFERENCES_TS, 'utf-8');
  const block = /const FILTER_OPTION_KEYS: Array<\{ option: string; key: keyof DyeTypeFilters \}> = \[([\s\S]*?)\];/.exec(
    source,
  );
  if (!block || !block[1]) {
    throw new Error(
      'locale-orphans gate: could not find FILTER_OPTION_KEYS in handlers/commands/preferences.ts — ' +
        'the source shape changed. Update the regex in locale-orphans.test.ts to match.',
    );
  }
  return [...block[1].matchAll(/option: '([^']+)'/g)].map((m) => m[1]);
}

/** discord-worker's `TOPIC_KEYS` values, read from source. */
function readManualTopicKeys(): string[] {
  const source = readFileSync(MANUAL_TS, 'utf-8');
  return extractQuotedList(
    source,
    /const TOPIC_KEYS: Partial<Record<ManualTopicId, string>> = \{([\s\S]*?)\};/,
    'TOPIC_KEYS in handlers/commands/manual.ts',
  );
}

/** Build the exact set of enumerated (non-literal) reachable keys. */
function buildEnumeratedKeys(): Set<string> {
  const keys = new Set<string>(META_KEYS);
  for (const lens of VISION_TYPES) {
    keys.add(`accessibility.${lens}`);
  }
  for (const prefKey of readPreferenceKeys()) {
    keys.add(`preferences.keys.${prefKey}`);
  }
  for (const topic of readManualTopicKeys()) {
    keys.add(`manual5.topics.${topic}.name`);
    keys.add(`manual5.topics.${topic}.body`);
  }
  for (const option of readFilterOptions()) {
    keys.add(`preferences.filters.labels.${option}`);
  }
  for (const method of Object.keys(MATCHING_METHOD_TAGS)) {
    keys.add(`preferences.methods.${method}`);
  }
  for (const mode of BLENDING_MODES) {
    keys.add(`preferences.blendingModes.${mode.value}`);
  }
  return keys;
}

function isReachable(key: string, corpus: string, enumerated: Set<string>): boolean {
  if (enumerated.has(key)) return true;
  return new RegExp(`['"\`]${escapeRe(key)}['"\`]`).test(corpus);
}

function loadLocale(code: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${code}.json`), 'utf-8')) as Record<
    string,
    unknown
  >;
}

describe('bot-logic i18n orphan gate', () => {
  it('every key in en.json is reachable from a consumer tree or an enumerated dynamic key', () => {
    const en = loadLocale('en');
    const keys = flattenKeys(en);
    const corpus = buildCorpus();
    const enumerated = buildEnumeratedKeys();

    const orphans = keys.filter((k) => !isReachable(k, corpus, enumerated));

    expect(keys.length).toBeGreaterThan(300);
    expect(orphans, `orphaned locale keys:\n  ${orphans.join('\n  ')}`).toEqual([]);
  });

  /**
   * Reverse direction (2026-08-20 i18n audit, F-01): every static key a consumer
   * passes to `Translator.t()` must exist in en.json. `t()` returns the raw
   * dotted key on a miss, so a typo or a renamed key ships `budget.noWorldSet.title`
   * straight into a Discord embed — and the forward orphan check above cannot
   * see it (it only asks whether en.json keys are *read*, not whether read keys
   * *exist*). Seven such keys survived six months this way.
   *
   * Matches `<anything>.t('a.b')` / `.t("a.b")` / `.t(\`a.b\`)` with a literal,
   * fully static dotted key — template keys (`t.t(\`accessibility.${lens}\`)`)
   * are out of scope here and are covered by the enumerated set above.
   */
  it('every static key passed to Translator.t() exists in en.json', () => {
    const en = loadLocale('en');
    const defined = new Set(flattenKeys(en));
    const corpus = buildCorpus();

    const called = new Set<string>();
    for (const m of corpus.matchAll(/\.t\(\s*['"`]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"`]/g)) {
      called.add(m[1]);
    }
    const missing = [...called].filter((k) => !defined.has(k)).sort();

    expect(called.size).toBeGreaterThan(200);
    expect(missing, `t() keys with no en.json entry:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('keeps identical key sets across all six locales', () => {
    const keySets = LOCALE_CODES.map((code) => new Set(flattenKeys(loadLocale(code))));
    const [enKeys, ...rest] = keySets;

    LOCALE_CODES.slice(1).forEach((code, i) => {
      const other = rest[i];
      const missing = [...enKeys].filter((k) => !other.has(k));
      const extra = [...other].filter((k) => !enKeys.has(k));
      expect(missing, `${code}.json missing keys present in en.json`).toEqual([]);
      expect(extra, `${code}.json has keys absent from en.json`).toEqual([]);
    });
  });
});
