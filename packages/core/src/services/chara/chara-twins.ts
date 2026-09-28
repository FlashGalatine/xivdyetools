/**
 * Twins — items the game draws identically — for the Glamour Reader and the
 * `/glamour` bot card (spec G3–G5, docs/superpowers/specs/2026-09-27-glamour-reader-design.md).
 *
 * A `.chara` file stores a model, not an item, and one model often stands for
 * a whole family: Dated Hempen Coif and two Hempen Coifs, Curtana Zenith and
 * its Replica, Lord's and Lady's Yukata. api-worker answers the family (the
 * lowest row, the named alternates, and the in-game rules grouped by rule
 * set); this module decides which twin a list names and how a row reads.
 *
 * Default name: the first twin that passes the in-game check for this file —
 * it takes the file's dyes, can be a glamour, and allows this tribe and
 * gender — preferring the most dye channels (GPOSERS reminders, March 2026:
 * "use a perfectly identical dyeable version instead of an undyeable one"),
 * then a twin that is not Dated, then one any Grand Company can wear, then
 * the lowest row. When none passes, the lowest row. Only twins the answer
 * NAMES are candidates: a list can't print an item it has no name for.
 *
 * Pure, and generic over the name shape so each caller keeps its own.
 */

import {
  charaTwinProblems,
  type CharaCheckCharacter,
  type CharaPieceProblem,
  type CharaTwinRules,
} from './chara-game-rules.js';

/** Every race × gender bit set: `EquipRaceCategory` row 1. */
const ANY_WEARER = 0xffff;

/** One named member of a family, as the resolve answer carries it. */
export interface CharaTwinMember<N extends { en: string } = { en: string }> {
  itemId: number;
  names: N;
  /** The member's own GPOSERS acquisition line, when api-worker has one */
  acquisition?: string;
}

/** A resolved piece: the named item, its named alternates, and the family's rules. */
export interface CharaTwinFamily<
  N extends { en: string } = { en: string },
> extends CharaTwinMember<N> {
  alternates: ReadonlyArray<CharaTwinMember<N>>;
  /** `[]` or absent = the worker gave no rules */
  rules?: readonly CharaTwinRules[];
}

export interface CharaTwin<N extends { en: string } = { en: string }> extends CharaTwinMember<N> {
  /** The rule set this twin follows; null when the worker did not say */
  rules: CharaTwinRules | null;
  /** The English name starts with "Dated " — a retired twin the game still draws */
  dated: boolean;
  /** Checks this twin fails for the file and character; `[]` when rules are unknown */
  problems: CharaPieceProblem[];
}

export type CharaPieceTone = 'fix' | 'block' | 'choice' | 'unique';

export type CharaTwinFact =
  | { key: 'best'; kind: 'acc' }
  | { key: 'dye'; kind: 'ok' | 'warn'; n: number }
  | { key: 'anyTribe'; kind: 'mute' }
  | { key: 'tribeOk'; kind: 'ok' }
  | { key: 'tribeNo'; kind: 'warn' }
  | { key: 'dated'; kind: 'mute' }
  | { key: 'grandCompany'; kind: 'mute'; n: number }
  | { key: 'noGlamour'; kind: 'warn' };

/** The named item and its alternates, row order, each checked against the file. */
export function charaTwinsOf<N extends { en: string }>(
  family: CharaTwinFamily<N>,
  dyedChannel: number,
  character: CharaCheckCharacter,
): Array<CharaTwin<N>> {
  const members: Array<CharaTwinMember<N>> = [family, ...family.alternates];
  return members
    .map((member) => {
      const rules = family.rules?.find((g) => g.itemIds.includes(member.itemId)) ?? null;
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

/** passes → most dye channels → not Dated → any Grand Company → lowest row; none passes → lowest row. */
export function defaultCharaTwin<N extends { en: string }>(
  twins: ReadonlyArray<CharaTwin<N>>,
): CharaTwin<N> {
  const passing = twins.filter((t) => t.rules !== null && t.problems.length === 0);
  const best = [...passing].sort(
    (a, b) =>
      (b.rules?.dyeCount ?? 0) - (a.rules?.dyeCount ?? 0) ||
      Number(a.dated) - Number(b.dated) ||
      Number((a.rules?.grandCompany ?? 0) > 0) - Number((b.rules?.grandCompany ?? 0) > 0) ||
      a.itemId - b.itemId,
  );
  return best[0] ?? twins[0];
}

/**
 * `fix`: the lowest row fails and the pick passes (a twin was named to fix
 * it). `block`: the pick fails — nothing fixes it, or the player chose a twin
 * that doesn't pass. `choice`: twins, nothing wrong. `unique`: one item.
 */
export function charaPieceTone<N extends { en: string }>(
  twins: ReadonlyArray<CharaTwin<N>>,
  picked: CharaTwin<N>,
): CharaPieceTone {
  if (picked.problems.length > 0) return 'block';
  if (twins[0] && twins[0].problems.length > 0) return 'fix';
  return twins.length > 1 ? 'choice' : 'unique';
}

/** A picker's chips for one twin, in the design's order. */
export function charaTwinFacts<N extends { en: string }>(
  twin: CharaTwin<N>,
  best: CharaTwin<N>,
): CharaTwinFact[] {
  const facts: CharaTwinFact[] = [];
  if (twin.itemId === best.itemId && twin.problems.length === 0 && twin.rules) {
    facts.push({ key: 'best', kind: 'acc' });
  }
  const rules = twin.rules;
  if (rules) {
    facts.push({
      key: 'dye',
      kind: twin.problems.includes('dye') ? 'warn' : 'ok',
      n: rules.dyeCount,
    });
    if (rules.wearMask === null || rules.wearMask === ANY_WEARER) {
      facts.push({ key: 'anyTribe', kind: 'mute' });
    } else if (twin.problems.includes('wear')) {
      facts.push({ key: 'tribeNo', kind: 'warn' });
    } else {
      facts.push({ key: 'tribeOk', kind: 'ok' });
    }
  }
  if (twin.dated) facts.push({ key: 'dated', kind: 'mute' });
  if (rules && rules.grandCompany > 0) {
    facts.push({ key: 'grandCompany', kind: 'mute', n: rules.grandCompany });
  }
  if (rules && !rules.glamourable) facts.push({ key: 'noGlamour', kind: 'warn' });
  return facts;
}
