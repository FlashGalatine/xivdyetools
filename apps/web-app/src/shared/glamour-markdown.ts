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
 * line at all — the form lists what is there, not what is not.
 *
 * The form itself (slots, order, lines, rings, one-line values) is core's
 * `chara-gposers` model, which the `/glamour` bot renders too; this module
 * owns the three renderings. Pure by design — no DOM, no services — so the
 * formats are unit-testable without a browser.
 *
 * @module shared/glamour-markdown
 */

import {
  GPOSERS_ACQUISITION_LABEL,
  GPOSERS_HEADER,
  GPOSERS_SLOTS,
  gposersGroups,
  gposersSlotLabel,
  type GposersInput,
  type GposersLine,
  type GposersPiece,
  type GposersSlot,
} from '@xivdyetools/core';

/** The template's slots, in the order it lists them (core's GPOSERS model). */
export const GLAMOUR_MARKDOWN_SLOTS = GPOSERS_SLOTS;

export type GlamourMarkdownSlot = GposersSlot;

/**
 * What is known about one worn slot. An entry's presence means the slot is
 * worn; anything absent or empty inside it is written blank or omitted.
 */
export type GlamourMarkdownPiece = GposersPiece;

export type GlamourMarkdownInput = GposersInput;

/** The download's name. Carries no character name by design. */
export const GLAMOUR_MARKDOWN_FILENAME = 'glamour-equipment.md';

const HEADER = GPOSERS_HEADER;

/** The template's own field label — shown by the export sheet beside the editable line. */
export const ACQUISITION_LABEL = GPOSERS_ACQUISITION_LABEL;

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
