/**
 * The in-game check, on rows taken from the Item sheet (ffxiv-datamining
 * English export, 7.55h): the Galatine sample's pieces, and real families
 * whose twins disagree: Dated Hempen Coif / Hempen Coif (dye count), Curtana
 * Zenith / its Replica (glamour flag), Lord's / Lady's Yukata (gender), and
 * the Grand Company privates' gear (company lock).
 *
 * Since patch 7.4 any job can wear any piece for glamour, so the check has no
 * job test: dye channels, the glamour flag, race, gender — and Grand Company,
 * which a .chara file does not record, so it is a flag and never a failure.
 */
import { describe, it, expect } from 'vitest';
import {
  charaTwinProblems,
  charaWearMask,
  checkCharaLook,
  groupCharaTwinRules,
  type CharaItemRules,
  type CharaTwinRules,
} from '../chara-game-rules.js';

/** An `EquipRaceCategory` row: every race column set to `races`, plus the two genders. */
function raceRow(races: boolean | string[], male: boolean, female: boolean) {
  const cols = ['Hyur', 'Elezen', 'Lalafell', 'Miqote', 'Roegadyn', 'AuRa', 'Hrothgar', 'Viera'];
  const row: Record<string, boolean> = { Male: male, Female: female };
  for (const c of cols) row[c] = races === true || (Array.isArray(races) && races.includes(c));
  return row;
}

const ANYONE = charaWearMask(raceRow(true, true, true));
const MEN = charaWearMask(raceRow(true, true, false));
const WOMEN = charaWearMask(raceRow(true, false, true));
const VIERA_WOMEN = charaWearMask(raceRow(['Viera'], false, true));

/** Grand Company rows: 1 Maelstrom, 2 Order of the Twin Adder, 3 Immortal Flames. */
const TWIN_ADDER = 2;

function rules(dyeCount: number, extra: Partial<CharaItemRules> = {}): CharaItemRules {
  return { dyeCount, glamourable: true, wearMask: ANYONE, grandCompany: 0, ...extra };
}

/** One family, grouped the way api-worker groups it. */
function family(...rows: Array<[number, CharaItemRules]>): CharaTwinRules[] {
  return groupCharaTwinRules(rows.map(([rowId, r]) => ({ rowId, rules: r })));
}

const HYUR_MAN = { race: 'Hyur', gender: 'Male' } as const;
const VIERA_WOMAN = { race: 'Viera', gender: 'Female' } as const;

describe('charaWearMask', () => {
  it('reads EquipRaceCategory rows 1, 2, 3 and 17 (anyone, men, women, Viera women)', () => {
    expect(ANYONE).toBe(0xffff);
    expect(MEN).toBe(0x5555);
    expect(WOMEN).toBe(0xaaaa);
    expect(VIERA_WOMEN).toBe(0x8000);
  });

  it('reads row 0 (nothing allowed) as unknown, and accepts 0/1 for booleans', () => {
    expect(charaWearMask(raceRow(false, false, false))).toBeNull();
    expect(charaWearMask({ Hyur: 1, Male: 1, Female: 0 })).toBe(0b1);
  });
});

describe('groupCharaTwinRules', () => {
  it('groups identical rules, orders groups by their lowest row, and skips unknown rows', () => {
    const groups = groupCharaTwinRules([
      { rowId: 2630, rules: rules(1) },
      { rowId: 372, rules: rules(0) },
      { rowId: 2629, rules: rules(1) },
      { rowId: 9999, rules: null },
    ]);
    expect(groups.map((g) => [g.itemIds, g.dyeCount])).toEqual([
      [[372], 0],
      [[2629, 2630], 1],
    ]);
  });

  it('keeps twins locked to different Grand Companies apart', () => {
    const groups = groupCharaTwinRules([
      { rowId: 1618, rules: rules(0, { grandCompany: TWIN_ADDER }) },
      { rowId: 1619, rules: rules(0, { grandCompany: 1 }) },
      { rowId: 1620, rules: rules(0, { grandCompany: 3 }) },
    ]);
    expect(groups.map((g) => g.grandCompany)).toEqual([TWIN_ADDER, 1, 3]);
  });

  it('answers [] when no row carries rules', () => {
    expect(groupCharaTwinRules([{ rowId: 1, rules: null }])).toEqual([]);
  });
});

describe('charaTwinProblems', () => {
  it('names every check one twin fails, and never the Grand Company', () => {
    const twin = family([1, rules(0, { glamourable: false, wearMask: MEN, grandCompany: 1 })])[0];
    expect(charaTwinProblems(twin, 1, VIERA_WOMAN)).toEqual(['dye', 'glamour', 'wear']);
    expect(charaTwinProblems(twin, 0, HYUR_MAN)).toEqual(['glamour']);
  });
});

describe('checkCharaLook — the Galatine sample', () => {
  const pieces = [
    { slot: 'HeadGear', itemId: 18085, twins: family([18085, rules(1)]), dyedChannel: 1 },
    { slot: 'Body', itemId: 44616, twins: family([44616, rules(2)]), dyedChannel: 2 },
    { slot: 'Feet', itemId: 15461, twins: family([15461, rules(0)]), dyedChannel: 0 },
  ] as const;

  it('finds every piece wearable and dyeable, with no job line', () => {
    const check = checkCharaLook(pieces, { race: 'Elezen', gender: 'Female' });
    expect(check.pieces.map((p) => p.problems)).toEqual([[], [], []]);
    expect(check).not.toHaveProperty('jobs');
    expect(check.pieces[0]).not.toHaveProperty('jobs');
  });
});

describe('checkCharaLook — twins that disagree', () => {
  it('Dated Hempen Coif takes no dye; its twin Hempen Coif does', () => {
    const twins = family([372, rules(0)], [2629, rules(1)], [2630, rules(1)]);
    const [piece] = checkCharaLook(
      [{ slot: 'HeadGear', itemId: 372, twins, dyedChannel: 1 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.problems).toEqual([]);
    expect(piece.useInstead).toEqual({ itemId: 2629, fixes: ['dye'] });
    const [undyed] = checkCharaLook(
      [{ slot: 'HeadGear', itemId: 372, twins, dyedChannel: 0 }],
      HYUR_MAN,
    ).pieces;
    expect(undyed.useInstead).toBeNull();
  });

  it('a second channel no twin has is a dye problem nothing fixes', () => {
    const twins = family([2629, rules(1)]);
    const [piece] = checkCharaLook(
      [{ slot: 'HeadGear', itemId: 2629, twins, dyedChannel: 2 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.problems).toEqual(['dye']);
    expect(piece.useInstead).toBeNull();
  });

  it('Curtana Zenith is no glamour; its Replica is', () => {
    const twins = family([6257, rules(0, { glamourable: false })], [12118, rules(0)]);
    const [piece] = checkCharaLook(
      [{ slot: 'MainHand', itemId: 6257, twins, dyedChannel: 0 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.useInstead).toEqual({ itemId: 12118, fixes: ['glamour'] });
  });

  it("Lord's Yukata is for men; a woman wears its twin, Lady's Yukata", () => {
    const twins = family([2967, rules(0, { wearMask: MEN })], [2970, rules(0, { wearMask: WOMEN })]);
    const [piece] = checkCharaLook(
      [{ slot: 'Body', itemId: 2967, twins, dyedChannel: 0 }],
      VIERA_WOMAN,
    ).pieces;
    expect(piece.useInstead).toEqual({ itemId: 2970, fixes: ['wear'] });
  });

  it('Viera Chestwrap is locked to Viera women, and an unknown character is never flagged', () => {
    const twins = family([25208, rules(2, { wearMask: VIERA_WOMEN })]);
    const input = [{ slot: 'Body', itemId: 25208, twins, dyedChannel: 0 }] as const;
    expect(checkCharaLook(input, HYUR_MAN).pieces[0].problems).toEqual(['wear']);
    expect(checkCharaLook(input, VIERA_WOMAN).pieces[0].problems).toEqual([]);
    expect(checkCharaLook(input, { race: null, gender: null }).pieces[0].problems).toEqual([]);
  });

  it("reports the named item's problems when each check passes on a different twin", () => {
    const twins = family([1, rules(1, { wearMask: MEN })], [2, rules(0)]);
    const [piece] = checkCharaLook(
      [{ slot: 'Body', itemId: 1, twins, dyedChannel: 1 }],
      VIERA_WOMAN,
    ).pieces;
    expect(piece.problems).toEqual(['wear']);
  });
});

describe('checkCharaLook — Grand Company', () => {
  it('flags a Grand Company piece without failing it', () => {
    const twins = family([1618, rules(0, { grandCompany: TWIN_ADDER })]);
    const [piece] = checkCharaLook(
      [{ slot: 'MainHand', itemId: 1618, twins, dyedChannel: 0 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.problems).toEqual([]);
    expect(piece.needsGrandCompany).toBe(TWIN_ADDER);
  });

  it('suggests a twin any company can wear before a company-locked one', () => {
    const twins = family(
      [10, rules(0)],
      [11, rules(1, { grandCompany: TWIN_ADDER })],
      [12, rules(1)],
    );
    const [piece] = checkCharaLook(
      [{ slot: 'Body', itemId: 10, twins, dyedChannel: 1 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.useInstead).toEqual({ itemId: 12, fixes: ['dye'] });
    expect(piece.needsGrandCompany).toBeNull();
  });

  it('flags the suggested twin when only a company-locked one passes', () => {
    const twins = family([10, rules(0)], [11, rules(1, { grandCompany: TWIN_ADDER })]);
    const [piece] = checkCharaLook(
      [{ slot: 'Body', itemId: 10, twins, dyedChannel: 1 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.useInstead).toEqual({ itemId: 11, fixes: ['dye'] });
    expect(piece.needsGrandCompany).toBe(TWIN_ADDER);
  });
});

describe('checkCharaLook — what is left out', () => {
  it('a model with no item is a problem', () => {
    const check = checkCharaLook([{ slot: 'Body', itemId: null, twins: [], dyedChannel: 0 }], HYUR_MAN);
    expect(check.pieces[0]).toEqual({
      slot: 'Body',
      problems: ['noItem'],
      useInstead: null,
      needsGrandCompany: null,
    });
  });

  it('skips pieces whose rules are unknown', () => {
    const check = checkCharaLook([{ slot: 'Feet', itemId: 15461, twins: [], dyedChannel: 0 }], HYUR_MAN);
    expect(check).toEqual({ pieces: [] });
  });
});
