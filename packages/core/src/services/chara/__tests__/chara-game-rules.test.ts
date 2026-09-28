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
