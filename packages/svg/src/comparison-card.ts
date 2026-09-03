/**
 * /compare — the confirmed Turn-14 dye-count router:
 *
 * - 2 dyes → 14A Duel: one pair gets the whole card and all seven readouts
 *   (the one case with room — the strip is not a layout risk at any count).
 * - 3 dyes → 14C·2: the triangle with full localised names on both axes.
 * - 4 dyes → 14C: the triangle with coded axes (3-char abbr) — the
 *   abbreviation ships for the four-dye case alone.
 *
 * The router is total (2/3/4 are the only inputs that exist — the schema
 * caps at four), so there is no fall-through case and no +N tail anywhere.
 * Polarity: green = close (the Dye Comparison tool's own convention,
 * deliberately opposite /contrast). avgDistance is deleted, not fixed.
 *
 * @module comparison-card
 */

import { classifyBandTier } from '@xivdyetools/core';
import { escapeXml, num } from './base.js';
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
  swatch,
  type CardTheme,
} from './frame.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

export interface ComparisonDyeEntry {
  hex: string;
  /** Localized name */
  name: string;
  /** 3-char axis code (four-dye triangle only) */
  abbr: string;
  /** Meta line under the name in the duel ("#781A1A · STAIN 10") */
  metaText: string;
}

/** One of the duel's seven readouts (labels are untranslated unit codes). */
export interface ComparisonReadout {
  short: string;
  value: string;
}

export interface ComparisonCardLabels {
  /** Localized card title ("Comparison — {n} dyes") */
  title: string;
  /** Band tier words ×4 (SAME/CLOSE/NEAR/FAR and locales) */
  tags: readonly [string, string, string, string];
  /** "green = close · bands 5 / 10 / 20" ×6 */
  cmpKey: string;
  /** "ratio measures lightness, not distance" ×6 */
  ratioKey: string;
  /** "upper triangle · each pair once" ×6 */
  triKey: string;
}

export interface ComparisonCardOptions {
  dyes: ComparisonDyeEntry[];
  /** ΔE2000 for pair (i,j), keyed `${i}-${j}` with i<j */
  deltaE: (i: number, j: number) => number;
  /** The duel's seven readouts (2-dye case only) */
  readouts?: ComparisonReadout[];
  labels: ComparisonCardLabels;
  lang: string;
  theme?: 'dark' | 'light';
  commandLabel?: string;
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 16;

function matchTone(de: number, theme: CardTheme): string {
  return theme.tiers[Math.min(classifyBandTier(de, 'ciede2000', 'match'), 3)];
}

/**
 * Generate the /compare card. Two dyes render the duel; three or four
 * render the triangle.
 */
export function generateComparisonCard(options: ComparisonCardOptions): string {
  const theme: CardTheme = cardTheme(options.theme);
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('comparison', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const opts = { ...options, commandGlyph };
  return options.dyes.length <= 2 ? renderDuel(opts, theme) : renderTriangle(opts, theme);
}

/** 14A: one pair, the whole card, all seven readouts. */
function renderDuel(o: ComparisonCardOptions, theme: CardTheme): string {
  const { labels, lang, commandLabel = '/COMPARE' } = o;
  const [a, b] = o.dyes;
  const de = o.deltaE(0, 1);
  const tone = matchTone(de, theme);
  const tier = Math.min(classifyBandTier(de, 'ciede2000', 'match'), 3);
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

  // The two dyes, facing each other
  const dTop = 13 + 26 + 12;
  const half = (CARD_WIDTH - PAD * 2 - 12) / 2;
  parts.push(swatch(PAD, dTop, half, 46, a.hex, theme, 10));
  parts.push(swatch(PAD + half + 12, dTop, half, 46, b.hex, theme, 10));
  parts.push(
    cardText(PAD, dTop + 46 + 17, fitText(a.name, half, 13.5, 'body'), {
      fill: theme.name,
      size: 13.5,
      font: 'body',
      weight: 600,
    })
  );
  parts.push(
    cardText(PAD, dTop + 46 + 32, fitText(a.metaText, half, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, dTop + 46 + 17, fitText(b.name, half, 13.5, 'body'), {
      fill: theme.name,
      size: 13.5,
      font: 'body',
      weight: 600,
      anchor: 'end',
    })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, dTop + 46 + 32, fitText(b.metaText, half, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      anchor: 'end',
    })
  );

  // Verdict: ΔE2000 + tier word
  const vTop = dTop + 46 + 44;
  parts.push(dashedRule(PAD, CARD_WIDTH - PAD, vTop, theme));
  parts.push(
    cardText(PAD, vTop + 34, num(de, lang, 1), { fill: tone, size: 28, font: 'display', weight: 700 })
  );
  parts.push(
    cardText(PAD, vTop + 50, 'ΔE2000', { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, vTop + 34, labels.tags[tier], {
      fill: tone,
      size: 13,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    })
  );

  // Seven readouts — what the room one pair buys is for
  const readouts = o.readouts ?? [];
  const stripTop = vTop + 62;
  if (readouts.length > 0) {
    parts.push(hairline(PAD, CARD_WIDTH - PAD, stripTop, theme));
    const cols = readouts.length;
    const cw = (CARD_WIDTH - PAD * 2) / cols;
    readouts.forEach((r, i) => {
      const x = PAD + i * cw;
      parts.push(
        cardText(x, stripTop + 24, r.value, { fill: theme.value, size: 12, font: 'mono' })
      );
      // 11 px, not 9.5 — the floor is a wall. REDMEAN is the widest label
      // and clears a 52 px column by ~2 px, so it is fitted rather than
      // trusted.
      parts.push(
        cardText(x, stripTop + 39, fitText(r.short, cw - 4, CARD_TYPE.label, 'mono'), {
          fill: theme.label,
          size: CARD_TYPE.label,
          font: 'mono',
          letterSpacing: 0.4,
        })
      );
    });
  }

  const height = Math.round(stripTop + (readouts.length ? 50 : 8) + 44);
  parts.push(
    cardText(PAD, height - 26, fitText(labels.cmpKey, CARD_WIDTH - PAD * 2, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(
    cardText(PAD, height - 12, fitText(labels.ratioKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 12, theme));
  return cardShell(height, theme, parts.join(''));
}

/** 14C/14C·2: the upper triangle — each pair once. */
function renderTriangle(o: ComparisonCardOptions, theme: CardTheme): string {
  const { labels, lang, commandLabel = '/COMPARE' } = o;
  const n = o.dyes.length;
  const useAbbr = n >= 4;
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

  // Grid geometry: row labels left (dyes 0..n-2), column labels top (1..n-1)
  const labelW = useAbbr ? 64 : 118;
  const gridX = PAD + labelW + 8;
  const gridW = CARD_WIDTH - PAD - gridX;
  const cols = n - 1;
  const cellW = (gridW - (cols - 1) * 6) / cols;
  const cellH = useAbbr ? 52 : 62;
  const gridTop = 13 + 26 + 24;

  // Column headers (dyes 1..n-1)
  for (let j = 1; j < n; j++) {
    const x = gridX + (j - 1) * (cellW + 6);
    const d = o.dyes[j];
    parts.push(swatch(x, gridTop - 18, 14, 14, d.hex, theme, 4));
    parts.push(
      cardText(x + 18, gridTop - 7, fitText(useAbbr ? d.abbr : d.name, cellW - 20, CARD_TYPE.label, useAbbr ? 'mono' : 'body'), {
        fill: theme.subValue,
        size: CARD_TYPE.label,
        font: useAbbr ? 'mono' : 'body',
      })
    );
  }

  // Rows (dyes 0..n-2), cells for j > i
  for (let i = 0; i < n - 1; i++) {
    const y = gridTop + i * (cellH + 6);
    const d = o.dyes[i];
    parts.push(swatch(PAD, y + cellH / 2 - 7, 14, 14, d.hex, theme, 4));
    parts.push(
      cardText(PAD + 18, y + cellH / 2 + 4, fitText(useAbbr ? d.abbr : d.name, labelW - 20, CARD_TYPE.label, useAbbr ? 'mono' : 'body'), {
        fill: theme.subValue,
        size: CARD_TYPE.label,
        font: useAbbr ? 'mono' : 'body',
      })
    );
    for (let j = i + 1; j < n; j++) {
      const x = gridX + (j - 1) * (cellW + 6);
      const de = o.deltaE(i, j);
      const tone = matchTone(de, theme);
      const tier = Math.min(classifyBandTier(de, 'ciede2000', 'match'), 3);
      parts.push(
        `<rect x="${x}" y="${y}" width="${cellW.toFixed(1)}" height="${cellH}" rx="9" fill="${escapeXml(tone)}" fill-opacity="0.13"/>` +
          `<rect x="${x + 0.5}" y="${y + 0.5}" width="${(cellW - 1).toFixed(1)}" height="${cellH - 1}" rx="8.5" fill="none" stroke="${escapeXml(tone)}" stroke-opacity="0.4" stroke-width="1"/>`
      );
      parts.push(
        cardText(x + cellW / 2, y + cellH / 2 + 1, num(de, lang, 1), {
          fill: tone,
          size: 16,
          font: 'display',
          weight: 700,
          anchor: 'middle',
        })
      );
      parts.push(
        cardText(x + cellW / 2, y + cellH / 2 + 16, fitText(labels.tags[tier], cellW - 8, CARD_TYPE.label, 'mono'), {
          fill: tone,
          size: CARD_TYPE.label,
          font: 'mono',
          letterSpacing: 0.4,
          anchor: 'middle',
        })
      );
    }
  }

  const gridBottom = gridTop + (n - 1) * (cellH + 6) - 6;
  const height = Math.round(Math.min(350, gridBottom + 24 + 30));
  parts.push(
    cardText(PAD, height - 26, fitText(labels.triKey, CARD_WIDTH - PAD * 2, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(
    cardText(PAD, height - 12, fitText(labels.cmpKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  parts.push(markFooter(CARD_WIDTH - PAD, height - 12, theme));
  return cardShell(height, theme, parts.join(''));
}
