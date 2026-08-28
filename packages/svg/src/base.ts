/**
 * SVG Base Utilities
 *
 * Core utilities for generating SVG graphics as strings.
 * These SVGs are later converted to PNG using a platform-specific renderer
 * (e.g., resvg-wasm for Cloudflare Workers, @resvg/resvg-js for Node.js).
 */

/**
 * Characters XML 1.0 does not allow anywhere in a document: C0 controls other
 * than TAB/LF/CR, DEL-adjacent C1 controls, U+FFFE/U+FFFF, and lone surrogates
 * (a lone surrogate cannot even be UTF-8 encoded). resvg rejects the whole
 * SVG when one slips in, so a preset name carrying U+0001 used to kill its
 * card (FINDING-028, 2026-08-21 security audit).
 */
// Built from escapes: raw control characters in a regex literal trip
// no-irregular-whitespace and do not survive every transform.
const XML_ILLEGAL = new RegExp(
  '[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]' +
    '|[\uD800-\uDBFF](?![\uDC00-\uDFFF])' +
    '|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]',
  'g',
);

/**
 * XML-escapes a string for safe SVG inclusion (text content AND attribute
 * values), dropping characters that are illegal in XML altogether.
 */
export function escapeXml(str: string): string {
  return str
    .replace(XML_ILLEGAL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts a hex color to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16),
  };
}

/**
 * Calculates the luminance of a color (for contrast calculations)
 */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  // Relative luminance formula
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determines if text should be light or dark based on background color
 */
export function getContrastTextColor(bgHex: string): string {
  const luminance = getLuminance(bgHex);
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

/**
 * Creates an SVG document wrapper
 */
export function createSvgDocument(width: number, height: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${content}
</svg>`;
}

/**
 * Creates a rectangle element
 */
export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  options: {
    rx?: number;
    ry?: number;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  } = {},
): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${width}"`,
    `height="${height}"`,
    `fill="${escapeXml(fill)}"`,
  ];

  if (options.rx) attrs.push(`rx="${options.rx}"`);
  if (options.ry) attrs.push(`ry="${options.ry}"`);
  if (options.stroke) attrs.push(`stroke="${escapeXml(options.stroke)}"`);
  if (options.strokeWidth) attrs.push(`stroke-width="${options.strokeWidth}"`);
  if (options.opacity !== undefined) attrs.push(`opacity="${options.opacity}"`);

  return `<rect ${attrs.join(' ')}/>`;
}

/**
 * Creates a circle element
 */
export function circle(
  cx: number,
  cy: number,
  r: number,
  fill: string,
  options: {
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  } = {},
): string {
  const attrs = [`cx="${cx}"`, `cy="${cy}"`, `r="${r}"`, `fill="${escapeXml(fill)}"`];

  if (options.stroke) attrs.push(`stroke="${escapeXml(options.stroke)}"`);
  if (options.strokeWidth) attrs.push(`stroke-width="${options.strokeWidth}"`);
  if (options.opacity !== undefined) attrs.push(`opacity="${options.opacity}"`);

  return `<circle ${attrs.join(' ')}/>`;
}

/**
 * Creates a line element
 */
export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  strokeWidth: number = 1,
  options: {
    opacity?: number;
    dashArray?: string;
  } = {},
): string {
  const attrs = [
    `x1="${x1}"`,
    `y1="${y1}"`,
    `x2="${x2}"`,
    `y2="${y2}"`,
    `stroke="${escapeXml(stroke)}"`,
    `stroke-width="${strokeWidth}"`,
  ];

  if (options.opacity !== undefined) attrs.push(`opacity="${options.opacity}"`);
  if (options.dashArray) attrs.push(`stroke-dasharray="${escapeXml(options.dashArray)}"`);

  return `<line ${attrs.join(' ')}/>`;
}

/**
 * Creates a text element
 */
export function text(
  x: number,
  y: number,
  content: string,
  options: {
    fill?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number | string;
    textAnchor?: 'start' | 'middle' | 'end';
    dominantBaseline?: 'auto' | 'middle' | 'hanging';
  } = {},
): string {
  const attrs = [`x="${x}"`, `y="${y}"`];

  if (options.fill) attrs.push(`fill="${escapeXml(options.fill)}"`);
  if (options.fontSize) attrs.push(`font-size="${options.fontSize}"`);
  if (options.fontFamily) attrs.push(`font-family="${escapeXml(options.fontFamily)}"`);
  if (options.fontWeight) attrs.push(`font-weight="${options.fontWeight}"`);
  if (options.textAnchor) attrs.push(`text-anchor="${options.textAnchor}"`);
  if (options.dominantBaseline) attrs.push(`dominant-baseline="${options.dominantBaseline}"`);

  return `<text ${attrs.join(' ')}>${escapeXml(content)}</text>`;
}

/**
 * Creates a group element
 */
export function group(content: string, transform?: string): string {
  if (transform) {
    return `<g transform="${escapeXml(transform)}">${content}</g>`;
  }
  return `<g>${content}</g>`;
}

/**
 * The one suite accent (5.0). Blurple is retired everywhere — colour is
 * reserved for state, and the accent is this red on dark grounds
 * (`#CE2222` is its light-ground counterpart, see the icon system).
 */
export const ACCENT = '#EA4133';

/**
 * Theme colours for the pre-frame generators.
 *
 * Replaced wholesale in 5.0: the old palette was built on `#1a1a2e`, a navy
 * that appears nowhere else we make, and `#5865f2`, Discord's brand rather
 * than ours. These are the same surfaces `CARD_DARK` carries in `frame.ts` —
 * the two must not drift, because a card and a pre-frame generator can land
 * in the same channel a second apart.
 *
 * `frame.ts`'s `CardTheme` is the home for anything new; this object exists
 * for the generators that have not been re-cut onto the frame system yet.
 */
export const THEME = {
  background: '#17171A',
  backgroundLight: '#141416',
  text: '#ECECEE',
  textMuted: '#9C9CA2',
  textDim: '#86868C',
  accent: ACCENT,
  border: 'rgba(255,255,255,0.07)',
  success: '#57f287',
  warning: '#fee75c',
  error: '#ed4245',
} as const;

/**
 * Font families for consistent typography.
 * These names match the bundled font files loaded by the renderer.
 *
 * - header: Space Grotesk (variable 300-700) - titles, headers
 * - primary: Onest (variable 100-900) - body text, labels
 * - mono: Fragment Mono - hex codes, numeric columns, mono labels
 *   (the previous 'Habibi' was a proportional serif — numbers never aligned)
 * - cjk: Noto Sans JP + SC + KR - Japanese (JP letterforms first), Chinese, Korean text
 *   (JP added 2026-08-20 — F-17: preset-swatch was the one card rendering ja in SC letterforms)
 * - primaryCjk: Onest with CJK/KR fallback - for localized text that may contain CJK
 * - monoCjk: Fragment Mono has no CJK — mono labels containing CJK fall back
 *   to the body sans (letter-spacing 0.04em at the call site; no case in CJK)
 */
export const FONTS = {
  header: 'Space Grotesk',
  primary: 'Onest',
  mono: 'Fragment Mono',
  cjk: 'Noto Sans JP, Noto Sans SC, Noto Sans KR',
  /** Use this for headings that may contain CJK characters (e.g., dye names) */
  headerCjk: 'Space Grotesk, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  /** Use this for body text that may contain CJK characters (e.g., dye names) */
  primaryCjk: 'Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  /** Mono labels that may contain CJK (Fragment Mono has no CJK glyphs) */
  monoCjk: 'Fragment Mono, Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
} as const;

/**
 * Per-language number formatting: decimal separator and thousands grouping.
 * Every measured value in a card goes through {@link num} or {@link grp};
 * verdict sentences receive a formatter, never format inline. Identifiers
 * (criterion numbers, item IDs, stain IDs) are NOT quantities — never
 * localise them. One key per unit or it drifts.
 */
export const NUMFMT: Record<string, { dec: string; thou: string }> = {
  en: { dec: '.', thou: ',' },
  ja: { dec: '.', thou: ',' },
  de: { dec: ',', thou: '.' },
  fr: { dec: ',', thou: ' ' }, // narrow no-break space
  ko: { dec: '.', thou: ',' },
  zh: { dec: '.', thou: ',' },
};

/**
 * Format a measured value at a fixed precision with the language's decimal
 * separator. Precision travels with the formatter — callers never
 * `toFixed()` beside it (the 2-dp-verdict-on-1-dp-rows incident).
 */
export function num(value: number, lang: string, dp: number): string {
  const fmt = NUMFMT[lang] ?? NUMFMT['en'];
  return value.toFixed(dp).replace('.', fmt.dec);
}

/**
 * Format an integer with the language's thousands grouping (prices, counts).
 */
export function grp(value: number, lang: string): string {
  const fmt = NUMFMT[lang] ?? NUMFMT['en'];
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thou);
}

/**
 * Estimates the rendered width of text in pixels, accounting for CJK characters
 * which are typically ~2x the width of Latin characters (BUG-012).
 *
 * @param text - The text to measure
 * @param charWidth - Width of a single Latin character in pixels
 * @returns Estimated total width in pixels
 */
export function estimateTextWidth(text: string, charWidth: number): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    // REFACTOR-020: width class, not a script test — includes Hangul Jamo and
    // fullwidth forms/signs (： etc.), which render full-width in the
    // bundled Noto subsets; halfwidth katakana (U+FF61-FF9F) stays narrow.
    const isWide =
      (code >= 0x1100 && code <= 0x11ff) || // Hangul Jamo
      (code >= 0x3000 && code <= 0x9fff) || // CJK symbols, kana, ideographs
      (code >= 0xac00 && code <= 0xd7af) || // Hangul syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms (excl. halfwidth kana)
      (code >= 0xffe0 && code <= 0xffe6); // Fullwidth signs
    width += isWide ? charWidth * 2 : charWidth;
  }
  return width;
}
