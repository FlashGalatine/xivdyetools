/**
 * /dye info — the confirmed 11B Sheet (Turn 11), 400×350.
 *
 * Header band in the dye's own colour (its ink is `bandInk(dye.hex)` — white
 * on a dark dye, near-black on a light one — and the pill goes mono on it:
 * the accent is unpredictable against an arbitrary hue), a 2-col numeric grid, SRC/MKT
 * rows, and the nearest-dyes strip: the one thing a dye page should answer
 * next, and the only content not already in the embed. The 350 cap cost the
 * COST row — price rides SRC. The Spectrum item name stays verbatim EN, like
 * a command choice value.
 *
 * @module dye-info-card
 */

import type { Dye } from '@xivdyetools/types';
import { classifyBandTier, ColorService } from '@xivdyetools/core';
import { num, escapeXml } from './base.js';
import { panelGlyph } from './icons/tool-icons.js';
import {
  CARD_WIDTH,
  CARD_TYPE,
  bandInk,
  pillInkOnDye,
  cardShell,
  cardTheme,
  cardText,
  commandChip,
  dashedRule,
  hairline,
  fitText,
  markFooter,
  textWidth,
  type CardTheme,
} from './frame.js';

// ============================================================================
// Types
// ============================================================================

/** One nearest-dye column in the strip (≤3). */
export interface NearestDyeInfo {
  hex: string;
  name: string;
  /** ΔE2000 from the subject dye (match-calibrated bands) */
  deltaE: number;
}

/** Localized label codes (real keys ×6 — never English to a non-EN player). */
export interface DyeInfoLabels {
  /** STAIN / FARBNR. / 番号 … */
  stain: string;
  /** SRC / QUELLE / 入手 … */
  src: string;
  /** MKT / MARKT / 市場 … */
  mkt: string;
  /** NEAREST DYES / NÄCHSTE FARBSTOFFE / … */
  nearest: string;
  /** "+{n} more" — already interpolated, or empty when nothing is omitted */
  nearestMore: string;
}

export interface DyeInfoCardOptions {
  dye: Dye;
  localizedName: string;
  localizedCategory: string;
  /** Stain ID — the handle share URLs key on (null only for Facewear). */
  stainID: number | null;
  /** SRC row value, e.g. "Farbstoffverkäufer · 216 Gil" */
  srcValue: string;
  /** MKT row value, e.g. "Standard Spectrum · 52254" (verbatim item name) */
  mktValue: string;
  /** The nearest-dye strip (≤3 columns) */
  nearest: NearestDyeInfo[];
  labels: DyeInfoLabels;
  /** BCP-47ish locale code for number formatting */
  lang: string;
  theme?: 'dark' | 'light';
  /** The command label in the pill (default "/DYE INFO") */
  commandLabel?: string;
  /** Rendered 13 px glyph for the pill (the bare chip; null = text-only) */
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const H = 350;
const PAD = 15;

/**
 * Generate the /dye info card (11B, 400×350).
 */
export function generateDyeInfoCard(options: DyeInfoCardOptions): string {
  const {
    dye,
    localizedName,
    localizedCategory,
    stainID,
    srcValue,
    mktValue,
    nearest,
    labels,
    lang,
    commandLabel = '/DYE INFO',
  } = options;
  const theme: CardTheme = cardTheme(options.theme);
  // The band is the dye's own colour, so its ink is picked per dye (white on
  // Dalamud Red, near-black on Pure White); the pill's ink is judged through
  // its scrim separately.
  const ink = bandInk(dye.hex);
  const pillInk = pillInkOnDye(dye.hex);
  // /dye is not one of the nine tools — it takes the bare chip, mono on the
  // dye-coloured ground (the accent is unpredictable against an arbitrary hue).
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : panelGlyph('dye', { size: 13, ink: pillInk, accent: pillInk });
  const parts: string[] = [];

  // --- Header band: the dye's own colour, 78 px, square top corners under the shell radius
  parts.push(
    `<path d="M 0 16 Q 0 0 16 0 H ${CARD_WIDTH - 16} Q ${CARD_WIDTH} 0 ${CARD_WIDTH} 16 V 78 H 0 Z" fill="${escapeXml(dye.hex)}"/>`
  );
  const chip = commandChip(14, 11, commandLabel, theme, { glyph: commandGlyph, onDye: dye.hex });
  parts.push(chip.svg);
  if (stainID != null) {
    parts.push(
      cardText(CARD_WIDTH - 14, 24, `${labels.stain} ${stainID}`, {
        fill: ink.onMid,
        size: CARD_TYPE.value,
        font: 'mono',
        anchor: 'end',
      })
    );
  }
  parts.push(
    cardText(15, 53, fitText(localizedName, CARD_WIDTH - 30, 23, 'display'), {
      fill: ink.on,
      size: 23,
      font: 'display',
      weight: 700, // the dye's name is the headline — bold, like the nearest-dye captions
    })
  );
  parts.push(
    cardText(16, 70, localizedCategory, {
      fill: ink.onDim,
      size: 12,
      font: 'mono',
    })
  );

  // --- Numeric grid: HEX / RGB / HSV / LAB, two columns
  const gridTop = 78 + 11;
  const colW = (CARD_WIDTH - PAD * 2 - 18) / 2;
  const col2X = PAD + colW + 18;
  const hsv = dye.hsv;
  const lab = ColorService.hexToLab(dye.hex);
  const cells: Array<[string, string]> = [
    ['HEX', dye.hex.toUpperCase()],
    ['RGB', `${dye.rgb.r} ${dye.rgb.g} ${dye.rgb.b}`],
    ['HSV', hsv ? `${Math.round(hsv.h)} ${Math.round(hsv.s)} ${Math.round(hsv.v)}` : '—'],
    ['LAB', `${Math.round(lab.L)} ${Math.round(lab.a)} ${Math.round(lab.b)}`],
  ];
  cells.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? PAD : col2X;
    const right = i % 2 === 0 ? PAD + colW : CARD_WIDTH - PAD;
    const y = gridTop + Math.floor(i / 2) * 22 + 13;
    parts.push(
      cardText(x, y, label, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
    );
    parts.push(
      cardText(right, y, value, { fill: theme.value, size: CARD_TYPE.value, font: 'mono', anchor: 'end' })
    );
  });

  // --- SRC / MKT
  const dashY = gridTop + 44 + 10;
  parts.push(dashedRule(PAD, CARD_WIDTH - PAD, dashY, theme));
  const srcY = dashY + 10 + 13;
  const rowPairs: Array<[string, string]> = [
    [labels.src, srcValue],
    [labels.mkt, mktValue],
  ];
  rowPairs.forEach(([label, value], i) => {
    const y = srcY + i * 22;
    parts.push(
      cardText(PAD, y, label, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
    );
    parts.push(
      cardText(CARD_WIDTH - PAD, y, fitText(value, CARD_WIDTH - PAD * 2 - 60, CARD_TYPE.value, 'mono'), {
        fill: theme.value,
        size: CARD_TYPE.value,
        font: 'mono',
        anchor: 'end',
      })
    );
  });

  // --- Nearest strip
  const ruleY = srcY + 22 + 10;
  parts.push(hairline(PAD, CARD_WIDTH - PAD, ruleY, theme));
  const nearTop = ruleY + 10;
  const headline = options.labels.nearestMore
    ? `${labels.nearest} · ${labels.nearestMore}`
    : labels.nearest;
  parts.push(
    cardText(PAD, nearTop + 11, headline, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1.1,
    })
  );
  const stripTop = nearTop + 11 + 7;
  const cols = Math.max(nearest.length, 1);
  const gap = 8;
  const cw = (CARD_WIDTH - PAD * 2 - gap * (cols - 1)) / cols;
  nearest.forEach((n, i) => {
    const x = PAD + i * (cw + gap);
    const tier = classifyBandTier(n.deltaE, 'ciede2000', 'match');
    const tone = theme.tiers[Math.min(tier, 3)];
    parts.push(
      `<rect x="${x}" y="${stripTop}" width="${cw}" height="26" rx="7" fill="${n.hex}"/>` +
        `<rect x="${x + 0.5}" y="${stripTop + 0.5}" width="${cw - 1}" height="25" rx="6.5" fill="none" stroke="${theme.swatchRing}" stroke-width="1"/>`
    );
    parts.push(
      cardText(x, stripTop + 26 + 5 + 11, fitText(n.name, cw, 12, 'body'), {
        fill: theme.name,
        size: 12,
        font: 'body',
        weight: 700, // dye names read first; the ΔE figure under them stays regular
      })
    );
    const barY = stripTop + 26 + 5 + 15 + 5;
    const deText = num(n.deltaE, lang, 1);
    const deW = textWidth(deText, 12, 'mono');
    parts.push(
      `<rect x="${x}" y="${barY}" width="${cw - deW - 5}" height="4" rx="2" fill="${tone}"/>`
    );
    parts.push(
      cardText(x + cw, barY + 6, deText, { fill: tone, size: 12, font: 'mono', anchor: 'end' })
    );
  });

  // --- Mark
  parts.push(markFooter(CARD_WIDTH - PAD, H - 13, theme));

  return cardShell(H, theme, parts.join(''));
}
