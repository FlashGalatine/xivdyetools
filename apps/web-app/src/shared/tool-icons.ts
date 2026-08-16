/**
 * XIV Dye Tools - Tool Navigation SVG Icons (5.0 shim)
 *
 * The glyph geometry home is `@xivdyetools/svg` (the 1B Chip Cluster set,
 * confirmed 2026-08-07) — this module only re-exports web-sized strings.
 * `fluid` omits width/height so existing CSS keeps sizing the icons;
 * `currentColor` ink inherits the theme, and the single accent chip renders
 * in the suite red.
 *
 * Naming drift fixed with the artwork (the register landmine):
 * `ICON_TOOL_MIXER` used to BE the Gradient icon — it is now genuinely the
 * Dye Mixer glyph, and Gradient has `ICON_TOOL_GRADIENT`. The `TOOL_ICONS`
 * keys never change.
 *
 * @module shared/tool-icons
 */

import { toolGlyph, type ToolGlyphName } from '@xivdyetools/svg';
import { themedAccent } from './glyph-accent';

const glyph = (name: ToolGlyphName): string =>
  themedAccent(toolGlyph(name, 'compact', { fluid: true }));

export const ICON_TOOL_HARMONY = glyph('harmony');
export const ICON_TOOL_EXTRACTOR = glyph('extractor');
export const ICON_TOOL_ACCESSIBILITY = glyph('accessibility');
export const ICON_TOOL_COMPARISON = glyph('comparison');
export const ICON_TOOL_GRADIENT = glyph('gradient');
export const ICON_TOOL_MIXER = glyph('mixer');
export const ICON_TOOL_PRESETS = glyph('presets');
export const ICON_TOOL_BUDGET = glyph('budget');
export const ICON_TOOL_CHARACTER = glyph('swatch');
export const ICON_TOOL_MENU = glyph('tools');

/** Legacy constant name (pre-5.0 drift) — same glyph, kept for the mixer import. */
export const ICON_TOOL_DYE_MIXER = ICON_TOOL_MIXER;

/**
 * Map of tool icon names to SVG strings. Keys are stable (never change).
 */
export const TOOL_ICONS: Record<string, string> = {
  harmony: ICON_TOOL_HARMONY,
  extractor: ICON_TOOL_EXTRACTOR,
  accessibility: ICON_TOOL_ACCESSIBILITY,
  comparison: ICON_TOOL_COMPARISON,
  gradient: ICON_TOOL_GRADIENT,
  mixer: ICON_TOOL_MIXER,
  presets: ICON_TOOL_PRESETS,
  budget: ICON_TOOL_BUDGET,
  swatch: ICON_TOOL_CHARACTER,
  // Legacy aliases for backwards compatibility
  matcher: ICON_TOOL_EXTRACTOR,
  character: ICON_TOOL_CHARACTER,
  tools: ICON_TOOL_MENU,
};

/**
 * Get tool icon by name
 */
export function getToolIcon(name: string): string | undefined {
  return TOOL_ICONS[name];
}
