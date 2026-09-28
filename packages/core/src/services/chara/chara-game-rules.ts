/**
 * `.chara` in-game check — can the look a character file describes be worn
 * in the game?
 *
 * A posing tool (Anamnesis, Ktisis, Brio) can put any model on any character
 * and any stain on any channel. The game can't: a piece takes 0, 1 or 2 dyes
 * (`DyeCount`), a few are locked to a race or gender (`EquipRestriction` →
 * `EquipRaceCategory`) or to a Grand Company (`GrandCompany`), relic weapons
 * can't be cast as a glamour (`IsGlamorous`), and an NPC or prop model has no
 * item at all. Since patch 7.4 any job can wear any piece for glamour, so
 * classes and jobs are not checked.
 *
 * A model key names a FAMILY of visually identical items, and the rules
 * differ inside a family: across the Item sheet the dye count differs in 42%
 * of shared looks (Dated Hempen Coif takes no dye, Hempen Coif one). So every
 * check reads the family's distinct rule sets,
 * and a piece only fails when no identical item passes. The first rule set
 * holds the item the glamour block names, so the check can say which twin to
 * wear instead.
 *
 * api-worker reads the rules off XIVAPI (`charaWearMask`) and groups each
 * family by rule set (`groupCharaTwinRules`). The browser checks each twin
 * (`charaTwinProblems`, through `chara-twins.ts`) against the file's dyes and the character's race and
 * gender, which never leave the device. A `.chara` file records no Grand
 * Company, so a company-locked piece is flagged, never failed. Which twin a
 * list names is `chara-twins.ts`.
 */

import type { Gender, Race } from '@xivdyetools/types';

/**
 * `EquipRaceCategory` race columns in sheet order — also the wear-mask bit
 * order: bit `2i` is race `i` as a man, bit `2i + 1` as a woman.
 */
export const CHARA_WEAR_RACE_COLUMNS = [
  'Hyur',
  'Elezen',
  'Lalafell',
  'Miqote',
  'Roegadyn',
  'AuRa',
  'Hrothgar',
  'Viera',
] as const;

/** Our `Race` identifiers, index-aligned with the sheet columns above. */
const WEAR_RACE_INDEX: Record<Race, number> = {
  Hyur: 0,
  Elezen: 1,
  Lalafell: 2,
  "Miqo'te": 3,
  Roegadyn: 4,
  AuRa: 5,
  Hrothgar: 6,
  Viera: 7,
};

/** Sheet booleans arrive as JSON booleans; accept 0/1 as well. */
function isSet(value: unknown): boolean {
  return value === true || value === 1;
}

/**
 * The wear mask of one `EquipRaceCategory` row: every allowed race with every
 * allowed gender. Null when the row allows no race or no gender. That is row
 * 0, which no wearable item uses, so it reads as "unknown", never "nobody".
 */
export function charaWearMask(row: Readonly<Record<string, unknown>>): number | null {
  const genders = [isSet(row['Male']) ? 0 : -1, isSet(row['Female']) ? 1 : -1].filter(
    (g) => g >= 0,
  );
  let mask = 0;
  CHARA_WEAR_RACE_COLUMNS.forEach((column, i) => {
    if (!isSet(row[column])) return;
    for (const g of genders) mask |= 1 << (2 * i + g);
  });
  return mask === 0 ? null : mask;
}

/** Whether a wear mask admits the character; null when either side is unknown. */
function charaCanWear(
  mask: number | null,
  race: Race | null,
  gender: Gender | null,
): boolean | null {
  if (mask === null || race === null || gender === null) return null;
  const bit = 2 * WEAR_RACE_INDEX[race] + (gender === 'Female' ? 1 : 0);
  return (mask & (1 << bit)) !== 0;
}

/** What the game allows for one item. */
export interface CharaItemRules {
  /** Dye channels: 0, 1 or 2 (`DyeCount`) */
  dyeCount: number;
  /** `IsGlamorous`: off on relic weapons, whose Replicas carry the look instead */
  glamourable: boolean;
  /** Who can equip it (`charaWearMask`); null = unknown */
  wearMask: number | null;
  /** `GrandCompany` row the piece is locked to; 0 = any company */
  grandCompany: number;
}

/** One distinct rule set inside a family of identical-looking items. */
export interface CharaTwinRules extends CharaItemRules {
  /** The twins that follow these rules, row id ascending */
  itemIds: number[];
}

/**
 * Group a family's rows by identical rules. Even the 53-row families carry
 * only a handful of rule sets, which keeps the resolve answer small. Groups
 * come out ordered by their lowest row id, so the first holds the item the
 * block names. Rows without rules are left out; `[]` means nothing is known.
 */
export function groupCharaTwinRules(
  rows: ReadonlyArray<{ rowId: number; rules: CharaItemRules | null }>,
): CharaTwinRules[] {
  const groups = new Map<string, CharaTwinRules>();
  for (const row of [...rows].sort((a, b) => a.rowId - b.rowId)) {
    if (!row.rules) continue;
    const { dyeCount, glamourable, wearMask, grandCompany } = row.rules;
    const key = `${dyeCount}|${glamourable}|${wearMask}|${grandCompany}`;
    const group = groups.get(key);
    if (group) group.itemIds.push(row.rowId);
    else groups.set(key, { itemIds: [row.rowId], dyeCount, glamourable, wearMask, grandCompany });
  }
  return [...groups.values()];
}

/** Why a piece can't be worn the way the file wears it. */
export type CharaPieceProblem = 'noItem' | 'dye' | 'glamour' | 'wear';

export interface CharaCheckCharacter {
  race: Race | null;
  gender: Gender | null;
}


/** The checks one twin fails for this file and character. Grand Company is never one. */
export function charaTwinProblems(
  twin: CharaItemRules,
  dyedChannel: number,
  character: CharaCheckCharacter,
): CharaPieceProblem[] {
  const problems: CharaPieceProblem[] = [];
  if (dyedChannel > twin.dyeCount) problems.push('dye');
  if (!twin.glamourable) problems.push('glamour');
  if (charaCanWear(twin.wearMask, character.race, character.gender) === false) {
    problems.push('wear');
  }
  return problems;
}
