/**
 * The 15E Band frame — CONFIRMED for all nine tools (Turn 15 + Turn 19).
 *
 * Colour edge to edge, data written into it: no card, no border, no content
 * area — vertical bands fill the frame, hierarchy is proportion (base 2× a
 * match; only Extractor's share and Mixer's ratio are genuinely
 * proportional — never claim proportion where it is decoration). The chrome
 * is ONE 34px bottom strip: reduced bucket mark + wordmark + tool glyph
 * (redundancy, not replacement — an unfurl has no embed title) + tool tag.
 * The URL is NOT in the strip — the embed above the picture carries it.
 *
 * One structural variant: a horizontal source strip at the top of a band
 * (as designed above as perceived · extracted pixel above matched dye · mix
 * above buyable). One mechanism, never three special cases.
 *
 * Two frames, and the reason is X, not Discord: summary_large_image crops
 * non-2:1, so X gets 400×210 (names drop to the strip); Discord honours the
 * real aspect and gets the bot's settled 400×350. Both raster ×3 — 1200×630
 * and 1200×1050 — and og:image:width/height state the RASTER size.
 *
 * Dark only (console theme), square corners (the platform rounds the frame),
 * 11px type floor, Fragment Mono for values, band cap 5 (comfortable 4 — R1
 * on a second surface; overflow goes to the embed text, never a narrower
 * band).
 *
 * @module services/svg/band
 */

import { escapeXml, estimateTextWidth } from './base';

/**
 * Font stacks with the JP subset ahead of SC (Phase 0.3 bundled
 * NotoSansJP-Subset precisely so JA stops rendering in Chinese letterforms) —
 * mirrors the bot frame system's stacks.
 */
const STACKS = {
  mono: 'Fragment Mono, Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  body: 'Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  display: 'Space Grotesk, Noto Sans JP, Noto Sans SC, Noto Sans KR',
} as const;

// ============================================================================
// Frames
// ============================================================================

export type BandFrame = 'discord' | 'x';

/** Design-grid sizes; consumers raster ×3. */
export const BAND_FRAMES: Record<BandFrame, { width: number; height: number; scale: number }> = {
  discord: { width: 400, height: 350, scale: 3 },
  x: { width: 400, height: 210, scale: 3 },
};

/** R1 on a second surface: five bands at full size, four is the comfort line. */
export const BAND_CAP = 5;

const GROUND = '#0B0B0C';
const STRIP_H_DISCORD = 34;
const STRIP_H_X = 60;
const WORDMARK_INK = '#9C9CA2';
const TAG_INK = '#FF6257';
const SUB_INK = '#86868C';
const NAME_INK = '#ECECEE';

// ============================================================================
// Band ink law (deliberately NOT the package's getContrastTextColor)
// ============================================================================

function relLum(hex: string): number {
  const lin = (v: number): number => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Pick by MEASURED contrast against both candidates rather than a luminance
 * cut — a mid-tone sits just under any fixed threshold and gets the worse of
 * the two.
 */
function preferDark(hex: string): boolean {
  const l = relLum(hex);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05);
}

/** Band ink: near-black or white, whichever measures better. */
export function bandInk(hex: string): { on: string; onDim: string } {
  return preferDark(hex)
    ? { on: '#0A0A0A', onDim: 'rgba(10,10,10,0.72)' }
    : { on: '#FFFFFF', onDim: 'rgba(255,255,255,0.78)' };
}

// ============================================================================
// The reduced bucket mark (48-grid — verbatim from the OG doc's #ogmark)
// ============================================================================

let markUid = 0;

/** The reduced app mark at `size` px, top-left at (x, y). */
export function ogMark(x: number, y: number, size: number): string {
  const id = `ogm${markUid++}`;
  const s = size / 48;
  return (
    `<g transform="translate(${x},${y}) scale(${s})">` +
    `<defs><clipPath id="${id}b"><path d="M 10 17 C 11 30 13 39.5 15.5 42.5 C 18 45 30 45 32.5 42.5 C 35 39.5 37 30 38 17 Z"/></clipPath></defs>` +
    `<rect width="48" height="48" rx="11" fill="#CE2222"/>` +
    `<path d="M 12 16 C 13 5 35 5 36 16" fill="none" stroke="#9BA1AD" stroke-width="2.4" stroke-linecap="round"/>` +
    `<g clip-path="url(#${id}b)">` +
    `<rect x="8" y="16" width="6" height="30" fill="#E5484D"/>` +
    `<rect x="14" y="16" width="6" height="30" fill="#F76B15"/>` +
    `<rect x="20" y="16" width="5" height="30" fill="#FFC53D"/>` +
    `<rect x="25" y="16" width="5" height="30" fill="#30A46C"/>` +
    `<rect x="30" y="16" width="4" height="30" fill="#0091FF"/>` +
    `<rect x="34" y="16" width="4" height="30" fill="#8E4EC6"/>` +
    `</g>` +
    `<ellipse cx="24" cy="17" rx="14.5" ry="6" fill="#FBFBFC"/>` +
    `<ellipse cx="24" cy="17" rx="12" ry="4.6" fill="#E5484D"/>` +
    `</g>`
  );
}

// ============================================================================
// Types
// ============================================================================

export interface BandEntry {
  /** The band body colour (the dye — or the perceived colour) */
  hex: string;
  /** Small all-caps label at the band top (BASE / +120° / TARGET / 31% …) */
  role?: string;
  /** Localized dye name (or the hex itself for nameless targets) */
  name?: string;
  /** Mono value line under the name (usually the hex) */
  value?: string;
  /** Mono tag line (Δ, #stain, price …) */
  tag?: string;
  /** Flex weight — base 2 / match 1; extractor uses real shares */
  grow?: number;
  /** Name type size — base 17, others 12 (the drawn sizes) */
  nameSize?: number;
  /**
   * The structural variant: a horizontal source strip at the band top
   * (as designed / extracted pixel / the mix). Height per tool: 46–54px.
   */
  src?: { hex: string; height: number };
}

export interface BandCardOptions {
  bands: BandEntry[];
  /** Localized tool tag beside the glyph (HARMONY / ハーモニー …) */
  toolTag: string;
  /** Rendered tool glyph markup (13px, ink #ECECEE, accent #FF6257) or null */
  toolGlyph?: string | null;
  /** Right side of the Discord strip (e.g. "TETRADIC ON #43") */
  subLine?: string;
  /** X frame: the one-line summary that replaces the band names */
  bandLine?: string;
  /** X frame: "xivdyetools.app/… · ΔE2000" under the bandLine */
  urlLine?: string;
  frame?: BandFrame;
}

// ============================================================================
// Internals
// ============================================================================

function fontAttr(font: 'mono' | 'body' | 'display'): string {
  return `font-family="${STACKS[font]}"`;
}

function bandText(
  x: number,
  y: number,
  content: string,
  o: { fill: string; size: number; font: 'mono' | 'body' | 'display'; weight?: number; spacing?: number; anchor?: string }
): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `fill="${escapeXml(o.fill)}"`,
    `font-size="${o.size}"`,
    fontAttr(o.font),
  ];
  if (o.weight) attrs.push(`font-weight="${o.weight}"`);
  if (o.spacing) attrs.push(`letter-spacing="${o.spacing}"`);
  if (o.anchor) attrs.push(`text-anchor="${o.anchor}"`);
  return `<text ${attrs.join(' ')}>${escapeXml(content)}</text>`;
}

/** Ellipsise to a pixel budget (CJK-aware via estimateTextWidth). */
function fit(content: string, maxPx: number, size: number, mono = false): string {
  const w = (s: string): number => estimateTextWidth(s, size * (mono ? 0.62 : 0.54));
  if (w(content) <= maxPx) return content;
  let out = content;
  while (out.length > 1 && w(out + '…') > maxPx) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

// ============================================================================
// Generator
// ============================================================================

/** Generate the 15E band card SVG (design-grid size; raster ×3 downstream). */
export function generateBandCard(options: BandCardOptions): string {
  const frame = options.frame ?? 'discord';
  const { width, height } = BAND_FRAMES[frame];
  const stripH = frame === 'discord' ? STRIP_H_DISCORD : STRIP_H_X;
  const bandsH = height - stripH;
  const bands = options.bands.slice(0, BAND_CAP);
  const totalGrow = bands.reduce((sum, b) => sum + (b.grow ?? 1), 0) || 1;

  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${GROUND}"/>`);

  // Bands
  let x = 0;
  for (const band of bands) {
    const w = ((band.grow ?? 1) / totalGrow) * width;
    const ink = bandInk(band.hex);
    parts.push(
      `<rect x="${x.toFixed(2)}" y="0" width="${(w + 0.5).toFixed(2)}" height="${bandsH}" fill="${escapeXml(band.hex)}"/>`
    );

    // The structural variant: source strip at the band top
    let topY = 0;
    if (band.src) {
      parts.push(
        `<rect x="${x.toFixed(2)}" y="0" width="${(w + 0.5).toFixed(2)}" height="${band.src.height}" fill="${escapeXml(band.src.hex)}"/>`
      );
      topY = band.src.height;
    }

    const pad = 10;
    const innerW = w - pad * 2;
    if (frame === 'discord') {
      if (band.role) {
        parts.push(
          bandText(x + pad, topY + 21, fit(band.role, innerW, 11, true), {
            fill: ink.onDim,
            size: 11,
            font: 'mono',
            spacing: 0.6,
          })
        );
      }
      // Bottom stack: name / value / tag (gap 4, drawn baseline rhythm)
      const nameSize = band.nameSize ?? 12;
      let baseline = bandsH - 12;
      if (band.tag) {
        parts.push(
          bandText(x + pad, baseline, fit(band.tag, innerW, 11, true), {
            fill: ink.onDim,
            size: 11,
            font: 'mono',
          })
        );
        baseline -= 15;
      }
      if (band.value) {
        parts.push(
          bandText(x + pad, baseline, fit(band.value, innerW, 11, true), {
            fill: ink.onDim,
            size: 11,
            font: 'mono',
          })
        );
        baseline -= 15;
      }
      if (band.name) {
        parts.push(
          bandText(x + pad, baseline, fit(band.name, innerW, nameSize), {
            fill: ink.on,
            size: nameSize,
            font: 'body',
            weight: 600,
          })
        );
      }
    } else {
      // X frame: only the tag survives on the band; names drop to the strip
      if (band.tag) {
        parts.push(
          bandText(x + pad, bandsH - 10, fit(band.tag, innerW, 11, true), {
            fill: ink.onDim,
            size: 11,
            font: 'mono',
          })
        );
      }
    }
    x += w;
  }

  // The one chrome strip
  const stripTop = bandsH;
  parts.push(`<rect x="0" y="${stripTop}" width="${width}" height="${stripH}" fill="${GROUND}"/>`);

  if (frame === 'discord') {
    const cy = stripTop + stripH / 2;
    let cx = 13;
    parts.push(ogMark(cx, cy - 8.5, 17));
    cx += 17 + 7;
    const wordmark = 'XIV DYE TOOLS';
    parts.push(
      bandText(cx, cy + 4, wordmark, {
        fill: WORDMARK_INK,
        size: 11,
        font: 'display',
        weight: 600,
        spacing: 1.3,
      })
    );
    cx += estimateTextWidth(wordmark, 11 * 0.62) + wordmark.length * 1.3 + 9;
    if (options.toolGlyph) {
      parts.push(options.toolGlyph.replace('<svg ', `<svg x="${cx.toFixed(1)}" y="${(cy - 6.5).toFixed(1)}" `));
      cx += 13 + 6;
    }
    parts.push(
      bandText(cx, cy + 4, options.toolTag, { fill: TAG_INK, size: 11, font: 'mono' })
    );
    if (options.subLine) {
      parts.push(
        bandText(width - 13, cy + 4, fit(options.subLine, 170, 11, true), {
          fill: SUB_INK,
          size: 11,
          font: 'mono',
          anchor: 'end',
        })
      );
    }
  } else {
    const cy = stripTop + stripH / 2;
    let cx = 13;
    parts.push(ogMark(cx, cy - 9.5, 19));
    cx += 19 + 9;
    const tagW = estimateTextWidth(options.toolTag, 11 * 0.62) + 6 + 13;
    const textMax = width - cx - 13 - tagW - 10;
    if (options.bandLine) {
      parts.push(
        bandText(cx, cy - 2, fit(options.bandLine, textMax, 14), {
          fill: NAME_INK,
          size: 14,
          font: 'body',
          weight: 600,
        })
      );
    }
    if (options.urlLine) {
      parts.push(
        bandText(cx, cy + 14, fit(options.urlLine, textMax, 11, true), {
          fill: SUB_INK,
          size: 11,
          font: 'mono',
        })
      );
    }
    let rx = width - 13 - estimateTextWidth(options.toolTag, 11 * 0.62);
    parts.push(bandText(width - 13, cy + 4, options.toolTag, { fill: TAG_INK, size: 11, font: 'mono', anchor: 'end' }));
    if (options.toolGlyph) {
      rx -= 6 + 13;
      parts.push(options.toolGlyph.replace('<svg ', `<svg x="${rx.toFixed(1)}" y="${(cy - 6.5).toFixed(1)}" `));
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    parts.join('') +
    `</svg>`
  );
}
