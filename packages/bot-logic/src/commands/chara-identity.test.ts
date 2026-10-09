/**
 * The identifier line's clan (HC-001, 2026-10-04 i18n audit): `/glamour` and
 * `/swatch` printed the file's tribe enum split and upper-cased
 * ("SEEKER OF THE SUN") in every locale. The clan now comes from core's
 * `clans` table — the clients' own names since core 5.8.1 — and is
 * upper-cased by the locale's own rules.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { SubRace } from '@xivdyetools/types';
import { initializeLocale, type LocaleCode } from '../localization.js';
import { tribeDisplay } from './chara-identity.js';

const LOCALES: readonly LocaleCode[] = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

const SUBRACES: readonly SubRace[] = [
  'Midlander',
  'Highlander',
  'Wildwood',
  'Duskwight',
  'Plainsfolk',
  'Dunesfolk',
  'SeekerOfTheSun',
  'KeeperOfTheMoon',
  'SeaWolf',
  'Hellsguard',
  'Raen',
  'Xaela',
  'Helions',
  'TheLost',
  'Rava',
  'Veena',
];

/** What the line printed before HC-001, in every locale. */
const splitAndUpperCase = (tribe: string): string => tribe.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();

describe('tribeDisplay', () => {
  beforeAll(async () => {
    for (const locale of LOCALES) await initializeLocale(locale);
  });

  it.each(SUBRACES)('en: %s reads exactly as it did before', (tribe) => {
    expect(tribeDisplay(tribe, 'en')).toBe(splitAndUpperCase(tribe));
  });

  it.each([
    ['de', 'Midlander', 'WIESLÄNDER'],
    ['de', 'SeekerOfTheSun', 'GOLDTATZE'],
    ['de', 'Duskwight', 'DUNKELALB'],
    ['fr', 'Plainsfolk', 'PEUPLE DES PLAINES'],
    ['fr', 'Duskwight', 'CRÉPUSCULAIRE'],
    ['ja', 'Raen', 'アウラ・レン'],
    ['ko', 'Midlander', '중원 부족'],
    ['zh', 'SeekerOfTheSun', '逐日之民'],
  ] as const)('%s: %s is the client’s clan name, %s', (locale, tribe, shown) => {
    expect(tribeDisplay(tribe, locale)).toBe(shown);
  });

  it('prints no English clan in ja, ko or zh', () => {
    for (const locale of ['ja', 'ko', 'zh'] as const) {
      const english = SUBRACES.filter((tribe) => tribeDisplay(tribe, locale) === splitAndUpperCase(tribe));
      expect(english).toEqual([]);
    }
  });

  it('prints nothing for a file with no tribe', () => {
    expect(tribeDisplay(null, 'de')).toBe('');
  });
});
