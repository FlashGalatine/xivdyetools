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
 * family by rule set (`groupCharaTwinRules`). The browser runs
 * `checkCharaLook` against the file's dyes and the character's race and
 * gender, which never leave the device. A `.chara` file records no Grand
 * Company, so a company-locked piece is flagged (`needsGrandCompany`), never
 * failed.
 */

import type { Gender, Race } from '@xivdyetools/types';
import type { CharaGearSlotId } from './chara-parser.js';

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

export interface CharaCheckPieceInput {
  slot: CharaGearSlotId;
  /** The item the block names (lowest row id); null = the model has no item (NPC or prop) */
  itemId: number | null;
  /** The family's rule sets (`groupCharaTwinRules`); `[]` = unknown, so the piece is skipped */
  twins: readonly CharaTwinRules[];
  /** The highest channel the file dyes on this piece: 0, 1 or 2 */
  dyedChannel: number;
}

export interface CharaPieceCheck {
  slot: CharaGearSlotId;
  /** Problems no identical item avoids; `[]` = wearable as the file wears it */
  problems: CharaPieceProblem[];
  /** An identical item that avoids the named item's problems, and which ones */
  useInstead: { itemId: number; fixes: CharaPieceProblem[] } | null;
  /**
   * The Grand Company the piece as worn (the named item, or `useInstead`) is
   * locked to; null = any company. A flag, never a problem: the file does not
   * say which company the character serves.
   */
  needsGrandCompany: number | null;
}

export interface CharaLookCheck {
  /** Checked pieces in input order; pieces with unknown rules are left out */
  pieces: CharaPieceCheck[];
}

export interface CharaCheckCharacter {
  race: Race | null;
  gender: Gender | null;
}

const TWIN_CHECKS = ['dye', 'glamour', 'wear'] as const;

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

function checkPiece(piece: CharaCheckPieceInput, character: CharaCheckCharacter): CharaPieceCheck {
  const verdicts = piece.twins.map((twin) => ({
    twin,
    problems: charaTwinProblems(twin, piece.dyedChannel, character),
  }));
  const named = verdicts.find((v) => v.twin.itemIds.includes(piece.itemId as number)) ?? null;
  // A twin any company can wear goes before a company-locked one (stable sort).
  const passing = verdicts
    .filter((v) => v.problems.length === 0)
    .sort((a, b) => Number(a.twin.grandCompany > 0) - Number(b.twin.grandCompany > 0));
  const gc = (twin: CharaTwinRules): number | null => (twin.grandCompany > 0 ? twin.grandCompany : null);

  if (passing.length > 0) {
    if (named && named.problems.length > 0) {
      const instead = passing[0].twin;
      return {
        slot: piece.slot,
        problems: [],
        useInstead: { itemId: instead.itemIds[0], fixes: named.problems },
        needsGrandCompany: gc(instead),
      };
    }
    return {
      slot: piece.slot,
      problems: [],
      useInstead: null,
      needsGrandCompany: gc((named ?? passing[0]).twin),
    };
  }
  // Nothing passes. Report the checks no twin meets; when every check is met
  // by some twin but never all by one, fall back to the named item's own.
  const unmet = TWIN_CHECKS.filter((check) => verdicts.every((v) => v.problems.includes(check)));
  const problems = unmet.length > 0 ? [...unmet] : (named?.problems ?? []);
  return { slot: piece.slot, problems, useInstead: null, needsGrandCompany: null };
}

/** Check every worn piece against the game's rules for this character. */
export function checkCharaLook(
  pieces: readonly CharaCheckPieceInput[],
  character: CharaCheckCharacter,
): CharaLookCheck {
  const checked: CharaPieceCheck[] = [];
  for (const piece of pieces) {
    if (piece.itemId === null) {
      checked.push({ slot: piece.slot, problems: ['noItem'], useInstead: null, needsGrandCompany: null });
    } else if (piece.twins.length > 0) {
      checked.push(checkPiece(piece, character));
    }
  }
  return { pieces: checked };
}
