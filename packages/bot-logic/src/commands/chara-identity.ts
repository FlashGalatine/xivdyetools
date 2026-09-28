/**
 * What `/swatch` and `/glamour` share about a `.chara` file: the palette-sheet
 * service its colours resolve against, and the identifier line a card prints
 * in place of a name (producer + tribe + gender — never the nickname).
 *
 * @module commands/chara-identity
 */

import { CharacterColorService } from '@xivdyetools/core';

/**
 * Shared palette-sheet service (data is bundled — no I/O). Constructed on
 * first use, NOT at module load: consumer test suites mock
 * `@xivdyetools/core` minimally, and an import-time `new` breaks every suite
 * whose mock lacks the class.
 */
let characterColors: CharacterColorService | null = null;
export function getCharacterColors(): CharacterColorService {
  characterColors ??= new CharacterColorService();
  return characterColors;
}

/** "SeekerOfTheSun" → "SEEKER OF THE SUN". */
export function tribeDisplay(tribe: string | null): string {
  if (!tribe) return '';
  return tribe.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}

/**
 * Producer token for a card's identifier line. `producer` is the file's raw
 * `TypeName` — free text the uploader controls — so only the known exporter
 * families print, as a fixed token; anything else is omitted rather than
 * rendered (the allowlist discipline core already applies to Race / Tribe /
 * Gender). Order matters only for a string naming several families.
 */
const PRODUCER_TOKENS: ReadonlyArray<readonly [needle: string, token: string]> = [
  ['brio', 'BRIO'],
  ['ktisis', 'KTISIS'],
  ['anamnesis', 'ANAMNESIS'],
];

export function producerToken(producer: string | null): string | null {
  if (!producer) return null;
  const haystack = producer.toLowerCase();
  return PRODUCER_TOKENS.find(([needle]) => haystack.includes(needle))?.[1] ?? null;
}

/** The gender symbol an identifier line carries, or '' when the file has none. */
export function genderSymbol(gender: string | null): string {
  return gender === 'Male' ? '♂' : gender === 'Female' ? '♀' : '';
}
