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
  markFooter,
  measuredRow,
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

/** 12H slot widths from its own source (lead 28 holds a "2–3" range). */
const ROW_WIDTHS: MeasuredRowWidths = { lead: 28, pair: 56, name: 186, bar: 34, measure: 32 };

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
    const lines = wrapVerdict(verdict, innerW);
    lines.forEach((line, i) => {
      parts.push(
        cardText(PAD, rowsTop + 6 + i * 17, line, {
          fill: theme.name,
          size: 12.5,
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
  const legendLines = wrapVerdict(legend, innerW - 130);
  const footH = 12 + legendLines.length * 14 + 8;
  const height = Math.round(Math.min(350, rowsTop + rows.length * ROW_H + footH));
  legendLines.forEach((line, i) => {
    parts.push(
      cardText(PAD, height - 8 - (legendLines.length - 1 - i) * 14, line, {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
      }),
    );
  });
  parts.push(markFooter(CARD_WIDTH - PAD, height - 8, theme));

  return cardShell(height, theme, parts.join(''));
}

/** Rough word-wrap for footer legends and verdict sentences (mono/body px budget). */
function wrapVerdict(textContent: string, maxPx: number): string[] {
  const words = textContent.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    // ~6.6 px per Latin char at 11–12.5 px; CJK strings rarely space-split,
    // so an unbreakable long run falls through to fitText at render
    if (candidate.length * 6.6 > maxPx && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [textContent];
}
