/**
 * SubRace → ClanKey mapping.
 *
 * `SubRace` (the value stored in files and in the picker) is PascalCase;
 * `ClanKey` (what core's localisation table is keyed by) is camelCase. Every
 * caller that wants a *displayable* clan name has to cross that gap first —
 * `LanguageService.getClan(SUBRACE_TO_CLAN_KEY[subrace])`.
 *
 * Lives in `@shared` because two components need it: the swatch tool's
 * subrace pickers (desktop + mobile) and the .chara import header, which
 * would otherwise print the raw PascalCase `SubRace` in every locale.
 *
 * @module shared/subrace-clan
 */

import type { ClanKey, SubRace } from '@xivdyetools/types';

/** Localisation key for each subrace. Total over `SubRace` — no fallback needed. */
export const SUBRACE_TO_CLAN_KEY: Record<SubRace, ClanKey> = {
  Midlander: 'midlander',
  Highlander: 'highlander',
  Wildwood: 'wildwood',
  Duskwight: 'duskwight',
  Plainsfolk: 'plainsfolk',
  Dunesfolk: 'dunesfolk',
  SeekerOfTheSun: 'seekerOfTheSun',
  KeeperOfTheMoon: 'keeperOfTheMoon',
  SeaWolf: 'seaWolf',
  Hellsguard: 'hellsguard',
  Raen: 'raen',
  Xaela: 'xaela',
  Helions: 'helions',
  TheLost: 'theLost',
  Rava: 'rava',
  Veena: 'veena',
};
