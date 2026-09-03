/**
 * /gradient — the confirmed 12H·2 "Strip over distinct dyes" (Turn 12).
 *
 * Six steps in the header, five rows under it, and no contradiction between
 * them — the rows are the DISTINCT dyes, not the steps. The strip carries
 * every step in order (a 7 px ideal cap over the dye block per step), so
 * the ramp survives as a ramp; the list stays a list. 12H·3 is the
 * twelve-step case (same frame, the cap runs its stages); 12H·4 is the
 * stage-0 collapsed ramp, a shorter card carrying a verdict sentence —
 * numbers that mislead are exactly where this suite spends one.
 *
 * @module gradient
 */

import {
  CARD_WIDTH,
  CARD_TYPE,
  ROW_CAP,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  fitText,
  markFooter,
  measuredRow,
  textWidth,
  type CardTheme,
  type MeasuredRowWidths,
} from './frame.js';
import { escapeXml } from './base.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

/** One step in the strip: the ideal cap over the nearest dye's block. */
export interface GradientStripCell {
  idealHex: string;
  dyeHex: string;
}

/** One list row: a distinct dye (adjacent same-dye steps merged). */
export interface GradientRowEntry {
  /** Step index or merged range, e.g. "2" or "2–3" */
  stepText: string;
  /** The ideal colour of the (worst) covered step */
  idealHex: string;
  dyeHex: string;
  /** Localized dye name */
  name: string;
  /** Worst ΔE2000 of the steps this row covers */
  deltaE: number;
}

export interface GradientCardOptions {
  /** Header readout, e.g. "HSV · 6" (space + step count) */
  headerText: string;
  /** Every step, in order */
  strip: GradientStripCell[];
  /** The distinct-dye rows (≤5 after the cap stages) */
  rows: GradientRowEntry[];
  /**
   * Stage-0 verdict sentence (12H·4) — present when ≥4 steps resolved to
   * ≤2 rows. The card gets shorter, never padded out.
   */
  verdict?: string | null;
  /** Footer legend (gradKey / gradKeyCut, already interpolated) */
  legend: string;
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 16;
const ROW_H = 41.5;

/** Body size of the 12H·4 verdict sentence — wrapped and drawn at the same value. */
const VERDICT_SIZE = 12.5;

/**
 * Room the footer mark takes out of the content width, so the legend wraps
 * beside it rather than under it: an 18 px app icon, a 7 px gap and the
 * `xivdyetools.app` domain (≈102 px of 11 px mono), leaving a few px of air.
 * `frame-budget.test.ts` asserts the legend never crosses the mark's left edge.
 */
const MARK_RESERVE = 130;

/**
 * 12H slot widths from its own source (lead 28 holds a "2–3" range).
 *
 * pkg-svg-bot-logic-06: `lead + pair + name + bar + measure + 4 × 10 px gap`
 * has to equal the content width (`CARD_WIDTH − 2 × PAD` = 368) or the
 * right-anchored measure lands outside the margin every other element on the
 * card aligns to. This summed to 376, putting the ΔE column 8 px proud, so
 * `name` gives up those 8 px.
 */
const ROW_WIDTHS: MeasuredRowWidths = { lead: 28, pair: 56, name: 178, bar: 34, measure: 32 };

/**
 * Generate the /gradient card (12H·2/·3/·4). Height grows with the rows and
 * shrinks for the stage-0 verdict case — 350 is a ceiling, not a size.
 */
export function generateGradientCard(options: GradientCardOptions): string {
  const { headerText, strip, legend, lang, verdict = null, commandLabel = '/GRADIENT' } = options;
  const rows = options.rows.slice(0, ROW_CAP);
  const theme: CardTheme = cardTheme(options.theme);
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('gradient', 'compact', {
          size: 13,
          ink: theme.pillInk,
          accent: theme.glyphAccent,
        });
  const parts: string[] = [];

  // --- Header: pill + space/steps readout
  const chip = commandChip(PAD, 14, commandLabel, theme, { glyph: commandGlyph });
  parts.push(chip.svg);
  parts.push(
    cardText(CARD_WIDTH - PAD, 14 + 15, headerText, {
      fill: theme.accentText,
      size: 12,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    }),
  );

  // --- The strip: every step, ideal cap over dye block
  const stripY = 14 + 21 + 11;
  const innerW = CARD_WIDTH - PAD * 2;
  const gap = 2;
  const cellW = (innerW - gap * (strip.length - 1)) / Math.max(strip.length, 1);
  strip.forEach((c, i) => {
    const x = PAD + i * (cellW + gap);
    parts.push(
      `<path d="M ${x + 3} ${stripY} H ${x + cellW - 3} Q ${x + cellW} ${stripY} ${x + cellW} ${stripY + 3} V ${stripY + 7} H ${x} V ${stripY + 3} Q ${x} ${stripY} ${x + 3} ${stripY} Z" fill="${escapeXml(c.idealHex)}"/>`,
    );
    parts.push(
      `<path d="M ${x} ${stripY + 7} H ${x + cellW} V ${stripY + 26} Q ${x + cellW} ${stripY + 30} ${x + cellW - 4} ${stripY + 30} H ${x + 4} Q ${x} ${stripY + 30} ${x} ${stripY + 26} Z" fill="${escapeXml(c.dyeHex)}"/>`,
    );
  });

  // --- Verdict (12H·4) — before the rows, in the worst row's tone-neutral ink
  let rowsTop = stripY + 30 + 9;
  if (verdict) {
    const lines = wrapVerdict(verdict, innerW, VERDICT_SIZE, 'body');
    lines.forEach((line, i) => {
      parts.push(
        cardText(PAD, rowsTop + 6 + i * 17, fitText(line, innerW, VERDICT_SIZE, 'body'), {
          fill: theme.name,
          size: VERDICT_SIZE,
          font: 'body',
          weight: 600,
        }),
      );
    });
    rowsTop += 10 + lines.length * 17;
  }

  // --- Rows: the distinct dyes, in step order (ideal half outlined)
  rows.forEach((r, i) => {
    const top = rowsTop + i * ROW_H;
    parts.push(
      measuredRow(PAD, top, ROW_H, {
        lead: r.stepText,
        sourceHex: r.idealHex,
        dyeHex: r.dyeHex,
        name: r.name,
        deltaE: r.deltaE,
        lang,
        theme,
        widths: ROW_WIDTHS,
        nameSize: 13,
        sourceIdeal: true,
      }),
    );
  });

  // --- Footer: legend (wraps rather than ellipsises) + mark
  const legendW = innerW - MARK_RESERVE;
  const legendLines = wrapVerdict(legend, legendW, CARD_TYPE.label, 'mono');
  const footH = 12 + legendLines.length * 14 + 8;
  const height = Math.round(Math.min(350, rowsTop + rows.length * ROW_H + footH));
  legendLines.forEach((line, i) => {
    parts.push(
      cardText(
        PAD,
        height - 8 - (legendLines.length - 1 - i) * 14,
        fitText(line, legendW, CARD_TYPE.label, 'mono'),
        {
          fill: theme.label,
          size: CARD_TYPE.label,
          font: 'mono',
        },
      ),
    );
  });
  parts.push(markFooter(CARD_WIDTH - PAD, height - 8, theme));

  return cardShell(height, theme, parts.join(''));
}

/**
 * Word-wrap a legend or verdict sentence, measured in the pixels the line will
 * actually occupy at the caller's own size and font.
 *
 * BUG-054: this used to measure `candidate.length * 6.6` — a per-*character*
 * constant — and split only on ASCII spaces. A CJK sentence carries no spaces,
 * so the whole verdict stayed a single "word" and never wrapped, and every one
 * of its glyphs is twice the width that constant assumed. The ja stage-0
 * verdict measured 432 px and the ko one 445.5 px on a 400 px card, so a third
 * of the sentence fell outside the viewport. The old comment claimed the
 * overflow "falls through to fitText at render"; neither call site did that.
 *
 * A word that cannot fit a line of its own is broken by code point, which is
 * the only seam a spaceless CJK run offers.
 */
function wrapVerdict(
  textContent: string,
  maxPx: number,
  size: number,
  font: 'mono' | 'body' | 'display',
): string[] {
  const lines: string[] = [];
  let line = '';

  const flush = (): void => {
    if (line) lines.push(line);
    line = '';
  };

  for (const word of textContent.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, font) <= maxPx) {
      line = candidate;
      continue;
    }
    flush();
    if (textWidth(word, size, font) <= maxPx) {
      line = word;
      continue;
    }
    for (const char of word) {
      if (line && textWidth(line + char, size, font) > maxPx) flush();
      line += char;
    }
  }
  flush();

  return lines.length ? lines : [textContent];
}
