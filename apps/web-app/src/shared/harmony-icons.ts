/**
 * XIV Dye Tools - Harmony Type SVG Icons (5.0 shim)
 *
 * The geometry home is `@xivdyetools/svg`: ten positions on the 1.4-weight
 * ring at real HarmonyGenerator offsets (confirmed set). This module maps the
 * web app's harmony-type keys onto the glyph names and emits CSS-sized
 * (`fluid`) strings with `currentColor` ink.
 *
 * @module shared/harmony-icons
 */

import { harmonyGlyph, type HarmonyGlyphName } from '@xivdyetools/svg';

const glyph = (name: HarmonyGlyphName): string => harmonyGlyph(name, { fluid: true });

/**
 * Harmony type icon SVG strings, keyed by the web app's harmony type ids.
 */
export const HARMONY_ICONS: Record<string, string> = {
  complementary: glyph('complementary'),
  analogous: glyph('analogous'),
  triadic: glyph('triadic'),
  'split-complementary': glyph('split'),
  tetradic: glyph('tetradic'),
  'inverted-tetradic': glyph('inverted-tetradic'),
  square: glyph('square'),
  monochromatic: glyph('mono'),
  compound: glyph('compound'),
  shades: glyph('shades'),
};
