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
 *   2. It falls under one of the DYNAMIC_PREFIXES below — namespaces built
 *      from a runtime enumeration rather than a literal key, so a plain text
 *      scan can never see the reference:
 *        - `preferences.keys.` — apps/discord-worker/src/handlers/commands/preferences.ts
 *          walks PREFERENCE_ORDER (and the filters key) to build `preferences.keys.${key}`.
 *        - `manual5.topics.` — apps/discord-worker/src/handlers/commands/manual.ts
 *          walks TOPIC_KEYS to build `manual5.topics.${topic}.name` / `.body`.
 *        - `accessibility.` — packages/bot-logic/src/commands/accessibility.ts
 *          indexes by the four vision-deficiency lens names (protanopia,
 *          deuteranopia, tritanopia, achromatopsia).
 *        - `meta.` — never read by `t()` today (`Translator.getMeta()` is
 *          itself dead — DEAD-013), but the block is a structural part of
 *          every locale file (see `../locales.test.ts`'s "valid meta block"
 *          check) and is scheduled for removal together with `getMeta()` in
 *          Task 7. Kept as a prefix allowlist entry until then.
 *
 * This is deliberately generous with (2): a real regression that only ever
 * shows up as a *different* orphan pattern would need its own investigation,
 * but this gate exists to catch the common case — a feature's handler is
 * deleted or rewritten and its strings are simply forgotten.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/bot-logic/src/i18n/__tests__ -> packages/bot-logic/src
const BOT_LOGIC_SRC = join(HERE, '..', '..');
// packages/bot-logic/src -> packages
const PACKAGES_DIR = join(BOT_LOGIC_SRC, '..', '..');
// packages -> repo root
const REPO_ROOT = join(PACKAGES_DIR, '..');

const LOCALES_DIR = join(HERE, '..', 'locales');
const LOCALE_CODES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;

/** The four consumer trees the DEAD-011 finding scanned. */
const CONSUMER_DIRS = [
  BOT_LOGIC_SRC,
  join(PACKAGES_DIR, 'svg', 'src'),
  join(REPO_ROOT, 'apps', 'discord-worker', 'src'),
  join(REPO_ROOT, 'apps', 'stoat-worker', 'src'),
];

/**
 * Namespaces read via a runtime-built key (`` `ns.${variable}` ``) rather than
 * a literal, hand-enumerated from the four consumer trees by the DEAD-011
 * finding. See the module doc comment above for the source of each.
 */
const DYNAMIC_PREFIXES = [
  'preferences.keys.',
  'manual5.topics.',
  'accessibility.',
  'meta.', // removed with Translator.getMeta() in Task 7
];

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

function isReachable(key: string, corpus: string): boolean {
  if (DYNAMIC_PREFIXES.some((p) => key.startsWith(p))) return true;
  return new RegExp(`['"\`]${escapeRe(key)}['"\`]`).test(corpus);
}

function loadLocale(code: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${code}.json`), 'utf-8')) as Record<
    string,
    unknown
  >;
}

describe('bot-logic i18n orphan gate', () => {
  it('every key in en.json is reachable from a consumer tree or the dynamic-prefix allowlist', () => {
    const en = loadLocale('en');
    const keys = flattenKeys(en);
    const corpus = buildCorpus();

    const orphans = keys.filter((k) => !isReachable(k, corpus));

    expect(keys.length).toBeGreaterThan(300);
    expect(orphans, `orphaned locale keys:\n  ${orphans.join('\n  ')}`).toEqual([]);
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
