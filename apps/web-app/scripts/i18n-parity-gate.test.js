/**
 * The locale parity gate, under vitest — which is what makes it a gate.
 *
 * `npm run validate:i18n` has never run in a workflow: CI runs `turbo run lint
 * type-check test build`, and nothing in it calls `scripts/i18n-parity.mjs`. A
 * pull request that dropped a key from one locale, broke a `{placeholder}` or
 * left a value in English was green (found 2026-09-20, while looking for a home
 * for the same-English check). This file runs `checkParity()` on the shipped
 * locale files, so every ERROR the script prints now fails `test`:
 *
 *   - duplicate, missing, extra and empty keys, placeholder mismatches;
 *   - a value identical to English that is not allow-listed with a reason — the
 *     script only WARNS about these, and a warning nobody runs is not a check;
 *   - same English, two translations — outside `i18n-same-english-allowlist.json`;
 *   - stale entries in either allow-list.
 *
 * The other half of `validate:i18n` is `scripts/validate-i18n.js` — every key the
 * code references exists in en.json, and every locale keeps en.json's key order.
 * It prints and exits as it goes, so it is run here as the script it is and held
 * to exit code 0, rather than rewritten into a library for the sake of a test.
 *
 * The unit tests below feed `findSameEnglishDivergences` synthetic entries, so
 * the rule is proven able to fail rather than assumed to.
 *
 * @module scripts/i18n-parity-gate.test
 */

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

import { checkParity, findSameEnglishDivergences, flattenEntries } from './i18n-parity.mjs';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = join(APP_DIR, 'src', 'locales');

describe('validate-i18n.js (referenced keys exist, key order, stray whitespace)', () => {
  it('exits 0 on the shipped source and locale files', () => {
    const run = spawnSync(process.execPath, [join(APP_DIR, 'scripts', 'validate-i18n.js')], {
      cwd: APP_DIR,
      encoding: 'utf-8',
    });
    // The script's own report is the failure message — it names the file, line and key.
    expect(run.status, `${run.stdout}\n${run.stderr}`.slice(-3000)).toBe(0);
  }, 60_000);
});

describe('locale parity (the shipped files)', () => {
  const report = checkParity();

  it('en.json has no duplicate keys', () => {
    expect(report.reference.duplicates).toEqual([]);
  });

  for (const locale of report.locales) {
    describe(locale.locale, () => {
      it('has the same keys as en.json, none duplicated, none empty', () => {
        expect(locale.duplicates).toEqual([]);
        expect(locale.missing).toEqual([]);
        expect(locale.extra).toEqual([]);
        expect(locale.empty).toEqual([]);
      });

      it('carries the same {placeholders} as en.json', () => {
        expect(locale.placeholderMismatch).toEqual([]);
      });

      it('leaves no value in English without an allow-listed reason', () => {
        expect(locale.identicalUnexpected).toEqual([]);
        expect(locale.staleAllowlist).toEqual([]);
      });
    });
  }

  it('gives keys that share one English value one translation per locale', () => {
    // Translate the group one way, or list it in i18n-same-english-allowlist.json
    // with the two jobs the English word is doing.
    expect(report.sameEnglish.unexpected).toEqual([]);
  });

  it('keeps the same-English allow-list free of entries that no longer diverge', () => {
    expect(report.sameEnglish.stale).toEqual([]);
  });

  it('is looking at real groups, not an empty set', () => {
    // A check that cannot see a thing reports the thing is fine.
    expect(report.sameEnglish.groups).toBeGreaterThan(40);
    expect(report.sameEnglish.divergences.length).toBeGreaterThan(0);
  });
});

describe('findSameEnglishDivergences', () => {
  const en = new Map([
    ['a.clear', 'Clear'],
    ['b.clear', 'Clear'],
    ['a.save', 'Save'],
    ['b.save', 'Save'],
    ['c.only', 'Only once'],
    ['d.count', 3],
    ['e.blank', ''],
    ['f.blank', ''],
  ]);
  const locales = (de) => new Map([['de', new Map(de)]]);

  it('reports a group translated two ways, with the keys behind each value', () => {
    const result = findSameEnglishDivergences(
      en,
      locales([
        ['a.clear', 'Leeren'],
        ['b.clear', 'Klar'],
        ['a.save', 'Speichern'],
        ['b.save', 'Speichern'],
      ]),
      {}
    );
    expect(result.groups).toBe(2); // Clear, Save — not the singleton, the number or the blanks
    expect(result.unexpected).toEqual([
      {
        english: 'Clear',
        locale: 'de',
        allowed: false,
        clusters: [
          { value: 'Leeren', keys: ['a.clear'] },
          { value: 'Klar', keys: ['b.clear'] },
        ],
      },
    ]);
  });

  it('accepts a group allow-listed for that locale, or for "*"', () => {
    const de = [
      ['a.clear', 'Leeren'],
      ['b.clear', 'Klar'],
      ['a.save', 'Speichern'],
      ['b.save', 'Merken'],
    ];
    const result = findSameEnglishDivergences(en, locales(de), {
      Clear: { '*': 'verb vs adjective' },
      Save: { de: 'form save vs bookmark' },
    });
    expect(result.divergences).toHaveLength(2);
    expect(result.unexpected).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('does not let an entry for another locale excuse this one', () => {
    const result = findSameEnglishDivergences(
      en,
      locales([
        ['a.clear', 'Leeren'],
        ['b.clear', 'Klar'],
      ]),
      { Clear: { fr: 'verb vs adjective' } }
    );
    expect(result.unexpected.map((d) => d.locale)).toEqual(['de']);
    expect(result.stale).toEqual([{ english: 'Clear', locale: 'fr' }]);
  });

  it('reports an allow-list entry whose group has been unified', () => {
    const result = findSameEnglishDivergences(
      en,
      locales([
        ['a.clear', 'Leeren'],
        ['b.clear', 'Leeren'],
      ]),
      { Clear: { '*': 'verb vs adjective' } }
    );
    expect(result.unexpected).toEqual([]);
    expect(result.stale).toEqual([{ english: 'Clear', locale: '*' }]);
  });

  it('leaves a missing key to the MISSING check instead of calling it a split', () => {
    const result = findSameEnglishDivergences(en, locales([['a.clear', 'Leeren']]), {});
    expect(result.divergences).toEqual([]);
  });
});

describe('German register', () => {
  // The web app, the bot and all four German policy documents address the user
  // as "du". de.json said "Sie" in 48 strings until 2026-09-20 — the five oldest
  // namespaces, never revisited. Formal address is always capitalised, which is
  // what makes it findable.
  const THIRD_PERSON = new Set([
    // "Voreinstellung eingereicht! Sie wird … angezeigt." — sie = die Voreinstellung
    'preset.submittedPendingReview',
  ]);

  it('never addresses the user formally', () => {
    const de = flattenEntries(JSON.parse(readFileSync(join(LOCALES_DIR, 'de.json'), 'utf-8')));
    const formal = [...de]
      .filter(([key, value]) => typeof value === 'string' && !THIRD_PERSON.has(key))
      .filter(([, value]) => /(?<![\p{L}])(Sie|Ihr|Ihre[mnrs]?|Ihnen)(?![\p{L}])/u.test(value))
      .map(([key]) => key);
    expect(formal).toEqual([]);
  });
});
