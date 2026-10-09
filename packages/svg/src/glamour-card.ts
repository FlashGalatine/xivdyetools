/**
 * /glamour — the Glamour Reader card (Glamour Reader Directions, turn 1,
 * 2a "Pieces, slot order"; confirmed 2026-09-27).
 *
 * The web tool's Pieces lens on the 400 × 350 budget: a slot lead over the
 * look count, the item's icon tile, the name, the dyes it wears, and the
 * in-game verdict in the right column. TWIN means a same-look item was named
 * because the file's own pick can't be worn that way. The picture shows the
 * look; the embed carries the list, so the five-row cap loses nothing.
 *
 * Not a measuredRow consumer: a piece has no measurement and no tier, so it
 * is a second row kind rather than a stretched measuredRow (the rule is that
 * a consumer that can't fill all five slots means the abstraction needs
 * revisiting). No character name anywhere — the header says whose file it is
 * by producer and tribe only.
 *
 * The icon tile is the design's hatched placeholder: the bot reaches
 * api-worker through a service binding whose requests all share one rate-limit
 * key, so a card does not spend up to twelve icon requests on it.
 *
 * @module glamour-card
 */

import {
  CARD_WIDTH,
  CARD_MAX_HEIGHT,
  CARD_TYPE,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  fitText,
  hairline,
  markFooter,
  textWidth,
  type CardTheme,
} from './frame.js';
import { escapeXml } from './base.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

/**
 * How the row reads. `fix`: a twin was named to fix the file's pick (green).
 * `block`: nothing with the same look fixes it (amber). `choice`: other twins
 * exist and nothing is wrong (grey). `unique`: one item has this look.
 */
export type GlamourCardTone = 'fix' | 'block' | 'choice' | 'unique';

export interface GlamourCardRow {
  /** The slot's name in the game's own words, localized (MAIN HAND / HEAD / 頭 …) */
  slotLabel: string;
  /** "+2 LOOKS" when the model has twins, "ONE LOOK" when it has none (localized) */
  lookLabel: string;
  /** Other items with the same look; 0 = one look, drawn quiet whatever the verdict */
  twins: number;
  tone: GlamourCardTone;
  /** The twin the list names, localized */
  name: string;
  /** The dyes the piece wears, channel order */
  dyes: ReadonlyArray<{ hex: string; name: string }>;
  /** Right column: TWIN / OK / what blocks it (VIERA, DYES …), localized */
  status: string;
}

export interface GlamourCardOptions {
  /** The glamour's dyes, slot order, once each — the header strip */
  stripHexes: string[];
  /** Producer · tribe + gender symbol — NEVER the character's name */
  charSub: string;
  /** "5 dyed pieces" (localized) */
  title: string;
  /** "6 dyes" — follows the title after a middle dot when both fit, and yields first when not */
  titleExtra?: string;
  /** Ordered and capped by the caller */
  rows: GlamourCardRow[];
  /** "5 of 7 dyed pieces · 3 named from a twin · 1 with no fix" (localized) */
  footKey: string;
  lang: string;
  theme?: 'dark' | 'light';
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 15;
const ROW_H = 48;
/**
 * The slot column: the design's 56 px, wider for the game's own slot names —
 * the game has no short forms, and the longest ("MAIN NON DIRECTRICE", the
 * French off hand) needs 130 px. Only a card that shows such a slot gives up
 * name width for it.
 */
const LEAD_MIN = 60;
const LEAD_MAX = 132;
/** The slot name's letter-spacing, dropped for a name that only fits without it. */
const SLOT_TRACKING = 0.8;
const slotWidth = (label: string): number => textWidth(label, CARD_TYPE.label, 'mono');
const ICON = 32;
const GAP = 10;
/** The verdict column: 44 px as drawn, wider for a longer localized verdict, never past 72. */
const STATUS_MIN = 44;
const STATUS_MAX = 72;
const CHIP = 10;
const CHIP_GAP = 6;

/**
 * The footer's line pitch: the budget ledger's 15 px, so a line run under the
 * mark clears its 18 px icon.
 */
const FOOT_LINE_H = 15;
/** The key's first baseline below the last row's hairline (the mark's too). */
const FOOT_FIRST = 20;
/** Room kept under the last footer baseline, as every single-line footer keeps. */
const FOOT_BOTTOM = 13;
/** How bot-logic joins the key's clauses: "5 of 7 dyed pieces · 3 named from a twin". */
const CLAUSE = ' · ';

/**
 * A clause's words, for the rare clause that has to break — one too long for
 * a line of its own, or one too wide for the mark's line on a card with no
 * height left for the line under it (see wrapFoot). Each count is glued to
 * the word beside it (the next one, or the one before when the count ends the
 * clause — ja "解決不可 2"), and the clause's closing "·" to the word it
 * follows, so no break lands between them.
 */
function wordUnits(clause: string): string[] {
  const words = clause.split(' ');
  const units: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const last = units.length - 1;
    const nextWord = words[i + 1];
    if (/\d/.test(w) && nextWord !== undefined && nextWord !== '·') {
      units.push(`${w} ${nextWord}`);
      i++;
    } else if ((w === '·' || /\d/.test(w)) && last >= 0) {
      units[last] += ` ${w}`;
    } else {
      units.push(w);
    }
  }
  return units;
}

/**
 * Wrap the count key at its " · " clauses, so a count never leaves its noun
 * (I18N-015: wrapping at any space split "· 3" from "durch Zwilling benannt").
 * The first line shares its row with the mark; the lines under it run the
 * full width. Only a clause too long for a line of its own is broken — between
 * words, a count kept with its word, and by code point as the last seam a
 * spaceless run offers.
 *
 * The mark's line is the narrow one, so a first clause (or, in a clause too
 * long for any line, a first word) that only a full-width line holds starts
 * whole on the line under the mark, leaving the mark its line alone (`''`).
 * That costs a line: when the frame has none to spare, the clause is broken
 * between words beside the mark instead, so the key keeps its tail. A key
 * longer than `maxLines` (all the height the frame has left) is cut at the
 * last line it can hold, never pushed past 350. There is always at least one
 * line, the mark's, even for an empty key: the card's height is measured from it.
 */
function wrapFoot(key: string, firstMax: number, restMax: number, maxLines: number): string[] {
  const maxFor = (index: number): number => (index === 0 ? firstMax : restMax);
  const fits = (s: string, index: number): boolean => textWidth(s, CARD_TYPE.label, 'mono') <= maxFor(index);

  /** Lay the key out; `clearMark` lets a unit only a full-width line holds start under the mark. */
  const layout = (clearMark: boolean): string[] => {
    const lines: string[] = [];
    let line = '';

    /** depth 0: a clause · 1: a word unit · 2: a code point (placed whatever its width). */
    const place = (unit: string, depth: 0 | 1 | 2): void => {
      const joined = line ? `${line}${depth === 2 ? '' : ' '}${unit}` : unit;
      if (fits(joined, lines.length)) {
        line = joined;
        return;
      }
      if (line) {
        lines.push(line);
      } else if (clearMark && depth < 2 && lines.length === 0 && fits(unit, 1)) {
        lines.push('');
      }
      line = '';
      if (depth === 2 || fits(unit, lines.length)) {
        line = unit;
      } else if (depth === 0) {
        for (const word of wordUnits(unit)) place(word, 1);
      } else {
        for (const char of unit) place(char, 2);
      }
    };

    // A clause that a break may follow carries the separator at its line's end
    const clauses = key.split(CLAUSE);
    clauses.forEach((clause, i) => place(i < clauses.length - 1 ? `${clause} ·` : clause, 0));
    if (line || lines.length === 0) lines.push(line);
    return lines;
  };

  let lines = layout(true);
  if (lines.length > maxLines && lines[0] === '') lines = layout(false);
  if (lines.length <= maxLines) return lines;
  const lastIndex = Math.max(maxLines, 1) - 1;
  const rest = lines.slice(lastIndex).join(' ');
  return [...lines.slice(0, lastIndex), fitText(rest, maxFor(lastIndex), CARD_TYPE.label, 'mono')];
}

/** The look count's ink: it answers "was a twin picked, and why?" */
function lookInk(tone: GlamourCardTone, twins: number, theme: CardTheme): string {
  if (twins === 0) return theme.label;
  if (tone === 'fix') return theme.tiers[0];
  if (tone === 'block') return theme.tiers[2];
  if (tone === 'choice') return theme.subValue;
  return theme.label;
}

/** The verdict's ink: green fixed, amber blocked, quiet otherwise. */
function statusInk(tone: GlamourCardTone, theme: CardTheme): string {
  if (tone === 'fix') return theme.tiers[0];
  if (tone === 'block') return theme.tiers[2];
  return theme.label;
}

/** The hatched icon tile — a 45° stripe pattern, as the design draws it. */
function hatchPattern(theme: CardTheme): string {
  const base = theme.mode === 'dark' ? '#222226' : '#EBEBEE';
  const stripe = theme.mode === 'dark' ? '#2A2A2F' : '#E1E1E5';
  return (
    `<pattern id="glhatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="8" height="8" fill="${escapeXml(base)}"/><rect width="4" height="8" fill="${escapeXml(stripe)}"/>` +
    `</pattern>`
  );
}

/** Generate the /glamour pieces card. */
export function generateGlamourCard(options: GlamourCardOptions): string {
  const theme: CardTheme = cardTheme(options.theme);
  const rightX = CARD_WIDTH - PAD;
  const parts: string[] = [hatchPattern(theme)];

  // Header: the glamour's dyes · producer + tribe over the title · /GLAMOUR chip
  const stripW = 66;
  const stripes = options.stripHexes.length > 0 ? options.stripHexes : ['#000000'];
  const stripeW = stripW / stripes.length;
  parts.push(`<clipPath id="glstrip"><rect x="${PAD}" y="13" width="${stripW}" height="30" rx="7"/></clipPath>`);
  parts.push(`<g clip-path="url(#glstrip)">`);
  stripes.forEach((hex, i) => {
    parts.push(
      `<rect x="${(PAD + i * stripeW).toFixed(2)}" y="13" width="${(stripeW + 0.5).toFixed(2)}" height="30" fill="${escapeXml(hex)}"/>`
    );
  });
  parts.push(`</g>`);
  parts.push(
    `<rect x="${PAD + 0.5}" y="13.5" width="${stripW - 1}" height="29" rx="6.5" fill="none" stroke="${escapeXml(theme.swatchRing)}" stroke-width="1"/>`
  );

  const glyph = toolGlyph('glamour', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const chip = commandChip(0, 0, '/GLAMOUR', theme, { glyph });
  const chipX = rightX - chip.width;
  parts.push(`<g transform="translate(${chipX},18)">${chip.svg}</g>`);

  const textX = PAD + stripW + 10;
  const textMax = chipX - textX - 10;
  parts.push(
    cardText(textX, 23, fitText(options.charSub, textMax, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
    })
  );
  const fullTitle = options.titleExtra ? `${options.title} · ${options.titleExtra}` : options.title;
  const title = textWidth(fullTitle, 14, 'body') <= textMax ? fullTitle : options.title;
  parts.push(
    cardText(textX, 41, fitText(title, textMax, 14, 'body'), {
      fill: theme.name,
      size: 14,
      font: 'body',
      weight: 600,
    })
  );

  // Rows — slot order, capped upstream
  // A slot name is set tracked (0.8 px) when it fits that way, untracked when
  // only that fits: the game's word is never cut while any setting holds it.
  const tracked = (label: string): number => slotWidth(label) + [...label].length * SLOT_TRACKING;
  const leadW = Math.min(
    LEAD_MAX,
    Math.max(
      LEAD_MIN,
      ...options.rows.map((r) => {
        const slot = tracked(r.slotLabel) <= LEAD_MAX ? tracked(r.slotLabel) : slotWidth(r.slotLabel);
        return Math.ceil(Math.max(slot, textWidth(r.lookLabel, CARD_TYPE.label, 'mono')));
      })
    )
  );
  const iconX = PAD + leadW + GAP;
  const nameX = iconX + ICON + GAP;
  const statusW = Math.min(
    STATUS_MAX,
    Math.max(STATUS_MIN, ...options.rows.map((r) => Math.ceil(textWidth(r.status, CARD_TYPE.label, 'mono'))))
  );
  const statusLeft = rightX - statusW;
  const nameMax = statusLeft - GAP - nameX;
  let y = 56;
  for (const r of options.rows) {
    parts.push(hairline(PAD, rightX, y, theme));

    // Lead: slot short over the look count
    parts.push(
      cardText(PAD, y + 20, fitText(r.slotLabel, leadW, CARD_TYPE.label, 'mono'), {
        fill: theme.value,
        size: CARD_TYPE.label,
        font: 'mono',
        ...(tracked(r.slotLabel) <= leadW ? { letterSpacing: SLOT_TRACKING } : {}),
      })
    );
    parts.push(
      cardText(PAD, y + 34, fitText(r.lookLabel, leadW, CARD_TYPE.label, 'mono'), {
        fill: lookInk(r.tone, r.twins, theme),
        size: CARD_TYPE.label,
        font: 'mono',
      })
    );

    // The item's icon tile
    parts.push(
      `<rect x="${iconX}" y="${y + 8}" width="${ICON}" height="${ICON}" rx="6" fill="url(#glhatch)" stroke="${escapeXml(theme.swatchRing)}" stroke-width="1"/>`
    );

    // Name over the dyes it wears
    parts.push(
      cardText(nameX, y + 21, fitText(r.name, nameMax, 13, 'body'), {
        fill: theme.name,
        size: 13,
        font: 'body',
        weight: 600,
      })
    );
    let subX = nameX;
    for (const dye of r.dyes) {
      parts.push(
        `<rect x="${subX}" y="${y + 28}" width="${CHIP}" height="${CHIP}" rx="2" fill="${escapeXml(dye.hex)}" stroke="${escapeXml(theme.swatchRing)}" stroke-width="1"/>`
      );
      subX += CHIP + CHIP_GAP;
    }
    const dyeNames = r.dyes.map((d) => d.name).join(' · ');
    if (dyeNames) {
      parts.push(
        cardText(subX, y + 37, fitText(dyeNames, statusLeft - GAP - subX, CARD_TYPE.label, 'mono'), {
          fill: theme.label,
          size: CARD_TYPE.label,
          font: 'mono',
        })
      );
    }

    // The in-game verdict
    parts.push(
      cardText(rightX, y + 28, fitText(r.status, statusW, CARD_TYPE.label, 'mono'), {
        fill: statusInk(r.tone, theme),
        size: CARD_TYPE.label,
        font: 'mono',
        letterSpacing: 0.6,
        anchor: 'end',
      })
    );
    y += ROW_H;
  }
  parts.push(hairline(PAD, rightX, y, theme));

  // Footer: the count key, wrapped at its clauses. Its first line shares the
  // row with the mark and any line below runs the full width under it, as the
  // budget ledger's method note does — five rows leave height for two lines.
  const markW = 18 + 7 + textWidth('xivdyetools.app', CARD_TYPE.label, 'mono');
  const footTop = y + FOOT_FIRST;
  const maxLines = 1 + Math.floor((CARD_MAX_HEIGHT - FOOT_BOTTOM - footTop) / FOOT_LINE_H);
  const footLines = wrapFoot(options.footKey, CARD_WIDTH - PAD * 2 - markW - 10, CARD_WIDTH - PAD * 2, maxLines);
  footLines.forEach((line, i) => {
    // An empty line is the mark's alone: it keeps its height, and draws nothing
    if (!line) return;
    parts.push(
      cardText(PAD, footTop + FOOT_LINE_H * i, line, {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
      })
    );
  });
  parts.push(markFooter(rightX, footTop, theme));
  const height = Math.round(footTop + FOOT_LINE_H * (footLines.length - 1) + FOOT_BOTTOM);

  return cardShell(height, theme, parts.join(''));
}
