/**
 * SVG Base Utilities
 *
 * Core utilities for generating SVG graphics as strings.
 * These SVGs are later converted to PNG using a platform-specific renderer
 * (e.g., resvg-wasm for Cloudflare Workers, @resvg/resvg-js for Node.js).
 */

/**
 * XML-escapes a string for safe SVG inclusion
 */
export function escapeXml(str: string): string {
  return str
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
 * Converts RGB to hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
export function createSvgDocument(
  width: number,
  height: number,
  content: string
): string {
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
  } = {}
): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `width="${width}"`,
    `height="${height}"`,
    `fill="${fill}"`,
  ];

  if (options.rx) attrs.push(`rx="${options.rx}"`);
  if (options.ry) attrs.push(`ry="${options.ry}"`);
  if (options.stroke) attrs.push(`stroke="${options.stroke}"`);
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
  } = {}
): string {
  const attrs = [
    `cx="${cx}"`,
    `cy="${cy}"`,
    `r="${r}"`,
    `fill="${fill}"`,
  ];

  if (options.stroke) attrs.push(`stroke="${options.stroke}"`);
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
  } = {}
): string {
  const attrs = [
    `x1="${x1}"`,
    `y1="${y1}"`,
    `x2="${x2}"`,
    `y2="${y2}"`,
    `stroke="${stroke}"`,
    `stroke-width="${strokeWidth}"`,
  ];

  if (options.opacity !== undefined) attrs.push(`opacity="${options.opacity}"`);
  if (options.dashArray) attrs.push(`stroke-dasharray="${options.dashArray}"`);

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
  } = {}
): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
  ];

  if (options.fill) attrs.push(`fill="${options.fill}"`);
  if (options.fontSize) attrs.push(`font-size="${options.fontSize}"`);
  if (options.fontFamily) attrs.push(`font-family="${options.fontFamily}"`);
  if (options.fontWeight) attrs.push(`font-weight="${options.fontWeight}"`);
  if (options.textAnchor) attrs.push(`text-anchor="${options.textAnchor}"`);
  if (options.dominantBaseline) attrs.push(`dominant-baseline="${options.dominantBaseline}"`);

  return `<text ${attrs.join(' ')}>${escapeXml(content)}</text>`;
}

/**
 * Creates an arc path for pie/donut charts
 */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (endAngle - 90) * (Math.PI / 180);

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * Creates a group element
 */
export function group(content: string, transform?: string): string {
  if (transform) {
    return `<g transform="${transform}">${content}</g>`;
  }
  return `<g>${content}</g>`;
}

/**
 * Theme colors for consistent styling
 */
export const THEME = {
  background: '#1a1a2e',
  backgroundLight: '#2d2d3d',
  text: '#ffffff',
  textMuted: '#909090',
  textDim: '#666666',
  accent: '#5865f2', // Discord Blurple
  border: '#404050',
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
 * - mono: Habibi (regular only) - hex codes, monospace-like text
 * - cjk: Noto Sans SC + Noto Sans KR - Japanese, Korean, Chinese text
 * - primaryCjk: Onest with CJK/KR fallback - for localized text that may contain CJK
 */
export const FONTS = {
  header: 'Space Grotesk',
  primary: 'Onest',
  mono: 'Habibi',
  cjk: 'Noto Sans SC, Noto Sans KR',
  /** Use this for headings that may contain CJK characters (e.g., dye names) */
  headerCjk: 'Space Grotesk, Noto Sans SC, Noto Sans KR',
  /** Use this for body text that may contain CJK characters (e.g., dye names) */
  primaryCjk: 'Onest, Noto Sans SC, Noto Sans KR',
} as const;
