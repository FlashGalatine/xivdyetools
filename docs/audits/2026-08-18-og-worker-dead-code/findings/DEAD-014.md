# [DEAD-014]: `renderer.ts` — the "legacy 1200-wide SVG" default path of `renderOGImage(...render)` is unreachable; header/param comments still say 1200×630

## Category
Dead Code Path (unreachable defaults) + stale comments

## Location
- `src/services/renderer.ts:265-278` (`render: {…} = {}`, `render.scale ?? 1`, `render.background ?? '#0B0B0C'`, comment "legacy 1200-wide SVGs pass scale 1")
- `src/services/renderer.ts:5` "Optimized for OpenGraph image generation (1200x630px)", `:112` "@param svgString - SVG content (should be 1200x630)"

## Evidence
All 12 `renderOGImage` call sites in `index.ts` pass `BAND_RENDER` (`{ scale: 3, background: '#0B0B0C' }`); no 1200-wide SVG exists anywhere in the worker after the 15E rewrite (every generator draws on the 400 grid). The `?? 1` scale default would render a 400×350 PNG — a silent 9× downgrade if a future call site forgot the third argument. The two comments describe the pre-5.0 canvas.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** the optionality: make `render` required (or default it to the 15E `{ scale: 3, background: '#0B0B0C' }` and drop `BAND_RENDER` from index.ts — one source, see DEAD-027); delete the "legacy" comment; fix lines 5 and 112.
