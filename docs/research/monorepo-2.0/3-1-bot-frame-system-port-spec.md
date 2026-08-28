# 3.1 — Bot graphics 5.0: frame system + Turn-11 confirmed frames

Sources (fetched 2026-08-08 via DesignSync): `Bot Graphics Directions.dc.html`
(Turn 11 — vocabulary + /dye info + /harmony + /dye random, all RESOLVED) and
`Bot Graphics Directions 2.dc.html` (Turn 12 — R1 Cap CONFIRMED). Register:
"The 400×350 / 11 px / five-row vocabulary — what ships is a vocabulary, not a
layout"; command pill carries the tool glyph (2A); `/dye` takes the bare chip.

## The vocabulary (frame.ts, `@xivdyetools/svg`)

- **Canvas width IS display width**: 400 px wide, raster at 2× for sharpness.
  Height grows with the result and **stops at 350** (hard wall — past it
  Discord serves the image narrower). A shorter result is a shorter card.
- **Type floor**: 11 px all-caps mono labels · 13 px values · 16 px names.
  Nothing below 11, ever.
- **Palette (dark)**: surface `#17171A`, chrome pill bg `rgba(255,255,255,0.06)`
  ink `#9C9CA2`, name `#ECECEE`, value `#C6C6CA`, label `#86868C`, border =
  inset 1 px `rgba(255,255,255,0.07)`, dashed rules `rgba(255,255,255,0.16)`,
  accent text `#FF6257` (glyph accent on chrome too). Radius 16.
- **Palette (light)**: surface `#FFFFFF`, inset border `#E4E4E7`, pill bg
  `#EBEBEE` ink `#63636A`, name `#17181B`, value `#3E3E44`, label `#6B6B73`,
  dashed `rgba(23,24,27,0.22)`, accent `#B01C1C` (also the mono-glyph ink on
  dye-coloured grounds in light). Light is a stored preference (defaults
  dark); wiring the preference is a later shell item — both themes ship in
  the generators now.
- **Tier ramps**: dark `#5bbd68/#8bc34a/#ffc107/#f4645a`, light
  `#137A33/#1C7D3A/#B45309/#B91C1C`. Bands are a property of the surface
  *and* the context: match cuts 5/10/20, harmony cuts 6/12/20 (core
  `classifyBandTier(v, 'ciede2000', ctx)`).
- **Command chip**: mono 11 ls 1.1, padding 4×8, radius 6, glyph 13 px inside
  the pill (2A) with the accent chip in `#FF6257`/`#B01C1C`; on dye-coloured
  grounds the pill is `rgba(0,0,0,0.34)` ink `rgba(255,255,255,0.85)` and the
  glyph goes mono (accent = ink). `/dye` commands take the **bare chip**
  (panel `dye` glyph); the nine tools take their compact tool glyph.
- **Mark**: the official app icon (512-grid bucket on the `#CE2222` tile,
  geometry lifted verbatim from the doc's `#botmark` symbol) at 13 px + 
  `xivdyetools.app` mono 11 label colour, bottom-right, never centred.
- **PNG self-contained; embed one line** — no instruction text ever baked in;
  manual pointers and overflow counts live in the embed.
- **R1 Cap (Turn 12, governs all list graphics)**: five rows at full size;
  the tail (only when >5 asked for) is a swatch strip + count. Sequences
  (gradient) keep endpoints and thin the middle — that lands with Turn-12
  commands, not here. `/harmony`'s 55 px rows hold **three**; monochromatic
  (5 slots) caps at 3 rows + tail strip per R1's "capping not compressing".

## Confirmed frames (this unit)

### /dye info → 11B (400×350)
Header band 78 px in the dye's own colour: pill top-left (mono variant),
`{lStain} N` top-right (mono 13, white .85), name bottom-left (Space Grotesk
600 23 white), category under it (mono 12 white .72). Then a 2-col numeric
grid (HEX/RGB/HSV/LAB, label 11/value 13, gap 6×18, padding 11 15 10), dashed
rule, SRC/MKT rows (SRC value = `{acquisition} · {vendor price}`, MKT =
`{Spectrum item name} · {consolidated itemID}` — the Spectrum name stays
verbatim EN, like a command choice value; unconsolidated dyes print their own
itemID), solid rule, `{lNearest} · {+N more}` strip: three columns (swatch
26 h r7, name Onest 12 500 ellipsis, tier bar 4 px + ΔE mono 12 in tone,
match cuts), footer mark. COST row was cut by the 350 cap — price rides SRC.

### /harmony → 11A (grows, ≤350)
Padding 15 16 13. Header: pill (chrome ground, glyph accent) + harmony type
right (mono 13 ls .6 accent text, uppercase localized). Base block: 62 px
swatch r11 + `{lBase}` 11 / name SG 600 20 / `#HEX · {lStain} N` mono 12.
Dashed rule. Slot rows (55 px rhythm, margin-top 13): ideal swatch 34 r9
**outline ring 1.5 white .35** → arrow → found swatch 42 r10; name Onest 600
15 ellipsis + sub `HEX · STAIN` mono 11.5; right ΔE SG 700 19 + tier word
mono 11, both in tone (harmony cuts, tier words = the confirmed `tags` ×6).
Footer: `{lIdealKey}` legend left + mark right. Rows cap at 3 (R1) — extra
slots become a tail swatch strip + count line in the embed.

### /dye random → 11B table (grows with count, ≤350: 5 rows + header exactly)
Title (SG 600 18) + pill right (bare chip, accent glyph). Header row (padding
9 16 5): 46 px swatch gutter, `{lName}` flex, `{lCat}` 68 px, `{lStain}` 62 px
right. Rows 52 px, top border white 7%: swatch 46×38 r9, name Onest 600 14.5
ellipsis over hex mono 11.5, category mono 11.5 `#9C9CA2` (truncates), stain
mono 13 right. Footer mark. Count ≤5 (R1; command clamps).

## Label keys ×6 (bot-logic i18n, `card.*` — verbatim from the doc's data script)

lStain STAIN/FARBNR./番号/N° TEINTE/염색번호/染色号 · lSrc SRC/QUELLE/入手/
SOURCE/출처/来源 · lMkt MKT/MARKT/市場/MARCHÉ/시장/市场 · lCost COST/PREIS/
価格/PRIX/가격/价格 · lBase BASE/BASIS/ベース/BASE/기준/基色 · lNearest ·
nearestMore (+1 more — takes {n}) · lIdeal · lFound · lName · lCat ·
lIdealKey (legend) · bandKey · harmony tier words `tags` ×4 (EXACT/CLOSE/
LOOSE/UNREACHABLE and locales) · randomTitle/randomSub. Widths are sized
against the longest locale (FARBNR. ≈ 2× STAIN), which the flex layouts and
fixed columns above already absorb.

## Data contracts (bot-logic)

- `executeDyeInfo`: gains nearest-3 (ΔE2000 over the 125 non-Facewear pool,
  excluding self), stainID, localized acquisition + vendor cost (via core
  `ACQUISITION_META`/locales + `grp()`), market line via `CONSOLIDATED_DYES`
  (verbatim EN name + itemID) or own itemID, theme + locale through to the
  generator. Embed collapses to one line: `{name} · {share URL}` (stainID
  grammar).
- `executeRandom`: passes stainID + count ≤5; embed one line (the dye list
  duplicated the picture — cut).
- `executeHarmony`: passes ideal hex + found dye + ΔE2000 per slot (the
  companion/ideal data already computed), harmony-type label localized
  (uppercased at the generator), R1 tail when slots > 3. The wheel generator
  is deleted with its callers (`generateHarmonyWheel` retired).

## Register notes

- The old generators' snapshot tests are replaced, not preserved — geometry
  changed wholesale by design.
- THEME (navy `#1a1a2e`) stays untouched this unit for the seven generators
  not yet ported; it dies when the last consumer moves to CardTheme.
- Turn 12/13/14 commands (extractor/mixer/gradient, contrast/accessibility,
  comparison/budget/swatch, /preset) follow in later units on this frame
  system; shell/meta items (/about, /changelog, /manual, /stats, first-run)
  after those.
