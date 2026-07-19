/**
 * SVG Base Utilities
 *
 * REFACTOR-009 (2026-07-18 audit): the primitives layer (escapeXml, color
 * helpers, rect/circle/line/text/group, document wrapper, truncation/width
 * estimation) is now re-exported from `@xivdyetools/svg` instead of being a
 * drifted local fork — og-worker inherits the package's attribute escaping
 * (REFACTOR-019) and CJK-aware `truncateText`/`estimateTextWidth`, which the
 * local copy lacked (naive `.length` truncation overflowed ja/ko/zh names).
 *
 * Only og-specific pieces stay local: the OG THEME (indigo accent — deliberately
 * different from the package's Discord-blurple theme), `linearGradient`, and
 * the 1200×630 OG_DIMENSIONS.
 */

export {
  escapeXml,
  hexToRgb,
  rgbToHex,
  getLuminance,
  getContrastTextColor,
  createSvgDocument,
  rect,
  circle,
  line,
  text,
  group,
  truncateText,
  estimateTextWidth,
  FONTS,
} from '@xivdyetools/svg';

/**
 * Creates a linear gradient definition (og-worker-specific primitive)
 */
export function linearGradient(
  id: string,
  stops: Array<{ offset: string; color: string }>,
  options: {
    x1?: string;
    y1?: string;
    x2?: string;
    y2?: string;
  } = {}
): string {
  const { x1 = '0%', y1 = '0%', x2 = '100%', y2 = '0%' } = options;

  const stopElements = stops
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
    .join('');

  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopElements}</linearGradient>`;
}

/**
 * Theme colors for consistent styling (OG cards use an indigo accent,
 * intentionally distinct from the package THEME's Discord blurple)
 */
export const THEME = {
  background: '#1a1a2e',
  backgroundLight: '#2d2d3d',
  backgroundCard: 'rgba(45, 45, 61, 0.8)',
  text: '#ffffff',
  textMuted: '#909090',
  textDim: '#666666',
  accent: '#6366f1', // Indigo
  border: '#404050',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;

/**
 * OG Image dimensions (Twitter/Discord standard)
 */
export const OG_DIMENSIONS = {
  width: 1200,
  height: 630,
} as const;
