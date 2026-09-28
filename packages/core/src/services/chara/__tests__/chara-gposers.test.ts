/**
 * The GPOSERS form as data — shared by the web Glamour Reader and the
 * `/glamour` bot, so the two write the same lines.
 */
import { describe, it, expect } from 'vitest';
import { gposersGroups, gposersSameRings, gposersSlotLabel } from '../chara-gposers.js';

const flat = (input: Parameters<typeof gposersGroups>[0]) =>
  gposersGroups(input).map((g) => g.map((l) => (l.value ? `${l.label} ${l.value}` : l.label)));

describe('gposersGroups', () => {
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
