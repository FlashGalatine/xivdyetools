/**
 * XIV Dye Tools - Theme-aware glyph accent (web only)
 *
 * The icon home in `@xivdyetools/svg` bakes the accent as a literal fill so
 * bot/OG rasters (resvg has no CSS-var support) stay correct. The web app
 * swaps that literal for a custom property here, letting `themes.css` move
 * the accent between #EA4133 (dark) and #CE2222 (light) live.
 *
 * @module shared/glyph-accent
 */

import { GLYPH_ACCENT_DARK } from '@xivdyetools/svg';

/** Replace the baked accent fill with the theme-driven custom property. */
export function themedAccent(svg: string): string {
  return svg.replaceAll(
    `fill="${GLYPH_ACCENT_DARK}"`,
    `fill="var(--glyph-accent, ${GLYPH_ACCENT_DARK})"`
  );
}
