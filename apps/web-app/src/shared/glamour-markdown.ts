/**
 * Glamour list — the GPOSERS submission template, in three renderings.
 *
 * Glamour showcases ask for the outfit as a fixed form: a bold slot label, the
 * piece, its dyes where the slot has channels, and an `Acquisition:` line. The
 * Glamour Reader knows the pieces and dyes from a `.chara` file and the
 * acquisition line from api-worker's build-time table (or the player's edit
 * in the export sheet), so it writes the form; a piece with no known source
 * keeps the bare label for the player to fill in. Two identical rings are
 * written once, as `Rings:` (GPOSERS reminders, March 2026).
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
 * line at all — the form lists what is there, not what is not. The caller
 * leaves out, before it gets here, the worn slots a submission has no use for:
 * invisible pieces and an Off Hand the main hand does not take.
 *
 * Two forms, chosen by the renderers' `format` argument. `full` is the template
 * above. `abridged` is the shorter social-media post: no header, the whole
 * `Slot: Name` line in bold, one `Dyes:` line and an `Obtained:` line. It is a
 * reshape of the same groups, so slots, order, rings and one-line cleaning
 * cannot drift between the forms. It writes `piece.acquisition` as given; the
 * export sheet is what shortens a line (`glamour-abridged`), because a line
 * typed in Abridged stays word for word. `Dyes:`, `Obtained:` and `None` are
 * English form words too, for the reason above.
 *
 * The form itself (slots, order, lines, rings, one-line values) is core's
 * `chara-gposers` model, which the `/glamour` bot renders too; this module
 * owns the renderings. Pure by design — no DOM, no services — so the formats
 * are unit-testable without a browser.
 *
 * @module shared/glamour-markdown
 */

import {
  GPOSERS_ACQUISITION_LABEL,
  GPOSERS_HEADER,
  GPOSERS_SLOTS,
  gposersGroups,
  gposersSlotLabel,
  type GposersLine,
  type GposersPiece,
  type GposersSlot,
} from '@xivdyetools/core';

/** The template's slots, in the order it lists them (core's GPOSERS model). */
export const GLAMOUR_MARKDOWN_SLOTS = GPOSERS_SLOTS;

export type GlamourMarkdownSlot = GposersSlot;

/** Which form to write: the GPOSERS template, or the shorter social-media post. */
export type GlamourListFormat = 'full' | 'abridged';

/**
 * What is known about one worn slot. An entry's presence means the slot is
 * worn; anything absent or empty inside it is written blank or omitted.
 * `dyeSlots` is the piece's dye channel count (absent or null = unknown); only
 * Abridged reads it, to tell `A / None` from `A`.
 */
export type GlamourMarkdownPiece = GposersPiece & { dyeSlots?: number | null };

export type GlamourMarkdownInput = Partial<Record<GlamourMarkdownSlot, GlamourMarkdownPiece>>;

/** The download's name. Carries no character name by design. */
export const GLAMOUR_MARKDOWN_FILENAME = 'glamour-equipment.md';

/** The Abridged download's name. */
export const GLAMOUR_ABRIDGED_FILENAME = 'glamour-equipment-abridged.md';

const HEADER = GPOSERS_HEADER;

/** The template's own field label — shown by the export sheet beside the editable line. */
export const ACQUISITION_LABEL = GPOSERS_ACQUISITION_LABEL;

/** Abridged's field label, in the same place. */
export const OBTAINED_LABEL = 'Obtained:';

/** The template's label for one slot ("Main Hand", "Earrings"). */
export function glamourSlotLabel(slot: GlamourMarkdownSlot): string {
  return gposersSlotLabel(slot);
}

type Line = GposersLine;

/** Worn slots as line groups, in template order — core's model, shared with the bot. */
const groups = (input: GlamourMarkdownInput): Line[][] => gposersGroups(input);

/** `Label:` plus the value when there is one — never a trailing space. */
function lineText(line: Line, bold: (label: string) => string): string {
  const label = line.bold ? bold(line.label) : line.label;
  return line.value ? `${label} ${line.value}` : label;
}

/** `A / B`, `None / B`, `A / None` on a piece known to take two, else `A`; '' when undyed. */
function dyesValue(dye1: string, dye2: string, dyeSlots: number | null | undefined): string {
  if (dye2) return `${dye1 || 'None'} / ${dye2}`;
  if (!dye1) return '';
  return dyeSlots === 2 ? `${dye1} / None` : dye1;
}

/**
 * One slot's group, reshaped for Abridged: the first line bold as a whole (all
 * label, no value), the dye lines folded into one, `Acquisition:` as `Obtained:`.
 */
function abridgedGroup(input: GlamourMarkdownInput, [head, ...rest]: Line[]): Line[] {
  const valueOf = (label: string): string => rest.find((l) => l.label === label)?.value ?? '';
  const slot = GLAMOUR_MARKDOWN_SLOTS.find((s) => `${gposersSlotLabel(s)}:` === head.label);
  const dyes = dyesValue(
    valueOf('Dye 1:'),
    valueOf('Dye 2:'),
    slot ? input[slot]?.dyeSlots : undefined
  );
  return [
    { label: lineText(head, (label) => label), value: '', bold: true },
    ...(dyes ? [{ label: 'Dyes:', value: dyes, bold: false }] : []),
    { label: OBTAINED_LABEL, value: valueOf(ACQUISITION_LABEL), bold: false },
  ];
}

const groupsFor = (input: GlamourMarkdownInput, format: GlamourListFormat): Line[][] =>
  format === 'abridged' ? groups(input).map((group) => abridgedGroup(input, group)) : groups(input);

/** Markdown / plain text share one shape; only the bold marker differs. */
function renderLines(
  input: GlamourMarkdownInput,
  bold: (label: string) => string,
  format: GlamourListFormat
): string {
  const lines: string[] = format === 'abridged' ? [] : [bold(HEADER)];
  for (const group of groupsFor(input, format)) {
    for (const line of group) lines.push(lineText(line, bold));
    lines.push('');
  }
  return lines.join('\n');
}

/** The .md download: `**bold**` labels, a blank line between slots. */
export function buildGlamourMarkdown(
  input: GlamourMarkdownInput,
  format: GlamourListFormat = 'full'
): string {
  return renderLines(input, (label) => `**${label}**`, format);
}

/** The clipboard's plain flavour: the same lines with no Markdown syntax. */
export function buildGlamourPlainText(
  input: GlamourMarkdownInput,
  format: GlamourListFormat = 'full'
): string {
  return renderLines(input, (label) => label, format);
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
 * it shares its line block in the text renderings; Abridged has no header.
 */
export function buildGlamourHtml(
  input: GlamourMarkdownInput,
  format: GlamourListFormat = 'full'
): string {
  const strong = (label: string): string => `<strong>${escapeHtml(label)}</strong>`;
  const toHtml = (line: Line): string => {
    const label = line.bold ? strong(line.label) : escapeHtml(line.label);
    return line.value ? `${label} ${escapeHtml(line.value)}` : label;
  };
  const paragraphs = groupsFor(input, format).map((group) => group.map(toHtml));
  if (format === 'full') {
    if (paragraphs.length === 0) return `<p>${strong(HEADER)}</p>`;
    paragraphs[0].unshift(strong(HEADER));
  }
  return paragraphs.map((lines) => `<p>${lines.join('<br>')}</p>`).join('');
}
