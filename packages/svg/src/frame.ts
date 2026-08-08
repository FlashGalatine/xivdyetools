/**
 * Bot card frame system (5.0) — the Turn-11 vocabulary.
 *
 * The canvas width IS the display width: cards are 400 px wide, rastered at
 * 2× by the consumer, and never taller than 350 px (Discord's box contracts
 * horizontally past that). Height grows with the result and stops at the
 * ceiling — a shorter result is a shorter card.
 *
 * Type floor: 11 px all-caps mono labels · 13 px values · 16 px names.
 * Nothing below 11, ever.
 *
 * R1 Cap (Turn 12): every list graphic holds five rows at full size; the
 * tail (only when more was asked for) is a swatch strip and a count in the
 * embed. Harmony's 55 px slot rows hold three.
 *
 * @module frame
 */

import { classifyBandTier } from '@xivdyetools/core';
import { escapeXml, estimateTextWidth, num } from './base.js';

// ============================================================================
// Card dimensions & type scale
// ============================================================================

/** Cards are drawn at the width Discord displays them. */
export const CARD_WIDTH = 400;

/** The hard ceiling — past 350 the embed box contracts horizontally. */
export const CARD_MAX_HEIGHT = 350;

/** Type floor (px): all-caps mono labels / values / names. */
export const CARD_TYPE = { label: 11, value: 13, name: 16 } as const;

/** R1 Cap: rows at full size for every list graphic. */
export const ROW_CAP = 5;

/** Harmony's taller 55 px slot rows hold three before the tail strip. */
export const HARMONY_ROW_CAP = 3;

// ============================================================================
// Card themes
// ============================================================================

export interface CardTheme {
  mode: 'dark' | 'light';
  /** Card surface */
  surface: string;
  /** Inset 1 px border colour */
  border: string;
  /** Command pill on the chrome ground */
  pillBg: string;
  pillInk: string;
  /** Names (Onest/Space Grotesk 600) */
  name: string;
  /** Mono values (13 px) */
  value: string;
  /** Secondary mono values */
  subValue: string;
  /** All-caps mono labels (11 px) */
  label: string;
  /** Dashed rules */
  dashed: string;
  /** Solid hairline rules */
  rule: string;
  /** Accent-coloured text (harmony type, headline hex) */
  accentText: string;
  /** The glyph's filled chip inside chrome-ground pills */
  glyphAccent: string;
  /** Swatch inset ring (legible on any dye colour) */
  swatchRing: string;
  /** Tier ramp: exact/close/loose/far */
  tiers: readonly [string, string, string, string];
}

export const CARD_DARK: CardTheme = {
  mode: 'dark',
  surface: '#17171A',
  border: 'rgba(255,255,255,0.07)',
  pillBg: 'rgba(255,255,255,0.06)',
  pillInk: '#9C9CA2',
  name: '#ECECEE',
  value: '#C6C6CA',
  subValue: '#9C9CA2',
  label: '#86868C',
  dashed: 'rgba(255,255,255,0.16)',
  rule: 'rgba(255,255,255,0.07)',
  accentText: '#FF6257',
  glyphAccent: '#FF6257',
  swatchRing: 'rgba(127,127,127,0.22)',
  tiers: ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'],
};

export const CARD_LIGHT: CardTheme = {
  mode: 'light',
  surface: '#FFFFFF',
  border: '#E4E4E7',
  pillBg: '#EBEBEE',
  pillInk: '#63636A',
  name: '#17181B',
  value: '#3E3E44',
  subValue: '#6B6B73',
  label: '#6B6B73',
  dashed: 'rgba(23,24,27,0.22)',
  rule: 'rgba(23,24,27,0.10)',
  accentText: '#B01C1C',
  glyphAccent: '#B01C1C',
  swatchRing: 'rgba(127,127,127,0.30)',
  tiers: ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'],
};

export function cardTheme(mode: 'dark' | 'light' | undefined): CardTheme {
  return mode === 'light' ? CARD_LIGHT : CARD_DARK;
}

// ============================================================================
// Text helpers
// ============================================================================

export interface CardTextOptions {
  fill: string;
  size: number;
  /** 'mono' | 'body' | 'display' — resolves the font stack incl. CJK fallback */
  font?: 'mono' | 'body' | 'display';
  weight?: number;
  letterSpacing?: number;
  anchor?: 'start' | 'middle' | 'end';
}

const FONT_STACKS = {
  mono: 'Fragment Mono, Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  body: 'Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  display: 'Space Grotesk, Noto Sans JP, Noto Sans SC, Noto Sans KR',
} as const;

/** Text element with the card font stacks (baseline-positioned). */
export function cardText(x: number, y: number, content: string, o: CardTextOptions): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `fill="${escapeXml(o.fill)}"`,
    `font-size="${o.size}"`,
    `font-family="${FONT_STACKS[o.font ?? 'mono']}"`,
  ];
  if (o.weight) attrs.push(`font-weight="${o.weight}"`);
  if (o.letterSpacing) attrs.push(`letter-spacing="${o.letterSpacing}"`);
  if (o.anchor) attrs.push(`text-anchor="${o.anchor}"`);
  return `<text ${attrs.join(' ')}>${escapeXml(content)}</text>`;
}

/** Approximate rendered width in px (CJK counts double via estimateTextWidth). */
export function textWidth(content: string, size: number, font: 'mono' | 'body' | 'display' = 'mono'): number {
  const factor = font === 'mono' ? 0.62 : font === 'display' ? 0.58 : 0.54;
  return estimateTextWidth(content, size * factor);
}

/** Ellipsise to a pixel budget (never a hard character count). */
export function fitText(
  content: string,
  maxPx: number,
  size: number,
  font: 'mono' | 'body' | 'display' = 'body'
): string {
  if (textWidth(content, size, font) <= maxPx) return content;
  let out = content;
  while (out.length > 1 && textWidth(out + '…', size, font) > maxPx) {
    out = out.slice(0, -1);
  }
  return out.trimEnd() + '…';
}

// ============================================================================
// Shell
// ============================================================================

/**
 * The card shell: rounded surface with the inset hairline border, wrapped in
 * an SVG document at 1× logical size (consumers raster at 2×).
 */
export function cardShell(height: number, theme: CardTheme, content: string): string {
  const h = Math.min(height, CARD_MAX_HEIGHT);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${h}" viewBox="0 0 ${CARD_WIDTH} ${h}">` +
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="${h}" rx="16" fill="${theme.surface}"/>` +
    `<rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${h - 1}" rx="15.5" fill="none" stroke="${escapeXml(theme.border)}" stroke-width="1"/>` +
    content +
    `</svg>`
  );
}

// ============================================================================
// Command chip (2A: the tool glyph rides inside the pill)
// ============================================================================

export interface CommandChipOptions {
  /**
   * Rendered glyph markup (a complete `<svg …>` string from the icon home,
   * sized 13) or null for a text-only pill.
   */
  glyph?: string | null;
  /**
   * On a dye-coloured ground the pill is a dark scrim and the glyph goes
   * mono (accent = ink) — #FF6257 is unpredictable against an arbitrary hue.
   */
  onDye?: boolean;
}

/** Inject x/y into a rendered glyph's opening `<svg` tag so it can be placed. */
export function placeGlyph(glyphSvg: string, x: number, y: number): string {
  return glyphSvg.replace('<svg ', `<svg x="${x}" y="${y}" `);
}

/**
 * The command pill. Returns markup plus its measured width so callers can
 * right-align or flow other header content beside it.
 */
export function commandChip(
  x: number,
  y: number,
  label: string,
  theme: CardTheme,
  options: CommandChipOptions = {}
): { svg: string; width: number; height: number } {
  const { glyph = null, onDye = false } = options;
  const padX = 8;
  const glyphSize = 13;
  const gap = 6;
  const chipH = 21;
  const labelW = Math.ceil(estimateTextWidth(label, CARD_TYPE.label * 0.62) + label.length * 1.1);
  const width = padX * 2 + (glyph ? glyphSize + gap : 0) + labelW;

  const bg = onDye ? 'rgba(0,0,0,0.34)' : theme.pillBg;
  const ink = onDye ? 'rgba(255,255,255,0.85)' : theme.pillInk;

  let svg = `<rect x="${x}" y="${y}" width="${width}" height="${chipH}" rx="6" fill="${escapeXml(bg)}"/>`;
  let tx = x + padX;
  if (glyph) {
    svg += placeGlyph(glyph, tx, y + (chipH - glyphSize) / 2);
    tx += glyphSize + gap;
  }
  svg += cardText(tx, y + 15, label, {
    fill: ink,
    size: CARD_TYPE.label,
    font: 'mono',
    letterSpacing: 1.1,
  });
  return { svg, width, height: chipH };
}

// ============================================================================
// The mark (official app icon + domain, bottom-right, never centred)
// ============================================================================

let markUid = 0;

/**
 * The official app icon — the full paint bucket on the #CE2222 tile, geometry
 * verbatim from the design project's `#botmark` symbol (512 grid). Inlined
 * per placement (no <symbol>/<use>; clip ids are unique per render).
 */
export function appIcon(x: number, y: number, size: number): string {
  const id = `xdtm${markUid++}`;
  const s = size / 512;
  const swirl =
    `<ellipse cx="256" cy="176" rx="132" ry="62" fill="#E5484D"/>` +
    `<g transform="translate(256,176) scale(1,0.47)">` +
    ['#8E4EC6', '#0091FF', '#30A46C', '#FFC53D', '#F76B15', '#E5484D']
      .map(
        (c, i) =>
          `<path d="M 12 0 Q 24 8 18 18 T 0 40 T -39 39 T -70 0 T -59 -59 T 0 -99 T 80 -80 T 128 0" fill="none" stroke="${c}" stroke-width="32" stroke-linecap="round" transform="rotate(${i * 60})"/>`
      )
      .join('') +
    `<circle cx="0" cy="0" r="17" fill="#8E4EC6"/>` +
    `<path d="M -108 -34 C -72 -76 22 -86 76 -56 C 22 -64 -58 -54 -94 -14 Z" fill="#FFFFFF" opacity="0.16"/>` +
    `</g>`;
  return (
    `<g transform="translate(${x},${y}) scale(${s})">` +
    `<defs>` +
    `<clipPath id="${id}p"><ellipse cx="256" cy="176" rx="132" ry="62"/></clipPath>` +
    `<clipPath id="${id}f"><rect x="100" y="196" width="312" height="130"/></clipPath>` +
    `<clipPath id="${id}s"><path d="M 140 222 C 180 246 216 250 256 250 C 296 250 336 244 376 219 C 374 230 372 236 368 242 C 360 250 352 255 346 257 L 346 288 C 346 302 318 302 318 288 L 318 259 C 304 261 290 262 274 262 L 274 316 C 274 332 244 332 244 316 L 244 262 C 228 261 212 258 200 255 L 200 276 C 200 290 174 290 174 276 L 174 249 C 160 242 148 233 140 222 Z"/></clipPath>` +
    `</defs>` +
    `<rect width="512" height="512" rx="112" fill="#CE2222"/>` +
    `<ellipse cx="256" cy="428" rx="126" ry="20" fill="#000000" opacity="0.20"/>` +
    `<path d="M 114 158 C 132 40 380 40 398 158" fill="none" stroke="#9BA1AD" stroke-width="14" stroke-linecap="round"/>` +
    `<path d="M 108 176 C 112 270 122 356 140 402 C 162 436 350 436 372 402 C 390 356 400 270 404 176 C 404 222 338 250 256 250 C 174 250 108 222 108 176 Z" fill="#EEEFF3" stroke="#C8CCD5" stroke-width="3"/>` +
    `<path d="M 140 402 C 162 436 350 436 372 402 C 370 396 368 390 366 386 C 344 412 168 412 146 386 C 144 390 142 396 140 402 Z" fill="#000000" opacity="0.07"/>` +
    `<path d="M 108 176 C 108 222 174 250 256 250 C 338 250 404 222 404 176 C 402 192 396 206 388 218 C 354 250 308 268 256 268 C 204 268 158 250 124 218 C 116 206 110 192 108 176 Z" fill="#000000" opacity="0.06"/>` +
    `<g clip-path="url(#${id}s)">` +
    `<rect x="130" y="205" width="46" height="140" fill="#E5484D"/>` +
    `<rect x="176" y="205" width="44" height="140" fill="#F76B15"/>` +
    `<rect x="220" y="205" width="44" height="140" fill="#FFC53D"/>` +
    `<rect x="264" y="205" width="44" height="140" fill="#30A46C"/>` +
    `<rect x="308" y="205" width="44" height="140" fill="#0091FF"/>` +
    `<rect x="352" y="205" width="46" height="140" fill="#8E4EC6"/>` +
    `</g>` +
    `<ellipse cx="256" cy="176" rx="148" ry="74" fill="#FBFBFC"/>` +
    `<g clip-path="url(#${id}p)">${swirl}</g>` +
    `<ellipse cx="230" cy="198" rx="48" ry="16" fill="#000000" opacity="0.20"/>` +
    `<g clip-path="url(#${id}p)">` +
    `<g transform="translate(232,196) rotate(34)">` +
    `<path d="M -38 16 L -40 -38 L 40 -38 L 38 16 Z" fill="#E3C79E" stroke="#C2A578" stroke-width="2"/>` +
    `<path d="M -39 16 L -39 -14 L 39 -14 L 38 16 Z" fill="#8E4EC6"/>` +
    `</g>` +
    `</g>` +
    `<g transform="translate(232,196) rotate(34)">` +
    `<path d="M -42 -38 L 42 -38 L 42 -66 L -42 -66 Z" fill="#C3C8D2" stroke="#9BA1AD" stroke-width="2"/>` +
    `<path d="M -42 -52 L 42 -52" stroke="#9BA1AD" stroke-width="3"/>` +
    `<path d="M -15 -66 L -11 -140 C -11 -150 -13 -158 -13 -164 C -13 -174 -6 -180 0 -180 C 6 -180 13 -174 13 -164 C 13 -158 11 -150 11 -140 L 15 -66 Z M 6 -159 A 6 6 0 1 0 -6 -159 A 6 6 0 1 0 6 -159 Z" fill="#F0E3C8" fill-rule="evenodd" stroke="#C8B48E" stroke-width="2.5"/>` +
    `</g>` +
    `<g clip-path="url(#${id}f)">${swirl}</g>` +
    `<ellipse cx="212" cy="205" rx="36" ry="11" fill="#000000" opacity="0.14"/>` +
    `<g clip-path="url(#${id}p)"><ellipse cx="256" cy="176" rx="127" ry="57" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="10"/></g>` +
    `</g>`
  );
}

/**
 * The footer mark: 13 px app icon + `xivdyetools.app`, right-aligned at the
 * given right edge / baseline. Returns its total width for layout math.
 */
export function markFooter(rightX: number, baselineY: number, theme: CardTheme): string {
  const domain = 'xivdyetools.app';
  const domainW = textWidth(domain, CARD_TYPE.label, 'mono');
  const iconSize = 13;
  const gap = 7;
  const iconX = rightX - domainW - gap - iconSize;
  return (
    appIcon(iconX, baselineY - 11, iconSize) +
    cardText(rightX, baselineY, domain, {
      fill: theme.label,
      size: CARD_TYPE.label,
      font: 'mono',
      anchor: 'end',
    })
  );
}

// ============================================================================
// Shared primitives
// ============================================================================

/** A dye swatch with the inset ring that keeps extremes legible. */
export function swatch(
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string,
  theme: CardTheme,
  radius = 9
): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${escapeXml(hex)}"/>` +
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${radius - 0.5}" fill="none" stroke="${escapeXml(theme.swatchRing)}" stroke-width="1"/>`
  );
}

/**
 * An *ideal* (unbuyable) colour: the outlined variant — the vocabulary's
 * marker that this is the hue the maths asked for, not a thing you can buy.
 */
export function idealSwatch(x: number, y: number, w: number, h: number, hex: string, radius = 9): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${escapeXml(hex)}"/>` +
    `<rect x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="${radius - 0.75}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>`
  );
}

// ============================================================================
// The measured row (14I: one unconditional row, no optional slots)
// ============================================================================

/**
 * Per-card slot widths. 14K uses 38·52·180·26·34 with a 12.5 px name;
 * 14J·2 (the binding case) 40·54·176·26·34 at 13 px.
 */
export interface MeasuredRowWidths {
  lead: number;
  pair: number;
  name: number;
  bar: number;
  measure: number;
}

export interface MeasuredRowOptions {
  /** Lead value — only its *meaning* varies (step, share, rank) */
  lead: string;
  /** Left half of the butted pair: the asked-for colour (ideal/extracted/target) */
  sourceHex: string;
  /** Right half: the dye you can buy */
  dyeHex: string;
  /** Localized dye name (ellipsised to the slot, never a character count) */
  name: string;
  /** ΔE2000 source → dye */
  deltaE: number;
  lang: string;
  theme: CardTheme;
  widths: MeasuredRowWidths;
  /** Name type size (12.5 in 14K, 13 elsewhere) */
  nameSize?: number;
  /** Band context for the tier bar (default 'match') */
  context?: 'match' | 'harmony';
}

/** A rect rounded only on its left or right edge (for the butted pair). */
function halfRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  side: 'left' | 'right',
  fill: string
): string {
  const d =
    side === 'left'
      ? `M ${x + r} ${y} H ${x + w} V ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`
      : `M ${x} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x} Z`;
  return `<path d="${d}" fill="${escapeXml(fill)}"/>`;
}

/**
 * The suite's five-slot list row (confirmed for 12H, 12F, 14K and 14J·2):
 * lead value · butted source→dye pair · name · tier bar · measure. Every
 * argument required — a consumer that cannot fill all five is the signal the
 * abstraction needs revisiting, not a reason to add a flag.
 */
export function measuredRow(x: number, y: number, rowH: number, o: MeasuredRowOptions): string {
  const { widths: w, theme } = o;
  const nameSize = o.nameSize ?? 13;
  const gap = 10;
  const parts: string[] = [];
  const cy = y + rowH / 2;

  // Lead
  parts.push(
    cardText(x, cy + 4, o.lead, { fill: theme.subValue, size: CARD_TYPE.value, font: 'mono' })
  );
  let cx = x + w.lead + gap;

  // Butted pair: the seam between the halves is the drift made visible
  const pairH = Math.min(rowH - 12, 30);
  const half = w.pair / 2;
  parts.push(halfRoundedRect(cx, cy - pairH / 2, half, pairH, 7, 'left', o.sourceHex));
  parts.push(halfRoundedRect(cx + half, cy - pairH / 2, half, pairH, 7, 'right', o.dyeHex));
  parts.push(
    `<rect x="${cx + 0.5}" y="${cy - pairH / 2 + 0.5}" width="${w.pair - 1}" height="${pairH - 1}" rx="6.5" fill="none" stroke="${escapeXml(theme.swatchRing)}" stroke-width="1"/>`
  );
  cx += w.pair + gap;

  // Name
  parts.push(
    cardText(cx, cy + 4, fitText(o.name, w.name, nameSize, 'body'), {
      fill: theme.name,
      size: nameSize,
      font: 'body',
      weight: 600,
    })
  );
  cx += w.name + gap;

  // Tier bar + measure, both in the tone
  const tier = classifyBandTier(o.deltaE, 'ciede2000', o.context ?? 'match');
  const tone = theme.tiers[Math.min(tier, 3)];
  parts.push(`<rect x="${cx}" y="${cy - 2.5}" width="${w.bar}" height="5" rx="2.5" fill="${tone}"/>`);
  cx += w.bar + gap;
  parts.push(
    cardText(cx + w.measure, cy + 4, num(o.deltaE, o.lang, 1), {
      fill: tone,
      size: CARD_TYPE.value,
      font: 'mono',
      anchor: 'end',
    })
  );

  return parts.join('');
}

/** Horizontal dashed rule. */
export function dashedRule(x1: number, x2: number, y: number, theme: CardTheme): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${escapeXml(theme.dashed)}" stroke-width="1" stroke-dasharray="3 3"/>`;
}

/** Horizontal solid hairline rule. */
export function hairline(x1: number, x2: number, y: number, theme: CardTheme): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${escapeXml(theme.rule)}" stroke-width="1"/>`;
}
