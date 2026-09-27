import { describe, expect, it } from 'vitest';
import {
  buildInputs,
  fateZoneLevels,
  tablesFrom,
  type RawFiles,
  type RelicRule,
  type XivapiExtras,
} from '../../scripts/acquisition/inputs.js';

function raw(): RawFiles {
  return {
    shops: [
      {
        id: 263178,
        type: 'GilShop',
        npcs: [1048726],
        trades: [
          { currencies: [{ id: 1, amount: 28483 }], items: [{ id: 42027, amount: 1 }] },
          { currencies: [{ id: 1, amount: 10 }], items: [{ id: 5, amount: 1 }] },
        ],
      },
      { id: 1770926, type: 'SpecialShop', npcs: [1053905], trades: [{ currencies: [{ id: 47750, amount: 3 }], items: [{ id: 47878, amount: 1 }] }] },
      { id: 1770974, type: 'SpecialShop', npcs: [2], trades: [{ currencies: [{ id: 900, amount: 1 }], items: [{ id: 700, amount: 1 }, { id: 701, amount: 1 }] }] },
      { id: 1770500, type: 'SpecialShop', npcs: [3], trades: [{ currencies: [{ id: 901, amount: 0 }], items: [{ id: 702, amount: 1 }] }] },
    ],
    npcs: {
      1048726: { en: 'independent merchant', position: { map: 857, x: 30.47, y: 34.64 } },
      1053905: { en: 'Dodokkuli', position: { map: 1000, x: 6.71, y: 7.14 } },
      2: { en: 'token trader', position: { map: 1001, x: 1, y: 1 } },
      3: { en: 'in a duty', position: { map: 1002, x: 1, y: 1 } },
    },
    maps: {
      857: { placename_id: 4505, territory_id: 1187, dungeon: false, housing: false },
      1000: { placename_id: 5000, territory_id: 1269, dungeon: false, housing: false },
      1001: { placename_id: 5001, territory_id: 1300, dungeon: false, housing: false },
      1002: { placename_id: 5002, territory_id: 1301, dungeon: true, housing: false },
    },
    places: { 4505: { en: 'Urqopacha' }, 5000: { en: 'Phantom Village' }, 5001: { en: 'Sinus Ardorum' }, 5002: { en: 'Some Duty' } },
    instances: { 30100: { en: "Eden's Promise: Litany (Savage)" }, 1: { en: 'the Thousand Maws of Toto-Rak' } },
    instanceSources: { 32147: [30100], 42027: [1] },
    lootSources: { 36828: [36814] },
    mogstationSources: { 36814: { price: 22, id: 875 } },
    recipesPerItem: { 42027: [{ job: 13, lvl: 92 }], 5: [{ job: 8, lvl: 1 }] },
    questSources: { 42027: [65621, 70317, 66656] },
    quests: {
      65621: { name: { en: 'Close to Home' } },
      70317: { name: { en: 'Blue Starlight' } },
      66656: { name: { en: 'A Relic Reborn (Curtana)' } },
    },
    achievements: { 7: { en: 'Let the Bodies Hit the Floor', itemReward: 42027 } },
    fateSources: { 42027: [506], 701: [509] },
    fates: {
      506: { name: { en: 'He Taketh It with His Eyes' }, level: 92, location: 111 },
      507: { name: { en: 'Early FATE' }, level: 90, location: 111 },
      508: { name: { en: 'Unplaced' }, level: 50, location: 999 },
      509: { name: { en: 'Eggstract and Eggspedite' }, level: 1, location: 112 },
    },
    voyageSources: { 42027: [{ type: 0, id: 1 }, { type: 1, id: 2 }, { type: 1, id: 3 }] },
    desynth: { 42027: [5000] },
    specialShopNames: { 1770926: { en: 'Phantom Weapons Penumbrae' }, 1770974: { en: 'Cosmic Exploration Token Exchange' }, 1770500: { en: '' } },
    gilShopNames: { 263178: { en: 'Purchase Battlecraft Gear (DoW)' } },
  };
}

function extras(): XivapiExtras {
  return {
    equippable: new Map([
      [42027, 'Head'],
      [47878, "Rogue's Arm"],
      [700, "Carpenter's Primary Tool"],
      [701, 'Body'],
      [702, 'Legs'],
      [36828, 'Hands'],
      [10059, "Conjurer's Arm"],
    ]),
    items: new Map([
      [47750, { name: 'Arcanite', plural: 'chunks of arcanite', uiCategory: 61, repairJob: 0 }],
      [36656, { name: 'Trophy Crystal', plural: 'Trophy Crystals', uiCategory: 100, repairJob: 0 }],
      [5000, { name: 'Linen Robe', plural: 'linen robes', uiCategory: 35, repairJob: 13 }],
    ]),
    questJournal: new Map([
      [65621, { category: 'Seventh Umbral Era Main Scenario Quests', section: 'Main Scenario (A Realm Reborn through Endwalker)' }],
      [70317, { category: 'Seasonal Events', section: 'Other Quests' }],
      [66656, { category: 'Disciple of War Job Quests', section: 'Class & Job Quests' }],
    ]),
    levelZones: new Map([
      [111, 'Urqopacha'],
      [112, 'Old Gridania'],
    ]),
    overworld: new Set(['Urqopacha']),
    expansions: new Map([
      [1187, 5],
      [1269, 5],
      [1300, 5],
    ]),
    festivalShops: new Set([1770500]),
    outposts: new Map([[1048726, "Worlar's Echo"]]),
    relicSheetItems: new Map([['RelicItem', [10059]]]),
    names: new Map([
      [700, 'Cosmic Saw'],
      [701, "Cosmic Explorer's Jacket"],
    ]),
  };
}

function rule(saga: string, extra: Partial<RelicRule>): RelicRule {
  return { saga, sheets: [], shops: [], zones: [], toolNames: [], include: [], exclude: [], spotChecks: [], ...extra };
}

const RULES: RelicRule[] = [
  rule('Zodiac Weapons Saga', { sheets: [{ sheet: 'RelicItem', items: 'links' }] }),
  rule('Phantom Gear & Weapons', { shops: ['^Phantom Weapons '] }),
  rule('Cosmic Tools Saga', { toolNames: ['^Cosmic '] }),
];

describe('buildInputs', () => {
  const inputs = buildInputs(raw(), extras(), RULES);

  it('keeps offers for equippable items only, dropping zero-amount costs and naming shops by type', () => {
    expect(inputs.offers.get(42027)).toEqual([
      {
        shop: { id: 263178, name: 'Purchase Battlecraft Gear (DoW)', npcIds: [1048726], festival: false },
        costs: [{ itemId: 1, amount: 28483 }],
      },
    ]);
    expect(inputs.offers.has(5)).toBe(false);
    expect(inputs.offers.get(702)?.[0]).toMatchObject({ shop: { festival: true }, costs: [] });
  });

  it('places NPCs by their map, with the outpost and duty/housing flags', () => {
    expect(inputs.npcs.get(1048726)).toEqual({
      id: 1048726,
      name: 'independent merchant',
      zone: 'Urqopacha',
      outpost: "Worlar's Echo",
      unreachable: false,
    });
    expect(inputs.npcs.get(3)?.unreachable).toBe(true);
  });

  it('levels a zone by its lowest FATE and a FATE-less zone by its expansion', () => {
    expect(inputs.zoneLevels.get('Urqopacha')).toBe(90);
    expect(inputs.zoneLevels.get('Phantom Village')).toBe(90);
    expect(fateZoneLevels(raw(), extras().levelZones, extras().overworld)).toEqual(new Map([['Urqopacha', 90]]));
  });

  it("never levels a town by a seasonal event's FATE, but still lists that FATE as a source", () => {
    expect(inputs.zoneLevels.has('Old Gridania')).toBe(false);
    expect(inputs.fates.get(701)).toEqual([{ name: 'Eggstract and Eggspedite', zone: 'Old Gridania' }]);
  });

  it('capitalizes duty names', () => {
    expect(inputs.dutyNames.get(1)).toBe('The Thousand Maws of Toto-Rak');
    expect(inputs.dutyNames.get(30100)).toBe("Eden's Promise: Litany (Savage)");
    expect(inputs.duties.get(32147)).toEqual([30100]);
  });

  it('classifies quests: main scenario, seasonal event, everything else a sidequest', () => {
    expect(inputs.questInfo.get(65621)).toEqual({ name: 'Close to Home', kind: 'msq' });
    expect(inputs.questInfo.get(70317)).toEqual({ name: 'Blue Starlight', kind: 'event' });
    expect(inputs.questInfo.get(66656)).toEqual({ name: 'A Relic Reborn (Curtana)', kind: 'side' });
  });

  it('reads recipes, achievements, FATEs, voyages and desynthesis', () => {
    expect(inputs.recipes.get(42027)).toEqual([{ job: 13, level: 92 }]);
    expect(inputs.recipes.has(5)).toBe(false);
    expect(inputs.achievements.get(42027)).toEqual(['Let the Bodies Hit the Floor']);
    expect(inputs.fates.get(42027)).toEqual([{ name: 'He Taketh It with His Eyes', zone: 'Urqopacha' }]);
    expect(inputs.voyages.get(42027)).toEqual(['airship', 'submarine']);
    expect(inputs.desynth.get(42027)).toEqual([{ sourceItemId: 5000, job: 13 }]);
  });

  it('builds title-case plurals and keeps the store and container maps', () => {
    expect(inputs.items.get(36656)).toEqual({ name: 'Trophy Crystal', plural: 'Trophy Crystals', uiCategory: 100 });
    expect(inputs.items.get(47750)?.plural).toBe('Arcanite');
    expect(inputs.containers.get(36828)).toEqual([36814]);
    expect(inputs.onlineStore.has(36814)).toBe(true);
  });

  it('computes relic sagas from sheets, shop names and tool names (tools only)', () => {
    expect(inputs.relics.get(10059)).toBe('Zodiac Weapons Saga');
    expect(inputs.relics.get(47878)).toBe('Phantom Gear & Weapons');
    expect(inputs.relics.get(700)).toBe('Cosmic Tools Saga');
    expect(inputs.relics.has(701)).toBe(false);
  });

  it('applies include and exclude, and the first matching rule wins', () => {
    const relics = buildInputs(raw(), extras(), [
      rule('Phantom Gear & Weapons', { shops: ['^Phantom Weapons '], exclude: [47878] }),
      rule('Other Saga', { shops: ['^Phantom Weapons '], include: [42027] }),
    ]).relics;
    expect(relics.get(47878)).toBe('Other Saga');
    expect(relics.get(42027)).toBe('Other Saga');
  });
});

describe('tablesFrom', () => {
  it('resolves Eureka lockbox names to item ids and keeps the reviewed lists', () => {
    const inputs = buildInputs(raw(), extras(), []);
    inputs.items.set(22508, { name: 'Anemos Lockbox', plural: 'Anemos Lockboxes', uiCategory: 61 });
    const tables = tablesFrom(
      {
        gacha: [{ id: 33441, name: 'Fête Present' }],
        eurekaLockboxes: { 'Anemos Lockbox': 'Eureka Anemos Lockboxes' },
        ishgardDistricts: ['The Firmament'],
      },
      inputs
    );
    expect(tables.gachaContainers).toEqual(new Set([33441]));
    expect(tables.eurekaLockboxes).toEqual(new Map([[22508, 'Eureka Anemos Lockboxes']]));
    expect(tables.ishgardDistricts).toEqual(new Set(['The Firmament']));
  });
});
