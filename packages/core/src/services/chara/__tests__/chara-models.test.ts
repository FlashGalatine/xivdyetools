import { describe, it, expect } from 'vitest';
import {
  gearModelKey,
  weaponModelKey,
  charaModelKey,
  formatCharaModelLabel,
  isWornCharaModel,
  isCharaWeaponSlot,
  CHARA_SLOT_SEARCH_FIELD,
} from '../chara-models.js';

/**
 * The seven (slot, .chara triple) → Item.ModelMain pairs verified live
 * against XIVAPI v2 in docs/research/chara-equipment-resolution §4.3
 * (Galatine-Folklore.chara). These numbers are the contract.
 */
describe('chara model keys', () => {
  it('packs armour keys as base | variant << 16 (verified pairs)', () => {
    expect(gearModelKey(361, 5)).toBe(328041); // Beech Mask of Casting #18085
    expect(gearModelKey(872, 2)).toBe(131944); // Clouddark Chiton of Striking #44616
    expect(gearModelKey(757, 1)).toBe(66293); // Archfiend Gauntlets #36823
    expect(gearModelKey(804, 4)).toBe(262948); // Mountain Linen Longkilt of Healing #42040
    expect(gearModelKey(376, 1)).toBe(65912); // Gnath Legs #15461
    expect(gearModelKey(135, 2)).toBe(131207); // Ophiotauroskin Earrings of Gathering #35464
  });

  it('never overflows the signed 32-bit shift on a high variant', () => {
    // 0xFFFF << 16 would be negative under `|`; arithmetic keeps it unsigned.
    expect(gearModelKey(1, 0xffff)).toBe(1 + 0xffff * 65536);
    expect(gearModelKey(1, 0xffff)).toBeGreaterThan(0);
  });

  it('packs weapon keys as set | base << 16 | variant << 32 (BigInt)', () => {
    expect(weaponModelKey(634, 19, 1)).toBe(4296213114n); // Runaway Bow #49486
    expect(weaponModelKey(601, 95, 1)).toBe(4301193817n); // Riversbreath Longbow (research §4.3 note)
    expect(weaponModelKey(112, 1, 1)).toBe(4295032944n); // Asphodelos Shield (OffHand:4295032944)
  });

  it('serialises the wire key as a decimal string by slot kind', () => {
    expect(charaModelKey({ slot: 'HeadGear', base: 361, variant: 5 })).toBe('328041');
    expect(charaModelKey({ slot: 'MainHand', set: 634, base: 19, variant: 1 })).toBe(
      '4296213114',
    );
    // A weapon record with no set still packs as a weapon (set defaults to 0)
    expect(charaModelKey({ slot: 'OffHand', base: 1, variant: 1 })).toBe(
      String(weaponModelKey(0, 1, 1)),
    );
  });

  it('formats the no-item-row label as the raw lanes', () => {
    expect(formatCharaModelLabel({ slot: 'Body', base: 9903, variant: 1 })).toBe('9903·1');
    expect(formatCharaModelLabel({ slot: 'MainHand', set: 301, base: 31, variant: 1 })).toBe(
      '301·31·1',
    );
  });

  it('treats base 0 (and weapons: set 0 too) as an empty slot', () => {
    expect(isWornCharaModel('Body', 0, 0)).toBe(false);
    expect(isWornCharaModel('Body', 0, 279)).toBe(true); // Emperor's New Robe (invisible, but worn)
    expect(isWornCharaModel('MainHand', 0, 0)).toBe(false);
    expect(isWornCharaModel('MainHand', 634, 0)).toBe(true);
    expect(isWornCharaModel('OffHand', 0, 31)).toBe(true);
  });

  it('maps every slot to its EquipSlotCategory column (rings split L/R)', () => {
    expect(CHARA_SLOT_SEARCH_FIELD.Hands).toBe('Gloves');
    expect(CHARA_SLOT_SEARCH_FIELD.HeadGear).toBe('Head');
    expect(CHARA_SLOT_SEARCH_FIELD.LeftRing).toBe('FingerL');
    expect(CHARA_SLOT_SEARCH_FIELD.RightRing).toBe('FingerR');
    expect(Object.keys(CHARA_SLOT_SEARCH_FIELD)).toHaveLength(12);
    expect(isCharaWeaponSlot('MainHand')).toBe(true);
    expect(isCharaWeaponSlot('Feet')).toBe(false);
  });
});
