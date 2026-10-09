/**
 * XIV Dye Tools - Empty-state / status glyphs (5.0 shim)
 *
 * The dissolution of `empty-state-icons.ts` (confirmed 2026-08-07,
 * `Empty States & Star Icons.dc.html` 1a): tool-flavoured empty states take
 * the confirmed detail glyphs, generic states take the 32-grid panel glyphs.
 * Geometry lives in `@xivdyetools/svg` — this module only re-exports
 * web-sized strings (`fluid`: CSS sizes them; `currentColor` ink inherits
 * the theme; the single filled element renders in the suite accent).
 *
 * State is never expressed through opacity — quiet states use the measured
 * label greys via `color`, full-strength ink.
 *
 * @module shared/state-icons
 */

import { panelGlyph, toolGlyph, type GlyphRenderOptions } from '@xivdyetools/svg';
import { themedAccent } from './glyph-accent';

const FLUID: GlyphRenderOptions = { fluid: true };

/** No search results (was ICON_SEARCH ×2) */
export const ICON_STATE_SEARCH = panelGlyph('search', FLUID);

/** Everything filtered out — the state is caused by filters (was ICON_PALETTE) */
export const ICON_STATE_FUNNEL = panelGlyph('funnel', FLUID);

/** Collections empty (was ICON_FOLDER ×2) */
export const ICON_STATE_FOLDER = panelGlyph('folder', FLUID);

/** 8A's launch-normal empty category — shelves with room (was ICON_EMPTY_INBOX) */
export const ICON_STATE_PRESETS_EMPTY = themedAccent(panelGlyph('presets-empty', FLUID));

/** No harmony results — the tool's own detail glyph, not music notes */
export const ICON_DETAIL_HARMONY = themedAccent(toolGlyph('harmony', 'detail', FLUID));
