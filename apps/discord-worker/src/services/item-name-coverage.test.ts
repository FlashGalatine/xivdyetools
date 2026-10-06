/**
 * FONT-001 (2026-10-04 i18n audit): every Korean and Chinese equippable-item
 * name must be drawable by the bundled fonts.
 *
 * `/glamour` draws each piece's localized name on its card only when
 * `filterToRenderable` drops nothing from it (the `canDraw` predicate in
 * `handlers/commands/glamour.ts`); otherwise the card falls back to the English
 * name. Until Sprint 30 the CJK subsets were cut from locale data alone, so the
 * card drew English for 63 % of ko items and 97 % of zh items. The subsets now
 * also cut api-worker's item-name tables (`scripts/subset-cjk-fonts.py`).
 *
 * Those tables live in ANOTHER app: `apps/api-worker/scripts/build-item-names.mjs`
 * regenerates them after a patch, and a new item whose name uses a new Hangul
 * syllable or hanzi silently falls back to English until the subsets are
 * re-cut. This suite fails until they are. CI runs it in the always-on
 * cross-package step, because a commit that only touches api-worker never
 * selects this workspace for the filtered test run — so it must stay
 * build-free: no `@xivdyetools/*` import, only `font-coverage.ts` (which
 * imports nothing but the `.ttf` files).
 *
 * The fonts are read off disk, not through `getFontBuffers()`: an unmocked
 * `.ttf` import resolves to a URL string under vitest and coerces to a
 * zero-length buffer (DEAD-005), and `filterToRenderable` fails OPEN on an
 * implausibly small coverage set — so every name would pass for the wrong
 * reason. The size guard below catches that.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildCoverage, filterToRenderable } from './font-coverage.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(HERE, '..', 'fonts');
// apps/discord-worker/src/services → apps/api-worker/src/chara/data
const ITEM_NAMES_DIR = join(HERE, '..', '..', '..', 'api-worker', 'src', 'chara', 'data');

const covered = buildCoverage(
  readdirSync(fontsDir)
    .filter((f) => f.endsWith('.ttf'))
    .map((f) => new Uint8Array(readFileSync(join(fontsDir, f)))),
);

/** The locales with a build-time item-name table; en/ja/de/fr come from XIVAPI at run time. */
const LANGS = ['ko', 'zh'] as const;

function loadTable(lang: (typeof LANGS)[number]): Record<string, string> {
  const path = join(ITEM_NAMES_DIR, `item-names.${lang}.json`);
  if (!existsSync(path)) {
    throw new Error(`item-names.${lang}.json not found at ${path} — did api-worker's chara data move?`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
}

const tables = Object.fromEntries(LANGS.map((lang) => [lang, loadTable(lang)])) as Record<
  (typeof LANGS)[number],
  Record<string, string>
>;

/**
 * Codepoints a name may carry that no source face can draw, so a re-cut cannot
 * fix them. Each needs a reason; an entry that stops being needed (no name
 * carries it any more, or a face now covers it) fails the stale-entry test.
 */
const KNOWN_UNDRAWABLE = new Map<number, string>([
  [
    0x200f,
    'RIGHT-TO-LEFT MARK: a stray invisible control inside two ko names in the Teamcraft source ' +
      '(items 1200 and 1238, "…(황‏토색)"). No face maps it, so those two still draw in ' +
      'English; stripping format characters belongs in build-item-names.mjs cleanName.',
  ],
]);

const hex = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

describe('FONT-001: the bundled fonts draw every ko / zh item name', () => {
  it('measures against the real font files and the real tables (not an empty set)', () => {
    expect(covered.size).toBeGreaterThan(1000);
    for (const lang of LANGS) expect(Object.keys(tables[lang]).length).toBeGreaterThan(20_000);
  });

  for (const lang of LANGS) {
    it(`${lang}: every item name passes the /glamour canDraw predicate`, () => {
      const failures: string[] = [];
      for (const [id, name] of Object.entries(tables[lang])) {
        const checked = [...name].filter((ch) => !KNOWN_UNDRAWABLE.has(ch.codePointAt(0)!)).join('');
        if (filterToRenderable(checked, covered).dropped === 0) continue;
        const missing = [...new Set([...checked].filter((ch) => filterToRenderable(ch, covered).dropped > 0))];
        failures.push(`${id} ${name} (${missing.map((ch) => `${ch} ${hex(ch.codePointAt(0)!)}`).join(', ')})`);
      }
      expect(
        failures,
        `re-run apps/discord-worker/scripts/subset-cjk-fonts.py — ${failures.length} ${lang} item name(s) would draw in English: ` +
          failures.slice(0, 20).join('; '),
      ).toEqual([]);
    });
  }

  it('KNOWN_UNDRAWABLE has no stale entry', () => {
    const stale: string[] = [];
    for (const cp of KNOWN_UNDRAWABLE.keys()) {
      const ch = String.fromCodePoint(cp);
      const used = LANGS.some((lang) => Object.values(tables[lang]).some((name) => name.includes(ch)));
      if (!used) stale.push(`${hex(cp)} — no item name carries it any more`);
      else if (filterToRenderable(ch, covered).dropped === 0) stale.push(`${hex(cp)} — a bundled face draws it now`);
    }
    expect(stale, 'remove the stale KNOWN_UNDRAWABLE entries').toEqual([]);
  });
});
