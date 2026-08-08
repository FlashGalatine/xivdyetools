# 6A Lens — Accessibility Checker port spec (distilled from the design project)

Source: `Accessibility Tool Directions.dc.html` + `AccessibilityScreen.dc.html` in design
project `993f0c5c-05b9-439b-8047-66a9c5ab1bd6` (fetched 2026-08-08). CONFIRMED: **6A Lens is
the Accessibility Checker spec; 6B (Matrix) and 6C (Report) stay in the file as the record.**
The drawn screen embeds the future mobile shell (tool sheet, dye sheet, slide-over) — that
chrome belongs to the Mobile Redesign shell work, NOT this port. This port reworks the tool
*content* inside the existing v4 shell.

## The idea

Pick a lens (vision type) and the whole workspace repaints through it — the four dyes, the
pair readout, the Result Cards. Nothing on screen is a colour the wearer sees; everything is
a colour the viewer sees. Comparison across lenses is a memory exercise, so each lens tab
carries a coloured dot for its worst pair.

Seed pair rationale: Neon Pink × Neon Green are 62% apart normally and **14% under
deuteranopia** — that number is the tool.

## Layout (content region, top to bottom)

1. **Slot strip** — up to 4 slots. Swatch (22px band) + name; when a lens ≠ normal is active,
   each swatch carries a `4px solid <simColour>` bottom bar (`simBar`). Slots accept
   arbitrary colours (hex field + feature-detected native picker) — tag `HEX` instead of
   `SLOT n` for custom colours. Slot title = `name · #HEX`.
2. **Lens tabs** (horizontal scroll) — the five vision rows: label + mono prevalence + a
   5px worst-pair dot coloured by that lens's worst pair tier. Active tab = accent bg.
3. **Lens grid** — one card per dye (2-col): card ground = simulated colour, 22px chip of
   the *original* top-left (white ring), `ΔE n.n` badge top-right (CIEDE2000 original→sim,
   the shift the lens introduces), name bottom (dark scrim pill).
4. **Pair readout** ("Can you tell them apart" section) — one row per pair: sim swatch pair
   (17×30 butted), `A × B` title, note line, value right in the selected unit coloured by
   tier. Note when lens ≠ normal: `62% NRM → 14% DEU` (normal value → current). Row border
   tints the tier colour when the pair fails.
   - Section header: label + ⓘ button (opens MetricHelp) + mono unit short right.
5. **MetricHelp** (inline expander under the section header, shared component) — unit
   definition, caveat, tier legend (four words, same in every unit; only numbers change),
   the three-unit switcher, and for `ratio` a learn-more link.
6. **Result cards** ("Seen as" section) — existing compact ResultCards, semantics: swatch
   pair = *as designed* → *as perceived*, ΔE = the lens shift. Count label right.

## The three units (Advanced → Pair readout, or from the ⓘ; default stays pct)

| id | tag | bands (good/tight/fail) | standard |
|----|-----|------------------------|----------|
| `pct` | `%` | 60 / 2×thr / thr (thr = the user's MATCH slider threshold, default 30) | NO — badge **NOT A STANDARD** |
| `ratio` | `:1` | 7 / 4.5 / 3 (WCAG 1.4.11) | yes — the only one |
| `de2000` | `ΔE` | 35 / 20 / 10 | no |

- `pct` = √(Δr²+Δg²+Δb²)/441.67 on the **simulated** pair (core `getDistinguishabilityPercent`).
- `ratio` = WCAG relative-luminance contrast on the simulated pair; 1.4.11 replaces 1.4.3
  everywhere; AA/AAA wording only in the per-dye vs white/black table (kept from 6B? NO —
  6A has no contrast table; the ratio unit lives in the pair readout).
- `de2000` = CIEDE2000 on the simulated pair.
- Formats: pct `Math.round(v) + '%'` · ratio `v.toFixed(2) + ':1'` · de2000 `'ΔE ' + v.toFixed(1)`.
- Tier colours (dark theme): `good #5bbd68 · tight #8bc34a · fail #ffc107 · below #f4645a`
  (light: `#137A33 / #1C7D3A / #B45309 / #B91C1C`). ΔE-shift badge tiers (`etier`):
  <5 / <10 / <20 / <35 / ≥35 over the same colour ramps.
- Tier legend words ×3 in doc (en/de/ja): en `Clear / Fine / Tight / Collapsed`,
  de `Klar / Gut / Knapp / Verschmolzen`, ja `明瞭 / 良好 / 接近 / 判別不可` (FR/KO/ZH to author).

## Unit strings (verbatim from the doc — en/de/ja; FR/KO/ZH authored at port time)

- pct label `Distinguishability / Unterscheidbarkeit / 判別度`; short adds ` %`.
  - desc en: "The app's own measure: straight-line RGB distance between the two simulated
    colours, over the 441.67 diagonal of the colour cube."
  - caveat en: "Not a WCAG rating and not perceptual — it reads high for dark colours.
    Useful for ranking, not for a compliance claim."
- ratio label `Contrast ratio / Kontrastverhältnis / コントラスト比`; short `Contrast ratio · WCAG 1.4.11`.
  - desc en: "WCAG relative luminance contrast between the two simulated colours. Success
    Criterion 1.4.11 Non-text Contrast asks for at least 3:1 between adjacent meaningful colours."
  - caveat en: "This is the only readout here backed by a published standard — but it only
    sees lightness, so two equally bright dyes score badly even when hue tells them apart."
- de2000 label `Perceptual distance / Perzeptueller Abstand / 知覚的距離`; short `ΔE2000`.
  - desc en: "CIEDE2000 colour difference between the two simulated colours — the same
    metric the other tools use for match quality. Around 1.0 is the smallest difference a
    trained eye can see."
  - caveat en: "Perceptually honest and consistent with the rest of the app, but no
    standard defines a pass mark — the 10 and 20 here are this tool's call."
- Learn more (ratio only): "Read WCAG 1.4.11 Non-text Contrast" →
  `https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html`
  (core learn-links has the /manual table; this URL rides the unit entry).

## Visions (order + prevalences; labels/descs exist ×6 in web locales already — verify)

`normal ~92% · deuteranopia ~6% ♂ · protanopia ~2% ♂ · tritanopia ~0.01% · achromatopsia ~0.003%`
Shorts: NRM / DEU / PRO / TRI / ACH. Descriptions (en, for locale keys):
- normal: "Standard colour perception — the palette as you painted it."
- deuteranopia: "Red-green. The most common form, and about one man in twelve."
- protanopia: "Red-green, with reds darkened as well as shifted."
- tritanopia: "Blue-yellow. Rare, and it hits teals and yellows hardest."
- achromatopsia: "No colour at all — only lightness separates two dyes."
Simulation = Brettel matrices (core `simulateColorblindnessHex`), achromatopsia =
luminance greyscale (already in core's matrix set — verify core has achromatopsia; the doc
matrix is the Rec.601 luma row ×3).

## Worst-pair dots + slot risk

Per lens `worst = min(pair value under that lens)` in the active unit's bands; dot colour =
`mtier(worst)`. (Slots also have a `riskColor` = worst tier among pairs touching that slot —
drawn but only used in 6B/6C frames; skip unless cheap.)

## Semantics note (decided alongside the layout)

The Result Card swatch pair changes meaning here: both swatches are the same dye,
*as designed* → *as perceived*; ΔE becomes the lens shift. Accepted (register).
Arbitrary colours: Accessibility joins Harmony/Gradient/Mixer in the arbitrary-colour table.

## What dies from the current tool

The vision-checkbox filter rail, the standalone vision-cards block, the contrast table
(vs white/black with AA/AAA chips), and the distinguishability matrix — 6B territory, all
replaced by the lens + pair readout. The MATCH threshold slider stays (feeds pct bands).

## Verdict block (6C) — NOT in 6A; do not port.
