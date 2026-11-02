/** Localized presentation of the stored, canonical English clan preference.
 * Callers initialize the core locale before using these synchronous helpers.
 * The preference remains dormant: character commands read their .chara file.
 */
import { getLocalizedClan, getLocalizedRace, type LocaleCode } from '@xivdyetools/bot-logic';
import { RACE_SUBRACES, type ClanKey, type Race, type RaceKey } from '@xivdyetools/types';
import { CLANS_BY_RACE } from '../types/preferences.js';

const RACES: Record<string, readonly [Race, RaceKey]> = {
  Hyur: ['Hyur', 'hyur'],
  "Miqo'te": ["Miqo'te", 'miqote'],
  Lalafell: ['Lalafell', 'lalafell'],
  Roegadyn: ['Roegadyn', 'roegadyn'],
  Elezen: ['Elezen', 'elezen'],
  'Au Ra': ['AuRa', 'auRa'],
  Viera: ['Viera', 'viera'],
  Hrothgar: ['Hrothgar', 'hrothgar'],
};

function clansForLocale(locale: LocaleCode): Array<{
  race: string;
  label: string;
  clans: Array<{ value: string; label: string }>;
}> {
  return Object.entries(CLANS_BY_RACE).map(([race, clans]) => {
    const [raceId, raceKey] = RACES[race];
    return {
      race,
      label: getLocalizedRace(raceKey, locale),
      clans: clans.map((value, index) => {
        const subrace = RACE_SUBRACES[raceId][index];
        const key = (subrace.charAt(0).toLowerCase() + subrace.slice(1)) as ClanKey;
        return { value, label: getLocalizedClan(key, locale) };
      }),
    };
  });
}

export function getClanAutocompleteChoices(query: string, locale: LocaleCode = 'en'): Array<{ name: string; value: string }> {
  const needle = query.trim().toLocaleLowerCase(locale);
  return clansForLocale(locale).flatMap(({ race, label, clans }) => clans
    .filter((clan) => [race, label, clan.value, clan.label].some((text) => text.toLocaleLowerCase(locale).includes(needle)))
    .map((clan) => ({ name: `${clan.label} (${label})`, value: clan.value })))
    .slice(0, 25);
}

export function getClanValidationOptions(locale: LocaleCode): string {
  return clansForLocale(locale).map(({ label, clans }) =>
    `• **${label}**: ${clans.map((clan) => `${clan.label} (\`${clan.value}\`)`).join(', ')}`,
  ).join('\n');
}
