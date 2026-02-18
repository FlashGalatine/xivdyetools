/**
 * Font Loading Service
 *
 * Provides font file buffers for SVG-to-PNG rendering with resvg-wasm.
 * Fonts are bundled directly into the Worker at build time by wrangler.
 *
 * Brand fonts:
 * - Space Grotesk: Headers (variable weight 300-700)
 * - Onest: Body text, labels (variable weight 100-900)
 * - Habibi: Hex codes (static, regular weight only)
 */

// Static font imports - wrangler bundles these as ArrayBuffer at build time
// @ts-expect-error - Binary imports are handled by wrangler bundler
import spaceGroteskData from '../fonts/SpaceGrotesk-VariableFont_wght.ttf';
// @ts-expect-error - Binary imports are handled by wrangler bundler
import onestData from '../fonts/Onest-VariableFont_wght.ttf';
// @ts-expect-error - Binary imports are handled by wrangler bundler
import habibiData from '../fonts/Habibi-Regular.ttf';

// Cache font buffers to avoid repeated conversions
let fontBuffersCache: Uint8Array[] | null = null;

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

  fontBuffersCache = [
    new Uint8Array(spaceGroteskData),
    new Uint8Array(onestData),
    new Uint8Array(habibiData),
  ];

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
  /** Habibi - for hex codes and monospace-like text */
  mono: 'Habibi',
} as const;
