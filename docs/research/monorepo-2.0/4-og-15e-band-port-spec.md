# Phase 4 — og-worker 15E Band cards

Port spec distilled 2026-08-08 from `OG Card Directions.dc.html` (Turn 15 + the
Turn-19 glyph amendment). Companion docs to fetch at implementation time:
`OG Default Cards.dc.html` (2a glyph-tile default set + plain-stripes root),
`OG X Variants.dc.html` (the 400×210 degrade record), `String Pass - OG
One-liners.dc.html` (the og deck strings ×6). Extracted doc at scratchpad
`og-cards.{html,txt}` + `og-cards-data.js`.

## Confirmed: 15E Band, ALL NINE tools

- **Colour edge to edge, data written into it.** No card, no border, no content
  area — vertical bands fill the frame; the base/chosen colour is 2× the width
  of a match so hierarchy is proportion, not typography. Only two tools have
  真 proportion to encode (Extractor share-of-image, Mixer ratio); everywhere
  else widths are equal or a flat 2:1 emphasis — never claim proportion where
  it is decoration.
- **One 34px bottom strip** is the only chrome: reduced bucket mark + wordmark
  left, the tool glyph (2C — compact 1B chip cluster, 32-grid stroke 2.4, at
  13px, between wordmark and tool tag; redundancy not replacement — an unfurl
  has no embed title naming the tool), tool tag right. **The URL is NOT in the
  strip** — the embed above the picture already carries it. The strip earns its
  place at the degrade: at 120px the type is gone but the glyph survives *as
  shape*.
- **Per-band ink is computed** (`getContrastTextColor` per band) — a mid-tone
  is marginal against both black and white; that is the accepted cost. Band
  text: role label / name / hex / tag, 11px floor, Fragment Mono for values.
- **One structural variant: a horizontal strip inside a vertical band** —
  as-designed above as-perceived (Accessibility), extracted pixel above matched
  dye (Extractor), mix above buyable (Mixer). One mechanism in the generator,
  never three special cases.
- **Band cap 5, comfortable max 4** (R1 Cap on a second surface, same tail
  rule: overflow goes to the embed text, never a narrower band). Swatch drops
  5 → 4 matches for this.
- **Qualified acceptances (read the confirmation as accepting them):** Budget
  keeps its numbers but loses its ordering — gil/ΔE has no proportional
  reading, so the ledger becomes a single recommendation. Comparison keeps its
  dyes but loses its answer — six pair numbers survive only as a mono run in
  the sub-line. 15A stays in the file as the record of that reading.
- Dark only (console theme), square corners (Discord rounds the frame), 400
  design grid.

## Frames + serving

- Discord: **400×350 design → ×3 raster 1200×1050** (real aspect honoured).
  X/Twitter: **400×210 → 1200×630** (summary_large_image crops non-2:1). The
  crawler detector already branches UA — frame-from-crawler is the same
  branch; **separate cache keys per frame** and `og:image:width/height` must
  state the RASTER size.
- X degrade: same bands; names drop to the strip (one `bandLine` + `url ·
  ΔE2000` line above the mark strip).
- `?lang=` on every emitted image URL (the CJK subsets finally earn their
  470KB); DE soft-hyphen pass server-side.
- Harmony Δ = **match → computed ideal** via core's LCh rotation (Phase 0) —
  the shipped base→match Δ paints a correct tetrad four-reds.
- Fragment Mono bundled (FONTS.mono=Habibi is not monospace); the ✦/🎨 emoji
  glyphs are already tofu — no emoji anywhere.
- Share URLs on the card and in routes key on **stainID** (Phase 1 grammar).
- Routes/defaults/URL-prefix blockers were Phase 0.5 (already landed):
  `/og/` prefix, og.xivdyetools.app route, per-tool `{tool}/default.png`,
  extractor/presets/budget routes + meta tags.

## Human redirect page

Console-themed (mark, dark palette), names the tool + the dye you asked for
while the refresh waits, `/manual`-equivalent link — replaces the two centred
paragraphs on `#1a1a2e`.

## Implementation order

1. Shared band module in og-worker `services/svg` (band layout + split-strip
   variant + 34px mark strip + contrast ink) on the 400 grid.
2. Nine tool generators (thin data adapters onto the band module) + root.
3. Crawler frame branch + cache keys + meta width/height.
4. Default card set (2a — fetch `OG Default Cards.dc.html`).
5. Strings ×6 (`String Pass - OG One-liners.dc.html`) + redirect page.
