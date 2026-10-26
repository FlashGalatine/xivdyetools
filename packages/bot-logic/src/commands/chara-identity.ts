/**
 * What `/swatch` and `/glamour` share about a `.chara` file: the read through
 * core's library-backed facade, the palette-sheet service its colours resolve
 * against, and the identifier line a card prints in place of a name
 * (producer + tribe + gender — never the nickname).
 *
 * @module commands/chara-identity
 */

import {
  CharacterColorService,
  inspectCharaForTools,
  resolveCharaForTools,
  type ImportedCharaCharacter,
} from '@xivdyetools/core';
import type { ClanKey, SubRace } from '@xivdyetools/types';
import { dyeService } from '../input-resolution.js';
import { getLocalizedClan, type LocaleCode } from '../localization.js';

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

/** The attachment as a command receives it: the capped bytes, its decoded text, or both. */
export interface CharaFileSource {
  fileText?: string;
  fileBytes?: Uint8Array;
}

/**
 * Read a `.chara` file through core's facade: `inspectCharaForTools` (the
 * library reader, 8 KiB cap) → `resolveCharaForTools` (the host palettes and
 * the bot's own dye table). The bytes win over the text, so invalid UTF-8 is
 * refused by the reader (`INVALID_UTF8`) instead of being re-encoded after a
 * non-fatal decode. Throws on a refusal; the caller logs `failureKind` only.
 * With neither input it throws a `NO_INPUT` error before reading anything.
 */
export async function readCharaForTools(file: CharaFileSource): Promise<ImportedCharaCharacter> {
  const source = file.fileBytes ?? file.fileText;
  if (source === undefined) {
    throw Object.assign(new Error('no .chara input'), { code: 'NO_INPUT' });
  }
  return resolveCharaForTools(inspectCharaForTools(source), getCharacterColors(), dyeService);
}

/**
 * The file's clan as the reader's client names it, upper-cased by the
 * locale's own rules (HC-001): "SeekerOfTheSun" → en "SEEKER OF THE SUN",
 * de "GOLDTATZE", ko "태양의 추종자". The SubRace enum maps to core's clan key
 * by lower-casing its first letter, as og-worker's `clanOrRaceKey` does.
 * The locale must already be initialized (both commands do it first);
 * otherwise the line keeps its English words.
 */
export function tribeDisplay(tribe: SubRace | null, locale: LocaleCode): string {
  if (!tribe) return '';
  const key = (tribe.charAt(0).toLowerCase() + tribe.slice(1)) as ClanKey;
  return getLocalizedClan(key, locale).toLocaleUpperCase(locale);
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
