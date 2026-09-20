/**
 * Locale QUALITY gates — what key parity cannot see.
 *
 * `locales.test.ts` proves every locale has en.json's keys, and
 * `locale-orphans.test.ts` that every key is used. Neither notices a value that
 * was never translated, one concept carrying two words, or a `{placeholder}`
 * that went missing — the 2026-09-19 i18n audit found all three by hand:
 *
 *   - identical to English: 54 values, reviewed by no gate. Most are command
 *     syntax, brands and cognates; three were simply untranslated (de "Powered
 *     by Cloudflare Workers", de / fr "LIMBAL").
 *   - same English, two translations: `card.found` and `card.swatchNearest` both
 *     read "NEAREST DYE", and the first still translated a retired "FOUND" in
 *     French while Korean and Chinese had a bare modifier with no noun.
 *   - placeholders: clean by hand in that audit, gated by nothing.
 *
 * Exceptions live in `locale-quality-allowlist.json`, each with a reason, and a
 * stale exception fails — so the list describes the files rather than the past.
 */

import { describe, it, expect } from 'vitest';

import enLocale from '../locales/en.json';
import jaLocale from '../locales/ja.json';
import deLocale from '../locales/de.json';
import frLocale from '../locales/fr.json';
import koLocale from '../locales/ko.json';
import zhLocale from '../locales/zh.json';
import allowlist from './locale-quality-allowlist.json';

type Flat = Map<string, string>;
type Reasons = Record<string, string>;

function flatten(obj: Record<string, unknown>, prefix = '', out: Flat = new Map()): Flat {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, path, out);
    } else if (typeof value === 'string') {
      out.set(path, value);
    }
  }
  return out;
}

const en = flatten(enLocale as Record<string, unknown>);
const TARGETS: Record<string, Flat> = {
  ja: flatten(jaLocale as Record<string, unknown>),
  de: flatten(deLocale as Record<string, unknown>),
  fr: flatten(frLocale as Record<string, unknown>),
  ko: flatten(koLocale as Record<string, unknown>),
  zh: flatten(zhLocale as Record<string, unknown>),
};

/** `manual.<topic>.name` is the command's own syntax line — identical by construction. */
const COMMAND_SYNTAX = /^manual\.[A-Za-z0-9]+\.name$/;

const identicalAllow = allowlist.identicalToEnglish as Record<string, Reasons>;
const sameEnglishAllow = allowlist.sameEnglish as Record<string, Reasons>;

const placeholders = (value: string): string =>
  [...new Set([...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]))].sort().join('|');

/** Keys whose value in `locale` is literally the English value. */
function identicalKeys(locale: Flat): string[] {
  return [...en]
    .filter(([key, value]) => value !== '' && locale.get(key) === value)
    .map(([key]) => key);
}

/**
 * Groups of keys sharing one exact English value, and where they diverge.
 * Exported shape is local on purpose — the web app's twin lives in
 * `apps/web-app/scripts/i18n-parity.mjs`, and the two sets share nothing else.
 */
function sameEnglishDivergences(
  reference: Flat,
  targets: Record<string, Flat>
): { english: string; locale: string; values: string[] }[] {
  const byEnglish = new Map<string, string[]>();
  for (const [key, value] of reference) {
    if (value.trim() === '') continue;
    byEnglish.set(value, [...(byEnglish.get(value) ?? []), key]);
  }
  const out: { english: string; locale: string; values: string[] }[] = [];
  for (const [english, keys] of byEnglish) {
    if (keys.length < 2) continue;
    for (const [locale, entries] of Object.entries(targets)) {
      const values = new Set(keys.filter((k) => entries.has(k)).map((k) => entries.get(k)!));
      if (values.size > 1) out.push({ english, locale, values: [...values] });
    }
  }
  return out;
}

describe('values identical to English', () => {
  for (const [code, locale] of Object.entries(TARGETS)) {
    it(`${code}: every one is allow-listed with a reason`, () => {
      const allowed = { ...identicalAllow['*'], ...identicalAllow[code] };
      const unexpected = identicalKeys(locale).filter(
        (key) => !(key in allowed) && !COMMAND_SYNTAX.test(key)
      );
      // Translate it, or list it in locale-quality-allowlist.json with a reason.
      expect(unexpected).toEqual([]);
    });

    it(`${code}: no allow-list entry has gone stale`, () => {
      const identical = new Set(identicalKeys(locale));
      const stale = Object.keys(identicalAllow[code] ?? {}).filter((key) => !identical.has(key));
      expect(stale).toEqual([]);
    });
  }

  it('"*" entries are still identical somewhere', () => {
    const anywhere = new Set(Object.values(TARGETS).flatMap((locale) => identicalKeys(locale)));
    expect(Object.keys(identicalAllow['*']).filter((key) => !anywhere.has(key))).toEqual([]);
  });

  it('every reason names one of the five accepted kinds', () => {
    const reasons = Object.values(identicalAllow).flatMap((entries) => Object.values(entries));
    const bad = reasons.filter((r) => !/^(format|unit|identifier|brand|cognate) - \S/.test(r));
    expect(bad).toEqual([]);
  });
});

describe('same English, same translation', () => {
  const divergences = sameEnglishDivergences(en, TARGETS);

  it('no group is translated two ways without a listed reason', () => {
    const unexpected = divergences.filter(({ english, locale }) => {
      const entry = sameEnglishAllow[english];
      return !(entry && (locale in entry || '*' in entry));
    });
    // One translation per concept — or, if the label really does two jobs, list it.
    // If a card needs a shorter label, give ENGLISH two values (as ratioCol / ratioShort
    // would have) rather than letting one locale diverge silently.
    expect(unexpected).toEqual([]);
  });

  it('no allow-list entry has gone stale', () => {
    const live = new Set(divergences.map((d) => `${d.english}\u0000${d.locale}`));
    const liveEnglish = new Set(divergences.map((d) => d.english));
    const stale = Object.entries(sameEnglishAllow).flatMap(([english, locales]) =>
      Object.keys(locales)
        .filter((locale) =>
          locale === '*' ? !liveEnglish.has(english) : !live.has(`${english}\u0000${locale}`)
        )
        .map((locale) => `${english} (${locale})`)
    );
    expect(stale).toEqual([]);
  });

  it('can fail: a synthetic split is reported, a unified group is not', () => {
    const reference: Flat = new Map([
      ['a.label', 'NEAREST DYE'],
      ['b.label', 'NEAREST DYE'],
      ['c.label', 'TARGET'],
      ['d.label', 'TARGET'],
    ]);
    const fr: Flat = new Map([
      ['a.label', 'TROUVÉ'],
      ['b.label', 'TEINTURE PROCHE'],
      ['c.label', 'CIBLE'],
      ['d.label', 'CIBLE'],
    ]);
    expect(sameEnglishDivergences(reference, { fr })).toEqual([
      { english: 'NEAREST DYE', locale: 'fr', values: ['TROUVÉ', 'TEINTURE PROCHE'] },
    ]);
  });
});

describe('placeholders', () => {
  for (const [code, locale] of Object.entries(TARGETS)) {
    it(`${code}: every value carries en.json's {placeholders}`, () => {
      const mismatched = [...en]
        .filter(([key, value]) => locale.has(key) && placeholders(locale.get(key)!) !== placeholders(value))
        .map(([key]) => key);
      expect(mismatched).toEqual([]);
    });
  }
});
