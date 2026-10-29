/**
 * The GPOSERS form as data — shared by the web Glamour Reader and the
 * `/glamour` bot, so the two write the same lines.
 */
import { describe, it, expect } from 'vitest';
import {
  CHARA_DYEABLE_SLOTS,
  CHARA_OFF_HAND_MAIN_CATEGORIES,
  GPOSERS_SLOTS,
  gposersGroups,
  gposersOmittedSlots,
  gposersSameRings,
  gposersSlotLabel,
  type GposersSlot,
} from '../chara-gposers.js';

const flat = (input: Parameters<typeof gposersGroups>[0]) =>
  gposersGroups(input).map((g) => g.map((l) => (l.value ? `${l.label} ${l.value}` : l.label)));

describe('gposersGroups', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    [' \t\r\n ', ''],
    [' alpha\rbeta ', 'alpha beta'],
    [' alpha\nbeta ', 'alpha beta'],
    ['alpha \t\r\n\u2028\u2029\u00a0\tbeta', 'alpha beta'],
    ['alpha\n \t\n beta', 'alpha beta'],
    ['alpha  beta', 'alpha  beta'],
    ['alpha\t\tbeta', 'alpha\t\tbeta'],
    ['alpha\u2028\u2029beta', 'alpha\u2028\u2029beta'],
    ['alpha \t\u2028\u2029\u00a0\ufeff\v\fbeta', 'alpha \t\u2028\u2029\u00a0\ufeff\v\fbeta'],
    [' \u2028alpha\u2029 ', 'alpha'],
  ])('preserves the newline-only joining contract for %j', (input, expected) => {
    expect(gposersGroups({ Body: { name: input, dye1: input, dye2: input, acquisition: input } })).toEqual([
      [
        { label: 'Body:', value: expected, bold: true },
        ...(expected ? [
          { label: 'Dye 1:', value: expected, bold: false },
          { label: 'Dye 2:', value: expected, bold: false },
        ] : []),
        { label: 'Acquisition:', value: expected, bold: false },
      ],
    ]);
  });

  it('merges ring names equivalent after CR/LF joining but preserves internal tabs and spaces', () => {
    const joined = {
      RightRing: { name: ' Silver \t\r\n Ring ', acquisition: ' Vendor\nGridania ' },
      LeftRing: { name: 'Silver Ring' },
    };
    expect(gposersSameRings(joined)).toBe(true);
    expect(gposersGroups(joined)).toEqual([[
      { label: 'Rings:', value: 'Silver Ring', bold: true },
      { label: 'Acquisition:', value: 'Vendor Gridania', bold: false },
    ]]);
    expect(gposersSameRings({ RightRing: { name: 'Silver\tRing' }, LeftRing: { name: 'Silver Ring' } })).toBe(false);
    expect(gposersSameRings({ RightRing: { name: 'Silver  Ring' }, LeftRing: { name: 'Silver Ring' } })).toBe(false);
  });

  it('writes worn slots in the form order: name, dyed channels only, then Acquisition', () => {
    expect(
      flat({
        Body: { name: 'Lady’s Yukata', dye1: 'Wine Red', dye2: 'Dalamud Red', acquisition: 'Moonfire Faire' },
        MainHand: { name: 'Curtana Zenith Replica', dye1: 'Metallic Gold' },
        Feet: { name: 'Hempen Boots' },
      })
    ).toEqual([
      ['Main Hand: Curtana Zenith Replica', 'Dye 1: Metallic Gold', 'Acquisition:'],
      ['Body: Lady’s Yukata', 'Dye 1: Wine Red', 'Dye 2: Dalamud Red', 'Acquisition: Moonfire Faire'],
      ['Feet: Hempen Boots', 'Acquisition:'],
    ]);
  });

  it('bolds only the slot line', () => {
    const [group] = gposersGroups({ HeadGear: { name: 'Hempen Coif', dye1: 'Snow White' } });
    expect(group!.map((l) => l.bold)).toEqual([true, false, false]);
  });

  it('writes no dye lines for accessories and facewear, whatever the input claims', () => {
    expect(flat({ Ears: { name: 'Stud', dye1: 'Snow White' }, Facewear: { name: 'Spectacles' } })).toEqual([
      ['Earrings: Stud', 'Acquisition:'],
      ['Facewear: Spectacles', 'Acquisition:'],
    ]);
  });

  it('writes two identical rings once, as Rings, from the right ring', () => {
    const rings = { RightRing: { name: 'Silver Ring', acquisition: 'Vendor' }, LeftRing: { name: 'Silver Ring' } };
    expect(gposersSameRings(rings)).toBe(true);
    expect(flat(rings)).toEqual([['Rings: Silver Ring', 'Acquisition: Vendor']]);
    expect(gposersSameRings({ RightRing: { name: '' }, LeftRing: { name: '' } })).toBe(false);
  });

  it('keeps every value on one line', () => {
    expect(flat({ Legs: { name: 'Gaskins', acquisition: 'Vendor\n  Old Gridania\r\n' } })).toEqual([
      ['Legs: Gaskins', 'Acquisition: Vendor Old Gridania'],
    ]);
  });

  it('names slots in the form’s own English', () => {
    expect(gposersSlotLabel('Wrists')).toBe('Bracelets');
    expect(gposersSlotLabel('HeadGear')).toBe('Head');
  });
});

/**
 * The one dyeable-slot set: the GPOSERS lines above and the web Glamour
 * Reader's chips both read it, so a membership change here moves both.
 */
describe('CHARA_DYEABLE_SLOTS', () => {
  it('is exactly the seven equipment slots that take dyes, in the form order', () => {
    expect([...CHARA_DYEABLE_SLOTS]).toEqual([
      'MainHand',
      'OffHand',
      'HeadGear',
      'Body',
      'Hands',
      'Legs',
      'Feet',
    ]);
  });

  it('leaves out the five accessory slots, facewear and the fashion accessory', () => {
    const undyeable = GPOSERS_SLOTS.filter((slot) => !CHARA_DYEABLE_SLOTS.has(slot));
    expect(undyeable).toEqual([
      'Ears',
      'Neck',
      'Wrists',
      'RightRing',
      'LeftRing',
      'Facewear',
      'FashionAccessory',
    ]);
  });
});

/**
 * The slots the GPOSERS list leaves out: invisible pieces (a twin named
 * "The Emperor's New <X>") and an Off Hand under a main hand outside the list.
 */
describe('gposersOmittedSlots', () => {
  const emperor = (piece: string, ...others: string[]) => ({ familyEn: [...others, `The Emperor's New ${piece}`] });
  const omitted = (
    slots: Parameters<typeof gposersOmittedSlots>[0],
    context: Parameters<typeof gposersOmittedSlots>[1] = { gender: null }
  ) => [...gposersOmittedSlots(slots, context)];

  it.each<[string, GposersSlot, boolean]>([
    ['Hat', 'HeadGear', true],
    ['Breeches', 'Legs', true],
    ['Boots', 'Feet', true],
    ['Earrings', 'Ears', true],
    ['Necklace', 'Neck', true],
    ['Bracelet', 'Wrists', true],
    ['Ring', 'RightRing', true],
    ['Fists', 'MainHand', true],
    ['Shield', 'OffHand', true],
    ['Gloves', 'Hands', false],
  ])("The Emperor's New %s on %s is omitted: %s", (piece, slot, expected) => {
    expect(omitted({ [slot]: emperor(piece) }, { gender: 'Female', mainHandUiCategory: 2 })).toEqual(
      expected ? [slot] : []
    );
  });

  it("omits the Emperor's New Robe unless the character is known to be female", () => {
    const body = { Body: emperor('Robe') };
    expect(omitted(body, { gender: 'Male' })).toEqual([]);
    expect(omitted(body, { gender: null })).toEqual([]);
    expect(omitted(body, { gender: 'Female' })).toEqual(['Body']);
  });

  it('catches the Promise bracelets through the family they share with the invisible one', () => {
    expect(
      omitted({
        Wrists: { familyEn: ['Promise of Innocence', 'Promise of Passion', "The Emperor's New Bracelet"] },
      })
    ).toEqual(['Wrists']);
  });

  it('keeps a family with no Emperor’s New twin, and an unknown or empty one', () => {
    expect(
      omitted({
        HeadGear: { familyEn: ['Hempen Coif', 'Linen Coif'] },
        Body: { familyEn: [] },
        Legs: {},
      })
    ).toEqual([]);
  });

  it('omits invisible fists in both hands', () => {
    expect(
      omitted({ MainHand: emperor('Fists'), OffHand: emperor('Fists') }, { gender: null, mainHandUiCategory: null })
    ).toEqual(['MainHand', 'OffHand']);
  });

  it.each([2, 6, 8, 12, 32, 113])('keeps the Off Hand under main-hand category %i', (category) => {
    expect(omitted({ MainHand: {}, OffHand: {} }, { gender: null, mainHandUiCategory: category })).toEqual([]);
  });

  it.each([1, 4, 7, 9])('omits the Off Hand under main-hand category %i', (category) => {
    expect(omitted({ MainHand: {}, OffHand: {} }, { gender: null, mainHandUiCategory: category })).toEqual([
      'OffHand',
    ]);
  });

  it('keeps the Off Hand when the main hand’s category is unknown', () => {
    expect(omitted({ OffHand: {} }, { gender: null, mainHandUiCategory: null })).toEqual([]);
    expect(omitted({ OffHand: {} }, { gender: null })).toEqual([]);
  });

  it('omits nothing about an Off Hand that is not worn', () => {
    expect(omitted({ MainHand: {} }, { gender: null, mainHandUiCategory: 1 })).toEqual([]);
  });

  it('never omits facewear or the fashion accessory', () => {
    expect(
      omitted({ Facewear: emperor('Hat'), FashionAccessory: emperor('Hat') }, { gender: 'Female' })
    ).toEqual([]);
  });

  it('lists the fifteen off-hand main categories the guide allows', () => {
    expect([...CHARA_OFF_HAND_MAIN_CATEGORIES].sort((a, b) => a - b)).toEqual([
      2, 6, 8, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 113,
    ]);
  });
});
