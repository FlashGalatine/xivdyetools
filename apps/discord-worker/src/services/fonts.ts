/**
 * Font Loading Service
 *
 * Provides font file buffers for SVG-to-PNG rendering with resvg-wasm.
 * Fonts are bundled directly into the Worker at build time by wrangler.
 *
 * Brand fonts:
 * - Space Grotesk: Headers (variable weight 300-700)
 * - Onest: Body text, labels (variable weight 100-900)
 * - Fragment Mono: Hex codes and numeric columns (5.0 — replaced Habibi,
 *   which was a proportional serif and never aligned numbers)
 *
 * CJK fonts (for Japanese/Korean/Chinese support):
 * - Noto Sans CJK SC: Pan-CJK font supporting Japanese, Korean, and Chinese
 *
 * To enable CJK support:
 * 1. Download Noto Sans CJK SC from Google Fonts:
 *    https://fonts.google.com/noto/specimen/Noto+Sans+SC
 * 2. Extract NotoSansSC-Regular.ttf (or use the variable font)
 * 3. Place it in src/fonts/NotoSansSC-Regular.ttf
 * 4. Uncomment the CJK import below and rebuild
 *
 * Note: The CJK fonts are subsetted to only the codepoints present in the
 * core + bot-i18n locale JSON files (~474 KiB SC + ~801 KiB KR).
 */

// Static font imports - wrangler bundles these as ArrayBuffer at build time
// @ts-expect-error - Binary imports are handled by wrangler bundler
import spaceGroteskData from '../fonts/SpaceGrotesk-VariableFont_wght.ttf';
// @ts-expect-error - Binary imports are handled by wrangler bundler
import onestData from '../fonts/Onest-VariableFont_wght.ttf';
// @ts-expect-error - Binary imports are handled by wrangler bundler
import fragmentMonoData from '../fonts/FragmentMono-Regular.ttf';

// CJK font imports - subsetted via apps/discord-worker/scripts/subset-cjk-fonts.py
// Noto Sans SC: Chinese ideographs + Japanese kana (~474 KiB)
// @ts-expect-error - Binary imports are handled by wrangler bundler
import notoSansCjkData from '../fonts/NotoSansSC-Subset.ttf';
// Noto Sans KR: Korean Hangul syllables
// @ts-expect-error - Binary imports are handled by wrangler bundler
import notoSansKrData from '../fonts/NotoSansKR-Subset.ttf';
// Noto Sans JP: Japanese kana + kanji in Japanese letterforms (5.0 — before
// this subset, ja rendered out of the SC subset in Chinese letterforms)
// @ts-expect-error - Binary imports are handled by wrangler bundler
import notoSansJpData from '../fonts/NotoSansJP-Subset.ttf';

// Cache font buffers to avoid repeated conversions
let fontBuffersCache: Uint8Array[] | null = null;

/**
 * Check if CJK font is available
 */
export function hasCjkFont(): boolean {
  return notoSansCjkData !== null;
}

/**
 * Returns font file data as Uint8Array buffers for resvg-wasm.
 * Buffers are cached after first call.
 *
 * Usage with resvg:
 * ```typescript
 * const resvg = new Resvg(svgString, {
 *   font: {
 *     fontBuffers: getFontBuffers(),
 *     defaultFontFamily: 'Onest',
 *   },
 * });
 * ```
 */
export function getFontBuffers(): Uint8Array[] {
  if (fontBuffersCache) {
    return fontBuffersCache;
  }

  const buffers: Uint8Array[] = [
    new Uint8Array(spaceGroteskData as ArrayBuffer),
    new Uint8Array(onestData as ArrayBuffer),
    new Uint8Array(fragmentMonoData as ArrayBuffer),
  ];

  // Add CJK fonts if available
  if (notoSansCjkData) {
    buffers.push(new Uint8Array(notoSansCjkData as ArrayBuffer));
  }
  if (notoSansKrData) {
    buffers.push(new Uint8Array(notoSansKrData as ArrayBuffer));
  }
  if (notoSansJpData) {
    buffers.push(new Uint8Array(notoSansJpData as ArrayBuffer));
  }

  fontBuffersCache = buffers;
  return fontBuffersCache;
}

/**
 * Font family names as they appear in the font metadata.
 * Use these names in SVG font-family attributes.
 */
export const FONT_FAMILIES = {
  /** Space Grotesk - for headers and titles */
  header: 'Space Grotesk',
  /** Onest - for body text and labels */
  body: 'Onest',
  /** Fragment Mono - for hex codes and numeric columns (no CJK glyphs) */
  mono: 'Fragment Mono',
  /** Noto Sans SC - for CJK (Chinese/Japanese) text */
  cjk: 'Noto Sans SC',
  /** Noto Sans KR - for Korean text */
  kr: 'Noto Sans KR',
} as const;

/**
 * Get a font-family string with CJK fallback for text that may contain
 * Japanese, Korean, or Chinese characters.
 *
 * @param primaryFont - The primary font to use (e.g., 'Onest')
 * @returns A font-family string with CJK fallback if available
 */
export function getFontWithCjkFallback(primaryFont: string, locale?: string): string {
  if (!hasCjkFont()) {
    return primaryFont;
  }
  // JP-first belongs only to ja — zh must never pick up Japanese letterforms
  // for shared ideographs.
  if (locale === 'ja') {
    return `${primaryFont}, Noto Sans JP, ${FONT_FAMILIES.cjk}, ${FONT_FAMILIES.kr}`;
  }
  return `${primaryFont}, ${FONT_FAMILIES.cjk}, ${FONT_FAMILIES.kr}`;
}
