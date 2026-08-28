/**
 * `.chara` equipment identity — the model keys a character file carries and
 * how they pack into the Item sheet's `ModelMain` / `ModelSub` values.
 *
 * Measured rules (docs/research/chara-equipment-resolution, 47-file corpus,
 * resolved live against XIVAPI v2 — 273/273 gear keys, 41/41 weapons):
 * - The Item sheet stores a model reference as one `uint64`, four
 *   little-endian 16-bit lanes (SaintCoinach `Quad`). The `.chara` fields are
 *   those lanes: armour/accessories `ModelMain = base | variant << 16`,
 *   weapons `ModelMain = set | base << 16 | variant << 32`.
 * - The slot is a mandatory second key: one gear *set* shares a `ModelMain`
 *   across head/body/hands/legs/feet, so a search must also filter on the
 *   `EquipSlotCategory` boolean column (rings: `FingerL` / `FingerR`).
 * - `ModelBase == 0` (weapons: `ModelSet == 0` too) means the slot is empty.
 * - Off-hands resolve THROUGH the main hand — see the resolver on api-worker.
 *
 * Nothing here touches the network; these are the pure packing helpers the
 * parser, the api-worker resolver and the web-app client all share.
 */

import type { CharaGearSlotId } from './chara-parser.js';

/** A worn piece's model identity, as the `.chara` file spells it. */
export interface CharaGearModel {
  slot: CharaGearSlotId;
  /** Weapon slots only — the `w0634` set number. Absent on armour/accessories. */
  set?: number;
  /** Armour: the `e0361` set. Weapons: the `b0019` body. */
  base: number;
  /** Material variant */
  variant: number;
}

/** The two slots whose model is a weapon triple rather than a gear pair. */
export const CHARA_WEAPON_SLOTS: readonly CharaGearSlotId[] = ['MainHand', 'OffHand'];

export function isCharaWeaponSlot(slot: CharaGearSlotId): boolean {
  return CHARA_WEAPON_SLOTS.includes(slot);
}

/**
 * `.chara` slot → `EquipSlotCategory` boolean column. This is the mandatory
 * second search key: `+EquipSlotCategory.<field>=1`.
 */
export const CHARA_SLOT_SEARCH_FIELD: Record<CharaGearSlotId, string> = {
  MainHand: 'MainHand',
  OffHand: 'OffHand',
  HeadGear: 'Head',
  Body: 'Body',
  Hands: 'Gloves',
  Legs: 'Legs',
  Feet: 'Feet',
  Ears: 'Ears',
  Neck: 'Neck',
  Wrists: 'Wrists',
  LeftRing: 'FingerL',
  RightRing: 'FingerR',
};

const LANE = 65536;

/**
 * Armour / accessory `ModelMain`: `base | variant << 16`. Computed with
 * arithmetic rather than `<<` so a variant above 0x7FFF cannot overflow the
 * signed 32-bit shift — the value is an unsigned 32-bit lane pair.
 *
 * Beech Mask of Casting: `gearModelKey(361, 5) === 328041` (Item#18085).
 */
export function gearModelKey(base: number, variant: number): number {
  return base + variant * LANE;
}

/**
 * Weapon `ModelMain`: `set | base << 16 | variant << 32`. Exceeds 2^32, so it
 * is a BigInt — serialise with `String()` for JSON / cache keys.
 *
 * Runaway Bow: `weaponModelKey(634, 19, 1) === 4296213114n` (Item#49486);
 * its quiver `{698, 149, 1}` is that item's `ModelSub`.
 */
export function weaponModelKey(set: number, base: number, variant: number): bigint {
  return BigInt(set) + (BigInt(base) << 16n) + (BigInt(variant) << 32n);
}

/**
 * The packed key as a decimal string — the form used on the wire and in
 * cache keys (weapon values do not fit a JS number exactly past 2^53 only in
 * theory, but a BigInt never round-trips JSON, so everything is a string).
 */
export function charaModelKey(model: CharaGearModel): string {
  return isCharaWeaponSlot(model.slot)
    ? String(weaponModelKey(model.set ?? 0, model.base, model.variant))
    : String(gearModelKey(model.base, model.variant));
}

/**
 * The human label for a model with no Item row: `set·base·variant` for a
 * weapon, `base·variant` otherwise (the design's "MODEL 9903·1").
 */
export function formatCharaModelLabel(model: CharaGearModel): string {
  return isCharaWeaponSlot(model.slot)
    ? `${model.set ?? 0}·${model.base}·${model.variant}`
    : `${model.base}·${model.variant}`;
}

/** True when the record describes a worn piece rather than an empty slot. */
export function isWornCharaModel(
  slot: CharaGearSlotId,
  set: number,
  base: number,
): boolean {
  return isCharaWeaponSlot(slot) ? set > 0 || base > 0 : base > 0;
}
