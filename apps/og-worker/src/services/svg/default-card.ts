/**
 * Default cards — the fallback nobody drew, now confirmed (2a, 2026-08-07).
 *
 * A default card NEVER fakes data: no dye names, no ΔE, no prices — nothing
 * that looks like a result the user did not ask for. The band field carries
 * the one palette we own — the mark's six spill stripes, wordless (identity,
 * not data: the five-band cap governs *labelled* bands; wordless stripes
 * carry no 11px names, so six is legal). 2a floats the tool's banner glyph
 * in a dark tile on the stripes — the tile is the contrast guarantee, so no
 * per-band ink work exists here. The ROOT card takes no tile (the tile
 * carries the tool; the root has none) and drops the method tag (it fronts
 * no method — the tool defaults keep ΔE2000 as a fact about the tool).
 *
 * The Discord frame shares `cardHeader` / `cardFooter` with the band cards —
 * one chrome, one source. The X frame deliberately does NOT: 2a draws it as
 * a 60px strip carrying the mark, the deck name and the path, because a
 * default card has no in-band data to protect and its name needs somewhere to
 * live once the deck drops. A band card's X keeps the 30/26 chrome instead so
 * its bands survive intact.
 *
 * @module services/svg/default-card
 */

import { toolGlyph, escapeXml, estimateTextWidth, type ToolGlyphName } from '@xivdyetools/svg';
import { COMPACT_GLYPH, GROUND, MARK_STRIPES, STACKS } from './tokens';
import {
  BAND_FRAMES,
  FOOTER_H,
  HEADER_H,
  RULE,
  cardFooter,
  cardHeader,
  ogMark,
  type BandFrame,
} from './band';

// MARK_STRIPES lives in ./tokens; re-exported so callers that think of the
// stripes as the default card's own (the tests do) keep one import.
export { MARK_STRIPES } from './tokens';

/**
 * Two deck lines here, against a band card's one: a default card has a
 * confirmed one-liner to spend the second line on, and no data to protect.
 */
const DEFAULT_DECK_H = 54;

export interface DefaultCardOptions {
  /** Compact glyph name + banner (detail) glyph name; null = the root card */
  tool: { glyphName: ToolGlyphName; label: string } | null;
  /** Localized tool name (deck headline) */
  name: string;
  /** Localized one-liner */
  sub: string;
  /** Path-only footer (the standing rule: never the scheme) */
  path: string;
  /** Tool defaults keep ΔE2000 (a fact about the tool); the root drops it */
  methodTag?: string | null;
  frame?: BandFrame;
}

function text(
  x: number,
  y: number,
  content: string,
  o: { fill: string; size: number; family: string; weight?: number; spacing?: number; anchor?: string }
): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `fill="${o.fill}"`,
    `font-size="${o.size}"`,
    `font-family="${o.family}"`,
  ];
  if (o.weight) attrs.push(`font-weight="${o.weight}"`);
  if (o.spacing) attrs.push(`letter-spacing="${o.spacing}"`);
  if (o.anchor) attrs.push(`text-anchor="${o.anchor}"`);
  return `<text ${attrs.join(' ')}>${escapeXml(content)}</text>`;
}

/** Generate a 2a default card (400-grid — raster ×3 downstream). */
export function generateDefaultCard(options: DefaultCardOptions): string {
  const frame = options.frame ?? 'discord';
  const { width, height } = BAND_FRAMES[frame];
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${GROUND}"/>`);

  const stripeW = width / MARK_STRIPES.length;

  if (frame === 'discord') {
    // Header strip 30px — the SHARED chrome, byte-identical to a band card's
    parts.push(
      cardHeader(width, {
        toolTag: options.tool?.label,
        toolGlyph: options.tool ? toolGlyph(options.tool.glyphName, 'compact', COMPACT_GLYPH) : null,
      })
    );

    // Deck (two lines here — a default card has a one-liner to spend them on)
    // + footer 26px bound the stripe field
    const deckTop = height - FOOTER_H - DEFAULT_DECK_H;
    const fieldTop = HEADER_H;
    const fieldH = deckTop - fieldTop;
    MARK_STRIPES.forEach((hex, i) => {
      parts.push(
        `<rect x="${(i * stripeW).toFixed(2)}" y="${fieldTop}" width="${(stripeW + 0.5).toFixed(2)}" height="${fieldH}" fill="${hex}"/>`
      );
    });

    // 2a: the banner glyph floats in a dark tile — the contrast guarantee.
    // The root card takes no tile.
    if (options.tool) {
      const tile = 168;
      const tx = (width - tile) / 2;
      const ty = fieldTop + (fieldH - tile) / 2;
      parts.push(`<rect x="${tx}" y="${ty}" width="${tile}" height="${tile}" rx="24" fill="${GROUND}"/>`);
      parts.push(
        toolGlyph(options.tool.glyphName, 'detail', {
          size: 104,
          ink: '#ECECEE',
          accent: '#EA4133',
        }).replace('<svg ', `<svg x="${tx + 32}" y="${ty + 32}" `)
      );
    }

    // Deck: name + one-liner
    parts.push(`<line x1="0" y1="${deckTop}" x2="${width}" y2="${deckTop}" stroke="${RULE}" stroke-width="1"/>`);
    parts.push(
      text(13, deckTop + 21, options.name, { fill: '#ECECEE', size: 14.5, family: STACKS.body, weight: 600 })
    );
    parts.push(text(13, deckTop + 40, options.sub, { fill: '#9C9CA2', size: 12, family: STACKS.body }));

    // Footer 26px: path · method tag (only where it is true) — shared chrome
    parts.push(cardFooter(width, height, { path: options.path, right: options.methodTag }));
  } else {
    // X 400×210: stripes (tile ×0.66), deck drops, 60px strip
    const stripH = 60;
    const fieldH = height - stripH;
    MARK_STRIPES.forEach((hex, i) => {
      parts.push(
        `<rect x="${(i * stripeW).toFixed(2)}" y="0" width="${(stripeW + 0.5).toFixed(2)}" height="${fieldH}" fill="${hex}"/>`
      );
    });
    if (options.tool) {
      const tile = 104;
      const tx = (width - tile) / 2;
      const ty = (fieldH - tile) / 2;
      parts.push(`<rect x="${tx}" y="${ty}" width="${tile}" height="${tile}" rx="16" fill="${GROUND}"/>`);
      parts.push(
        toolGlyph(options.tool.glyphName, 'detail', {
          size: 64,
          ink: '#ECECEE',
          accent: '#EA4133',
        }).replace('<svg ', `<svg x="${tx + 20}" y="${ty + 20}" `)
      );
    }
    const cy = fieldH + stripH / 2;
    parts.push(ogMark(13, cy - 9.5, 19));
    parts.push(text(41, cy - 2, options.name, { fill: '#ECECEE', size: 14, family: STACKS.body, weight: 600 }));
    parts.push(text(41, cy + 14, options.path, { fill: '#86868C', size: 11, family: STACKS.mono }));
    if (options.tool) {
      const labelW = estimateTextWidth(options.tool.label, 11 * 0.62);
      parts.push(
        text(width - 13, cy + 4, options.tool.label, {
          fill: '#FF6257',
          size: 11,
          family: STACKS.mono,
          anchor: 'end',
        })
      );
      parts.push(
        toolGlyph(options.tool.glyphName, 'compact', COMPACT_GLYPH).replace(
          '<svg ',
          `<svg x="${(width - 13 - labelW - 6 - 13).toFixed(1)}" y="${(cy - 6.5).toFixed(1)}" `
        )
      );
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    parts.join('') +
    `</svg>`
  );
}

/**
 * Per-tool glyph + chip label for the default cards. Deck strings (name +
 * one-liner ×6) live in `services/og-strings.ts` — the confirmed string
 * pass, not these constants.
 */
export const DEFAULT_DECK: Record<string, { glyphName: ToolGlyphName; label: string }> = {
  harmony: { glyphName: 'harmony', label: '/HARMONY' },
  gradient: { glyphName: 'gradient', label: '/GRADIENT' },
  mixer: { glyphName: 'mixer', label: '/MIXER' },
  swatch: { glyphName: 'swatch', label: '/SWATCH' },
  comparison: { glyphName: 'comparison', label: '/COMPARISON' },
  accessibility: { glyphName: 'accessibility', label: '/A11Y' },
  extractor: { glyphName: 'extractor', label: '/EXTRACTOR' },
  presets: { glyphName: 'presets', label: '/PRESETS' },
  budget: { glyphName: 'budget', label: '/BUDGET' },
};
