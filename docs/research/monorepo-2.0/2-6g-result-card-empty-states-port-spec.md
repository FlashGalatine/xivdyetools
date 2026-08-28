# 2.6g — Result Card (Ticket · Split zones) + empty-state dissolution port spec

Sources (fetched 2026-08-08 via DesignSync from design project 993f0c5c):
- `ResultCard.dc.html` — the confirmed reusable component (compact + full variants,
  per-field `show.*` flags, short label props with full-form titles). This is the
  "✓ Chosen — now live in Console" **5B Ticket · Split zones** direction from
  `Result Card Directions.dc.html` (Turn 5 "German-proof").
- `Result Card Directions.dc.html` — turns 1–5. NOTE: the file exceeds DesignSync's
  256 KiB `get_file` cap; its trailing data script (per-language label tables) is
  unreachable. The register entry + the in-markup literals ("SPEC", "ΔE2000",
  "HUE OFF", "STAIN") are the authority used here.
- `Empty States & Star Icons.dc.html` — 1a (dissolution mapping), 1b (star pair),
  2a (animated hourglass). All CONFIRMED 2026-08-07.
- `Decisions.md` → Result Card: "Short keys ×3 field classes (`spectrumShort`,
  `acquisitionShort`, `categoryShort`), authored per locale — handoff + Turn 14" ·
  "User-configurable fields; swatch pair/name/ΔE structural; card keeps ΔE2000 —
  standing."

## A. Result Card — the chosen geometry (5B Ticket · Split zones)

Why 5B: an inline *label → value* row splits a narrow card in two, so DE values
("Farbstoffverkäufer" 18 ch, "Einfacher Farbstoff" 19 ch) get half the card and
ellipsis out. 5B recognises the two kinds of value: **colour spaces are short and
uniform** → they stay inline in a two-column numeric matrix; **text fields
(spectrum, source, cost) move below a rule** into a full-width zone with a fixed
62 px label column and right-aligned values that wrap to a second line rather
than truncate. Market prints after a dashed rule inside the text zone.

Card anatomy (full variant, `ResultCard.dc.html`):
1. Header row — slot-label chip (optional, tool-provided) + target text right.
2. Swatch pair (52 px, original + match; titles carry names).
3. Name — Space Grotesk 600 15px, `min-height: 36px`, **`overflow-wrap: anywhere;
   hyphens: auto`**, card root carries **`lang`** so DE hyphenates.
4. Verdict block — ΔE 26 px bold in tier colour over a hard-coded **ΔE2000**
   label (the card keeps ΔE2000 whatever the tool's ordering method — standing);
   optional HUE OFF readout; optional STAIN readout.
5. Perforation (dashed rule + two notch circles on the card ground).
6. Numeric matrix — 2-col grid: HEX · RGB · HSV · LAB (+ CMYK when enabled).
   Every cell: label `flex-shrink: 0`, value `min-width: 0; text-align: right;
   overflow-wrap: anywhere`.
7. Text zone (after a hairline rule) — SPEC · SOURCE · COST rows: label fixed
   62 px `flex-shrink: 0`, value full-flex right-aligned wrapping. MARKET row
   after a dashed rule, value in market colour (error red for H429 etc.).
8. Action bar — Select (flex: 1) + kebab (46 px). Existing context-menu /
   slot-picker machinery is preserved as-is (the sheet conversion is a
   16A-modal-phase concern, not this unit's).

### Short keys (the register's ×3 field classes)

They are **row-label** keys — one authored short form per field class per locale,
rendered in the fixed 62 px Fragment Mono label column with the full form in
`title` (the component doc renders `{{ labels.spectrum }}` with
`title="{{ labels.spectrumFull }}"`; the states markup shows the EN literal
"SPEC"). Values print **full** and wrap — that is what 5B's geometry is for;
values are never shortened on the web card.

New keys ×6 under `resultCard.*` (en authored from the doc literal; the rest
authored, never truncations; abbreviation periods part of the key):

| key | en | de | ja | fr | ko | zh |
|---|---|---|---|---|---|---|
| `spectrumShort` | SPEC | SPEK. | スペクトル | SPECTRE | 스펙트럼 | 光谱 |
| `acquisitionShort` | SOURCE | QUELLE | 入手先 | SOURCE | 출처 | 来源 |
| `categoryShort` | CAT. | KAT. | 系統 | CAT. | 계열 | 色系 |
| `hueOff` | HUE OFF | FARBTON | 色相差 | TEINTE | 색상차 | 色相差 |

(`hueOff` rides along — the verdict block's second readout label, previously the
hard-coded English "Hue°". `categoryShort` has no row on the confirmed web card;
it lands now as shared vocabulary for the Phase-3 bot dye-info frame, per the
register's Turn-14 provenance. STAIN/HEX/RGB/HSV/LAB/ΔE2000 are universal mono
terms and stay literal; COST/MARKET reuse `common.cost`/`common.market`,
uppercased for Latin scripts by CSS.)

### User-configurable fields

Structural (always render): swatch pair, name, ΔE2000 verdict, action bar.
Optional, **persistent, default all-on**: hue, stain, hex, rgb, hsv, lab,
spectrum, source+cost, market. Implementation extends the existing
`DisplayOptionsConfig` / ConfigController / `v4-display-options` machinery
rather than inventing a parallel store:

- `DisplayOptionsConfig` gains `showHue`, `showStain`, `showSpectrum`
  (default true). `showLab` default flips to **true** (all-on). `showCmyk`
  stays (default false) — CMYK is not a confirmed-card field; the row renders
  only when enabled. `showDeltaE` stays in the interface for legacy consumers
  but the card's verdict ignores it (structural) and its toggle leaves the
  display-options UI.
- `showAcquisition` gates SOURCE + COST; `showPrice` gates MARKET (unchanged
  meanings).
- Tool-level `show-*` attributes on `<v4-result-card>` remain hard gates,
  AND-ed with the user's persisted options (a tool that can't price things may
  still suppress market).

### ΔE2000 structural verdict

The card always computes and displays ΔE2000 (originalColor → matchedColor via
core), regardless of the `matchingMethod` used by the tool to order results.
`data.deltaE` is used directly when the method is `ciede2000` (no recompute
drift); otherwise the card derives ΔE2000 itself. Tier colour comes from core
`classifyBandTier(value, 'ciede2000', 'match')` mapped onto the established
ramps (dark `#5bbd68/#8bc34a/#ffc107/#f4645a`, light
`#137A33/#1C7D3A/#B45309/#B91C1C`).

### Overflow guards (the Turn-5 contract)

- card root: `lang="<current locale>"`.
- name: `overflow-wrap: anywhere; hyphens: auto;` fixed two-line box.
- every label: `flex-shrink: 0`; every value: `min-width: 0;
  overflow-wrap: anywhere;` — nothing truncates in any language.

## B. Empty states + star (dissolution, 1a/1b/2a)

`packages/svg` already ships the whole glyph set (Phase 0.2): panel glyphs
`search funnel coins alert wait folder presets-empty star star-fill`, tool
detail variants (`toolGlyph(name, 'detail')`). 2.6g is pure consumer work in
web-app:

Mapping (1a):

| state | was | now |
|---|---|---|
| noSearchResults | `ICON_SEARCH` ×2 | panel `search` |
| allFilteredOut | `ICON_PALETTE` | panel `funnel` |
| noPriceData | `ICON_COINS` ×2 | panel `coins` |
| noHarmonyResults | `ICON_HARMONY` (music notes) | `toolGlyph('harmony','detail')` |
| noImage | `ICON_IMAGE` ×2 | `toolGlyph('extractor','detail')` |
| error | `ICON_WARNING` ×2 | panel `alert` |
| loading | `ICON_LOADING` | panel `wait`, animated on web (2a) |
| collections empty | `ICON_FOLDER` ×2 | panel `folder` |
| preset category empty | `ICON_EMPTY_INBOX` (mailbox) | panel `presets-empty` |

Deletions: `shared/empty-state-icons.ts` whole; `ICON_GRID` (zero usages);
the 20-viewBox `ICON_STAR` replaced by the 32-grid pair (`star` / `star-fill`,
state from fill never fading). Vote pill on `preset-card` gains the pair at
18 px (1b context: outline un-voted, filled voted with accent).
`ICON_ARROW_BACK` moves from `category-icons.ts` to `ui-icons.ts`.

Opacity rules die: `.empty-state-icon { opacity: 0.3 }` → full-strength ink in
the measured quiet grey (`var(--theme-text-muted)`); glyph size drops from the
legacy 180 px to the doc's 62 px detail-class placement.

Hourglass (2a): CSS-only, one 2.4 s clock — grain falls through the neck
(gravity ease-in, translateY 17.2 px over 0–48%), glass makes a 180° clockwise
half-turn at 58–92%; seamless under the frame's symmetry. Grain is the accent
slot. `prefers-reduced-motion` pauses to the static glyph. Web-only — bot/OG
rasters always get the static `wait` glyph.

`EmptyStateOptions.icon` stops accepting emoji/text (SVG constants only); the
test asserting a 🎨 fallback goes with the port.

## Register notes

- The `Result Card Directions.dc.html` per-language data script is beyond the
  API read cap — if a future pass needs the drawn DE/JA label literals, read
  them in the design app. The keys landed here are authored per the register's
  own instruction ("authored per locale").
- Compact variant of `ResultCard.dc.html` (slot-chip grid card) is not built in
  this unit — no current web consumer renders cards at 186 px; the swatch/10A
  grid uses its own cells. It remains the record for a future mobile pass.
