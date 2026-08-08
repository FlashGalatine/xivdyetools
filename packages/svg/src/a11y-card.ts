/**
 * /accessibility — the confirmed Turn-13 frames. The `vision:` option
 * chooses the frame; nothing picks it for the user:
 *
 * - 13D (named lens, 400×330): 6A Lens made static — the pair repainted
 *   through one lens (left as designed, right as perceived, a real number
 *   between), the other lenses as a summary strip so the answer keeps its
 *   context.
 * - 13E (vision:all, ≤350): the pair under every lens, one row each; the
 *   normal row on top is the control. Achromatopsia is a full member — this
 *   frame renders because the user asked for all of them.
 * - 13H (single dye, ≤340): 13E's rows with the pair removed. No tier
 *   colours and no verdict — the number is a shift, not a risk; the bar is
 *   relative to the largest shift in the set. The simulated hex replaces
 *   prose: it is dye-agnostic, always true, and pasteable into a matcher.
 *
 * Separation bands run the other way from match bands: larger is safer.
 *
 * The chip prints the command the user actually typed (/ACCESSIBILITY or
 * /A11Y) so a reposted PNG matches their history.
 *
 * @module a11y-card
 */

import { classifyBandTier } from '@xivdyetools/core';
import { num } from './base.js';
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
  textWidth,
  type CardTheme,
} from './frame.js';
import { toolGlyph } from './icons/tool-icons.js';

// ============================================================================
// Types
// ============================================================================

/** One lens row: the pair's separation (or the dye's shift) under a lens. */
export interface A11yLensRow {
  /** Localized lens label ("Deuteranopia") */
  label: string;
  /** Short mono code for the 13D summary strip ("DEUT") */
  short: string;
  /** ΔE2000 — separation (pair frames) or shift (solo frame) */
  deltaE: number;
  /** The lens is the frame's subject (13D) or the normal control (13E) */
  isNormal?: boolean;
  /** Simulated pair/dye colours under this lens */
  hexA: string;
  hexB?: string;
}

export interface A11yCardLabels {
  /** AS DESIGNED */
  designed: string;
  /** AS PERCEIVED */
  perceived: string;
  /** SEPARATION */
  separation: string;
  /** NORMAL (short reference label) */
  normalShort: string;
  /** LENS */
  lens: string;
  /** SHIFT (13H column) */
  shift: string;
  /** Footer legends */
  sepBandKey: string;
  soloKey: string;
  /** "weakest: {lens}" — already interpolated (13E under-table note) */
  worstNote: string;
}

export interface A11yCardOptions {
  /** 'lens' = 13D · 'all' = 13E · 'solo' = 13H */
  mode: 'lens' | 'all' | 'solo';
  /** Card title line: pair ("A ↔ B") or the dye name (solo) */
  titleText: string;
  /** 13D: the named lens row (subject); its label renders in the accent */
  subject?: A11yLensRow;
  /** Unsimulated pair separation (13D reference) */
  normalDeltaE?: number;
  /** All lens rows (13E/13H) or the non-subject strip (13D) */
  rows: A11yLensRow[];
  labels: A11yCardLabels;
  lang: string;
  theme?: 'dark' | 'light';
  /** The command the user actually typed */
  commandLabel?: string;
  commandGlyph?: string | null;
}

// ============================================================================
// Generator
// ============================================================================

const PAD = 16;

/** Separation tone: larger is safer, so the ramp reads in reverse. */
function separationTone(deltaE: number, theme: CardTheme): string {
  const tier = classifyBandTier(deltaE, 'ciede2000', 'separation');
  return theme.tiers[Math.max(0, 3 - Math.min(tier, 3))];
}

/**
 * Generate the /accessibility card (13D/13E/13H by mode).
 */
export function generateA11yCard(options: A11yCardOptions): string {
  const { mode, titleText, labels, lang, commandLabel = '/ACCESSIBILITY' } = options;
  const theme: CardTheme = cardTheme(options.theme);
  const commandGlyph =
    options.commandGlyph !== undefined
      ? options.commandGlyph
      : toolGlyph('accessibility', 'compact', { size: 13, ink: theme.pillInk, accent: theme.glyphAccent });
  const parts: string[] = [];

  // --- Header: pill + subject readout
  const chip = commandChip(PAD, 14, commandLabel, theme, { glyph: commandGlyph });
  parts.push(chip.svg);
  const headerRight =
    mode === 'lens' && options.subject ? options.subject.label : titleText;
  parts.push(
    cardText(CARD_WIDTH - PAD, 14 + 15, fitText(headerRight, CARD_WIDTH - PAD * 2 - chip.width - 10, 12.5, 'mono'), {
      fill: theme.accentText,
      size: 12.5,
      font: 'mono',
      letterSpacing: 0.6,
      anchor: 'end',
    })
  );

  let height: number;

  if (mode === 'lens' && options.subject) {
    height = renderLensFrame(parts, options, theme, lang);
  } else if (mode === 'solo') {
    height = renderSoloFrame(parts, options, theme, lang);
  } else {
    height = renderAllFrame(parts, options, theme, lang);
  }

  parts.push(markFooter(CARD_WIDTH - PAD, height - 13, theme));
  return cardShell(height, theme, parts.join(''));
}

/** 13D: one lens repaints the pair; the rest stay as a summary strip. */
function renderLensFrame(
  parts: string[],
  o: A11yCardOptions,
  theme: CardTheme,
  lang: string
): number {
  const subject = o.subject!;
  const labels = o.labels;

  // Title (the pair) under the header
  parts.push(
    cardText(PAD, 14 + 21 + 24, fitText(o.titleText, CARD_WIDTH - PAD * 2, 17, 'display'), {
      fill: theme.name,
      size: 17,
      font: 'display',
      weight: 600,
    })
  );

  // The pair through the lens: designed | perceived
  const pairTop = 14 + 21 + 34;
  const half = (CARD_WIDTH - PAD * 2 - 10) / 2;
  parts.push(swatch(PAD, pairTop, half, 56, subject.hexA, theme, 10));
  if (subject.hexB) {
    parts.push(swatch(PAD + half + 10, pairTop, half, 56, subject.hexB, theme, 10));
  }
  parts.push(
    cardText(PAD, pairTop + 56 + 15, labels.designed, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
    })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, pairTop + 56 + 15, labels.perceived, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
      anchor: 'end',
    })
  );

  // Verdict block: separation under the lens + the normal reference
  const tone = separationTone(subject.deltaE, theme);
  const vTop = pairTop + 56 + 30;
  parts.push(
    cardText(PAD, vTop + 22, num(subject.deltaE, lang, 1), {
      fill: tone,
      size: 26,
      font: 'display',
      weight: 700,
    })
  );
  parts.push(
    cardText(PAD, vTop + 38, `${labels.separation} · ${subject.short}`, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
    })
  );
  if (o.normalDeltaE !== undefined) {
    parts.push(
      cardText(CARD_WIDTH - PAD, vTop + 22, num(o.normalDeltaE, lang, 1), {
        fill: theme.value,
        size: 15,
        font: 'mono',
        anchor: 'end',
      })
    );
    parts.push(
      cardText(CARD_WIDTH - PAD, vTop + 38, labels.normalShort, {
        fill: theme.label,
        size: CARD_TYPE.label,
        font: 'mono',
        letterSpacing: 1,
        anchor: 'end',
      })
    );
  }

  // Summary strip: the other lenses keep the answer's context
  const stripY = vTop + 52;
  parts.push(dashedRule(PAD, CARD_WIDTH - PAD, stripY, theme));
  const cols = Math.max(o.rows.length, 1);
  const cw = (CARD_WIDTH - PAD * 2) / cols;
  o.rows.forEach((l, i) => {
    const x = PAD + i * cw;
    const lTone = separationTone(l.deltaE, theme);
    parts.push(
      cardText(x, stripY + 20, l.short, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 0.8 })
    );
    parts.push(
      cardText(x, stripY + 37, num(l.deltaE, lang, 1), { fill: lTone, size: CARD_TYPE.value, font: 'mono' })
    );
  });

  return 330;
}

/** 13E: every lens, one row each; the normal row is the control. */
function renderAllFrame(
  parts: string[],
  o: A11yCardOptions,
  theme: CardTheme,
  lang: string
): number {
  const labels = o.labels;
  const ROW_H = 38;

  // Column labels
  const headY = 14 + 21 + 16;
  parts.push(
    cardText(PAD, headY, labels.lens, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, headY, labels.separation, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
      anchor: 'end',
    })
  );

  // Rows: lens label · simulated pair chips · band bar · ΔE
  const rowsTop = headY + 6;
  o.rows.forEach((l, i) => {
    const top = rowsTop + i * ROW_H;
    parts.push(hairline(PAD, CARD_WIDTH - PAD, top, theme));
    const cy = top + ROW_H / 2;
    const tone = separationTone(l.deltaE, theme);
    parts.push(
      cardText(PAD, cy + 4, fitText(l.label, 128, 12.5, 'body'), {
        fill: l.isNormal ? theme.subValue : theme.name,
        size: 12.5,
        font: 'body',
        weight: l.isNormal ? 500 : 600,
      })
    );
    // The simulated pair, butted — the collapse is visible as a shape
    const pairX = PAD + 138;
    parts.push(swatch(pairX, cy - 11, 22, 22, l.hexA, theme, 6));
    if (l.hexB) parts.push(swatch(pairX + 22, cy - 11, 22, 22, l.hexB, theme, 6));
    const deText = num(l.deltaE, lang, 1);
    const deW = textWidth(deText, CARD_TYPE.value, 'mono');
    const barW = 118 - deW;
    parts.push(
      `<rect x="${CARD_WIDTH - PAD - 118}" y="${cy - 2.5}" width="${Math.max(barW - 8, 20)}" height="5" rx="2.5" fill="${tone}"/>`
    );
    parts.push(
      cardText(CARD_WIDTH - PAD, cy + 4, deText, { fill: tone, size: CARD_TYPE.value, font: 'mono', anchor: 'end' })
    );
  });

  // The per-lens note sits under the table, not in the rows (DE overran)
  const noteY = rowsTop + o.rows.length * ROW_H + 18;
  parts.push(
    cardText(PAD, noteY, fitText(labels.worstNote, CARD_WIDTH - PAD * 2, CARD_TYPE.label, 'mono'), {
      fill: theme.subValue,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );

  const height = Math.min(350, noteY + 14 + 24);
  parts.push(
    cardText(PAD, height - 13, fitText(labels.sepBandKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  return height;
}

/** 13H: the pair removed — a shift, not a risk; no tier colours, no verdict. */
function renderSoloFrame(
  parts: string[],
  o: A11yCardOptions,
  theme: CardTheme,
  lang: string
): number {
  const labels = o.labels;
  const ROW_H = 40;

  // Title (the dye)
  parts.push(
    cardText(PAD, 14 + 21 + 24, fitText(o.titleText, CARD_WIDTH - PAD * 2, 17, 'display'), {
      fill: theme.name,
      size: 17,
      font: 'display',
      weight: 600,
    })
  );

  const headY = 14 + 21 + 40;
  parts.push(
    cardText(PAD, headY, labels.lens, { fill: theme.label, size: CARD_TYPE.label, font: 'mono', letterSpacing: 1 })
  );
  parts.push(
    cardText(CARD_WIDTH - PAD, headY, labels.shift, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      letterSpacing: 1,
      anchor: 'end',
    })
  );

  const maxShift = Math.max(...o.rows.map((l) => l.deltaE), 0.1);
  const rowsTop = headY + 6;
  o.rows.forEach((l, i) => {
    const top = rowsTop + i * ROW_H;
    parts.push(hairline(PAD, CARD_WIDTH - PAD, top, theme));
    const cy = top + ROW_H / 2;
    parts.push(
      cardText(PAD, cy + 4, fitText(l.label, 118, 12.5, 'body'), {
        fill: l.isNormal ? theme.subValue : theme.name,
        size: 12.5,
        font: 'body',
        weight: l.isNormal ? 500 : 600,
      })
    );
    parts.push(swatch(PAD + 128, cy - 11, 22, 22, l.hexA, theme, 6));
    // The simulated hex — dye-agnostic, always true, pasteable into a matcher
    parts.push(
      cardText(PAD + 158, cy + 4, l.hexA.toUpperCase(), { fill: theme.subValue, size: 11.5, font: 'mono' })
    );
    // Relative bar in neutral ink: a large shift is not a failure
    const barMax = 76;
    const barW = Math.max((l.deltaE / maxShift) * barMax, 2);
    parts.push(
      `<rect x="${CARD_WIDTH - PAD - 34 - barMax}" y="${cy - 2.5}" width="${barW.toFixed(1)}" height="5" rx="2.5" fill="${theme.subValue}"/>`
    );
    parts.push(
      cardText(CARD_WIDTH - PAD, cy + 4, num(l.deltaE, lang, 1), {
        fill: theme.value,
        size: CARD_TYPE.value,
        font: 'mono',
        anchor: 'end',
      })
    );
  });

  const height = Math.min(350, rowsTop + o.rows.length * ROW_H + 32);
  parts.push(
    cardText(PAD, height - 13, fitText(labels.soloKey, CARD_WIDTH - PAD * 2 - 130, CARD_TYPE.label, 'mono'), {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
    })
  );
  return height;
}
