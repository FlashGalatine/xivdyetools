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
 * The labels are the form's own English wording, deliberately not localised:
 * this is a document format for an English-language submission flow. Item and
 * dye NAMES are the caller's, in whatever language it shows.
 *
 * @module services/chara/chara-gposers
 */

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

/** Slots whose items carry dye channels; accessories and facewear have none. */
const DYEABLE: ReadonlySet<GposersSlot> = new Set<GposersSlot>([
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
  return value?.replace(/\s*[\r\n]+\s*/g, ' ').trim() ?? '';
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
    if (DYEABLE.has(slot)) {
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
