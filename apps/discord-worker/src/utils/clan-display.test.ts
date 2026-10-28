import { beforeAll, describe, expect, it } from 'vitest';
import { initializeLocale, type LocaleCode } from '@xivdyetools/bot-logic';
import { getClanAutocompleteChoices, getClanValidationOptions } from './clan-display.js';

const LOCALES: LocaleCode[] = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

describe('clan presentation', () => {
  beforeAll(async () => { await Promise.all(LOCALES.map(initializeLocale)); });

  it.each([
    ['en', 'Seeker of the Sun', "Miqo'te"],
    ['ja', 'サンシーカー', 'ミコッテ'],
    ['de', 'Goldtatze', "Miqo'te"],
    ['fr', 'Tribu du Soleil', "Miqo'te"],
    ['ko', '태양의 추종자', '미코테'],
    ['zh', '逐日之民', '猫魅族'],
  ] as const)('searches localized clan and race names in %s while returning canonical values', (locale, clan, race) => {
    const choice = { name: `${clan} (${race})`, value: 'Seeker of the Sun' };
    expect(getClanAutocompleteChoices(` ${clan} `, locale)).toEqual([choice]);
    expect(getClanAutocompleteChoices(race, locale)).toContainEqual(choice);
    expect(getClanAutocompleteChoices('seeker OF the sun', locale)).toEqual([choice]);
    expect(getClanValidationOptions(locale)).toContain(`${clan} (\`Seeker of the Sun\`)`);
  });

  it.each(LOCALES)('retains all sixteen canonical clan values and ordering in %s', (locale) => {
    const choices = getClanAutocompleteChoices('', locale);
    expect(choices.map((c) => c.value)).toEqual([
      'Midlander', 'Highlander', 'Seeker of the Sun', 'Keeper of the Moon',
      'Plainsfolk', 'Dunesfolk', 'Sea Wolf', 'Hellsguard', 'Wildwood', 'Duskwight',
      'Raen', 'Xaela', 'Rava', 'Veena', 'Helions', 'The Lost',
    ]);
    expect(choices.every((c) => c.name.length <= 100)).toBe(true);
    expect(getClanAutocompleteChoices('no such clan', locale)).toEqual([]);
  });
});
