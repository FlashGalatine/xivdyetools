/**
 * The Glamour Reader's twin rules (spec G3–G5): which of a model's identical
 * items the list names by default, how a row is toned, and the facts the
 * picker shows. Families are the session's verified examples.
 */
import { describe, it, expect } from 'vitest';
import type { CharaTwinRules } from '@xivdyetools/core';
import type { CharaResolvedItem } from '@services/chara-resolve-service';
import { defaultTwin, pieceTone, twinFacts, twinsOf } from '../glamour-twins';

const ANYONE = 0xffff;
const MEN = 0x5555;
const WOMEN = 0xaaaa;
const VIERA_WOMEN = 0x8000;

const names = (en: string) => ({ en, ja: en, de: en, fr: en });

function group(itemIds: number[], dyeCount: number, extra: Partial<CharaTwinRules> = {}): CharaTwinRules {
  return { itemIds, dyeCount, glamourable: true, wearMask: ANYONE, grandCompany: 0, ...extra };
}

function family(
  named: [number, string],
  alternates: Array<[number, string]>,
  rules: CharaTwinRules[],
  extra: Partial<CharaResolvedItem> = {}
): CharaResolvedItem {
  return {
    itemId: named[0],
    names: names(named[1]),
    iconId: null,
    familySize: 1 + alternates.length,
    alternates: alternates.map(([itemId, en]) => ({ itemId, names: names(en) })),
    viaMainHand: false,
    rules,
    ...extra,
  };
}

const MIDLANDER_WOMAN = { race: 'Hyur', gender: 'Female' } as const;

const COIF = family(
  [372, 'Dated Hempen Coif'],
  [
    [2629, 'Hempen Coif'],
    [2630, 'Hempen Coif'],
  ],
  [group([372], 0), group([2629, 2630], 1)]
);

describe('twinsOf', () => {
  it('lists the named item and its alternates in row order, with each one’s problems', () => {
    const twins = twinsOf(COIF, 1, MIDLANDER_WOMAN);
    expect(twins.map((t) => [t.itemId, t.dated, t.problems])).toEqual([
      [372, true, ['dye']],
      [2629, false, []],
      [2630, false, []],
    ]);
  });

  it('carries each twin’s own acquisition line', () => {
    const item = family([1, 'A'], [[2, 'B']], [group([1, 2], 0)], {
      acquisition: 'Line A',
      alternates: [{ itemId: 2, names: names('B'), acquisition: 'Line B' }],
    });
    expect(twinsOf(item, 0, MIDLANDER_WOMAN).map((t) => t.acquisition)).toEqual(['Line A', 'Line B']);
  });

  it('knows nothing when the worker answered without rules', () => {
    const item = family([1, 'A'], [[2, 'B']], []);
    const twins = twinsOf(item, 2, MIDLANDER_WOMAN);
    expect(twins.map((t) => [t.rules, t.problems])).toEqual([
      [null, []],
      [null, []],
    ]);
  });
});

describe('defaultTwin', () => {
  it('names the first twin that passes, not the lowest row (Hempen Coif, not the Dated one)', () => {
    expect(defaultTwin(twinsOf(COIF, 1, MIDLANDER_WOMAN)).itemId).toBe(2629);
  });

  it('prefers a non-Dated twin even when the Dated one passes too', () => {
    expect(defaultTwin(twinsOf(COIF, 0, MIDLANDER_WOMAN)).itemId).toBe(2629);
  });

  it("names the Replica for Curtana Zenith, and Lady's Yukata for a woman", () => {
    const curtana = family(
      [6257, 'Curtana Zenith'],
      [[12118, 'Curtana Zenith Replica']],
      [group([6257], 0, { glamourable: false }), group([12118], 0)]
    );
    expect(defaultTwin(twinsOf(curtana, 0, MIDLANDER_WOMAN)).itemId).toBe(12118);
    const yukata = family(
      [2967, "Lord's Yukata"],
      [[2970, "Lady's Yukata"]],
      [group([2967], 0, { wearMask: MEN }), group([2970], 0, { wearMask: WOMEN })]
    );
    expect(defaultTwin(twinsOf(yukata, 0, MIDLANDER_WOMAN)).itemId).toBe(2970);
  });

  it('falls back to the lowest row when no twin passes', () => {
    const gaskins = family([25210, 'Viera Gaskins'], [], [group([25210], 1, { wearMask: VIERA_WOMEN })]);
    expect(defaultTwin(twinsOf(gaskins, 1, MIDLANDER_WOMAN)).itemId).toBe(25210);
  });

  it('never defaults to a twin without a name (one past the alternates cap)', () => {
    // Only row 999 takes the dye, and the answer names neither it nor anything past the cap
    const item = family([10, 'Dated Cap'], [[11, 'Dated Cap']], [group([10, 11], 0), group([999], 1)]);
    const pick = defaultTwin(twinsOf(item, 1, MIDLANDER_WOMAN));
    expect([10, 11]).toContain(pick.itemId);
    expect(pick.names.en).toBe('Dated Cap');
  });
});

describe('pieceTone', () => {
  it('fix: the lowest row fails and the pick is a twin that passes', () => {
    const twins = twinsOf(COIF, 1, MIDLANDER_WOMAN);
    expect(pieceTone(twins, defaultTwin(twins))).toBe('fix');
  });

  it('choice: twins exist and nothing is wrong', () => {
    const gloves = family(
      [30000, 'Augmented Deepshadow Gloves of Striking'],
      [[30001, 'Deepshadow Gloves of Striking']],
      [group([30000, 30001], 2)]
    );
    const twins = twinsOf(gloves, 2, MIDLANDER_WOMAN);
    expect(pieceTone(twins, defaultTwin(twins))).toBe('choice');
  });

  it('block: no twin passes, or the player picked one that fails', () => {
    const gaskins = family([25210, 'Viera Gaskins'], [], [group([25210], 1, { wearMask: VIERA_WOMEN })]);
    const alone = twinsOf(gaskins, 1, MIDLANDER_WOMAN);
    expect(pieceTone(alone, alone[0])).toBe('block');
    const coif = twinsOf(COIF, 1, MIDLANDER_WOMAN);
    expect(pieceTone(coif, coif[0])).toBe('block');
  });

  it('unique: one item, nothing wrong', () => {
    const one = twinsOf(family([5, 'Plain Hat'], [], [group([5], 1)]), 1, MIDLANDER_WOMAN);
    expect(pieceTone(one, one[0])).toBe('unique');
  });
});

describe('twinFacts', () => {
  it('marks the default, the dye channels against the file, the tribe, Dated and the company', () => {
    const twins = twinsOf(COIF, 1, MIDLANDER_WOMAN);
    const pick = defaultTwin(twins);
    expect(twinFacts(twins[1], MIDLANDER_WOMAN, pick)).toEqual([
      { key: 'best', kind: 'acc' },
      { key: 'dye', kind: 'ok', n: 1 },
      { key: 'anyTribe', kind: 'mute' },
    ]);
    expect(twinFacts(twins[0], MIDLANDER_WOMAN, pick)).toEqual([
      { key: 'dye', kind: 'warn', n: 0 },
      { key: 'anyTribe', kind: 'mute' },
      { key: 'dated', kind: 'mute' },
    ]);
    const serpent = twinsOf(family([1618, "Serpent Private's Sword"], [], [group([1618], 0, { grandCompany: 2 })]), 0, MIDLANDER_WOMAN);
    expect(twinFacts(serpent[0], MIDLANDER_WOMAN, serpent[0])).toContainEqual({ key: 'grandCompany', kind: 'mute', n: 2 });
    const yukata = twinsOf(family([2967, "Lord's Yukata"], [], [group([2967], 0, { wearMask: MEN })]), 0, MIDLANDER_WOMAN);
    expect(twinFacts(yukata[0], MIDLANDER_WOMAN, yukata[0])).toContainEqual({ key: 'tribeNo', kind: 'warn' });
    const curtana = twinsOf(family([6257, 'Curtana Zenith'], [], [group([6257], 0, { glamourable: false })]), 0, MIDLANDER_WOMAN);
    expect(twinFacts(curtana[0], MIDLANDER_WOMAN, curtana[0])).toContainEqual({ key: 'noGlamour', kind: 'warn' });
  });
});
