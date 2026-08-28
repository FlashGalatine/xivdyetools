/**
 * The 15E Band frame — CONFIRMED for all nine tools.
 *
 * Colour edge to edge, data written into it: no card, no border, no content
 * area — vertical bands fill the field, hierarchy is proportion (base 2× a
 * match; only Extractor's share and Mixer's ratio are genuinely
 * proportional — never claim proportion where it is decoration).
 *
 * The chrome is the suite's four-zone card, shared verbatim with the 2a
 * default cards (`cardHeader` / `cardFooter` below are the single source):
 *
 *   30px header   mark + wordmark left · tool glyph + tool tag right
 *   band field    flex by `grow`; role top, name + tag bottom
 *   deck          DISCORD ONLY — one headline line, dropped on X
 *   26px footer   path left (never the query string) · verdict right
 *
 * One structural variant: a horizontal source strip at the top of a band
 * (as designed above as perceived · extracted pixel above matched dye · mix
 * above buyable). One mechanism, never three special cases. Its height is a
 * proportion of the field, so X takes ×0.66 of the Discord value.
 *
 * Two frames, and the reason is X, not Discord: summary_large_image crops
 * non-2:1, so X gets 400×210 — the deck drops and the load-bearing headline
 * moves to the footer's right slot, but the IN-BAND CONTENT IS UNCHANGED
 * (only Extractor's names yield, its narrowest band being under the floor).
 * Discord honours the real aspect and gets the bot's settled 400×350. Both
 * raster ×3 — 1200×630 and 1200×1050 — and og:image:width/height state the
 * RASTER size.
 *
 * Dark only (console theme), square corners (the platform rounds the frame),
 * 11px type floor, Fragment Mono for values, band cap 5 (comfortable 4 — R1
 * on a second surface; overflow goes to the embed text, never a narrower
 * band).
 *
 * @module services/svg/band
 */

import { escapeXml, estimateTextWidth, GLYPH_ACCENT_LIGHT } from '@xivdyetools/svg';
import { GROUND, MARK_STRIPES, STACKS } from './tokens';

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

/**
 * The shared chrome. Both card families draw these exact zones — a band card
 * and a default card at the same frame emit byte-identical header markup.
 */
export const HEADER_H = 30;
export const FOOTER_H = 26;
/** Discord's one-line deck. X drops it; the headline moves to footer-right. */
export const DECK_H = 36;

/**
 * The structural source strip keeps its PROPORTION of the shorter X field
 * rather than its absolute height, so the split still reads as annotation
 * and not as a second row of bands.
 */
const X_STRIP_SCALE = 0.66;

/** Discord source-strip height → the X value. */
export function xStrip(discordHeight: number): number {
  return Math.round(discordHeight * X_STRIP_SCALE);
}

export const RULE = 'rgba(255,255,255,0.07)';
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

/** The six stripes' x / width on the 48-grid, in MARK_STRIPES order. */
const MARK_STRIPE_GEOMETRY: ReadonlyArray<readonly [number, number]> = [
  [8, 6],
  [14, 6],
  [20, 5],
  [25, 5],
  [30, 5],
  [35, 6],
];

/** The reduced app mark at `size` px, top-left at (x, y). */
export function ogMark(x: number, y: number, size: number): string {
  const id = `ogm${markUid++}`;
  const s = size / 48;
  return (
    `<g transform="translate(${x},${y}) scale(${s})">` +
    `<defs><clipPath id="${id}b"><path d="M 10 17 C 11 30 13 39.5 15.5 42.5 C 18 45 30 45 32.5 42.5 C 35 39.5 37 30 38 17 Z"/></clipPath></defs>` +
    `<rect width="48" height="48" rx="11" fill="${GLYPH_ACCENT_LIGHT}"/>` +
    `<path d="M 12 16 C 13 5 35 5 36 16" fill="none" stroke="#9BA1AD" stroke-width="2.4" stroke-linecap="round"/>` +
    `<g clip-path="url(#${id}b)">` +
    MARK_STRIPES.map(
      (hex, i) =>
        `<rect x="${MARK_STRIPE_GEOMETRY[i][0]}" y="16" width="${MARK_STRIPE_GEOMETRY[i][1]}" height="30" fill="${hex}"/>`,
    ).join('') +
    `</g>` +
    `<path d="M 10 17 C 11 30 13 39.5 15.5 42.5 C 18 45 30 45 32.5 42.5 C 35 39.5 37 30 38 17 Z" fill="none" stroke="#C8CCD5" stroke-width="1.4"/>` +
    `<ellipse cx="24" cy="17" rx="14" ry="5.4" fill="#FBFBFC"/>` +
    `<ellipse cx="24" cy="17" rx="9.6" ry="3.4" fill="#8E4EC6"/>` +
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
  /** Name type size — Harmony's base 17 / matches 12; the other eight 11.5 */
  nameSize?: number;
  /**
   * The structural variant: a horizontal source strip at the band top
   * (as designed / extracted pixel / the mix). Discord heights are 46–54px;
   * pass `xStrip(n)` on the X frame.
   */
  src?: { hex: string; height: number };
}

export interface BandCardOptions {
  bands: BandEntry[];
  /** Localized tool tag beside the glyph (HARMONY / ハーモニー / 色覚 …) */
  toolTag: string;
  /** Rendered tool glyph markup (13px, ink #ECECEE, accent #FF6257) or null */
  toolGlyph?: string | null;
  /**
   * Footer left — the PATH ONLY, never the scheme and never the query string.
   * One resvg text node has no wrapping, so a query string clips at the frame
   * edge rather than reflowing.
   */
  path: string;
  /**
   * Footer right. The method tag on Discord; on X the card's load-bearing
   * headline moves here (Budget's verdict, the closest Δ, the lens, the
   * preset name) because the deck that carried it has dropped.
   */
  footRight?: string | null;
  /** Footer-right face — mono for a method tag, body for a yielding verdict */
  footRightFont?: 'mono' | 'body';
  /** DISCORD ONLY: the one-line deck headline. Ignored on the X frame. */
  deck?: string | null;
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
  o: {
    fill: string;
    size: number;
    font: 'mono' | 'body' | 'display';
    weight?: number;
    spacing?: number;
    anchor?: string;
  },
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

/**
 * FINDING-005 (2026-08-21 audit): every text helper below is linear in the
 * input. `fit` and `wrapName` used to re-measure the remaining string on every
 * trimmed character (quadratic / cubic), so a 16 KB not-found label burned
 * minutes of CPU. `estimateTextWidth` is additive per code point, so a single
 * forward pass with an accumulator is exact.
 */

/** Longest name any card will ever wrap; anything longer is clipped first. */
const MAX_NAME_CHARS = 512;

/** Longest prefix of `chars` (code points) whose width + `reserve` fits in `maxPx`. */
function prefixThatFits(chars: string[], px: number, maxPx: number, reserve: number): number {
  let acc = 0;
  let keep = 0;
  for (let i = 0; i < chars.length; i++) {
    const w = estimateTextWidth(chars[i], px);
    if (acc + w + reserve > maxPx) break;
    acc += w;
    keep = i + 1;
  }
  return keep;
}

/** Ellipsise to a pixel budget (CJK-aware via estimateTextWidth). Linear. */
function fit(content: string, maxPx: number, size: number, mono = false): string {
  const px = size * (mono ? 0.62 : 0.54);
  if (estimateTextWidth(content, px) <= maxPx) return content;
  const chars = [...content];
  const keep = Math.max(1, prefixThatFits(chars, px, maxPx, estimateTextWidth('…', px)));
  return chars.slice(0, keep).join('').trimEnd() + '…';
}

/** CJK by codepoint, never by "has no spaces" — so is `Rußschwarzer`. */
const CJK_RE = /[　-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

/**
 * Wrap a NAME to a pixel budget. The standing rule is hyphenate, never
 * truncate — a character cap is an EN-width heuristic that decapitates German
 * compounds, and a vertical band is exactly where a long dye name has nowhere
 * else to go.
 *
 * Latin wraps on spaces and, when a single word is still wider than the band
 * (`Johannisbeerenvioletter` in a 67px column), breaks it with a hyphen — the
 * soft-hyphen pass the design asks of resvg, which has no `hyphens: auto`.
 * CJK wraps per character; `estimateTextWidth` already knows a CJK glyph is a
 * full em. Only the final line can still overflow, and it ellipsises.
 */
function wrapName(rawContent: string, maxPx: number, size: number, maxLines: number): string[] {
  const px = size * 0.54;
  const w = (s: string): number => estimateTextWidth(s, px);
  // FINDING-005: clip absurd inputs before doing any work — no name is this long
  const content = [...rawContent].slice(0, MAX_NAME_CHARS).join('');
  if (w(content) <= maxPx) return [content];

  const cjk = CJK_RE.test(content);
  const hyphenW = w('-');

  // Break any over-wide word into hyphenated fragments that do fit (linear:
  // one forward pass per fragment, never re-measuring the remainder)
  const atoms: string[] = [];
  for (const word of cjk ? [...content] : content.split(' ')) {
    if (cjk || w(word) <= maxPx) {
      atoms.push(word);
      continue;
    }
    let rest = [...word];
    while (w(rest.join('')) > maxPx) {
      const cut = Math.min(rest.length - 1, prefixThatFits(rest, px, maxPx, hyphenW));
      if (cut <= 2) break;
      atoms.push(`${rest.slice(0, cut).join('')}-`);
      rest = rest.slice(cut);
    }
    atoms.push(rest.join(''));
  }

  const lines: string[] = [];
  let line = '';
  for (const atom of atoms) {
    // A fragment we just hyphenated must not take a space before the next one
    const glue = !line || cjk || line.endsWith('-') ? '' : ' ';
    const next = line + glue + atom;
    if (w(next) <= maxPx || !line) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      // No room for another line: the current one absorbs the remainder
      line = next;
      continue;
    }
    lines.push(line);
    line = atom;
  }
  lines.push(line);

  return lines.slice(0, maxLines).map((l) => fit(l, maxPx, size));
}

// ============================================================================
// The shared chrome — one source for band cards and default cards alike
// ============================================================================

/**
 * The 30px header: mark + wordmark left, tool glyph + tool tag right, and the
 * hairline rule under it. Identical on both frames and on both card families.
 */
export function cardHeader(
  width: number,
  o: { toolTag?: string | null; toolGlyph?: string | null },
): string {
  const parts: string[] = [ogMark(13, 6.5, 17)];
  const wordmark = 'XIV DYE TOOLS';
  parts.push(
    bandText(37, 19, wordmark, {
      fill: WORDMARK_INK,
      size: 11,
      font: 'display',
      weight: 600,
      spacing: 1.3,
    }),
  );

  if (o.toolTag) {
    // The tag yields to the wordmark, never the other way round — measure the
    // room left after the wordmark and the glyph before drawing it.
    const wordmarkRight = 37 + estimateTextWidth(wordmark, 11 * 0.62) + wordmark.length * 1.3;
    const glyphW = o.toolGlyph ? 13 + 6 : 0;
    const tag = fit(o.toolTag, width - 13 - glyphW - wordmarkRight - 10, 11, true);
    const tagW = estimateTextWidth(tag, 11 * 0.62) + tag.length * 0.5;
    parts.push(
      bandText(width - 13, 19, tag, {
        fill: TAG_INK,
        size: 11,
        font: 'mono',
        spacing: 0.5,
        anchor: 'end',
      }),
    );
    if (o.toolGlyph) {
      parts.push(
        o.toolGlyph.replace(
          '<svg ',
          `<svg x="${(width - 13 - tagW - 6 - 13).toFixed(1)}" y="8.5" `,
        ),
      );
    }
  }

  parts.push(
    `<line x1="0" y1="${HEADER_H}" x2="${width}" y2="${HEADER_H}" stroke="${RULE}" stroke-width="1"/>`,
  );
  return parts.join('');
}

/**
 * The 26px footer: path left, verdict or method tag right. The path is the one
 * thing a reader can act on, so it never yields — the right slot ellipsises
 * into whatever room is left.
 */
export function cardFooter(
  width: number,
  height: number,
  o: { path: string; right?: string | null; rightFont?: 'mono' | 'body' },
): string {
  const footTop = height - FOOTER_H;
  const parts: string[] = [
    `<line x1="0" y1="${footTop}" x2="${width}" y2="${footTop}" stroke="${RULE}" stroke-width="1"/>`,
    bandText(13, footTop + 17, o.path, { fill: SUB_INK, size: 11, font: 'mono' }),
  ];
  if (o.right) {
    const mono = (o.rightFont ?? 'mono') === 'mono';
    const budget = width - 26 - estimateTextWidth(o.path, 11 * 0.62) - 10;
    parts.push(
      bandText(width - 13, footTop + 17, fit(o.right, budget, 11, mono), {
        fill: SUB_INK,
        size: 11,
        font: mono ? 'mono' : 'body',
        anchor: 'end',
      }),
    );
  }
  return parts.join('');
}

// ============================================================================
// Generator
// ============================================================================

/** Generate the 15E band card SVG (design-grid size; raster ×3 downstream). */
export function generateBandCard(options: BandCardOptions): string {
  const frame = options.frame ?? 'discord';
  const { width, height } = BAND_FRAMES[frame];

  // The deck is a Discord-only zone. On X it drops and its headline is
  // expected in `footRight` — the degrade rule, one rule for all nine.
  const deck = frame === 'discord' ? (options.deck ?? null) : null;

  const fieldTop = HEADER_H;
  const fieldBottom = height - FOOTER_H - (deck ? DECK_H : 0);
  const fieldH = fieldBottom - fieldTop;

  const bands = options.bands.slice(0, BAND_CAP);
  const totalGrow = bands.reduce((sum, b) => sum + (b.grow ?? 1), 0) || 1;

  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${GROUND}"/>`);

  // ---- The band field. One code path: X differs only by how tall it is.
  let x = 0;
  for (const band of bands) {
    const w = ((band.grow ?? 1) / totalGrow) * width;
    const ink = bandInk(band.hex);
    parts.push(
      `<rect x="${x.toFixed(2)}" y="${fieldTop}" width="${(w + 0.5).toFixed(2)}" height="${fieldH}" fill="${escapeXml(band.hex)}"/>`,
    );

    // The structural variant: source strip at the band top
    let topY = fieldTop;
    if (band.src) {
      parts.push(
        `<rect x="${x.toFixed(2)}" y="${fieldTop}" width="${(w + 0.5).toFixed(2)}" height="${band.src.height}" fill="${escapeXml(band.src.hex)}"/>`,
      );
      topY = fieldTop + band.src.height;
    }

    const pad = 10;
    const innerW = w - pad * 2;

    if (band.role) {
      parts.push(
        bandText(x + pad, topY + 21, fit(band.role, innerW, 11, true), {
          fill: ink.onDim,
          size: 11,
          font: 'mono',
          spacing: 0.6,
        }),
      );
    }

    // Bottom stack: name / value / tag (drawn baseline rhythm, climbing)
    const nameSize = band.nameSize ?? 11.5;
    let baseline = fieldBottom - 12;
    if (band.tag) {
      parts.push(
        bandText(x + pad, baseline, fit(band.tag, innerW, 11, true), {
          fill: ink.onDim,
          size: 11,
          font: 'mono',
        }),
      );
      baseline -= 15;
    }
    if (band.value) {
      parts.push(
        bandText(x + pad, baseline, fit(band.value, innerW, 11, true), {
          fill: ink.onDim,
          size: 11,
          font: 'mono',
        }),
      );
      baseline -= 15;
    }
    if (band.name) {
      // Names wrap rather than truncate, climbing from the bottom stack. The
      // room above is whatever the role line does not claim.
      const lineH = Math.round(nameSize * 1.2);
      const roomPx = baseline - (topY + (band.role ? 27 : 6));
      const maxLines = Math.max(1, Math.min(3, Math.floor(roomPx / lineH)));
      const lines = wrapName(band.name, innerW, nameSize, maxLines);
      lines.forEach((line, i) => {
        parts.push(
          bandText(x + pad, baseline - (lines.length - 1 - i) * lineH, line, {
            fill: ink.on,
            size: nameSize,
            font: 'body',
            weight: 600,
          }),
        );
      });
    }
    x += w;
  }

  // ---- Chrome
  parts.push(cardHeader(width, { toolTag: options.toolTag, toolGlyph: options.toolGlyph }));

  if (deck) {
    const deckTop = height - FOOTER_H - DECK_H;
    parts.push(
      `<line x1="0" y1="${deckTop}" x2="${width}" y2="${deckTop}" stroke="${RULE}" stroke-width="1"/>`,
    );
    parts.push(
      bandText(13, deckTop + 23, fit(deck, width - 26, 14.5), {
        fill: NAME_INK,
        size: 14.5,
        font: 'body',
        weight: 600,
      }),
    );
  }

  parts.push(
    cardFooter(width, height, {
      path: options.path,
      right: options.footRight,
      rightFont: options.footRightFont,
    }),
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    parts.join('') +
    `</svg>`
  );
}
