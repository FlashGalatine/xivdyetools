/**
 * Twins — items the game draws identically — for the Glamour Reader.
 *
 * A `.chara` file stores a model, not an item, and one model often stands for
 * a whole family: Dated Hempen Coif and two Hempen Coifs, Curtana Zenith and
 * its Replica, Lord's and Lady's Yukata. api-worker answers the family (the
 * lowest row, the named alternates, and the in-game rules grouped by rule
 * set); this module decides which twin the list names and how the row reads.
 *
 * Default name (spec G4): the first twin that passes the in-game check for
 * this file — it takes the file's dyes, can be a glamour, and allows this
 * tribe and gender — preferring the most dye channels (GPOSERS reminders,
 * March 2026: "use a perfectly identical dyeable version instead of an
 * undyeable one"), then a twin that is not Dated, then the lowest row. When
 * none passes, the lowest row, as before. Only twins the answer
 * NAMES are candidates: a list can't print an item it has no name for.
 *
 * Pure — no DOM, no services — so the rules test without a browser.
 *
 * @module shared/glamour-twins
 */

import {
  charaTwinProblems,
  type CharaCheckCharacter,
  type CharaPieceProblem,
  type CharaTwinRules,
} from '@xivdyetools/core';
import type { CharaItemNames, CharaResolvedItem } from '@services/chara-resolve-service';

/** Every race × gender bit set: `EquipRaceCategory` row 1. */
const ANY_WEARER = 0xffff;

/** `EquipRaceCategory` race columns, bit `2i` (man) / `2i + 1` (woman). */
const RACE_BIT: Record<NonNullable<CharaCheckCharacter['race']>, number> = {
  Hyur: 0,
  Elezen: 1,
  Lalafell: 2,
  "Miqo'te": 3,
  Roegadyn: 4,
  AuRa: 5,
  Hrothgar: 6,
  Viera: 7,
};

export interface GlamourTwin {
  itemId: number;
  names: CharaItemNames;
  /** The twin's own GPOSERS acquisition line, when the worker has one */
  acquisition?: string;
  /** The rule set this twin follows; null when the worker did not say */
  rules: CharaTwinRules | null;
  /** The English name starts with "Dated " — a retired twin the game still draws */
  dated: boolean;
  /** Checks this twin fails for the file and character; `[]` when rules are unknown */
  problems: CharaPieceProblem[];
}

export type GlamourPieceTone = 'fix' | 'block' | 'choice' | 'unique';

export type GlamourTwinFact =
  | { key: 'best'; kind: 'acc' }
  | { key: 'dye'; kind: 'ok' | 'warn'; n: number }
  | { key: 'anyTribe'; kind: 'mute' }
  | { key: 'tribeOk'; kind: 'ok' }
  | { key: 'tribeNo'; kind: 'warn' }
  | { key: 'dated'; kind: 'mute' }
  | { key: 'grandCompany'; kind: 'mute'; n: number }
  | { key: 'noGlamour'; kind: 'warn' };

/** The named item and its alternates, row order, each checked against the file. */
export function twinsOf(
  item: CharaResolvedItem,
  dyedChannel: number,
  character: CharaCheckCharacter
): GlamourTwin[] {
  const members = [
    { itemId: item.itemId, names: item.names, acquisition: item.acquisition },
    ...item.alternates,
  ];
  return members
    .map((member) => {
      const rules = item.rules?.find((g) => g.itemIds.includes(member.itemId)) ?? null;
      return {
        itemId: member.itemId,
        names: member.names,
        ...(member.acquisition ? { acquisition: member.acquisition } : {}),
        rules,
        dated: member.names.en.startsWith('Dated '),
        problems: rules ? charaTwinProblems(rules, dyedChannel, character) : [],
      };
    })
    .sort((a, b) => a.itemId - b.itemId);
}

/** Spec G4: passes → most dye channels → not Dated → lowest row; none passes → lowest row. */
export function defaultTwin(twins: readonly GlamourTwin[]): GlamourTwin {
  const passing = twins.filter((t) => t.rules !== null && t.problems.length === 0);
  const best = [...passing].sort(
    (a, b) => (b.rules?.dyeCount ?? 0) - (a.rules?.dyeCount ?? 0) || Number(a.dated) - Number(b.dated) || a.itemId - b.itemId
  );
  return best[0] ?? twins[0];
}

/**
 * Spec G5. `fix`: the lowest row fails and the pick passes (a twin was named
 * to fix it). `block`: the pick fails — nothing fixes it, or the player chose
 * a twin that doesn't pass. `choice`: twins, nothing wrong. `unique`: one item.
 */
export function pieceTone(twins: readonly GlamourTwin[], picked: GlamourTwin): GlamourPieceTone {
  if (picked.problems.length > 0) return 'block';
  if (twins[0] && twins[0].problems.length > 0) return 'fix';
  return twins.length > 1 ? 'choice' : 'unique';
}

function canWear(mask: number | null, character: CharaCheckCharacter): boolean | null {
  if (mask === null || character.race === null || character.gender === null) return null;
  const bit = 2 * RACE_BIT[character.race] + (character.gender === 'Female' ? 1 : 0);
  return (mask & (1 << bit)) !== 0;
}

/** The picker's chips for one twin, in the design's order. */
export function twinFacts(
  twin: GlamourTwin,
  character: CharaCheckCharacter,
  best: GlamourTwin
): GlamourTwinFact[] {
  const facts: GlamourTwinFact[] = [];
  if (twin.itemId === best.itemId && twin.problems.length === 0 && twin.rules) {
    facts.push({ key: 'best', kind: 'acc' });
  }
  const rules = twin.rules;
  if (rules) {
    facts.push({ key: 'dye', kind: twin.problems.includes('dye') ? 'warn' : 'ok', n: rules.dyeCount });
    if (rules.wearMask === null || rules.wearMask === ANY_WEARER) facts.push({ key: 'anyTribe', kind: 'mute' });
    else if (canWear(rules.wearMask, character) === false) facts.push({ key: 'tribeNo', kind: 'warn' });
    else facts.push({ key: 'tribeOk', kind: 'ok' });
  }
  if (twin.dated) facts.push({ key: 'dated', kind: 'mute' });
  if (rules && rules.grandCompany > 0) facts.push({ key: 'grandCompany', kind: 'mute', n: rules.grandCompany });
  if (rules && !rules.glamourable) facts.push({ key: 'noGlamour', kind: 'warn' });
  return facts;
}
