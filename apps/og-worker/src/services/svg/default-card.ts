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
 * @module services/svg/default-card
 */

import { toolGlyph, type ToolGlyphName } from '@xivdyetools/svg';
import { escapeXml, estimateTextWidth } from './base';
import { ogMark, BAND_FRAMES, type BandFrame } from './band';

/**
 * The six spill colours as drawn in the app icon — the mark's source of
 * truth, referenced once, never re-typed per card.
 */
export const MARK_STRIPES = [
  '#E5484D',
  '#F76B15',
  '#FFC53D',
  '#30A46C',
  '#0091FF',
  '#8E4EC6',
] as const;

const GROUND = '#0B0B0C';
const RULE = 'rgba(255,255,255,0.07)';

const STACK_BODY = 'Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR';
const STACK_MONO = 'Fragment Mono, Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR';
const STACK_DISPLAY = 'Space Grotesk, Noto Sans JP, Noto Sans SC, Noto Sans KR';

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
    // Header strip 30px: mark + wordmark left · glyph + label right
    parts.push(ogMark(13, 6.5, 17));
    parts.push(
      text(37, 19, 'XIV DYE TOOLS', {
        fill: '#9C9CA2',
        size: 11,
        family: STACK_DISPLAY,
        weight: 600,
        spacing: 1.3,
      })
    );
    if (options.tool) {
      const labelW = estimateTextWidth(options.tool.label, 11 * 0.62);
      parts.push(
        text(width - 13, 19, options.tool.label, {
          fill: '#FF6257',
          size: 11,
          family: STACK_MONO,
          spacing: 0.5,
          anchor: 'end',
        })
      );
      parts.push(
        toolGlyph(options.tool.glyphName, 'compact', {
          size: 13,
          ink: '#ECECEE',
          accent: '#FF6257',
        }).replace('<svg ', `<svg x="${(width - 13 - labelW - 6 - 13).toFixed(1)}" y="8.5" `)
      );
    }
    parts.push(`<line x1="0" y1="30" x2="${width}" y2="30" stroke="${RULE}" stroke-width="1"/>`);

    // Deck ~54px + footer 26px bound the stripe field
    const deckTop = height - 26 - 54;
    const fieldTop = 30;
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
      text(13, deckTop + 21, options.name, { fill: '#ECECEE', size: 14.5, family: STACK_BODY, weight: 600 })
    );
    parts.push(text(13, deckTop + 40, options.sub, { fill: '#9C9CA2', size: 12, family: STACK_BODY }));

    // Footer 26px: path · method tag (only where it is true)
    const footTop = height - 26;
    parts.push(`<line x1="0" y1="${footTop}" x2="${width}" y2="${footTop}" stroke="${RULE}" stroke-width="1"/>`);
    parts.push(text(13, footTop + 17, options.path, { fill: '#86868C', size: 11, family: STACK_MONO }));
    if (options.methodTag) {
      parts.push(
        text(width - 13, footTop + 17, options.methodTag, {
          fill: '#86868C',
          size: 11,
          family: STACK_MONO,
          anchor: 'end',
        })
      );
    }
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
    parts.push(text(41, cy - 2, options.name, { fill: '#ECECEE', size: 14, family: STACK_BODY, weight: 600 }));
    parts.push(text(41, cy + 14, options.path, { fill: '#86868C', size: 11, family: STACK_MONO }));
    if (options.tool) {
      const labelW = estimateTextWidth(options.tool.label, 11 * 0.62);
      parts.push(
        text(width - 13, cy + 4, options.tool.label, {
          fill: '#FF6257',
          size: 11,
          family: STACK_MONO,
          anchor: 'end',
        })
      );
      parts.push(
        toolGlyph(options.tool.glyphName, 'compact', {
          size: 13,
          ink: '#ECECEE',
          accent: '#FF6257',
        }).replace('<svg ', `<svg x="${(width - 13 - labelW - 6 - 13).toFixed(1)}" y="${(cy - 6.5).toFixed(1)}" `)
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
 * The per-tool default deck strings — EN drafts for the ×6 pass (the doc's
 * four verbatim + five authored). The first card strings this worker owns
 * that describe tools rather than data.
 */
export const DEFAULT_DECK: Record<
  string,
  { glyphName: ToolGlyphName; label: string; name: string; sub: string }
> = {
  harmony: {
    glyphName: 'harmony',
    label: '/HARMONY',
    name: 'Colour Harmony',
    sub: 'Build a palette around any dye. Six harmony types, real dyes only.',
  },
  gradient: {
    glyphName: 'gradient',
    label: '/GRADIENT',
    name: 'Gradient Builder',
    sub: 'Step between two dyes — every stop is a dye you can buy.',
  },
  mixer: {
    glyphName: 'mixer',
    label: '/MIXER',
    name: 'Dye Mixer',
    sub: 'Blend two dyes and find the closest buyable match.',
  },
  swatch: {
    glyphName: 'swatch',
    label: '/SWATCH',
    name: 'Swatch Matcher',
    sub: 'Load a character file and match every colour on it to a dye.',
  },
  comparison: {
    glyphName: 'comparison',
    label: '/COMPARISON',
    name: 'Dye Comparison',
    sub: 'Set up to four dyes side by side and measure every pair.',
  },
  accessibility: {
    glyphName: 'accessibility',
    label: '/A11Y',
    name: 'Accessibility Checker',
    sub: 'See your dyes through four colour-vision lenses.',
  },
  extractor: {
    glyphName: 'extractor',
    label: '/EXTRACTOR',
    name: 'Palette Extractor',
    sub: 'Pull the palette from any image and match every colour to a buyable dye.',
  },
  presets: {
    glyphName: 'presets',
    label: '/PRESETS',
    name: 'Community Presets',
    sub: 'Curated palettes, ready to wear.',
  },
  budget: {
    glyphName: 'budget',
    label: '/BUDGET',
    name: 'Budget',
    sub: 'The cheapest dye near the one you want, priced from the market board.',
  },
};
