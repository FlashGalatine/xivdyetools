/**
 * /contrast — the confirmed Turn-13 pair-count router. The input decides
 * the frame, nothing picks it for the user:
 *
 * - 2 dyes (1 pair) → 13A: the worst pair gets the whole card — butted
 *   pair, both names, the ratio at 30 px, the band named by its ratio, and
 *   the REST strip absent by condition (nothing to show is absent, not
 *   blank).
 * - 3 dyes (3 pairs) → 13B: the ledger — every pair named at 13.5 px, no
 *   tail, no cap in play, the header row finally earning its height.
 * - 4 dyes (6 pairs) → 13C·1: the plot — pairs as rows against a 1:1→21:1
 *   axis with the 3 / 4.5 / 7 criterion lines, plus a fixed 46 px
 *   right-aligned value column so the digits stack (one decimal — nothing
 *   in this tool acts on the second digit).
 *
 * Polarity: green = far apart = safe (the shipped contrast convention,
 * deliberately opposite the Dye Comparison tool). The bands are named by
 * their ratio, never by a letter grade — AA/AAA leave the bot entirely.
 * The ratio and the position derive from ONE number.
 *
 * @module contrast-card
 */

import { ColorService } from '@xivdyetools/core';
import {
  CARD_WIDTH,
  CARD_TYPE,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  dashedRule,
  fitText,
  hairline,
  markFooter,
  type CardTheme,
} from './frame.js';
import { num, escapeXml } from './base.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

export interface ContrastPair {
  hexA: string;
  hexB: string;
  nameA: string;
  nameB: string;
  /** 3-char axis codes for the four-dye plot */
  abbrA: string;
  abbrB: string;
  /** WCAG contrast ratio (≥1) */
  ratio: number;
}

export interface ContrastCardLabels {
  /** WORST PAIR */
  worstPair: string;
  /** PAIR */
  pairCol: string;
  /** RATIO (full form) */
  ratioCol: string;
  /** RATIO / VERH. / 比率 — the 46 px column header (ships with 13C·1) */
  ratioShort: string;
  /** REST */
  rest: string;
  /** Band names — named by their ratio, never a letter grade */
  bands: readonly [string, string, string, string];
  /** "non-text floor is 3:1 — WCAG 1.4.11" ×6 */
  floorKey: string;
  /** The plot legend */
  plotKey: string;
  /** Localized card title for 13B ("Contrast — 3 dyes") */
  title: string;
}

export interface ContrastCardOptions {
  /** Every pair, worst (lowest ratio) first */
  pairs: ContrastPair[];
  labels: ContrastCardLabels;
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  commandGlyph?: string | null;
}

// ============================================================================
// Shared
// ============================================================================

const PAD = 16;

/**
 * WCAG contrast ratio between two colours (1–21).
 *
 * Re-exported from `core`, never re-derived: the ratio is the seventh entry
 * in the suite's shared readout vocabulary, and two implementations of it is
 * exactly the defect that gave the bot two hardcoded 4.5/7 ladders.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  return ColorService.getContrastRatio(hexA, hexB);
}

/** 1.4.11 bands: 3 / 4.5 / 7, higher is safer — the ramp reads in reverse. */
function ratioTier(ratio: number): number {
  if (ratio >= 7) return 3;
  if (ratio >= 4.5) return 2;
  if (ratio >= 3) return 1;
  return 0;
}

function ratioTone(ratio: number, theme: CardTheme): string {
  return theme.tiers[3 - ratioTier(ratio)];
}

/** Position on the 1:1→21:1 axis (log scale — ratios are multiplicative). */
function axisPos(ratio: number): number {
  return Math.min(Math.log(Math.max(ratio, 1)) / Math.log(21), 1);
}

/** Ratio with the language's decimal separator (F-08 — was a bare toFixed). */
function formatRatio(ratio: number, lang: string, decimals = 2): string {
  return `${num(ratio, lang, decimals)}:1`;
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate the /contrast card. The pair count routes the frame:
 * 1 pair → 13A, 3 pairs → 13B, 6 pairs → 13C·1.
 */
export function generateContrastCard(options: ContrastCardOptions): string {
  const theme: CardTheme = cardTheme(options.theme);
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('accessibility', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const opts = { ...options, commandGlyph };

  if (options.pairs.length <= 1) return render13A(opts, theme);
  if (options.pairs.length <= 3) return render13B(opts, theme);
  return render13C1(opts, theme);
}

/** 13A: the worst pair gets the whole card. */
function render13A(o: ContrastCardOptions, theme: CardTheme): string {
  const { labels, commandLabel = '/CONTRAST' } = o;
  const worst = o.pairs[0];
  const rest = o.pairs.slice(1, 6);
  const parts: string[] = [];

  const chip = commandChip(PAD, 14, commandLabel, theme, { glyph: o.commandGlyph });
  parts.push(chip.svg);
  if (o.pairs.length > 1) {
    parts.push(
      cardText(CARD_WIDTH - PAD, 14 + 15, labels.worstPair, {
        fill: theme.label,
        size: 12,
        font: 'mono',
        anchor: 'end',
      })
    );
  }

  // The butted pair + both names
  const pairTop = 14 + 21 + 13;
  parts.push(
    `<path d="M ${PAD + 10} ${pairTop} H ${PAD + 44} V ${pairTop + 62} H ${PAD + 10} Q ${PAD} ${pairTop + 62} ${PAD} ${pairTop + 52} V ${pairTop + 10} Q ${PAD} ${pairTop} ${PAD + 10} ${pairTop} Z" fill="${escapeXml(worst.hexA)}"/>` +
      `<path d="M ${PAD + 44} ${pairTop} H ${PAD + 78} Q ${PAD + 88} ${pairTop} ${PAD + 88} ${pairTop + 10} V ${pairTop + 52} Q ${PAD + 88} ${pairTop + 62} ${PAD + 78} ${pairTop + 62} H ${PAD + 44} Z" fill="${escapeXml(worst.hexB)}"/>` +
      `<rect x="${PAD + 0.5}" y="${pairTop + 0.5}" width="87" height="61" rx="9.5" fill="none" stroke="${escapeXml(theme.swatchRing)}" stroke-width="1"/>`
  );
  const nameX = PAD + 88 + 12;
  parts.push(
    cardText(nameX, pairTop + 26, fitText(worst.nameA, CARD_WIDTH - nameX - PAD, 15, 'body'), {
      fill: theme.name,
      size: 15,
      font: 'body',
      weight: 600,
    })
  );
  parts.push(
    cardText(nameX, pairTop + 46, fitText(worst.nameB, CARD_WIDTH - nameX - PAD, 15, 'body'), {
      fill: theme.name,
      size: 15,
      font: 'body',
      weight: 600,
    })
  );

  // Ratio verdict + band bar
  const divY = pairTop + 62 + 12;
  parts.push(dashedRule(PAD, CARD_WIDTH - PAD, divY, theme));
  const tone = ratioTone(worst.ratio, theme);
  const vTop = divY + 11;
  parts.push(
    cardText(PAD, vTop + 26, formatRatio(worst.ratio, o.lang), { fill: tone, size: 30, font: 'mono' })
  );
  parts.push(
    cardText(PAD, vTop + 44, labels.ratioCol, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1.1,
    })
  );
  const band = labels.bands[ratioTier(worst.ratio)];
  parts.push(
    cardText(CARD_WIDTH - PAD, vTop + 20, band, {
      fill: tone,
      size: 12,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    })
  );
  const fill = Math.max(axisPos(worst.ratio) * 96, 4);
  parts.push(
    `<rect x="${CARD_WIDTH - PAD - 96}" y="${vTop + 28}" width="96" height="6" rx="3" fill="${escapeXml(theme.pillBg)}"/>` +
      `<rect x="${CARD_WIDTH - PAD - 96}" y="${vTop + 28}" width="${fill.toFixed(1)}" height="6" rx="3" fill="${escapeXml(tone)}"/>`
  );

  // REST strip — absent by condition when there is nothing to show
  let restH = 0;
  if (rest.length > 0) {
    const stripY = vTop + 52 + 13;
    let x = PAD;
    parts.push(
      cardText(x, stripY + 13, labels.rest, {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
        letterSpacing: 0.8,
      })
    );
    x += 46;
    for (const p of rest) {
      parts.push(
        `<rect x="${x}" y="${stripY}" width="11" height="18" rx="3" fill="${escapeXml(p.hexA)}"/>` +
          `<rect x="${x + 11}" y="${stripY}" width="11" height="18" rx="3" fill="${escapeXml(p.hexB)}"/>`
      );
      const rText = num(p.ratio, o.lang, 1);
      parts.push(
        cardText(x + 26, stripY + 13, rText, { fill: ratioTone(p.ratio, theme), size: CARD_TYPE.label, font: 'mono' })
      );
      x += 26 + rText.length * 7 + 12;
    }
    restH = 31;
  }

  const height = Math.round(vTop + 52 + restH + 34);
  parts.push(
    cardText(PAD, height - 13, fitText(labels.floorKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 13, theme));
  return cardShell(height, theme, parts.join(''));
}

/** 13B: the ledger — every pair named, worst first. */
function render13B(o: ContrastCardOptions, theme: CardTheme): string {
  const { labels, commandLabel = '/CONTRAST' } = o;
  const ROW_H = 46;
  const parts: string[] = [];

  const chip = commandChip(0, 13, commandLabel, theme, { glyph: o.commandGlyph });
  parts.push(`<g transform="translate(${CARD_WIDTH - PAD - chip.width},0)">${chip.svg}</g>`);
  parts.push(
    cardText(PAD, 13 + 17, fitText(labels.title, CARD_WIDTH - PAD * 2 - chip.width - 10, 16, 'display'), {
      fill: theme.name,
      size: 16,
      font: 'display',
      weight: 600,
    })
  );

  const headY = 13 + 26 + 14;
  parts.push(
    cardText(PAD + 63, headY, labels.pairCol, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 0.8 })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, headY, labels.ratioCol, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.8,
      anchor: 'end',
    })
  );

  const rowsTop = headY + 5;
  o.pairs.forEach((p, i) => {
    const top = rowsTop + i * ROW_H;
    parts.push(hairline(PAD, CARD_WIDTH - PAD, top, theme));
    const cy = top + ROW_H / 2;
    parts.push(
      `<rect x="${PAD}" y="${cy - 16}" width="25" height="32" rx="6" fill="${escapeXml(p.hexA)}"/>` +
        `<rect x="${PAD + 25}" y="${cy - 16}" width="25" height="32" rx="6" fill="${escapeXml(p.hexB)}"/>` +
        `<rect x="${PAD + 0.5}" y="${cy - 15.5}" width="49" height="31" rx="5.5" fill="none" stroke="${escapeXml(theme.swatchRing)}" stroke-width="1"/>`
    );
    const tone = ratioTone(p.ratio, theme);
    parts.push(
      cardText(PAD + 63, cy - 2, fitText(p.nameA, 210, 12.5, 'body'), {
        fill: theme.name,
        size: 12.5,
        font: 'body',
        weight: 600,
      })
    );
    parts.push(
      cardText(PAD + 63, cy + 13, fitText(p.nameB, 210, 12.5, 'body'), {
        fill: theme.subValue,
        size: 12.5,
        font: 'body',
        weight: 600,
      })
    );
    parts.push(`<rect x="${CARD_WIDTH - PAD - 48 - 38}" y="${cy - 2}" width="28" height="4" rx="2" fill="${escapeXml(tone)}"/>`);
    parts.push(
      cardText(CARD_WIDTH - PAD, cy + 4, formatRatio(p.ratio, o.lang), {
        fill: tone,
        size: 13.5,
        font: 'mono',
        anchor: 'end',
      })
    );
  });

  const height = Math.round(rowsTop + o.pairs.length * ROW_H + 34);
  parts.push(
    cardText(PAD, height - 12, fitText(labels.floorKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 12, theme));
  return cardShell(height, theme, parts.join(''));
}

/** 13C·1: the plot with the 46 px right value column. 400×300 at six pairs. */
function render13C1(o: ContrastCardOptions, theme: CardTheme): string {
  const { labels, commandLabel = '/CONTRAST' } = o;
  const parts: string[] = [];

  const chip = commandChip(PAD, 14, commandLabel, theme, { glyph: o.commandGlyph });
  parts.push(chip.svg);
  parts.push(
    cardText(CARD_WIDTH - PAD, 14 + 15, labels.title, {
      fill: theme.label,
      size: 12,
      font: 'mono',
      anchor: 'end',
    })
  );

  // Plot geometry: gutter (pair codes) · axis · value column.
  //
  // The column was drawn at 46 px against a two-decimal ratio. Nothing in
  // this tool acts on the second digit — the bands are 3, 4.5 and 7 — so the
  // rows print one decimal, and the column narrows to 36 px with it. That
  // hands 10 px straight back to the axis, which is the resolution 13C·1
  // exists to show.
  const gutterW = 58;
  const valueW = 36;
  const axisX = PAD + gutterW;
  const axisRight = CARD_WIDTH - PAD - valueW - 10;
  const axisW = axisRight - axisX;
  const plotTop = 14 + 21 + 18;
  const ROW_H = 28;
  const plotBottom = plotTop + o.pairs.length * ROW_H;

  // Criterion lines at 3 / 4.5 / 7 + endpoints
  const criteria: Array<[number, string]> = [
    [3, '3'],
    [4.5, '4.5'],
    [7, '7'],
  ];
  parts.push(
    `<line x1="${axisX}" y1="${plotTop - 4}" x2="${axisX}" y2="${plotBottom}" stroke="${escapeXml(theme.rule)}" stroke-width="1"/>` +
      `<line x1="${axisRight}" y1="${plotTop - 4}" x2="${axisRight}" y2="${plotBottom}" stroke="${escapeXml(theme.rule)}" stroke-width="1"/>`
  );
  for (const [v, label] of criteria) {
    const x = axisX + axisPos(v) * axisW;
    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${plotTop - 4}" x2="${x.toFixed(1)}" y2="${plotBottom}" stroke="${escapeXml(theme.dashed)}" stroke-width="1" stroke-dasharray="3 3"/>`
    );
    parts.push(
      cardText(x, plotTop - 8, label, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', anchor: 'middle' })
    );
  }
  parts.push(cardText(axisX, plotBottom + 15, '1:1', { fill: theme.label, size: CARD_TYPE.label, font: 'mono' }));
  parts.push(
    cardText(axisRight, plotBottom + 15, '21:1', { fill: theme.label, size: CARD_TYPE.label, font: 'mono', anchor: 'end' })
  );
  // The value-column header ships with the direction (RATIO / VERH. / 比率)
  parts.push(
    cardText(CARD_WIDTH - PAD, plotTop - 8, labels.ratioShort, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    })
  );

  // Rows: pair codes · marker at the position · value in the column —
  // both derived from the one number
  o.pairs.forEach((p, i) => {
    const cy = plotTop + i * ROW_H + ROW_H / 2;
    const tone = ratioTone(p.ratio, theme);
    parts.push(
      cardText(PAD, cy + 4, `${p.abbrA}·${p.abbrB}`, { fill: theme.subValue, size: CARD_TYPE.label, font: 'mono' })
    );
    const mx = axisX + axisPos(p.ratio) * axisW;
    parts.push(
      `<line x1="${axisX}" y1="${cy}" x2="${mx.toFixed(1)}" y2="${cy}" stroke="${escapeXml(tone)}" stroke-opacity="0.35" stroke-width="2"/>` +
        `<circle cx="${mx.toFixed(1)}" cy="${cy}" r="4.5" fill="${escapeXml(tone)}"/>`
    );
    // One decimal — nothing in this tool acts on the second digit
    parts.push(
      cardText(CARD_WIDTH - PAD, cy + 4, num(p.ratio, o.lang, 1), {
        fill: tone,
        size: CARD_TYPE.value,
        font: 'mono',
        anchor: 'end',
      })
    );
  });

  const height = Math.round(Math.min(350, plotBottom + 22 + 30));
  parts.push(
    cardText(PAD, height - 12, fitText(labels.plotKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 12, theme));
  return cardShell(height, theme, parts.join(''));
}
