/**
 * The resolution rules from docs/research/chara-equipment-resolution §5/§8.2,
 * pinned as tests. Row fixtures mirror real XIVAPI answers (2026-08-19 probe).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  indexRows,
  lookupsFor,
  pickItem,
  pickGlasses,
  resolveCharaEquipment,
  MAX_ALTERNATES,
} from './resolver';
import { loadRegionalNames } from './regional-names';
import type { ItemRow } from './types';
import { lookupKey } from './types';

const TROPHY_LINE = "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)";
vi.mock('./acquisition.js', () => ({
  facewearAcquisitionFor: (glassesId: number) => glassesId >= 1 && glassesId <= 12 ? 'Vendor - Old Gridania (100 Gil)' : undefined,
  acquisitionFor: (itemId: number) =>
    itemId === 47252 ? "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)" : undefined,
}));

describe('facewear acquisition', () => {
  it.each([1, 2, 12])('attaches the unlock source while retaining the worn variant %i', (id) => {
    const names = { en: 'Oval Spectacles', ja: 'JP', de: 'DE', fr: 'FR' };
    expect(pickGlasses({ rowId: id, names, iconId: 200049 })).toEqual({
      id, names, iconId: 200049, acquisition: 'Vendor - Old Gridania (100 Gil)',
    });
  });
  it('omits unknown sources and keeps unresolved facewear null', () => {
    expect(pickGlasses({ rowId: 999, names: { en: 'Unknown', ja: '', de: '', fr: '' }, iconId: null })).not.toHaveProperty('acquisition');
    expect(pickGlasses(null)).toBeNull();
  });
});

const row = (
  rowId: number,
  en: string,
  modelMain: string,
  slots: string[],
  extra: Partial<ItemRow> = {},
): ItemRow => ({
  rowId,
  names: { en, ja: `${en}@ja`, de: `${en}@de`, fr: `${en}@fr` },
  iconId: 41716,
  modelMain,
  modelSub: '0',
  slots,
  levelEquip: null,
  rules: null,
  ...extra,
});

const ANYONE = 0xffff;

// OPT-002: the ko/zh tables load on first use; the route awaits this before resolving.
beforeAll(() => loadRegionalNames());

// Runaway Bow #49486 — ModelMain 634/19/1, ModelSub 698/149/1 (the quiver)
const RUNAWAY_BOW = row(49486, 'Runaway Bow', '4296213114', ['MainHand'], {
  modelSub: '4304732858',
  iconId: 32065,
});
// Asphodelos Shield #35264 — a genuine off-hand, its own ModelMain
const ASPHODELOS_SHIELD = row(35264, 'Asphodelos Shield', '4295032944', ['OffHand']);
// The Emperor's New Ring #9295 — rings carry BOTH finger columns
const EMPEROR_RING = row(9295, "The Emperor's New Ring", '65589', ['FingerL', 'FingerR']);

describe('lookupsFor', () => {
  it('emits one (column, packed key) per worn slot, rings split L/R, duplicates collapse', () => {
    const lookups = lookupsFor([
      { slot: 'HeadGear', base: 361, variant: 5 },
      { slot: 'LeftRing', base: 53, variant: 1 },
      { slot: 'RightRing', base: 53, variant: 1 },
      { slot: 'MainHand', set: 634, base: 19, variant: 1 },
      { slot: 'MainHand', set: 634, base: 19, variant: 1 },
    ]);
    expect(lookups).toEqual([
      { field: 'Head', key: '328041' },
      { field: 'FingerL', key: '65589' },
      { field: 'FingerR', key: '65589' },
      { field: 'MainHand', key: '4296213114' },
    ]);
  });
});

describe('indexRows', () => {
  it('files a row under every slot column it satisfies', () => {
    const index = indexRows([EMPEROR_RING, RUNAWAY_BOW]);
    expect(index.get(lookupKey({ field: 'FingerL', key: '65589' }))).toEqual([EMPEROR_RING]);
    expect(index.get(lookupKey({ field: 'FingerR', key: '65589' }))).toEqual([EMPEROR_RING]);
    expect(index.get(lookupKey({ field: 'MainHand', key: '4296213114' }))).toEqual([RUNAWAY_BOW]);
    expect(index.has(lookupKey({ field: 'OffHand', key: '4296213114' }))).toBe(false);
  });
});

describe('pickItem', () => {
  it('replaces retired names with the lowest eligible same-model twin, excluding them from rules and alternates', () => {
    const retired = [
      row(1, 'Dated Hempen Coif', '65540', ['Head'], { levelEquip: 1 }),
      row(2, 'Aetherial Hempen Coif', '65540', ['Head']),
      row(3, 'Deepmist Coif', '65540', ['Head']),
    ].map((r) => ({
      ...r,
      rules: { dyeCount: 0, glamourable: true, wearMask: ANYONE, grandCompany: 1 },
    }));
    const current = row(2629, 'Hempen Coif', '65540', ['Head'], {
      levelEquip: 1,
      rules: { dyeCount: 1, glamourable: true, wearMask: ANYONE, grandCompany: 0 },
    });
    const item = pickItem([
      ...retired,
      row(2630, 'Hempen Coif of Gathering', '65540', ['Head']),
      current,
    ])!;
    expect(item.itemId).toBe(2629);
    expect(item.familySize).toBe(2);
    expect(item.alternates.map((r) => r.itemId)).toEqual([2630]);
    expect(item.rules).toEqual([{ itemIds: [2629], ...current.rules }]);
  });

  it.each([1, 49, 50])('filters Dated gear at equipment level %i', (levelEquip) => {
    expect(pickItem([row(1, 'Dated Coif', '1', ['Head'], { levelEquip })])).toBeNull();
  });

  it.each([51, null])(
    'keeps Dated gear when its level is %s, outside the known <= 50 filter',
    (levelEquip) => {
      expect(pickItem([row(1, 'Dated Coif', '1', ['Head'], { levelEquip })])?.itemId).toBe(1);
    },
  );

  it.each(['Aetherial Coif', 'Deepmist Coif'])(
    'omits %s when no eligible visually identical row exists',
    (name) => {
      expect(pickItem([row(1, name, '1', ['Head'], { levelEquip: 90 })])).toBeNull();
    },
  );

  it('returns null for no rows — "no item row", never an error', () => {
    expect(pickItem([])).toBeNull();
  });

  it("adds the named item's acquisition line and omits the field when there is none", () => {
    expect(pickItem([row(47252, 'Trophy Legs', '1', ['Legs'])])?.acquisition).toBe(TROPHY_LINE);
    expect(pickItem([row(5, 'Plain Legs', '1', ['Legs'])])).not.toHaveProperty('acquisition');
  });

  it("gives each twin its own line, never a sibling's", () => {
    const item = pickItem([row(47252, 'Trophy Legs', '1', ['Legs']), row(5, 'Plain Legs', '1', ['Legs'])]);
    expect(item?.itemId).toBe(5);
    expect(item).not.toHaveProperty('acquisition');
    expect(item?.alternates[0]).toEqual({ itemId: 47252, names: expect.any(Object), acquisition: TROPHY_LINE });
  });

  it('names the family by its lowest row_id and carries the rest as alternates', () => {
    // Antiquated Constellation Armlets family (Gloves:65866) — 5 visually identical rows
    const family = [
      row(22143, 'Constellation Armlets +1', '65866', ['Gloves']),
      row(17804, 'Antiquated Constellation Armlets', '65866', ['Gloves']),
      row(22068, 'Constellation Armlets', '65866', ['Gloves']),
      row(22218, 'Constellation Armlets +2', '65866', ['Gloves']),
      row(24038, 'Anemos Constellation Armlets', '65866', ['Gloves']),
    ];
    const item = pickItem(family)!;
    expect(item.itemId).toBe(17804);
    expect(item.names.en).toBe('Antiquated Constellation Armlets');
    expect(item.familySize).toBe(5);
    expect(item.alternates.map((a) => a.itemId)).toEqual([22068, 22143, 22218, 24038]);
    expect(item.viaMainHand).toBe(false);
  });

  it('caps alternates at MAX_ALTERNATES while familySize keeps the true count', () => {
    const family = Array.from({ length: MAX_ALTERNATES + 5 }, (_, i) =>
      row(1000 + i, `Variant ${i}`, '1', ['Neck']),
    );
    const item = pickItem(family)!;
    expect(item.familySize).toBe(MAX_ALTERNATES + 5);
    expect(item.alternates).toHaveLength(MAX_ALTERNATES);
  });

  it('names every rule set among the alternates, so a twin that passes is never cut by the cap', () => {
    // Dated Hempen Coif #372 takes no dye; its twins Hempen Coif #2629 / #2630 take one
    const coif = (rowId: number, en: string, dyeCount: number) =>
      row(rowId, en, '65540', ['Head'], {
        rules: { dyeCount, glamourable: true, wearMask: ANYONE, grandCompany: 0 },
      });
    const padding = Array.from({ length: MAX_ALTERNATES }, (_, i) => coif(400 + i, `Dated Filler ${i}`, 0));
    const item = pickItem([coif(2630, 'Hempen Coif of Gathering', 1), coif(372, 'Dated Hempen Coif', 0), ...padding, coif(2629, 'Hempen Coif', 1)])!;
    expect(item.itemId).toBe(372);
    const alternates = item.alternates.map((a) => a.itemId);
    // Hempen Coif #2629 sorts past eight Dated fillers, but it is the lowest
    // row of the rule set that takes the dye — the reader must be able to name it
    expect(alternates).toContain(2629);
    expect(alternates).toHaveLength(MAX_ALTERNATES);
    expect(alternates).toEqual([...alternates].sort((x, y) => x - y));
    expect(item.rules.map((r) => [r.itemIds[0], r.dyeCount, r.itemIds.length])).toEqual([
      [372, 0, MAX_ALTERNATES + 1],
      [2629, 1, 2],
    ]);
  });

  it('answers no rule sets when the rows carry none (an answer without the fields)', () => {
    expect(pickItem([row(18085, 'Beech Mask of Casting', '328041', ['Head'])])!.rules).toEqual([]);
  });

  it('merges ko/zh from the build-time tables and omits them when unknown', () => {
    // #18085 Beech Mask of Casting — present in both regional tables
    const known = pickItem([row(18085, 'Beech Mask of Casting', '328041', ['Head'])])!;
    expect(known.names.ko).toBe('너도밤나무 마술사 가면');
    expect(known.names.zh).toBe('山毛榉咏咒面具');
    // A row id no regional table carries → keys absent, caller falls back to EN
    const unknown = pickItem([row(987654321, 'Future Item', '1', ['Head'])])!;
    expect(unknown.names.ko).toBeUndefined();
    expect(unknown.names.zh).toBeUndefined();
    expect(unknown.names.en).toBe('Future Item');
  });
});

describe('resolveCharaEquipment — off-hand rules', () => {
  const source = (rows: ItemRow[]) => {
    const index = indexRows(rows);
    return (l: { field: string; key: string }) => index.get(lookupKey(l)) ?? [];
  };

  it('does not use a retired twin\'s ModelSub to misidentify a genuine shield', () => {
    const retired = row(1, 'Dated Bow', RUNAWAY_BOW.modelMain, ['MainHand'], {
      levelEquip: 50, modelSub: ASPHODELOS_SHIELD.modelMain,
    });
    const result = resolveCharaEquipment({ gear: [
      { slot: 'MainHand', set: 634, base: 19, variant: 1 },
      { slot: 'OffHand', set: 112, base: 1, variant: 1 },
    ] }, source([retired, RUNAWAY_BOW, ASPHODELOS_SHIELD]), undefined, 'v');
    expect(result.items.MainHand?.itemId).toBe(49486);
    expect(result.items.OffHand).toMatchObject({ itemId: 35264, viaMainHand: false });
  });

  it('an off-hand equal to the main hand ModelSub IS the main weapon (quiver)', () => {
    const res = resolveCharaEquipment(
      {
        gear: [
          { slot: 'MainHand', set: 634, base: 19, variant: 1 },
          { slot: 'OffHand', set: 698, base: 149, variant: 1 },
        ],
      },
      source([RUNAWAY_BOW]),
      undefined,
      'v1',
    );
    expect(res.items.MainHand?.itemId).toBe(49486);
    expect(res.items.MainHand?.viaMainHand).toBe(false);
    expect(res.items.OffHand?.itemId).toBe(49486);
    expect(res.items.OffHand?.viaMainHand).toBe(true);
    expect(res.glasses).toBeUndefined();
    expect(res.version).toBe('v1');
  });

  it('an off-hand equal to the main-hand KEY (MainHand written twice) is the main weapon', () => {
    const fists = row(10067, "The Emperor's New Fists", String(301 + (31 << 16) + 2 ** 32), ['MainHand'], {
      modelSub: String(351 + (31 << 16) + 2 ** 32),
    });
    const res = resolveCharaEquipment(
      {
        gear: [
          { slot: 'MainHand', set: 301, base: 31, variant: 1 },
          { slot: 'OffHand', set: 301, base: 31, variant: 1 },
        ],
      },
      source([fists]),
      undefined,
      null,
    );
    expect(res.items.OffHand?.itemId).toBe(10067);
    expect(res.items.OffHand?.viaMainHand).toBe(true);
  });

  it('a genuine off-hand (shield) resolves on its own OffHand lookup', () => {
    const res = resolveCharaEquipment(
      {
        gear: [
          { slot: 'MainHand', set: 634, base: 19, variant: 1 },
          { slot: 'OffHand', set: 112, base: 1, variant: 1 },
        ],
      },
      source([RUNAWAY_BOW, ASPHODELOS_SHIELD]),
      undefined,
      null,
    );
    expect(res.items.OffHand?.itemId).toBe(35264);
    expect(res.items.OffHand?.viaMainHand).toBe(false);
  });

  it('with no main hand, the off-hand is looked up directly', () => {
    const res = resolveCharaEquipment(
      { gear: [{ slot: 'OffHand', set: 112, base: 1, variant: 1 }] },
      source([ASPHODELOS_SHIELD]),
      undefined,
      null,
    );
    expect(res.items.MainHand).toBeUndefined();
    expect(res.items.OffHand?.itemId).toBe(35264);
  });

  it('a key with no rows is null; requested glasses with no row is null', () => {
    const res = resolveCharaEquipment(
      { gear: [{ slot: 'Body', base: 9903, variant: 1 }], glasses: 12345 },
      source([]),
      null,
      null,
    );
    expect(res.items.Body).toBeNull();
    expect(res.glasses).toBeNull();
  });

  it('rings resolve through their own column — the same item lands on both hands', () => {
    const res = resolveCharaEquipment(
      {
        gear: [
          { slot: 'LeftRing', base: 53, variant: 1 },
          { slot: 'RightRing', base: 53, variant: 1 },
        ],
      },
      source([EMPEROR_RING]),
      undefined,
      null,
    );
    expect(res.items.LeftRing?.itemId).toBe(9295);
    expect(res.items.RightRing?.itemId).toBe(9295);
  });

  it('answers only the slots that were asked about', () => {
    const res = resolveCharaEquipment(
      { gear: [{ slot: 'HeadGear', base: 361, variant: 5 }] },
      source([row(18085, 'Beech Mask of Casting', '328041', ['Head'])]),
      undefined,
      null,
    );
    expect(Object.keys(res.items)).toEqual(['HeadGear']);
  });
});
