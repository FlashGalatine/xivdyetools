/**
 * Glamour list as Markdown — the GPOSERS submission template.
 *
 * Glamour showcases ask for the outfit as a fixed form: a bold slot label, the
 * piece, its two dyes where the slot has channels, and an `Acquisition:` line
 * the submitter fills in by hand. The Swatch Manager already knows the pieces
 * and dyes from a `.chara` file, so it writes the form; the player adds the
 * acquisition notes and anything the file cannot carry.
 *
 * The labels are the template's own English wording, deliberately not
 * localised: this is a document format for a specific English-language
 * submission flow, the same way `palette-export`'s JSON keeps canonical names.
 * Item and dye NAMES are supplied by the caller in whatever language the app
 * is showing, so the list matches the screen.
 *
 * Every template slot is always written, in the template's order (Right Ring
 * before Left Ring, Facewear and Fashion Accessory last), with a blank value
 * where nothing is known — an empty line is a prompt to fill in, a missing
 * line is a slot the submitter has to remember. A `.chara` never carries a
 * fashion accessory, so that slot is always blank.
 *
 * Pure by design — no DOM, no services — so the format is unit-testable
 * without a browser.
 *
 * @module shared/glamour-markdown
 */

/** The fourteen slots of the template, in the order it lists them. */
export const GLAMOUR_MARKDOWN_SLOTS = [
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

export type GlamourMarkdownSlot = (typeof GLAMOUR_MARKDOWN_SLOTS)[number];

/** What is known about one slot. Anything absent or empty is written blank. */
export interface GlamourMarkdownPiece {
  /** The item's name as shown on screen. */
  name?: string | null;
  /** Channel 1 dye name (or `#id` for a stain the build does not know). */
  dye1?: string | null;
  /** Channel 2 dye name. */
  dye2?: string | null;
}

export type GlamourMarkdownInput = Partial<Record<GlamourMarkdownSlot, GlamourMarkdownPiece>>;

/** The download's name. Carries no character name by design. */
export const GLAMOUR_MARKDOWN_FILENAME = 'glamour-equipment.md';

/** The template's own slot wording — a document format, not UI copy. */
const SLOT_LABELS: Record<GlamourMarkdownSlot, string> = {
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
 * Slots whose items carry dye channels. Accessories and facewear have none
 * in the game, so they get no dye lines even if a file claims one.
 */
const DYEABLE: ReadonlySet<GlamourMarkdownSlot> = new Set<GlamourMarkdownSlot>([
  'MainHand',
  'OffHand',
  'HeadGear',
  'Body',
  'Hands',
  'Legs',
  'Feet',
]);

const HEADER = '**Glamour Items:**';

/** `Label:` plus the value when there is one — never a trailing space. */
function field(label: string, value: string | null | undefined): string {
  const text = value?.trim() ?? '';
  return text ? `${label} ${text}` : label;
}

/** Build the whole template. Unknown slots are written blank, never skipped. */
export function buildGlamourMarkdown(input: GlamourMarkdownInput): string {
  const lines: string[] = [HEADER];
  for (const slot of GLAMOUR_MARKDOWN_SLOTS) {
    const piece = input[slot];
    lines.push(field(`**${SLOT_LABELS[slot]}:**`, piece?.name));
    if (DYEABLE.has(slot)) {
      lines.push(field('Dye 1:', piece?.dye1));
      lines.push(field('Dye 2:', piece?.dye2));
    }
    lines.push('Acquisition:');
    lines.push('');
  }
  return lines.join('\n');
}
