/**
 * Facewear tint names must be localized in all six locales (I18N-008).
 *
 * The 11 Facewear colours are not dyes — schema v2 moved them out of
 * `dyes.json` into `facewear_colors.json`, and nothing carried their names into
 * the locale pipeline, so every one of them rendered English underneath a
 * category heading that *was* translated. They are keyed by a slug rather than
 * an itemID, so `getDyeName()` could never have reached them; they come from
 * `facewear-names.csv` through `build-locales.ts`.
 *
 * These assertions read the GENERATED locale JSON, not a fixture, so they fail
 * if a regenerated locale drops the namespace or a slug — the failure mode that
 * let the gap exist in the first place.
 */

import { describe, it, expect } from 'vitest';
import { facewearColors } from '../../../config/facewear.js';
import { LocalizationService } from '../../LocalizationService.js';
import type { LocaleCode } from '@xivdyetools/types';

import en from '../../../data/locales/en.json' with { type: 'json' };
import ja from '../../../data/locales/ja.json' with { type: 'json' };
import de from '../../../data/locales/de.json' with { type: 'json' };
import fr from '../../../data/locales/fr.json' with { type: 'json' };
import ko from '../../../data/locales/ko.json' with { type: 'json' };
import zh from '../../../data/locales/zh.json' with { type: 'json' };

const GENERATED: Record<LocaleCode, { facewearColors?: Record<string, string> }> = {
  en,
  ja,
  de,
  fr,
  ko,
  zh,
};
const LOCALES = Object.keys(GENERATED) as LocaleCode[];

/**
 * Names a locale shares with English on purpose — the same idea as web-app's
 * `scripts/i18n-identical-allowlist.json`: every exception carries a reason, so
 * an untranslated string cannot hide behind "probably a cognate".
 */
const IDENTICAL_OK: Partial<Record<LocaleCode, Record<string, string>>> = {
  de: { gold: 'cognate — "Gold" is the German word' },
};

describe('Facewear tint names are localized', () => {
  it('exposes all 11 colours', () => {
    expect(facewearColors).toHaveLength(11);
  });

  for (const locale of LOCALES) {
    it(`${locale}.json carries a name for every Facewear slug`, () => {
      const table = GENERATED[locale].facewearColors;
      expect(table, `${locale}.json has no facewearColors namespace`).toBeDefined();
      for (const colour of facewearColors) {
        expect(table?.[colour.id], `${locale}/${colour.id}`).toBeTruthy();
      }
      // No extras: the namespace tracks the data file exactly.
      expect(Object.keys(table ?? {}).sort()).toEqual(facewearColors.map((c) => c.id).sort());
    });
  }

  for (const locale of LOCALES.filter((l) => l !== 'en')) {
    it(`${locale}: no name is left as its English text`, () => {
      const allowed = IDENTICAL_OK[locale] ?? {};
      const untranslated = facewearColors
        .filter((c) => GENERATED[locale].facewearColors?.[c.id] === c.name)
        .map((c) => c.id)
        .filter((id) => !(id in allowed));
      expect(untranslated, `${locale} still English: ${untranslated.join(', ')}`).toEqual([]);
    });

    it(`${locale}: every allow-listed identical name is still identical`, () => {
      // Keeps the allow-list from rotting once a translation lands.
      for (const [id, reason] of Object.entries(IDENTICAL_OK[locale] ?? {})) {
        const english = facewearColors.find((c) => c.id === id)?.name;
        expect(GENERATED[locale].facewearColors?.[id], `${locale}/${id} (${reason})`).toBe(english);
      }
    });
  }

  it('the getter resolves through the service and falls back for an unknown slug', async () => {
    // The singleton loads locale data on demand, so an explicit-locale lookup
    // only sees ja/de once they are loaded — same contract as every other
    // getter here (discord-worker's localize.ts calls initializeLocale() for
    // exactly this reason). `ensureLocaleLoaded` is the public way to do it
    // without mutating the current locale for other tests in the file.
    await LocalizationService.ensureLocaleLoaded('ja');
    await LocalizationService.ensureLocaleLoaded('de');

    expect(LocalizationService.getFacewearColorName('brass', 'ja')).toBe('ブラス');
    expect(LocalizationService.getFacewearColorName('brass', 'de')).toBe('Messing');
    expect(LocalizationService.getFacewearColorName('not-a-colour', 'ja')).toBe('Not-a-colour');
  });
});
