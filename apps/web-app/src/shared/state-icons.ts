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

/** No price data (was ICON_COINS ×2) */
export const ICON_STATE_COINS = panelGlyph('coins', FLUID);

/** Error (was ICON_WARNING ×2) — the dot is the only filled element */
export const ICON_STATE_ALERT = themedAccent(panelGlyph('alert', FLUID));

/** Collections empty (was ICON_FOLDER ×2) */
export const ICON_STATE_FOLDER = panelGlyph('folder', FLUID);

/** 8A's launch-normal empty category — shelves with room (was ICON_EMPTY_INBOX) */
export const ICON_STATE_PRESETS_EMPTY = themedAccent(panelGlyph('presets-empty', FLUID));

/** No harmony results — the tool's own detail glyph, not music notes */
export const ICON_DETAIL_HARMONY = themedAccent(toolGlyph('harmony', 'detail', FLUID));

/** No image loaded — the extractor's detail glyph (sampled points read as "nothing sampled yet") */
export const ICON_DETAIL_EXTRACTOR = themedAccent(toolGlyph('extractor', 'detail', FLUID));

/**
 * The animated hourglass (2a, web-only): one 2.4 s clock — the grain falls
 * through the neck with a gravity ease-in over the first half, rests, then
 * the glass makes a 180° clockwise half-turn (58–92%) and lands with the
 * grain up top again; the frame is symmetric under the half-turn, so the
 * cycle is seamless. `prefers-reduced-motion` pauses to the static glyph.
 *
 * Styles are embedded in the SVG so the animation survives shadow-DOM
 * boundaries; bot/OG rasters render their own static wait glyph — resvg
 * never sees a keyframe.
 */
export const ICON_STATE_WAIT_ANIMATED = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <style>
    .hg-rot{transform-box:view-box;transform-origin:50% 50%;animation:hgRot 2.4s ease-in-out infinite}
    .hg-dot{transform-box:view-box;animation:hgDot 2.4s infinite}
    @keyframes hgRot{0%,58%{transform:rotate(0deg)}92%,100%{transform:rotate(180deg)}}
    @keyframes hgDot{0%,10%{transform:translateY(0);animation-timing-function:cubic-bezier(.6,.04,.9,.5)}48%,100%{transform:translateY(17.2px)}}
    @media (prefers-reduced-motion: reduce){.hg-rot,.hg-dot{animation:none}}
  </style>
  <g class="hg-rot" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4">
    <path d="M 7.6 3.4 H 24.4"/>
    <path d="M 7.6 28.6 H 24.4"/>
    <path d="M 10.2 3.4 V 7.8 C 10.2 11.8 13 13.8 16 16 C 13 18.2 10.2 20.2 10.2 24.2 V 28.6"/>
    <path d="M 21.8 3.4 V 7.8 C 21.8 11.8 19 13.8 16 16 C 19 18.2 21.8 20.2 21.8 24.2 V 28.6"/>
    <circle class="hg-dot" cx="16" cy="7.4" r="1.5" fill="var(--glyph-accent, #EA4133)" stroke="none"/>
  </g>
</svg>`;
