/**
 * The GPOSERS submission form as data: which slots, in which order, with which
 * lines. The web Glamour Reader renders it as Markdown / plain text / HTML and
 * the `/glamour` bot as a Discord embed; one model means the two cannot drift.
 *
 * The form asks for the outfit as a bold slot label, the piece, its dyes where
 * the slot has channels, and an `Acquisition:` line. Only WORN slots are
 * written, in the form's order (Right Ring before Left Ring, Facewear last). A
 * worn piece with no known name or source keeps its label, bare, as a prompt
 * to fill in; a dye channel left empty gets no line. Two identical rings are
 * written once, as `Rings:` (GPOSERS reminders, March 2026). Values are always
 * one line.
 *
 * {@link gposersGroups} writes every slot it is given. Callers first drop the
 * worn slots {@link gposersOmittedSlots} names, which the guide wants erased
 * (invisible pieces, and an Off Hand the main hand cannot carry).
 *
 * The labels are the form's own English wording, deliberately not localised:
 * this is a document format for an English-language submission flow. Item and
 * dye NAMES are the caller's, in whatever language it shows.
 *
 * @module services/chara/chara-gposers
 */

import type { Gender } from '@xivdyetools/types';

/** The form's slots, in the order it lists them. */
export const GPOSERS_SLOTS = [
  'MainHand',
  'OffHand',
  'HeadGear',
  'Body',
  'Hands',
  'Legs',
  'Feet',
  'Ears',
  'Neck',
  'Wrists',
  'RightRing',
  'LeftRing',
  'Facewear',
  'FashionAccessory',
] as const;

export type GposersSlot = (typeof GPOSERS_SLOTS)[number];

/** What is known about one worn slot; the entry's presence means it is worn. */
export interface GposersPiece {
  name?: string | null;
  /** Channel 1 dye name (or `#id` for a stain the build does not know) */
  dye1?: string | null;
  dye2?: string | null;
  /** The `Acquisition:` value; absent or empty = the bare label */
  acquisition?: string | null;
}

export type GposersInput = Partial<Record<GposersSlot, GposersPiece>>;

/** One line of the form: a label, bold for a slot's first line, and a value. */
export interface GposersLine {
  label: string;
  value: string;
  bold: boolean;
}

/** The form's heading. */
export const GPOSERS_HEADER = 'Glamour Items:';

/** The form's source field label. */
export const GPOSERS_ACQUISITION_LABEL = 'Acquisition:';

const SLOT_LABELS: Record<GposersSlot, string> = {
  MainHand: 'Main Hand',
  OffHand: 'Off Hand',
  HeadGear: 'Head',
  Body: 'Body',
  Hands: 'Hands',
  Legs: 'Legs',
  Feet: 'Feet',
  Ears: 'Earrings',
  Neck: 'Necklace',
  Wrists: 'Bracelets',
  RightRing: 'Right Ring',
  LeftRing: 'Left Ring',
  Facewear: 'Facewear',
  FashionAccessory: 'Fashion Accessory',
};

/**
 * The dyeable slots: the seven equipment slots (both weapons and the five armour
 * slots) whose items carry the two dye channels, `DyeId` and `DyeId2`. The five
 * accessory slots are absent because no FFXIV earring, necklace, bracelet or
 * ring takes a dye; facewear and the fashion accessory have no channels either.
 *
 * The one copy of this game fact: the GPOSERS form writes `Dye 1:` / `Dye 2:`
 * lines only for these slots, and the web Glamour Reader draws its two
 * positional channel chips only for these slots.
 *
 * Typed over {@link GposersSlot}, the wider of the two slot unions (the parser's
 * twelve `CharaGearSlotId` gear slots plus facewear and the fashion accessory),
 * so either kind of slot id can be passed to `has()` without a cast.
 */
export const CHARA_DYEABLE_SLOTS: ReadonlySet<GposersSlot> = new Set<GposersSlot>([
  'MainHand',
  'OffHand',
  'HeadGear',
  'Body',
  'Hands',
  'Legs',
  'Feet',
]);

/** The form's label for one slot ("Main Hand", "Earrings"). */
export function gposersSlotLabel(slot: GposersSlot): string {
  return SLOT_LABELS[slot];
}

/** One line: a value never breaks, whatever a field held (a pasted note). */
function text(value: string | null | undefined): string {
  return value?.replace(/\s+/g, (run) => (/[\r\n]/.test(run) ? ' ' : run)).trim() ?? '';
}

/** Both rings worn with one name — a ring whose name never arrived is not known to match. */
export function gposersSameRings(input: GposersInput): boolean {
  const right = text(input.RightRing?.name);
  return right !== '' && right === text(input.LeftRing?.name);
}

/** Worn slots as line groups, in the form's order: the bold slot line first. */
export function gposersGroups(input: GposersInput): GposersLine[][] {
  const out: GposersLine[][] = [];
  const rings = gposersSameRings(input);
  for (const slot of GPOSERS_SLOTS) {
    const piece = input[slot];
    if (!piece) continue;
    if (rings && slot === 'LeftRing') continue;
    const label = rings && slot === 'RightRing' ? 'Rings' : SLOT_LABELS[slot];
    const group: GposersLine[] = [{ label: `${label}:`, value: text(piece.name), bold: true }];
    if (CHARA_DYEABLE_SLOTS.has(slot)) {
      const dye1 = text(piece.dye1);
      const dye2 = text(piece.dye2);
      if (dye1) group.push({ label: 'Dye 1:', value: dye1, bold: false });
      if (dye2) group.push({ label: 'Dye 2:', value: dye2, bold: false });
    }
    group.push({ label: GPOSERS_ACQUISITION_LABEL, value: text(piece.acquisition), bold: false });
    out.push(group);
  }
  return out;
}

/**
 * ItemUICategory rows whose main hand can carry a real Off Hand line: 2 Gladiator's
 * Arm (Paladin), 6 One-handed Thaumaturge's Arm, 8 One-handed Conjurer's Arm, the
 * eleven Primary Tools 12-32 (CRP BSM ARM GSM LTW WVR ALC CUL MIN BTN FSH, every
 * second id) and 113 Beastmaster's Arm. Any other main hand either is the whole
 * weapon (fist pairs, quivers, foci) or has no off hand. Ids checked against XIVAPI
 * game version 541c0c12e07da325 on 2026-10-11.
 */
export const CHARA_OFF_HAND_MAIN_CATEGORIES: ReadonlySet<number> = new Set([
  2, 6, 8, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 113,
]);

/** What is known about one worn slot, for {@link gposersOmittedSlots}. */
export interface GposersSlotFacts {
  /** English names of every twin the answer names for this slot (named item + alternates); absent or empty = unknown */
  familyEn?: readonly string[];
}

/** What the omission rules need beyond the slots themselves. */
export interface GposersOmitContext {
  /** The file's gender; null = unknown */
  gender: Gender | null;
  /** ItemUICategory row of the main hand's named item; null or absent = unknown */
  mainHandUiCategory?: number | null;
}

const INVISIBLE_PIECE = /^The Emperor's New (.+)$/;

/**
 * The worn slots the GPOSERS list leaves out (the guide: unused/invisible slots
 * are erased, except The Emperor's New Robe on males and The Emperor's New
 * Gloves). Keys of `slots` are the worn slots.
 *
 * 1. Invisible: the slot's model family holds a twin named "The Emperor's New
 *    <X>". The family, not the named item, is checked because the Promise
 *    bracelets and the Heroic Spirit / Divine Beast Shields share the invisible
 *    piece's model. Gloves are always kept; the Robe is kept unless the character
 *    is known to be female.
 * 2. Off Hand: omitted when the main hand's category is known and is not in
 *    {@link CHARA_OFF_HAND_MAIN_CATEGORIES}.
 *
 * Anything unknown (no family, no category) keeps the slot: nothing is dropped
 * on a guess. Facewear and the fashion accessory are never omitted.
 */
export function gposersOmittedSlots(
  slots: Partial<Record<GposersSlot, GposersSlotFacts>>,
  context: GposersOmitContext,
): Set<GposersSlot> {
  const out = new Set<GposersSlot>();
  for (const slot of GPOSERS_SLOTS) {
    const facts = slots[slot];
    if (!facts || slot === 'Facewear' || slot === 'FashionAccessory') continue;
    const piece = facts.familyEn
      ?.map((name) => INVISIBLE_PIECE.exec(name)?.[1])
      .find((p) => p !== undefined);
    if (piece === undefined || piece === 'Gloves') continue;
    if (piece === 'Robe' && context.gender !== 'Female') continue;
    out.add(slot);
  }
  const category = context.mainHandUiCategory;
  if (
    'OffHand' in slots &&
    typeof category === 'number' &&
    !CHARA_OFF_HAND_MAIN_CATEGORIES.has(category)
  ) {
    out.add('OffHand');
  }
  return out;
}
