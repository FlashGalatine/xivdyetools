/**
 * Glamour list — the GPOSERS submission template, in three renderings.
 *
 * Glamour showcases ask for the outfit as a fixed form: a bold slot label, the
 * piece, its dyes where the slot has channels, and an `Acquisition:` line the
 * submitter fills in by hand. The Swatch Manager already knows the pieces and
 * dyes from a `.chara` file, so it writes the form; the player adds the
 * acquisition notes and anything the file cannot carry.
 *
 * One model, three renderings: **Markdown** for the .md download, **HTML**
 * for the clipboard so the bold survives a paste into Word or Google Docs,
 * and **plain text** as the clipboard's fallback flavour — the same lines
 * without the asterisks, because a plain paste should never show Markdown
 * syntax.
 *
 * The labels are the template's own English wording, deliberately not
 * localised: this is a document format for a specific English-language
 * submission flow, the same way `palette-export`'s JSON keeps canonical names.
 * Item and dye NAMES are supplied by the caller in whatever language the app
 * is showing, so the list matches the screen. (Decision recorded here on
 * purpose: `eslint-rules/no-hardcoded-ui-strings` inspects DOM assignments
 * and templates, so it cannot see these strings either way — a clean lint is
 * not evidence the exception was reviewed; this paragraph is.)
 *
 * Only WORN slots are written, in the template's order (Right Ring before
 * Left Ring, Facewear last); a `.chara` never carries a fashion accessory, so
 * that slot never appears. A worn piece with no known name keeps its label,
 * bare, as a prompt to fill in. A dye channel the player left empty gets no
 * line at all — the form lists what is there, not what is not.
 *
 * Pure by design — no DOM, no services — so the formats are unit-testable
 * without a browser.
 *
 * @module shared/glamour-markdown
 */

/** The template's slots, in the order it lists them. */
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

/**
 * What is known about one worn slot. An entry's presence means the slot is
 * worn; anything absent or empty inside it is written blank or omitted.
 */
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
 *
 * Deliberately a second copy of `DYEABLE_SLOTS` in `components/chara-import`:
 * this module stays free of component imports (and is loaded on demand, so
 * the component must not import runtime values from it either). Change both.
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

const HEADER = 'Glamour Items:';

/** One rendered line: a label, optionally bold, with an optional value. */
interface Line {
  label: string;
  value: string;
  bold: boolean;
}

/** A slot's lines — the bold label line first, then its fields. */
type Group = Line[];

function text(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/** Worn slots as line groups, in template order. */
function groups(input: GlamourMarkdownInput): Group[] {
  const out: Group[] = [];
  for (const slot of GLAMOUR_MARKDOWN_SLOTS) {
    const piece = input[slot];
    if (!piece) continue;
    const group: Group = [{ label: `${SLOT_LABELS[slot]}:`, value: text(piece.name), bold: true }];
    if (DYEABLE.has(slot)) {
      const dye1 = text(piece.dye1);
      const dye2 = text(piece.dye2);
      if (dye1) group.push({ label: 'Dye 1:', value: dye1, bold: false });
      if (dye2) group.push({ label: 'Dye 2:', value: dye2, bold: false });
    }
    group.push({ label: 'Acquisition:', value: '', bold: false });
    out.push(group);
  }
  return out;
}

/** `Label:` plus the value when there is one — never a trailing space. */
function lineText(line: Line, bold: (label: string) => string): string {
  const label = line.bold ? bold(line.label) : line.label;
  return line.value ? `${label} ${line.value}` : label;
}

/** Markdown / plain text share one shape; only the bold marker differs. */
function renderLines(input: GlamourMarkdownInput, bold: (label: string) => string): string {
  const lines: string[] = [bold(HEADER)];
  for (const group of groups(input)) {
    for (const line of group) lines.push(lineText(line, bold));
    lines.push('');
  }
  return lines.join('\n');
}

/** The .md download: `**bold**` labels, a blank line between slots. */
export function buildGlamourMarkdown(input: GlamourMarkdownInput): string {
  return renderLines(input, (label) => `**${label}**`);
}

/** The clipboard's plain flavour: the same lines with no Markdown syntax. */
export function buildGlamourPlainText(input: GlamourMarkdownInput): string {
  return renderLines(input, (label) => label);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * The clipboard's rich flavour: `<strong>` labels, one paragraph per slot
 * with `<br>` line breaks, so Word and Google Docs keep the bold and the
 * spacing between slots. The header shares the first slot's paragraph, as
 * it shares its line block in the text renderings.
 */
export function buildGlamourHtml(input: GlamourMarkdownInput): string {
  const strong = (label: string): string => `<strong>${escapeHtml(label)}</strong>`;
  const toHtml = (line: Line): string => {
    const label = line.bold ? strong(line.label) : escapeHtml(line.label);
    return line.value ? `${label} ${escapeHtml(line.value)}` : label;
  };
  const paragraphs = groups(input).map((group) => group.map(toHtml));
  if (paragraphs.length === 0) return `<p>${strong(HEADER)}</p>`;
  paragraphs[0].unshift(strong(HEADER));
  return paragraphs.map((lines) => `<p>${lines.join('<br>')}</p>`).join('');
}
