/**
 * The in-game check, on rows taken from the Item sheet (ffxiv-datamining
 * English export, 7.55h): the Galatine sample's seven pieces, and three real
 * families whose twins disagree: Dated Hempen Coif / Hempen Coif (dye count),
 * Curtana Zenith / its Replica (glamour flag), Lord's / Lady's Yukata (gender).
 */
import { describe, it, expect } from 'vitest';
import {
  CHARA_JOB_COLUMNS,
  charaJobsOf,
  charaWearMask,
  checkCharaLook,
  groupCharaTwinRules,
  type CharaItemRules,
  type CharaJob,
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

const ALL_JOBS: CharaJob[] = [...CHARA_JOB_COLUMNS];
const CASTERS: CharaJob[] = ['THM', 'BLM', 'ACN', 'SMN', 'RDM', 'BLU', 'PCT'];

function rules(
  dyeCount: number,
  jobs: CharaJob[],
  extra: Partial<CharaItemRules> = {},
): CharaItemRules {
  return { dyeCount, glamourable: true, wearMask: ANYONE, jobs, ...extra };
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

describe('charaJobsOf', () => {
  it('keeps ClassJobCategory column order and skips ADV and unknown keys', () => {
    // ClassJobCategory 63, "THM ACN BLM SMN RDM BLU PCT"
    const row: Record<string, unknown> = {
      Name: 'THM ACN BLM SMN RDM BLU PCT',
      ADV: true,
      Unknown1: true,
    };
    for (const job of ['PCT', 'THM', 'ACN', 'BLM', 'SMN', 'RDM', 'BLU']) row[job] = true;
    expect(charaJobsOf(row)).toEqual(CASTERS);
  });
});

describe('groupCharaTwinRules', () => {
  it('groups identical rules, orders groups by their lowest row, and skips unknown rows', () => {
    const groups = groupCharaTwinRules([
      { rowId: 2630, rules: rules(1, ALL_JOBS) },
      { rowId: 372, rules: rules(0, ALL_JOBS) },
      { rowId: 2629, rules: rules(1, ALL_JOBS) },
      { rowId: 9999, rules: null },
    ]);
    expect(groups.map((g) => [g.itemIds, g.dyeCount])).toEqual([
      [[372], 0],
      [[2629, 2630], 1],
    ]);
  });

  it('answers [] when no row carries rules', () => {
    expect(groupCharaTwinRules([{ rowId: 1, rules: null }])).toEqual([]);
  });
});

describe('checkCharaLook — the Galatine sample', () => {
  // Head, body, hands, legs, feet, ears and bow, with the file's dyed channels
  const pieces = [
    { slot: 'HeadGear', itemId: 18085, twins: family([18085, rules(1, CASTERS)]), dyedChannel: 1 },
    {
      slot: 'Body',
      itemId: 44616,
      twins: family([44616, rules(2, ['PGL', 'MNK', 'SAM', 'BST'])]),
      dyedChannel: 2,
    },
    { slot: 'Hands', itemId: 36823, twins: family([36823, rules(2, ALL_JOBS)]), dyedChannel: 1 },
    {
      slot: 'Legs',
      itemId: 42040,
      twins: family([42040, rules(2, ['CNJ', 'WHM', 'SCH', 'AST', 'SGE'])]),
      dyedChannel: 2,
    },
    { slot: 'Feet', itemId: 15461, twins: family([15461, rules(0, ALL_JOBS)]), dyedChannel: 0 },
    {
      slot: 'Ears',
      itemId: 35464,
      twins: family([35464, rules(0, ['MIN', 'BTN', 'FSH'])]),
      dyedChannel: 0,
    },
    {
      slot: 'MainHand',
      itemId: 49486,
      twins: family([49486, rules(0, ['ARC', 'BRD'])]),
      dyedChannel: 0,
    },
  ] as const;

  it('finds every piece wearable and dyeable, but no job that can wear them all', () => {
    const check = checkCharaLook(pieces, { race: 'Elezen', gender: 'Female' });
    expect(check.pieces.map((p) => p.problems)).toEqual([[], [], [], [], [], [], []]);
    expect(check.jobs).toEqual([]);
    expect(check.pieces[0].jobs).toEqual(CASTERS);
  });

  it('names the jobs that can when the pieces overlap', () => {
    const check = checkCharaLook([pieces[0], pieces[2], pieces[4]], HYUR_MAN);
    expect(check.jobs).toEqual(CASTERS);
  });
});

describe('checkCharaLook — twins that disagree', () => {
  it('Dated Hempen Coif takes no dye; its twin Hempen Coif does', () => {
    const twins = family(
      [372, rules(0, ALL_JOBS)],
      [2629, rules(1, ALL_JOBS)],
      [2630, rules(1, ALL_JOBS)],
    );
    const [piece] = checkCharaLook(
      [{ slot: 'HeadGear', itemId: 372, twins, dyedChannel: 1 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.problems).toEqual([]);
    expect(piece.useInstead).toEqual({ itemId: 2629, fixes: ['dye'] });
    // Undyed, the named coif is fine as it is
    const [undyed] = checkCharaLook(
      [{ slot: 'HeadGear', itemId: 372, twins, dyedChannel: 0 }],
      HYUR_MAN,
    ).pieces;
    expect(undyed.useInstead).toBeNull();
  });

  it('a second channel no twin has is a dye problem nothing fixes', () => {
    const twins = family([2629, rules(1, ALL_JOBS)]);
    const [piece] = checkCharaLook(
      [{ slot: 'HeadGear', itemId: 2629, twins, dyedChannel: 2 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.problems).toEqual(['dye']);
    expect(piece.useInstead).toBeNull();
  });

  it('Curtana Zenith is no glamour; its Replica is', () => {
    const twins = family(
      [6257, rules(0, ['PLD'], { glamourable: false })],
      [12118, rules(0, ['PLD'])],
    );
    const [piece] = checkCharaLook(
      [{ slot: 'MainHand', itemId: 6257, twins, dyedChannel: 0 }],
      HYUR_MAN,
    ).pieces;
    expect(piece.useInstead).toEqual({ itemId: 12118, fixes: ['glamour'] });
    const alone = family([6257, rules(0, ['PLD'], { glamourable: false })]);
    expect(
      checkCharaLook([{ slot: 'MainHand', itemId: 6257, twins: alone, dyedChannel: 0 }], HYUR_MAN)
        .pieces[0].problems,
    ).toEqual(['glamour']);
  });

  it("Lord's Yukata is for men; a woman wears its twin, Lady's Yukata", () => {
    const twins = family(
      [2967, rules(0, ALL_JOBS, { wearMask: MEN })],
      [2970, rules(0, ALL_JOBS, { wearMask: WOMEN })],
    );
    const [piece] = checkCharaLook(
      [{ slot: 'Body', itemId: 2967, twins, dyedChannel: 0 }],
      VIERA_WOMAN,
    ).pieces;
    expect(piece.useInstead).toEqual({ itemId: 2970, fixes: ['wear'] });
    const [asMan] = checkCharaLook(
      [{ slot: 'Body', itemId: 2967, twins, dyedChannel: 0 }],
      HYUR_MAN,
    ).pieces;
    expect(asMan.useInstead).toBeNull();
  });

  it('Viera Chestwrap is locked to Viera women, and an unknown character is never flagged', () => {
    const twins = family([25208, rules(2, ALL_JOBS, { wearMask: VIERA_WOMEN })]);
    const input = [{ slot: 'Body', itemId: 25208, twins, dyedChannel: 0 }] as const;
    expect(checkCharaLook(input, HYUR_MAN).pieces[0].problems).toEqual(['wear']);
    expect(checkCharaLook(input, VIERA_WOMAN).pieces[0].problems).toEqual([]);
    expect(checkCharaLook(input, { race: null, gender: null }).pieces[0].problems).toEqual([]);
  });

  it("reports the named item's problems when each check passes on a different twin", () => {
    // Twin A takes the dye but not this character; twin B fits them but takes no dye
    const twins = family([1, rules(1, ALL_JOBS, { wearMask: MEN })], [2, rules(0, ALL_JOBS)]);
    const [piece] = checkCharaLook(
      [{ slot: 'Body', itemId: 1, twins, dyedChannel: 1 }],
      VIERA_WOMAN,
    ).pieces;
    expect(piece.problems).toEqual(['wear']);
    expect(piece.jobs).toEqual([]);
  });
});

describe('checkCharaLook — what is left out', () => {
  it('a model with no item is a problem and takes no part in the job overlap', () => {
    const check = checkCharaLook(
      [
        { slot: 'Body', itemId: null, twins: [], dyedChannel: 0 },
        {
          slot: 'HeadGear',
          itemId: 18085,
          twins: family([18085, rules(1, CASTERS)]),
          dyedChannel: 0,
        },
      ],
      HYUR_MAN,
    );
    expect(check.pieces[0]).toEqual({
      slot: 'Body',
      problems: ['noItem'],
      useInstead: null,
      jobs: [],
    });
    expect(check.jobs).toEqual(CASTERS);
  });

  it('skips pieces whose rules are unknown, and answers null jobs when nothing is wearable', () => {
    const check = checkCharaLook(
      [{ slot: 'Feet', itemId: 15461, twins: [], dyedChannel: 0 }],
      HYUR_MAN,
    );
    expect(check).toEqual({ pieces: [], jobs: null });
  });
});
